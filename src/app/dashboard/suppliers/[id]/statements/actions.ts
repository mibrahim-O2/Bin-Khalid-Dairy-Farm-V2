"use server";

// Supplier statements, fully on Postgres (M9) — no Firestore involvement.

import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { purchases, supplierLedgerTransactions, supplierStatements, suppliers } from "@/lib/db/schema";
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

    // A purchase entry's `createdAt` is when the record was ENTERED into
    // the system, not when the purchase actually happened — a purchase
    // dated 3 Aug can easily be finalized weeks later (backfilled
    // history, a busy day, etc.). Filtering a date-range statement by
    // createdAt silently excludes exactly those backdated purchases,
    // which is the whole point of a statement covering a real-world
    // period. Use each purchase's own `purchaseDate` as its effective
    // date instead; payment entries have no separate date field of their
    // own, so createdAt remains correct for those (and for the single
    // opening_balance entry, set once at creation time).
    const purchaseIds = allTransactionRows
      .map((row) => row.purchaseId)
      .filter((id): id is string => id !== null);
    const purchaseDateById = new Map<string, string>();
    if (purchaseIds.length > 0) {
      const purchaseRows = await db
        .select({ id: purchases.id, purchaseDate: purchases.purchaseDate })
        .from(purchases)
        .where(inArray(purchases.id, purchaseIds));
      for (const p of purchaseRows) purchaseDateById.set(p.id, p.purchaseDate);
    }

    function effectiveDateIso(row: (typeof allTransactionRows)[number], createdAtIso: string): string {
      if (row.purchaseId) {
        const purchaseDate = purchaseDateById.get(row.purchaseId);
        // Midday UTC, not midnight, so this never sorts before an
        // opening_balance/payment entry legitimately created earlier the
        // same calendar day.
        if (purchaseDate) return `${purchaseDate}T12:00:00.000Z`;
      }
      return createdAtIso;
    }

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange = [];

    // Re-sort by effective date — createdAt order (the DB query above)
    // and effective-date order can now legitimately differ for backdated
    // purchases, and the opening/closing balance math below depends on
    // processing entries in true chronological order.
    const sortedRows = allTransactionRows
      .map((row) => ({ row, entry: toSupplierLedgerTransaction(row) }))
      .map(({ row, entry }) => ({ entry, effectiveDate: effectiveDateIso(row, entry.createdAt) }))
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    for (const { entry, effectiveDate } of sortedRows) {
      const delta = entry.direction === "debit" ? entry.amount : -entry.amount;
      // opening_balance represents whatever the supplier owed BEFORE this
      // ledger started tracking anything — by definition that's always
      // part of "opening", regardless of when the row itself was created
      // (e.g. a supplier onboarded today with real prior debt still needs
      // that debt counted in a statement covering an earlier period).
      if (entry.type === "opening_balance") {
        openingBalance += delta;
      } else if (effectiveDate < startIso) {
        openingBalance += delta;
      } else if (effectiveDate <= endIso) {
        // The frozen snapshot should show the date this transaction
        // actually represents (the purchase date), not when the record
        // happened to be entered — otherwise an "August statement" would
        // show every line dated whenever it was typed in.
        transactionsInRange.push({ ...entry, createdAt: effectiveDate });
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
