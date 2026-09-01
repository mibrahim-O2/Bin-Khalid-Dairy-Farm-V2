"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { eq, sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { calculateDays, calculateLineTotals, calculateSubtotal } from "@/lib/billing";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";

// TRANSITIONAL — see the identical helper's comment in
// src/app/dashboard/customers/actions.ts. Removed once M3/M5 migrate bills
// and this whole file off Firestore.
async function syncPostgresBalance(customerId: string, delta: number) {
  try {
    await getDb()
      .update(customers)
      .set({ balance: sql`${customers.balance} + ${delta}`, updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  } catch (err) {
    console.error(`[transitional] Failed to sync Postgres balance for customer ${customerId}:`, err);
  }
}

type ActionResult = { ok: true } | { ok: false; error: string };

const finalizeSchema = z.object({ billId: z.string().min(1) });

/**
 * Finalizes a draft bill: assigns a sequential bill number via a
 * transactional counter, recomputes every total from the raw line-item
 * inputs (never trusting whatever the client last saved — the draft is
 * user-editable right up to this moment), creates exactly one ledger debit,
 * and updates the customer's cached balance — all inside one Admin SDK
 * transaction. See SYSTEM_ARCHITECTURE.md §3, §5.
 */
export async function finalizeBill(input: { billId: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { billId } = parsed.data;

  const db = getAdminDb();
  const billRef = db.collection("bills").doc(billId);

  try {
    const finalized = await db.runTransaction(async (tx) => {
      const billSnap = await tx.get(billRef);
      if (!billSnap.exists) throw new Error("Bill not found.");
      const bill = billSnap.data() as {
        status: string;
        customerId: string;
        startDate: string;
        endDate: string;
        lineItems: unknown[];
      };

      if (bill.status !== "draft") {
        throw new Error("Only a draft bill can be finalized.");
      }
      if (!Array.isArray(bill.lineItems) || bill.lineItems.length === 0) {
        throw new Error("Add at least one line item before finalizing.");
      }

      const customerRef = db.collection("customers").doc(bill.customerId);
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) throw new Error("Customer not found.");
      const customer = customerSnap.data() as { balance?: number };

      const year = new Date().getUTCFullYear();
      const counterRef = db.collection("counters").doc(String(year));
      const counterSnap = await tx.get(counterRef);
      const nextNumber = ((counterSnap.data()?.lastNumber as number | undefined) ?? 0) + 1;
      const billNumber = `BK-${year}-${String(nextNumber).padStart(4, "0")}`;

      const now = new Date().toISOString();
      const days = calculateDays(bill.startDate, bill.endDate);
      const lineItems = (
        bill.lineItems as Array<{
          billingType: "milk" | "simple";
          rate: number;
          dailyQty?: number;
          extra?: number;
          less?: number;
          quantity?: number;
        }>
      ).map((line) => ({ ...line, ...calculateLineTotals(line, days) }));
      const subtotal = calculateSubtotal(lineItems.map((line) => line.lineTotal));
      const previousBalance = customer.balance ?? 0;
      const totalPayable = Math.round((subtotal + previousBalance) * 100) / 100;

      tx.set(counterRef, { lastNumber: nextNumber }, { merge: true });

      tx.set(db.collection("customerLedgerTransactions").doc(), {
        customerId: bill.customerId,
        type: "bill",
        direction: "debit",
        amount: subtotal,
        note: `Bill ${billNumber}`,
        billId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(customerRef, {
        balance: FieldValue.increment(subtotal),
        updatedAt: now,
      });

      tx.update(billRef, {
        status: "finalized",
        billNumber,
        days,
        lineItems,
        subtotal,
        previousBalance,
        totalPayable,
        finalizedAt: now,
        finalizedBy: { uid: session.uid, email: session.email },
        updatedAt: now,
      });

      return { customerId: bill.customerId, subtotal };
    });
    await syncPostgresBalance(finalized.customerId, finalized.subtotal);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to finalize bill.",
    };
  }
}

const voidSchema = z.object({
  billId: z.string().min(1),
  reason: z.string().min(1).max(500),
  createReplacement: z.boolean().optional(),
});

/**
 * Voids a finalized bill: never deletes it, never edits its recorded
 * amounts. Instead records a reversing ledger credit (the original debit
 * stays in history) and updates the cached balance, atomically. Optionally
 * creates a linked replacement draft in the same transaction — creating it
 * outside this transaction would race against another read of the
 * just-voided bill.
 */
export async function voidBill(input: {
  billId: string;
  reason: string;
  createReplacement?: boolean;
}): Promise<ActionResult & { replacementBillId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { billId, reason, createReplacement } = parsed.data;

  const db = getAdminDb();
  const billRef = db.collection("bills").doc(billId);
  const replacementRef = db.collection("bills").doc();
  let replacementBillId: string | undefined;
  let voidedCustomerId: string | undefined;
  let voidedSubtotal: number | undefined;

  try {
    await db.runTransaction(async (tx) => {
      const billSnap = await tx.get(billRef);
      if (!billSnap.exists) throw new Error("Bill not found.");
      const bill = billSnap.data() as {
        status: string;
        customerId: string;
        billNumber: string;
        subtotal: number;
        startDate: string;
        endDate: string;
        days: number;
        lineItems: unknown[];
        note: string | null;
      };

      if (bill.status !== "finalized") {
        throw new Error("Only a finalized bill can be voided.");
      }

      const customerRef = db.collection("customers").doc(bill.customerId);
      const now = new Date().toISOString();
      voidedCustomerId = bill.customerId;
      voidedSubtotal = bill.subtotal;

      tx.set(db.collection("customerLedgerTransactions").doc(), {
        customerId: bill.customerId,
        type: "bill_void",
        direction: "credit",
        amount: bill.subtotal,
        note: `Void of bill ${bill.billNumber}: ${reason}`,
        billId,
        createdAt: now,
        createdBy: { uid: session.uid, email: session.email },
      });

      tx.update(customerRef, {
        balance: FieldValue.increment(-bill.subtotal),
        updatedAt: now,
      });

      const billUpdate: Record<string, unknown> = {
        status: "void",
        voidedAt: now,
        voidedBy: { uid: session.uid, email: session.email },
        voidReason: reason,
        updatedAt: now,
      };

      if (createReplacement) {
        replacementBillId = replacementRef.id;
        billUpdate.replacedByBillId = replacementBillId;

        tx.set(replacementRef, {
          customerId: bill.customerId,
          billNumber: null,
          status: "draft",
          startDate: bill.startDate,
          endDate: bill.endDate,
          days: bill.days,
          lineItems: bill.lineItems,
          subtotal: bill.subtotal,
          previousBalance: null,
          totalPayable: null,
          amountPaid: 0,
          note: bill.note ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: session.uid,
          finalizedAt: null,
          finalizedBy: null,
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          replacesBillId: billId,
          replacedByBillId: null,
        });
      }

      tx.update(billRef, billUpdate);
    });
    if (voidedCustomerId !== undefined && voidedSubtotal !== undefined) {
      await syncPostgresBalance(voidedCustomerId, -voidedSubtotal);
    }
    return { ok: true, replacementBillId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to void bill.",
    };
  }
}
