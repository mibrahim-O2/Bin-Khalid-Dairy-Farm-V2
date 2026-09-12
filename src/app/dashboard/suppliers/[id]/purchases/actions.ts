"use server";

// Purchases, fully on Postgres (M7) — mirrors bills/actions.ts, minus a
// sequential number (Phase 6 never called for a purchase-order numbering
// scheme the way bills need BK-YYYY-NNNN) and with the simpler
// Quantity × Rate line item shape from src/lib/purchasing.ts (no
// milk-style daily/extra/less calculation on the supplier side).
//
// finalizePurchase/deletePurchase also write/reverse the
// supplier_ledger_transactions row directly (added in M8, once that table
// itself moved to Postgres) — mirrors finalizeBill/deleteBill exactly.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { purchaseLineItems, purchases, supplierLedgerTransactions, suppliers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { logActivity } from "@/lib/db/activity-log";
import { calculateLineTotal, calculateSubtotal } from "@/lib/purchasing";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Creates an empty draft purchase and returns its id. Shared by the
 *  Purchases list and the Ledger page — both offer a "New purchase" entry
 *  point, so this lives in one place rather than being duplicated. */
export async function createDraftPurchase(
  supplierId: string
): Promise<ActionResult & { purchaseId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!supplierId) {
    return { ok: false, error: "Invalid input." };
  }

  const id = randomUUID();
  try {
    await getDb()
      .insert(purchases)
      .values({
        id,
        supplierId,
        status: "draft",
        purchaseDate: todayIso(),
        subtotal: "0",
        amountPaid: "0",
        createdByUid: session.uid,
      });
    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { ok: true, purchaseId: id };
  } catch {
    return { ok: false, error: "Failed to create draft purchase." };
  }
}

const lineItemSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  unit: z.string().min(1),
  rate: z.number().min(0),
  quantity: z.number().min(0),
});

const updateDraftSchema = z.object({
  purchaseId: z.string().min(1),
  purchaseDate: isoDateSchema,
  lineItems: z.array(lineItemSchema),
  note: z.string().max(2000).optional(),
});

/** Saves a draft's editable fields. Line items are replaced wholesale
 *  (delete + reinsert) rather than diffed, same model bills/actions.ts uses. */
export async function updateDraftPurchase(input: z.infer<typeof updateDraftSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { purchaseId, purchaseDate, lineItems, note } = parsed.data;

  let supplierId: string | undefined;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "draft") throw new Error("Only a draft purchase can be edited.");
      supplierId = purchase.supplierId;

      const computed = lineItems.map((line) => ({ ...line, lineTotal: calculateLineTotal(line) }));
      const subtotal = calculateSubtotal(computed.map((line) => line.lineTotal));

      await tx
        .update(purchases)
        .set({
          purchaseDate,
          subtotal: String(subtotal),
          note: note?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(purchases.id, purchaseId));

      await tx.delete(purchaseLineItems).where(eq(purchaseLineItems.purchaseId, purchaseId));
      if (computed.length > 0) {
        await tx.insert(purchaseLineItems).values(
          computed.map((line, index) => ({
            purchaseId,
            itemId: line.itemId,
            itemName: line.itemName,
            unit: line.unit,
            rate: String(line.rate),
            quantity: String(line.quantity),
            lineTotal: String(line.lineTotal),
            sortOrder: index,
          }))
        );
      }
    });
    if (supplierId) revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

const finalizeSchema = z.object({ purchaseId: z.string().min(1) });

/**
 * Finalizes a draft purchase: recomputes every total from the raw
 * line-item inputs (never trusting whatever the client last saved),
 * creates exactly one ledger debit, and updates the supplier's cached
 * balance — all inside one Postgres transaction. Mirrors finalizeBill,
 * minus a sequential number.
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

  let supplierId: string | undefined;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "draft") throw new Error("Only a draft purchase can be finalized.");
      supplierId = purchase.supplierId;

      const lineRows = await tx
        .select()
        .from(purchaseLineItems)
        .where(eq(purchaseLineItems.purchaseId, purchaseId))
        .orderBy(asc(purchaseLineItems.sortOrder));
      if (lineRows.length === 0) throw new Error("Add at least one line item before finalizing.");

      const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, purchase.supplierId));
      if (!supplier) throw new Error("Supplier not found.");

      const computed = lineRows.map((line) => ({
        row: line,
        lineTotal: calculateLineTotal({ rate: Number(line.rate), quantity: Number(line.quantity) }),
      }));
      const subtotal = calculateSubtotal(computed.map((c) => c.lineTotal));
      const previousBalance = Number(supplier.balance);
      const totalPayable = Math.round((subtotal + previousBalance) * 100) / 100;

      const now = new Date();

      for (const c of computed) {
        await tx
          .update(purchaseLineItems)
          .set({ lineTotal: String(c.lineTotal) })
          .where(eq(purchaseLineItems.id, c.row.id));
      }

      await tx.insert(supplierLedgerTransactions).values({
        supplierId: purchase.supplierId,
        type: "purchase",
        direction: "debit",
        amount: String(subtotal),
        note: "Purchase",
        purchaseId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(suppliers)
        .set({ balance: sql`${suppliers.balance} + ${subtotal}`, updatedAt: now })
        .where(eq(suppliers.id, purchase.supplierId));

      await tx
        .update(purchases)
        .set({
          status: "finalized",
          subtotal: String(subtotal),
          previousBalance: String(previousBalance),
          totalPayable: String(totalPayable),
          finalizedAt: now,
          finalizedByUid: session.uid,
          finalizedByEmail: session.email,
          updatedAt: now,
        })
        .where(eq(purchases.id, purchaseId));
    });
    if (supplierId) {
      revalidatePath(`/dashboard/suppliers/${supplierId}`);
      revalidatePath(`/dashboard/suppliers/${supplierId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to finalize purchase." };
  }
}

const updateFinalizedSchema = z.object({
  purchaseId: z.string().min(1),
  purchaseDate: isoDateSchema,
  lineItems: z.array(lineItemSchema),
  note: z.string().max(2000).optional(),
});

/**
 * Owner-only correction of an already-finalized purchase (the ledger's
 * Edit action) — this app otherwise treats a finalized record as
 * immutable, but the Owner needs a way to fix a genuine mistake without
 * deleting and re-entering it from scratch. Recomputes the subtotal from
 * the new line items and applies only the DELTA (new − old) to the
 * supplier's cached balance, and updates the matching "purchase" ledger
 * row's own amount to match — the ledger view's running balance is
 * derived from that ledger row, not from purchases.subtotal, so both
 * must move together or the two would silently disagree.
 */
export async function updateFinalizedPurchase(input: z.infer<typeof updateFinalizedSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can edit a finalized purchase." };
  }

  const parsed = updateFinalizedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { purchaseId, purchaseDate, lineItems, note } = parsed.data;
  if (lineItems.length === 0) {
    return { ok: false, error: "A purchase must have at least one line item." };
  }

  let supplierId: string | undefined;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "finalized") throw new Error("Only a finalized purchase can be edited this way.");
      supplierId = purchase.supplierId;

      const computed = lineItems.map((line) => ({ ...line, lineTotal: calculateLineTotal(line) }));
      const newSubtotal = calculateSubtotal(computed.map((line) => line.lineTotal));
      const oldSubtotal = Number(purchase.subtotal);
      const delta = Math.round((newSubtotal - oldSubtotal) * 100) / 100;
      const now = new Date();

      await tx.delete(purchaseLineItems).where(eq(purchaseLineItems.purchaseId, purchaseId));
      await tx.insert(purchaseLineItems).values(
        computed.map((line, index) => ({
          purchaseId,
          itemId: line.itemId,
          itemName: line.itemName,
          unit: line.unit,
          rate: String(line.rate),
          quantity: String(line.quantity),
          lineTotal: String(line.lineTotal),
          sortOrder: index,
        }))
      );

      const previousBalance = purchase.previousBalance !== null ? Number(purchase.previousBalance) : 0;
      await tx
        .update(purchases)
        .set({
          purchaseDate,
          subtotal: String(newSubtotal),
          totalPayable: String(Math.round((previousBalance + newSubtotal) * 100) / 100),
          note: note?.trim() || null,
          updatedAt: now,
        })
        .where(eq(purchases.id, purchaseId));

      await tx
        .update(supplierLedgerTransactions)
        .set({ amount: String(newSubtotal) })
        .where(and(eq(supplierLedgerTransactions.purchaseId, purchaseId), eq(supplierLedgerTransactions.type, "purchase")));

      await tx
        .update(suppliers)
        .set({ balance: sql`${suppliers.balance} + ${delta}`, updatedAt: now })
        .where(eq(suppliers.id, purchase.supplierId));
    });
    if (supplierId) {
      revalidatePath(`/dashboard/suppliers/${supplierId}`);
      revalidatePath(`/dashboard/suppliers/${supplierId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save changes." };
  }
}

const deleteSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().max(500).optional(),
  createReplacement: z.boolean().optional(),
});

/**
 * Permanently deletes a finalized purchase — a deliberate departure from
 * this app's usual "never hard-delete a financial record" rule (see
 * voidBill's history in git log for the superseded reversing-entry
 * approach). In practice this action was almost always used to correct a
 * plain data-entry mistake, where keeping a permanent "voided" trace
 * served no purpose and just cluttered the ledger/statements.
 *
 * Reverses the supplier's cached balance by the purchase's own subtotal
 * (identical math to the old void), then deletes the row — its line
 * items, supplier_ledger_transactions row, and any
 * supplier_payment_allocations rows all cascade away via their FK
 * (ON DELETE CASCADE), so nothing else needs to be cleaned up by hand.
 * Owner-only: matches the ledger's Edit/Delete gating (#2), a tightening
 * from the old void's any-active-admin gate, since an unrecoverable
 * delete is a materially bigger blast radius than a reversible void was.
 */
export async function deletePurchase(input: {
  purchaseId: string;
  reason?: string;
  createReplacement?: boolean;
}): Promise<ActionResult & { replacementPurchaseId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a purchase." };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { purchaseId, reason, createReplacement } = parsed.data;

  let replacementPurchaseId: string | undefined;
  let supplierId: string | undefined;
  let subtotalForLog = 0;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "finalized") throw new Error("Only a finalized purchase can be deleted.");
      supplierId = purchase.supplierId;
      subtotalForLog = Number(purchase.subtotal);

      const now = new Date();
      const subtotal = Number(purchase.subtotal);

      await tx
        .update(suppliers)
        .set({ balance: sql`${suppliers.balance} - ${subtotal}`, updatedAt: now })
        .where(eq(suppliers.id, purchase.supplierId));

      if (createReplacement) {
        const lineRows = await tx
          .select()
          .from(purchaseLineItems)
          .where(eq(purchaseLineItems.purchaseId, purchaseId))
          .orderBy(asc(purchaseLineItems.sortOrder));

        replacementPurchaseId = randomUUID();
        await tx.insert(purchases).values({
          id: replacementPurchaseId,
          supplierId: purchase.supplierId,
          status: "draft",
          purchaseDate: purchase.purchaseDate,
          subtotal: purchase.subtotal,
          amountPaid: "0",
          note: purchase.note,
          createdByUid: session.uid,
        });
        if (lineRows.length > 0) {
          await tx.insert(purchaseLineItems).values(
            lineRows.map((line) => ({
              purchaseId: replacementPurchaseId!,
              itemId: line.itemId,
              itemName: line.itemName,
              unit: line.unit,
              rate: line.rate,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              sortOrder: line.sortOrder,
            }))
          );
        }
      }

      // Cascades: purchase_line_items, supplier_ledger_transactions,
      // supplier_payment_allocations.
      await tx.delete(purchases).where(eq(purchases.id, purchaseId));
    });
    await logActivity({
      action: "purchase_deleted",
      targetType: "purchase",
      targetId: purchaseId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { supplierId, subtotal: subtotalForLog, reason: reason ?? null, replacementPurchaseId: replacementPurchaseId ?? null },
    });
    if (supplierId) {
      revalidatePath(`/dashboard/suppliers/${supplierId}`);
      revalidatePath(`/dashboard/suppliers/${supplierId}/ledger`);
    }
    return { ok: true, replacementPurchaseId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete purchase." };
  }
}
