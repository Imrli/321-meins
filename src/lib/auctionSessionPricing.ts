import type { Auction, Bid } from "../types/auction";

/** Chronologisch erstes Gebot = Startpreis (eingeloggte Nutzer). */
export function firstBidChronological(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;
  return [...bids].sort((a, b) => a.ts - b.ts)[0] ?? null;
}

export function getLowestBidPrice(a: Auction): Bid | null {
  if (a.bids.length === 0) return null;
  return a.bids.reduce((best, b) =>
    b.price < best.price || (b.price === best.price && b.ts > best.ts)
      ? b
      : best,
  );
}

/** Obergrenze fürs neues Gebot: tiefstes Gebot, sonst unbegrenzt (kein DB-Startpreis). */
export function getBidCapPrice(a: Auction): number {
  const low = getLowestBidPrice(a);
  return low ? low.price : Number.POSITIVE_INFINITY;
}

export function formatSessionStartpreisLabel(a: Auction): string {
  const first = firstBidChronological(a.bids);
  return first ? `Startpreis: CHF ${first.price}` : "Startpreis: CHF –";
}

export function formatLeadingBidDisplay(hasBid: boolean, price: number): string {
  return hasBid ? `CHF ${price}` : "—";
}

export function formatTableFuehrungsgebote(a: Auction): string {
  const low = getLowestBidPrice(a);
  return low ? `CHF ${low.price}` : "—";
}
