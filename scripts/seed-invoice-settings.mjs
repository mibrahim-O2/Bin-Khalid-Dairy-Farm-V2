// One-off admin tool: seeds the real payment-account details and business
// contact phone the user gave directly (Part A of the bill/statement
// redesign brief) into the live `settings` table — the same shape the
// Settings UI's Server Actions write. Safe to re-run (upsert).
//
// Usage:
//   node scripts/seed-invoice-settings.mjs
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

async function upsert(id, data) {
  await sql`
    INSERT INTO settings (id, data, updated_at)
    VALUES (${id}, ${sql.json(data)}, now())
    ON CONFLICT (id) DO UPDATE SET data = ${sql.json(data)}, updated_at = now()
  `;
}

const [businessRow] = await sql`SELECT data FROM settings WHERE id = 'business'`;
const business = { name: "Bin Khalid Dairy Farm", nameUrdu: "بن خالد ڈیری فارم", address: "Shahdadpur, Sindh", ...businessRow?.data, phone: "0324-2991303" };
await upsert("business", business);
console.log("business ->", business);

const payments = {
  accounts: [
    { id: randomUUID(), label: "Account Title", accountNumber: "Muhammad Ibrahim" },
    { id: randomUUID(), label: "Easypaisa", accountNumber: "0324-2991303" },
    { id: randomUUID(), label: "JazzCash", accountNumber: "0324-2991303" },
  ],
};
await upsert("payments", payments);
console.log("payments ->", payments);

await sql.end();
