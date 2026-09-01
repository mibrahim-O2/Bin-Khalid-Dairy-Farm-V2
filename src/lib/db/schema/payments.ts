import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customerLedgerTypeEnum, ledgerDirectionEnum } from "./enums";
import { customers } from "./customers";
import { bills } from "./bills";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
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
  (t) => [index("ix_payments_customer_created").on(t.customerId, t.createdAt)]
).enableRLS();

/** One payment can settle parts of several bills — FIFO, oldest first. */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_payment_allocations_payment").on(t.paymentId),
    index("ix_payment_allocations_bill").on(t.billId),
  ]
).enableRLS();

export const customerLedgerTransactions = pgTable(
  "customer_ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: customerLedgerTypeEnum("type").notNull(),
    direction: ledgerDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    // Present on "bill"/"bill_void" entries — links the ledger entry back to
    // its bill.
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    // Present on "payment"/"payment_void" entries.
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }),
  },
  (t) => [index("ix_customer_ledger_customer_created").on(t.customerId, t.createdAt)]
).enableRLS();
