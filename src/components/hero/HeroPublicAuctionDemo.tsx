import { useEffect, useMemo, useState } from "react";
import type { Bid } from "../../types/auction";
import { GebotszeileRow } from "../auction/BidRowDisplay";

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
      <path d="M10 17h4" />
      <path d="M3 17h2" />
      <path d="M19 17h2" />
      <path d="M5 17H3v-4l2-5h9l4 5v4" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
    </svg>
  );
}

/**
 * Statische Musterauktion für den Hero (Startseite).
 * Bewusst KEIN Import von LiveAuctionTable – keine Supabase-Daten.
 */
export function HeroPublicAuctionDemo() {
  const [price, setPrice] = useState(248);
  const [bids, setBids] = useState(7);
  const [time, setTime] = useState({ m: 12, s: 34 });

  const previewBidRows = useMemo(
    () =>
      [
        {
          key: "a",
          bid: {
            initials: "MG",
            price,
            ts: Date.now(),
            verifiziert: true,
            bewertung: 4.2,
          } satisfies Bid,
          time: "gerade eben",
        },
        {
          key: "b",
          bid: {
            initials: "SA",
            price: price + 8,
            ts: Date.now(),
            bewertung: 3.8,
          } satisfies Bid,
          time: "vor 34 s",
        },
        {
          key: "c",
          bid: {
            initials: "UR",
            price: price + 15,
            ts: Date.now(),
            bewertung: 5.0,
          } satisfies Bid,
          time: "vor 1 min",
        },
      ] as const,
    [price],
  );

  useEffect(() => {
    const t = setInterval(() => {
      setPrice((p) => Math.max(189, p - Math.floor(Math.random() * 4 + 1)));
      setBids((b) => b + 1);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTime((x) => {
        let { m, s } = x;
        s -= 1;
        if (s < 0) {
          s = 59;
          m = Math.max(0, m - 1);
        }
        return { m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative"
      data-hero-public-demo
      aria-label="Musterauktion (Demo)"
    >
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-white/10 to-white/0 blur-2xl" />
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="rounded-[22px] bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                <TruckIcon className="size-4" />
              </span>
              <div className="text-xs font-medium text-slate-500">
                Auftrag #A-2846
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 anim-live" />
              DEMO
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <span className="text-slate-500">Von</span>
            <span className="font-medium text-slate-900">Zürich HB</span>
            <span className="text-slate-500">Nach</span>
            <span className="font-medium text-slate-900">Bern, Länggasse</span>
            <span className="text-slate-500">Art</span>
            <span className="font-medium text-slate-900">
              Umzug · 2-Zimmer · 3. Stock
            </span>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-800)] p-5 text-white">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/60">
                  Aktuelles Führungsgebot
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums">
                    CHF {price}
                  </span>
                  <span className="anim-bid text-xs font-semibold text-emerald-300">
                    ▼
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-white/60">
                  Endet in
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {String(time.m).padStart(2, "0")}:
                  {String(time.s).padStart(2, "0")}
                </div>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[var(--color-accent-400)] transition-all"
                style={{ width: `${Math.min(100, (60 - time.m) * 1.6)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/70">
              <span>{bids} Gebote</span>
              <span>Startpreis: CHF 320</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {previewBidRows.map((row) => (
              <div
                key={row.key}
                className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
              >
                <GebotszeileRow bid={row.bid} timeLabel={row.time} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
