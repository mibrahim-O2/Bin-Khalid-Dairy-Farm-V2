"use server";

// Employee opening balance / salary accruals / advances-payments / ledger,
// fully on Postgres (M11) — no Firestore involvement anywhere in this
// file. Mirrors customers/actions.ts and suppliers/actions.ts, but
// Domain C's sign convention is REVERSED: credit = salary accrued (farm
// owes more), debit = advance/payment taken (farm owes less). There's no
// FIFO allocation here at all — an advance is taken against future,
// not-yet-determined salary, so it just reduces the running balance
// directly (see EmployeePayment in src/types/employee-payment.ts).

import { z } from "zod";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { logActivity } from "@/lib/db/activity-log";
import {
  employeeLedgerTransactions,
  employeeLeaves,
  employeePayments,
  employeeSalaryAccruals,
  employees,
} from "@/lib/db/schema";
import { isoDateSchema } from "@/lib/zod-date";
import { calculateLeaveDays, calculateLeaveDeduction } from "@/lib/employee-leave";

type ActionResult = { ok: true } | { ok: false; error: string };

const openingBalanceSchema = z.object({
  employeeId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

/**
 * Records an employee's opening balance as a real ledger transaction —
 * same pattern as setSupplierOpeningBalance/setCustomerOpeningBalance, but
 * for Domain C where the sign convention is reversed: credit = farm owes
 * the employee more, debit = farm owes them less (an advance already
 * outstanding when they were added to the system).
 */
export async function setEmployeeOpeningBalance(input: {
  employeeId: string;
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
  const { employeeId, direction, amount, note } = parsed.data;

  const db = getDb();
  // Reversed vs customers/suppliers: credit increases balance here.
  const delta = direction === "credit" ? amount : -amount;

  try {
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
      if (!employee) {
        throw new Error("Employee not found.");
      }
      if (employee.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this employee.");
      }

      await tx.insert(employeeLedgerTransactions).values({
        employeeId,
        type: "opening_balance",
        direction,
        amount: String(amount),
        note,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(employees)
        .set({
          balance: sql`${employees.balance} + ${delta}`,
          hasOpeningBalance: true,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, employeeId));
    });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to set opening balance.",
    };
  }
}

const recordAccrualSchema = z.object({
  employeeId: z.string().min(1),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
  // Ids of employeeLeaves rows to fold into this accrual (see
  // getLeaveAutoFillDefaults in employee-record/actions.ts, which the
  // record-accrual dialog calls to suggest these). Only the ids are
  // trusted from the client — the actual day count and deduction amount
  // are always recomputed here from the live leave rows, never from a
  // client-submitted figure.
  applyLeaveIds: z.array(z.string().min(1)).optional(),
});

/**
 * Records a period's salary accrual: a real ledger credit (farm owes the
 * employee more). Unlike a bill/purchase this has no line items to draft —
 * it's created directly in "finalized" state in one call, snapshotting
 * whatever amount was entered (normally pre-filled client-side from the
 * employee's currently effective salary minus any leave deduction, but
 * adjustable). If `applyLeaveIds` names resolved, not-yet-applied leave
 * periods belonging to this employee, their combined days/deduction are
 * computed from the leave rows themselves (each already carries its own
 * frozen daily rate) and stored on the new accrual for display in the
 * ledger's Leave/Leave Amount columns — this is purely informational
 * metadata, `amount` above is the actual ledger credit either way.
 */
export async function recordSalaryAccrual(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  note?: string;
  applyLeaveIds?: string[];
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordAccrualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, periodStart, periodEnd, amount, note, applyLeaveIds } = parsed.data;
  if (periodEnd < periodStart) {
    return { ok: false, error: "Period end must be on or after the period start." };
  }

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
      if (!employee) {
        throw new Error("Employee not found.");
      }

      let leaveDaysDeducted: number | null = null;
      let leaveAmountDeducted: number | null = null;
      let leaveRowsToMark: string[] = [];

      if (applyLeaveIds && applyLeaveIds.length > 0) {
        const eligibleLeaves = await tx
          .select()
          .from(employeeLeaves)
          .where(
            and(
              eq(employeeLeaves.employeeId, employeeId),
              inArray(employeeLeaves.id, applyLeaveIds),
              isNull(employeeLeaves.appliedToAccrualId),
              isNotNull(employeeLeaves.resumeDate)
            )
          );
        if (eligibleLeaves.length > 0) {
          let totalDays = 0;
          let totalAmount = 0;
          for (const leave of eligibleLeaves) {
            const days = calculateLeaveDays(leave.leaveStartDate, leave.resumeDate as string);
            const rate = leave.dailyRateAtLeave !== null ? Number(leave.dailyRateAtLeave) : null;
            totalDays += days;
            totalAmount += calculateLeaveDeduction(rate, days);
          }
          leaveDaysDeducted = totalDays;
          leaveAmountDeducted = Math.round(totalAmount * 100) / 100;
          leaveRowsToMark = eligibleLeaves.map((l) => l.id);
        }
      }

      const [accrual] = await tx
        .insert(employeeSalaryAccruals)
        .values({
          employeeId,
          periodStart,
          periodEnd,
          amount: String(amount),
          note: note?.trim() || null,
          status: "finalized",
          leaveDaysDeducted: leaveDaysDeducted !== null ? String(leaveDaysDeducted) : null,
          leaveAmountDeducted: leaveAmountDeducted !== null ? String(leaveAmountDeducted) : null,
          createdByUid: session.uid,
          createdByEmail: session.email,
        })
        .returning();

      if (leaveRowsToMark.length > 0) {
        await tx
          .update(employeeLeaves)
          .set({ appliedToAccrualId: accrual.id, updatedAt: new Date() })
          .where(and(inArray(employeeLeaves.id, leaveRowsToMark), isNull(employeeLeaves.appliedToAccrualId)));
      }

      await tx.insert(employeeLedgerTransactions).values({
        employeeId,
        type: "salary_accrual",
        direction: "credit",
        amount: String(amount),
        note: note?.trim() || "Salary accrual",
        accrualId: accrual.id,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} + ${amount}`, updatedAt: new Date() })
        .where(eq(employees.id, employeeId));
    });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    revalidatePath("/dashboard/employee-record");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record salary accrual.",
    };
  }
}

const updateAccrualSchema = z.object({
  accrualId: z.string().min(1),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

/**
 * Edits a finalized salary accrual in place — available to any active
 * admin (same trust level as recording one), not Owner-gated. Applies the
 * amount change as a delta to the cached balance and keeps the matching
 * ledger row's own amount in sync, same pattern as
 * updateFinalizedPurchase/updateFinalizedBill. Leave linkage
 * (leaveDaysDeducted/leaveAmountDeducted/which leave rows are applied) is
 * frozen from when this accrual was first recorded and is not touched by
 * an edit — to change that, delete and re-record.
 */
export async function updateSalaryAccrual(input: {
  accrualId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateAccrualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { accrualId, periodStart, periodEnd, amount, note } = parsed.data;
  if (periodEnd < periodStart) {
    return { ok: false, error: "Period end must be on or after the period start." };
  }

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [accrual] = await tx.select().from(employeeSalaryAccruals).where(eq(employeeSalaryAccruals.id, accrualId));
      if (!accrual) {
        throw new Error("Salary accrual not found.");
      }
      employeeId = accrual.employeeId;
      const delta = amount - Number(accrual.amount);

      await tx
        .update(employeeSalaryAccruals)
        .set({ periodStart, periodEnd, amount: String(amount), note: note?.trim() || null })
        .where(eq(employeeSalaryAccruals.id, accrualId));

      await tx
        .update(employeeLedgerTransactions)
        .set({ amount: String(amount), note: note?.trim() || "Salary accrual" })
        .where(and(eq(employeeLedgerTransactions.accrualId, accrualId), eq(employeeLedgerTransactions.type, "salary_accrual")));

      if (delta !== 0) {
        await tx
          .update(employees)
          .set({ balance: sql`${employees.balance} + ${delta}`, updatedAt: new Date() })
          .where(eq(employees.id, accrual.employeeId));
      }
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update salary accrual.",
    };
  }
}

const deleteAccrualSchema = z.object({
  accrualId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes a salary accrual — Owner-only, replacing the former
 * void-with-reversing-entry (see Batch 3's purchases/bills/payments
 * conversion for the same rationale: a reversing "void" trace served no
 * purpose for what's normally a data-entry fix). Reverses the balance,
 * physically removes the row (cascading its own ledger transaction via
 * ON DELETE CASCADE on accrualId), and unlinks any leave rows that had
 * been applied to it (ON DELETE SET NULL on employeeLeaves.appliedToAccrualId)
 * so their deduction becomes available to apply to a future accrual again.
 */
export async function deleteSalaryAccrual(input: { accrualId: string; reason?: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a salary accrual." };
  }

  const parsed = deleteAccrualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { accrualId, reason } = parsed.data;

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [accrual] = await tx.select().from(employeeSalaryAccruals).where(eq(employeeSalaryAccruals.id, accrualId));
      if (!accrual) {
        throw new Error("Salary accrual not found.");
      }
      employeeId = accrual.employeeId;

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} - ${accrual.amount}`, updatedAt: new Date() })
        .where(eq(employees.id, accrual.employeeId));

      await tx.delete(employeeSalaryAccruals).where(eq(employeeSalaryAccruals.id, accrualId));
    });

    await logActivity({
      action: "salary_accrual_deleted",
      targetType: "employee_salary_accrual",
      targetId: accrualId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { employeeId, reason: reason ?? null },
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
      revalidatePath("/dashboard/employee-record");
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete salary accrual.",
    };
  }
}

const recordPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  source: z.enum(["ghar", "dukan"]),
  givenBy: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

/**
 * Records an advance/payment given to an employee: a real ledger debit
 * (farm owes the employee less). No FIFO allocation against specific
 * accruals — an advance is taken against future, not-yet-determined
 * salary, so it just reduces the running balance directly.
 */
export async function recordEmployeePayment(input: {
  employeeId: string;
  amount: number;
  source: "ghar" | "dukan";
  givenBy: string;
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
      error: amountIssue ? "Enter a valid amount greater than zero." : "Invalid input.",
    };
  }
  const { employeeId, amount, source, givenBy, note } = parsed.data;

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
      if (!employee) {
        throw new Error("Employee not found.");
      }

      const [payment] = await tx
        .insert(employeePayments)
        .values({
          employeeId,
          amount: String(amount),
          source,
          givenBy,
          note: note?.trim() || null,
          createdByUid: session.uid,
          createdByEmail: session.email,
        })
        .returning();

      await tx.insert(employeeLedgerTransactions).values({
        employeeId,
        type: "payment",
        direction: "debit",
        amount: String(amount),
        note: note?.trim() || `Advance (${source === "ghar" ? "Ghar" : "Dukan"}, given by ${givenBy})`,
        paymentId: payment.id,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} - ${amount}`, updatedAt: new Date() })
        .where(eq(employees.id, employeeId));
    });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

const updatePaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  source: z.enum(["ghar", "dukan"]),
  givenBy: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

/**
 * Edits an advance/payment in place — available to any active admin, not
 * Owner-gated (same trust level as recording one). Applies the amount
 * change as a delta to the cached balance and keeps the matching ledger
 * row's own amount/note in sync. No FIFO re-allocation needed (employee
 * payments were never allocated against anything).
 */
export async function updateEmployeePayment(input: {
  paymentId: string;
  amount: number;
  source: "ghar" | "dukan";
  givenBy: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { paymentId, amount, source, givenBy, note } = parsed.data;

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(employeePayments).where(eq(employeePayments.id, paymentId));
      if (!payment) {
        throw new Error("Payment not found.");
      }
      employeeId = payment.employeeId;
      // Debit reduces the balance: reverse the old amount, then apply the new one.
      const delta = Number(payment.amount) - amount;
      const noteText = note?.trim() || `Advance (${source === "ghar" ? "Ghar" : "Dukan"}, given by ${givenBy})`;

      await tx
        .update(employeePayments)
        .set({ amount: String(amount), source, givenBy, note: note?.trim() || null })
        .where(eq(employeePayments.id, paymentId));

      await tx
        .update(employeeLedgerTransactions)
        .set({ amount: String(amount), note: noteText })
        .where(and(eq(employeeLedgerTransactions.paymentId, paymentId), eq(employeeLedgerTransactions.type, "payment")));

      if (delta !== 0) {
        await tx
          .update(employees)
          .set({ balance: sql`${employees.balance} + ${delta}`, updatedAt: new Date() })
          .where(eq(employees.id, payment.employeeId));
      }
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update payment.",
    };
  }
}

const deletePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes an advance/payment — Owner-only, replacing the
 * former void-with-reversing-entry (same rationale as
 * deleteSalaryAccrual). Reverses the balance and physically removes the
 * row, cascading its own ledger transaction via ON DELETE CASCADE on
 * paymentId.
 */
export async function deleteEmployeePayment(input: { paymentId: string; reason?: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete a payment." };
  }

  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { paymentId, reason } = parsed.data;

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(employeePayments).where(eq(employeePayments.id, paymentId));
      if (!payment) {
        throw new Error("Payment not found.");
      }
      employeeId = payment.employeeId;

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} + ${payment.amount}`, updatedAt: new Date() })
        .where(eq(employees.id, payment.employeeId));

      await tx.delete(employeePayments).where(eq(employeePayments.id, paymentId));
    });

    await logActivity({
      action: "employee_payment_deleted",
      targetType: "employee_payment",
      targetId: paymentId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { employeeId, reason: reason ?? null },
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete payment.",
    };
  }
}

const deleteEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * Permanently deletes an employee AND their entire financial trail —
 * mirrors deleteCustomer/deleteSupplier exactly: Owner-only, requires
 * confirmation, cascades via the ON DELETE CASCADE foreign keys on salary
 * accruals/payments/ledger transactions.
 */
export async function deleteEmployee(input: { employeeId: string; reason?: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can delete an employee." };
  }

  const parsed = deleteEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, reason } = parsed.data;

  const db = getDb();

  try {
    const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
    if (!employee) {
      return { ok: false, error: "Employee not found." };
    }

    const [accrualRows, paymentRows, ledgerRows, leaveRows] = await Promise.all([
      db.select().from(employeeSalaryAccruals).where(eq(employeeSalaryAccruals.employeeId, employeeId)),
      db.select().from(employeePayments).where(eq(employeePayments.employeeId, employeeId)),
      db.select().from(employeeLedgerTransactions).where(eq(employeeLedgerTransactions.employeeId, employeeId)),
      db.select().from(employeeLeaves).where(eq(employeeLeaves.employeeId, employeeId)),
    ]);

    await db.delete(employees).where(eq(employees.id, employeeId));

    await logActivity({
      action: "employee_deleted",
      targetType: "employee",
      targetId: employeeId,
      actorUid: session.uid,
      actorEmail: session.email,
      details: {
        employeeName: employee.name,
        reason: reason ?? null,
        purgedCounts: {
          salaryAccruals: accrualRows.length,
          payments: paymentRows.length,
          ledgerTransactions: ledgerRows.length,
          leaves: leaveRows.length,
        },
      },
    });

    revalidatePath("/dashboard/employees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete employee.",
    };
  }
}
