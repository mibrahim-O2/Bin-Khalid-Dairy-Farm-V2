"use server";

import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true; statementId: string } | { ok: false; error: string };

const generateSchema = z.object({
  supplierId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Generates an immutable statement snapshot over [startDate, endDate] — not
 * a second ledger. The underlying purchases/payments remain the source of
 * truth; this freezes a date range of them (plus opening/closing balance)
 * into a shareable document, matching the customer bill pattern. Never
 * edited after creation — a re-generate just creates a new statement doc.
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

  const db = getAdminDb();

  try {
    const supplierSnap = await db.collection("suppliers").doc(supplierId).get();
    if (!supplierSnap.exists) {
      return { ok: false, error: "Supplier not found." };
    }
    const supplier = supplierSnap.data() as { name: string };

    const allTransactionsSnap = await db
      .collection("supplierLedgerTransactions")
      .where("supplierId", "==", supplierId)
      .orderBy("createdAt", "asc")
      .get();

    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let openingBalance = 0;
    const transactionsInRange: Array<Record<string, unknown>> = [];

    for (const doc of allTransactionsSnap.docs) {
      const tx = doc.data() as { createdAt: string; direction: "debit" | "credit"; amount: number };
      const delta = tx.direction === "debit" ? tx.amount : -tx.amount;
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
        return balance + (t.direction === "debit" ? t.amount : -t.amount);
      }, openingBalance)
    );

    const now = new Date().toISOString();
    const statementRef = db.collection("supplierStatements").doc();
    await statementRef.set({
      supplierId,
      supplierName: supplier.name,
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
