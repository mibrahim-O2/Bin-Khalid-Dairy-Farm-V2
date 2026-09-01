"use server";

// Bills, fully on Postgres (M3) — no Firestore involvement anywhere in this
// file. Draft creation/editing is now a Server Action too (every write,
// financial or not, goes through one now — see src/lib/db/README.md),
// where the Firestore-era version let the client `addDoc`/`updateDoc`
// drafts directly.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { billLineItems, bills, counters, customerLedgerTransactions, customers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { calculateDays, calculateLineTotals, calculateSubtotal } from "@/lib/billing";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Creates an empty draft bill and returns its id. */
export async function createDraftBill(customerId: string): Promise<ActionResult & { billId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!customerId) {
    return { ok: false, error: "Invalid input." };
  }

  const id = randomUUID();
  try {
    await getDb()
      .insert(bills)
      .values({
        id,
        customerId,
        status: "draft",
        startDate: firstOfMonthIso(),
        endDate: todayIso(),
        days: 0,
        subtotal: "0",
        amountPaid: "0",
        createdByUid: session.uid,
      });
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true, billId: id };
  } catch {
    return { ok: false, error: "Failed to create draft bill." };
  }
}

const lineItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unit: z.string().min(1),
  billingType: z.enum(["milk", "simple"]),
  rate: z.number().min(0),
  dailyQty: z.number().optional(),
  extra: z.number().optional(),
  less: z.number().optional(),
  quantity: z.number().optional(),
});

const updateDraftSchema = z.object({
  billId: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  lineItems: z.array(lineItemSchema),
  note: z.string().max(2000).optional(),
});

/** Saves a draft's editable fields — the Postgres equivalent of the
 *  Firestore-era client-side `updateDoc`. Line items are replaced wholesale
 *  (delete + reinsert) rather than diffed — the same "whole array" model
 *  the Firestore document had, just normalized into a child table now. */
export async function updateDraftBill(input: z.infer<typeof updateDraftSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { billId, startDate, endDate, lineItems, note } = parsed.data;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [bill] = await tx.select().from(bills).where(eq(bills.id, billId));
      if (!bill) throw new Error("Bill not found.");
      if (bill.status !== "draft") throw new Error("Only a draft bill can be edited.");

      const days = calculateDays(startDate, endDate);
      const computed = lineItems.map((line) => ({ ...line, ...calculateLineTotals(line, days) }));
      const subtotal = calculateSubtotal(computed.map((line) => line.lineTotal));

      await tx
        .update(bills)
        .set({
          startDate,
          endDate,
          days,
          subtotal: String(subtotal),
          note: note?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));

      await tx.delete(billLineItems).where(eq(billLineItems.billId, billId));
      if (computed.length > 0) {
        await tx.insert(billLineItems).values(
          computed.map((line, index) => ({
            billId,
            productId: line.productId,
            productName: line.productName,
            unit: line.unit,
            billingType: line.billingType,
            rate: String(line.rate),
            dailyQty: line.dailyQty === undefined ? null : String(line.dailyQty),
            extra: line.extra === undefined ? null : String(line.extra),
            less: line.less === undefined ? null : String(line.less),
            quantity: line.quantity === undefined ? null : String(line.quantity),
            totalQty: String(line.totalQty),
            lineTotal: String(line.lineTotal),
            sortOrder: index,
          }))
        );
      }
    });
    revalidatePath(`/dashboard/customers/${input.billId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

const finalizeSchema = z.object({ billId: z.string().min(1) });

/**
 * Finalizes a draft bill: assigns a sequential bill number via a
 * transactional counter, recomputes every total from the raw line-item
 * inputs (never trusting whatever was last saved — the draft is
 * user-editable right up to this moment), creates exactly one ledger
 * debit, and updates the customer's cached balance — all inside one
 * Postgres transaction. See SYSTEM_ARCHITECTURE.md §3, §5.
 */
export async function finalizeBill(input: { billId: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { billId } = parsed.data;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [bill] = await tx.select().from(bills).where(eq(bills.id, billId));
      if (!bill) throw new Error("Bill not found.");
      if (bill.status !== "draft") throw new Error("Only a draft bill can be finalized.");

      const lineRows = await tx
        .select()
        .from(billLineItems)
        .where(eq(billLineItems.billId, billId))
        .orderBy(asc(billLineItems.sortOrder));
      if (lineRows.length === 0) throw new Error("Add at least one line item before finalizing.");

      const [customer] = await tx.select().from(customers).where(eq(customers.id, bill.customerId));
      if (!customer) throw new Error("Customer not found.");

      const days = calculateDays(bill.startDate, bill.endDate);
      const computed = lineRows.map((line) => {
        const lineInput = {
          billingType: line.billingType,
          rate: Number(line.rate),
          dailyQty: line.dailyQty === null ? undefined : Number(line.dailyQty),
          extra: line.extra === null ? undefined : Number(line.extra),
          less: line.less === null ? undefined : Number(line.less),
          quantity: line.quantity === null ? undefined : Number(line.quantity),
        };
        return { row: line, ...calculateLineTotals(lineInput, days) };
      });
      const subtotal = calculateSubtotal(computed.map((c) => c.lineTotal));
      const previousBalance = Number(customer.balance);
      const totalPayable = Math.round((subtotal + previousBalance) * 100) / 100;

      // Atomic sequential bill number — the upsert's UPDATE serializes
      // concurrent finalizes on the same counter row via Postgres's own
      // row locking, no separate read-then-write race window like
      // Firestore's version needed a transaction to close.
      const year = new Date().getUTCFullYear();
      const counterId = `customer_bills_${year}`;
      const [counter] = await tx
        .insert(counters)
        .values({ id: counterId, lastNumber: 1 })
        .onConflictDoUpdate({
          target: counters.id,
          set: { lastNumber: sql`${counters.lastNumber} + 1`, updatedAt: new Date() },
        })
        .returning();
      const billNumber = `BK-${year}-${String(counter.lastNumber).padStart(4, "0")}`;

      const now = new Date();

      for (const c of computed) {
        await tx
          .update(billLineItems)
          .set({ totalQty: String(c.totalQty), lineTotal: String(c.lineTotal) })
          .where(eq(billLineItems.id, c.row.id));
      }

      await tx.insert(customerLedgerTransactions).values({
        customerId: bill.customerId,
        type: "bill",
        direction: "debit",
        amount: String(subtotal),
        note: `Bill ${billNumber}`,
        billId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} + ${subtotal}`, updatedAt: now })
        .where(eq(customers.id, bill.customerId));

      await tx
        .update(bills)
        .set({
          status: "finalized",
          billNumber,
          days,
          subtotal: String(subtotal),
          previousBalance: String(previousBalance),
          totalPayable: String(totalPayable),
          finalizedAt: now,
          finalizedByUid: session.uid,
          finalizedByEmail: session.email,
          updatedAt: now,
        })
        .where(eq(bills.id, billId));
    });
    revalidatePath(`/dashboard/customers/${billId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to finalize bill." };
  }
}

const voidSchema = z.object({
  billId: z.string().min(1),
  reason: z.string().min(1).max(500),
  createReplacement: z.boolean().optional(),
});

/**
 * Voids a finalized bill: never deletes it, never edits its recorded
 * amounts. Instead records a reversing ledger credit (the original debit
 * stays in history) and updates the cached balance, atomically. Optionally
 * creates a linked replacement draft in the same transaction — creating it
 * outside this transaction would race against another read of the
 * just-voided bill.
 */
export async function voidBill(input: {
  billId: string;
  reason: string;
  createReplacement?: boolean;
}): Promise<ActionResult & { replacementBillId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { billId, reason, createReplacement } = parsed.data;

  let replacementBillId: string | undefined;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [bill] = await tx.select().from(bills).where(eq(bills.id, billId));
      if (!bill) throw new Error("Bill not found.");
      if (bill.status !== "finalized") throw new Error("Only a finalized bill can be voided.");

      const now = new Date();
      const subtotal = Number(bill.subtotal);

      await tx.insert(customerLedgerTransactions).values({
        customerId: bill.customerId,
        type: "bill_void",
        direction: "credit",
        amount: String(subtotal),
        note: `Void of bill ${bill.billNumber}: ${reason}`,
        billId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} - ${subtotal}`, updatedAt: now })
        .where(eq(customers.id, bill.customerId));

      if (createReplacement) {
        const lineRows = await tx
          .select()
          .from(billLineItems)
          .where(eq(billLineItems.billId, billId))
          .orderBy(asc(billLineItems.sortOrder));

        replacementBillId = randomUUID();
        await tx.insert(bills).values({
          id: replacementBillId,
          customerId: bill.customerId,
          status: "draft",
          startDate: bill.startDate,
          endDate: bill.endDate,
          days: bill.days,
          subtotal: bill.subtotal,
          amountPaid: "0",
          note: bill.note,
          createdByUid: session.uid,
          replacesBillId: billId,
        });
        if (lineRows.length > 0) {
          await tx.insert(billLineItems).values(
            lineRows.map((line) => ({
              billId: replacementBillId!,
              productId: line.productId,
              productName: line.productName,
              unit: line.unit,
              billingType: line.billingType,
              rate: line.rate,
              dailyQty: line.dailyQty,
              extra: line.extra,
              less: line.less,
              quantity: line.quantity,
              totalQty: line.totalQty,
              lineTotal: line.lineTotal,
              sortOrder: line.sortOrder,
            }))
          );
        }
      }

      await tx
        .update(bills)
        .set({
          status: "void",
          voidedAt: now,
          voidedByUid: session.uid,
          voidedByEmail: session.email,
          voidReason: reason,
          replacedByBillId: replacementBillId ?? null,
          updatedAt: now,
        })
        .where(eq(bills.id, billId));
    });
    revalidatePath(`/dashboard/customers/${input.billId}`);
    return { ok: true, replacementBillId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to void bill." };
  }
}
