import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Every table in this schema has RLS enabled with ZERO policies attached
// (see src/lib/db/README.md). The app's only path to Postgres is a direct
// connection (DATABASE_URL) as the table-owning role, which — like any
// table owner — bypasses RLS automatically; RLS's job is to lock out the
// *other* path in, Supabase's PostgREST API using the anon/authenticated
// key, in case that key ever leaks or gets used somewhere unintended.

/**
 * Mirrors Firebase Auth for reference/display only (e.g. a future "who is
 * this admin" lookup) — never read for authorization. Every actual
 * authorization check (getServerSession, isActiveAdmin-equivalent) reads
 * the `active`/`role` custom claims off the verified Firebase session
 * cookie directly, not this table. `uid` is the Firebase UID verbatim, not
 * a generated key, so it stays a natural join key against Firebase Auth.
 */
export const users = pgTable("users", {
  uid: text("uid").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  active: boolean("active").notNull().default(false),
  role: text("role"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedByUid: text("approved_by_uid"),
  approvedByEmail: text("approved_by_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Audit trail for owner-only destructive actions (e.g. customer deletion).
 * `details` is intentionally jsonb — the shape varies per action type
 * (e.g. a purge's per-collection counts vs. an approval's role granted),
 * same as the Firestore version's loosely-typed per-action fields.
 */
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  actorUid: text("actor_uid"),
  actorEmail: text("actor_email"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Sequential document-number counters (e.g. bill numbers BK-YYYY-NNNN) —
 * `id` is a free-form key (e.g. "customer_bills_2026") rather than a bare
 * year, matching SYSTEM_ARCHITECTURE.md's `counters/{domain}_{year}`
 * pattern so a future domain's numbering doesn't collide with an existing
 * one. Incremented inside a `SELECT ... FOR UPDATE` transaction — see the
 * M3 bill-numbering Server Action, not client code.
 */
export const counters = pgTable("counters", {
  id: text("id").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Free-form settings (Phase 9 hasn't defined a concrete shape yet for
 * business info / payment accounts / invoice notices) — jsonb keeps this
 * flexible without overcommitting to a rigid schema before it's needed.
 */
export const settings = pgTable("settings", {
  id: text("id").primaryKey(), // e.g. "business", "payments", "invoices", "system"
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedByUid: text("updated_by_uid"),
}).enableRLS();
