export type Employee = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  /** Soft-delete flag. Employees are archived, never hard-deleted. */
  active: boolean;
  /** Cached Σcredits (salary accrued) − Σdebits (advances/payments taken) —
   *  sign convention is REVERSED vs customers/suppliers, see
   *  SYSTEM_ARCHITECTURE.md §4 Domain C. Positive = farm still owes the
   *  employee salary; negative = the employee has taken an advance against
   *  future salary. Only ever written inside the same server-side
   *  transaction as the ledger entry that changed it — never edited
   *  directly. */
  balance: number;
  hasOpeningBalance: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

/**
 * Who an advance/payment was "given by" — a farm-managed list (Settings,
 * eventually) rather than a hardcoded set of names. Non-financial master
 * data, same trust level as farm supply items/products.
 */
export type AuthorizedPerson = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeLedgerDirection = "debit" | "credit";

export type EmployeeLedgerTransaction = {
  id: string;
  employeeId: string;
  type: "opening_balance" | "salary_accrual" | "salary_accrual_void" | "payment" | "payment_void";
  /** Reversed meaning vs customers/suppliers: credit = salary accrued (farm
   *  owes more), debit = advance/payment taken (farm owes less). */
  direction: EmployeeLedgerDirection;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: { uid: string; email: string | null };
  /** Present on "salary_accrual"/"salary_accrual_void" entries. */
  accrualId?: string;
  /** Present on "payment"/"payment_void" entries. */
  paymentId?: string;
};
