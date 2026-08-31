export type SupplierPaymentActor = { uid: string; email: string | null };

/** A "Jama" payment — money the farm pays a supplier. */
export type SupplierPayment = {
  id: string;
  supplierId: string;
  amount: number;
  method: string | null;
  note: string | null;
  createdAt: string;
  createdBy: SupplierPaymentActor;
  voidedAt: string | null;
  voidedBy: SupplierPaymentActor | null;
  voidReason: string | null;
};

/** One payment can settle parts of several purchases — FIFO, oldest first. */
export type SupplierPaymentAllocation = {
  id: string;
  paymentId: string;
  purchaseId: string;
  supplierId: string;
  amount: number;
  createdAt: string;
};
