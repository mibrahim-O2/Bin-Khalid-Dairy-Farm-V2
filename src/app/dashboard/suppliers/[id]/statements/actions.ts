"use server";

// Supplier statements, fully on Postgres (M9) — no Firestore involvement.

import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { supplierLedgerTransactions, supplierStatements, suppliers } from "@/lib/db/schema";
import { toSupplierLedgerTransaction } from "@/lib/db/mappers";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true; statementId: string } | { ok: false; error: string };

const generateSchema = z.object({
  supplierId: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Generates an immutable statement snapshot over [startDate, endDate] — not
 * a second ledger. The underlying purchases/payments remain the source of
 * truth; this freezes a date range of them (plus opening/closing balance)
 * into a shareable document, matching the customer bill pattern. Never
 * edited after creation — a re-generate just creates a new statement row.
 */
export async function generateSupplierStatement(input: {
  supplierId: string;
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
  const { supplierId, startDate, endDate } = parsed.data;
  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  const db = getDb();

  try {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
    if (!supplier) {
      return { ok: false, error: "Supplier not found." };
    }

    const allTransactionRows = await db
      .select()
      .from(supplierLedgerTransactions)
      .where(eq(supplierLedgerTransactions.supplierId, supplierId))
      .orderBy(asc(supplierLedgerTransactions.createdAt));

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange = [];

    for (const row of allTransactionRows) {
      const entry = toSupplierLedgerTransaction(row);
      const delta = entry.direction === "debit" ? entry.amount : -entry.amount;
      if (entry.createdAt < startIso) {
        openingBalance += delta;
      } else if (entry.createdAt <= endIso) {
        transactionsInRange.push(entry);
      }
    }

    openingBalance = round2(openingBalance);
    const closingBalance = round2(
      transactionsInRange.reduce(
        (balance, entry) => balance + (entry.direction === "debit" ? entry.amount : -entry.amount),
        openingBalance
      )
    );

    const [statement] = await db
      .insert(supplierStatements)
      .values({
        supplierId,
        supplierName: supplier.name,
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
