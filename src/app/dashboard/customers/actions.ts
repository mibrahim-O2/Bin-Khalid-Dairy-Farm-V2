"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";

const openingBalanceSchema = z.object({
  customerId: z.string().min(1),
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
  note: z.string().min(1).max(500),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a customer's opening balance as a real ledger transaction (never
 * an editable field — see SYSTEM_ARCHITECTURE.md rule 4). This is the first
 * financial write in the project: it must go through a Server Action using
 * the Admin SDK, atomically, per the trust boundary in that doc — the
 * client is never allowed to write customerLedgerTransactions directly
 * (Firestore rules deny it outright).
 */
export async function setCustomerOpeningBalance(input: {
  customerId: string;
  direction: "debit" | "credit";
  amount: number;
  note: string;
}): Promise<ActionResult> {
  // Defense in depth: don't rely solely on the client having been gated by
  // the dashboard layout — re-verify the caller is an active admin here too.
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = openingBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, direction, amount, note } = parsed.data;

  const db = getAdminDb();
  const customerRef = db.collection("customers").doc(customerId);
  const ledgerRef = db.collection("customerLedgerTransactions").doc();

  try {
    await db.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }
      if (customerSnap.data()?.hasOpeningBalance) {
        throw new Error("Opening balance already recorded for this customer.");
      }

      const delta = direction === "debit" ? amount : -amount;
      const now = new Date().toISOString();

      tx.set(ledgerRef, {
        customerId,
        type: "opening_balance",
        direction,
        amount,
        note,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      // Cached balance is written only inside this same transaction, per
      // SYSTEM_ARCHITECTURE.md — never edited as a standalone field elsewhere.
      tx.update(customerRef, {
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
