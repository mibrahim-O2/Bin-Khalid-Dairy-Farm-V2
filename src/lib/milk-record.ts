// Pure calculation functions for the Milk Record module — shared between
// the module's own display (milk-record-table.tsx) and the bill-editor
// auto-fill Server Action, so both compute "days missed" and "milk
// missed" identically. No client/server-only dependencies, same pattern
// as src/lib/billing.ts.

/** Whole days between pauseDate and resumeDate — the resume day itself is
 *  when service restarts, so it isn't counted as a missed day. */
export function calculateDaysMissed(pauseDate: string, resumeDate: string): number {
  const start = new Date(`${pauseDate}T00:00:00Z`).getTime();
  const end = new Date(`${resumeDate}T00:00:00Z`).getTime();
  return Math.max(Math.round((end - start) / (24 * 60 * 60 * 1000)), 0);
}

/**
 * Milk missed for one pause period. `reducedDailyQty` null means a full
 * stop (the whole daily quantity was missed each day); set means the
 * customer only reduced their quantity, so only the DIFFERENCE was
 * missed (e.g. 3L/day down to 1L/day misses 2L/day, not 3L/day).
 */
export function calculateMilkMissed(
  dailyMilkQtyAtPause: number | null,
  reducedDailyQty: number | null,
  daysMissed: number
): number {
  if (dailyMilkQtyAtPause === null) return 0;
  const missedPerDay =
    reducedDailyQty !== null ? Math.max(dailyMilkQtyAtPause - reducedDailyQty, 0) : dailyMilkQtyAtPause;
  return Math.round(missedPerDay * daysMissed * 100) / 100;
}
