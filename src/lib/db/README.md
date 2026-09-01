# Database layer (Supabase / Postgres / Drizzle)

Migration off Firestore is complete (M0-M13). Every domain — Customers,
Products/Rates, Bills, Suppliers, Farm Supply Items, Purchases, Employees,
Salary History/Accruals, all three domains' Payments/Ledgers/Statements,
plus Users/Pending-Users/activity_logs — now lives entirely in Postgres.
Firebase Authentication is untouched (session cookies, custom claims for
`active`/`role`, the Owner check) and is the only thing still in
`src/lib/firebase/`; nothing in the app reads or writes Firestore data
anymore (`firestore.rules` is deny-all, kept only so a `firebase deploy`
never accidentally reopens a stale collection).

**Mid-migration simplification, M3 onward**: the plan originally called for
a per-domain backfill script plus a transitional Firestore↔Postgres
dual-write bridge while each domain migrated one piece at a time. Partway
through (after M2), the Owner confirmed all existing Firestore data was
disposable test/dev data, not real business data — so from M3 onward the
migration skipped backfills and bridges entirely: each domain was built
fresh on empty Postgres tables and cut over directly, accepting brief,
explicitly-documented interim gaps (e.g. bills moved to Postgres in M3
while customer payments stayed on Firestore until M4) rather than
maintaining bidirectional sync. M2's bridge (already built) was then
removed retroactively. This is why some git history/comments from M2-M3
mention backfill scripts or bridges that later migrations didn't need.

## Trust boundary

Every write, financial or not, goes through a Next.js Server Action —
there is no direct-client-write tier the way Firestore rules allowed for
non-financial master data. One trust boundary, not two: simpler to reason
about, and it was the deliberate trade the Owner approved over wiring
Firebase as a recognized JWT issuer for Supabase Row Level Security.

**How this actually reaches Postgres**: `getDb()` (`client.ts`) connects
directly over `DATABASE_URL` — Supabase's transaction-pooler connection
string, authenticating as the `postgres` role, which **owns** every table
this schema creates. Table owners bypass RLS unconditionally, by Postgres
design — so from this app's own code, RLS is not what's protecting these
tables. The Server Action's own `getServerSession()` check (verifying the
Firebase session cookie) is what protects them.

**What RLS is actually for here**: every table has `.enableRLS()` with
*zero* policies attached. That makes it fully inaccessible to any role
that reaches Postgres a different way — specifically, Supabase's
PostgREST API authenticated with the `anon` or `authenticated` key.
Verified directly during M0: the anon key gets `200 []` on a read and a
`401 row-level security policy` error on a write, for every table. This
app never uses that path today (no `@supabase/supabase-js` client is wired
up), but if the anon key ever leaked, or a future feature reached for
`supabase-js` without thinking this through, RLS is the backstop that
makes that a non-event instead of an open database.

`SUPABASE_SERVICE_ROLE_KEY` is not used anywhere — nothing in this app goes
through PostgREST/`supabase-js`, and that ended up true for the whole
migration, not just M0: the Pending Users page (M1) reads straight off
Firebase Auth's own user list (`getAdminAuth().listUsers()`), never
Realtime or Postgres, so the RLS-for-Realtime question this paragraph used
to flag never actually came up. The key stays in `.env.local` only in case
Supabase Realtime or Storage get wired up for some future feature.

## Money columns

Every amount is `numeric(12, 2)` — exact decimal storage, unlike
Firestore's floating-point numbers. The trade-off: `postgres.js` returns
`numeric` values as **strings**, to avoid silently losing precision by
coercing through JS floating point on the way out. Every read of a money
column must go through `src/lib/money.ts`'s `toNumber()` — verified
directly in M0 (see the schema's own smoke test in the migration commit).
Writing a plain JS number into a `numeric` column is safe; this is a
read-side concern only.

## Schema/migration workflow

- Edit the table definitions under `src/lib/db/schema/`.
- `npm run db:generate` — diffs against the last snapshot, writes a new
  SQL file under `./drizzle`. Purely offline, touches no database.
- Review the generated SQL before applying it — this is a financial
  system; a migration is not a rubber stamp.
- `npm run db:migrate` — applies pending migrations. Uses its own
  single-connection client (`scripts/db-migrate.mjs`), not `getDb()` —
  a one-shot script has no reason to hold a pool open.
- Both `getDb()` and the migration script pass `prepare: false` to
  `postgres.js` — **required** against Supabase's transaction pooler
  (port 6543 / PgBouncer in transaction mode), which does not support
  prepared statements persisting across pooled connections.

## Indexes

Postgres does not auto-index foreign-key columns (only the referenced
primary-key side is indexed automatically) — every FK column here has an
explicit index. Ledger tables additionally index `(domainId, createdAt)`:
a single B-tree serves both ascending and descending scans in Postgres,
unlike Firestore, where each direction needed its own declared composite
index — the exact gap that caused the Phase 6 statement-generation bug
(`FAILED_PRECONDITION: query requires an index`, discovered only once the
feature was live). Draft/finalized status tables (`bills`, `purchases`)
additionally index `(domainId, status, finalizedAt)` for FIFO payment
allocation, which always queries "outstanding finalized records, oldest
first."
