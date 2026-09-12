import { boolean, date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { productBillingTypeEnum } from "./enums";

export const customers = pgTable("customers", {
  // Plain text, app-generated (crypto.randomUUID() for a genuinely new
  // customer) — NOT a native `uuid` column with a Postgres-side default.
  // Bills/payments/ledger transactions haven't migrated off Firestore yet
  // (that's M3-M5) and reference a customer by its *original Firestore
  // document ID* in the meantime; backfilling this row with a fresh
  // Postgres-generated id would silently orphan every one of that
  // customer's existing Firestore records until their own migration.
  // Preserving the original id string here (whatever shape it is) keeps
  // every not-yet-migrated cross-reference working untouched throughout
  // the transition. See src/lib/db/README.md.
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  // Separate from `phone` — a customer's WhatsApp number is often a
  // different number than the one they answer calls on. Used to build the
  // wa.me link on the "Send via WhatsApp" bill-share button; falls back to
  // not showing that button when unset (see BillEditorClient).
  whatsappNumber: text("whatsapp_number"),
  address: text("address"),
  // Set once at creation (createCustomer defaults it to today), never
  // edited afterward — see the Milk Record module
  // (src/app/dashboard/milk-record). Nullable only because existing rows
  // predate this column; migration 0004 backfills every one of them from
  // `created_at` at the time it was added.
  joiningDate: date("joining_date"),
  // The customer's current standard daily milk quantity — admin-editable
  // at any time via the same Edit Details flow as name/phone/address
  // (unlike joiningDate, this legitimately changes over time). Used as a
  // smart default for the "Daily Milk" field when adding a Milk line item
  // to a new bill (still freely editable per-bill), and as the live
  // "Daily Milk Quantity" column in the Milk Record module.
  dailyMilkQty: numeric("daily_milk_qty", { precision: 12, scale: 2 }),
  // Soft-delete flag. Customers are archived, never hard-deleted (the
  // Owner-only full-purge delete is a separate, deliberate exception — see
  // the M5 delete-customer Server Action, not this flag).
  active: boolean("active").notNull().default(true),
  // Cached Σdebits − Σcredits. Only ever written inside the same
  // transaction as the ledger entry that changed it — never edited
  // directly. Numeric(12,2), not float — see src/lib/money.ts for the
  // read-side string->number conversion every money column needs.
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  hasOpeningBalance: boolean("has_opening_balance").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
}, (t) => [index("ix_customers_name").on(t.name)]).enableRLS();

export const products = pgTable("products", {
  // Same reasoning as customers.id — bill line items on Firestore reference
  // a product by its original document id until M3 migrates bills.
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  billingType: productBillingTypeEnum("billing_type").notNull(),
  // Reference rate shown when a customer has no rate of their own set yet.
  defaultRate: numeric("default_rate", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_products_active_name").on(t.active, t.name)]).enableRLS();

export const customerRates = pgTable(
  "customer_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUid: text("updated_by_uid"),
  },
  (t) => [
    unique().on(t.customerId, t.productId),
    index("ix_customer_rates_customer").on(t.customerId),
    index("ix_customer_rates_product").on(t.productId),
  ]
).enableRLS();

/**
 * Append-only — a rate change moves the outgoing rate here before
 * overwriting `customerRates.rate`, never edited afterward. A later rate
 * change must never alter what an already-finalized bill snapshotted
 * (SYSTEM_ARCHITECTURE.md §5 rule 5).
 */
export const customerRateHistory = pgTable("customer_rate_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerRateId: uuid("customer_rate_id")
    .notNull()
    .references(() => customerRates.id, { onDelete: "cascade" }),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  // When this rate stopped being in effect (i.e. when it was replaced).
  supersededAt: timestamp("superseded_at", { withTimezone: true }).notNull(),
  updatedByUid: text("updated_by_uid"),
}, (t) => [index("ix_customer_rate_history_rate").on(t.customerRateId)]).enableRLS();

/**
 * One row per pause/resume period for a customer's milk delivery — the
 * Milk Record module (src/app/dashboard/milk-record). Purely
 * informational/tracking: never read by any billing, ledger, or balance
 * calculation. Supports the customer's full history, not just the latest
 * period — a customer can have many rows here over time.
 *
 * `dailyMilkQtyAtPause` is a SNAPSHOT taken when the pause is recorded
 * (sourced from the customer's most recent finalized milk bill line item
 * at that moment), not a live lookup — matching this app's snapshot-
 * everywhere convention (bill line items, customer rate history, ...) so
 * a later change to the customer's billed quantity never retroactively
 * changes what a past pause's "Milk Missed" figure was calculated from.
 */
export const customerMilkPauses = pgTable("customer_milk_pauses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  pauseDate: date("pause_date").notNull(),
  // Null while the customer is still paused — filled in once they restart.
  resumeDate: date("resume_date"),
  dailyMilkQtyAtPause: numeric("daily_milk_qty_at_pause", { precision: 12, scale: 2 }),
  // Null means a full stop (Milk Missed = dailyMilkQtyAtPause × days). Set
  // when the customer didn't fully stop — e.g. reduced from 3L/day to
  // 1L/day — in which case Milk Missed is the DIFFERENCE
  // (dailyMilkQtyAtPause − reducedDailyQty) × days, not the full amount.
  reducedDailyQty: numeric("reduced_daily_qty", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_customer_milk_pauses_customer").on(t.customerId)]).enableRLS();

/**
 * One row per date a customer took extra milk beyond their standard daily
 * quantity — the Milk Record module. Purely informational, same as
 * customerMilkPauses, EXCEPT it also feeds a smart default: when a new
 * bill's period overlaps one of these dates, its quantity is summed into
 * that bill's "Extra Milk Added" field (still freely editable per-bill).
 */
export const customerExtraMilk = pgTable("customer_extra_milk", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
}, (t) => [index("ix_customer_extra_milk_customer").on(t.customerId)]).enableRLS();
