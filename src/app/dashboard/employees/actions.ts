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
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { employeeLedgerTransactions, employeePayments, employeeSalaryAccruals, employees } from "@/lib/db/schema";
import { isoDateSchema } from "@/lib/zod-date";

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
});

/**
 * Records a period's salary accrual: a real ledger credit (farm owes the
 * employee more). Unlike a bill/purchase this has no line items to draft —
 * it's created directly in "finalized" state in one call, snapshotting
 * whatever amount was entered (normally pre-filled client-side from the
 * employee's currently effective salary, but adjustable).
 */
export async function recordSalaryAccrual(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordAccrualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, periodStart, periodEnd, amount, note } = parsed.data;
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

      const [accrual] = await tx
        .insert(employeeSalaryAccruals)
        .values({
          employeeId,
          periodStart,
          periodEnd,
          amount: String(amount),
          note: note?.trim() || null,
          status: "finalized",
          createdByUid: session.uid,
          createdByEmail: session.email,
        })
        .returning();

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
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record salary accrual.",
    };
  }
}

const voidAccrualSchema = z.object({
  accrualId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * Voids a salary accrual: never deletes or edits the original. Records a
 * reversing ledger debit and updates the cached balance, atomically.
 */
export async function voidSalaryAccrual(input: {
  accrualId: string;
  reason: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = voidAccrualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A reason is required to void a salary accrual." };
  }
  const { accrualId, reason } = parsed.data;

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [accrual] = await tx
        .select()
        .from(employeeSalaryAccruals)
        .where(eq(employeeSalaryAccruals.id, accrualId));
      if (!accrual) {
        throw new Error("Salary accrual not found.");
      }
      if (accrual.status !== "finalized") {
        throw new Error("Only a finalized salary accrual can be voided.");
      }
      employeeId = accrual.employeeId;

      await tx.insert(employeeLedgerTransactions).values({
        employeeId: accrual.employeeId,
        type: "salary_accrual_void",
        direction: "debit",
        amount: accrual.amount,
        note: `Void of salary accrual: ${reason}`,
        accrualId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} - ${accrual.amount}`, updatedAt: new Date() })
        .where(eq(employees.id, accrual.employeeId));

      await tx
        .update(employeeSalaryAccruals)
        .set({
          status: "void",
          voidedAt: new Date(),
          voidedByUid: session.uid,
          voidedByEmail: session.email,
          voidReason: reason,
        })
        .where(eq(employeeSalaryAccruals.id, accrualId));
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void salary accrual.",
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

const voidPaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * Voids an employee payment/advance: never deletes or edits the original.
 * Mirrors voidSupplierPayment/voidCustomerPayment, minus allocation
 * reversal (employee payments were never allocated against anything).
 */
export async function voidEmployeePayment(input: {
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

  const db = getDb();
  let employeeId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(employeePayments).where(eq(employeePayments.id, paymentId));
      if (!payment) {
        throw new Error("Payment not found.");
      }
      if (payment.voidedAt != null) {
        throw new Error("This payment has already been voided.");
      }
      employeeId = payment.employeeId;

      await tx.insert(employeeLedgerTransactions).values({
        employeeId: payment.employeeId,
        type: "payment_void",
        direction: "credit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdByUid: session.uid,
        createdByEmail: session.email,
      });

      await tx
        .update(employees)
        .set({ balance: sql`${employees.balance} + ${payment.amount}`, updatedAt: new Date() })
        .where(eq(employees.id, payment.employeeId));

      await tx
        .update(employeePayments)
        .set({
          voidedAt: new Date(),
          voidedByUid: session.uid,
          voidedByEmail: session.email,
          voidReason: reason,
        })
        .where(eq(employeePayments.id, paymentId));
    });

    if (employeeId) {
      revalidatePath(`/dashboard/employees/${employeeId}`);
      revalidatePath(`/dashboard/employees/${employeeId}/ledger`);
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void payment.",
    };
  }
}
