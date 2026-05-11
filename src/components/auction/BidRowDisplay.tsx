import { useId, type ReactNode } from "react";
import type { Bid } from "../../types/auction";

const STAR_PATH =
  "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

/** 5 Sterne mit Teilfüllung, Wert aus DB-Spalte `bewertung` (Durchschnitt). */
export function SterneBewertung({
  value,
}: {
  value: number | null | undefined;
}) {
  const uid = useId().replace(/:/g, "");
  const hasValue = value != null && Number.isFinite(Number(value));
  const r = hasValue ? clampRating(Number(value)) : 0;
  const label = hasValue
    ? `(${(Math.round(r * 10) / 10).toFixed(1)})`
    : "(–)";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-px" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = clamp01(r - i);
          const gid = `sg-${uid}-${i}`;
          return (
            <svg
              key={i}
              width="11"
              height="11"
              viewBox="0 0 24 24"
              className="shrink-0"
              aria-hidden
            >
              {fill <= 0 ? (
                <path fill="#CCCCCC" d={STAR_PATH} />
              ) : fill >= 1 ? (
                <path fill="#FF8000" d={STAR_PATH} />
              ) : (
                <>
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FF8000" />
                      <stop offset={`${fill * 100}%`} stopColor="#FF8000" />
                      <stop offset={`${fill * 100}%`} stopColor="#CCCCCC" />
                      <stop offset="100%" stopColor="#CCCCCC" />
                    </linearGradient>
                  </defs>
                  <path fill={`url(#${gid})`} d={STAR_PATH} />
                </>
              )}
            </svg>
          );
        })}
      </span>
      <span className="text-[10px] font-normal tabular-nums text-slate-400">
        {label}
      </span>
    </span>
  );
}

export function VerifiziertVLabel() {
  return (
    <span
      className="inline-flex min-h-[14px] min-w-[14px] shrink-0 items-center justify-center px-0.5 text-[9px] font-bold leading-none text-white"
      style={{ backgroundColor: "#003399", borderRadius: "4px" }}
      title="Verifizierter Transporteur"
    >
      V
    </span>
  );
}

/** Linker Block: Kürzel, Sterne, optionales V-Label (nur bei verifiziert). */
export function FahrerInfoBlock({
  initials,
  verifiziert,
  bewertung,
  initialsClassName = "",
  initialsOnly,
}: {
  initials: string;
  verifiziert?: boolean;
  bewertung?: number | null;
  initialsClassName?: string;
  /** Nur Kürzel (z. B. öffentliche Ansicht beendeter Auktionen). */
  initialsOnly?: boolean;
}) {
  if (initialsOnly) {
    return (
      <span
        className={`shrink-0 font-semibold text-slate-800 ${initialsClassName}`.trim()}
      >
        {initials}
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <span
        className={`shrink-0 font-semibold text-slate-800 ${initialsClassName}`.trim()}
      >
        {initials}
      </span>
      <SterneBewertung value={bewertung} />
      {verifiziert === true ? <VerifiziertVLabel /> : null}
    </span>
  );
}

/** Eine kompakte Gebotszeile: Fahrer-Info links, CHF + relative Zeit rechts. */
export function GebotszeileRow({
  bid,
  timeLabel,
  timeSuffix,
  className = "",
  initialsClassName,
  fahrerInfoInitialsOnly,
}: {
  bid: Bid;
  timeLabel: string;
  /** Zusatz in derselben kleinen Zeile (z. B. „Gewinner“). */
  timeSuffix?: ReactNode;
  className?: string;
  initialsClassName?: string;
  /** Nur Zwei-Buchstaben-Kürzel, ohne Sterne/V-Icon. */
  fahrerInfoInitialsOnly?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-start justify-between gap-3 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <FahrerInfoBlock
          initials={bid.initials}
          verifiziert={bid.verifiziert}
          bewertung={bid.bewertung}
          initialsClassName={initialsClassName}
          initialsOnly={fahrerInfoInitialsOnly}
        />
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums text-slate-900">
          CHF {bid.price}
        </div>
        <div className="text-[11px] text-slate-500">
          {timeLabel}
          {timeSuffix}
        </div>
      </div>
    </div>
  );
}
