import type { Auction } from "../types/auction";

/** Ende der Auktion: DB `endet_am`, sonst Start + Dauer. */
export function getAuctionEndsAtMs(a: Auction): number {
  return a.endsAt ?? a.startedAt + a.durationMs;
}

export function getAuctionRemainingMs(
  a: Auction,
  now: number = Date.now(),
): number {
  return Math.max(0, getAuctionEndsAtMs(a) - now);
}

export function isAuctionLiveAt(a: Auction, now: number): boolean {
  if (a.awardedAt || a.rejectedAt) return false;
  return now < getAuctionEndsAtMs(a);
}

export function auctionElapsed01(a: Auction, now: number): number {
  const end = getAuctionEndsAtMs(a);
  const len = Math.max(1, end - a.startedAt);
  return Math.min(1, Math.max(0, (now - a.startedAt) / len));
}
