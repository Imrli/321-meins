import type { AuthResponse, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type UserRole = "auftraggeber" | "transporteur";

export type AuthUserLite = {
  username: string;
  role: UserRole;
  initials?: string;
  userId: string;
  email: string;
};

export async function resolveLoginEmail(
  identifier: string,
  role: UserRole,
): Promise<string | null> {
  if (!supabase) return null;
  const raw = identifier.trim();
  if (raw.includes("@")) return raw;
  const table = role === "auftraggeber" ? "auftraggeber" : "transporteure";
  const { data, error } = await supabase
    .from(table)
    .select("email")
    .eq("benutzername", raw)
    .maybeSingle();
  if (error || !data?.email) return null;
  return data.email as string;
}

export async function loadAuthUserFromSession(
  sessionUser: User,
): Promise<AuthUserLite | null> {
  if (!supabase) return null;
  const { data: ag } = await supabase
    .from("auftraggeber")
    .select("benutzername")
    .eq("id", sessionUser.id)
    .maybeSingle();
  if (ag?.benutzername) {
    return {
      userId: sessionUser.id,
      email: sessionUser.email ?? "",
      username: ag.benutzername as string,
      role: "auftraggeber",
    };
  }
  const { data: tr } = await supabase
    .from("transporteure")
    .select("benutzername, kuerzel")
    .eq("id", sessionUser.id)
    .maybeSingle();
  if (tr?.benutzername) {
    return {
      userId: sessionUser.id,
      email: sessionUser.email ?? "",
      username: tr.benutzername as string,
      role: "transporteur",
      initials: (tr.kuerzel as string) ?? undefined,
    };
  }
  return authUserLiteFromMetadata(sessionUser);
}

/** Fallback, wenn die Profilzeile noch nicht lesbar ist (z. B. direkt nach E-Mail-Link). */
export function authUserLiteFromMetadata(
  sessionUser: User,
): AuthUserLite | null {
  const meta = sessionUser.user_metadata ?? {};
  const role = meta.app_role as string | undefined;
  const benutzername =
    (typeof meta.benutzername === "string" && meta.benutzername.trim()) ||
    sessionUser.email?.split("@")[0] ||
    "";
  if (!benutzername) return null;

  if (role === "transporteur" || meta.firmenname) {
    const kuerzel =
      typeof meta.kuerzel === "string" ? meta.kuerzel : undefined;
    return {
      userId: sessionUser.id,
      email: sessionUser.email ?? "",
      username: benutzername,
      role: "transporteur",
      initials: kuerzel,
    };
  }
  if (role === "auftraggeber" || meta.vorname || meta.name) {
    return {
      userId: sessionUser.id,
      email: sessionUser.email ?? "",
      username: benutzername,
      role: "auftraggeber",
    };
  }
  return null;
}

const PRODUCTION_SITE_HOSTS = new Set(["321-meins.ch", "www.321-meins.ch"]);

/** Redirect-URL für signUp / Passwort-Reset – Produktion immer HTTPS. */
export function authRedirectOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname, protocol, port } = window.location;
    if (PRODUCTION_SITE_HOSTS.has(hostname)) {
      return `https://${hostname}`;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const p = port ? `:${port}` : ":5173";
      return `${protocol}//${hostname}${p}`;
    }
    return window.location.origin;
  }
  return "http://127.0.0.1:5173";
}

/** PKCE-Code oder Token in URL – nicht mit App-Hash-Routing verwechseln / nicht löschen. */
export function isAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has("code")) return true;
  if (params.has("error") || params.has("error_description")) return true;

  const hash = window.location.hash.slice(1).trim();
  if (!hash || hash.startsWith("/")) return false;
  return /(?:^|&)(access_token|refresh_token|type)=/.test(hash);
}

/** Nach Klick auf „Confirm email“: ?code=… gegen Session tauschen (PKCE). */
export async function completeAuthCallbackFromUrl(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!supabase || typeof window === "undefined") return { ok: true };

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, error: error.message };
    stripAuthParamsFromUrl();
    return { ok: true };
  }

  if (isAuthCallbackInUrl()) {
    const { error } = await supabase.auth.getSession();
    if (error) return { ok: false, error: error.message };
    stripAuthParamsFromUrl();
  }
  return { ok: true };
}

export function stripAuthParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.delete("code");
  u.searchParams.delete("state");
  u.searchParams.delete("error");
  u.searchParams.delete("error_description");

  const hash = u.hash.slice(1).trim();
  if (hash && !hash.startsWith("/") && /access_token=/.test(hash)) {
    u.hash = "";
  }

  const next =
    u.pathname +
    (u.searchParams.toString() ? `?${u.searchParams}` : "") +
    u.hash;
  window.history.replaceState({}, "", next);
}

export type SignUpFinishResult =
  | { status: "login"; auth: AuthUserLite }
  | { status: "email_confirmation"; email: string }
  | { status: "error"; message: string };

/** Supabase-Fehlermeldungen für die UI (Deutsch). */
export function formatSupabaseAuthError(message: string): string {
  const m = message.trim();
  const rate =
    /for security purposes, you can only request this after (\d+) seconds?\.?/i.exec(
      m,
    );
  if (rate) {
    return `Aus Sicherheitsgründen bitte ${rate[1]} Sekunden warten und es erneut versuchen.`;
  }
  if (/user already registered/i.test(m)) {
    return "Diese E-Mail ist bereits registriert. Bitte anmelden oder „Passwort vergessen“ nutzen.";
  }
  return m;
}

/** Nach `signUp`: einloggen, E-Mail-Bestätigung anzeigen oder Fehler – nie stillschweigend enden. */
export async function resolveSignUpFinish(
  data: AuthResponse["data"],
  role: UserRole,
  fallbackUsername: string,
  fallbackInitials?: string,
): Promise<SignUpFinishResult> {
  if (!supabase) {
    return { status: "error", message: "Supabase nicht verbunden." };
  }

  const user = data.user;
  if (!user) {
    return {
      status: "error",
      message: "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
    };
  }

  if (user.identities && user.identities.length === 0) {
    return {
      status: "error",
      message:
        "Diese E-Mail ist bereits registriert. Bitte anmelden oder „Passwort vergessen“ nutzen.",
    };
  }

  const session =
    data.session ?? (await supabase.auth.getSession()).data.session;

  if (!session) {
    return {
      status: "email_confirmation",
      email: user.email ?? "",
    };
  }

  let au = await loadAuthUserFromSession(session.user);
  if (!au) {
    await new Promise((r) => setTimeout(r, 400));
    au = await loadAuthUserFromSession(session.user);
  }

  if (au) {
    if (au.role !== role) {
      return {
        status: "error",
        message:
          "Diese E-Mail ist bereits mit einer anderen Rolle registriert.",
      };
    }
    return { status: "login", auth: au };
  }

  return {
    status: "login",
    auth: {
      userId: session.user.id,
      email: session.user.email ?? "",
      username: fallbackUsername,
      role,
      initials: fallbackInitials,
    },
  };
}
