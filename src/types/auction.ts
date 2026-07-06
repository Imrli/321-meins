import type { DienstleistungTyp } from "./dienstleistungTyp";

export type Bid = {
  initials: string;
  price: number;
  ts: number;
  bidderKey?: string;
  /** Nur Supabase: Admin hat Transporteur verifiziert */
  verifiziert?: boolean;
  /** Durchschnittsbewertung 0–5 (eine Dezimalstelle); null = keine Bewertung */
  bewertung?: number | null;
};

export type Auction = {
  id: string;
  /** Supabase-PK; nur für API, nicht für UI-Texte nötig */
  auctionUuid?: string;
  ownerUsername: string;
  /** DB: umzug | reinigung | umzug_reinigung | transport */
  dienstleistungTyp?: DienstleistungTyp;
  abgabegarantie?: boolean;
  startort: string;
  zielort: string;
  /** gesetzt, wenn ein Transporteur den Zuschlag erhalten hat (Supabase-PK) */
  awardedTransporteurId?: string;
  absVorname?: string;
  absName?: string;
  absStrasse?: string;
  absPlz?: string;
  absOrt?: string;
  /** Snapshot Auftraggeber, nur nach Zuschlag für Transporteur sichtbar */
  absEmail?: string;
  /** Snapshot Auftraggeber, nur nach Zuschlag für Transporteur sichtbar */
  absTelefon?: string;
  /** Aus JOIN auftraggeber (aktueller Stand); nur für berechtigte Viewer */
  ownerEmail?: string;
  /** Aus JOIN auftraggeber (aktueller Stand); nur für berechtigte Viewer */
  ownerTelefon?: string;
  empfVorname?: string;
  empfName?: string;
  empfStrasse?: string;
  empfPlz?: string;
  empfOrt?: string;
  hoehe?: string;
  breite?: string;
  tiefe?: string;
  gewicht?: string;
  notizen?: string;
  abholdatum?: string;
  lieferdatum?: string;
  lieferzeitpraeferenz?: "vormittags" | "nachmittags" | "flexibel";
  imageDataUrls?: string[];
  startPrice: number;
  durationMs: number;
  startedAt: number;
  /** Ende aus DB `endet_am` (UTC-Instant); Countdown/„live“ daran ausrichten. */
  endsAt?: number;
  bids: Bid[];
  awardedAt?: number;
  awardedBid?: Bid;
  rejectedAt?: number;
  /** Einmaliger QR-/Übergabe-Token; nur für Auftraggeber (Eigentümer) sichtbar */
  qrToken?: string;
  /** DB-Status: live | pending_payment | awarded | bezahlt_simuliert | rejected | geliefert | bezahlt … */
  auctionStatus?: string;
  /** QR-Scan / Zahlungsfreigabe (Unix-ms); Dashboard-Sichtbarkeit 3 Tage danach */
  freigegebenAt?: number;
  umzugDetails?: import("./umzugDetails").UmzugDetails;
  reinigungDetails?: import("./reinigungDetails").ReinigungDetails;
};

export type AuctionDraft = {
  umzugDetails?: import("./umzugDetails").UmzugDetails;
  reinigungDetails?: import("./reinigungDetails").ReinigungDetails;
  startort: string;
  zielort: string;
  empfVorname: string;
  empfName: string;
  empfStrasse: string;
  empfPlz: string;
  empfOrt: string;
  hoehe?: string;
  breite?: string;
  tiefe?: string;
  gewicht?: string;
  notizen?: string;
  abholdatum?: string;
  lieferdatum?: string;
  lieferzeitpraeferenz?: "vormittags" | "nachmittags" | "flexibel";
  imageDataUrls?: string[];
  durationMs: number;
  /** Kombi-Auftrag: expliziter Startpreis für die Live-Auktion (CHF) */
  startPrice?: number;
};
