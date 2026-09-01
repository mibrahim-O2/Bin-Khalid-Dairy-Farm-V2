import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { purchaseStatusEnum } from "./enums";
import { suppliers, farmSupplyItems } from "./suppliers";

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    status: purchaseStatusEnum("status").notNull().default("draft"),
    // A purchase is a point-in-time event, not a billing period.
    purchaseDate: date("purchase_date").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    // Snapshot of the supplier's ledger balance at finalize time — display only.
    previousBalance: numeric("previous_balance", { precision: 12, scale: 2 }),
    // Snapshot of subtotal + previousBalance at finalize time — display only.
    totalPayable: numeric("total_payable", { precision: 12, scale: 2 }),
    // Cumulative amount allocated from Jama payments.
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedByUid: text("finalized_by_uid"),
    finalizedByEmail: text("finalized_by_email"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUid: text("voided_by_uid"),
    voidedByEmail: text("voided_by_email"),
    voidReason: text("void_reason"),
    replacesPurchaseId: uuid("replaces_purchase_id").references((): AnyPgColumn => purchases.id),
    replacedByPurchaseId: uuid("replaced_by_purchase_id").references((): AnyPgColumn => purchases.id),
  },
  (t) => [
    index("ix_purchases_supplier_created").on(t.supplierId, t.createdAt),
    index("ix_purchases_supplier_status_finalized").on(t.supplierId, t.status, t.finalizedAt),
  ]
).enableRLS();

export const purchaseLineItems = pgTable(
  "purchase_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => farmSupplyItems.id),
    // Snapshots — never re-derived from the live farm supply item doc later.
    itemName: text("item_name").notNull(),
    unit: text("unit").notNull(),
    rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ix_purchase_line_items_purchase").on(t.purchaseId)]
).enableRLS();
