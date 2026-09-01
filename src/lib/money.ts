/**
 * Every money column in the Postgres schema is `numeric(12, 2)` — exact
 * decimal storage, unlike Firestore's floating-point numbers. The
 * trade-off: `node-postgres`/`postgres.js` return `numeric` values as
 * STRINGS by default, to avoid silently losing precision by coercing
 * through JS floating point on the way out. Every read of a money column
 * must go through this helper — never trust `numeric` fields to already
 * be numbers just because the TypeScript type says so at the call site.
 *
 * (Writes are the easy direction: passing a plain JS number into a
 * `numeric` column is safe — Postgres casts it on the way in. This helper
 * is a read-side concern only.)
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
