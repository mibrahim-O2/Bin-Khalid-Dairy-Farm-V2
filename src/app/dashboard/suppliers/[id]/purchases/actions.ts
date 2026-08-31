"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { calculateLineTotal, calculateSubtotal } from "@/lib/purchasing";

type ActionResult = { ok: true } | { ok: false; error: string };

const finalizeSchema = z.object({ purchaseId: z.string().min(1) });

/**
 * Finalizes a draft purchase: recomputes every total from the raw
 * line-item inputs (never trusting whatever the client last saved),
 * creates exactly one ledger debit, and updates the supplier's cached
 * balance — all inside one Admin SDK transaction. Mirrors finalizeBill,
 * minus a sequential number — Phase 6 doesn't call for a purchase-order
 * numbering scheme the way bills need BK-YYYY-NNNN.
 */
export async function finalizePurchase(input: { purchaseId: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { purchaseId } = parsed.data;

  const db = getAdminDb();
  const purchaseRef = db.collection("purchases").doc(purchaseId);

  try {
    await db.runTransaction(async (tx) => {
      const purchaseSnap = await tx.get(purchaseRef);
      if (!purchaseSnap.exists) throw new Error("Purchase not found.");
      const purchase = purchaseSnap.data() as {
        status: string;
        supplierId: string;
        lineItems: unknown[];
      };

      if (purchase.status !== "draft") {
        throw new Error("Only a draft purchase can be finalized.");
      }
      if (!Array.isArray(purchase.lineItems) || purchase.lineItems.length === 0) {
        throw new Error("Add at least one line item before finalizing.");
      }

      const supplierRef = db.collection("suppliers").doc(purchase.supplierId);
      const supplierSnap = await tx.get(supplierRef);
      if (!supplierSnap.exists) throw new Error("Supplier not found.");
      const supplier = supplierSnap.data() as { balance?: number };

      const now = new Date().toISOString();
      const lineItems = (purchase.lineItems as Array<{ rate: number; quantity: number }>).map(
        (line) => ({ ...line, lineTotal: calculateLineTotal(line) })
      );
      const subtotal = calculateSubtotal(lineItems.map((line) => line.lineTotal));
      const previousBalance = supplier.balance ?? 0;
      const totalPayable = Math.round((subtotal + previousBalance) * 100) / 100;

      tx.set(db.collection("supplierLedgerTransactions").doc(), {
        supplierId: purchase.supplierId,
        type: "purchase",
        direction: "debit",
        amount: subtotal,
        note: "Purchase",
        purchaseId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(supplierRef, {
        balance: FieldValue.increment(subtotal),
        updatedAt: now,
      });

      tx.update(purchaseRef, {
        status: "finalized",
        lineItems,
        subtotal,
        previousBalance,
        totalPayable,
        finalizedAt: now,
        finalizedBy: { uid: session.uid, email: session.email },
        updatedAt: now,
      });
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to finalize purchase.",
    };
  }
}

const voidSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().min(1).max(500),
  createReplacement: z.boolean().optional(),
});

/**
 * Voids a finalized purchase: never deletes or edits its recorded amounts.
 * Records a reversing ledger credit and updates the cached balance,
 * atomically; optionally creates a linked replacement draft in the same
 * transaction. Mirrors voidBill.
 */
export async function voidPurchase(input: {
  purchaseId: string;
  reason: string;
  createReplacement?: boolean;
}): Promise<ActionResult & { replacementPurchaseId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { purchaseId, reason, createReplacement } = parsed.data;

  const db = getAdminDb();
  const purchaseRef = db.collection("purchases").doc(purchaseId);
  const replacementRef = db.collection("purchases").doc();
  let replacementPurchaseId: string | undefined;

  try {
    await db.runTransaction(async (tx) => {
      const purchaseSnap = await tx.get(purchaseRef);
      if (!purchaseSnap.exists) throw new Error("Purchase not found.");
      const purchase = purchaseSnap.data() as {
        status: string;
        supplierId: string;
        subtotal: number;
        purchaseDate: string;
        lineItems: unknown[];
        note: string | null;
      };

      if (purchase.status !== "finalized") {
        throw new Error("Only a finalized purchase can be voided.");
      }

      const supplierRef = db.collection("suppliers").doc(purchase.supplierId);
      const now = new Date().toISOString();

      tx.set(db.collection("supplierLedgerTransactions").doc(), {
        supplierId: purchase.supplierId,
        type: "purchase_void",
        direction: "credit",
        amount: purchase.subtotal,
        note: `Void of purchase: ${reason}`,
        purchaseId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(supplierRef, {
        balance: FieldValue.increment(-purchase.subtotal),
        updatedAt: now,
      });

      const purchaseUpdate: Record<string, unknown> = {
        status: "void",
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
        updatedAt: now,
      };

      if (createReplacement) {
        replacementPurchaseId = replacementRef.id;
        purchaseUpdate.replacedByPurchaseId = replacementPurchaseId;

        tx.set(replacementRef, {
          supplierId: purchase.supplierId,
          status: "draft",
          purchaseDate: purchase.purchaseDate,
          lineItems: purchase.lineItems,
          subtotal: purchase.subtotal,
          previousBalance: null,
          totalPayable: null,
          amountPaid: 0,
          note: purchase.note ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: session.uid,
          finalizedAt: null,
          finalizedBy: null,
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          replacesPurchaseId: purchaseId,
          replacedByPurchaseId: null,
        });
      }

      tx.update(purchaseRef, purchaseUpdate);
    });
    return { ok: true, replacementPurchaseId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void purchase.",
    };
  }
}
