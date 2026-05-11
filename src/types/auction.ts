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
  bids: Bid[];
  awardedAt?: number;
  awardedBid?: Bid;
  rejectedAt?: number;
  /** Einmaliger QR-/Übergabe-Token; nur für Auftraggeber (Eigentümer) sichtbar */
  qrToken?: string;
  /** DB-Status: live | pending_payment | awarded | bezahlt_simuliert | rejected | geliefert | bezahlt … */
  auctionStatus?: string;
};

export type AuctionDraft = {
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
};
