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

const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Records a customer payment: a real ledger credit, and FIFO-allocates it
 * across the customer's outstanding finalized bills (oldest first) so each
 * bill's payment status (see getBillPaymentStatus()) updates automatically.
 * Any amount left after every outstanding bill is settled still reduces the
 * customer's overall balance — it just isn't tied to a specific bill (e.g.
 * an advance payment). All in one Admin SDK transaction.
 */
export async function recordCustomerPayment(input: {
  customerId: string;
  amount: number;
  method?: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, amount, method, note } = parsed.data;

  const db = getAdminDb();
  const customerRef = db.collection("customers").doc(customerId);
  const paymentRef = db.collection("payments").doc();

  try {
    await db.runTransaction(async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        throw new Error("Customer not found.");
      }

      const outstandingBillsSnap = await tx.get(
        db
          .collection("bills")
          .where("customerId", "==", customerId)
          .where("status", "==", "finalized")
          .orderBy("finalizedAt", "asc")
      );

      const now = new Date().toISOString();

      tx.set(paymentRef, {
        customerId,
        amount,
        method: method ?? null,
        note: note ?? null,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.set(db.collection("customerLedgerTransactions").doc(), {
        customerId,
        type: "payment",
        direction: "credit",
        amount,
        note: note?.trim() || `Payment${method ? ` (${method})` : ""}`,
        paymentId: paymentRef.id,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(customerRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: now,
      });

      let remaining = amount;
      for (const billDoc of outstandingBillsSnap.docs) {
        if (remaining <= 0) break;
        const bill = billDoc.data() as { subtotal: number; amountPaid: number };
        const due = Math.round((bill.subtotal - bill.amountPaid) * 100) / 100;
        if (due <= 0) continue;

        const allocation = Math.min(remaining, due);
        tx.update(billDoc.ref, {
          amountPaid: FieldValue.increment(allocation),
          updatedAt: now,
        });
        tx.set(db.collection("paymentAllocations").doc(), {
          paymentId: paymentRef.id,
          billId: billDoc.id,
          customerId,
          amount: allocation,
          createdAt: now,
        });
        remaining = Math.round((remaining - allocation) * 100) / 100;
      }
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}
