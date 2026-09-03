"use server";

// Milk Record module (Phase 10 follow-up) — tracks customer milk
// pause/resume periods. Purely informational: deliberately never touches
// billing, ledger, or balance data. Same trust level as other
// non-financial master data (Settings, products) — any active admin can
// use it, not Owner-only.

import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { bills, billLineItems, customerMilkPauses } from "@/lib/db/schema";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The customer's most recent finalized milk bill line item's daily
 * quantity — snapshotted onto a new pause record at creation time (see
 * schema/customers.ts's doc comment on customerMilkPauses). Null if the
 * customer has never had a finalized milk bill.
 */
async function getCurrentDailyMilkQty(customerId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ dailyQty: billLineItems.dailyQty })
    .from(billLineItems)
    .innerJoin(bills, eq(bills.id, billLineItems.billId))
    .where(
      and(
        eq(bills.customerId, customerId),
        eq(bills.status, "finalized"),
        eq(billLineItems.billingType, "milk")
      )
    )
    .orderBy(desc(bills.endDate), desc(bills.createdAt))
    .limit(1);
  return row?.dailyQty ?? null;
}

const recordPauseSchema = z.object({
  customerId: z.string().min(1),
  pauseDate: isoDateSchema,
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
  const { customerId, pauseDate } = parsed.data;

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

    const dailyMilkQtyAtPause = await getCurrentDailyMilkQty(customerId);

    await db.insert(customerMilkPauses).values({
      customerId,
      pauseDate,
      dailyMilkQtyAtPause,
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
