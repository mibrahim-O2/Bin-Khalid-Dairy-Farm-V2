import { boolean, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { productBillingTypeEnum } from "./enums";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
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
  id: uuid("id").primaryKey().defaultRandom(),
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
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
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
