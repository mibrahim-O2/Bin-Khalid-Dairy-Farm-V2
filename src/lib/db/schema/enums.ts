import { pgEnum } from "drizzle-orm/pg-core";

// Shared across all three ledger domains (customers, suppliers, employees) —
// see SYSTEM_ARCHITECTURE.md §4. What direction *means* (which one
// increases the cached balance) differs per domain; the enum itself is the
// same two values everywhere.
export const ledgerDirectionEnum = pgEnum("ledger_direction", ["debit", "credit"]);

export const customerLedgerTypeEnum = pgEnum("customer_ledger_type", [
  "opening_balance",
  "bill",
  "bill_void",
  "payment",
  "payment_void",
]);

export const supplierLedgerTypeEnum = pgEnum("supplier_ledger_type", [
  "opening_balance",
  "purchase",
  "purchase_void",
  "payment",
  "payment_void",
]);

export const employeeLedgerTypeEnum = pgEnum("employee_ledger_type", [
  "opening_balance",
  "salary_accrual",
  "salary_accrual_void",
  "payment",
  "payment_void",
]);

export const billStatusEnum = pgEnum("bill_status", ["draft", "finalized", "void"]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["draft", "finalized", "void"]);
export const salaryAccrualStatusEnum = pgEnum("salary_accrual_status", ["finalized", "void"]);

export const productBillingTypeEnum = pgEnum("product_billing_type", ["milk", "simple"]);
export const employeePaymentSourceEnum = pgEnum("employee_payment_source", ["ghar", "dukan"]);
