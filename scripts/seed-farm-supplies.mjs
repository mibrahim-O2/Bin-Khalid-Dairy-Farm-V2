// One-off admin tool: pre-seeds a standard list of farm supply items if they
// don't already exist. Safe to re-run — it skips any item whose name
// already exists.
//
// Usage:
//   node scripts/seed-farm-supplies.mjs
//
// Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and
// FIREBASE_ADMIN_PRIVATE_KEY to be set (loaded from .env.local).

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

const defaultItems = [
  { name: "Wheat Bran (Chokar)", unit: "Kg", defaultRate: 0 },
  { name: "Cottonseed Cake (Khal)", unit: "Kg", defaultRate: 0 },
  { name: "Mineral Mixture", unit: "Kg", defaultRate: 0 },
  { name: "Green Fodder", unit: "Kg", defaultRate: 0 },
  { name: "Dry Fodder (Bhoosa)", unit: "Kg", defaultRate: 0 },
];

const existingSnapshot = await db.collection("farmSupplyItems").get();
const existingNames = new Set(existingSnapshot.docs.map((d) => d.data().name));
const now = new Date().toISOString();

for (const item of defaultItems) {
  if (existingNames.has(item.name)) {
    console.log(`Skipping "${item.name}" — already exists.`);
    continue;
  }
  await db.collection("farmSupplyItems").add({
    ...item,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`Created "${item.name}".`);
}

console.log("Done. Set real default rates from the Farm Supplies page in the dashboard.");
