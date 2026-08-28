// One-off admin tool: activates a user by setting the `active: true` custom
// claim (the authorization gate checked by getServerSession) and mirrors
// basic profile info onto /users/{uid} for reference.
//
// Usage:
//   node scripts/set-user-active.mjs someone@example.com
//
// Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and
// FIREBASE_ADMIN_PRIVATE_KEY to be set (loaded from .env.local).

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/set-user-active.mjs <email>");
  process.exit(1);
}

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
const auth = getAuth(app);
const db = getFirestore(app);

const userRecord = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(userRecord.uid, {
  ...userRecord.customClaims,
  active: true,
});

await db.doc(`users/${userRecord.uid}`).set(
  {
    email: userRecord.email ?? null,
    displayName: userRecord.displayName ?? null,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  { merge: true }
);

console.log(`Activated ${email} (uid: ${userRecord.uid}).`);
console.log("They must sign out and sign in again for the new claim to take effect.");
