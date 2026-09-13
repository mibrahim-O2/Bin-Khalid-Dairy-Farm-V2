// Pure calculation functions for the Employee Record module — shared
// between the module's own display (employee-record-table.tsx) and the
// salary-accrual auto-fill Server Action, so both compute "leave days" and
// "leave deduction" identically. No client/server-only dependencies, same
// pattern as src/lib/milk-record.ts.

/** Whole days between leaveStartDate and resumeDate — the resume day
 *  itself is when work restarts, so it isn't counted as a leave day. Same
 *  convention as calculateDaysMissed in src/lib/milk-record.ts. */
export function calculateLeaveDays(leaveStartDate: string, resumeDate: string): number {
  const start = new Date(`${leaveStartDate}T00:00:00Z`).getTime();
  const end = new Date(`${resumeDate}T00:00:00Z`).getTime();
  return Math.max(Math.round((end - start) / (24 * 60 * 60 * 1000)), 0);
}

/** Number of calendar days in the month `isoDate` (yyyy-mm-dd) falls in. */
export function daysInMonth(isoDate: string): number {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Daily-equivalent rate for a leave deduction: monthly salary ÷ the number
 * of calendar days in the month the leave STARTED in. A flat ÷30 would
 * under/over-charge short months; using each day's own month would need
 * summing per-day rates for a leave spanning a month boundary, which is
 * needless precision for what's normally a short, single-month absence —
 * so this app takes the whole leave's rate from its start month, a simple,
 * explainable convention rather than a mathematically "exact" one.
 */
export function calculateDailyRate(monthlySalary: number, leaveStartDate: string): number {
  return Math.round((monthlySalary / daysInMonth(leaveStartDate)) * 100) / 100;
}

/** Total deduction for one leave period, given its frozen daily rate. */
export function calculateLeaveDeduction(dailyRateAtLeave: number | null, leaveDays: number): number {
  if (dailyRateAtLeave === null) return 0;
  return Math.round(dailyRateAtLeave * leaveDays * 100) / 100;
}
