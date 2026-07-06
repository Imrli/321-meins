import type { Auction } from "../types/auction";
import type { AuctionData } from "../types/liveAuction";
import { getAuctionEndsAtMs, isAuctionLiveAt } from "./auctionTime";
import { ortOeffentlich } from "./ortPublic";

function formatArtFromAuction(a: Auction): string {
  const n = a.notizen?.trim();
  if (n) {
    const first = n.split(/\n/)[0]?.trim() ?? "";
    if (first) return first.length > 92 ? `${first.slice(0, 89)}…` : first;
  }
  const h = a.hoehe?.trim();
  const b = a.breite?.trim();
  const t = a.tiefe?.trim();
  const w = a.gewicht?.trim();
  const dims = [h, b, t].every((x) => x) ? `${h}×${b}×${t} cm` : null;
  const wg = w ? `${w} kg` : null;
  if (dims && wg) return `${dims}, ${wg}`;
  if (dims) return dims;
  if (wg) return wg;
  return "—";
}

function formatRelativeBidTime(ts: number, now: number): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 15) return "gerade eben";
  if (s < 60) return `vor ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  return `vor ${h} h`;
}

/** Mappt eine App-`Auction` auf `AuctionData` für `LiveAuctionTable`. */
export function auctionToAuctionData(auction: Auction, now: number): AuctionData {
  const sorted = [...auction.bids].sort(
    (x, y) => x.price - y.price || y.ts - x.ts,
  );
  const lowest = sorted[0];
  const hasLeadingBid = sorted.length > 0;

  return {
    id: auction.id,
    title: "",
    from: ortOeffentlich(auction.startort),
    to: ortOeffentlich(auction.zielort),
    type: formatArtFromAuction(auction),
    rooms: 0,
    floor: 0,
    leadingPrice: hasLeadingBid ? lowest!.price : 0,
    hasLeadingBid,
    /** Nur Demo/Muster; eingeloggte UI nutzt Gebote, nicht diesen Wert. */
    startPrice: auction.startPrice,
    startedAtMs: auction.startedAt,
    durationMs: Math.max(1, getAuctionEndsAtMs(auction) - auction.startedAt),
    endsAtMs: getAuctionEndsAtMs(auction),
    isLive: isAuctionLiveAt(auction, now),
    bids: sorted.slice(0, 6).map((b) => ({
      initials: b.initials,
      stars: b.verifiziert ? 5 : 4,
      rating: b.bewertung ?? 4,
      price: b.price,
      time: formatRelativeBidTime(b.ts, now),
      bidderKey: b.bidderKey,
    })),
  };
}
