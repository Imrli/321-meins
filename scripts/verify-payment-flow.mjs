/**
 * End-to-End-Check: simulierte Zahlung für pending_payment-Auktion.
 *
 *   set TEST_AUFTRAGGEBER_EMAIL=...
 *   set TEST_AUFTRAGGEBER_PASSWORD=...
 *   set VITE_SUPABASE_URL=https://....supabase.co
 *   set VITE_SUPABASE_ANON_KEY=...
 *   node scripts/verify-payment-flow.mjs [anzeige_id optional]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(name) {
  try {
    const p = resolve(__dirname, "..", name);
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.production.local");
loadEnvFile(".env");

const url = process.env.VITE_SUPABASE_URL?.trim();
const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const email = process.env.TEST_AUFTRAGGEBER_EMAIL?.trim();
const password = process.env.TEST_AUFTRAGGEBER_PASSWORD?.trim();
const anzeigeArg = process.argv[2]?.trim();

if (!url || !anon) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen.");
  process.exit(1);
}
if (!email || !password) {
  console.error(
    "TEST_AUFTRAGGEBER_EMAIL und TEST_AUFTRAGGEBER_PASSWORD setzen.",
  );
  process.exit(1);
}

function generateUuidV4() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const sb = createClient(url, anon);

const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email,
  password,
});
if (signErr || !signIn.session) {
  console.error("Login fehlgeschlagen:", signErr?.message ?? "no session");
  process.exit(1);
}
const uid = signIn.session.user.id;
console.log("Angemeldet als", signIn.session.user.email, uid.slice(0, 8) + "…");

let anzeigeId = anzeigeArg;
if (!anzeigeId) {
  const { data: rows, error } = await sb
    .from("auktionen")
    .select("anzeige_id, status")
    .eq("auftraggeber_id", uid)
    .eq("status", "pending_payment")
    .limit(1);
  if (error || !rows?.length) {
    console.error("Keine pending_payment-Auktion gefunden.", error?.message);
    process.exit(1);
  }
  anzeigeId = rows[0].anzeige_id;
}
console.log("Teste Zahlung für", anzeigeId);

// RPC
const { data: rpcData, error: rpcErr } = await sb.rpc(
  "simulate_auktion_zahlung",
  { p_anzeige_id: anzeigeId },
);
if (!rpcErr && rpcData?.ok) {
  console.log("OK via RPC:", rpcData);
  process.exit(0);
}
if (rpcErr) console.warn("RPC:", rpcErr.message);
else if (rpcData?.error) console.warn("RPC body:", rpcData.error);

// Direct RLS update (wie Client-Fallback)
const qrTok = generateUuidV4();
const piSim = `pi_sim_${qrTok.replace(/-/g, "")}`;
const { data: updated, error: updErr } = await sb
  .from("auktionen")
  .update({
    status: "bezahlt_simuliert",
    qr_token: qrTok,
  })
  .eq("anzeige_id", anzeigeId)
  .eq("auftraggeber_id", uid)
  .eq("status", "pending_payment")
  .select("anzeige_id, status, qr_token")
  .maybeSingle();

if (updErr) {
  console.error("Direct update fehlgeschlagen:", updErr.message);
  process.exit(1);
}
if (!updated) {
  const { data: cur } = await sb
    .from("auktionen")
    .select("status, qr_token")
    .eq("anzeige_id", anzeigeId)
    .maybeSingle();
  if (
    cur?.status === "bezahlt_simuliert" ||
    cur?.status === "awarded" ||
    cur?.status === "bezahlt"
  ) {
    console.log("Bereits bezahlt:", cur);
    process.exit(0);
  }
  console.error("Direct update: keine Zeile geändert, aktuell:", cur);
  process.exit(1);
}

console.log("OK via direct RLS update:", updated);
