"use server";

// Supplier opening balance / Jama payments / ledger, fully on Postgres
// (M8) — no Firestore involvement anywhere in this file. Mirrors
// customers/actions.ts exactly, with Domain B's naming (Jama = payment to
// a supplier) and purchases in place of bills.

import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { logActivity } from "@/lib/db/activity-log";
import {
  purchases,
  supplierLedgerTransactions,
  supplierPaymentAllocations,
  supplierPayments,
  suppliers,
} from "@/lib/db/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const openingBalanceSchema = z.object({
  supplierId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

/**
 * Records a supplier's opening balance as a real ledger transaction — see
 * setCustomerOpeningBalance in customers/actions.ts, this is the same
 * pattern for Domain B (Suppliers: debit = purchase/farm owes more,
 * credit = payment/farm owes less).
 */
export async function setSupplierOpeningBalance(input: {
  supplierId: string;
  direction: "debit" | "credit";
  amount: number;
  note: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = openingBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { supplierId, direction, amount, note } = parsed.data;

  const db = getDb();
  const delta = direction === "debit" ? amount : -amount;

  try {
    await db.transaction(async (tx) => {
      const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (!supplier) {
        throw new Error("Supplier not found.");
      }
      if (supplier.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this supplier.");
      }

      await tx.insert(supplierLedgerTransactions).values({
        supplierId,
        type: "opening_balance",
        direction,
        amount: String(amount),
        note,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(suppliers)
        .set({
          balance: sql`${suppliers.balance} + ${delta}`,
          hasOpeningBalance: true,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, supplierId));
    });
    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to set opening balance.",
    };
  }
}

const recordPaymentSchema = z.object({
  supplierId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Records a Jama (payment to a supplier): a real ledger credit,
 * FIFO-allocated across the supplier's outstanding finalized purchases
 * (oldest first). Mirrors recordCustomerPayment exactly — payment,
 * ledger entry, supplier balance, FIFO allocation, and each purchase's
 * amountPaid update all happen inside one Postgres transaction now that
 * purchases, payments, and the ledger all live in the same database.
 */
export async function recordSupplierPayment(input: {
  supplierId: string;
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
    const amountIssue = parsed.error.issues.some((issue) => issue.path[0] === "amount");
    return {
      ok: false,
      error: amountIssue ? "Enter a valid payment amount greater than zero." : "Invalid input.",
    };
  }
  const { supplierId, amount, method, note } = parsed.data;

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (!supplier) {
        throw new Error("Supplier not found.");
      }

      const [payment] = await tx
        .insert(supplierPayments)
        .values({
          supplierId,
          amount: String(amount),
          method: method ?? null,
          note: note ?? null,
          createdByUid: session.uid,
          createdByEmail: session.email,
        })
        .returning();

      await tx.insert(supplierLedgerTransactions).values({
        supplierId,
        type: "payment",
        direction: "credit",
        amount: String(amount),
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: payment.id,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(suppliers)
        .set({ balance: sql`${suppliers.balance} - ${amount}`, updatedAt: new Date() })
        .where(eq(suppliers.id, supplierId));

      // FIFO-allocate against the supplier's outstanding finalized
      // purchases, oldest finalized first.
      let remaining = amount;
      const outstandingPurchases = await tx
        .select()
        .from(purchases)
        .where(and(eq(purchases.supplierId, supplierId), eq(purchases.status, "finalized")))
        .orderBy(asc(purchases.finalizedAt));

      for (const purchase of outstandingPurchases) {
        if (remaining <= 0) break;
        const subtotal = Number(purchase.subtotal);
        const amountPaidSoFar = Number(purchase.amountPaid ?? "0");
        const due = Math.round((subtotal - amountPaidSoFar) * 100) / 100;
        if (!Number.isFinite(due) || due <= 0) continue;

        const allocation = Math.min(remaining, due);
        await tx
          .update(purchases)
          .set({ amountPaid: sql`${purchases.amountPaid} + ${allocation}`, updatedAt: new Date() })
          .where(eq(purchases.id, purchase.id));
        await tx.insert(supplierPaymentAllocations).values({
          paymentId: payment.id,
          purchaseId: purchase.id,
          supplierId,
          amount: String(allocation),
        });
        remaining = Math.round((remaining - allocation) * 100) / 100;
      }
    });

    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    revalidatePath(`/dashboard/suppliers/${supplierId}/ledger`);
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
 * Voids a supplier payment: never deletes or edits the original. Mirrors
 * voidCustomerPayment exactly.
 */
export async function voidSupplierPayment(input: {
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

  const db = getDb();
  let supplierId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(supplierPayments).where(eq(supplierPayments.id, paymentId));
      if (!payment) {
        throw new Error("Payment not found.");
      }
      if (payment.voidedAt != null) {
        throw new Error("This payment has already been voided.");
      }
      supplierId = payment.supplierId;

      const allocations = await tx
        .select()
        .from(supplierPaymentAllocations)
        .where(eq(supplierPaymentAllocations.paymentId, paymentId));

      await tx.insert(supplierLedgerTransactions).values({
        supplierId: payment.supplierId,
        type: "payment_void",
        direction: "debit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(suppliers)
        .set({ balance: sql`${suppliers.balance} + ${payment.amount}`, updatedAt: new Date() })
        .where(eq(suppliers.id, payment.supplierId));

      await tx
        .update(supplierPayments)
        .set({
          voidedAt: new Date(),
          voidedByUid: session.uid,
          voidedByEmail: session.email,
          voidReason: reason,
        })
        .where(eq(supplierPayments.id, paymentId));

      for (const allocation of allocations) {
        await tx
          .update(purchases)
          .set({ amountPaid: sql`${purchases.amountPaid} - ${allocation.amount}`, updatedAt: new Date() })
          .where(eq(purchases.id, allocation.purchaseId));
      }
    });

    if (supplierId) {
      revalidatePath(`/dashboard/suppliers/${supplierId}`);
      revalidatePath(`/dashboard/suppliers/${supplierId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void payment.",
    };
  }
}

const deleteSupplierSchema = z.object({
  supplierId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes a supplier AND their entire financial trail —
 * mirrors deleteCustomer in customers/actions.ts exactly, including the
 * same DELIBERATE, EXPLICIT exception to "never hard-delete a finalized
 * financial record": Owner-only, requires confirmation, cascades via the
 * ON DELETE CASCADE foreign keys on purchases/purchase line items/
 * payments/payment allocations/supplier ledger transactions.
 */
export async function deleteSupplier(input: { supplierId: string; reason?: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a supplier." };
  }

  const parsed = deleteSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { supplierId, reason } = parsed.data;

  const db = getDb();

  try {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
    if (!supplier) {
      return { ok: false, error: "Supplier not found." };
    }

    // Counted before the cascade below removes them, for an accurate
    // activity-log record of what this purge actually did.
    const [purchaseRows, paymentRows, ledgerRows] = await Promise.all([
      db.select().from(purchases).where(eq(purchases.supplierId, supplierId)),
      db.select().from(supplierPayments).where(eq(supplierPayments.supplierId, supplierId)),
      db.select().from(supplierLedgerTransactions).where(eq(supplierLedgerTransactions.supplierId, supplierId)),
    ]);

    await db.delete(suppliers).where(eq(suppliers.id, supplierId));

    await logActivity({
      action: "supplier_deleted",
      targetType: "supplier",
      targetId: supplierId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: {
        supplierName: supplier.name,
        reason: reason ?? null,
        purgedCounts: {
          purchases: purchaseRows.length,
          payments: paymentRows.length,
          ledgerTransactions: ledgerRows.length,
        },
      },
    });

    revalidatePath("/dashboard/suppliers");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete supplier.",
    };
  }
}
