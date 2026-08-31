export type BillLineItem = {
  productId: string;
  /** Snapshots — never re-derived from the live product/rate doc later. */
  productName: string;
  unit: string;
  billingType: "milk" | "simple";
  rate: number;
  // Milk-only inputs:
  dailyQty?: number;
  extra?: number;
  less?: number;
  // Simple-only input:
  quantity?: number;
  // Computed (server-recomputed at finalize time — never trusted from the client):
  totalQty: number;
  lineTotal: number;
};

export type BillStatus = "draft" | "finalized" | "void";

export type BillActor = { uid: string; email: string | null };

export type Bill = {
  id: string;
  customerId: string;
  /** Assigned only at finalize, via the transactional counter. Format BK-YYYY-NNNN. */
  billNumber: string | null;
  status: BillStatus;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  days: number;
  lineItems: BillLineItem[];
  subtotal: number;
  /** Snapshot of the customer's ledger balance at finalize time — display only. */
  previousBalance: number | null;
  /** Snapshot of subtotal + previousBalance at finalize time — display only. */
  totalPayable: number | null;
  /**
   * Cumulative amount allocated to this bill from payments (FIFO across a
   * customer's outstanding finalized bills, oldest first) — written only
   * inside the same Server Action transaction as the payment's ledger
   * entry. Payment status is always derived from this, never stored
   * separately — see getBillPaymentStatus().
   */
  amountPaid: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  finalizedAt: string | null;
  finalizedBy: BillActor | null;
  voidedAt: string | null;
  voidedBy: BillActor | null;
  voidReason: string | null;
  replacesBillId: string | null;
  replacedByBillId: string | null;
};

export type BillPaymentStatus = "unpaid" | "partial" | "paid";

/** Only meaningful for a finalized bill — always derived, never stored. */
export function getBillPaymentStatus(bill: Pick<Bill, "subtotal" | "amountPaid">): BillPaymentStatus {
  if (bill.amountPaid <= 0) return "unpaid";
  if (bill.amountPaid >= bill.subtotal) return "paid";
  return "partial";
}
