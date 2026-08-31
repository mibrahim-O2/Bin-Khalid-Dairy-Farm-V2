export type PaymentActor = { uid: string; email: string | null };

export type CustomerPayment = {
  id: string;
  customerId: string;
  amount: number;
  method: string | null;
  note: string | null;
  createdAt: string;
  createdBy: PaymentActor;
  /** Never deleted or edited — void is recorded alongside the original, same as a bill void. */
  voidedAt: string | null;
  voidedBy: PaymentActor | null;
  voidReason: string | null;
};

/** One payment can settle parts of several bills — FIFO, oldest bill first. */
export type PaymentAllocation = {
  id: string;
  paymentId: string;
  billId: string;
  customerId: string;
  amount: number;
  createdAt: string;
};
