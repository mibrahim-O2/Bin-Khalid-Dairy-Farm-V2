"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";

const openingBalanceSchema = z.object({
  customerId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a customer's opening balance as a real ledger transaction (never
 * an editable field — see SYSTEM_ARCHITECTURE.md rule 4). This is the first
 * financial write in the project: it must go through a Server Action using
 * the Admin SDK, atomically, per the trust boundary in that doc — the
 * client is never allowed to write customerLedgerTransactions directly
 * (Firestore rules deny it outright).
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

  try {
    await db.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }
      if (customerSnap.data()?.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this customer.");
      }

      const delta = direction === "debit" ? amount : -amount;
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
 * an advance payment). All in one Admin SDK transaction.
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

  const db = getAdminDb();
  const customerRef = db.collection("customers").doc(customerId);
  const paymentRef = db.collection("payments").doc();

  try {
    await db.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }

      const outstandingBillsSnap = await tx.get(
        db
          .collection("bills")
          .where("customerId", "==", customerId)
          .where("status", "==", "finalized")
          .orderBy("finalizedAt", "asc")
      );

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

      tx.set(db.collection("customerLedgerTransactions").doc(), {
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

      let remaining = amount;
      for (const billDoc of outstandingBillsSnap.docs) {
        if (remaining <= 0) break;
        const bill = billDoc.data() as { subtotal: number; amountPaid?: number };
        // Bills finalized before `amountPaid` existed have no such field in
        // Firestore at all — without this default, `subtotal - undefined`
        // is NaN, and `NaN <= 0` is false, so the skip-guard below never
        // fires and a NaN reaches FieldValue.increment() further down.
        const amountPaidSoFar = bill.amountPaid ?? 0;
        const due = Math.round((bill.subtotal - amountPaidSoFar) * 100) / 100;
        if (!Number.isFinite(due) || due <= 0) continue;

        const allocation = Math.min(remaining, due);
        tx.update(billDoc.ref, {
          amountPaid: FieldValue.increment(allocation),
          updatedAt: now,
        });
        tx.set(db.collection("paymentAllocations").doc(), {
          paymentId: paymentRef.id,
          billId: billDoc.id,
          customerId,
          amount: allocation,
          createdAt: now,
        });
        remaining = Math.round((remaining - allocation) * 100) / 100;
      }
    });
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
 * balance — via a reversing debit ledger entry, all in one transaction.
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

  const db = getAdminDb();
  const paymentRef = db.collection("payments").doc(paymentId);

  try {
    await db.runTransaction(async (tx) => {
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
        db.collection("paymentAllocations").where("paymentId", "==", paymentId)
      );

      const now = new Date().toISOString();
      const customerRef = db.collection("customers").doc(payment.customerId);

      tx.set(db.collection("customerLedgerTransactions").doc(), {
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

      // Reverse only this payment's own allocations — never touch what
      // other payments contributed to the same bill.
      for (const allocationDoc of allocationsSnap.docs) {
        const allocation = allocationDoc.data() as { billId: string; amount: number };
        tx.update(db.collection("bills").doc(allocation.billId), {
          amountPaid: FieldValue.increment(-allocation.amount),
          updatedAt: now,
        });
      }

      tx.update(paymentRef, {
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
      });
    });
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
 * Permanently deletes a customer AND their entire financial trail — bills
 * (every status), payments (including voided ones), payment allocations,
 * customerLedgerTransactions (this covers opening-balance entries too:
 * they're just a ledger transaction with type "opening_balance", not a
 * separate collection), and the rate schedule (+ history).
 *
 * This is a DELIBERATE, EXPLICIT exception to SYSTEM_ARCHITECTURE.md's
 * "never hard-delete a finalized financial record" rule — confirmed by the
 * Owner specifically for this feature, because it's Owner-only, requires
 * confirmation, and is meant to fully remove a customer rather than
 * preserve an orphaned trail. Do not extend this pattern to any other
 * delete path without the same explicit sign-off.
 *
 * Atomicity: when everything fits under Firestore's ~500-operation limit
 * (the overwhelmingly common case for a single customer), this all happens
 * in one transaction — genuinely atomic, fully succeeds or fully fails.
 * A customer with an extraordinary volume of history that exceeds that
 * limit falls back to sequential batches; Firestore has no primitive for
 * true atomicity beyond ~500 ops, so that path is instead deliberately
 * ordered to stay safely retriable — every financial record is deleted
 * before the customer document itself, so a failure partway through still
 * leaves the customer doc in place (nothing orphaned with no customer to
 * identify it), and simply re-running the delete finishes the job.
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

  const db = getAdminDb();
  const customerRef = db.collection("customers").doc(customerId);

  try {
    const customerSnap = await customerRef.get();
    if (!customerSnap.exists) {
      return { ok: false, error: "Customer not found." };
    }
    const customer = customerSnap.data() as { name: string };

    const byCustomerId = (collection: string) =>
      db.collection(collection).where("customerId", "==", customerId).get();

    const [billsSnap, paymentsSnap, allocationsSnap, ledgerSnap, ratesSnap] = await Promise.all([
      byCustomerId("bills"),
      byCustomerId("payments"),
      byCustomerId("paymentAllocations"),
      byCustomerId("customerLedgerTransactions"),
      byCustomerId("customerRates"),
    ]);
    const rateHistorySnaps = await Promise.all(
      ratesSnap.docs.map((rateDoc) => rateDoc.ref.collection("history").get())
    );

    const refsToDelete = [
      ...billsSnap.docs.map((d) => d.ref),
      ...paymentsSnap.docs.map((d) => d.ref),
      ...allocationsSnap.docs.map((d) => d.ref),
      ...ledgerSnap.docs.map((d) => d.ref),
      ...ratesSnap.docs.map((d) => d.ref),
      ...rateHistorySnaps.flatMap((snap) => snap.docs.map((d) => d.ref)),
    ];

    const now = new Date().toISOString();
    const logRef = db.collection("activityLogs").doc();
    const logData = {
      action: "customer_deleted",
      customerId,
      customerName: customer.name,
      reason: reason ?? null,
      performedBy: { uid: session.uid, email: session.email },
      createdAt: now,
      purgedCounts: {
        bills: billsSnap.size,
        payments: paymentsSnap.size,
        paymentAllocations: allocationsSnap.size,
        ledgerTransactions: ledgerSnap.size,
        customerRates: ratesSnap.size,
      },
    };

    if (refsToDelete.length + 2 <= TRANSACTION_SAFE_OP_LIMIT) {
      await db.runTransaction(async (tx) => {
        for (const ref of refsToDelete) tx.delete(ref);
        tx.delete(customerRef);
        tx.set(logRef, logData);
      });
    } else {
      for (let i = 0; i < refsToDelete.length; i += TRANSACTION_SAFE_OP_LIMIT) {
        const batch = db.batch();
        for (const ref of refsToDelete.slice(i, i + TRANSACTION_SAFE_OP_LIMIT)) {
          batch.delete(ref);
        }
        await batch.commit();
      }
      const finalBatch = db.batch();
      finalBatch.delete(customerRef);
      finalBatch.set(logRef, logData);
      await finalBatch.commit();
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete customer.",
    };
  }
}
