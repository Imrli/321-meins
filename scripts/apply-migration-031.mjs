/**
 * Wendet Migration 031 auf die Remote-DB an.
 * Nutzung: SUPABASE_DB_URL="postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres" node scripts/apply-migration-031.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "031_simulate_payment_and_delivery_rpc.sql",
);
const dbUrl = process.env.SUPABASE_DB_URL?.trim();

if (!dbUrl) {
  console.error(
    "SUPABASE_DB_URL fehlt. Hole das DB-Passwort aus Supabase Dashboard → Project Settings → Database → Connection string (URI).",
  );
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("Installiere pg: npm install pg");
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log("Migration 031 erfolgreich angewendet.");
} catch (e) {
  console.error("Migration fehlgeschlagen:", e.message ?? e);
  process.exit(1);
} finally {
  await client.end();
}
