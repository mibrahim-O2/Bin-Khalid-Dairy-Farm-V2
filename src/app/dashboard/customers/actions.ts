"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { and, asc, eq, sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { bills, customerRates, customers } from "@/lib/db/schema";

const openingBalanceSchema = z.object({
  customerId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a customer's opening balance as a real ledger transaction (never
 * an editable field — see SYSTEM_ARCHITECTURE.md rule 4). Still Firestore —
 * this whole file migrates to Postgres in M4/M5. NOTE: this only updates
 * the Firestore customer doc's cached balance; the Postgres customers row
 * (source of truth for name/phone/address/active since M2) is NOT kept in
 * sync here. All data is disposable test data during this migration, so
 * that inconsistency is accepted deliberately rather than bridged — see
 * the Owner's M3 direction. It resolves itself once this file migrates.
 */
export async function setCustomerOpeningBalance(input: {
  customerId: string;
  direction: "debit" | "credit";
  amount: number;
  note: string;
}): Promise<ActionResult> {
  // Defense in depth: don't rely solely on the client having been gated by
  // the dashboard layout — re-verify the caller is an active admin here too.
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = openingBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, direction, amount, note } = parsed.data;

  const db = getAdminDb();
  const customerRef = db.collection("customers").doc(customerId);
  const ledgerRef = db.collection("customerLedgerTransactions").doc();
  const delta = direction === "debit" ? amount : -amount;

  try {
    await db.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }
      if (customerSnap.data()?.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this customer.");
      }

      const now = new Date().toISOString();

      tx.set(ledgerRef, {
        customerId,
        type: "opening_balance",
        direction,
        amount,
        note,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      // Cached balance is written only inside this same transaction, per
      // SYSTEM_ARCHITECTURE.md — never edited as a standalone field elsewhere.
      tx.update(customerRef, {
        balance: FieldValue.increment(delta),
        hasOpeningBalance: true,
        updatedAt: now,
      });
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to set opening balance.",
    };
  }
}

const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Records a customer payment: a real ledger credit, and FIFO-allocates it
 * across the customer's outstanding finalized bills (oldest first) so each
 * bill's payment status (see getBillPaymentStatus()) updates automatically.
 * Any amount left after every outstanding bill is settled still reduces the
 * customer's overall balance — it just isn't tied to a specific bill (e.g.
 * an advance payment).
 *
 * The payment record, ledger entry, and customer balance are still
 * Firestore (this file migrates fully in M4/M5) — but bills themselves
 * moved to Postgres in M3, so the FIFO lookup and each bill's `amountPaid`
 * update happen there now, in their own Postgres transaction. This isn't a
 * sync bridge (there's nothing to keep consistent both ways): bills simply
 * live in Postgres now, so this is where the code has to look to find what
 * a customer actually owes, full stop — the alternative is payments
 * silently never marking any bill paid.
 */
export async function recordCustomerPayment(input: {
  customerId: string;
  amount: number;
  method?: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    // Zod already rejects NaN/undefined/zero/negative amounts here — this
    // (and the client-side check in RecordPaymentDialog) is what stops a
    // bad amount before any Firestore write is even attempted.
    const amountIssue = parsed.error.issues.some((issue) => issue.path[0] === "amount");
    return {
      ok: false,
      error: amountIssue ? "Enter a valid payment amount greater than zero." : "Invalid input.",
    };
  }
  const { customerId, amount, method, note } = parsed.data;

  const fsDb = getAdminDb();
  const customerRef = fsDb.collection("customers").doc(customerId);
  const paymentRef = fsDb.collection("payments").doc();

  try {
    await fsDb.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }

      const now = new Date().toISOString();

      tx.set(paymentRef, {
        customerId,
        amount,
        method: method ?? null,
        note: note ?? null,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });

      tx.set(fsDb.collection("customerLedgerTransactions").doc(), {
        customerId,
        type: "payment",
        direction: "credit",
        amount,
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: paymentRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(customerRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: now,
      });
    });

    // FIFO-allocate against Postgres bills (see the function doc comment).
    // Separate from the Firestore transaction above — Postgres and
    // Firestore can't share one atomic transaction — but the Firestore
    // side (payment + ledger + balance) is what's financially binding;
    // this just marks which bills that payment covers.
    const pgDb = getDb();
    let remaining = amount;
    const outstandingBills = await pgDb
      .select()
      .from(bills)
      .where(and(eq(bills.customerId, customerId), eq(bills.status, "finalized")))
      .orderBy(asc(bills.finalizedAt));

    for (const bill of outstandingBills) {
      if (remaining <= 0) break;
      const subtotal = Number(bill.subtotal);
      const amountPaidSoFar = Number(bill.amountPaid ?? "0");
      const due = Math.round((subtotal - amountPaidSoFar) * 100) / 100;
      if (!Number.isFinite(due) || due <= 0) continue;

      const allocation = Math.min(remaining, due);
      await pgDb
        .update(bills)
        .set({ amountPaid: sql`${bills.amountPaid} + ${allocation}`, updatedAt: new Date() })
        .where(eq(bills.id, bill.id));
      await getAdminDb().collection("paymentAllocations").add({
        paymentId: paymentRef.id,
        billId: bill.id,
        customerId,
        amount: allocation,
        createdAt: new Date().toISOString(),
      });
      remaining = Math.round((remaining - allocation) * 100) / 100;
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

const voidPaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * Voids a payment: never deletes or edits the original record (same
 * principle as voidBill). Reverses exactly what this payment did — its
 * FIFO allocations (each bill's amountPaid drops back by what this specific
 * payment contributed, so getBillPaymentStatus() re-derives correctly even
 * if other payments also touched the same bill) and the customer's cached
 * balance — via a reversing debit ledger entry.
 */
export async function voidCustomerPayment(input: {
  paymentId: string;
  reason: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = voidPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A reason is required to void a payment." };
  }
  const { paymentId, reason } = parsed.data;

  const fsDb = getAdminDb();
  const paymentRef = fsDb.collection("payments").doc(paymentId);

  try {
    const { allocations } = await fsDb.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) {
        throw new Error("Payment not found.");
      }
      const payment = paymentSnap.data() as {
        customerId: string;
        amount: number;
        voidedAt: string | null;
      };
      if (payment.voidedAt != null) {
        throw new Error("This payment has already been voided.");
      }

      const allocationsSnap = await tx.get(
        fsDb.collection("paymentAllocations").where("paymentId", "==", paymentId)
      );
      const allocations = allocationsSnap.docs.map(
        (d) => d.data() as { billId: string; amount: number }
      );

      const now = new Date().toISOString();
      const customerRef = fsDb.collection("customers").doc(payment.customerId);

      tx.set(fsDb.collection("customerLedgerTransactions").doc(), {
        customerId: payment.customerId,
        type: "payment_void",
        direction: "debit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(customerRef, {
        balance: FieldValue.increment(payment.amount),
        updatedAt: now,
      });

      tx.update(paymentRef, {
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
      });

      return { payment, allocations };
    });

    // Reverse this payment's own allocations against Postgres bills — see
    // recordCustomerPayment's comment on why bills specifically live there.
    const pgDb = getDb();
    for (const allocation of allocations) {
      await pgDb
        .update(bills)
        .set({ amountPaid: sql`${bills.amountPaid} - ${allocation.amount}`, updatedAt: new Date() })
        .where(eq(bills.id, allocation.billId));
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void payment.",
    };
  }
}

const deleteCustomerSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// Firestore caps a single transaction/batch at 500 writes. Leave headroom
// for the customer-doc delete + the activityLogs write that always
// accompany the purged records.
const TRANSACTION_SAFE_OP_LIMIT = 480;

/**
 * Permanently deletes a customer AND their entire financial trail.
 * Firestore side: payments (including voided ones), payment allocations,
 * customerLedgerTransactions (this covers opening-balance entries too:
 * they're just a ledger transaction with type "opening_balance", not a
 * separate collection). Postgres side: the customer row itself, which
 * cascades to bills, bill line items, customer rates (+ history), and any
 * customer_ledger_transactions already there — see the ON DELETE CASCADE
 * foreign keys in src/lib/db/schema.
 *
 * This is a DELIBERATE, EXPLICIT exception to SYSTEM_ARCHITECTURE.md's
 * "never hard-delete a finalized financial record" rule — confirmed by the
 * Owner specifically for this feature, because it's Owner-only, requires
 * confirmation, and is meant to fully remove a customer rather than
 * preserve an orphaned trail. Do not extend this pattern to any other
 * delete path without the same explicit sign-off.
 */
export async function deleteCustomer(input: {
  customerId: string;
  reason?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a customer." };
  }

  const parsed = deleteCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, reason } = parsed.data;

  const fsDb = getAdminDb();
  const customerRef = fsDb.collection("customers").doc(customerId);

  try {
    const customerSnap = await customerRef.get();
    if (!customerSnap.exists) {
      return { ok: false, error: "Customer not found." };
    }
    const customer = customerSnap.data() as { name: string };

    const byCustomerId = (collection: string) =>
      fsDb.collection(collection).where("customerId", "==", customerId).get();

    const [paymentsSnap, allocationsSnap, ledgerSnap] = await Promise.all([
      byCustomerId("payments"),
      byCustomerId("paymentAllocations"),
      byCustomerId("customerLedgerTransactions"),
    ]);

    const refsToDelete = [
      ...paymentsSnap.docs.map((d) => d.ref),
      ...allocationsSnap.docs.map((d) => d.ref),
      ...ledgerSnap.docs.map((d) => d.ref),
    ];

    // Counted before the Postgres cascade below removes them, for an
    // accurate activity-log record of what this purge actually did.
    const pgBillsCount = await getDb()
      .select()
      .from(bills)
      .where(eq(bills.customerId, customerId))
      .then((rows) => rows.length);
    const pgRatesCount = await getDb()
      .select()
      .from(customerRates)
      .where(eq(customerRates.customerId, customerId))
      .then((rows) => rows.length);

    const now = new Date().toISOString();
    const logRef = fsDb.collection("activityLogs").doc();
    const logData = {
      action: "customer_deleted",
      customerId,
      customerName: customer.name,
      reason: reason ?? null,
      performedBy: { uid: session.uid, email: session.email },
      createdAt: now,
      purgedCounts: {
        bills: pgBillsCount,
        payments: paymentsSnap.size,
        paymentAllocations: allocationsSnap.size,
        ledgerTransactions: ledgerSnap.size,
        customerRates: pgRatesCount,
      },
    };

    if (refsToDelete.length + 2 <= TRANSACTION_SAFE_OP_LIMIT) {
      await fsDb.runTransaction(async (tx) => {
        for (const ref of refsToDelete) tx.delete(ref);
        tx.delete(customerRef);
        tx.set(logRef, logData);
      });
    } else {
      for (let i = 0; i < refsToDelete.length; i += TRANSACTION_SAFE_OP_LIMIT) {
        const batch = fsDb.batch();
        for (const ref of refsToDelete.slice(i, i + TRANSACTION_SAFE_OP_LIMIT)) {
          batch.delete(ref);
        }
        await batch.commit();
      }
      const finalBatch = fsDb.batch();
      finalBatch.delete(customerRef);
      finalBatch.set(logRef, logData);
      await finalBatch.commit();
    }

    // Postgres: deleting the customer row cascades to bills, bill line
    // items, customer rates (+ history), and any customer_ledger_transactions
    // already there. Best-effort — the Firestore purge above is the
    // Owner-facing "this customer is gone" guarantee; a leftover Postgres
    // row would be a manually-fixable loose end, not a financial-integrity
    // one.
    try {
      await getDb().delete(customers).where(eq(customers.id, customerId));
    } catch (err) {
      console.error(`Failed to delete Postgres customer row ${customerId}:`, err);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete customer.",
    };
  }
}
