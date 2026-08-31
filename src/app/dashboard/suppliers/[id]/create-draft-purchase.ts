import { addDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Creates an empty draft purchase and returns its id. Shared by the
 * Purchases list and the Ledger page — both offer a "New purchase" entry
 * point, so this lives in one place rather than being duplicated.
 */
export async function createDraftPurchase(supplierId: string, userId: string): Promise<string> {
  const db = getFirebaseDb();
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, "purchases"), {
    supplierId,
    status: "draft",
    purchaseDate: todayIso(),
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
    replacesPurchaseId: null,
    replacedByPurchaseId: null,
  });
  return ref.id;
}
