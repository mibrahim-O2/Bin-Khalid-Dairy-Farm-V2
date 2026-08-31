import { addDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Creates an empty draft bill and returns its id. Shared by the Bills list
 * and the Ledger page — both offer a "New bill" entry point, so this lives
 * in one place rather than being duplicated.
 */
export async function createDraftBill(customerId: string, userId: string): Promise<string> {
  const db = getFirebaseDb();
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, "bills"), {
    customerId,
    billNumber: null,
    status: "draft",
    startDate: firstOfMonthIso(),
    endDate: todayIso(),
    days: 0,
    lineItems: [],
    subtotal: 0,
    previousBalance: null,
    totalPayable: null,
    amountPaid: 0,
    note: null,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    finalizedAt: null,
    finalizedBy: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    replacesBillId: null,
    replacedByBillId: null,
  });
  return ref.id;
}
