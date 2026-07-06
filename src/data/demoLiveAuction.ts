import type { AuctionData } from "../types/liveAuction";

/** Statische Demo-Daten für Hero / lokale Entwicklung ohne Supabase-Live-Slides. */
export const DEMO_LIVE_AUCTION: AuctionData = {
  id: "A-2846",
  title: "Umzug Zürich – Bern",
  from: "Zürich HB",
  to: "Bern Länggasse",
  type: "Umzug",
  rooms: 2,
  floor: 3,
  leadingPrice: 244,
  hasLeadingBid: true,
  startPrice: 320,
  startedAtMs: Date.now() - 12 * 60_000,
  durationMs: 60 * 60_000,
  bids: [
    {
      initials: "MG",
      stars: 5,
      rating: 4.2,
      price: 244,
      time: "gerade eben",
    },
    {
      initials: "SA",
      stars: 5,
      rating: 3.8,
      price: 252,
      time: "vor 34 s",
    },
    {
      initials: "UR",
      stars: 5,
      rating: 5.0,
      price: 259,
      time: "vor 1 min",
    },
  ],
  isLive: true,
};
