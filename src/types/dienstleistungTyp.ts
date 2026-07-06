import type { AuctionDraft } from "./auction";

export const DIENSTLEISTUNG_TYPEN = [
  "umzug",
  "reinigung",
  "umzug_reinigung",
  "transport",
] as const;

export type DienstleistungTyp = (typeof DIENSTLEISTUNG_TYPEN)[number];

export function isDienstleistungTyp(v: string): v is DienstleistungTyp {
  return (DIENSTLEISTUNG_TYPEN as readonly string[]).includes(v);
}

/** DB-Spalte `dienstleistung_typ` aus Draft ableiten. */
export function dienstleistungTypFromDraft(draft: AuctionDraft): DienstleistungTyp {
  if (draft.umzugDetails && draft.reinigungDetails) return "umzug_reinigung";
  if (draft.umzugDetails) return "umzug";
  if (draft.reinigungDetails) return "reinigung";
  return "transport";
}

/** Anzeige-Label für UI-Badge. */
export function auftragsartFromDienstleistungTyp(
  typ: DienstleistungTyp,
): string {
  switch (typ) {
    case "umzug":
      return "Umzug";
    case "reinigung":
      return "Reinigung";
    case "umzug_reinigung":
      return "Umzug + Reinigung";
    default:
      return "Transport";
  }
}

export function dienstleistungTypFromAuftragsart(
  art: string | undefined,
): DienstleistungTyp {
  const n = (art ?? "").trim().toLowerCase();
  if (n === "umzug") return "umzug";
  if (n === "reinigung") return "reinigung";
  if (n === "umzug + reinigung" || n === "umzug_reinigung") return "umzug_reinigung";
  return "transport";
}

/** Typ aus geladener Auktion (DB-Spalte oder JSON-Fallback). */
export function dienstleistungTypFromAuction(
  a: Pick<
    import("./auction").Auction,
    "dienstleistungTyp" | "umzugDetails" | "reinigungDetails"
  >,
): DienstleistungTyp {
  if (a.dienstleistungTyp) return a.dienstleistungTyp;
  if (a.umzugDetails && a.reinigungDetails) return "umzug_reinigung";
  if (a.umzugDetails) return "umzug";
  if (a.reinigungDetails) return "reinigung";
  return "transport";
}
