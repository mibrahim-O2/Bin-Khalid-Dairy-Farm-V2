// Timestamps are stored as ISO strings (not Firestore Timestamp objects) so
// the same type works across client components, server components, and
// Server Action return values without extra serialization handling.

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  /** Soft-delete flag. Customers are archived, never hard-deleted. */
  active: boolean;
  /** Cached Σdebits − Σcredits. Only ever written inside the same server-side
   *  transaction as the ledger entry that changed it — never edited directly. */
  balance: number;
  hasOpeningBalance: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type ProductBillingType = "milk" | "simple";

export type Product = {
  id: string;
  name: string;
  unit: string;
  billingType: ProductBillingType;
  /** Reference rate shown when a customer has no rate of their own set yet. */
  defaultRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRate = {
  /** `${customerId}_${productId}` */
  id: string;
  customerId: string;
  productId: string;
  rate: number;
  updatedAt: string;
  updatedBy: string;
};

export type CustomerRateHistoryEntry = {
  id: string;
  rate: number;
  /** When this rate stopped being in effect (i.e. when it was replaced). */
  supersededAt: string;
  updatedBy: string;
};

export type CustomerLedgerDirection = "debit" | "credit";

export type CustomerLedgerTransaction = {
  id: string;
  customerId: string;
  type: "opening_balance"; // more types added in Phase 4/5 (bill, payment, adjustment, void)
  direction: CustomerLedgerDirection;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: { uid: string; email: string | null };
};
