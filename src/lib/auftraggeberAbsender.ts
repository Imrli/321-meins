import { supabase } from "./supabaseClient";
import {
  fetchOrCreateAuftraggeberProfile,
  type AuftraggeberProfile,
} from "./supabaseAccount";

/** Absender-Adresse für das Auktionsformular (aus `public.auftraggeber`). */
export type AbsenderProfil = {
  vorname: string;
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
};

export const EMPTY_ABSENDER: AbsenderProfil = {
  vorname: "",
  name: "",
  strasse: "",
  hausnummer: "",
  plz: "",
  ort: "",
};

export function isAbsenderPlaceholder(v: string): boolean {
  const t = v.trim();
  return t === "" || t === "—" || t === "-" || t === "–";
}

export function pickAddressField(db: string, meta?: unknown): string {
  const d = String(db ?? "").trim();
  if (!isAbsenderPlaceholder(d)) return d;
  const m = String(meta ?? "").trim();
  return isAbsenderPlaceholder(m) ? "" : m;
}

/** Strasse aus DB/Meta; falls nur kombiniert in strasse, hausnummer leer lassen. */
function strasseFromProfile(
  profile: AuftraggeberProfile,
  meta: Record<string, unknown>,
): string {
  return pickAddressField(profile.strasse, meta.strasse);
}

function hausnummerFromProfile(
  profile: AuftraggeberProfile,
  meta: Record<string, unknown>,
): string {
  const hn = pickAddressField(profile.hausnummer, meta.hausnummer);
  if (hn) return hn;
  return "";
}

export function absenderFromProfileAndMetadata(
  profile: AuftraggeberProfile,
  meta: Record<string, unknown>,
): AbsenderProfil {
  return {
    vorname: pickAddressField(profile.vorname, meta.vorname),
    name: pickAddressField(profile.name, meta.name),
    strasse: strasseFromProfile(profile, meta),
    hausnummer: hausnummerFromProfile(profile, meta),
    plz: pickAddressField(profile.plz, meta.plz),
    ort: pickAddressField(profile.ort, meta.ort),
  };
}

export function absenderFromMetadataOnly(
  meta: Record<string, unknown>,
): AbsenderProfil | null {
  const data: AbsenderProfil = {
    vorname: pickAddressField("", meta.vorname),
    name: pickAddressField("", meta.name),
    strasse: pickAddressField("", meta.strasse),
    hausnummer: pickAddressField("", meta.hausnummer),
    plz: pickAddressField("", meta.plz),
    ort: pickAddressField("", meta.ort),
  };
  return Object.values(data).some((v) => v.length > 0) ? data : null;
}

export function isAbsenderComplete(a: AbsenderProfil): boolean {
  const hasStreet =
    !isAbsenderPlaceholder(a.strasse) || !isAbsenderPlaceholder(a.hausnummer);
  return (
    !isAbsenderPlaceholder(a.vorname) &&
    !isAbsenderPlaceholder(a.name) &&
    hasStreet &&
    !isAbsenderPlaceholder(a.plz) &&
    !isAbsenderPlaceholder(a.ort)
  );
}

export async function authUserMetadata(): Promise<Record<string, unknown>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getUser();
  return (data.user?.user_metadata ?? {}) as Record<string, unknown>;
}

/**
 * Lädt Absenderdaten aus `public.auftraggeber`, mit Fallback auf Auth-Metadaten.
 */
export async function resolveAuftraggeberAbsender(
  _userId?: string,
): Promise<
  | { ok: true; data: AbsenderProfil }
  | { ok: false; error: string; data: AbsenderProfil }
> {
  const meta = await authUserMetadata();

  const profileResult = await fetchOrCreateAuftraggeberProfile();
  if (profileResult.ok) {
    const merged = absenderFromProfileAndMetadata(profileResult.data, meta);
    if (isAbsenderComplete(merged)) {
      return { ok: true, data: merged };
    }
    const metaOnly = absenderFromMetadataOnly(meta);
    if (metaOnly && isAbsenderComplete(metaOnly)) {
      return { ok: true, data: metaOnly };
    }
    return {
      ok: false,
      error:
        "Dein Profil ist unvollständig. Bitte ergänze Vorname, Name und Adresse unter „Mein Konto“.",
      data: merged,
    };
  }

  const metaOnly = absenderFromMetadataOnly(meta);
  if (metaOnly && isAbsenderComplete(metaOnly)) {
    return { ok: true, data: metaOnly };
  }

  return {
    ok: false,
    error:
      profileResult.error ||
      "Profil konnte nicht geladen werden. Bitte Migration „025_auftraggeber_ensure“ in Supabase ausführen.",
    data: metaOnly ?? EMPTY_ABSENDER,
  };
}
