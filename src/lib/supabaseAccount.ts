import {
  absenderFromMetadataOnly,
  pickAddressField,
} from "./auftraggeberAbsender";
import { supabase } from "./supabaseClient";
import { invokeFunctionWithAuth } from "./supabaseSession";

export type AuftraggeberProfile = {
  vorname: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  /** Durchschnitt aus Transporteur-Bewertungen (nur Anzeige) */
  bewertung?: number | null;
  bewertung_kommentar?: string | null;
};

function mapAuftraggeberRow(row: Record<string, unknown>): AuftraggeberProfile {
  return {
    vorname: String(row.vorname ?? ""),
    name: String(row.name ?? ""),
    strasse: String(row.strasse ?? ""),
    hausnummer: String(row.hausnummer ?? ""),
    plz: String(row.plz ?? ""),
    ort: String(row.ort ?? ""),
    telefon: String(row.telefon ?? ""),
    email: String(row.email ?? ""),
    bewertung:
      row.bewertung != null && Number.isFinite(Number(row.bewertung))
        ? Number(row.bewertung)
        : null,
    bewertung_kommentar:
      row.bewertung_kommentar != null
        ? String(row.bewertung_kommentar)
        : null,
  };
}

/** Aktuell eingeloggter User (JWT / Session) – entspricht `auth.uid()` in RLS. */
export async function getAuthenticatedAuthUser(): Promise<
  | {
      ok: true;
      id: string;
      email: string;
      userMetadata: Record<string, unknown>;
    }
  | { ok: false; error: string }
> {
  if (!supabase) {
    return { ok: false, error: "Supabase nicht konfiguriert" };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false, error: error.message };
  const user = data.user;
  if (!user?.id) {
    return { ok: false, error: "Nicht angemeldet. Bitte erneut einloggen." };
  }
  return {
    ok: true,
    id: user.id,
    email: user.email ?? "",
    userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  };
}

export function buildAuftraggeberInsertFromMetadata(
  userId: string,
  email: string,
  meta: Record<string, unknown>,
): Record<string, string> {
  const fromMeta = absenderFromMetadataOnly(meta);
  const local = email.split("@")[0] || `user-${userId.slice(0, 6)}`;
  const benutzername =
    String(meta.benutzername ?? "").trim() ||
    `${local}-${userId.slice(0, 4)}`.toLowerCase();

  return {
    id: userId,
    vorname: fromMeta?.vorname || pickAddressField("", meta.vorname) || " ",
    name: fromMeta?.name || pickAddressField("", meta.name) || " ",
    email: email.trim(),
    strasse: fromMeta?.strasse || pickAddressField("", meta.strasse) || " ",
    hausnummer:
      fromMeta?.hausnummer || pickAddressField("", meta.hausnummer) || " ",
    plz: fromMeta?.plz || pickAddressField("", meta.plz) || " ",
    ort: fromMeta?.ort || pickAddressField("", meta.ort) || " ",
    telefon: pickAddressField("", meta.telefon) || " ",
    benutzername,
  };
}

/**
 * Lädt das Profil des eingeloggten Users (`id = auth.uid()`).
 * Legt bei fehlender Zeile einen Eintrag aus Auth-Metadaten an.
 */
export async function fetchOrCreateAuftraggeberProfile(): Promise<
  { ok: true; data: AuftraggeberProfile } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };

  const auth = await getAuthenticatedAuthUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const userId = auth.id;

  const { data, error } = await supabase
    .from("auftraggeber")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    const hint =
      error.message.includes("permission denied")
        ? " Bitte SQL-Migration „026_auftraggeber_grants“ im Supabase SQL Editor ausführen."
        : "";
    return { ok: false, error: `${error.message}${hint}` };
  }

  if (data) {
    return {
      ok: true,
      data: mapAuftraggeberRow(data as Record<string, unknown>),
    };
  }

  const insertRow = buildAuftraggeberInsertFromMetadata(
    userId,
    auth.email,
    auth.userMetadata,
  );

  const { data: created, error: insertError } = await supabase
    .from("auftraggeber")
    .insert(insertRow)
    .select("*")
    .single();

  if (insertError) {
    const hint =
      insertError.message.includes("permission denied")
        ? " Bitte SQL-Migration „026_auftraggeber_grants“ im Supabase SQL Editor ausführen."
        : "";
    return { ok: false, error: `${insertError.message}${hint}` };
  }

  return {
    ok: true,
    data: mapAuftraggeberRow(created as Record<string, unknown>),
  };
}

export type TransporteurProfile = {
  firmenname: string;
  vorname_kontakt: string;
  name_kontakt: string;
  /** Handelsregister-/UID Nummer (Text) */
  uid?: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  /** Öffentlicher Username */
  benutzername?: string;
  /** Kürzel für Gebote (z. B. TX) */
  kuerzel?: string;
  /** Verifizierungsstatus (nur Anzeige) */
  verifiziert?: boolean;
  bewertung?: number | null;
  bewertung_kommentar?: string | null;
};

function normStr(v: unknown): string {
  return String(v ?? "").trim();
}

function pickMetaStr(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Zeile in `transporteure` aus Auth-Metadaten (Registrierung / Self-Heal). */
export function buildTransporteurInsertFromMetadata(
  uid: string,
  email: string,
  meta: Record<string, unknown>,
): Record<string, string> {
  const local = email.split("@")[0] || `user-${uid.slice(0, 6)}`;
  const benutzername =
    pickMetaStr(meta, "benutzername") ||
    `${local}-${uid.slice(0, 4)}`.toLowerCase();
  const kuerzelRaw = pickMetaStr(meta, "kuerzel").toUpperCase();
  const kuerzel = kuerzelRaw.length >= 2 ? kuerzelRaw.slice(0, 2) : "TX";

  return {
    id: uid,
    firmenname: pickMetaStr(meta, "firmenname"),
    vorname_kontakt: pickMetaStr(meta, "vorname_kontakt"),
    name_kontakt: pickMetaStr(meta, "name_kontakt"),
    uid: pickMetaStr(meta, "uid"),
    strasse: pickMetaStr(meta, "strasse"),
    plz: pickMetaStr(meta, "plz"),
    ort: pickMetaStr(meta, "ort"),
    telefon: pickMetaStr(meta, "telefon"),
    email: email.trim(),
    benutzername,
    kuerzel,
  };
}

function buildTransporteurPatchFromMetadata(
  meta: Record<string, unknown>,
  email: string,
): Partial<TransporteurProfile> {
  const kuerzelRaw = pickMetaStr(meta, "kuerzel").toUpperCase();
  const kuerzel = kuerzelRaw.length >= 2 ? kuerzelRaw.slice(0, 2) : "";
  return {
    firmenname: pickMetaStr(meta, "firmenname"),
    vorname_kontakt: pickMetaStr(meta, "vorname_kontakt"),
    name_kontakt: pickMetaStr(meta, "name_kontakt"),
    uid: pickMetaStr(meta, "uid"),
    strasse: pickMetaStr(meta, "strasse"),
    plz: pickMetaStr(meta, "plz"),
    ort: pickMetaStr(meta, "ort"),
    telefon: pickMetaStr(meta, "telefon"),
    email: email.trim(),
    benutzername: pickMetaStr(meta, "benutzername"),
    kuerzel: kuerzel || pickMetaStr(meta, "kuerzel"),
  };
}

function isEmptyLike(v: unknown): boolean {
  const s = normStr(v);
  return !s || s === "—";
}

function needsTransporteurHeal(row: Partial<TransporteurProfile> | null): boolean {
  if (!row) return true;
  // Wenn diese Kernfelder leer sind, ist der Datensatz faktisch „leer“ im UI
  return (
    isEmptyLike(row.firmenname) ||
    isEmptyLike(row.vorname_kontakt) ||
    isEmptyLike(row.name_kontakt) ||
    isEmptyLike(row.telefon) ||
    isEmptyLike(row.email) ||
    isEmptyLike(row.strasse) ||
    isEmptyLike(row.plz) ||
    isEmptyLike(row.ort)
  );
}

async function healTransporteurRowIfNeeded(
  userId: string,
  existing: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: true };
  const auth = await getAuthenticatedAuthUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.id !== userId) {
    return { ok: false, error: "Profil-Zugriff nur für den eigenen Account." };
  }

  const patchFromMeta = buildTransporteurPatchFromMetadata(
    auth.userMetadata,
    auth.email,
  );

  // Nur leere Felder nachziehen – nichts überschreiben, was schon befüllt ist.
  const next: Record<string, unknown> = {};
  const src = existing ?? {};
  const keys: (keyof TransporteurProfile)[] = [
    "firmenname",
    "vorname_kontakt",
    "name_kontakt",
    "uid",
    "strasse",
    "plz",
    "ort",
    "telefon",
    "email",
    "benutzername",
    "kuerzel",
  ];
  for (const k of keys) {
    const cur = src[k as string];
    const nxt = patchFromMeta[k];
    if (isEmptyLike(cur) && !isEmptyLike(nxt)) {
      next[k as string] = String(nxt ?? "").trim();
    }
  }

  if (Object.keys(next).length === 0) return { ok: true as const };
  const { error } = await supabase
    .from("transporteure")
    .update(next)
    .eq("id", userId);
  if (error) {
    const hint = error.message.includes("permission denied")
      ? " Bitte SQL-Migration „033_transporteure_grants_delete_rpc“ im Supabase SQL Editor ausführen."
      : "";
    return { ok: false as const, error: `${error.message}${hint}` };
  }
  return { ok: true as const };
}

const TRANSPORTEUR_PROFILE_SELECT =
  "firmenname, vorname_kontakt, name_kontakt, uid, strasse, plz, ort, telefon, email, benutzername, kuerzel, verifiziert, bewertung, bewertung_kommentar";

export async function fetchAuftraggeberProfile(
  userId: string,
): Promise<
  { ok: true; data: AuftraggeberProfile } | { ok: false; error: string }
> {
  const auth = await getAuthenticatedAuthUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.id !== userId) {
    return { ok: false, error: "Profil-Zugriff nur für den eigenen Account." };
  }
  return fetchOrCreateAuftraggeberProfile();
}

export async function fetchTransporteurProfile(
  userId: string,
): Promise<
  { ok: true; data: TransporteurProfile } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };

  const auth = await getAuthenticatedAuthUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.id !== userId) {
    return { ok: false, error: "Profil-Zugriff nur für den eigenen Account." };
  }

  const loadRow = async () => {
    const { data, error } = await supabase!
      .from("transporteure")
      .select(TRANSPORTEUR_PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();
    return { data, error };
  };

  let { data, error } = await loadRow();
  if (error) {
    const hint = error.message.includes("permission denied")
      ? " Bitte SQL-Migration „033_transporteure_grants_delete_rpc“ ausführen."
      : "";
    return { ok: false, error: `${error.message}${hint}` };
  }

  if (!data) {
    const insertRow = buildTransporteurInsertFromMetadata(
      userId,
      auth.email,
      auth.userMetadata,
    );
    const { error: insErr } = await supabase
      .from("transporteure")
      .insert(insertRow);
    if (insErr) {
      const hint = insErr.message.includes("permission denied")
        ? " Bitte SQL-Migration „033_transporteure_grants_delete_rpc“ ausführen."
        : "";
      return { ok: false, error: `${insErr.message}${hint}` };
    }
    ({ data, error } = await loadRow());
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Profil nicht gefunden" };
  }

  if (needsTransporteurHeal(data as Record<string, unknown>)) {
    const heal = await healTransporteurRowIfNeeded(
      userId,
      data as Record<string, unknown>,
    );
    if (!heal.ok) return { ok: false, error: heal.error };
    const again = await loadRow();
    if (again.error) return { ok: false, error: again.error.message };
    if (!again.data) return { ok: false, error: "Profil nicht gefunden" };
    data = again.data;
  }

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
      hausnummer: patch.hausnummer.trim(),
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
      uid: String(patch.uid ?? "").trim(),
      strasse: patch.strasse.trim(),
      plz: patch.plz.trim(),
      ort: patch.ort.trim(),
      telefon: patch.telefon.trim(),
      email: patch.email.trim(),
      benutzername: String(patch.benutzername ?? "").trim() || null,
      kuerzel: String(patch.kuerzel ?? "").trim().toUpperCase() || null,
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

  const auth = await getAuthenticatedAuthUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data, error, authError } = await invokeFunctionWithAuth<{
    ok?: boolean;
    error?: string;
  }>("delete-my-profile", {});
  if (authError !== "unauthorized" && !error) {
    const body = data as { ok?: boolean; error?: string } | null;
    if (body?.ok === true) return { ok: true };
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc("delete_my_account");
  if (rpcErr) {
    const hint = rpcErr.message.includes("Could not find")
      ? " Bitte SQL-Migration „033_transporteure_grants_delete_rpc“ im Supabase SQL Editor ausführen."
      : "";
    return { ok: false, error: `${rpcErr.message}${hint}` };
  }
  const row = rpcData as { ok?: boolean; error?: string } | null;
  if (row?.ok === true) return { ok: true };
  return {
    ok: false,
    error: row?.error ?? "Profil konnte nicht gelöscht werden.",
  };
}
