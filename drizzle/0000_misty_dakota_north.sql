CREATE TYPE "public"."bill_status" AS ENUM('draft', 'finalized', 'void');--> statement-breakpoint
CREATE TYPE "public"."customer_ledger_type" AS ENUM('opening_balance', 'bill', 'bill_void', 'payment', 'payment_void');--> statement-breakpoint
CREATE TYPE "public"."employee_ledger_type" AS ENUM('opening_balance', 'salary_accrual', 'salary_accrual_void', 'payment', 'payment_void');--> statement-breakpoint
CREATE TYPE "public"."employee_payment_source" AS ENUM('ghar', 'dukan');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."product_billing_type" AS ENUM('milk', 'simple');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('draft', 'finalized', 'void');--> statement-breakpoint
CREATE TYPE "public"."salary_accrual_status" AS ENUM('finalized', 'void');--> statement-breakpoint
CREATE TYPE "public"."supplier_ledger_type" AS ENUM('opening_balance', 'purchase', 'purchase_void', 'payment', 'payment_void');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"actor_uid" text,
	"actor_email" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "counters" (
	"id" text PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"uid" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"active" boolean DEFAULT false NOT NULL,
	"role" text,
	"approved_at" timestamp with time zone,
	"approved_by_uid" text,
	"approved_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customer_rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_rate_id" uuid NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"superseded_at" timestamp with time zone NOT NULL,
	"updated_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "customer_rate_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customer_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_uid" text,
	CONSTRAINT "customer_rates_customer_id_product_id_unique" UNIQUE("customer_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "customer_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"has_opening_balance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"billing_type" "product_billing_type" NOT NULL,
	"default_rate" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bill_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"billing_type" "product_billing_type" NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"daily_qty" numeric(12, 2),
	"extra" numeric(12, 2),
	"less" numeric(12, 2),
	"quantity" numeric(12, 2),
	"total_qty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"bill_number" text,
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"previous_balance" numeric(12, 2),
	"total_payable" numeric(12, 2),
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"finalized_at" timestamp with time zone,
	"finalized_by_uid" text,
	"finalized_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text,
	"replaces_bill_id" uuid,
	"replaced_by_bill_id" uuid,
	CONSTRAINT "bills_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customer_ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "customer_ledger_type" NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"bill_id" uuid,
	"payment_id" uuid
);
--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "farm_supply_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"default_rate" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_supply_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"has_opening_balance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "purchase_status" DEFAULT 'draft' NOT NULL,
	"purchase_date" date NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"previous_balance" numeric(12, 2),
	"total_payable" numeric(12, 2),
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"finalized_at" timestamp with time zone,
	"finalized_by_uid" text,
	"finalized_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text,
	"replaces_purchase_id" uuid,
	"replaced_by_purchase_id" uuid
);
--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"type" "supplier_ledger_type" NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"purchase_id" uuid,
	"payment_id" uuid
);
--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "supplier_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"opening_balance" numeric(12, 2) NOT NULL,
	"closing_balance" numeric(12, 2) NOT NULL,
	"transactions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text
);
--> statement-breakpoint
ALTER TABLE "supplier_statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "authorized_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "authorized_people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_salary_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"monthly_salary" numeric(12, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "employee_salary_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"has_opening_balance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "employee_ledger_type" NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"accrual_id" uuid,
	"payment_id" uuid
);
--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source" "employee_payment_source" NOT NULL,
	"given_by" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "employee_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_salary_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"status" "salary_accrual_status" DEFAULT 'finalized' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"voided_at" timestamp with time zone,
	"voided_by_uid" text,
	"voided_by_email" text,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"opening_balance" numeric(12, 2) NOT NULL,
	"closing_balance" numeric(12, 2) NOT NULL,
	"transactions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text
);
--> statement-breakpoint
ALTER TABLE "employee_statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_rate_history" ADD CONSTRAINT "customer_rate_history_customer_rate_id_customer_rates_id_fk" FOREIGN KEY ("customer_rate_id") REFERENCES "public"."customer_rates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rates" ADD CONSTRAINT "customer_rates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rates" ADD CONSTRAINT "customer_rates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_replaces_bill_id_bills_id_fk" FOREIGN KEY ("replaces_bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_replaced_by_bill_id_bills_id_fk" FOREIGN KEY ("replaced_by_bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ADD CONSTRAINT "customer_ledger_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ADD CONSTRAINT "customer_ledger_transactions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger_transactions" ADD CONSTRAINT "customer_ledger_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_item_id_farm_supply_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."farm_supply_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_replaces_purchase_id_purchases_id_fk" FOREIGN KEY ("replaces_purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_replaced_by_purchase_id_purchases_id_fk" FOREIGN KEY ("replaced_by_purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ADD CONSTRAINT "supplier_ledger_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ADD CONSTRAINT "supplier_ledger_transactions_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ledger_transactions" ADD CONSTRAINT "supplier_ledger_transactions_payment_id_supplier_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_payment_id_supplier_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_statements" ADD CONSTRAINT "supplier_statements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_history" ADD CONSTRAINT "employee_salary_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ADD CONSTRAINT "employee_ledger_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ADD CONSTRAINT "employee_ledger_transactions_accrual_id_employee_salary_accruals_id_fk" FOREIGN KEY ("accrual_id") REFERENCES "public"."employee_salary_accruals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_ledger_transactions" ADD CONSTRAINT "employee_ledger_transactions_payment_id_employee_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."employee_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payments" ADD CONSTRAINT "employee_payments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ADD CONSTRAINT "employee_salary_accruals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_statements" ADD CONSTRAINT "employee_statements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_customer_rate_history_rate" ON "customer_rate_history" USING btree ("customer_rate_id");--> statement-breakpoint
CREATE INDEX "ix_customer_rates_customer" ON "customer_rates" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ix_customer_rates_product" ON "customer_rates" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ix_customers_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_products_active_name" ON "products" USING btree ("active","name");--> statement-breakpoint
CREATE INDEX "ix_bill_line_items_bill" ON "bill_line_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "ix_bills_customer_created" ON "bills" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_bills_customer_status_finalized" ON "bills" USING btree ("customer_id","status","finalized_at");--> statement-breakpoint
CREATE INDEX "ix_customer_ledger_customer_created" ON "customer_ledger_transactions" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_payment_allocations_payment" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ix_payment_allocations_bill" ON "payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "ix_payments_customer_created" ON "payments" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_farm_supply_items_active_name" ON "farm_supply_items" USING btree ("active","name");--> statement-breakpoint
CREATE INDEX "ix_suppliers_name" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_purchase_line_items_purchase" ON "purchase_line_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "ix_purchases_supplier_created" ON "purchases" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_purchases_supplier_status_finalized" ON "purchases" USING btree ("supplier_id","status","finalized_at");--> statement-breakpoint
CREATE INDEX "ix_supplier_ledger_supplier_created" ON "supplier_ledger_transactions" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_supplier_payment_allocations_payment" ON "supplier_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ix_supplier_payment_allocations_purchase" ON "supplier_payment_allocations" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "ix_supplier_payments_supplier_created" ON "supplier_payments" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_supplier_statements_supplier_created" ON "supplier_statements" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_authorized_people_active_name" ON "authorized_people" USING btree ("active","name");--> statement-breakpoint
CREATE INDEX "ix_employee_salary_history_employee_effective" ON "employee_salary_history" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "ix_employees_name" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_employee_ledger_employee_created" ON "employee_ledger_transactions" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_employee_payments_employee_created" ON "employee_payments" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_employee_salary_accruals_employee_created" ON "employee_salary_accruals" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_employee_statements_employee_created" ON "employee_statements" USING btree ("employee_id","created_at");