// One-time backfill: Firestore `users` + `activityLogs` -> Postgres. Safe
// to re-run — every insert is an upsert keyed on the natural Firestore doc
// id (uid for users; activityLogs get a fresh Postgres id each run, so
// this specific script is NOT safe to re-run for activityLogs without
// clearing the table first — there are only 2 rows total and this is a
// one-shot backfill, not an ongoing sync, so that's an accepted trade-off
// here rather than engineering idempotency for a table this small).
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

// Some older /users/{uid} docs (from Phase 1's manual first-admin setup,
// predating the current approvePendingUser code) store approvedAt as a raw
// Firestore Timestamp rather than the ISO string the current code writes —
// handle both.
function toIsoOrNull(value) {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

console.log("=== Migrating users ===");
const usersSnap = await firestore.collection("users").get();
console.log(`Found ${usersSnap.size} Firestore user doc(s).`);

for (const doc of usersSnap.docs) {
  const data = doc.data();
  const uid = doc.id;
  await sql`
    INSERT INTO users (uid, email, display_name, active, role, approved_at, approved_by_uid, approved_by_email)
    VALUES (
      ${uid},
      ${data.email ?? null},
      ${data.displayName ?? null},
      ${data.active === true},
      ${data.role ?? null},
      ${toIsoOrNull(data.approvedAt)},
      ${data.approvedBy?.uid ?? null},
      ${data.approvedBy?.email ?? null}
    )
    ON CONFLICT (uid) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      active = EXCLUDED.active,
      role = EXCLUDED.role,
      approved_at = EXCLUDED.approved_at,
      approved_by_uid = EXCLUDED.approved_by_uid,
      approved_by_email = EXCLUDED.approved_by_email
  `;
  console.log(`  upserted ${uid} (${data.email ?? "no email"})`);
}

console.log("\n=== Migrating activityLogs ===");
const logsSnap = await firestore.collection("activityLogs").get();
console.log(`Found ${logsSnap.size} Firestore activityLogs doc(s).`);

for (const doc of logsSnap.docs) {
  const data = doc.data();
  // Everything action-specific (customerId/customerName/reason/
  // purgedCounts today; whatever a future action needs tomorrow) folds
  // into `details` — only the fields every action shares get their own
  // column. See src/lib/db/activity-log.ts.
  const { action, performedBy, createdAt, customerId, ...rest } = data;
  await sql`
    INSERT INTO activity_logs (action, target_type, target_id, actor_uid, actor_email, details, created_at)
    VALUES (
      ${action},
      ${customerId ? "customer" : null},
      ${customerId ?? null},
      ${performedBy?.uid ?? null},
      ${performedBy?.email ?? null},
      ${sql.json(rest)},
      ${toIsoOrNull(createdAt)}
    )
  `;
  console.log(`  inserted log ${doc.id} (${action})`);
}

// --- Verify by count ---
console.log("\n=== Verification ===");
const [{ count: pgUserCount }] = await sql`SELECT count(*)::int AS count FROM users`;
const [{ count: pgLogCount }] = await sql`SELECT count(*)::int AS count FROM activity_logs`;
console.log(`Firestore users: ${usersSnap.size}  |  Postgres users: ${pgUserCount}`);
console.log(`Firestore activityLogs: ${logsSnap.size}  |  Postgres activity_logs: ${pgLogCount}`);
if (pgUserCount !== usersSnap.size) throw new Error("User count mismatch!");
if (pgLogCount < logsSnap.size) throw new Error("Activity log count mismatch (fewer rows in Postgres than Firestore)!");

console.log("\nSpot-check (Postgres):");
const pgUsers = await sql`SELECT uid, email, display_name, active, role FROM users ORDER BY email`;
for (const u of pgUsers) console.log(" ", JSON.stringify(u));
const pgLogs = await sql`SELECT action, target_type, target_id, actor_email, details, created_at FROM activity_logs`;
for (const l of pgLogs) console.log(" ", JSON.stringify(l));

await sql.end();
process.exit(0);
