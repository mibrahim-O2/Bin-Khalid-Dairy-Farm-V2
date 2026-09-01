// Applies pending SQL migrations from ./drizzle against Supabase. Uses its
// own single-connection client (max: 1, prepare: false) rather than the
// app's shared pool in src/lib/db/client.ts — a one-shot script has no
// reason to hold a pool open, and `prepare: false` is required against
// Supabase's transaction pooler regardless.
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1, prepare: false, ssl: "require" });
const db = drizzle(client);

console.log("Applying migrations from ./drizzle ...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Done.");

await client.end();
process.exit(0);
