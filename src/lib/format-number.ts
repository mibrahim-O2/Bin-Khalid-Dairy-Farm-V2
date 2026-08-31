/**
 * Formats a number with comma thousands separators — e.g. 12500 -> "12,500",
 * -1500.5 -> "-1,500.5". Deterministic on server and client: unlike
 * `Number.prototype.toLocaleString()` (which formats according to the
 * runtime's default locale — comma vs period grouping/decimal separators
 * differ by locale — and can cause the same class of hydration mismatch as
 * locale-dependent date formatting), this never touches `Intl` or any
 * `toLocale*` method, so the separators can't vary between server and
 * client.
 */
export function formatAmount(value: number): string {
  const isNegative = value < 0;
  const [intPart, decPart] = Math.abs(value).toFixed(2).split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = decPart === "00" ? "" : `.${decPart}`;
  return `${isNegative ? "-" : ""}${withCommas}${decimals}`;
}
