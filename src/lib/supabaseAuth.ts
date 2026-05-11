import type { User } from "@supabase/supabase-js";
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
  return null;
}

export function authRedirectOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  return "http://127.0.0.1:5173";
}
