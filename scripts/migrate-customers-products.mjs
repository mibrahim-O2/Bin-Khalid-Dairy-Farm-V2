// One-time backfill: Firestore customers/products/customerRates(+history)
// -> Postgres. Preserves the original Firestore document id as the
// Postgres primary key (see the comment on `customers.id` in
// src/lib/db/schema/customers.ts) — bills/payments/ledger transactions
// stay on Firestore until M3-M5 and reference these by that same id.
// Idempotent: every insert is an upsert keyed on that preserved id.
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import postgres from "postgres";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const firestore = getFirestore(app);
const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

// Several fields across this project's Firestore history are inconsistently
// either a raw Timestamp (from before a serverTimestamp()-sentinel bug was
// fixed in Phase 4) or an ISO string (the current, correct shape) — handle
// both, same as the M1 users/activityLogs backfill.
function toIsoOrNull(value) {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

console.log("=== Migrating customers ===");
const customersSnap = await firestore.collection("customers").get();
console.log(`Found ${customersSnap.size} Firestore customer doc(s).`);
for (const doc of customersSnap.docs) {
  const d = doc.data();
  await sql`
    INSERT INTO customers (id, name, phone, address, active, balance, has_opening_balance, created_at, updated_at, created_by_uid)
    VALUES (
      ${doc.id}, ${d.name}, ${d.phone ?? null}, ${d.address ?? null},
      ${d.active === true}, ${d.balance ?? 0}, ${d.hasOpeningBalance === true},
      ${toIsoOrNull(d.createdAt) ?? sql`now()`}, ${toIsoOrNull(d.updatedAt) ?? sql`now()`},
      ${d.createdBy ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, phone = EXCLUDED.phone, address = EXCLUDED.address,
      active = EXCLUDED.active, balance = EXCLUDED.balance,
      has_opening_balance = EXCLUDED.has_opening_balance, updated_at = EXCLUDED.updated_at
  `;
  console.log(`  upserted customer ${doc.id} (${d.name}), balance=${d.balance ?? 0}`);
}

console.log("\n=== Migrating products ===");
const productsSnap = await firestore.collection("products").get();
console.log(`Found ${productsSnap.size} Firestore product doc(s).`);
for (const doc of productsSnap.docs) {
  const d = doc.data();
  await sql`
    INSERT INTO products (id, name, unit, billing_type, default_rate, active, created_at, updated_at)
    VALUES (
      ${doc.id}, ${d.name}, ${d.unit}, ${d.billingType}, ${d.defaultRate ?? 0},
      ${d.active === true}, ${toIsoOrNull(d.createdAt) ?? sql`now()`}, ${toIsoOrNull(d.updatedAt) ?? sql`now()`}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, unit = EXCLUDED.unit, billing_type = EXCLUDED.billing_type,
      default_rate = EXCLUDED.default_rate, active = EXCLUDED.active, updated_at = EXCLUDED.updated_at
  `;
  console.log(`  upserted product ${doc.id} (${d.name})`);
}

console.log("\n=== Migrating customerRates (+ history) ===");
const ratesSnap = await firestore.collection("customerRates").get();
console.log(`Found ${ratesSnap.size} Firestore customerRates doc(s).`);
for (const doc of ratesSnap.docs) {
  const d = doc.data();
  const [row] = await sql`
    INSERT INTO customer_rates (customer_id, product_id, rate, updated_at, updated_by_uid)
    VALUES (${d.customerId}, ${d.productId}, ${d.rate}, ${toIsoOrNull(d.updatedAt) ?? sql`now()`}, ${d.updatedBy ?? null})
    ON CONFLICT (customer_id, product_id) DO UPDATE SET
      rate = EXCLUDED.rate, updated_at = EXCLUDED.updated_at, updated_by_uid = EXCLUDED.updated_by_uid
    RETURNING id
  `;
  console.log(`  upserted rate ${doc.id} -> Postgres id ${row.id}`);

  const historySnap = await doc.ref.collection("history").get();
  for (const h of historySnap.docs) {
    const hd = h.data();
    await sql`
      INSERT INTO customer_rate_history (customer_rate_id, rate, superseded_at, updated_by_uid)
      VALUES (${row.id}, ${hd.rate}, ${toIsoOrNull(hd.supersededAt)}, ${hd.updatedBy ?? null})
    `;
  }
  if (historySnap.size > 0) console.log(`    + ${historySnap.size} history row(s)`);
}

// --- Verify by count ---
console.log("\n=== Verification ===");
const [{ count: pgCustomers }] = await sql`SELECT count(*)::int AS count FROM customers`;
const [{ count: pgProducts }] = await sql`SELECT count(*)::int AS count FROM products`;
const [{ count: pgRates }] = await sql`SELECT count(*)::int AS count FROM customer_rates`;
console.log(`Firestore customers: ${customersSnap.size}  |  Postgres customers: ${pgCustomers}`);
console.log(`Firestore products: ${productsSnap.size}  |  Postgres products: ${pgProducts}`);
console.log(`Firestore customerRates: ${ratesSnap.size}  |  Postgres customer_rates: ${pgRates}`);
if (pgCustomers < customersSnap.size) throw new Error("Customer count mismatch!");
if (pgProducts < productsSnap.size) throw new Error("Product count mismatch!");
if (pgRates < ratesSnap.size) throw new Error("Customer rate count mismatch!");

console.log("\nSpot-check (Postgres):");
const custRows = await sql`SELECT id, name, phone, active, balance, has_opening_balance FROM customers`;
for (const c of custRows) console.log("  ", JSON.stringify(c));
const prodRows = await sql`SELECT id, name, unit, billing_type, default_rate, active FROM products ORDER BY name`;
for (const p of prodRows) console.log("  ", JSON.stringify(p));

await sql.end();
process.exit(0);
