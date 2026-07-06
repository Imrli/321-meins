/**
 * Wendet eine SQL-Migration auf die Remote-DB an.
 *
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres" \
 *     node scripts/apply-migration.mjs 036_auktionen_dienstleistung_typ.sql
 *
 * Liest optional SUPABASE_DB_URL aus .env / .env.local (nicht committen).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(name) {
  try {
    const p = path.join(__dirname, "..", name);
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const migrationArg = process.argv[2]?.trim();
if (!migrationArg) {
  console.error(
    "Usage: node scripts/apply-migration.mjs <datei.sql oder migrations/NNN_name.sql>",
  );
  process.exit(1);
}

const sqlPath = migrationArg.includes("/") || migrationArg.includes("\\")
  ? path.resolve(migrationArg)
  : path.join(__dirname, "..", "supabase", "migrations", migrationArg);

const dbUrl = process.env.SUPABASE_DB_URL?.trim();

if (!dbUrl) {
  console.error(
    "SUPABASE_DB_URL fehlt.\n" +
      "Supabase Dashboard → Project Settings → Database → Connection string (URI).\n" +
      "Lokal in .env setzen (nicht committen), z. B.:\n" +
      "SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  );
  process.exit(1);
}

if (!fs.existsSync(sqlPath)) {
  console.error("Migration nicht gefunden:", sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("Installiere pg: npm install -D pg");
  process.exit(1);
}

const client = new pg.default.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Migration erfolgreich angewendet:", path.basename(sqlPath));

  const verify = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auktionen'
      AND column_name IN (
        'dienstleistung_typ',
        'umzug_details',
        'reinigung_details',
        'abgabegarantie'
      )
    ORDER BY column_name
  `);
  console.log("Spalten in public.auktionen:");
  for (const row of verify.rows) {
    console.log(`  - ${row.column_name} (${row.data_type}, nullable=${row.is_nullable})`);
  }

  const counts = await client.query(`
    SELECT dienstleistung_typ, COUNT(*)::int AS n
    FROM public.auktionen
    GROUP BY dienstleistung_typ
    ORDER BY dienstleistung_typ
  `);
  console.log("Verteilung dienstleistung_typ:");
  for (const row of counts.rows) {
    console.log(`  - ${row.dienstleistung_typ}: ${row.n}`);
  }
} catch (e) {
  console.error("Migration fehlgeschlagen:", e.message ?? e);
  process.exit(1);
} finally {
  await client.end();
}
