/**
 * Testmodus auf der Edge-Runtime:
 * - Ohne STRIPE_SECRET_KEY automatisch aktiv, oder
 * - Mit APP_TEST_MODE=true (z. B. Staging mit Stripe-Testkeys + lokalem Mail).
 */
export function edgeIsTestMode(): boolean {
  const sk = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  if (sk) return Deno.env.get("APP_TEST_MODE") === "true";
  return true;
}

/**
 * Simulierte Zahlung (UI-Testmodus / ohne echten Einzug).
 * Erlaubt wenn kein Stripe-Key, APP_TEST_MODE, ALLOW_PAYMENT_SIMULATION, oder sk_test_.
 * Live-Key (sk_live_) ohne diese Flags: 403 – dann ggf. Client-Fallback nur bei `isAppTestMode()`.
 */
export function edgeAllowsPaymentSimulation(): boolean {
  const sk = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
  if (sk === "") return true;
  if (Deno.env.get("APP_TEST_MODE") === "true") return true;
  if (Deno.env.get("ALLOW_PAYMENT_SIMULATION") === "true") return true;
  if (sk.startsWith("sk_test_")) return true;
  return false;
}

/** SMTP-Host für Mailpit / lokalen Fang-Server (von Edge aus ggf. host.docker.internal). */
export function mailpitSmtpHost(): string {
  return (
    Deno.env.get("MAILPIT_SMTP_HOST")?.trim() ||
    Deno.env.get("TEST_SMTP_HOST")?.trim() ||
    "127.0.0.1"
  );
}

/**
 * SMTP-Port für Einlieferung (Mailpit-Standard 1025; Web-Oberfläche oft 8025).
 */
export function mailpitSmtpPort(): number {
  const p =
    Deno.env.get("MAILPIT_SMTP_PORT")?.trim() ||
    Deno.env.get("TEST_SMTP_PORT")?.trim();
  if (p) return Number(p);
  return 1025;
}

export function testMailCatchall(): string {
  return Deno.env.get("TEST_MAIL_CATCHALL")?.trim() || "mailpit@localhost";
}
