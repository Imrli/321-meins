import {
  buildAuftraggeberInsertFromMetadata,
  buildTransporteurInsertFromMetadata,
} from "./supabaseAccount";
import {
  authUserMetadata,
  pickAddressField,
} from "./auftraggeberAbsender";
import {
  auctionNowForDbFilter,
  parseAuctionTimestamptzCh,
  toAuctionTimestamptzCh,
} from "./chTime";
import {
  ensureAuthenticatedSession,
  invokeFunctionWithAuth,
} from "./supabaseSession";
import { supabase, supabasePublic } from "./supabaseClient";
import { generateUuidV4 } from "./uuid";
import type { Auction, AuctionDraft, Bid } from "../types/auction";
import type { DienstleistungTyp } from "../types/dienstleistungTyp";
import {
  dienstleistungTypFromDraft,
  isDienstleistungTyp,
} from "../types/dienstleistungTyp";
import type { ReinigungDetails } from "../types/reinigungDetails";
import type { UmzugDetails } from "../types/umzugDetails";

/** Eindeutige Anzeige-ID (DB: auktionen.anzeige_id UNIQUE). */
function anzeigeIdNew(): string {
  const n =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return `A-${n}`;
}

type RowAuktion = {
  id: string;
  anzeige_id: string | null;
  auftraggeber_id: string;
  startort: string;
  zielort: string;
  abholdatum: string | null;
  lieferdatum: string | null;
  lieferzeit: string | null;
  hoehe: string | null;
  breite: string | null;
  tiefe: string | null;
  gewicht: string | null;
  notizen: string | null;
  empf_vorname?: string | null;
  empf_name?: string | null;
  empf_strasse?: string | null;
  empf_plz?: string | null;
  empf_ort?: string | null;
  abs_vorname?: string | null;
  abs_name?: string | null;
  abs_strasse?: string | null;
  abs_plz?: string | null;
  abs_ort?: string | null;
  abs_email?: string | null;
  abs_telefon?: string | null;
  startpreis: number | string;
  aktuelles_gebot: number | string | null;
  dauer_sekunden: number;
  status: string;
  bilder_urls: unknown;
  dienstleistung_typ?: string | null;
  abgabegarantie?: boolean | null;
  umzug_details?: Record<string, unknown> | null;
  reinigung_details?: Record<string, unknown> | null;
  erstellt_am: string;
  endet_am: string;
  awarded_betrag: number | string | null;
  awarded_transporteur_id: string | null;
  awarded_at: string | null;
  rejected_at: string | null;
  freigegeben_am?: string | null;
  qr_token?: string | null;
  payment_intent_id?: string | null;
  gebote?: RowGebot[] | null;
  auftraggeber?:
    | { benutzername: string; email?: string | null; telefon?: string | null }
    | { benutzername: string; email?: string | null; telefon?: string | null }[]
    | null;
};

type RowGebot = {
  betrag: number | string;
  kuerzel: string;
  erstellt_am: string;
  bidder_key: string | null;
  transporteur_id: string;
  transporteure?:
    | { verifiziert: boolean; bewertung?: number | string | null }
    | { verifiziert: boolean; bewertung?: number | string | null }[]
    | null;
};

/** Status nach QR-Scan / Zahlungsfreigabe – aus Dashboard nach 3 Tagen ausblenden. */
export const COMPLETED_AUCTION_STATUSES = [
  "bezahlt",
  "geliefert",
  "abgeschlossen",
] as const;

export const DASHBOARD_COMPLETED_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000;

function completedAuctionStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (COMPLETED_AUCTION_STATUSES as readonly string[]).includes(status);
}

/** ISO-Zeitstempel: ältester sichtbarer Freigabe-Zeitpunkt (3 Tage). */
export function dashboardCompletedVisibilityCutoffIso(
  nowMs = Date.now(),
): string {
  return new Date(nowMs - DASHBOARD_COMPLETED_VISIBLE_MS).toISOString();
}

/** PostgREST-OR: laufende ODER kürzlich freigegebene abgeschlossene Auktionen. */
export function dashboardAuctionVisibilityOrFilter(nowMs = Date.now()): string {
  const cutoff = dashboardCompletedVisibilityCutoffIso(nowMs);
  return `status.not.in.(${COMPLETED_AUCTION_STATUSES.join(",")}),freigegeben_am.gt.${cutoff}`;
}

/** Client-Fallback (Mock / bereits geladene Listen). */
export function isDashboardVisibleAuction(
  auction: Pick<Auction, "auctionStatus" | "freigegebenAt">,
  nowMs = Date.now(),
): boolean {
  if (!completedAuctionStatus(auction.auctionStatus)) return true;
  if (auction.freigegebenAt == null) return true;
  return auction.freigegebenAt > nowMs - DASHBOARD_COMPLETED_VISIBLE_MS;
}

function mapLieferzeit(
  v: string | null | undefined,
): Auction["lieferzeitpraeferenz"] | undefined {
  if (v === "vormittags" || v === "nachmittags" || v === "flexibel")
    return v;
  return undefined;
}

function safeIsoDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.slice(0, 10);
}

function safePositiveNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeGebote(raw: unknown): RowGebot[] {
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as RowGebot[]) : [];
}

function mapRowGebot(g: RowGebot): Bid {
  const raw = g.transporteure;
  const tr = Array.isArray(raw) ? raw[0] : raw;
  const trow =
    tr != null && typeof tr === "object"
      ? (tr as { verifiziert?: boolean; bewertung?: number | string | null })
      : null;
  const verifiziert = trow?.verifiziert === true;
  let bewertung: number | null | undefined;
  if (trow && "bewertung" in trow) {
    const bw = trow.bewertung;
    if (bw == null || bw === "") bewertung = null;
    else {
      const n = typeof bw === "number" ? bw : Number(bw);
      bewertung = Number.isFinite(n)
        ? Math.min(5, Math.max(0, Math.round(n * 10) / 10))
        : null;
    }
  } else bewertung = undefined;

  const price = Number(g.betrag);
  return {
    initials: String(g.kuerzel ?? "TX").trim() || "TX",
    price: Number.isFinite(price) ? price : 0,
    ts: parseAuctionTimestamptzCh(g.erstellt_am),
    bidderKey: g.bidder_key?.trim() ? g.bidder_key : undefined,
    verifiziert: verifiziert ? true : undefined,
    bewertung,
  };
}

export function parseJsonObject<T extends Record<string, unknown>>(
  raw: unknown,
): T | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as T;
}

function dbDienstleistungTyp(row: RowAuktion): DienstleistungTyp {
  if (row.dienstleistung_typ && isDienstleistungTyp(row.dienstleistung_typ)) {
    return row.dienstleistung_typ;
  }
  if (row.umzug_details && row.reinigung_details) return "umzug_reinigung";
  if (row.umzug_details) return "umzug";
  if (row.reinigung_details) return "reinigung";
  return "transport";
}

function dbRowToAuction(row: RowAuktion): Auction {
  const dienstleistungTyp = dbDienstleistungTyp(row);
  const bids: Bid[] = normalizeGebote(row.gebote).map((g) => mapRowGebot(g));
  bids.sort((a, b) => b.ts - a.ts);

  const rawAg = row.auftraggeber;
  const ag = Array.isArray(rawAg) ? rawAg[0] : rawAg;
  const ownerUsername = ag?.benutzername?.trim() || "—";
  const startort = String(row.startort ?? "").trim() || "—";
  const zielort = String(row.zielort ?? "").trim() || "—";
  const startPrice = safePositiveNumber(row.startpreis, 1);
  const durationMs = safePositiveNumber(row.dauer_sekunden, 60) * 1000;
  const startedAt = parseAuctionTimestamptzCh(row.erstellt_am);
  const endsAtFromDuration = startedAt + durationMs;
  const endsAtFromColumn = parseAuctionTimestamptzCh(
    row.endet_am,
    endsAtFromDuration,
  );
  /** Stabile Countdown-Dauer: `dauer_sekunden` ist maßgeblich (vermeidet TZ-Sprünge). */
  let endsAt = endsAtFromDuration;
  if (
    endsAtFromColumn >= startedAt &&
    Math.abs(endsAtFromColumn - endsAtFromDuration) <= 120_000
  ) {
    endsAt = endsAtFromColumn;
  }
  const durationMsResolved = durationMs;
  const ownerEmail =
    ag && "email" in ag && ag.email != null && String(ag.email).trim() !== ""
      ? String(ag.email).trim()
      : undefined;
  const ownerTelefon =
    ag &&
    "telefon" in ag &&
    ag.telefon != null &&
    String(ag.telefon).trim() !== ""
      ? String(ag.telefon).trim()
      : undefined;
  const anzeige = row.anzeige_id?.trim() || row.id;

  let awardedBid: Bid | undefined;
  if (row.awarded_betrag != null) {
    const amt = Number(row.awarded_betrag);
    const win = bids.find((b) => Math.abs(b.price - amt) < 1e-6);
    if (win) awardedBid = { ...win };
  }

  const imgs = row.bilder_urls;
  const imageDataUrls = Array.isArray(imgs)
    ? (imgs as string[])
    : [];

  return {
    id: anzeige,
    auctionUuid: row.id,
    ownerUsername,
    dienstleistungTyp,
    abgabegarantie: row.abgabegarantie ?? false,
    umzugDetails: parseJsonObject<UmzugDetails>(row.umzug_details),
    reinigungDetails: parseJsonObject<ReinigungDetails>(row.reinigung_details),
    startort,
    zielort,
    awardedTransporteurId: row.awarded_transporteur_id ?? undefined,
    absVorname: row.abs_vorname ?? undefined,
    absName: row.abs_name ?? undefined,
    absStrasse: row.abs_strasse ?? undefined,
    absPlz: row.abs_plz ?? undefined,
    absOrt: row.abs_ort ?? undefined,
    absEmail: row.abs_email ?? undefined,
    absTelefon: row.abs_telefon ?? undefined,
    ownerEmail,
    ownerTelefon,
    hoehe: row.hoehe ?? undefined,
    breite: row.breite ?? undefined,
    tiefe: row.tiefe ?? undefined,
    gewicht: row.gewicht ?? undefined,
    notizen: row.notizen ?? undefined,
    abholdatum: safeIsoDate(row.abholdatum),
    empfVorname: row.empf_vorname ?? undefined,
    empfName: row.empf_name ?? undefined,
    empfStrasse: row.empf_strasse ?? undefined,
    empfPlz: row.empf_plz ?? undefined,
    empfOrt: row.empf_ort ?? undefined,
    lieferdatum: safeIsoDate(row.lieferdatum),
    lieferzeitpraeferenz: mapLieferzeit(row.lieferzeit),
    imageDataUrls,
    startPrice,
    durationMs: durationMsResolved,
    startedAt,
    endsAt,
    bids,
    awardedAt: row.awarded_at
      ? parseAuctionTimestamptzCh(row.awarded_at, startedAt)
      : undefined,
    awardedBid,
    rejectedAt: row.rejected_at
      ? parseAuctionTimestamptzCh(row.rejected_at, startedAt)
      : undefined,
    freigegebenAt: row.freigegeben_am
      ? parseAuctionTimestamptzCh(row.freigegeben_am, startedAt)
      : undefined,
    qrToken: row.qr_token ? String(row.qr_token) : undefined,
    auctionStatus:
      row.status != null && String(row.status).trim() !== ""
        ? String(row.status)
        : undefined,
  };
}

function rowsToAuctions(rows: unknown[]): Auction[] {
  const out: Auction[] = [];
  for (const row of rows) {
    try {
      out.push(dbRowToAuction(row as RowAuktion));
    } catch (e) {
      console.warn("[supabase] dbRowToAuction skipped row", e, row);
    }
  }
  return out;
}

/**
 * Nach Gebot/Refresh: nie lokale Gebote verlieren, wenn die DB-Antwort
 * (Timing/RLS) noch leer ist oder weniger Gebote enthält.
 */
export function mergeAuctionLists(
  previous: Auction[],
  fresh: Auction[],
): Auction[] {
  if (fresh.length === 0) return previous;
  const prevById = new Map(previous.map((a) => [a.id, a]));
  const merged = fresh.map((f) => {
    const p = prevById.get(f.id);
    if (!p || f.bids.length >= p.bids.length) return f;
    return { ...f, bids: p.bids };
  });
  const freshIds = new Set(fresh.map((a) => a.id));
  for (const p of previous) {
    if (!freshIds.has(p.id)) merged.push(p);
  }
  return merged;
}

export async function fetchAuctionsForUser(): Promise<Auction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("auktionen")
    .select(
      `
      *,
      gebote (
        *,
        transporteure ( verifiziert, bewertung )
      ),
      auftraggeber ( benutzername, email, telefon )
    `,
    )
    .or(dashboardAuctionVisibilityOrFilter())
    .order("erstellt_am", { ascending: false });

  if (error || !data) {
    console.warn("[supabase] fetchAuctionsForUser", error);
    return [];
  }
  return rowsToAuctions(data as unknown[]);
}

const liveAuctionListSelect = `
  *,
  gebote (
    *,
    transporteure ( verifiziert, bewertung )
  )
`;

const homepageSliderSelect = liveAuctionListSelect;

/**
 * Gleiche Abfrage wie Hero / LiveAuctionTable-Vorschau:
 * anon-Client + `auktionen_select_anon_homepage_slider` (nicht Transporteur-RLS).
 */
async function fetchLiveAuctionsHeroQuery(): Promise<Auction[]> {
  if (!supabasePublic) return [];
  const nowFilter = auctionNowForDbFilter();
  const { data, error } = await supabasePublic
    .from("auktionen")
    .select(homepageSliderSelect)
    .eq("status", "live")
    .gt("endet_am", nowFilter)
    .is("rejected_at", null)
    .order("endet_am", { ascending: true });

  if (error || !data) {
    console.warn("[supabase] fetchLiveAuctionsHeroQuery", error);
    return [];
  }
  return rowsToAuctions(data as unknown[]);
}

/** Öffentliche Live-Auktionen für den Startseiten-Slider (immer anon-Client). */
export async function fetchHomepageSliderLiveAuctions(): Promise<Auction[]> {
  return fetchLiveAuctionsHeroQuery();
}

/** Transporteur-Dashboard: Live + eigene Gebote + Zuschlag (RLS), ohne >3-Tage-abgeschlossene. */
export async function fetchDashboardAuctionsForTransporteur(): Promise<Auction[]> {
  const client = supabase ?? supabasePublic;
  if (!client) return [];
  const { data, error } = await client
    .from("auktionen")
    .select(liveAuctionListSelect)
    .or(dashboardAuctionVisibilityOrFilter())
    .order("erstellt_am", { ascending: false });

  if (error || !data) {
    console.warn("[supabase] fetchDashboardAuctionsForTransporteur", error);
    return fetchLiveAuctionsForTransporteur();
  }
  return rowsToAuctions(data as unknown[]);
}

/** Transporteur-Dashboard: eingeloggt + Gebote per `gebote_select_transporteur_live`. */
export async function fetchLiveAuctionsForTransporteur(): Promise<Auction[]> {
  const client = supabase ?? supabasePublic;
  if (!client) return [];
  const nowFilter = auctionNowForDbFilter();
  const { data, error } = await client
    .from("auktionen")
    .select(liveAuctionListSelect)
    .eq("status", "live")
    .gt("endet_am", nowFilter)
    .is("rejected_at", null)
    .order("endet_am", { ascending: true });

  if (error || !data) {
    console.warn("[supabase] fetchLiveAuctionsForTransporteur", error);
    return fetchLiveAuctionsHeroQuery();
  }
  return rowsToAuctions(data as unknown[]);
}

async function uploadDataUrlsToAuftragsbilder(
  userId: string,
  dataUrls: string[],
): Promise<string[]> {
  if (!supabase || dataUrls.length === 0) return dataUrls;
  const out: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const u = dataUrls[i];
    if (!u.startsWith("data:")) {
      out.push(u);
      continue;
    }
    const m = u.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) {
      out.push(u);
      continue;
    }
    const mime = m[1];
    const b64 = m[2];
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${userId}/${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("auftragsbilder")
      .upload(path, bin, { contentType: mime, upsert: true });
    if (upErr) {
      console.warn("[supabase] upload bild", upErr);
      out.push(u);
      continue;
    }
    const { data: pub } = supabase.storage
      .from("auftragsbilder")
      .getPublicUrl(path);
    if (pub?.publicUrl) out.push(pub.publicUrl);
  }
  return out;
}

/** Liest die JWT-Sub aus der aktiven Session (== `auth.uid()` in RLS). */
async function getSessionUserId(): Promise<{
  uid: string;
  email: string | null;
} | null> {
  if (!supabase) return null;
  const first = await supabase.auth.getSession();
  let session = first.data.session;
  if (!session?.user?.id) {
    const ref = await supabase.auth.refreshSession();
    session = ref.data.session ?? null;
  }
  if (!session?.user?.id) return null;
  return { uid: session.user.id, email: session.user.email ?? null };
}

/**
 * Stellt sicher, dass für die User-ID eine Zeile in `public.auftraggeber`
 * existiert. Verhindert, dass der INSERT in `auktionen` an der FK-Constraint
 * scheitert (z. B. wenn der Profil-Trigger `handle_new_user` nicht gelaufen ist).
 */
async function ensureAuftraggeberRow(
  uid: string,
  email: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert." };

  const { data: existing, error: selErr } = await supabase
    .from("auftraggeber")
    .select("id")
    .eq("id", uid)
    .maybeSingle();
  if (selErr) {
    console.warn("[supabase] auftraggeber select", selErr);
  }
  if (existing?.id) return { ok: true };

  const meta = await authUserMetadata();
  const { error: insErr } = await supabase
    .from("auftraggeber")
    .insert(buildAuftraggeberInsertFromMetadata(uid, email ?? "", meta));
  if (insErr) {
    console.error("[supabase] auftraggeber self-heal insert", insErr);
    return {
      ok: false,
      error:
        insErr.message ||
        "Auftraggeber-Profil konnte nicht angelegt werden.",
    };
  }
  return { ok: true };
}

/** RLS `auktionen_select_transporteur_live` erfordert Zeile in `transporteure`. */
export async function ensureTransporteurRow(
  uid: string,
  email: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert." };

  const { data: existing, error: selErr } = await supabase
    .from("transporteure")
    .select("id")
    .eq("id", uid)
    .maybeSingle();
  if (selErr) {
    console.warn("[supabase] transporteure select", selErr);
  }
  if (existing?.id) return { ok: true };

  const meta = await authUserMetadata();
  if (meta.app_role !== "transporteur" && !meta.firmenname) {
    return {
      ok: false,
      error:
        "Kein Transporteur-Profil. Bitte Registrierung abschliessen oder Support kontaktieren.",
    };
  }

  const { error: insErr } = await supabase
    .from("transporteure")
    .insert(buildTransporteurInsertFromMetadata(uid, email ?? "", meta));
  if (insErr) {
    console.error("[supabase] transporteure self-heal insert", insErr);
    return {
      ok: false,
      error:
        insErr.message ||
        "Transporteur-Profil konnte nicht angelegt werden.",
    };
  }
  return { ok: true };
}

export type InsertAuctionResult =
  | { ok: true; anzeigeId: string; auctionUuid: string }
  | { ok: false; error: string };

export async function insertAuction(
  _userIdHint: string | null,
  draft: AuctionDraft,
  opts?: { startPrice?: number; anzeigeId?: string },
): Promise<InsertAuctionResult> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert." };

  const session = await getSessionUserId();
  if (!session) {
    return {
      ok: false,
      error: "Keine gültige Anmeldung. Bitte erneut anmelden.",
    };
  }
  const { uid, email } = session;

  const ensured = await ensureAuftraggeberRow(uid, email);
  if (!ensured.ok) return { ok: false, error: ensured.error };

  const { data: agProf, error: agErr } = await supabase
    .from("auftraggeber")
    .select("vorname,name,strasse,hausnummer,plz,ort,email,telefon")
    .eq("id", uid)
    .maybeSingle();
  if (agErr) console.warn("[supabase] auftraggeber snapshot", agErr);
  const metaSnap = await authUserMetadata();
  const abs_vorname =
    pickAddressField(String(agProf?.vorname ?? ""), metaSnap.vorname) || " ";
  const abs_name =
    pickAddressField(String(agProf?.name ?? ""), metaSnap.name) || " ";
  const abs_strasse =
    pickAddressField(String(agProf?.strasse ?? ""), metaSnap.strasse) || " ";
  const abs_plz = pickAddressField(String(agProf?.plz ?? ""), metaSnap.plz) || " ";
  const abs_ort = pickAddressField(String(agProf?.ort ?? ""), metaSnap.ort) || " ";
  const abs_email = String(agProf?.email ?? "").trim() || "";
  const abs_telefon = String(agProf?.telefon ?? "").trim() || "";

  const startort = draft.startort.trim();
  const zielort = draft.zielort.trim();
  if (!startort || !zielort) {
    return { ok: false, error: "Start- und Zielort sind Pflichtfelder." };
  }

  const empfVorname = (draft.empfVorname ?? "").trim();
  const empfName = (draft.empfName ?? "").trim();
  const empfStrasse = (draft.empfStrasse ?? "").trim();
  const empfPlz = (draft.empfPlz ?? "").trim();
  const empfOrt = (draft.empfOrt ?? "").trim();
  const isUmzug = draft.umzugDetails != null;
  const isReinigung = draft.reinigungDetails != null;
  const isServiceForm = isUmzug || isReinigung || (draft.startPrice ?? 0) > 0;
  if (
    !isServiceForm &&
    (!empfVorname || !empfName || !empfStrasse || !empfPlz || !empfOrt)
  ) {
    return {
      ok: false,
      error: "Bitte alle Empfänger-Adressfelder ausfüllen.",
    };
  }

  const abholdatum = (draft.abholdatum ?? "").trim();
  if (!abholdatum) {
    return {
      ok: false,
      error: "Bitte das gewünschte Abholdatum angeben.",
    };
  }

  /** Kein fester Startpreis: wird durch das erste Transporteur-Gebot gesetzt – ausser bei Kombi mit startPrice. */
  const startPrice =
    draft.startPrice != null && draft.startPrice > 0
      ? draft.startPrice
      : opts?.startPrice != null && opts.startPrice > 0
        ? opts.startPrice
        : 0;

  const anzeigeId = (opts?.anzeigeId ?? anzeigeIdNew()).trim();
  const dauerSek = Math.max(1, Math.round(draft.durationMs / 1000));
  const lz = draft.lieferzeitpraeferenz;
  const lieferzeit =
    lz === "vormittags" || lz === "nachmittags" || lz === "flexibel"
      ? lz
      : null;

  const rawImages = draft.imageDataUrls ?? [];
  const bilder_urls = await uploadDataUrlsToAuftragsbilder(uid, rawImages);

  const nowMs = Date.now();
  const dauerMs = dauerSek * 1000;
  const endsAtMs = nowMs + dauerMs;

  const dienstleistungTyp = dienstleistungTypFromDraft(draft);
  const abgabegarantie = Boolean(draft.reinigungDetails?.abgabegarantie);

  const insertRow = {
    auftraggeber_id: uid,
    startort,
    zielort,
    hoehe: draft.hoehe?.trim() || null,
    breite: draft.breite?.trim() || null,
    tiefe: draft.tiefe?.trim() || null,
    gewicht: draft.gewicht?.trim() || null,
    notizen: draft.notizen?.trim() || null,
    dienstleistung_typ: dienstleistungTyp,
    abgabegarantie,
    umzug_details: draft.umzugDetails ?? null,
    reinigung_details: draft.reinigungDetails ?? null,
    abholdatum,
    lieferdatum: draft.lieferdatum?.trim() || null,
    lieferzeit,
    empf_vorname: isServiceForm ? empfVorname || "–" : empfVorname,
    empf_name: isServiceForm ? empfName || "–" : empfName,
    empf_strasse: isServiceForm ? empfStrasse || zielort : empfStrasse,
    empf_plz: isServiceForm ? empfPlz || "–" : empfPlz,
    empf_ort: isServiceForm ? empfOrt || "–" : empfOrt,
    abs_vorname,
    abs_name,
    abs_strasse,
    abs_plz,
    abs_ort,
    abs_email,
    abs_telefon,
    startpreis: startPrice,
    aktuelles_gebot: startPrice > 0 ? startPrice : null,
    dauer_sekunden: dauerSek,
    status: "live",
    bilder_urls: Array.isArray(bilder_urls) ? bilder_urls : [],
    erstellt_am: toAuctionTimestamptzCh(nowMs),
    endet_am: toAuctionTimestamptzCh(endsAtMs),
    anzeige_id: anzeigeId,
  };

  const { data, error } = await supabase
    .from("auktionen")
    .insert(insertRow)
    .select("id, anzeige_id")
    .single();

  if (error || !data) {
    console.error("[supabase] insertAuction", error, insertRow);
    const raw =
      error?.message ||
      "Die Auktion konnte nicht gespeichert werden (Datenbankfehler).";
    const hint = raw.includes("auktionen") && raw.includes("schema cache")
      ? " In Supabase: SQL-Migration „027_auktionen_gebote_ensure“ ausführen (Tabelle public.auktionen)."
      : raw.includes("permission denied") && raw.includes("transporteure")
        ? " SQL-Migration „028_transporteure_grants“ im Supabase SQL Editor ausführen."
      : raw.includes("permission denied") && raw.includes("auktionen")
        ? " Prüfe RLS/GRANT für public.auktionen (Migration 027)."
        : raw.includes("permission denied")
        ? " Fehlende Tabellen-Rechte: Migrationen 026–028 ausführen."
        : "";
    return {
      ok: false,
      error: `${raw}${hint}`,
    };
  }

  if (import.meta.env.DEV) {
    console.log("[supabase] auction times (CH wall clock in DB)", {
      erstellt_am: insertRow.erstellt_am,
      endet_am: insertRow.endet_am,
      dauer_sekunden: dauerSek,
    });
  }

  return {
    ok: true,
    auctionUuid: data.id as string,
    anzeigeId: (data.anzeige_id as string) || anzeigeId,
  };
}

export async function insertBid(
  auctionUuid: string,
  transporteurId: string,
  kuerzel: string,
  username: string,
  betrag: number,
): Promise<string | null> {
  if (!supabase) return "Supabase nicht konfiguriert.";

  const { count: bidCountBefore, error: countErr } = await supabase
    .from("gebote")
    .select("id", { count: "exact", head: true })
    .eq("auktion_id", auctionUuid);
  if (countErr) {
    console.warn("[supabase] insertBid count", countErr);
    return countErr.message || "Gebot konnte nicht geprüft werden.";
  }
  const isFirstBid = (bidCountBefore ?? 0) === 0;

  const { error } = await supabase.from("gebote").insert({
    auktion_id: auctionUuid,
    transporteur_id: transporteurId,
    betrag,
    kuerzel,
    bidder_key: username,
  });
  if (error) {
    console.warn("[supabase] insertBid", error);
    return error.message || "Gebot konnte nicht gespeichert werden.";
  }

  const { data: allBids, error: listErr } = await supabase
    .from("gebote")
    .select("betrag")
    .eq("auktion_id", auctionUuid);
  if (listErr) {
    console.warn("[supabase] insertBid list", listErr);
    return null;
  }
  const amounts = (allBids ?? [])
    .map((r) => Number(r.betrag))
    .filter((n) => Number.isFinite(n) && n > 0);
  const lowest = amounts.length ? Math.min(...amounts) : betrag;

  const patch: { aktuelles_gebot: number; startpreis?: number } = {
    aktuelles_gebot: lowest,
  };
  if (isFirstBid) patch.startpreis = betrag;

  const { error: upErr } = await supabase
    .from("auktionen")
    .update(patch)
    .eq("id", auctionUuid);
  if (upErr) {
    console.warn("[supabase] insertBid update auktion", upErr);
  }

  return null;
}

export async function resolveAuctionUuidByAnzeige(
  anzeigeId: string,
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("auktionen")
    .select("id")
    .eq("anzeige_id", anzeigeId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateAuctionAward(
  auctionUuid: string,
  betrag: number,
  transporteurId: string,
): Promise<{ ok: boolean }> {
  if (!supabase) return { ok: false };
  const { error } = await supabase
    .from("auktionen")
    .update({
      awarded_betrag: betrag,
      awarded_transporteur_id: transporteurId,
      awarded_at: new Date().toISOString(),
      status: "pending_payment",
      qr_token: null,
    })
    .eq("id", auctionUuid);
  if (error) {
    console.warn("[supabase] updateAuctionAward", error);
    return { ok: false };
  }
  return { ok: true };
}

export type AuktionZahlungCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function auctionZahlungCreateCheckout(
  anzeigeId: string,
): Promise<AuktionZahlungCheckoutResult> {
  const id = anzeigeId.trim();
  if (!id || !supabase) return { ok: false, error: "invalid" };
  const { data, error, authError } = await invokeFunctionWithAuth(
    "auktion-zahlung",
    { action: "create_checkout", anzeige_id: id },
  );
  if (authError === "unauthorized") return { ok: false, error: "unauthorized" };
  if (error) {
    console.warn("[auktion-zahlung] create", error);
    return { ok: false, error: "invoke" };
  }
  const row = data as {
    ok?: boolean;
    url?: string;
    error?: string;
  } | null;
  if (row?.ok === true && row.url) return { ok: true, url: row.url };
  if (row?.error === "no_stripe") return { ok: false, error: "no_stripe" };
  return { ok: false, error: row?.error ?? "unknown" };
}

export async function auctionZahlungCompleteCheckout(
  sessionId: string,
): Promise<{ ok: boolean; anzeigeId?: string }> {
  const sid = sessionId.trim();
  if (!sid || !supabase) return { ok: false };
  const { data, error } = await invokeFunctionWithAuth("auktion-zahlung", {
    action: "complete_checkout",
    session_id: sid,
  });
  if (error) {
    console.warn("[auktion-zahlung] complete", error);
    return { ok: false };
  }
  const row = data as { ok?: boolean; anzeige_id?: string; error?: string } | null;
  if (row?.ok === true && row.anzeige_id)
    return { ok: true, anzeigeId: String(row.anzeige_id) };
  return { ok: false };
}

export async function auctionZahlungSimulate(
  anzeigeId: string,
  auctionUuid?: string,
): Promise<{ ok: boolean; anzeigeId?: string; error?: string }> {
  const id = anzeigeId.trim();
  if (!id || !supabase) return { ok: false, error: "no_client" };

  const auth = await ensureAuthenticatedSession();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1) Postgres-RPC (auth.uid() serverseitig – bevorzugt wenn Migration 031 angewendet)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "simulate_auktion_zahlung",
      { p_anzeige_id: id },
    );
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const row = rpcData as {
        ok?: boolean;
        anzeige_id?: string;
        error?: string;
        already_paid?: boolean;
      };
      if (row.ok === true && row.anzeige_id) {
        return { ok: true, anzeigeId: String(row.anzeige_id) };
      }
      if (row.error && row.error !== "unauthorized") {
        console.warn("[simulate_auktion_zahlung]", row.error);
      }
    } else if (rpcErr && !rpcErr.message.includes("Could not find")) {
      console.warn("[simulate_auktion_zahlung] rpc", rpcErr.message);
    }
  } catch (e) {
    console.warn("[simulate_auktion_zahlung] exception", e);
  }

  // 2) Edge Function (wenn deployed)
  try {
    const { data, error } = await invokeFunctionWithAuth("auktion-zahlung", {
      action: "simulate_payment",
      anzeige_id: id,
    });
    if (!error) {
      const row = data as {
        ok?: boolean;
        anzeige_id?: string;
        error?: string;
      } | null;
      if (row?.ok === true && row.anzeige_id) {
        return { ok: true, anzeigeId: String(row.anzeige_id) };
      }
      if (row?.error && row.error !== "unknown_action") {
        console.warn("[auktion-zahlung] simulate body", row.error);
      }
    } else {
      console.warn("[auktion-zahlung] simulate invoke", error.message);
    }
  } catch (e) {
    console.warn("[auktion-zahlung] simulate invoke exception", e);
  }

  // 3) Direktes Update via RLS (Auftraggeber, Session-JWT)
  const direct = await simulateAuktionZahlungDirect(
    id,
    auth.userId,
    auctionUuid,
  );
  if (direct.ok) return { ok: true, anzeigeId: id };
  return { ok: false, error: direct.error };
}

/** Client-Fallback: Zahlung simulieren ohne Edge Function / RPC. */
async function simulateAuktionZahlungDirect(
  anzeigeId: string,
  uid: string,
  auctionUuid?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "no_client" };
  if (!uid) return { ok: false, error: "unauthorized" };

  const qrTok = generateUuidV4();

  let lookup = supabase
    .from("auktionen")
    .select("id, status, anzeige_id")
    .eq("auftraggeber_id", uid);
  lookup = auctionUuid
    ? lookup.eq("id", auctionUuid)
    : lookup.eq("anzeige_id", anzeigeId);
  const { data: existing } = await lookup.maybeSingle();

  if (!existing) return { ok: false, error: "not_found" };

  const st = String(existing.status ?? "").trim();
  if (st === "bezahlt_simuliert" || st === "awarded" || st === "bezahlt") {
    return { ok: true };
  }
  if (st !== "pending_payment") {
    return { ok: false, error: `invalid_state:${st}` };
  }

  let upd = supabase
    .from("auktionen")
    .update({
      status: "bezahlt_simuliert",
      qr_token: qrTok,
    })
    .eq("auftraggeber_id", uid)
    .eq("status", "pending_payment");

  upd = auctionUuid
    ? upd.eq("id", auctionUuid)
    : upd.eq("anzeige_id", anzeigeId);

  const { data: updated, error: updErr } = await upd
    .select("anzeige_id")
    .maybeSingle();

  if (updErr) {
    console.warn("[simulateAuktionZahlungDirect]", updErr);
    return { ok: false, error: updErr.message };
  }
  if (updated) return { ok: true };
  return { ok: false, error: "update_no_rows" };
}

export async function updateAuctionReject(auctionUuid: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("auktionen")
    .update({
      rejected_at: new Date().toISOString(),
      status: "rejected",
    })
    .eq("id", auctionUuid);
  if (error) {
    console.warn("[supabase] updateAuctionReject", error);
    return false;
  }
  return true;
}

export type ConfirmDeliveryOutcome =
  | { ok: true; simulated: boolean }
  | { ok: false; reason: "invalid" | "forbidden" | "payment_failed" | "error" };

export async function confirmAuctionDelivery(
  anzeigeId: string,
  qrToken: string,
): Promise<ConfirmDeliveryOutcome> {
  const id = anzeigeId.trim();
  const tok = qrToken.trim();
  if (!id || !tok) return { ok: false, reason: "invalid" };
  if (!supabase) return { ok: true, simulated: true };

  const auth = await ensureAuthenticatedSession();
  if (!auth.ok) return { ok: false, reason: "forbidden" };

  try {
    const { data, error } = await invokeFunctionWithAuth(
      "confirm-delivery-payment",
      { anzeige_id: id, qr_token: tok },
    );
    if (!error) {
      const row = data as {
        ok?: boolean;
        error?: string;
        simulated?: boolean;
      } | null;
      if (row?.ok === true) {
        return { ok: true, simulated: row.simulated === true };
      }
      if (row?.error === "invalid") return { ok: false, reason: "invalid" };
      if (row?.error === "forbidden") return { ok: false, reason: "forbidden" };
      if (row?.error === "payment_failed")
        return { ok: false, reason: "payment_failed" };
    } else {
      console.warn("[supabase] confirm-delivery-payment", error.message);
    }
  } catch (e) {
    console.warn("[supabase] confirm-delivery-payment exception", e);
  }

  // RPC-Fallback (ohne Edge Function)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "confirm_auktion_delivery",
      { p_anzeige_id: id, p_qr_token: tok },
    );
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const row = rpcData as { ok?: boolean; error?: string; simulated?: boolean };
      if (row.ok === true) {
        return { ok: true, simulated: row.simulated === true };
      }
      if (row.error === "invalid") return { ok: false, reason: "invalid" };
      if (row.error === "forbidden") return { ok: false, reason: "forbidden" };
    } else if (rpcErr) {
      console.warn("[confirm_auktion_delivery] rpc", rpcErr.message);
    }
  } catch (e) {
    console.warn("[confirm_auktion_delivery] exception", e);
  }

  return { ok: false, reason: "error" };
}

/** Nur im Testmodus: simuliert erfolgreichen Scan ohne QR-Token. */
export async function confirmAuctionDeliveryTestSimulate(
  anzeigeId: string,
): Promise<ConfirmDeliveryOutcome> {
  const id = anzeigeId.trim();
  if (!id) return { ok: false, reason: "invalid" };
  if (!supabase) return { ok: true, simulated: true };

  const auth = await ensureAuthenticatedSession();
  if (!auth.ok) return { ok: false, reason: "forbidden" };

  try {
    const { data, error } = await invokeFunctionWithAuth(
      "confirm-delivery-payment",
      { anzeige_id: id, test_simulate: true },
    );
    if (!error) {
      const row = data as { ok?: boolean; error?: string; simulated?: boolean } | null;
      if (row?.ok === true) {
        return { ok: true, simulated: row.simulated === true };
      }
      if (row?.error === "invalid") return { ok: false, reason: "invalid" };
      if (row?.error === "forbidden") return { ok: false, reason: "forbidden" };
      if (row?.error === "payment_failed")
        return { ok: false, reason: "payment_failed" };
    } else {
      console.warn("[supabase] confirm-delivery-payment test_simulate", error.message);
    }
  } catch (e) {
    console.warn("[supabase] confirm-delivery-payment test_simulate exception", e);
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "confirm_auktion_delivery_test_simulate",
      { p_anzeige_id: id },
    );
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const row = rpcData as { ok?: boolean; error?: string; simulated?: boolean };
      if (row.ok === true) {
        return { ok: true, simulated: row.simulated === true };
      }
      if (row.error === "invalid") return { ok: false, reason: "invalid" };
      if (row.error === "forbidden") return { ok: false, reason: "forbidden" };
    } else if (rpcErr) {
      console.warn("[confirm_auktion_delivery_test_simulate] rpc", rpcErr.message);
    }
  } catch (e) {
    console.warn("[confirm_auktion_delivery_test_simulate] exception", e);
  }

  return { ok: false, reason: "error" };
}

export async function findTransporteurIdByUsername(
  benutzername: string,
): Promise<string | null> {
  if (!supabase) return null;
  const key = benutzername.trim();
  if (!key) return null;
  const { data, error } = await supabase
    .from("transporteure")
    .select("id")
    .ilike("benutzername", key)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}
