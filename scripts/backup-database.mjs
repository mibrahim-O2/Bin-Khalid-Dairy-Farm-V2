// Phase 10 backup tool: a full logical export of every table to JSON, one
// file per table, inside a timestamped folder. Deliberately dependency-free
// (no pg_dump binary required — just the `postgres` package already in
// node_modules) so it runs the same on any machine that can already run
// this project's other scripts.
//
// This is a supplementary, on-demand backup — the primary safety net is
// Supabase's own automatic backups (see docs/BACKUP.md). Run this before
// anything risky: a schema migration, a bulk data fix, or a production
// cutover.
//
// Usage:
//   node scripts/backup-database.mjs [output-dir]
//   (defaults to ./backups/<timestamp>/)
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require" });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = process.argv[2] || `backups/${timestamp}`;
mkdirSync(outDir, { recursive: true });

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`;

console.log(`Backing up ${tables.length} tables to ${outDir}/ ...`);

let totalRows = 0;
for (const { table_name } of tables) {
  const rows = await sql`select * from ${sql(table_name)}`;
  writeFileSync(`${outDir}/${table_name}.json`, JSON.stringify(rows, null, 2));
  console.log(`  ${table_name}: ${rows.length} rows`);
  totalRows += rows.length;
}

writeFileSync(
  `${outDir}/_manifest.json`,
  JSON.stringify({ takenAt: new Date().toISOString(), tables: tables.map((t) => t.table_name), totalRows }, null, 2)
);

console.log(`Done. ${totalRows} total rows across ${tables.length} tables.`);
console.log(`Keep this folder somewhere safe (it contains real customer/financial data) — it is gitignored by default.`);
await sql.end();
