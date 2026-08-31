"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const openingBalanceSchema = z.object({
  employeeId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

/**
 * Records an employee's opening balance as a real ledger transaction — same
 * pattern as setSupplierOpeningBalance/setCustomerOpeningBalance, but for
 * Domain C (Employees), where the sign convention is REVERSED: credit =
 * farm owes the employee more, debit = farm owes them less (an advance
 * already outstanding when they were added to the system).
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

  const db = getAdminDb();
  const employeeRef = db.collection("employees").doc(employeeId);
  const ledgerRef = db.collection("employeeLedgerTransactions").doc();

  try {
    await db.runTransaction(async (tx) => {
      const employeeSnap = await tx.get(employeeRef);
      if (!employeeSnap.exists) {
        throw new Error("Employee not found.");
      }
      if (employeeSnap.data()?.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this employee.");
      }

      // Reversed vs customers/suppliers: credit increases balance here.
      const delta = direction === "credit" ? amount : -amount;
      const now = new Date().toISOString();

      tx.set(ledgerRef, {
        employeeId,
        type: "opening_balance",
        direction,
        amount,
        note,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(employeeRef, {
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

const recordAccrualSchema = z.object({
  employeeId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
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

  const db = getAdminDb();
  const employeeRef = db.collection("employees").doc(employeeId);
  const accrualRef = db.collection("employeeSalaryAccruals").doc();

  try {
    await db.runTransaction(async (tx) => {
      const employeeSnap = await tx.get(employeeRef);
      if (!employeeSnap.exists) {
        throw new Error("Employee not found.");
      }

      const now = new Date().toISOString();

      tx.set(accrualRef, {
        employeeId,
        periodStart,
        periodEnd,
        amount,
        note: note?.trim() || null,
        status: "finalized",
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });

      tx.set(db.collection("employeeLedgerTransactions").doc(), {
        employeeId,
        type: "salary_accrual",
        direction: "credit",
        amount,
        note: note?.trim() || "Salary accrual",
        accrualId: accrualRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(employeeRef, {
        balance: FieldValue.increment(amount),
        updatedAt: now,
      });
    });
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

  const db = getAdminDb();
  const accrualRef = db.collection("employeeSalaryAccruals").doc(accrualId);

  try {
    await db.runTransaction(async (tx) => {
      const accrualSnap = await tx.get(accrualRef);
      if (!accrualSnap.exists) {
        throw new Error("Salary accrual not found.");
      }
      const accrual = accrualSnap.data() as {
        employeeId: string;
        amount: number;
        status: string;
      };
      if (accrual.status !== "finalized") {
        throw new Error("Only a finalized salary accrual can be voided.");
      }

      const now = new Date().toISOString();
      const employeeRef = db.collection("employees").doc(accrual.employeeId);

      tx.set(db.collection("employeeLedgerTransactions").doc(), {
        employeeId: accrual.employeeId,
        type: "salary_accrual_void",
        direction: "debit",
        amount: accrual.amount,
        note: `Void of salary accrual: ${reason}`,
        accrualId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(employeeRef, {
        balance: FieldValue.increment(-accrual.amount),
        updatedAt: now,
      });

      tx.update(accrualRef, {
        status: "void",
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
      });
    });
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
 * salary, so it just reduces the running balance directly. See
 * EmployeePayment in src/types/employee-payment.ts.
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

  const db = getAdminDb();
  const employeeRef = db.collection("employees").doc(employeeId);
  const paymentRef = db.collection("employeePayments").doc();

  try {
    await db.runTransaction(async (tx) => {
      const employeeSnap = await tx.get(employeeRef);
      if (!employeeSnap.exists) {
        throw new Error("Employee not found.");
      }

      const now = new Date().toISOString();

      tx.set(paymentRef, {
        employeeId,
        amount,
        source,
        givenBy,
        note: note?.trim() || null,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });

      tx.set(db.collection("employeeLedgerTransactions").doc(), {
        employeeId,
        type: "payment",
        direction: "debit",
        amount,
        note: note?.trim() || `Advance (${source === "ghar" ? "Ghar" : "Dukan"}, given by ${givenBy})`,
        paymentId: paymentRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(employeeRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: now,
      });
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

  const db = getAdminDb();
  const paymentRef = db.collection("employeePayments").doc(paymentId);

  try {
    await db.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) {
        throw new Error("Payment not found.");
      }
      const payment = paymentSnap.data() as {
        employeeId: string;
        amount: number;
        voidedAt: string | null;
      };
      if (payment.voidedAt != null) {
        throw new Error("This payment has already been voided.");
      }

      const now = new Date().toISOString();
      const employeeRef = db.collection("employees").doc(payment.employeeId);

      tx.set(db.collection("employeeLedgerTransactions").doc(), {
        employeeId: payment.employeeId,
        type: "payment_void",
        direction: "credit",
        amount: payment.amount,
        note: `Void of payment: ${reason}`,
        paymentId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(employeeRef, {
        balance: FieldValue.increment(payment.amount),
        updatedAt: now,
      });

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
