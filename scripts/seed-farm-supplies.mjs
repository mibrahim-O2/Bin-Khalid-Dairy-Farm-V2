// One-off admin tool: pre-seeds a standard list of farm supply items into
// Postgres if they don't already exist. Safe to re-run — it skips any item
// whose name already exists.
//
// Usage:
//   node scripts/seed-farm-supplies.mjs
//
// Requires DATABASE_URL to be set (loaded from .env.local).
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

const defaultItems = [
  { name: "Wheat Bran (Chokar)", unit: "Kg", defaultRate: 0 },
  { name: "Cottonseed Cake (Khal)", unit: "Kg", defaultRate: 0 },
  { name: "Mineral Mixture", unit: "Kg", defaultRate: 0 },
  { name: "Green Fodder", unit: "Kg", defaultRate: 0 },
  { name: "Dry Fodder (Bhoosa)", unit: "Kg", defaultRate: 0 },
];

const existing = await sql`SELECT name FROM farm_supply_items`;
const existingNames = new Set(existing.map((row) => row.name));

for (const item of defaultItems) {
  if (existingNames.has(item.name)) {
    console.log(`Skipping "${item.name}" — already exists.`);
    continue;
  }
  await sql`
    INSERT INTO farm_supply_items (id, name, unit, default_rate, active)
    VALUES (${randomUUID()}, ${item.name}, ${item.unit}, ${item.defaultRate}, true)
  `;
  console.log(`Created "${item.name}".`);
}

console.log("Done. Set real default rates from the Farm Supplies page in the dashboard.");
await sql.end();
