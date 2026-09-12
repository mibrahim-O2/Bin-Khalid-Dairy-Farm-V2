CREATE TYPE "public"."animal_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."animal_status" AS ENUM('active', 'sold', 'deceased');--> statement-breakpoint
CREATE TYPE "public"."animal_top_level_group" AS ENUM('buffalo', 'cow', 'calf', 'other');--> statement-breakpoint
CREATE TABLE "animal_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"top_level_group" "animal_top_level_group" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text,
	"gender" "animal_gender" NOT NULL,
	"acquisition_date" date NOT NULL,
	"status" "animal_status" DEFAULT 'active' NOT NULL,
	"sale_date" date,
	"sale_price" numeric(12, 2),
	"deceased_date" date,
	"deceased_note" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_uid" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_uid" text
);
--> statement-breakpoint
ALTER TABLE "animals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_category_id_animal_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."animal_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_animal_categories_active_name" ON "animal_categories" USING btree ("active","name");--> statement-breakpoint
CREATE INDEX "ix_animals_category" ON "animals" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ix_animals_status" ON "animals" USING btree ("status");