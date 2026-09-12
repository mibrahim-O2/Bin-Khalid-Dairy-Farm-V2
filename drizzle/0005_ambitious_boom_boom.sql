CREATE TABLE "customer_extra_milk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "customer_extra_milk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_milk_pauses" ADD COLUMN "reduced_daily_qty" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "daily_milk_qty" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "customer_extra_milk" ADD CONSTRAINT "customer_extra_milk_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_customer_extra_milk_customer" ON "customer_extra_milk" USING btree ("customer_id");