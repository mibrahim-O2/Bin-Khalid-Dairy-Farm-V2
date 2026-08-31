"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";

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

  const db = getAdminDb();
  const supplierRef = db.collection("suppliers").doc(supplierId);
  const ledgerRef = db.collection("supplierLedgerTransactions").doc();

  try {
    await db.runTransaction(async (tx) => {
      const supplierSnap = await tx.get(supplierRef);
      if (!supplierSnap.exists) {
        throw new Error("Supplier not found.");
      }
      if (supplierSnap.data()?.hasOpeningBalance) {
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

      tx.update(supplierRef, {
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
  supplierId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Records a Jama (payment to a supplier): a real ledger credit,
 * FIFO-allocated across the supplier's outstanding finalized purchases
 * (oldest first). Mirrors recordCustomerPayment exactly.
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

  const db = getAdminDb();
  const supplierRef = db.collection("suppliers").doc(supplierId);
  const paymentRef = db.collection("supplierPayments").doc();

  try {
    await db.runTransaction(async (tx) => {
      const supplierSnap = await tx.get(supplierRef);
      if (!supplierSnap.exists) {
        throw new Error("Supplier not found.");
      }

      const outstandingPurchasesSnap = await tx.get(
        db
          .collection("purchases")
          .where("supplierId", "==", supplierId)
          .where("status", "==", "finalized")
          .orderBy("finalizedAt", "asc")
      );

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

      tx.set(db.collection("supplierLedgerTransactions").doc(), {
        supplierId,
        type: "payment",
        direction: "credit",
        amount,
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: paymentRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(supplierRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: now,
      });

      let remaining = amount;
      for (const purchaseDoc of outstandingPurchasesSnap.docs) {
        if (remaining <= 0) break;
        const purchase = purchaseDoc.data() as { subtotal: number; amountPaid?: number };
        const amountPaidSoFar = purchase.amountPaid ?? 0;
        const due = Math.round((purchase.subtotal - amountPaidSoFar) * 100) / 100;
        if (!Number.isFinite(due) || due <= 0) continue;

        const allocation = Math.min(remaining, due);
        tx.update(purchaseDoc.ref, {
          amountPaid: FieldValue.increment(allocation),
          updatedAt: now,
        });
        tx.set(db.collection("supplierPaymentAllocations").doc(), {
          paymentId: paymentRef.id,
          purchaseId: purchaseDoc.id,
          supplierId,
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

  const db = getAdminDb();
  const paymentRef = db.collection("supplierPayments").doc(paymentId);

  try {
    await db.runTransaction(async (tx) => {
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
        db.collection("supplierPaymentAllocations").where("paymentId", "==", paymentId)
      );

      const now = new Date().toISOString();
      const supplierRef = db.collection("suppliers").doc(payment.supplierId);

      tx.set(db.collection("supplierLedgerTransactions").doc(), {
        supplierId: payment.supplierId,
        type: "payment_void",
        direction: "debit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(supplierRef, {
        balance: FieldValue.increment(payment.amount),
        updatedAt: now,
      });

      for (const allocationDoc of allocationsSnap.docs) {
        const allocation = allocationDoc.data() as { purchaseId: string; amount: number };
        tx.update(db.collection("purchases").doc(allocation.purchaseId), {
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
