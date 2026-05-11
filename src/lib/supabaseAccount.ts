import { supabase } from "./supabaseClient";

export type AuftraggeberProfile = {
  vorname: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  /** Durchschnitt aus Transporteur-Bewertungen (nur Anzeige) */
  bewertung?: number | null;
  bewertung_kommentar?: string | null;
};

export type TransporteurProfile = {
  firmenname: string;
  vorname_kontakt: string;
  name_kontakt: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  bewertung?: number | null;
  bewertung_kommentar?: string | null;
};

export async function fetchAuftraggeberProfile(
  userId: string,
): Promise<
  { ok: true; data: AuftraggeberProfile } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { data, error } = await supabase
    .from("auftraggeber")
    .select("vorname, name, strasse, plz, ort, telefon, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Profil nicht gefunden" };
  return { ok: true, data: data as AuftraggeberProfile };
}

export async function fetchTransporteurProfile(
  userId: string,
): Promise<
  { ok: true; data: TransporteurProfile } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { data, error } = await supabase
    .from("transporteure")
    .select(
      "firmenname, vorname_kontakt, name_kontakt, strasse, plz, ort, telefon, email, bewertung, bewertung_kommentar",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Profil nicht gefunden" };
  return { ok: true, data: data as TransporteurProfile };
}

export async function updateAuftraggeberProfile(
  userId: string,
  patch: AuftraggeberProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { error } = await supabase
    .from("auftraggeber")
    .update({
      vorname: patch.vorname.trim(),
      name: patch.name.trim(),
      strasse: patch.strasse.trim(),
      plz: patch.plz.trim(),
      ort: patch.ort.trim(),
      telefon: patch.telefon.trim(),
      email: patch.email.trim(),
    })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateTransporteurProfile(
  userId: string,
  patch: TransporteurProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { error } = await supabase
    .from("transporteure")
    .update({
      firmenname: patch.firmenname.trim(),
      vorname_kontakt: patch.vorname_kontakt.trim(),
      name_kontakt: patch.name_kontakt.trim(),
      strasse: patch.strasse.trim(),
      plz: patch.plz.trim(),
      ort: patch.ort.trim(),
      telefon: patch.telefon.trim(),
      email: patch.email.trim(),
    })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAuthPassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function invokeDeleteMyProfile(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { data, error } = await supabase.functions.invoke("delete-my-profile", {
    method: "POST",
  });
  if (error) return { ok: false, error: error.message };
  const body = data as { ok?: boolean; error?: string } | null;
  if (!body?.ok) {
    return { ok: false, error: body?.error ?? "Profil konnte nicht gelöscht werden." };
  }
  return { ok: true };
}
