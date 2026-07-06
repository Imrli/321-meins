import { DEMO_LIVE_AUCTION } from "../data/demoLiveAuction";
import type { AuctionData } from "../types/liveAuction";
import { LiveAuctionTable } from "./LiveAuctionTable";

type LiveAuctionTableContainerProps = {
  /** Optional: überschreibt Demo-Daten (z. B. nach Supabase-Fetch). */
  auction?: AuctionData;
};

/**
 * Übergeordnete Komponente: liefert Auktionsdaten an `LiveAuctionTable`.
 * Später: `auction` aus Loader/Query statt `DEMO_LIVE_AUCTION`.
 */
export function LiveAuctionTableContainer({
  auction = DEMO_LIVE_AUCTION,
}: LiveAuctionTableContainerProps) {
  return <LiveAuctionTable auction={auction} publicPreview />;
}

export default LiveAuctionTableContainer;
