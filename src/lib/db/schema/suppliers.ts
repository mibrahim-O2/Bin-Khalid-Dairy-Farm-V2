import { boolean, index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const suppliers = pgTable("suppliers", {
  // text, app-generated — see customers.id's comment in
  // schema/customers.ts; purchases/supplier ledger haven't migrated off
  // Firestore yet (M7-M9) and reference a supplier by its original
  // Firestore document id in the meantime.
  id: text("id").primaryKey(),
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
  // text, app-generated — same reasoning as suppliers.id: purchase line
  // items on Firestore reference an item by its original document id
  // until M8 migrates purchases.
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  defaultRate: numeric("default_rate", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_farm_supply_items_active_name").on(t.active, t.name)]).enableRLS();
