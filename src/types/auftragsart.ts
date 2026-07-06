import type { AuctionDraft } from "./auction";

export const AUFTRAGSARTEN = [
  "Umzug",
  "Reinigung",
  "Umzug + Reinigung",
  "Transport",
] as const;

export type AuftragsArt = (typeof AUFTRAGSARTEN)[number];

export function isAuftragsArt(v: string): v is AuftragsArt {
  return (AUFTRAGSARTEN as readonly string[]).includes(v);
}

export function emptyAuctionDraftWithArt(_art: AuftragsArt): AuctionDraft {
  return {
    startort: "",
    zielort: "",
    empfVorname: "",
    empfName: "",
    empfStrasse: "",
    empfPlz: "",
    empfOrt: "",
    durationMs: 5 * 60 * 1000,
  };
}
