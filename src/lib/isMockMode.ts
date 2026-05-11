/**
 * Lokal-Modus: keine Supabase-Zugangsdaten nötig.
 * Später: VITE_MOCK=false setzen, wenn die echte API konfiguriert ist.
 */
export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK !== "false";
}
