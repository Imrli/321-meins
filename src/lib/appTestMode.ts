/**
 * Einheitlicher Testmodus (QR-/Zahlungs-Simulation, Mailpit-Hinweise).
 *
 * - VITE_MOCK=true, oder
 * - kein ausdrückliches Live-Stripe im Frontend (VITE_STRIPE_LIVE ist nicht "true").
 *
 * Für Produktion mit Stripe: VITE_STRIPE_LIVE=true und STRIPE_SECRET_KEY in der Edge setzen.
 */
export function isAppTestMode(): boolean {
  if (import.meta.env.VITE_MOCK === "true") return true;
  if (import.meta.env.VITE_STRIPE_LIVE === "true") return false;
  return true;
}
