// One-off admin tool: pre-seeds the standard product list (Milk, Ghee, Dahi,
// Makhan) if they don't already exist. Safe to re-run — it skips any product
// whose name already exists.
//
// Usage:
//   node scripts/seed-products.mjs
//
// Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and
// FIREBASE_ADMIN_PRIVATE_KEY to be set (loaded from .env.local).

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadEnvLocal() {
  try {
    const contents = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local not found; rely on already-exported environment variables.
  }
}

loadEnvLocal();

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local."
  );
  process.exit(1);
}

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

const defaultProducts = [
  { name: "Milk", unit: "Litre", billingType: "milk", defaultRate: 0 },
  { name: "Ghee", unit: "Kg", billingType: "simple", defaultRate: 0 },
  { name: "Dahi", unit: "Kg", billingType: "simple", defaultRate: 0 },
  { name: "Makhan", unit: "Kg", billingType: "simple", defaultRate: 0 },
];

const existingSnapshot = await db.collection("products").get();
const existingNames = new Set(existingSnapshot.docs.map((d) => d.data().name));

for (const product of defaultProducts) {
  if (existingNames.has(product.name)) {
    console.log(`Skipping "${product.name}" — already exists.`);
    continue;
  }
  await db.collection("products").add({
    ...product,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`Created "${product.name}".`);
}

console.log("Done. Set real default rates from the Products page in the dashboard.");
