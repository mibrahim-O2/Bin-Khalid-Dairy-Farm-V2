CREATE TABLE "customer_milk_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"pause_date" date NOT NULL,
	"resume_date" date,
	"daily_milk_qty_at_pause" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_milk_pauses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "joining_date" date;--> statement-breakpoint
ALTER TABLE "customer_milk_pauses" ADD CONSTRAINT "customer_milk_pauses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_customer_milk_pauses_customer" ON "customer_milk_pauses" USING btree ("customer_id");--> statement-breakpoint
-- Backfill: every existing customer predates this column, default their
-- joining date to the date they were actually created rather than leaving
-- it null (see schema/customers.ts's comment on this column).
UPDATE "customers" SET "joining_date" = "created_at"::date WHERE "joining_date" IS NULL;