"use server";

// Purchases, fully on Postgres (M7) — mirrors bills/actions.ts, minus a
// sequential number (Phase 6 never called for a purchase-order numbering
// scheme the way bills need BK-YYYY-NNNN) and with the simpler
// Quantity × Rate line item shape from src/lib/purchasing.ts (no
// milk-style daily/extra/less calculation on the supplier side).
//
// The supplier's opening balance / payments / ledger still live in
// src/app/dashboard/suppliers/actions.ts on Firestore until M8 — same
// accepted interim gap as bills had before M4 migrated customer payments.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { purchaseLineItems, purchases, suppliers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { calculateLineTotal, calculateSubtotal } from "@/lib/purchasing";

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
  purchaseDate: z.string().min(1),
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

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "draft") throw new Error("Only a draft purchase can be edited.");

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
    revalidatePath(`/dashboard/suppliers/${input.purchaseId}`);
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

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "draft") throw new Error("Only a draft purchase can be finalized.");

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

      // Note: this ledger entry stays out of scope for M7 — Domain B's
      // ledger (supplierLedgerTransactions) is still Firestore until M8,
      // same accepted interim gap as bills had before M4. Only the
      // purchase itself and the supplier's Postgres balance are updated
      // here; the Firestore-side ledger/balance sees this purchase once
      // M8 migrates it.
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
    revalidatePath(`/dashboard/suppliers/${purchaseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to finalize purchase." };
  }
}

const voidSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().min(1).max(500),
  createReplacement: z.boolean().optional(),
});

/**
 * Voids a finalized purchase: never deletes or edits its recorded amounts.
 * Updates the cached balance and optionally creates a linked replacement
 * draft, atomically. Mirrors voidBill.
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

  let replacementPurchaseId: string | undefined;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase) throw new Error("Purchase not found.");
      if (purchase.status !== "finalized") throw new Error("Only a finalized purchase can be voided.");

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
          replacesPurchaseId: purchaseId,
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

      await tx
        .update(purchases)
        .set({
          status: "void",
          voidedAt: now,
          voidedByUid: session.uid,
          voidedByEmail: session.email,
          voidReason: reason,
          replacedByPurchaseId: replacementPurchaseId ?? null,
          updatedAt: now,
        })
        .where(eq(purchases.id, purchaseId));
    });
    revalidatePath(`/dashboard/suppliers/${input.purchaseId}`);
    return { ok: true, replacementPurchaseId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to void purchase." };
  }
}
