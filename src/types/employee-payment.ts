export type EmployeePaymentActor = { uid: string; email: string | null };

/** Where the cash for an advance/payment physically came from. */
export type EmployeePaymentSource = "ghar" | "dukan";

/**
 * An advance or salary payment given to an employee — a ledger debit
 * (reduces what the farm owes them). Unlike customer/supplier payments,
 * this is never FIFO-allocated against specific salary accruals — an
 * advance is taken against future, not-yet-determined salary, so it just
 * reduces the running balance directly.
 */
export type EmployeePayment = {
  id: string;
  employeeId: string;
  amount: number;
  source: EmployeePaymentSource;
  /** Name of the authorized person who gave it — snapshotted at the time,
   *  so a later rename/archive of that person never changes this record. */
  givenBy: string;
  note: string | null;
  createdAt: string;
  createdBy: EmployeePaymentActor;
  voidedAt: string | null;
  voidedBy: EmployeePaymentActor | null;
  voidReason: string | null;
};
