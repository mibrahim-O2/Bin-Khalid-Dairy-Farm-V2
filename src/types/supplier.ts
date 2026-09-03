export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  /** Often a different number than `phone` — used for the "Send via WhatsApp" statement-share button. */
  whatsappNumber: string | null;
  address: string | null;
  /** Soft-delete flag. Suppliers are archived, never hard-deleted (unlike
   *  customers, which got an explicit Owner-only exception — not extended
   *  to suppliers unless separately requested). */
  active: boolean;
  /** Cached Σdebits (purchases) − Σcredits (payments) = amount farm owes. */
  balance: number;
  hasOpeningBalance: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type FarmSupplyItem = {
  id: string;
  name: string;
  unit: string;
  defaultRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierLedgerDirection = "debit" | "credit";

export type SupplierLedgerTransaction = {
  id: string;
  supplierId: string;
  type: "opening_balance" | "purchase" | "purchase_void" | "payment" | "payment_void";
  direction: SupplierLedgerDirection;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: { uid: string; email: string | null };
  /** Present on "purchase"/"purchase_void" entries. */
  purchaseId?: string;
  /** Present on "payment"/"payment_void" entries. */
  paymentId?: string;
};
