# Backup & Export Strategy

Two layers, per Phase 10 (`docs/PHASES.md`): Supabase's own automatic
backups as the primary safety net, plus an on-demand manual export for
moments that call for a backup *right now*.

## 1. Supabase automatic backups (primary)

Supabase backs up the Postgres database automatically. Exact retention
depends on the project's plan:

- **Free tier**: daily backups, retained for a few days (check the current
  limit in the dashboard — it has changed between Supabase plan revisions).
- **Pro tier and above**: longer retention, and Point-in-Time Recovery
  (PITR) is available as an add-on, letting you restore to any moment, not
  just a daily snapshot.

**Action for the Owner:** open the Supabase dashboard → the project →
**Database → Backups**, confirm what's actually enabled, and note the
retention window. If the business's financial history matters for more
than a few days back (it does), it's worth checking whether the current
plan's retention is actually acceptable, and upgrading if not — this is a
business decision, not a code change, which is why it's flagged here
rather than done automatically.

## 2. Manual export (supplementary)

`scripts/backup-database.mjs` — a full logical export of every table to
JSON, one file per table, in a timestamped folder. No extra dependencies
(doesn't need the `pg_dump` binary installed), so it runs anywhere this
project's other `scripts/*.mjs` tools already run.

```
node scripts/backup-database.mjs
# or with a specific destination:
node scripts/backup-database.mjs D:\backups\2026-09-02
```

Output is gitignored (`/backups`) — it contains real customer/financial
data and must never be committed or shared casually.

**When to run it:**
- Before any schema migration (`drizzle-kit push`/`migrate`).
- Before a bulk data fix or a one-off script that writes to production
  (the same category of caution already used throughout this project's
  Settings/test-data work).
- Right before the Vercel production cutover, as a clean pre-launch
  snapshot.
- Periodically if you want an extra copy outside Supabase's own retention
  window (e.g., monthly, kept somewhere separate like a personal drive).

**Restoring from one of these exports** is a manual, table-by-table
`INSERT` job (there's no one-command restore script) — treat it as a
last-resort reference for recovering specific rows, not a point-and-click
disaster-recovery tool. For an actual full-database restore, Supabase's
own backup/PITR system (above) is the real mechanism.

## 3. CSV export (already built, Phase 9)

For day-to-day "I just want this in Excel" needs — not a backup — the
Reports page (`/dashboard/reports`) already exports customers, suppliers,
and employees to CSV on demand. That's a reporting feature, not part of
the disaster-recovery story above.
