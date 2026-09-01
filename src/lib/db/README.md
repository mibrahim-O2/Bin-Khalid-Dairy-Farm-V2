# Database layer (Supabase / Postgres / Drizzle)

Migrating off Firestore — see the M0-M13 migration plan agreed with the
Owner. This directory is the Postgres side; Firebase Authentication is
untouched (session cookies, custom claims for `active`/`role`, the Owner
check) and stays in `src/lib/firebase/`.

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

`SUPABASE_SERVICE_ROLE_KEY` is not used anywhere yet — nothing in this app
goes through PostgREST/`supabase-js`. It stays in `.env.local` for when
Supabase Realtime or Storage actually get wired up (Realtime is the
tentatively-planned mechanism for a live Pending Users list in M1 — that
still needs its own RLS-for-Realtime decision when we get there, since
Realtime's `postgres_changes` delivery respects RLS the same way PostgREST
does).

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
