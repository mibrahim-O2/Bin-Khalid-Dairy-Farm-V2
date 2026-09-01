import { boolean, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  // Soft-delete flag. Suppliers are archived, never hard-deleted (unlike
  // customers, which got an explicit Owner-only exception — not extended
  // to suppliers unless separately requested).
  active: boolean("active").notNull().default(true),
  // Cached Σdebits (purchases) − Σcredits (payments) = amount farm owes.
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  hasOpeningBalance: boolean("has_opening_balance").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
}, (t) => [index("ix_suppliers_name").on(t.name)]).enableRLS();

export const farmSupplyItems = pgTable("farm_supply_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  defaultRate: numeric("default_rate", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_farm_supply_items_active_name").on(t.active, t.name)]).enableRLS();
