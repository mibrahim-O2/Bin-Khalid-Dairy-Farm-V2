import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

// `generate` (diff the schema files against the last snapshot into a new
// SQL migration under ./drizzle) is a purely offline operation — it never
// touches the database. Only `migrate`/`push`/`studio` need dbCredentials.
// Applying the generated SQL happens via scripts/db-migrate.mjs, not
// `drizzle-kit migrate` directly, because Supabase's transaction pooler
// (the only connection string we have — see DATABASE_URL) needs
// `prepare: false` on the underlying client, which drizzle-kit's own CLI
// doesn't expose a way to set.
export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
