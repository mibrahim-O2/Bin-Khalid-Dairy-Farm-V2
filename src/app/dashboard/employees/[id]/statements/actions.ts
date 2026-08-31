"use server";

import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";

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

  const db = getAdminDb();

  try {
    const employeeSnap = await db.collection("employees").doc(employeeId).get();
    if (!employeeSnap.exists) {
      return { ok: false, error: "Employee not found." };
    }
    const employee = employeeSnap.data() as { name: string };

    const allTransactionsSnap = await db
      .collection("employeeLedgerTransactions")
      .where("employeeId", "==", employeeId)
      .orderBy("createdAt", "asc")
      .get();

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange: Array<Record<string, unknown>> = [];

    for (const doc of allTransactionsSnap.docs) {
      const tx = doc.data() as { createdAt: string; direction: "debit" | "credit"; amount: number };
      const delta = tx.direction === "credit" ? tx.amount : -tx.amount;
      if (tx.createdAt < startIso) {
        openingBalance += delta;
      } else if (tx.createdAt <= endIso) {
        transactionsInRange.push({ id: doc.id, ...tx });
      }
    }

    openingBalance = round2(openingBalance);
    const closingBalance = round2(
      transactionsInRange.reduce((balance, tx) => {
        const t = tx as { direction: "debit" | "credit"; amount: number };
        return balance + (t.direction === "credit" ? t.amount : -t.amount);
      }, openingBalance)
    );

    const now = new Date().toISOString();
    const statementRef = db.collection("employeeStatements").doc();
    await statementRef.set({
      employeeId,
      employeeName: employee.name,
      startDate,
      endDate,
      openingBalance,
      closingBalance,
      transactions: transactionsInRange,
      createdAt: now,
      createdBy: { uid: session.uid, email: session.email },
    });

    return { ok: true, statementId: statementRef.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate statement.",
    };
  }
}
