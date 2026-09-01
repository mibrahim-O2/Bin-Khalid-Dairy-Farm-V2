// One-off admin tool: activates a user by setting the `active: true` custom
// claim (the authorization gate checked by getServerSession) plus an
// explicit `admin` role claim, and mirrors basic profile info onto the
// Postgres `users` table for reference (same upsert approvePendingUser
// does). This is also how the very first account (the Owner) gets
// activated — Owner-ness itself is never a stored claim, it's re-derived
// from OWNER_UID/OWNER_EMAIL (see src/lib/auth/owner.ts) — so an owner
// activated here still just gets the same `active` + `admin` claims
// everyone else does; being the Owner is layered on top of that, not
// instead of it. Once the Owner has dashboard access, other pending sign-ups
// can be approved from the in-app Pending Users page instead of this script.
//
// Usage:
//   node scripts/set-user-active.mjs someone@example.com
//
// Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
// FIREBASE_ADMIN_PRIVATE_KEY, and DATABASE_URL to be set (loaded from
// .env.local).
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import postgres from "postgres";

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
const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

const userRecord = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(userRecord.uid, {
  ...userRecord.customClaims,
  active: true,
  role: "admin",
});

await sql`
  INSERT INTO users (uid, email, display_name, active, role, approved_at)
  VALUES (${userRecord.uid}, ${userRecord.email ?? null}, ${userRecord.displayName ?? null}, true, 'admin', now())
  ON CONFLICT (uid) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    active = true,
    role = 'admin',
    approved_at = now()
`;

console.log(`Activated ${email} (uid: ${userRecord.uid}).`);
console.log("They must sign out and sign in again for the new claim to take effect.");
await sql.end();
