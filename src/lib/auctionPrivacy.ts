import type { Auction } from "../types/auction";
import { ortOeffentlich } from "./ortPublic";

export type AuctionViewer = {
  userId?: string;
  role?: "auftraggeber" | "transporteur";
  username?: string;
};

/** Adressen in Umzugs-/Reinigungs-JSON nur als Ortsangabe (wie startort/zielort). */
function stripServiceDetailAddresses(a: Auction): Auction {
  let next = a;
  if (next.umzugDetails) {
    next = {
      ...next,
      umzugDetails: {
        ...next.umzugDetails,
        von: ortOeffentlich(next.umzugDetails.von),
        nach: ortOeffentlich(next.umzugDetails.nach),
      },
    };
  }
  if (next.reinigungDetails) {
    next = {
      ...next,
      reinigungDetails: {
        ...next.reinigungDetails,
        adresse: ortOeffentlich(next.reinigungDetails.adresse),
      },
    };
  }
  return next;
}

/** Gleiche Logik wie in der UI (Zuschlag / awardedBid). */
export function transporteurHatZuschlagViewer(
  auction: Auction,
  viewer: AuctionViewer | null,
): boolean {
  if (!viewer || viewer.role !== "transporteur" || !viewer.username?.trim())
    return false;
  const pid = String(auction.awardedTransporteurId ?? "")
    .trim()
    .toLowerCase();
  const uid = String(viewer.userId ?? "").trim().toLowerCase();
  if (pid && uid && pid === uid) return true;
  const bk = auction.awardedBid?.bidderKey?.trim().toLowerCase();
  const un = viewer.username.trim().toLowerCase();
  return (
    Boolean(auction.awardedAt) &&
    bk != null &&
    bk.length > 0 &&
    bk === un
  );
}

/**
 * Transporteur darf Absender-/Empfänger-Kontaktdaten sehen (nach Zahlung).
 * DB: `bezahlt_simuliert` (Sim), `awarded` (Stripe-Zahlung reserviert), `bezahlt` / `geliefert`.
 */
export function auctionTransporterMaySeeClientKontakte(
  auction: Auction,
): boolean {
  const st = String(auction.auctionStatus ?? "").trim();
  return (
    st === "bezahlt_simuliert" ||
    st === "bezahlt" ||
    st === "awarded" ||
    st === "geliefert"
  );
}

/** Nach Zuschlag, vor Zahlung: keine Personendaten; Strecke (startort/zielort) bleibt voll. */
function stripTransporterPrePaymentKontakte(a: Auction): Auction {
  const next = { ...a };
  next.absVorname = undefined;
  next.absName = undefined;
  next.absStrasse = undefined;
  next.absPlz = undefined;
  next.absOrt = undefined;
  next.absEmail = undefined;
  next.absTelefon = undefined;
  next.ownerEmail = undefined;
  next.ownerTelefon = undefined;
  next.empfVorname = undefined;
  next.empfName = undefined;
  next.empfStrasse = undefined;
  next.empfPlz = undefined;
  next.empfOrt = undefined;
  next.qrToken = undefined;
  return stripServiceDetailAddresses(next);
}

/** Nach Zahlung: QR nur für Auftraggeber; ansonsten volle Kontextdaten für den Transporteur. */
function stripTransporterPostPaymentOwnerJoin(a: Auction): Auction {
  const next = { ...a };
  next.qrToken = undefined;
  return next;
}

function stripPrivateAddresses(a: Auction): Auction {
  const next = { ...a };
  next.startort = ortOeffentlich(a.startort);
  next.zielort = ortOeffentlich(a.zielort);
  next.absVorname = undefined;
  next.absName = undefined;
  next.absStrasse = undefined;
  next.absPlz = undefined;
  next.absOrt = undefined;
  next.absEmail = undefined;
  next.absTelefon = undefined;
  next.ownerEmail = undefined;
  next.ownerTelefon = undefined;
  next.empfVorname = undefined;
  next.empfName = undefined;
  next.empfStrasse = undefined;
  next.empfPlz = undefined;
  next.empfOrt = undefined;
  next.qrToken = undefined;
  return stripServiceDetailAddresses(next);
}

/**
 * Sensible Adress- und Namensfelder nur für Auftraggeber (eigene Auktionen) bzw.
 * für den Transporteur nach Zuschlag. Sonst nur Ortsangaben (Start-/Ziel-Ort anonymisiert).
 */
export function applyAuctionPrivacy(
  auction: Auction,
  viewer: AuctionViewer | null,
): Auction {
  if (!viewer?.role || !viewer.username) return stripPrivateAddresses(auction);

  const isOwner =
    viewer.role === "auftraggeber" &&
    auction.ownerUsername === viewer.username;

  if (isOwner) {
    return auction;
  }

  if (transporteurHatZuschlagViewer(auction, viewer)) {
    if (!auctionTransporterMaySeeClientKontakte(auction)) {
      return stripTransporterPrePaymentKontakte(auction);
    }
    return stripTransporterPostPaymentOwnerJoin(auction);
  }

  return stripPrivateAddresses(auction);
}
