/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly MAILPIT_URL: string;
  /** Kompatibel zu älteren Anleitungen / Duplikate */
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Öffentliche App-URL (E-Mail-Links, Redirects) – z. B. https://321-meins.ch */
  readonly VITE_SITE_URL?: string;
  /** Dev: Rolle ohne Login testen (`transporteur` | `auftraggeber`) */
  readonly VITE_TEST_ROLE?: string;
  /** `false` schaltet Mock ab (dann Supabase-Code). Standard: Mock an. */
  readonly VITE_MOCK: string;
  /**
   * Nur wenn "true": QR-/Zahlungs-Testhinweise aus, echtes Stripe-Verhalten im UI angenommen.
   * Sync mit STRIPE_SECRET_KEY auf der Edge empfohlen.
   */
  readonly VITE_STRIPE_LIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
