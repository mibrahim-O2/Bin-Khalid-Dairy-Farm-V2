import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Lazy, like src/lib/firebase/admin.ts — importing this module (e.g. at
// build time, before .env.local has real credentials) must never throw;
// the error should only surface when a request actually needs the
// database. In Next.js dev mode, editing a file resets this module's own
// scope (Fast Refresh/HMR), which would otherwise open a fresh connection
// pool on every save and eventually exhaust Supabase's pooler — the
// instance is mirrored onto `globalThis` there so a reload can recover the
// existing one instead of creating a duplicate.

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __db?: Db };

let cached: Db | undefined = globalForDb.__db;

export function getDb(): Db {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Missing DATABASE_URL. Set it in .env.local (Supabase transaction pooler connection string)."
      );
    }
    // `prepare: false` is required against Supabase's transaction pooler
    // (port 6543 / PgBouncer in transaction mode) — it doesn't support
    // prepared statements persisting across pooled connections.
    const client = postgres(connectionString, { prepare: false, ssl: "require" });
    cached = drizzle(client, { schema });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__db = cached;
    }
  }
  return cached;
}
