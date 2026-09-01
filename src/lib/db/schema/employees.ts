import { boolean, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  // text, app-generated — see customers.id's comment in
  // schema/customers.ts; salary accruals/payments/ledger haven't migrated
  // off Firestore yet (M11-M12) and reference an employee by its original
  // Firestore document id in the meantime.
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  // Soft-delete flag. Employees are archived, never hard-deleted.
  active: boolean("active").notNull().default(true),
  // Cached Σcredits (salary accrued) − Σdebits (advances/payments taken) —
  // sign convention is REVERSED vs customers/suppliers, see
  // SYSTEM_ARCHITECTURE.md §4 Domain C.
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  hasOpeningBalance: boolean("has_opening_balance").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
}, (t) => [index("ix_employees_name").on(t.name)]).enableRLS();

/**
 * Who an advance/payment was "given by" — a farm-managed list rather than a
 * hardcoded set of names. Non-financial master data. Nothing references
 * this by id today (employeePayments.givenBy snapshots the name instead),
 * but kept as text for consistency with every other master-data table
 * here, in case something ever does.
 */
export const authorizedPeople = pgTable("authorized_people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_authorized_people_active_name").on(t.active, t.name)]).enableRLS();

/**
 * Effective-dated salary history — append-only, never overwritten (see
 * SYSTEM_ARCHITECTURE.md §5 rule 5).
 */
export const employeeSalaryHistory = pgTable(
  "employee_salary_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // text, not uuid — see customers.id's comment in schema/customers.ts.
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).notNull(),
    // This rate applies from this date onward, until superseded by a later entry.
    effectiveFrom: date("effective_from").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUid: text("created_by_uid"),
  },
  (t) => [index("ix_employee_salary_history_employee_effective").on(t.employeeId, t.effectiveFrom)]
).enableRLS();
