// Pure calculation functions — no client/server-only dependencies — used
// identically on the client (live preview while editing a draft) and on the
// server (authoritative recompute inside the finalize Server Action, which
// never trusts client-submitted totals). See SYSTEM_ARCHITECTURE.md §8.

export type BillingLineInput = {
  billingType: "milk" | "simple";
  rate: number;
  dailyQty?: number;
  extra?: number;
  less?: number;
  quantity?: number;
};

/** Days = (endDate − startDate + 1), auto-calculated — never manually typed. */
export function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}

/**
 * Milk: Total = (Daily × Days) + Extra − Less; Amount = Total × Rate.
 * Everything else: Total = Quantity; Amount = Quantity × Rate.
 */
export function calculateLineTotals(
  line: BillingLineInput,
  days: number
): { totalQty: number; lineTotal: number } {
  const totalQty =
    line.billingType === "milk"
      ? (line.dailyQty ?? 0) * days + (line.extra ?? 0) - (line.less ?? 0)
      : (line.quantity ?? 0);

  // Round to cents to avoid floating-point drift accumulating across lines.
  const lineTotal = Math.round(totalQty * line.rate * 100) / 100;

  return { totalQty, lineTotal };
}

export function calculateSubtotal(lineTotals: number[]): number {
  return Math.round(lineTotals.reduce((sum, value) => sum + value, 0) * 100) / 100;
}
