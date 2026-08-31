import type { EmployeeLedgerTransaction } from "./employee";

/**
 * A generated, immutable snapshot over a date range — not a second ledger.
 * Mirrors SupplierStatement exactly (see src/types/supplier-statement.ts).
 */
export type EmployeeStatement = {
  id: string;
  employeeId: string;
  employeeName: string; // snapshot, in case the employee is later renamed/archived
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  openingBalance: number;
  closingBalance: number;
  /** Snapshot of every ledger transaction in [startDate, endDate], oldest first. */
  transactions: EmployeeLedgerTransaction[];
  createdAt: string;
  createdBy: { uid: string; email: string | null };
};
