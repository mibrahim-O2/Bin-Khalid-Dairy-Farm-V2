"use server";

// Milk Record module — tracks customer milk pause/resume periods and
// extra-milk dates. Purely informational: deliberately never touches
// billing, ledger, or balance data directly. Adding records is available
// to any active admin (same trust level as other non-financial master
// data); deleting a record is Owner-only, matching this app's convention
// that destructive/irreversible actions on historical records need the
// extra gate even when the record itself is non-financial.

import { z } from "zod";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { customerExtraMilk, customerMilkPauses, customers } from "@/lib/db/schema";
import { toNumber } from "@/lib/money";
import { calculateDaysMissed, calculateMilkMissed } from "@/lib/milk-record";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

const recordPauseSchema = z.object({
  customerId: z.string().min(1),
  pauseDate: isoDateSchema,
  // Set only when the customer reduced their quantity instead of fully
  // stopping — see calculateMilkMissed's doc comment.
  reducedDailyQty: z.number().min(0).optional(),
});

export async function recordMilkPause(input: z.infer<typeof recordPauseSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordPauseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid pause date." };
  }
  const { customerId, pauseDate, reducedDailyQty } = parsed.data;

  try {
    const db = getDb();

    // Don't allow a second open pause on top of one that's still ongoing —
    // resume the existing one first.
    const [existingOpenPause] = await db
      .select({ id: customerMilkPauses.id })
      .from(customerMilkPauses)
      .where(and(eq(customerMilkPauses.customerId, customerId), isNull(customerMilkPauses.resumeDate)));
    if (existingOpenPause) {
      return { ok: false, error: "This customer already has an open pause — fill in its resume date first." };
    }

    const [customer] = await db.select({ dailyMilkQty: customers.dailyMilkQty }).from(customers).where(eq(customers.id, customerId));
    if (reducedDailyQty !== undefined && customer?.dailyMilkQty !== null && customer?.dailyMilkQty !== undefined && reducedDailyQty >= toNumber(customer.dailyMilkQty)) {
      return { ok: false, error: "The reduced quantity must be less than the customer's standard daily quantity." };
    }

    await db.insert(customerMilkPauses).values({
      customerId,
      pauseDate,
      dailyMilkQtyAtPause: customer?.dailyMilkQty ?? null,
      reducedDailyQty: reducedDailyQty !== undefined ? String(reducedDailyQty) : null,
      createdByUid: session.uid,
    });
    revalidatePath("/dashboard/milk-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const recordResumeSchema = z.object({
  pauseId: z.string().min(1),
  resumeDate: isoDateSchema,
});

export async function recordMilkResume(input: z.infer<typeof recordResumeSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordResumeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid resume date." };
  }
  const { pauseId, resumeDate } = parsed.data;

  try {
    const db = getDb();
    const [pause] = await db
      .select({ pauseDate: customerMilkPauses.pauseDate })
      .from(customerMilkPauses)
      .where(eq(customerMilkPauses.id, pauseId));
    if (!pause) {
      return { ok: false, error: "Pause record not found." };
    }
    if (resumeDate < pause.pauseDate) {
      return { ok: false, error: "Resume date can't be before the pause date." };
    }

    await db
      .update(customerMilkPauses)
      .set({ resumeDate, updatedAt: new Date() })
      .where(eq(customerMilkPauses.id, pauseId));
    revalidatePath("/dashboard/milk-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const deletePauseSchema = z.object({
  pauseId: z.string().min(1),
});

/** Owner-only — same gating principle as the other delete actions this
 *  session (customers/suppliers/employees full-purge). */
export async function deleteMilkPause(input: z.infer<typeof deletePauseSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a pause record." };
  }

  const parsed = deletePauseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(customerMilkPauses).where(eq(customerMilkPauses.id, parsed.data.pauseId));
    revalidatePath("/dashboard/milk-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}

const recordExtraMilkSchema = z.object({
  customerId: z.string().min(1),
  date: isoDateSchema,
  quantity: z.number().gt(0),
  note: z.string().trim().max(500).optional(),
});

export async function recordExtraMilk(input: z.infer<typeof recordExtraMilkSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordExtraMilkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid date and a positive quantity." };
  }
  const { customerId, date, quantity, note } = parsed.data;

  try {
    await getDb()
      .insert(customerExtraMilk)
      .values({ customerId, date, quantity: String(quantity), note: note || null, createdByUid: session.uid });
    revalidatePath("/dashboard/milk-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const deleteExtraMilkSchema = z.object({
  extraMilkId: z.string().min(1),
});

/** Owner-only — same gating as deleteMilkPause. */
export async function deleteExtraMilk(input: z.infer<typeof deleteExtraMilkSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete an extra milk record." };
  }

  const parsed = deleteExtraMilkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(customerExtraMilk).where(eq(customerExtraMilk.id, parsed.data.extraMilkId));
    revalidatePath("/dashboard/milk-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}

const autoFillSchema = z.object({
  customerId: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

/**
 * Smart defaults for a new bill's Milk line item, given the customer and
 * the bill's own [startDate, endDate] period — called from the bill
 * editor when a Milk line is added. Every value returned is just a
 * starting point; the admin can freely edit any of them per-bill.
 *
 * - dailyQty: the customer's current standard daily quantity.
 * - extra: sum of customerExtraMilk entries whose date falls inside the
 *   bill's period.
 * - less (Milk Deducted): sum of calculateMilkMissed() for every
 *   RESOLVED pause (has a resumeDate) whose pauseDate falls inside the
 *   bill's period — a pause is attributed to the bill covering the
 *   period it STARTED in, so a pause spanning a period boundary is never
 *   double-counted across two bills. An open (unresolved) pause
 *   contributes nothing yet, since its milk-missed total isn't known
 *   until it's resumed.
 */
export async function getMilkAutoFillDefaults(
  input: z.infer<typeof autoFillSchema>
): Promise<{ ok: true; dailyQty: number; extra: number; less: number } | { ok: false; error: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = autoFillSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, startDate, endDate } = parsed.data;

  const db = getDb();

  const [customer] = await db.select({ dailyMilkQty: customers.dailyMilkQty }).from(customers).where(eq(customers.id, customerId));
  const dailyQty = customer?.dailyMilkQty !== null && customer?.dailyMilkQty !== undefined ? toNumber(customer.dailyMilkQty) : 0;

  const extraRows = await db
    .select({ quantity: customerExtraMilk.quantity })
    .from(customerExtraMilk)
    .where(
      and(eq(customerExtraMilk.customerId, customerId), gte(customerExtraMilk.date, startDate), lte(customerExtraMilk.date, endDate))
    );
  const extra = Math.round(extraRows.reduce((sum, r) => sum + toNumber(r.quantity), 0) * 100) / 100;

  const pauseRows = await db
    .select({
      pauseDate: customerMilkPauses.pauseDate,
      resumeDate: customerMilkPauses.resumeDate,
      dailyMilkQtyAtPause: customerMilkPauses.dailyMilkQtyAtPause,
      reducedDailyQty: customerMilkPauses.reducedDailyQty,
    })
    .from(customerMilkPauses)
    .where(
      and(
        eq(customerMilkPauses.customerId, customerId),
        gte(customerMilkPauses.pauseDate, startDate),
        lte(customerMilkPauses.pauseDate, endDate)
      )
    );
  const resolvedPauses = pauseRows.filter((p) => p.resumeDate !== null);
  const less =
    Math.round(
      resolvedPauses.reduce((sum, p) => {
        const daysMissed = calculateDaysMissed(p.pauseDate, p.resumeDate as string);
        const dailyAtPause = p.dailyMilkQtyAtPause !== null ? toNumber(p.dailyMilkQtyAtPause) : null;
        const reduced = p.reducedDailyQty !== null ? toNumber(p.reducedDailyQty) : null;
        return sum + calculateMilkMissed(dailyAtPause, reduced, daysMissed);
      }, 0) * 100
    ) / 100;

  return { ok: true, dailyQty, extra, less };
}
