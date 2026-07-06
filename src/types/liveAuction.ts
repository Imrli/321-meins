/** Auktionsdaten für `LiveAuctionTable` (aus Supabase-`Auction` oder Demo). */
export interface AuctionData {
  id: string;
  title: string;
  from: string;
  to: string;
  type: string;
  rooms: number;
  floor: number;
  /** Untergrenze für neues Gebot (tiefstes Gebot oder Startpreis). */
  leadingPrice: number;
  /** Anzeige Führungsgebot: false → „—“ (noch keine Gebote). */
  hasLeadingBid: boolean;
  startPrice: number;
  startedAtMs: number;
  durationMs: number;
  /** Ende aus `endet_am` (bevorzugt für Countdown). */
  endsAtMs?: number;
  bids: Array<{
    initials: string;
    stars: number;
    rating: number;
    price: number;
    time: string;
    bidderKey?: string;
  }>;
  isLive: boolean;
}
