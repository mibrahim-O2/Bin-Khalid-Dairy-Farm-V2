"use server";

// Employee statements, fully on Postgres (M12) — no Firestore involvement.

import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { employeeLedgerTransactions, employeeSalaryAccruals, employeeStatements, employees } from "@/lib/db/schema";
import { toEmployeeLedgerTransaction, toEmployeeSalaryAccrual } from "@/lib/db/mappers";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true; statementId: string } | { ok: false; error: string };

const generateSchema = z.object({
  employeeId: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Generates an immutable statement snapshot over [startDate, endDate] —
 * mirrors generateSupplierStatement exactly, but balance deltas are
 * reversed per Domain C's sign convention: credit increases the balance,
 * debit decreases it (see EmployeeLedgerTransaction).
 */
export async function generateEmployeeStatement(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, startDate, endDate } = parsed.data;
  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  const db = getDb();

  try {
    const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
    if (!employee) {
      return { ok: false, error: "Employee not found." };
    }

    const allTransactionRows = await db
      .select()
      .from(employeeLedgerTransactions)
      .where(eq(employeeLedgerTransactions.employeeId, employeeId))
      .orderBy(asc(employeeLedgerTransactions.createdAt));

    // Same fix as generateSupplierStatement: a salary accrual's
    // `createdAt` is when the record was entered, not the payroll period
    // it actually covers — backfilled/late-entered accruals would
    // otherwise silently fall outside a date-range statement that should
    // include them. Use the accrual's own `periodEnd` as its effective
    // date; payment entries have no separate date of their own, so
    // createdAt remains correct for those.
    const accrualIds = allTransactionRows
      .map((row) => row.accrualId)
      .filter((id): id is string => id !== null);
    const accrualById = new Map<string, ReturnType<typeof toEmployeeSalaryAccrual>>();
    if (accrualIds.length > 0) {
      const accrualRows = await db
        .select()
        .from(employeeSalaryAccruals)
        .where(inArray(employeeSalaryAccruals.id, accrualIds));
      for (const a of accrualRows) accrualById.set(a.id, toEmployeeSalaryAccrual(a));
    }

    function effectiveDateIso(row: (typeof allTransactionRows)[number], createdAtIso: string): string {
      if (row.accrualId) {
        const accrual = accrualById.get(row.accrualId);
        if (accrual) return `${accrual.periodEnd}T12:00:00.000Z`;
      }
      return createdAtIso;
    }

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange = [];

    const sortedRows = allTransactionRows
      .map((row) => ({ row, entry: toEmployeeLedgerTransaction(row) }))
      .map(({ row, entry }) => {
        // Leave figures live on the accrual row, not this ledger row —
        // join them in so the persisted statement snapshot shows them too.
        const accrual = row.accrualId ? accrualById.get(row.accrualId) : undefined;
        const enrichedEntry =
          accrual && accrual.leaveDaysDeducted
            ? { ...entry, leaveDaysDeducted: accrual.leaveDaysDeducted, leaveAmountDeducted: accrual.leaveAmountDeducted ?? undefined }
            : entry;
        return { entry: enrichedEntry, effectiveDate: effectiveDateIso(row, entry.createdAt) };
      })
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    for (const { entry, effectiveDate } of sortedRows) {
      const delta = entry.direction === "credit" ? entry.amount : -entry.amount;
      // opening_balance represents whatever was owed BEFORE this ledger
      // started tracking anything — always part of "opening", regardless
      // of when the row itself was created.
      if (entry.type === "opening_balance") {
        openingBalance += delta;
      } else if (effectiveDate < startIso) {
        openingBalance += delta;
      } else if (effectiveDate <= endIso) {
        // Show the date this transaction actually represents (the
        // accrual's period end), not when the record was entered.
        transactionsInRange.push({ ...entry, createdAt: effectiveDate });
      }
    }

    openingBalance = round2(openingBalance);
    const closingBalance = round2(
      transactionsInRange.reduce(
        (balance, entry) => balance + (entry.direction === "credit" ? entry.amount : -entry.amount),
        openingBalance
      )
    );

    const [statement] = await db
      .insert(employeeStatements)
      .values({
        employeeId,
        employeeName: employee.name,
        startDate,
        endDate,
        openingBalance: String(openingBalance),
        closingBalance: String(closingBalance),
        transactions: transactionsInRange,
        createdByUid: session.uid,
        createdByEmail: session.email,
      })
      .returning();

    return { ok: true, statementId: statement.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate statement.",
    };
  }
}
