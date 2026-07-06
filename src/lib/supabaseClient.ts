/**
 * Supabase-Browser-Client (`createClient` von `@supabase/supabase-js`).
 *
 * Im Quellcode stehen keine echten URL/Keys – nur Platzhalter über
 * Umgebungsvariablen (Vite ersetzt sie beim `npm run build` / `npm run dev`).
 *
 * Wo du die echten Werte einträgst:
 * - Lokal entwickeln: Projektroot-Datei `.env` (gitignored) – z. B. Supabase CLI
 *   mit `SUPABASE_URL` + `SUPABASE_ANON_KEY`, oder `VITE_SUPABASE_URL` +
 *   `VITE_SUPABASE_ANON_KEY`.
 * - Produktions-Build lokal: `.env.production.local` (gitignored), siehe
 *   `.env.production.local.example` – immer `https://<dein-ref>.supabase.co`.
 * - GitHub Pages / CI: Repository-Secrets `VITE_SUPABASE_URL` und
 *   `VITE_SUPABASE_ANON_KEY` (Workflow `.github/workflows/pages.yml`).
 *
 * Platzhalter-Schema (nur in `.env`, nicht hier im Code):
 *   VITE_SUPABASE_URL=https://<DEIN_PROJEKT_REF>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<ANON_PUBLIC_KEY_AUS_DASHBOARD_API>
 */
import { createClient } from "@supabase/supabase-js";

const rawUrl =
  import.meta.env.SUPABASE_URL?.trim() ||
  import.meta.env.VITE_SUPABASE_URL?.trim();
const anon =
  import.meta.env.SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Auf einer HTTPS-Seite blockiert der Browser HTTP-Requests zu
 * `*.supabase.co` (Mixed Content). Der Fetch schlägt fehl; Safari meldet u. a.
 * nur „Load failed“. Cloud-Projekte sind immer per HTTPS erreichbar.
 */
function normalizeSupabaseHttpUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  try {
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:"
    ) {
      const m = /^http:\/\/([\w-]+\.supabase\.co)(\/.*)?$/i.exec(u);
      if (m) {
        return `https://${m[1]}${m[2] ?? ""}`;
      }
    }
  } catch {
    /* ignore */
  }
  return u;
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

/** Live-Webseite darf nicht gegen einen lokalen Supabase-API-Host bauen (immer „Failed to fetch“). */
function isSupabaseApiReachableFromBrowser(apiUrl: string): boolean {
  try {
    const u = new URL(apiUrl);
    if (typeof window === "undefined") return true;
    const pageHost = window.location.hostname;
    const apiLocal = isLocalHostname(u.hostname);
    const pageLocal = isLocalHostname(pageHost);
    if (apiLocal && !pageLocal) return false;
    return true;
  } catch {
    return false;
  }
}

const normalizedUrl = rawUrl ? normalizeSupabaseHttpUrl(rawUrl.trim()) : "";

const clientAllowed =
  Boolean(normalizedUrl && anon) &&
  isSupabaseApiReachableFromBrowser(normalizedUrl);

export const isSupabaseConfigured = Boolean(normalizedUrl && anon);

/** Echte Supabase-Nutzung (kein Mock): nur wenn Client existiert und erreichbar ist. */
export const useLiveSupabase =
  import.meta.env.VITE_MOCK === "false" && Boolean(clientAllowed);

/** Browser-Client; `null` wenn URL/Key fehlen oder API vom aktuellen Host aus nicht erreichbar ist. */
export const supabase =
  clientAllowed && normalizedUrl && anon
    ? createClient(normalizedUrl, anon, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/**
 * Zweiter Client ohne Session-Persistenz: bleibt immer `anon` für öffentliche
 * Leserequests (z. B. Startseiten-Slider), auch wenn der Haupt-Client eingeloggt ist.
 */
export const supabasePublic =
  clientAllowed && normalizedUrl && anon
    ? createClient(normalizedUrl, anon, {
        auth: {
          flowType: "pkce",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

/** Wenn Mock aus ist, aber kein nutzbarer Client: erklärbare Fehlermeldung (Registrieren / Login). */
export function getSupabaseConnectionBlockedMessage(): string | null {
  if (import.meta.env.VITE_MOCK !== "false") return null;
  if (!rawUrl?.trim() || !anon?.trim()) {
    return "Supabase ist nicht konfiguriert: VITE_SUPABASE_URL (oder SUPABASE_URL) und VITE_SUPABASE_ANON_KEY (oder SUPABASE_ANON_KEY) in .env / .env.production.local bzw. CI-Secrets setzen.";
  }
  if (!isSupabaseApiReachableFromBrowser(normalizedUrl)) {
    return "Supabase ist von dieser Adresse aus nicht erreichbar (häufig: im Build noch localhost/127.0.0.1 statt der HTTPS-Cloud-URL). Bitte SUPABASE_URL auf https://<projekt>.supabase.co setzen und neu deployen.";
  }
  try {
    new URL(normalizedUrl);
  } catch {
    return "SUPABASE_URL ist ungültig.";
  }
  if (!supabase) {
    return "Supabase-Client konnte nicht erstellt werden.";
  }
  return null;
}
