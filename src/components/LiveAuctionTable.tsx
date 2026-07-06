import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAppAuthSession } from "../context/AppAuthSessionContext";

import type { AuctionData } from "../types/liveAuction";

import type { Bid } from "../types/auction";

import { formatTimeCh } from "../lib/chTime";
import { GebotszeileRow } from "./auction/BidRowDisplay";



export type { AuctionData } from "../types/liveAuction";



type BidRow = { key: string; bid: Bid; time: string };



function formatArtLine(auction: AuctionData): string {

  if (auction.rooms > 0 && auction.floor > 0) {

    return `${auction.type} · ${auction.rooms}-Zimmer · ${auction.floor}. Stock`;

  }

  return auction.type || "—";

}



function createBidRowsFromAuction(bids: AuctionData["bids"]): BidRow[] {

  return bids.map((b, index) => ({

    key: `${b.initials}-${index}-${b.price}`,

    bid: {

      initials: b.initials,

      price: b.price,

      ts: Date.now() - index * 60_000,

      bidderKey: b.bidderKey,

      verifiziert: b.stars >= 4,

      bewertung: b.rating,

    },

    time: b.time,

  }));

}



function rivalInitialsFromAuction(auction: AuctionData): string[] {

  const fromBids = [...new Set(auction.bids.map((b) => b.initials))];

  return fromBids.length > 0 ? fromBids : ["MG", "SA", "UR"];

}



function isTestModeActive(): boolean {

  const test = import.meta.env.VITE_TEST_ROLE?.trim();

  return test === "transporteur" || test === "auftraggeber";

}



function isDemoRivalBidEnabled(): boolean {

  return import.meta.env.VITE_TEST_ROLE?.trim() === "transporteur";

}



function randomUndercutAmount(): number {

  return 10 + Math.floor(Math.random() * 21);

}



function pickDemoRivalInitials(pool: string[], exclude: string): string {

  const candidates = pool.filter((i) => i !== exclude);

  if (candidates.length === 0) return pool[0] ?? "MG";

  return candidates[Math.floor(Math.random() * candidates.length)] ?? "MG";

}



function formatBidTime(ts: number): string {
  return formatTimeCh(ts);
}



function formatRemaining(ms: number): string {

  if (ms <= 0) return "00:00";

  const total = Math.floor(ms / 1000);

  const h = Math.floor(total / 3600);

  const m = Math.floor((total % 3600) / 60);

  const s = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;

  return `${pad(m)}:${pad(s)}`;

}



function useNow(intervalMs: number): number {

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {

    const t = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(t);

  }, [intervalMs]);

  return now;

}



function TruckIcon({ className }: { className?: string }) {

  return (

    <svg

      viewBox="0 0 24 24"

      fill="none"

      stroke="currentColor"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

      className={className}

      aria-hidden

    >

      <path d="M3 17V6a1 1 0 0 1 1-1h10v12" />

      <path d="M14 9h4l3 4v4h-2" />

      <circle cx="7.5" cy="17.5" r="2.5" />

      <circle cx="17.5" cy="17.5" r="2.5" />

    </svg>

  );

}



type LiveAuctionTableProps = {
  auction: AuctionData;
  /** Supabase/Mock: echtes Gebot; ohne Callback nur lokaler Demo-State. */
  onPlaceBid?: (price: number) => Promise<string | null>;
  /** Öffentliche Musterauktion (Hero ohne Login): unveränderte Demo-Startpreis-Anzeige. */
  publicPreview?: boolean;
};

function firstBidByTime(rows: BidRow[]): BidRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => a.bid.ts - b.bid.ts)[0] ?? null;
}

export function LiveAuctionTable({
  auction,
  onPlaceBid,
  publicPreview = false,
}: LiveAuctionTableProps) {

  const { user } = useAppAuthSession();

  const role = publicPreview ? null : user?.role ?? null;

  const isAuftraggeber = role === "auftraggeber";

  const showBidControls = role === "transporteur";

  const myInitials = (user?.initials ?? "TX").toUpperCase().slice(0, 2);

  const myUsername = user?.username?.trim().toLowerCase() ?? "";



  const now = useNow(1000);



  const rivalPool = useMemo(

    () => rivalInitialsFromAuction(auction),

    [auction],

  );



  const [leadingPrice, setLeadingPrice] = useState(auction.leadingPrice);

  const [hasLeadingBid, setHasLeadingBid] = useState(auction.hasLeadingBid);

  const [bidRows, setBidRows] = useState<BidRow[]>(() =>

    createBidRowsFromAuction(auction.bids),

  );

  const [bidCount, setBidCount] = useState(auction.bids.length);



  const [transporteurIstHöchstbietender, setTransporteurIstHöchstbietender] =

    useState(false);

  const [transporteurHatGeboten, setTransporteurHatGeboten] = useState(false);



  const [bidPrice, setBidPrice] = useState("");

  const [bidError, setBidError] = useState<string | null>(null);

  const [duWurdestUnterboten, setDuWurdestUnterboten] = useState(false);

  const [auktionBeendet, setAuktionBeendet] = useState(false);

  const [bidBusy, setBidBusy] = useState(false);



  // Reset NUR bei Wechsel der Auktion (z. B. andere id).
  // Sonst würde alle 250 ms (useNow im Caller) `bidPrice` geleert
  // und der Nutzer könnte nichts mehr eintippen.
  useEffect(() => {
    setBidPrice("");
    setBidError(null);
    setDuWurdestUnterboten(false);
  }, [auction.id]);

  // Abgeleitete Werte aus neuen Bids synchronisieren, ohne den Input zu leeren.
  useEffect(() => {
    const rows = createBidRowsFromAuction(auction.bids);
    const lowest = rows.length
      ? [...rows].sort((a, b) => a.bid.price - b.bid.price)[0]
      : null;
    const lowestKey = lowest?.bid.bidderKey?.trim().toLowerCase() ?? "";
    const leadingByUser = Boolean(myUsername) && lowestKey === myUsername;
    const myBidsCount = auction.bids.filter(
      (b) => (b.bidderKey ?? "").trim().toLowerCase() === myUsername,
    ).length;
    const wasOutbid = myBidsCount > 0 && !leadingByUser;

    setLeadingPrice(auction.leadingPrice);
    setHasLeadingBid(auction.hasLeadingBid);
    setBidRows(rows);
    setBidCount(auction.bids.length);
    setTransporteurIstHöchstbietender(leadingByUser);
    setTransporteurHatGeboten(myBidsCount > 0);
    setDuWurdestUnterboten(wasOutbid);
    setAuktionBeendet(!auction.isLive);
    // Deps absichtlich auf primitive Werte beschränkt — nicht auf
    // `auction.bids` (neue Array-Referenz pro Render des Parents).
  }, [
    auction.id,
    auction.leadingPrice,
    auction.hasLeadingBid,
    auction.bids.length,
    auction.isLive,
    myUsername,
  ]);



  const endMs = auction.endsAtMs ?? auction.startedAtMs + auction.durationMs;
  const spanMs = Math.max(1, endMs - auction.startedAtMs);
  const remaining = Math.max(0, endMs - now);
  const timeUp = remaining <= 0 || !auction.isLive;
  const elapsed = timeUp
    ? 1
    : Math.min(1, Math.max(0, (now - auction.startedAtMs) / spanMs));



  const showLiveBadge = auction.isLive && !auktionBeendet && !timeUp;

  const showDemoRivalBid =

    isDemoRivalBidEnabled() && !auktionBeendet && !timeUp && !onPlaceBid;

  const showEndAuctionDemo =

    !auktionBeendet && (isAuftraggeber || isTestModeActive());



  const gewinnerRow = useMemo(() => {

    if (bidRows.length === 0) return null;

    return [...bidRows].sort((a, b) => a.bid.price - b.bid.price)[0] ?? null;

  }, [bidRows]);



  const gewinnerName = gewinnerRow?.bid.initials ?? "—";



  const canSubmitBid =

    showBidControls &&

    !transporteurIstHöchstbietender &&

    !auktionBeendet &&

    !timeUp &&

    !bidBusy;



  const handleAuktionBeenden = () => {

    setAuktionBeendet(true);

    setDuWurdestUnterboten(false);

  };



  const handleTransporteurBeauftragen = () => {

    console.log(`Beauftrage: ${gewinnerName}`);

  };



  const submitBid = async () => {

    if (!canSubmitBid) return;



    setBidError(null);

    const raw = bidPrice.replace(",", ".").trim();

    const num = Number(raw);

    if (!Number.isFinite(num) || num <= 0) {

      setBidError("Bitte einen gültigen Preis in CHF eingeben.");

      return;

    }

    if (hasLeadingBid) {
      if (num >= leadingPrice) {
        setBidError("Preis muss unter dem aktuellen Führungsgebot liegen");
        return;
      }
    }

    if (onPlaceBid) {
      setBidBusy(true);
      const err = await onPlaceBid(num);
      setBidBusy(false);
      if (err) {
        setBidError(err);
        return;
      }

      // Sofort optimistisch: Button schwarz, Status auf "führend",
      // bidRows aktualisieren (für Startpreis + Liste). Der DB-Refresh
      // überschreibt das im nächsten useEffect-Tick mit demselben Ergebnis.
      const myTs = Date.now();
      const optimisticRow: BidRow = {
        key: `mine-${myTs}`,
        bid: {
          initials: myInitials,
          price: num,
          ts: myTs,
          bidderKey: user?.username,
          verifiziert: true,
          bewertung: 5,
        },
        time: "gerade eben",
      };
      setBidRows((prev) =>
        [
          optimisticRow,
          ...prev.map((r) =>
            r.time === "gerade eben" ? { ...r, time: "vor wenigen s" } : r,
          ),
        ].slice(0, 6),
      );
      setLeadingPrice(num);
      setHasLeadingBid(true);
      setBidCount((c) => c + 1);
      setTransporteurHatGeboten(true);
      setTransporteurIstHöchstbietender(true);
      setDuWurdestUnterboten(false);
      setBidPrice("");
      setBidError(null);
      return;
    }



    const ts = Date.now();

    const newBid: BidRow = {

      key: `mine-${ts}`,

      bid: {

        initials: myInitials,

        price: num,

        ts,

        bidderKey: user?.username,

        verifiziert: true,

        bewertung: 4.5,

      },

      time: formatBidTime(ts),

    };



    setBidRows((prev) =>

      [

        newBid,

        ...prev.map((r) =>

          r.time === "gerade eben" ? { ...r, time: "vor wenigen s" } : r,

        ),

      ].slice(0, 6),

    );

    setLeadingPrice(num);

    setHasLeadingBid(true);

    setBidCount((c) => c + 1);

    setTransporteurHatGeboten(true);

    setTransporteurIstHöchstbietender(true);

    setBidPrice("");

    setBidError(null);

    setDuWurdestUnterboten(false);

  };



  const handleBidSubmit = (e: FormEvent) => {

    e.preventDefault();

    void submitBid();

  };



  const handleDemoAndererBietet = () => {

    if (!showDemoRivalBid) return;



    const delta = randomUndercutAmount();

    const newLeading = Math.max(1, leadingPrice - delta);

    const rivalInitials = pickDemoRivalInitials(rivalPool, myInitials);

    const rivalTs = Date.now();

    const rival: BidRow = {

      key: `rival-${rivalTs}`,

      bid: {

        initials: rivalInitials,

        price: newLeading,

        ts: rivalTs,

        verifiziert: true,

        bewertung: 4.2,

      },

      time: formatBidTime(rivalTs),

    };



    setBidRows((prev) =>

      [

        rival,

        ...prev.map((r) =>

          r.time === "gerade eben" ? { ...r, time: "vor wenigen s" } : r,

        ),

      ].slice(0, 6),

    );

    setLeadingPrice(newLeading);

    setHasLeadingBid(true);

    setBidCount((c) => c + 1);

    setTransporteurIstHöchstbietender(false);

    setDuWurdestUnterboten(true);

  };



  useEffect(() => {

    if (!duWurdestUnterboten) return;

    const id = window.setTimeout(() => setDuWurdestUnterboten(false), 8000);

    return () => window.clearTimeout(id);

  }, [duWurdestUnterboten]);



  const displayBidRows = useMemo(() => {

    return [...bidRows]

      .sort((a, b) => a.bid.price - b.bid.price)

      .slice(0, 3);

  }, [bidRows]);

  const useSessionStartpreis =
    !publicPreview && (role === "auftraggeber" || role === "transporteur");
  const firstBidRow = useMemo(
    () => (useSessionStartpreis ? firstBidByTime(bidRows) : null),
    [bidRows, useSessionStartpreis],
  );
  const startpreisFooter = useSessionStartpreis
    ? firstBidRow
      ? `Startpreis: CHF ${firstBidRow.bid.price}`
      : "Startpreis: CHF –"
    : `Startpreis: CHF ${auction.startPrice}`;
  const bidPlaceholder = hasLeadingBid
    ? `Unter CHF ${leadingPrice}`
    : "Dein Gebot in CHF";

  return (

    <div className="relative">

      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-white/10 to-white/0 blur-2xl" />

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">

        <div

          className="rounded-[22px] bg-white p-6"

          role="region"

          aria-label={`Live-Auktion ${auction.id}`}

        >

          <div className="flex items-center justify-between gap-2">

            <div className="flex min-w-0 items-center gap-2">

              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">

                <TruckIcon className="size-4" />

              </span>

              <div className="min-w-0">

                <div className="text-xs font-medium text-slate-500">

                  Auftrag #{auction.id}

                </div>

                {auction.title ? (

                  <div className="truncate text-[11px] text-slate-400">

                    {auction.title}

                  </div>

                ) : null}

              </div>

            </div>

            {auktionBeendet || timeUp ? (

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">

                Beendet

              </span>

            ) : showLiveBadge ? (

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">

                <span className="size-1.5 rounded-full bg-emerald-500 anim-live" />

                LIVE

              </span>

            ) : null}

          </div>



          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">

            <span className="text-slate-500">Von</span>

            <span className="font-medium text-slate-900">{auction.from}</span>

            <span className="text-slate-500">Nach</span>

            <span className="font-medium text-slate-900">{auction.to}</span>

            <span className="text-slate-500">Art</span>

            <span className="font-medium text-slate-900">{formatArtLine(auction)}</span>

          </div>



          <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-800)] p-5 text-white">

            <div className="flex items-baseline justify-between gap-3">

              <div>

                <div className="text-[11px] uppercase tracking-wider text-white/60">

                  Aktuelles Führungsgebot

                </div>

                <div className="mt-1 flex items-baseline gap-1">

                  <span className="text-4xl font-extrabold tabular-nums">

                    {hasLeadingBid ? `CHF ${leadingPrice}` : "—"}

                  </span>

                  {hasLeadingBid && !timeUp && (

                    <span className="anim-bid text-xs font-semibold text-emerald-300">

                      ▼

                    </span>

                  )}

                </div>

              </div>

              <div className="shrink-0 text-right">

                <div className="text-[11px] uppercase tracking-wider text-white/60">

                  Endet in

                </div>

                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">

                  {timeUp ? "00:00" : formatRemaining(remaining)}

                </div>

              </div>

            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">

              <div

                className="h-full rounded-full bg-[var(--color-accent-400)] transition-all"

                style={{ width: `${elapsed * 100}%` }}

              />

            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/70">

              <span>

                {bidCount} {bidCount === 1 ? "Gebot" : "Gebote"}

              </span>

              <span>{startpreisFooter}</span>

            </div>

          </div>



          <div className="mt-4 space-y-2" aria-label="Gebotsliste">

            {displayBidRows.length === 0 ? (

              <p className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm text-slate-500">

                Noch keine Gebote eingegangen.

              </p>

            ) : (

              displayBidRows.map((row) => (

                <div

                  key={row.key}

                  className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"

                >

                  <GebotszeileRow bid={row.bid} timeLabel={row.time} />

                </div>

              ))

            )}

          </div>



          {showEndAuctionDemo && (

            <button

              type="button"

              onClick={handleAuktionBeenden}

              className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 sm:w-auto"

            >

              Auktion beenden (Demo)

            </button>

          )}



          {auktionBeendet && isAuftraggeber && gewinnerRow && (

            <div

              className="mt-4 rounded-2xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)]/60 p-4"

              aria-label="Auktionsgewinner"

            >

              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-700)]">

                Gewinner

              </p>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="min-w-0 flex-1 rounded-xl border border-white/80 bg-white px-3 py-2 text-sm shadow-sm">

                  <GebotszeileRow

                    bid={gewinnerRow.bid}

                    timeLabel={gewinnerRow.time}

                  />

                </div>

                <button

                  type="button"

                  onClick={handleTransporteurBeauftragen}

                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-700)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-800)] transition-colors btn-action-shine"

                >

                  Transporteur beauftragen

                </button>

              </div>

            </div>

          )}



          {showBidControls && !auktionBeendet && !timeUp && (

            <div

              className="mt-4 rounded-2xl border border-slate-200 bg-[var(--color-surface-alt)] p-4"

              aria-label="Gebot abgeben"

            >

              {canSubmitBid ? (

                <form onSubmit={handleBidSubmit}>

                  <label

                    htmlFor="live-auction-bid-price"

                    className="block text-sm font-semibold text-slate-800"

                  >

                    Dein Gebot

                  </label>

                  <div className="mt-2 flex flex-row flex-wrap items-center gap-2">

                    <input

                      id="live-auction-bid-price"

                      type="number"

                      inputMode="decimal"

                      value={bidPrice}

                      onChange={(e) => {

                        setBidPrice(e.target.value);

                        setBidError(null);

                      }}

                      placeholder={bidPlaceholder}

                      min={1}

                      step={1}

                      disabled={bidBusy}

                      className="w-full min-w-[7rem] max-w-[10rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/20 disabled:opacity-60"

                    />

                    <button

                      type="submit"

                      disabled={bidBusy}

                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors btn-action-shine disabled:opacity-60"

                    >

                      {bidBusy ? "Wird gesendet…" : "Bieten"}

                    </button>

                  </div>

                  {bidError && (

                    <p className="mt-2 text-sm font-medium text-red-600" role="alert">

                      {bidError}

                    </p>

                  )}

                </form>

              ) : (
                <div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white sm:w-auto"
                  >
                    Du bist führend
                  </button>
                  <p className="mt-2 text-xs text-slate-600">
                    Du bist führend
                    {hasLeadingBid ? ` mit CHF ${leadingPrice}` : ""}
                    {" "}– warte, bis du unterboten wirst.
                  </p>
                </div>
              )}

              {canSubmitBid && duWurdestUnterboten && (
                <p className="mt-2 text-sm font-medium text-red-600" role="status">
                  Du wurdest unterboten – du kannst wieder bieten.
                </p>
              )}
              {canSubmitBid && !duWurdestUnterboten && !transporteurHatGeboten && (
                <p className="mt-2 text-xs text-slate-500">
                  Du hast noch kein Gebot abgegeben.
                </p>
              )}



              {showDemoRivalBid && (

                <button

                  type="button"

                  onClick={handleDemoAndererBietet}

                  className="mt-3 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-[var(--color-brand-400)] hover:text-[var(--color-brand-700)]"

                >

                  Demo: Anderer bietet

                </button>

              )}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}



export default LiveAuctionTable;

