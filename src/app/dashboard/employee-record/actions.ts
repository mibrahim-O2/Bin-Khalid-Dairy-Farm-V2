"use server";

// Employee Record module — tracks employee leave periods. Recording/
// resuming/editing a leave is available to any active admin (same trust
// level as recording a salary accrual); deleting one is Owner-only,
// matching this app's convention that a permanent delete on a historical
// record needs the extra gate even when the record itself started out as
// non-financial. Mirrors the Milk Record module (src/app/dashboard/
// milk-record/actions.ts) almost exactly, including its auto-fill
// pattern — here feeding a salary accrual's suggested amount instead of a
// bill's Milk line item.

import { z } from "zod";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { employeeLeaves, employeeSalaryHistory } from "@/lib/db/schema";
import { toNumber } from "@/lib/money";
import { calculateDailyRate, calculateLeaveDays, calculateLeaveDeduction } from "@/lib/employee-leave";
import { getCurrentSalary } from "@/types/employee-salary";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

const recordLeaveSchema = z.object({
  employeeId: z.string().min(1),
  leaveStartDate: isoDateSchema,
  note: z.string().trim().max(500).optional(),
});

export async function recordEmployeeLeave(input: z.infer<typeof recordLeaveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid leave start date." };
  }
  const { employeeId, leaveStartDate, note } = parsed.data;

  try {
    const db = getDb();

    // Don't allow a second open leave on top of one that's still ongoing —
    // resume the existing one first.
    const [existingOpenLeave] = await db
      .select({ id: employeeLeaves.id })
      .from(employeeLeaves)
      .where(and(eq(employeeLeaves.employeeId, employeeId), isNull(employeeLeaves.resumeDate)));
    if (existingOpenLeave) {
      return { ok: false, error: "This employee already has an open leave — fill in its resume date first." };
    }

    const salaryRows = await db
      .select({ monthlySalary: employeeSalaryHistory.monthlySalary, effectiveFrom: employeeSalaryHistory.effectiveFrom })
      .from(employeeSalaryHistory)
      .where(eq(employeeSalaryHistory.employeeId, employeeId));
    const current = getCurrentSalary(
      salaryRows.map((r) => ({
        id: "",
        employeeId,
        monthlySalary: toNumber(r.monthlySalary),
        effectiveFrom: r.effectiveFrom,
        note: null,
        createdAt: "",
        createdBy: "",
      })),
      leaveStartDate
    );
    const dailyRateAtLeave = current ? calculateDailyRate(current.monthlySalary, leaveStartDate) : null;

    await db.insert(employeeLeaves).values({
      employeeId,
      leaveStartDate,
      dailyRateAtLeave: dailyRateAtLeave !== null ? String(dailyRateAtLeave) : null,
      note: note || null,
      createdByUid: session.uid,
      createdByEmail: session.email,
    });
    revalidatePath("/dashboard/employee-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const recordResumeSchema = z.object({
  leaveId: z.string().min(1),
  resumeDate: isoDateSchema,
});

export async function recordEmployeeLeaveResume(input: z.infer<typeof recordResumeSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordResumeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid resume date." };
  }
  const { leaveId, resumeDate } = parsed.data;

  try {
    const db = getDb();
    const [leave] = await db.select({ leaveStartDate: employeeLeaves.leaveStartDate }).from(employeeLeaves).where(eq(employeeLeaves.id, leaveId));
    if (!leave) {
      return { ok: false, error: "Leave record not found." };
    }
    if (resumeDate < leave.leaveStartDate) {
      return { ok: false, error: "Resume date can't be before the leave start date." };
    }

    await db.update(employeeLeaves).set({ resumeDate, updatedAt: new Date() }).where(eq(employeeLeaves.id, leaveId));
    revalidatePath("/dashboard/employee-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateLeaveSchema = z.object({
  leaveId: z.string().min(1),
  leaveStartDate: isoDateSchema,
  resumeDate: isoDateSchema.optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Corrects a leave record's dates/note — available to any active admin.
 * The daily rate snapshotted when the leave was first recorded is never
 * touched here (see employeeLeaves.dailyRateAtLeave's comment); only the
 * dates/note can be fixed. A leave already consumed by an accrual
 * (appliedToAccrualId set) can still be corrected — the already-recorded
 * accrual's own frozen figures are unaffected either way.
 */
export async function updateEmployeeLeave(input: z.infer<typeof updateLeaveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { leaveId, leaveStartDate, resumeDate, note } = parsed.data;
  if (resumeDate && resumeDate < leaveStartDate) {
    return { ok: false, error: "Resume date can't be before the leave start date." };
  }

  try {
    await getDb()
      .update(employeeLeaves)
      .set({ leaveStartDate, resumeDate: resumeDate ?? null, note: note || null, updatedAt: new Date() })
      .where(eq(employeeLeaves.id, leaveId));
    revalidatePath("/dashboard/employee-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const deleteLeaveSchema = z.object({
  leaveId: z.string().min(1),
});

/** Owner-only — same gating principle as deleteMilkPause. */
export async function deleteEmployeeLeave(input: z.infer<typeof deleteLeaveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a leave record." };
  }

  const parsed = deleteLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(employeeLeaves).where(eq(employeeLeaves.id, parsed.data.leaveId));
    revalidatePath("/dashboard/employee-record");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}

const autoFillSchema = z.object({
  employeeId: z.string().min(1),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
});

/**
 * Smart default for a new salary accrual's amount, given the employee and
 * the accrual's own [periodStart, periodEnd] period — called from the
 * accrual dialog. Mirrors getMilkAutoFillDefaults exactly: every value
 * returned is just a starting point, still freely editable, and the
 * actual leave/deduction figures stored on the accrual are always
 * recomputed server-side in recordSalaryAccrual from the leave ids this
 * returns, never trusted from the client.
 *
 * A leave is attributed to the period it STARTED in (same rule as milk
 * pauses) — a leave spanning a period boundary is never double-counted
 * across two accruals. An open (unresolved) leave contributes nothing yet,
 * and a leave already applied to a previous accrual is excluded so it's
 * never deducted twice.
 */
export async function getLeaveAutoFillDefaults(
  input: z.infer<typeof autoFillSchema>
): Promise<
  | { ok: true; leaveDays: number; leaveAmount: number; leaveIds: string[] }
  | { ok: false; error: string }
> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = autoFillSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, periodStart, periodEnd } = parsed.data;

  const db = getDb();
  const leaveRows = await db
    .select()
    .from(employeeLeaves)
    .where(
      and(
        eq(employeeLeaves.employeeId, employeeId),
        isNull(employeeLeaves.appliedToAccrualId),
        gte(employeeLeaves.leaveStartDate, periodStart),
        lte(employeeLeaves.leaveStartDate, periodEnd)
      )
    );
  const resolvedLeaves = leaveRows.filter((l) => l.resumeDate !== null);

  let leaveDays = 0;
  let leaveAmount = 0;
  for (const leave of resolvedLeaves) {
    const days = calculateLeaveDays(leave.leaveStartDate, leave.resumeDate as string);
    const rate = leave.dailyRateAtLeave !== null ? toNumber(leave.dailyRateAtLeave) : null;
    leaveDays += days;
    leaveAmount += calculateLeaveDeduction(rate, days);
  }
  leaveAmount = Math.round(leaveAmount * 100) / 100;

  return { ok: true, leaveDays, leaveAmount, leaveIds: resolvedLeaves.map((l) => l.id) };
}
