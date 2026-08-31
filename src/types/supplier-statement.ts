import type { SupplierLedgerTransaction } from "./supplier";

/**
 * A generated, immutable snapshot over a date range — not a second ledger.
 * The underlying purchases/payments remain the source of truth; this just
 * freezes a range of them (plus opening/closing balance) into a shareable
 * document, the same pattern as a customer bill. Never edited after
 * creation.
 */
export type SupplierStatement = {
  id: string;
  supplierId: string;
  supplierName: string; // snapshot, in case the supplier is later renamed/deleted
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  openingBalance: number;
  closingBalance: number;
  /** Snapshot of every ledger transaction in [startDate, endDate], oldest first. */
  transactions: SupplierLedgerTransaction[];
  createdAt: string;
  createdBy: { uid: string; email: string | null };
};
