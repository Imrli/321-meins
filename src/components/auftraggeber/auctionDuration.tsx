import { useLayoutEffect, useRef } from "react";

export type DurationValue = { days: number; hours: number; minutes: number };

/** Gleicher Default wie Transport-Formular: 5 Minuten */
export const DEFAULT_AUCTION_DURATION: DurationValue = {
  days: 0,
  hours: 0,
  minutes: 5,
};

export function msToDuration(ms: number): DurationValue {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.min(7, Math.floor(total / 86400));
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return { days, hours, minutes };
}

export function durationValueToMs(
  value: DurationValue,
): { ok: true; durationMs: number } | { ok: false; error: string } {
  const totalSeconds =
    value.days * 86400 + value.hours * 3600 + value.minutes * 60;
  if (totalSeconds < 60) {
    return {
      ok: false,
      error: "Die Auktionsdauer muss mindestens 1 Minute betragen.",
    };
  }
  return { ok: true, durationMs: Math.max(60_000, totalSeconds * 1000) };
}

const WHEEL_ITEM = 44;
const WHEEL_HEIGHT = 5 * WHEEL_ITEM;
const WHEEL_PAD = WHEEL_HEIGHT / 2 - WHEEL_ITEM / 2;

function WheelColumn({
  label,
  max,
  value,
  onValueChange,
}: {
  label: string;
  max: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const v = Math.min(max, Math.max(0, value));
    el.scrollTop = v * WHEEL_ITEM;
  }, [max, value]);

  const handleScroll = () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const y = el.scrollTop;
      const v = Math.min(max, Math.max(0, Math.round(y / WHEEL_ITEM)));
      el.scrollTo({ top: v * WHEEL_ITEM, behavior: "smooth" });
      onValueChange(v);
    }, 100);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner"
        style={{ width: 88, height: WHEEL_HEIGHT }}
        role="group"
        aria-label={label}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 border-[var(--color-brand-700)]/70"
          style={{ height: WHEEL_ITEM }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-white to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
        <div
          ref={scroller}
          onScroll={handleScroll}
          className="wheel-scroll h-full w-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          <div style={{ height: WHEEL_PAD, flexShrink: 0 }} aria-hidden />
          {Array.from({ length: max + 1 }, (_, n) => (
            <div
              key={n}
              className="flex snap-center snap-always items-center justify-center font-mono text-2xl font-bold tabular-nums text-[var(--color-ink)]"
              style={{ height: WHEEL_ITEM, minHeight: WHEEL_ITEM }}
            >
              {String(n).padStart(2, "0")}
            </div>
          ))}
          <div style={{ height: WHEEL_PAD, flexShrink: 0 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function DurationWheel({
  value,
  onChange,
}: {
  value: DurationValue;
  onChange: (v: DurationValue) => void;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-start justify-center gap-3 sm:gap-5">
        <WheelColumn
          label="Tage"
          max={7}
          value={value.days}
          onValueChange={(v) => onChange({ ...value, days: v })}
        />
        <WheelColumn
          label="Stunden"
          max={23}
          value={value.hours}
          onValueChange={(v) => onChange({ ...value, hours: v })}
        />
        <WheelColumn
          label="Minuten"
          max={59}
          value={value.minutes}
          onValueChange={(v) => onChange({ ...value, minutes: v })}
        />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Wischen oder scrollen, um die Dauer einzustellen.
      </p>
    </div>
  );
}

/** Auktionsdauer – gleiches Layout wie im Transport-Formular */
export function AuctionDurationField({
  value,
  onChange,
}: {
  value: DurationValue;
  onChange: (v: DurationValue) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        Auktionsdauer
      </label>
      <DurationWheel value={value} onChange={onChange} />
    </div>
  );
}
