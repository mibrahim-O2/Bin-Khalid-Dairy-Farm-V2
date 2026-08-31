/**
 * Effective-dated salary history — append-only, never overwritten (see
 * SYSTEM_ARCHITECTURE.md §5 rule 5: rate/salary changes are effective-dated
 * and historized, and a later change must never alter what an
 * already-finalized record snapshotted). Non-financial master data (it
 * doesn't touch a ledger or balance by itself — only recording a salary
 * accrual against it does), same trust level as customerRates.
 */
export type EmployeeSalaryHistoryEntry = {
  id: string;
  employeeId: string;
  monthlySalary: number;
  /** yyyy-mm-dd — this rate applies from this date onward, until superseded
   *  by a later entry. */
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
  createdBy: string;
};

/** The entry with the latest effectiveFrom that is on or before `asOfDate`
 *  (defaults to today) — i.e. the salary rate actually in effect then. */
export function getCurrentSalary(
  entries: EmployeeSalaryHistoryEntry[],
  asOfDate?: string
): EmployeeSalaryHistoryEntry | null {
  const cutoff = asOfDate ?? new Date().toISOString().slice(0, 10);
  const inEffect = entries.filter((entry) => entry.effectiveFrom <= cutoff);
  if (inEffect.length === 0) return null;
  return inEffect.reduce((latest, entry) => (entry.effectiveFrom > latest.effectiveFrom ? entry : latest));
}
