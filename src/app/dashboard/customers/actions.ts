"use server";

import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { logActivity } from "@/lib/db/activity-log";
import {
  bills,
  customerLedgerTransactions,
  customerRates,
  customers,
  paymentAllocations,
  payments,
} from "@/lib/db/schema";

const openingBalanceSchema = z.object({
  customerId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a customer's opening balance as a real ledger transaction (never
 * an editable field — see SYSTEM_ARCHITECTURE.md rule 4). Fully Postgres —
 * the ledger entry and the customer's cached balance are written inside one
 * db.transaction, same guarantee Firestore's runTransaction gave.
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

  const db = getDb();
  const delta = direction === "debit" ? amount : -amount;

  try {
    await db.transaction(async (tx) => {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (!customer) {
        throw new Error("Customer not found.");
      }
      if (customer.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this customer.");
      }

      await tx.insert(customerLedgerTransactions).values({
        customerId,
        type: "opening_balance",
        direction,
        amount: String(amount),
        note,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      // Cached balance is written only inside this same transaction, per
      // SYSTEM_ARCHITECTURE.md — never edited as a standalone field elsewhere.
      await tx
        .update(customers)
        .set({
          balance: sql`${customers.balance} + ${delta}`,
          hasOpeningBalance: true,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
    });
    revalidatePath(`/dashboard/customers/${customerId}`);
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
 * Payment, ledger entry, customer balance, FIFO allocation, and each bill's
 * amountPaid update all happen inside one Postgres transaction now that
 * bills, payments, and the ledger all live in the same database.
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
    // bad amount before any write is even attempted.
    const amountIssue = parsed.error.issues.some((issue) => issue.path[0] === "amount");
    return {
      ok: false,
      error: amountIssue ? "Enter a valid payment amount greater than zero." : "Invalid input.",
    };
  }
  const { customerId, amount, method, note } = parsed.data;

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (!customer) {
        throw new Error("Customer not found.");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          customerId,
          amount: String(amount),
          method: method ?? null,
          note: note ?? null,
          createdByUid: session.uid,
          createdByEmail: session.email,
        })
        .returning();

      await tx.insert(customerLedgerTransactions).values({
        customerId,
        type: "payment",
        direction: "credit",
        amount: String(amount),
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: payment.id,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} - ${amount}`, updatedAt: new Date() })
        .where(eq(customers.id, customerId));

      // FIFO-allocate against the customer's outstanding finalized bills,
      // oldest finalized first.
      let remaining = amount;
      const outstandingBills = await tx
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
        await tx
          .update(bills)
          .set({ amountPaid: sql`${bills.amountPaid} + ${allocation}`, updatedAt: new Date() })
          .where(eq(bills.id, bill.id));
        await tx.insert(paymentAllocations).values({
          paymentId: payment.id,
          billId: bill.id,
          customerId,
          amount: String(allocation),
        });
        remaining = Math.round((remaining - allocation) * 100) / 100;
      }
    });

    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath(`/dashboard/customers/${customerId}/ledger`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

const updatePaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Owner-only correction of an existing payment's amount/method/note (the
 * ledger's Edit action). If the amount changes, every existing FIFO
 * allocation this payment made is reversed (each bill's amountPaid drops
 * back) and re-run from scratch against the customer's currently
 * outstanding finalized bills with the new amount — same allocation
 * logic as recordCustomerPayment. The matching "payment" ledger row's
 * amount is updated too, and the customer's cached balance moves by
 * exactly the delta (old amount undone, new amount applied).
 */
export async function updateCustomerPayment(input: {
  paymentId: string;
  amount: number;
  method?: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can edit a payment." };
  }

  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid payment amount greater than zero." };
  }
  const { paymentId, amount, method, note } = parsed.data;

  const db = getDb();
  let customerId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
      if (!payment) throw new Error("Payment not found.");
      customerId = payment.customerId;
      const oldAmount = Number(payment.amount);
      const now = new Date();

      const allocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));
      for (const allocation of allocations) {
        await tx
          .update(bills)
          .set({ amountPaid: sql`${bills.amountPaid} - ${allocation.amount}`, updatedAt: now })
          .where(eq(bills.id, allocation.billId));
      }
      await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId));

      await tx
        .update(payments)
        .set({ amount: String(amount), method: method ?? null, note: note ?? null })
        .where(eq(payments.id, paymentId));

      await tx
        .update(customerLedgerTransactions)
        .set({ amount: String(amount), note: note?.trim() || `Payment${method ? ` (${method})` : ""}` })
        .where(and(eq(customerLedgerTransactions.paymentId, paymentId), eq(customerLedgerTransactions.type, "payment")));

      // Net balance move: undo the old credit, apply the new one.
      const delta = Math.round((oldAmount - amount) * 100) / 100;
      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} + ${delta}`, updatedAt: now })
        .where(eq(customers.id, payment.customerId));

      let remaining = amount;
      const outstandingBills = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.customerId, payment.customerId), eq(bills.status, "finalized")))
        .orderBy(asc(bills.finalizedAt));
      for (const bill of outstandingBills) {
        if (remaining <= 0) break;
        const subtotal = Number(bill.subtotal);
        const amountPaidSoFar = Number(bill.amountPaid ?? "0");
        const due = Math.round((subtotal - amountPaidSoFar) * 100) / 100;
        if (!Number.isFinite(due) || due <= 0) continue;

        const newAllocation = Math.min(remaining, due);
        await tx
          .update(bills)
          .set({ amountPaid: sql`${bills.amountPaid} + ${newAllocation}`, updatedAt: now })
          .where(eq(bills.id, bill.id));
        await tx.insert(paymentAllocations).values({
          paymentId,
          billId: bill.id,
          customerId: payment.customerId,
          amount: String(newAllocation),
        });
        remaining = Math.round((remaining - newAllocation) * 100) / 100;
      }
    });

    if (customerId) {
      revalidatePath(`/dashboard/customers/${customerId}`);
      revalidatePath(`/dashboard/customers/${customerId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save changes." };
  }
}

const deletePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes a payment — see deletePurchase's doc comment for
 * the same "void mostly fixed data-entry mistakes" reasoning. Reverses
 * every FIFO allocation this payment made (each bill's amountPaid drops
 * back) and the customer's cached balance, then deletes the row — its
 * customer_ledger_transactions row and payment_allocations rows cascade
 * away via their FK. Owner-only, matching the ledger's Edit/Delete
 * gating — a tightening from the old void's any-active-admin gate.
 */
export async function deleteCustomerPayment(input: { paymentId: string; reason?: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a payment." };
  }

  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { paymentId, reason } = parsed.data;

  const db = getDb();
  let customerId: string | undefined;
  let amountForLog = 0;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
      if (!payment) {
        throw new Error("Payment not found.");
      }
      customerId = payment.customerId;
      amountForLog = Number(payment.amount);

      const allocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));
      for (const allocation of allocations) {
        await tx
          .update(bills)
          .set({ amountPaid: sql`${bills.amountPaid} - ${allocation.amount}`, updatedAt: new Date() })
          .where(eq(bills.id, allocation.billId));
      }

      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} + ${payment.amount}`, updatedAt: new Date() })
        .where(eq(customers.id, payment.customerId));

      // Cascades: customer_ledger_transactions, payment_allocations.
      await tx.delete(payments).where(eq(payments.id, paymentId));
    });

    await logActivity({
      action: "payment_deleted",
      targetType: "payment",
      targetId: paymentId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { customerId, amount: amountForLog, reason: reason ?? null },
    });
    if (customerId) {
      revalidatePath(`/dashboard/customers/${customerId}`);
      revalidatePath(`/dashboard/customers/${customerId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete payment.",
    };
  }
}

const deleteCustomerSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes a customer AND their entire financial trail. Now that
 * bills, payments, payment allocations, and ledger transactions all live in
 * Postgres, deleting the customer row cascades to every one of them via the
 * ON DELETE CASCADE foreign keys declared in src/lib/db/schema (bills, bill
 * line items, customer rates + history, payments, payment allocations,
 * customer_ledger_transactions).
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

  const db = getDb();

  try {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) {
      return { ok: false, error: "Customer not found." };
    }

    // Counted before the cascade below removes them, for an accurate
    // activity-log record of what this purge actually did.
    const [billRows, ratesRows, paymentRows, ledgerRows] = await Promise.all([
      db.select().from(bills).where(eq(bills.customerId, customerId)),
      db.select().from(customerRates).where(eq(customerRates.customerId, customerId)),
      db.select().from(payments).where(eq(payments.customerId, customerId)),
      db.select().from(customerLedgerTransactions).where(eq(customerLedgerTransactions.customerId, customerId)),
    ]);

    await db.delete(customers).where(eq(customers.id, customerId));

    await logActivity({
      action: "customer_deleted",
      targetType: "customer",
      targetId: customerId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: {
        customerName: customer.name,
        reason: reason ?? null,
        purgedCounts: {
          bills: billRows.length,
          payments: paymentRows.length,
          ledgerTransactions: ledgerRows.length,
          customerRates: ratesRows.length,
        },
      },
    });

    revalidatePath("/dashboard/customers");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete customer.",
    };
  }
}
