import { date, index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ledgerDirectionEnum, supplierLedgerTypeEnum } from "./enums";
import { suppliers } from "./suppliers";
import { purchases } from "./purchases";

/** A "Jama" payment — money the farm pays a supplier. */
export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: text("method"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUid: text("voided_by_uid"),
    voidedByEmail: text("voided_by_email"),
    voidReason: text("void_reason"),
  },
  (t) => [index("ix_supplier_payments_supplier_created").on(t.supplierId, t.createdAt)]
).enableRLS();

/** One payment can settle parts of several purchases — FIFO, oldest first. */
export const supplierPaymentAllocations = pgTable(
  "supplier_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => supplierPayments.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_supplier_payment_allocations_payment").on(t.paymentId),
    index("ix_supplier_payment_allocations_purchase").on(t.purchaseId),
  ]
).enableRLS();

export const supplierLedgerTransactions = pgTable(
  "supplier_ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    type: supplierLedgerTypeEnum("type").notNull(),
    direction: ledgerDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    // Present on "purchase"/"purchase_void" entries.
    purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "cascade" }),
    // Present on "payment"/"payment_void" entries.
    paymentId: uuid("payment_id").references(() => supplierPayments.id, { onDelete: "cascade" }),
  },
  (t) => [index("ix_supplier_ledger_supplier_created").on(t.supplierId, t.createdAt)]
).enableRLS();

/**
 * Generated, immutable snapshot over a date range — not a second ledger.
 * `transactions` stores the frozen array of ledger rows as jsonb, same as
 * the Firestore version: it's genuinely a point-in-time blob, not live
 * data, so normalizing it into its own child table wouldn't buy anything.
 */
export const supplierStatements = pgTable(
  "supplier_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierName: text("supplier_name").notNull(), // snapshot
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull(),
    closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }).notNull(),
    transactions: jsonb("transactions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
  },
  (t) => [index("ix_supplier_statements_supplier_created").on(t.supplierId, t.createdAt)]
).enableRLS();
