export type PurchaseLineItem = {
  itemId: string;
  /** Snapshots — never re-derived from the live farm supply item doc later. */
  itemName: string;
  unit: string;
  rate: number;
  quantity: number;
  /** Computed (server-recomputed at finalize time — never trusted from the client). */
  lineTotal: number;
};

export type PurchaseStatus = "draft" | "finalized" | "void";

export type PurchaseActor = { uid: string; email: string | null };

export type Purchase = {
  id: string;
  supplierId: string;
  status: PurchaseStatus;
  /** A purchase is a point-in-time event, not a billing period. */
  purchaseDate: string; // yyyy-mm-dd
  lineItems: PurchaseLineItem[];
  subtotal: number;
  /** Snapshot of the supplier's ledger balance at finalize time — display only. */
  previousBalance: number | null;
  /** Snapshot of subtotal + previousBalance at finalize time — display only. */
  totalPayable: number | null;
  /** Cumulative amount allocated from Jama payments — see getPurchasePaymentStatus(). */
  amountPaid: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  finalizedAt: string | null;
  finalizedBy: PurchaseActor | null;
  voidedAt: string | null;
  voidedBy: PurchaseActor | null;
  voidReason: string | null;
  replacesPurchaseId: string | null;
  replacedByPurchaseId: string | null;
};

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";

/** Only meaningful for a finalized purchase — always derived, never stored. */
export function getPurchasePaymentStatus(
  purchase: Pick<Purchase, "subtotal" | "amountPaid">
): PurchasePaymentStatus {
  const amountPaid = purchase.amountPaid ?? 0;
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= purchase.subtotal) return "paid";
  return "partial";
}
