// One-off admin tool: pre-seeds the 8 core livestock categories into
// Postgres if they don't already exist. Safe to re-run — it skips any
// category whose name already exists. Nothing here is hardcoded in
// application code; an admin can add further categories (e.g. "Goat")
// the same way from the Livestock page itself.
//
// Usage:
//   node scripts/seed-animal-categories.mjs
//
// Requires DATABASE_URL to be set (loaded from .env.local).
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

const coreCategories = [
  { name: "Buffalo (Milking)", topLevelGroup: "buffalo" },
  { name: "Buffalo (Not Milking)", topLevelGroup: "buffalo" },
  { name: "Cow (Milking)", topLevelGroup: "cow" },
  { name: "Cow (Not Milking)", topLevelGroup: "cow" },
  { name: "Buffalo Calf (Milk-drinking)", topLevelGroup: "calf" },
  { name: "Buffalo Calf (Grown)", topLevelGroup: "calf" },
  { name: "Cow Calf (Milk-drinking)", topLevelGroup: "calf" },
  { name: "Cow Calf (Grown)", topLevelGroup: "calf" },
];

const existing = await sql`SELECT name FROM animal_categories`;
const existingNames = new Set(existing.map((row) => row.name));

for (const category of coreCategories) {
  if (existingNames.has(category.name)) {
    console.log(`Skipping "${category.name}" — already exists.`);
    continue;
  }
  await sql`
    INSERT INTO animal_categories (id, name, top_level_group, active)
    VALUES (${randomUUID()}, ${category.name}, ${category.topLevelGroup}, true)
  `;
  console.log(`Created "${category.name}".`);
}

console.log("Done.");
await sql.end();
