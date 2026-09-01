"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { and, asc, eq, sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { purchases, suppliers as suppliersTable } from "@/lib/db/schema";

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
 *
 * Suppliers moved to Postgres in M6, so a supplier created since then has
 * no Firestore `suppliers` doc at all — existence is checked there
 * instead, and the Firestore-side write uses `set(..., {merge: true})`
 * rather than `update()` so it can create that doc on first use instead of
 * throwing. This is a necessary fix, not a bridge: without it, opening
 * balance/payments would be completely broken (not just stale) for every
 * supplier created after M6, until this file migrates fully in M8.
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

  const [supplierRow] = await getDb().select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));
  if (!supplierRow) {
    return { ok: false, error: "Supplier not found." };
  }

  const db = getAdminDb();
  const supplierRef = db.collection("suppliers").doc(supplierId);
  const ledgerRef = db.collection("supplierLedgerTransactions").doc();

  try {
    await db.runTransaction(async (tx) => {
      const supplierSnap = await tx.get(supplierRef);
      if (supplierSnap.exists && supplierSnap.data()?.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this supplier.");
      }

      const delta = direction === "debit" ? amount : -amount;
      const now = new Date().toISOString();

      tx.set(ledgerRef, {
        supplierId,
        type: "opening_balance",
        direction,
        amount,
        note,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.set(
        supplierRef,
        {
          balance: FieldValue.increment(delta),
          hasOpeningBalance: true,
          updatedAt: now,
        },
        { merge: true }
      );
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
  supplierId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Records a Jama (payment to a supplier): a real ledger credit,
 * FIFO-allocated across the supplier's outstanding finalized purchases
 * (oldest first). Mirrors recordCustomerPayment's shape from before M4 —
 * payment/ledger/balance are still Firestore (this file migrates fully in
 * M8) — but purchases themselves moved to Postgres in M7, so the FIFO
 * lookup and each purchase's `amountPaid` update happen there now, in
 * their own Postgres pass. This isn't a sync bridge (there's nothing to
 * keep consistent both ways): purchases simply live in Postgres now, so
 * this is where the code has to look to find what's actually outstanding
 * — the alternative is payments silently never marking any purchase paid.
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

  // Suppliers moved to Postgres in M6 — see setSupplierOpeningBalance's doc
  // comment for why existence is checked there instead of Firestore.
  const [supplierRow] = await getDb().select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));
  if (!supplierRow) {
    return { ok: false, error: "Supplier not found." };
  }

  const fsDb = getAdminDb();
  const supplierRef = fsDb.collection("suppliers").doc(supplierId);
  const paymentRef = fsDb.collection("supplierPayments").doc();

  try {
    await fsDb.runTransaction(async (tx) => {
      const now = new Date().toISOString();

      tx.set(paymentRef, {
        supplierId,
        amount,
        method: method ?? null,
        note: note ?? null,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });

      tx.set(fsDb.collection("supplierLedgerTransactions").doc(), {
        supplierId,
        type: "payment",
        direction: "credit",
        amount,
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: paymentRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.set(
        supplierRef,
        { balance: FieldValue.increment(-amount), updatedAt: now },
        { merge: true }
      );
    });

    // FIFO-allocate against Postgres purchases (see the function doc
    // comment). Separate from the Firestore transaction above — Postgres
    // and Firestore can't share one atomic transaction — but the
    // Firestore side (payment + ledger + balance) is what's financially
    // binding; this just marks which purchases that payment covers.
    const pgDb = getDb();
    let remaining = amount;
    const outstandingPurchases = await pgDb
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
      await pgDb
        .update(purchases)
        .set({ amountPaid: sql`${purchases.amountPaid} + ${allocation}`, updatedAt: new Date() })
        .where(eq(purchases.id, purchase.id));
      await fsDb.collection("supplierPaymentAllocations").add({
        paymentId: paymentRef.id,
        purchaseId: purchase.id,
        supplierId,
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

  const fsDb = getAdminDb();
  const paymentRef = fsDb.collection("supplierPayments").doc(paymentId);

  try {
    const { allocations } = await fsDb.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) {
        throw new Error("Payment not found.");
      }
      const payment = paymentSnap.data() as {
        supplierId: string;
        amount: number;
        voidedAt: string | null;
      };
      if (payment.voidedAt != null) {
        throw new Error("This payment has already been voided.");
      }

      const allocationsSnap = await tx.get(
        fsDb.collection("supplierPaymentAllocations").where("paymentId", "==", paymentId)
      );
      const allocations = allocationsSnap.docs.map(
        (d) => d.data() as { purchaseId: string; amount: number }
      );

      const now = new Date().toISOString();
      const supplierRef = fsDb.collection("suppliers").doc(payment.supplierId);

      tx.set(fsDb.collection("supplierLedgerTransactions").doc(), {
        supplierId: payment.supplierId,
        type: "payment_void",
        direction: "debit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.set(
        supplierRef,
        { balance: FieldValue.increment(payment.amount), updatedAt: now },
        { merge: true }
      );

      tx.update(paymentRef, {
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
      });

      return { allocations };
    });

    // Reverse this payment's own allocations against Postgres purchases —
    // see recordSupplierPayment's comment on why purchases specifically
    // live there.
    const pgDb = getDb();
    for (const allocation of allocations) {
      await pgDb
        .update(purchases)
        .set({ amountPaid: sql`${purchases.amountPaid} - ${allocation.amount}`, updatedAt: new Date() })
        .where(eq(purchases.id, allocation.purchaseId));
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void payment.",
    };
  }
}
