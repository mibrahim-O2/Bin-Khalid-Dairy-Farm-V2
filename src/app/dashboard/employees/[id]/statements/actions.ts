"use server";

// Employee statements, fully on Postgres (M12) — no Firestore involvement.

import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { employeeLedgerTransactions, employeeStatements, employees } from "@/lib/db/schema";
import { toEmployeeLedgerTransaction } from "@/lib/db/mappers";

type ActionResult = { ok: true; statementId: string } | { ok: false; error: string };

const generateSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
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

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange = [];

    for (const row of allTransactionRows) {
      const entry = toEmployeeLedgerTransaction(row);
      const delta = entry.direction === "credit" ? entry.amount : -entry.amount;
      if (entry.createdAt < startIso) {
        openingBalance += delta;
      } else if (entry.createdAt <= endIso) {
        transactionsInRange.push(entry);
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
