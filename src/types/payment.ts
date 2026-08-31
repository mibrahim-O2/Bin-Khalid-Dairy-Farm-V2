export type CustomerPayment = {
  id: string;
  customerId: string;
  amount: number;
  method: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { uid: string; email: string | null };
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
