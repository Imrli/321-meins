import { supabase } from "./supabaseClient";

export type AuthSessionResult =
  | { ok: true; accessToken: string; userId: string }
  | { ok: false; error: string };

/**
 * Stellt sicher, dass der Browser-Client eine gültige Session hat (Refresh + getUser).
 * Wird vor Zahlungs-RPCs und Edge-Function-Aufrufen benötigt, damit auth.uid() greift.
 */
export async function ensureAuthenticatedSession(): Promise<AuthSessionResult> {
  if (!supabase) return { ok: false, error: "no_client" };

  let { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  if (!session?.access_token) {
    const { data: refreshed, error: refreshErr } =
      await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session?.access_token) {
      return { ok: false, error: "unauthorized" };
    }
    session = refreshed.session;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  return {
    ok: true,
    accessToken: session.access_token,
    userId: userData.user.id,
  };
}

export async function invokeFunctionWithAuth<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null; authError?: string }> {
  if (!supabase) {
    return { data: null, error: new Error("no_client"), authError: "no_client" };
  }

  const auth = await ensureAuthenticatedSession();
  if (!auth.ok) {
    return { data: null, error: new Error(auth.error), authError: auth.error };
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });

  return {
    data: data as T | null,
    error: error ? new Error(error.message ?? "invoke_failed") : null,
  };
}
