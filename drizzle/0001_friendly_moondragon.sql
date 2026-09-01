-- Corrects master-data primary keys (customers, products, suppliers,
-- farm_supply_items, employees, authorized_people) from a native `uuid`
-- with a Postgres-side default to plain app-generated `text`. Reasoning:
-- bills/purchases/payments/ledger transactions haven't migrated off
-- Firestore yet and reference these by their *original Firestore document
-- id* in the meantime — backfilling with a fresh Postgres-generated uuid
-- would silently orphan every one of that record's still-on-Firestore
-- cross-references until their own migration phase. See the comment on
-- `customers.id` in src/lib/db/schema/customers.ts.
--
-- drizzle-kit generated the naive column-type ALTERs for this diff, but
-- Postgres won't let a foreign-key column and the primary key it
-- references end up with mismatched types even mid-transaction — so the
-- FK constraints have to come off first, then go back on afterward. All
-- affected tables are empty at this point in the migration history, so
-- there's no data to preserve across the drop/re-add.

-- --- Drop affected FK constraints ---
ALTER TABLE "customer_rates" DROP CONSTRAINT "customer_rates_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "customer_rates" DROP CONSTRAINT "customer_rates_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "bill_line_items" DROP CONSTRAINT "bill_line_items_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "bills" DROP CONSTRAINT "bills_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" DROP CONSTRAINT "customer_ledger_transactions_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "purchase_line_items" DROP CONSTRAINT "purchase_line_items_item_id_farm_supply_items_id_fk";--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_supplier_id_suppliers_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" DROP CONSTRAINT "supplier_ledger_transactions_supplier_id_suppliers_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" DROP CONSTRAINT "supplier_payment_allocations_supplier_id_suppliers_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_statements" DROP CONSTRAINT "supplier_statements_supplier_id_suppliers_id_fk";--> statement-breakpoint
ALTER TABLE "employee_salary_history" DROP CONSTRAINT "employee_salary_history_employee_id_employees_id_fk";--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" DROP CONSTRAINT "employee_ledger_transactions_employee_id_employees_id_fk";--> statement-breakpoint
ALTER TABLE "employee_payments" DROP CONSTRAINT "employee_payments_employee_id_employees_id_fk";--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" DROP CONSTRAINT "employee_salary_accruals_employee_id_employees_id_fk";--> statement-breakpoint
ALTER TABLE "employee_statements" DROP CONSTRAINT "employee_statements_employee_id_employees_id_fk";--> statement-breakpoint

-- --- Alter column types (safe now — no FK to conflict with) ---
ALTER TABLE "customer_rates" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "customer_rates" ALTER COLUMN "product_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bill_line_items" ALTER COLUMN "product_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bills" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment_allocations" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "farm_supply_items" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "farm_supply_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "purchase_line_items" ALTER COLUMN "item_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "supplier_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ALTER COLUMN "supplier_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ALTER COLUMN "supplier_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "supplier_payments" ALTER COLUMN "supplier_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "supplier_statements" ALTER COLUMN "supplier_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "authorized_people" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "authorized_people" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "employee_salary_history" ALTER COLUMN "employee_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ALTER COLUMN "employee_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "employee_payments" ALTER COLUMN "employee_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ALTER COLUMN "employee_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "employee_statements" ALTER COLUMN "employee_id" SET DATA TYPE text;--> statement-breakpoint

-- --- Re-add the FK constraints, same definitions as migration 0000 ---
ALTER TABLE "customer_rates" ADD CONSTRAINT "customer_rates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rates" ADD CONSTRAINT "customer_rates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ADD CONSTRAINT "customer_ledger_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_item_id_farm_supply_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."farm_supply_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ADD CONSTRAINT "supplier_ledger_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_statements" ADD CONSTRAINT "supplier_statements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_history" ADD CONSTRAINT "employee_salary_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ADD CONSTRAINT "employee_ledger_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ADD CONSTRAINT "employee_salary_accruals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_statements" ADD CONSTRAINT "employee_statements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
