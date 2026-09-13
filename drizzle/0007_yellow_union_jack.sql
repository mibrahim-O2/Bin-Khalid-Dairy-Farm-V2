CREATE TABLE "employee_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"leave_start_date" date NOT NULL,
	"resume_date" date,
	"daily_rate_at_leave" numeric(12, 2),
	"note" text,
	"applied_to_accrual_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"created_by_email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_leaves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "joining_date" date;--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ADD COLUMN "leave_days_deducted" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_accruals" ADD COLUMN "leave_amount_deducted" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_applied_to_accrual_id_employee_salary_accruals_id_fk" FOREIGN KEY ("applied_to_accrual_id") REFERENCES "public"."employee_salary_accruals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_employee_leaves_employee" ON "employee_leaves" USING btree ("employee_id");
--> statement-breakpoint
-- Backfill: every existing employee predates this column, default their
-- joining date to the date they were actually created rather than leaving
-- it null (see schema/employees.ts's comment on this column).
UPDATE "employees" SET "joining_date" = "created_at"::date WHERE "joining_date" IS NULL;