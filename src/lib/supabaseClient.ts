import { createClient } from "@supabase/supabase-js";

const url =
  import.meta.env.SUPABASE_URL?.trim() ||
  import.meta.env.VITE_SUPABASE_URL?.trim();
const anon =
  import.meta.env.SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anon);

/** Browser-Client; nur nutzen wenn `isSupabaseConfigured`. */
export const supabase =
  url && anon ? createClient(url, anon) : null;

/**
 * Zweiter Client ohne Session-Persistenz: bleibt immer `anon` für öffentliche
 * Leserequests (z. B. Startseiten-Slider), auch wenn der Haupt-Client eingeloggt ist.
 */
export const supabasePublic =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
