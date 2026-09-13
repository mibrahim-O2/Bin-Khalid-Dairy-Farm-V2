/**
 * A single leave period for an employee — one row per period, so an
 * employee's full leave history over time is preserved. Purely
 * informational on its own; it only affects money once its deduction is
 * pulled into a salary accrual (see recordSalaryAccrual in
 * employees/actions.ts), at which point `appliedToAccrualId` is set so it
 * is never deducted twice.
 */
export type EmployeeLeave = {
  id: string;
  employeeId: string;
  leaveStartDate: string; // yyyy-mm-dd
  resumeDate: string | null; // yyyy-mm-dd — null while still on leave
  /** Monthly salary ÷ days in the calendar month leaveStartDate falls in,
   *  snapshotted at record time — see calculateDailyRate in
   *  src/lib/employee-leave.ts. Null if no salary was on file yet. */
  dailyRateAtLeave: number | null;
  note: string | null;
  /** Set once this leave's deduction has been pulled into a specific
   *  salary accrual — null means it's still available to apply. */
  appliedToAccrualId: string | null;
  createdAt: string;
  createdBy: string;
};
