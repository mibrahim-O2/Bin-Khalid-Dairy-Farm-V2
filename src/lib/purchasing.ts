// Pure calculation functions — no client/server-only dependencies — used
// identically on the client (live preview while editing a draft purchase)
// and on the server (authoritative recompute at finalize, which never
// trusts client-submitted totals). Mirrors src/lib/billing.ts, but a
// farm-supply purchase line is always simple Quantity × Rate — there's no
// milk-style daily/extra/less calculation on the supplier side.

export type PurchaseLineInput = {
  rate: number;
  quantity: number;
};

export function calculateLineTotal(line: PurchaseLineInput): number {
  // Round to cents to avoid floating-point drift accumulating across lines.
  return Math.round(line.quantity * line.rate * 100) / 100;
}

export function calculateSubtotal(lineTotals: number[]): number {
  return Math.round(lineTotals.reduce((sum, value) => sum + value, 0) * 100) / 100;
}
