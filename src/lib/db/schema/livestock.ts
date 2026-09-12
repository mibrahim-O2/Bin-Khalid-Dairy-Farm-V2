import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// "group" is a reserved SQL keyword — named topLevelGroup to sidestep any
// quoting surprises, and because it's specifically the coarse bucket used
// for the dashboard/landing-page icon rollup (a category itself can be far
// more specific, e.g. "Buffalo Calf (Grown)").
export const animalTopLevelGroupEnum = pgEnum("animal_top_level_group", [
  "buffalo",
  "cow",
  "calf",
  "other",
]);
export const animalGenderEnum = pgEnum("animal_gender", ["male", "female"]);
export const animalStatusEnum = pgEnum("animal_status", ["active", "sold", "deceased"]);

/**
 * Admin-managed reference list, same pattern as farmSupplyItems/products —
 * any active admin can add/archive/delete (delete blocked by the FK below
 * once a category is actually used; archive instead). Seeded with the 8
 * core categories from scripts/seed-animal-categories.mjs, but nothing here
 * is hardcoded in application code — an admin can add e.g. "Goat" the same
 * way they'd add a new Farm Supply Item, with topLevelGroup "other".
 */
export const animalCategories = pgTable("animal_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  topLevelGroup: animalTopLevelGroupEnum("top_level_group").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ix_animal_categories_active_name").on(t.active, t.name)]).enableRLS();

/**
 * One row per animal — purely for the farm's own reference, deliberately
 * never touched by billing/ledger/balance logic (unlike every other
 * "record" table in this app). Gender lives on the animal itself, not
 * duplicated per category, so "gender tracked consistently across all of
 * them" holds regardless of which category (core or admin-added) an animal
 * belongs to.
 */
export const animals = pgTable("animals", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => animalCategories.id),
  name: text("name"),
  gender: animalGenderEnum("gender").notNull(),
  acquisitionDate: date("acquisition_date").notNull(),
  status: animalStatusEnum("status").notNull().default("active"),
  // Set only when status = "sold".
  saleDate: date("sale_date"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
  // Set only when status = "deceased".
  deceasedDate: date("deceased_date"),
  deceasedNote: text("deceased_note"),
  // General reference note, independent of status.
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByUid: text("created_by_uid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedByUid: text("updated_by_uid"),
}, (t) => [
  index("ix_animals_category").on(t.categoryId),
  index("ix_animals_status").on(t.status),
]).enableRLS();
