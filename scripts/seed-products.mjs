// One-off admin tool: pre-seeds the standard product list (Milk, Ghee, Dahi,
// Makhan) into Postgres if they don't already exist. Safe to re-run — it
// skips any product whose name already exists.
//
// Usage:
//   node scripts/seed-products.mjs
//
// Requires DATABASE_URL to be set (loaded from .env.local).
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

const defaultProducts = [
  { name: "Milk", unit: "Litre", billingType: "milk", defaultRate: 0 },
  { name: "Ghee", unit: "Kg", billingType: "simple", defaultRate: 0 },
  { name: "Dahi", unit: "Kg", billingType: "simple", defaultRate: 0 },
  { name: "Makhan", unit: "Kg", billingType: "simple", defaultRate: 0 },
];

const existing = await sql`SELECT name FROM products`;
const existingNames = new Set(existing.map((row) => row.name));

for (const product of defaultProducts) {
  if (existingNames.has(product.name)) {
    console.log(`Skipping "${product.name}" — already exists.`);
    continue;
  }
  await sql`
    INSERT INTO products (id, name, unit, billing_type, default_rate, active)
    VALUES (${randomUUID()}, ${product.name}, ${product.unit}, ${product.billingType}, ${product.defaultRate}, true)
  `;
  console.log(`Created "${product.name}".`);
}

console.log("Done. Set real default rates from the Products page in the dashboard.");
await sql.end();
