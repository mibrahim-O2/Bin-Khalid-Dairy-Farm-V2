import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { billStatusEnum, productBillingTypeEnum } from "./enums";
import { customers, products } from "./customers";

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    // Unique when present; Postgres allows multiple NULLs under a unique
    // constraint, so drafts (billNumber not yet assigned) are unaffected.
    billNumber: text("bill_number").unique(),
    status: billStatusEnum("status").notNull().default("draft"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    days: integer("days").notNull().default(0),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    // Snapshot of the customer's ledger balance at finalize time — display only.
    previousBalance: numeric("previous_balance", { precision: 12, scale: 2 }),
    // Snapshot of subtotal + previousBalance at finalize time — display only.
    totalPayable: numeric("total_payable", { precision: 12, scale: 2 }),
    // Cumulative amount allocated from payments.
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
    replacesBillId: uuid("replaces_bill_id").references((): AnyPgColumn => bills.id),
    replacedByBillId: uuid("replaced_by_bill_id").references((): AnyPgColumn => bills.id),
  },
  (t) => [
    // Bills-list query (customerId ==, orderBy createdAt desc) — a single
    // B-tree on (customerId, createdAt) serves both ASC and DESC scans in
    // Postgres, unlike Firestore where each direction needed its own
    // declared composite index (the exact gap that caused the Phase 6
    // statement-generation bug).
    index("ix_bills_customer_created").on(t.customerId, t.createdAt),
    // FIFO payment allocation: outstanding finalized bills, oldest first.
    index("ix_bills_customer_status_finalized").on(t.customerId, t.status, t.finalizedAt),
  ]
).enableRLS();

/**
 * Normalizes what was an embedded array on the Firestore bill doc into a
 * real child table. `sortOrder` preserves the line-item order the admin
 * entered them in — Postgres has no equivalent of "array position" to fall
 * back on the way the Firestore array did implicitly.
 */
export const billLineItems = pgTable(
  "bill_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    // Snapshots — never re-derived from the live product doc later.
    productName: text("product_name").notNull(),
    unit: text("unit").notNull(),
    billingType: productBillingTypeEnum("billing_type").notNull(),
    rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
    dailyQty: numeric("daily_qty", { precision: 12, scale: 2 }),
    extra: numeric("extra", { precision: 12, scale: 2 }),
    less: numeric("less", { precision: 12, scale: 2 }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }),
    totalQty: numeric("total_qty", { precision: 12, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ix_bill_line_items_bill").on(t.billId)]
).enableRLS();
