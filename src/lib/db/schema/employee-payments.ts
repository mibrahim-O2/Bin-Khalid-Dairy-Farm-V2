import { date, index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { employeeLedgerTypeEnum, employeePaymentSourceEnum, ledgerDirectionEnum, salaryAccrualStatusEnum } from "./enums";
import { employees } from "./employees";

/**
 * A single period's salary credited to an employee's balance — a ledger
 * credit. Simpler than a bill/purchase: no line-item draft, created
 * directly in "finalized" state, same complexity level as a payment.
 */
export const employeeSalaryAccruals = pgTable(
  "employee_salary_accruals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    status: salaryAccrualStatusEnum("status").notNull().default("finalized"),
    // Auto-filled from any resolved employeeLeaves row(s) whose
    // leaveStartDate falls inside [periodStart, periodEnd] and that
    // haven't already been consumed by another accrual (see
    // recordSalaryAccrual in employees/actions.ts) — informational display
    // only, the accrual's own `amount` above is already net of this. Set
    // once at creation and never recomputed afterward, so a later edit to
    // the underlying leave record never rewrites an already-recorded
    // accrual's figures (see SYSTEM_ARCHITECTURE.md §5 rule 5).
    leaveDaysDeducted: numeric("leave_days_deducted", { precision: 12, scale: 2 }),
    leaveAmountDeducted: numeric("leave_amount_deducted", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUid: text("voided_by_uid"),
    voidedByEmail: text("voided_by_email"),
    voidReason: text("void_reason"),
  },
  (t) => [index("ix_employee_salary_accruals_employee_created").on(t.employeeId, t.createdAt)]
).enableRLS();

/**
 * A single leave period for an employee — one row per period, so an
 * employee's full leave history over time is preserved (same
 * multiple-periods-per-entity shape as customerMilkPauses in
 * schema/customers.ts). Purely informational on its own; it only affects
 * money once its deduction is pulled into a salary accrual (see
 * recordSalaryAccrual), at which point that specific accrual is recorded
 * on `appliedToAccrualId` so it's never deducted twice.
 */
export const employeeLeaves = pgTable(
  "employee_leaves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveStartDate: date("leave_start_date").notNull(),
    // Null while still on leave — same open/resolved shape as
    // customerMilkPauses.resumeDate.
    resumeDate: date("resume_date"),
    // Monthly salary ÷ days in the calendar month `leaveStartDate` falls
    // in, snapshotted at the moment this leave was RECORDED (not resumed)
    // — see calculateDailyRate in src/lib/employee-leave.ts for the exact
    // day-count convention. Frozen from here on so a later salary change
    // never rewrites this leave's deduction figure, same snapshot
    // convention as customerMilkPauses.dailyMilkQtyAtPause.
    dailyRateAtLeave: numeric("daily_rate_at_leave", { precision: 12, scale: 2 }),
    note: text("note"),
    // Set once this leave's deduction has been pulled into a specific
    // salary accrual (see recordSalaryAccrual) — prevents the same leave
    // being deducted twice across two accrual periods. ON DELETE SET NULL
    // (not cascade): deleting that accrual should make this leave
    // available to apply again, not erase the leave record itself.
    appliedToAccrualId: uuid("applied_to_accrual_id").references(() => employeeSalaryAccruals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_employee_leaves_employee").on(t.employeeId)]
).enableRLS();

/**
 * An advance or salary payment given to an employee — a ledger debit.
 * Unlike customer/supplier payments, this is never FIFO-allocated against
 * specific accruals — an advance is taken against future, not-yet-earned
 * salary, so it just reduces the running balance directly.
 */
export const employeePayments = pgTable(
  "employee_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    source: employeePaymentSourceEnum("source").notNull(),
    // Name of the authorized person who gave it — snapshotted at the time,
    // not an FK, so a later rename/archive never changes this record.
    givenBy: text("given_by").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUid: text("voided_by_uid"),
    voidedByEmail: text("voided_by_email"),
    voidReason: text("void_reason"),
  },
  (t) => [index("ix_employee_payments_employee_created").on(t.employeeId, t.createdAt)]
).enableRLS();

export const employeeLedgerTransactions = pgTable(
  "employee_ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: employeeLedgerTypeEnum("type").notNull(),
    // Reversed meaning vs customers/suppliers: credit = salary accrued
    // (farm owes more), debit = advance/payment taken (farm owes less).
    direction: ledgerDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
    // Present on "salary_accrual"/"salary_accrual_void" entries.
    accrualId: uuid("accrual_id").references(() => employeeSalaryAccruals.id, { onDelete: "cascade" }),
    // Present on "payment"/"payment_void" entries.
    paymentId: uuid("payment_id").references(() => employeePayments.id, { onDelete: "cascade" }),
  },
  (t) => [index("ix_employee_ledger_employee_created").on(t.employeeId, t.createdAt)]
).enableRLS();

/** Generated, immutable snapshot over a date range — mirrors supplierStatements. */
export const employeeStatements = pgTable(
  "employee_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    employeeName: text("employee_name").notNull(), // snapshot
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull(),
    closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }).notNull(),
    transactions: jsonb("transactions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
    createdByEmail: text("created_by_email"),
  },
  (t) => [index("ix_employee_statements_employee_created").on(t.employeeId, t.createdAt)]
).enableRLS();
