export type SalaryAccrualActor = { uid: string; email: string | null };

export type SalaryAccrualStatus = "finalized" | "void";

/**
 * A single period's salary credited to an employee's balance — a ledger
 * credit (increases what the farm owes them). Simpler than a bill/purchase:
 * there's no line-item draft to edit, so this is created directly in
 * "finalized" state by one Server Action call (like a payment), snapshotting
 * whatever amount was entered (normally pre-filled from the employee's
 * currently effective salary, per SYSTEM_ARCHITECTURE.md §5 rule 5, but
 * adjustable for a partial month/bonus).
 */
export type EmployeeSalaryAccrual = {
  id: string;
  employeeId: string;
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
  amount: number;
  note: string | null;
  status: SalaryAccrualStatus;
  /** Auto-filled from any resolved leave(s) applied to this accrual at the
   *  time it was recorded — see recordSalaryAccrual. Null when no leave
   *  applied. Frozen once set; never recomputed by a later edit. */
  leaveDaysDeducted: number | null;
  leaveAmountDeducted: number | null;
  createdAt: string;
  createdBy: SalaryAccrualActor;
  voidedAt: string | null;
  voidedBy: SalaryAccrualActor | null;
  voidReason: string | null;
};
