import { supabase } from "./supabaseClient";

export type PendingDeliveryRating = {
  anzeigeId: string;
  partnerName: string;
};

export type ReceivedRatingRow = {
  anzeigeId: string;
  sterne: number;
  kommentar: string | null;
};

function formatTrName(tr: unknown): string {
  const t = (Array.isArray(tr) ? tr[0] : tr) as
    | { firmenname?: string; vorname_kontakt?: string; name_kontakt?: string }
    | null
    | undefined;
  if (!t) return "";
  const firma = String(t.firmenname ?? "").trim();
  if (firma) return firma;
  const k = `${String(t.vorname_kontakt ?? "").trim()} ${
    String(t.name_kontakt ?? "").trim()
  }`.trim();
  return k;
}

function formatAgName(ag: unknown): string {
  const a = (Array.isArray(ag) ? ag[0] : ag) as
    | { vorname?: string; name?: string }
    | null
    | undefined;
  if (!a) return "";
  return `${String(a.vorname ?? "").trim()} ${String(a.name ?? "").trim()}`.trim();
}

export async function fetchPendingDeliveryRatings(
  userId: string,
  role: "auftraggeber" | "transporteur",
): Promise<PendingDeliveryRating[]> {
  if (!supabase) return [];

  if (role === "auftraggeber") {
    const { data, error } = await supabase
      .from("auktionen")
      .select(
        `
        anzeige_id,
        transporteure ( firmenname, vorname_kontakt, name_kontakt )
      `,
      )
      .eq("auftraggeber_id", userId)
      .eq("status", "bezahlt")
      .is("bewertung_ag_sterne", null);
    if (error || !data) return [];
    return (data as { anzeige_id?: string; transporteure?: unknown }[])
      .map((row) => ({
        anzeigeId: String(row.anzeige_id ?? "").trim(),
        partnerName: formatTrName(row.transporteure) || "deinem Transporteur",
      }))
      .filter((x) => x.anzeigeId);
  }

  const { data, error } = await supabase
    .from("auktionen")
    .select(
      `
      anzeige_id,
      auftraggeber ( vorname, name )
    `,
    )
    .eq("awarded_transporteur_id", userId)
    .eq("status", "bezahlt")
    .is("bewertung_tr_sterne", null);
  if (error || !data) return [];
  return (data as { anzeige_id?: string; auftraggeber?: unknown }[])
    .map((row) => ({
      anzeigeId: String(row.anzeige_id ?? "").trim(),
      partnerName: formatAgName(row.auftraggeber) || "deinem Auftraggeber",
    }))
    .filter((x) => x.anzeigeId);
}

export async function fetchReceivedRatingsForProfile(
  userId: string,
  role: "auftraggeber" | "transporteur",
): Promise<ReceivedRatingRow[]> {
  if (!supabase) return [];

  if (role === "auftraggeber") {
    const { data, error } = await supabase
      .from("auktionen")
      .select("anzeige_id, bewertung_tr_sterne, bewertung_tr_kommentar")
      .eq("auftraggeber_id", userId)
      .not("bewertung_tr_sterne", "is", null)
      .order("erstellt_am", { ascending: false });
    if (error || !data) return [];
    return (data as {
      anzeige_id?: string;
      bewertung_tr_sterne?: number;
      bewertung_tr_kommentar?: string | null;
    }[]).map((r) => ({
      anzeigeId: String(r.anzeige_id ?? ""),
      sterne: Number(r.bewertung_tr_sterne ?? 0),
      kommentar: r.bewertung_tr_kommentar ?? null,
    }));
  }

  const { data, error } = await supabase
    .from("auktionen")
    .select("anzeige_id, bewertung_ag_sterne, bewertung_ag_kommentar")
    .eq("awarded_transporteur_id", userId)
    .not("bewertung_ag_sterne", "is", null)
    .order("erstellt_am", { ascending: false });
  if (error || !data) return [];
  return (data as {
    anzeige_id?: string;
    bewertung_ag_sterne?: number;
    bewertung_ag_kommentar?: string | null;
  }[]).map((r) => ({
    anzeigeId: String(r.anzeige_id ?? ""),
    sterne: Number(r.bewertung_ag_sterne ?? 0),
    kommentar: r.bewertung_ag_kommentar ?? null,
  }));
}

export async function submitLieferungBewertung(
  anzeigeId: string,
  sterne: number,
  kommentar: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Supabase nicht konfiguriert" };
  const { data, error } = await supabase.functions.invoke("lieferung-bewerten", {
    body: {
      anzeige_id: anzeigeId.trim(),
      sterne,
      kommentar: kommentar.trim().slice(0, 300),
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const body = data as { ok?: boolean; error?: string } | null;
  if (body?.ok === true) return { ok: true };
  if (body?.error === "already_rated") {
    return { ok: false, error: "Für diesen Auftrag wurde bereits bewertet." };
  }
  if (body?.error === "forbidden") {
    return { ok: false, error: "Keine Berechtigung." };
  }
  if (body?.error === "invalid_state") {
    return { ok: false, error: "Bewertung derzeit nicht möglich." };
  }
  return { ok: false, error: body?.error ?? "Bewertung fehlgeschlagen." };
}
