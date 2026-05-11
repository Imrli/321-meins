import { supabase, supabasePublic } from "./supabaseClient";
import type { Auction, AuctionDraft, Bid } from "../types/auction";

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
  erstellt_am: string;
  endet_am: string;
  awarded_betrag: number | string | null;
  awarded_transporteur_id: string | null;
  awarded_at: string | null;
  rejected_at: string | null;
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

function mapLieferzeit(
  v: string | null | undefined,
): Auction["lieferzeitpraeferenz"] | undefined {
  if (v === "vormittags" || v === "nachmittags" || v === "flexibel")
    return v;
  return undefined;
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

  return {
    initials: g.kuerzel,
    price: Number(g.betrag),
    ts: new Date(g.erstellt_am).getTime(),
    bidderKey: g.bidder_key?.trim() ? g.bidder_key : undefined,
    verifiziert: verifiziert ? true : undefined,
    bewertung,
  };
}

export function dbRowToAuction(row: RowAuktion): Auction {
  const bids: Bid[] = (row.gebote ?? []).map((g) =>
    mapRowGebot(g as RowGebot),
  );
  bids.sort((a, b) => b.ts - a.ts);

  const rawAg = row.auftraggeber;
  const ag = Array.isArray(rawAg) ? rawAg[0] : rawAg;
  const ownerUsername = ag?.benutzername?.trim() || "—";
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
    startort: row.startort,
    zielort: row.zielort,
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
    abholdatum:
      row.abholdatum == null || row.abholdatum === ""
        ? undefined
        : String(row.abholdatum).slice(0, 10),
    empfVorname: row.empf_vorname ?? undefined,
    empfName: row.empf_name ?? undefined,
    empfStrasse: row.empf_strasse ?? undefined,
    empfPlz: row.empf_plz ?? undefined,
    empfOrt: row.empf_ort ?? undefined,
    lieferdatum: row.lieferdatum ?? undefined,
    lieferzeitpraeferenz: mapLieferzeit(row.lieferzeit),
    imageDataUrls,
    startPrice: Number(row.startpreis),
    durationMs: row.dauer_sekunden * 1000,
    startedAt: new Date(row.erstellt_am).getTime(),
    bids,
    awardedAt: row.awarded_at ? new Date(row.awarded_at).getTime() : undefined,
    awardedBid,
    rejectedAt: row.rejected_at
      ? new Date(row.rejected_at).getTime()
      : undefined,
    qrToken: row.qr_token ? String(row.qr_token) : undefined,
    auctionStatus:
      row.status != null && String(row.status).trim() !== ""
        ? String(row.status)
        : undefined,
  };
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
    .order("erstellt_am", { ascending: false });

  if (error || !data) {
    console.warn("[supabase] fetchAuctionsForUser", error);
    return [];
  }
  return (data as unknown as RowAuktion[]).map(dbRowToAuction);
}

const homepageSliderSelect = `
  *,
  gebote (
    *,
    transporteure ( verifiziert, bewertung )
  )
`;

/** Öffentliche Live-Auktionen für den Startseiten-Slider (immer anon-Client). */
export async function fetchHomepageSliderLiveAuctions(): Promise<Auction[]> {
  if (!supabasePublic) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabasePublic
    .from("auktionen")
    .select(homepageSliderSelect)
    .eq("status", "live")
    .gt("endet_am", nowIso)
    .is("rejected_at", null)
    .order("endet_am", { ascending: true });

  if (error || !data) {
    console.warn("[supabase] fetchHomepageSliderLiveAuctions", error);
    return [];
  }
  return (data as unknown as RowAuktion[]).map(dbRowToAuction);
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

  const local = (email ?? "").split("@")[0] || `user-${uid.slice(0, 6)}`;
  const benutzername = `${local}-${uid.slice(0, 4)}`.toLowerCase();
  const { error: insErr } = await supabase.from("auftraggeber").insert({
    id: uid,
    vorname: "—",
    name: "—",
    email: email ?? "",
    strasse: "—",
    plz: "—",
    ort: "—",
    telefon: "—",
    benutzername,
  });
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
    .select("vorname,name,strasse,plz,ort,email,telefon")
    .eq("id", uid)
    .maybeSingle();
  if (agErr) console.warn("[supabase] auftraggeber snapshot", agErr);
  const abs_vorname = String(agProf?.vorname ?? "").trim() || "—";
  const abs_name = String(agProf?.name ?? "").trim() || "—";
  const abs_strasse = String(agProf?.strasse ?? "").trim() || "—";
  const abs_plz = String(agProf?.plz ?? "").trim() || "—";
  const abs_ort = String(agProf?.ort ?? "").trim() || "—";
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
  if (!empfVorname || !empfName || !empfStrasse || !empfPlz || !empfOrt) {
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

  const startPrice = Number(
    opts?.startPrice ?? 280 + Math.floor(Math.random() * 80),
  );
  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    return { ok: false, error: "Ungültiger Startpreis." };
  }

  const anzeigeId = (opts?.anzeigeId ?? anzeigeIdNew()).trim();
  const dauerSek = Math.max(1, Math.round(draft.durationMs / 1000));
  const lz = draft.lieferzeitpraeferenz;
  const lieferzeit =
    lz === "vormittags" || lz === "nachmittags" || lz === "flexibel"
      ? lz
      : null;

  const rawImages = draft.imageDataUrls ?? [];
  const bilder_urls = await uploadDataUrlsToAuftragsbilder(uid, rawImages);

  const now = new Date();
  const endet = new Date(now.getTime() + draft.durationMs);

  const insertRow = {
    auftraggeber_id: uid,
    startort,
    zielort,
    hoehe: draft.hoehe?.trim() || null,
    breite: draft.breite?.trim() || null,
    tiefe: draft.tiefe?.trim() || null,
    gewicht: draft.gewicht?.trim() || null,
    notizen: draft.notizen?.trim() || null,
    abholdatum,
    lieferdatum: draft.lieferdatum?.trim() || null,
    lieferzeit,
    empf_vorname: empfVorname,
    empf_name: empfName,
    empf_strasse: empfStrasse,
    empf_plz: empfPlz,
    empf_ort: empfOrt,
    abs_vorname,
    abs_name,
    abs_strasse,
    abs_plz,
    abs_ort,
    abs_email,
    abs_telefon,
    startpreis: startPrice,
    aktuelles_gebot: null,
    dauer_sekunden: dauerSek,
    status: "live",
    bilder_urls: Array.isArray(bilder_urls) ? bilder_urls : [],
    erstellt_am: now.toISOString(),
    endet_am: endet.toISOString(),
    anzeige_id: anzeigeId,
  };

  const { data, error } = await supabase
    .from("auktionen")
    .insert(insertRow)
    .select("id, anzeige_id")
    .single();

  if (error || !data) {
    console.error("[supabase] insertAuction", error, insertRow);
    return {
      ok: false,
      error:
        error?.message ||
        "Die Auktion konnte nicht gespeichert werden (Datenbankfehler).",
    };
  }

  if (import.meta.env.DEV) {
    const endMs = endet.getTime();
    const startMs = now.getTime();
    console.log("[supabase] auction countdown sanity", {
      erstellt_am: insertRow.erstellt_am,
      dauer_sekunden: dauerSek,
      endet_am: insertRow.endet_am,
      durationMs_submitted: draft.durationMs,
      initial_remaining_ms: endMs - startMs,
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
  const { data, error } = await supabase.functions.invoke("auktion-zahlung", {
    body: { action: "create_checkout", anzeige_id: id },
  });
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
  const { data, error } = await supabase.functions.invoke("auktion-zahlung", {
    body: { action: "complete_checkout", session_id: sid },
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
): Promise<{ ok: boolean; anzeigeId?: string }> {
  const id = anzeigeId.trim();
  if (!id || !supabase) return { ok: false };
  const { data, error } = await supabase.functions.invoke("auktion-zahlung", {
    body: { action: "simulate_payment", anzeige_id: id },
  });
  if (error) {
    console.warn("[auktion-zahlung] simulate invoke error", error, data);
  }
  const row = data as {
    ok?: boolean;
    anzeige_id?: string;
    error?: string;
  } | null;
  if (row?.ok === true && row.anzeige_id)
    return { ok: true, anzeigeId: String(row.anzeige_id) };
  if (row?.error) console.warn("[auktion-zahlung] simulate body", row.error);
  return { ok: false };
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

  const { data, error } = await supabase.functions.invoke(
    "confirm-delivery-payment",
    { body: { anzeige_id: id, qr_token: tok } },
  );
  if (error) {
    console.warn("[supabase] confirm-delivery-payment", error);
    return { ok: false, reason: "error" };
  }
  const row = data as {
    ok?: boolean;
    error?: string;
    simulated?: boolean;
    message?: string;
  } | null;
  if (row?.ok === true) {
    return { ok: true, simulated: row.simulated === true };
  }
  if (row?.error === "invalid") return { ok: false, reason: "invalid" };
  if (row?.error === "forbidden") return { ok: false, reason: "forbidden" };
  if (row?.error === "payment_failed")
    return { ok: false, reason: "payment_failed" };
  return { ok: false, reason: "error" };
}

/** Nur im Edge-Testmodus (ohne Live-Stripe bzw. APP_TEST_MODE): simuliert erfolgreichen Scan ohne QR-Token. */
export async function confirmAuctionDeliveryTestSimulate(
  anzeigeId: string,
): Promise<ConfirmDeliveryOutcome> {
  const id = anzeigeId.trim();
  if (!id) return { ok: false, reason: "invalid" };
  if (!supabase) return { ok: true, simulated: true };

  const { data, error } = await supabase.functions.invoke(
    "confirm-delivery-payment",
    { body: { anzeige_id: id, test_simulate: true } },
  );
  if (error) {
    console.warn("[supabase] confirm-delivery-payment test_simulate", error);
    return { ok: false, reason: "error" };
  }
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
