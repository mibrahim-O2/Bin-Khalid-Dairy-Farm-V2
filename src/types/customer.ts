// Timestamps are stored as ISO strings (not Firestore Timestamp objects) so
// the same type works across client components, server components, and
// Server Action return values without extra serialization handling.

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  /** Often a different number than `phone` — used for the "Send via WhatsApp" bill-share button. */
  whatsappNumber: string | null;
  address: string | null;
  /** Set once at creation, never edited afterward — see the Milk Record module. yyyy-mm-dd. */
  joiningDate: string | null;
  /** Current standard daily milk quantity — freely editable, unlike joiningDate. Smart default for a new bill's Milk line item. */
  dailyMilkQty: number | null;
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

/**
 * One pause/resume period in a customer's milk delivery history — the
 * Milk Record module. Informational/tracking only; never read by billing,
 * ledger, or balance logic. `dailyMilkQtyAtPause` is a snapshot taken when
 * the pause was recorded (see schema/customers.ts's doc comment) — use it
 * for this pause's own Milk Missed figure, not the customer's current
 * daily quantity, which can have changed since.
 */
export type CustomerMilkPause = {
  id: string;
  customerId: string;
  pauseDate: string; // yyyy-mm-dd
  resumeDate: string | null; // yyyy-mm-dd — null while still paused
  dailyMilkQtyAtPause: number | null;
  /** Null = full stop. Set = customer reduced to this quantity instead of stopping entirely. */
  reducedDailyQty: number | null;
  createdAt: string;
  createdBy: string;
};

/**
 * One date a customer took extra milk beyond their standard quantity — the
 * Milk Record module. Feeds a new bill's "Extra Milk Added" smart default
 * when the bill's period overlaps `date`.
 */
export type CustomerExtraMilk = {
  id: string;
  customerId: string;
  date: string; // yyyy-mm-dd
  quantity: number;
  note: string | null;
  createdAt: string;
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
  type: "opening_balance" | "bill" | "bill_void" | "payment" | "payment_void"; // more types added later (adjustment)
  direction: CustomerLedgerDirection;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: { uid: string; email: string | null };
  /** Present on "bill"/"bill_void" entries — links the ledger entry back to its bill. */
  billId?: string;
  /** Present on "payment"/"payment_void" entries — links the ledger entry back to its payment record. */
  paymentId?: string;
};
