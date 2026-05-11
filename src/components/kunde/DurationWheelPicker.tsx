import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ITEM = 48;
const WHEEL = 5 * ITEM;
const PAD = WHEEL / 2 - ITEM / 2;

export type DurationWheelValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type ColProps = {
  label: string;
  max: number;
  value: number;
  onValueChange: (v: number) => void;
  "aria-label"?: string;
};

function WheelColumn({ label, max, value, onValueChange, "aria-label": ariaLabel }: ColProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const v = Math.min(max, Math.max(0, value));
    el.scrollTop = v * ITEM;
  }, [max, value]);

  const onScroll = () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const y = el.scrollTop;
      const v = Math.min(max, Math.max(0, Math.round(y / ITEM)));
      el.scrollTo({ top: v * ITEM, behavior: "smooth" });
      onValueChange(v);
    }, 100);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </span>
      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
        style={{ width: "5.5rem", height: WHEEL }}
        role="group"
        aria-label={ariaLabel}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 border-[#1E3A5F]/80"
          style={{ height: ITEM }}
        />
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full w-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          <div style={{ height: PAD, flexShrink: 0 }} aria-hidden />
          {Array.from({ length: max + 1 }, (_, n) => (
            <div
              key={n}
              className="flex snap-center snap-always items-center justify-center font-mono text-2xl font-semibold tabular-nums text-[#1F2937] sm:text-3xl"
              style={{ height: ITEM, minHeight: ITEM }}
            >
              {n}
            </div>
          ))}
          <div style={{ height: PAD, flexShrink: 0 }} aria-hidden />
        </div>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      </div>
    </div>
  );
}

type Props = {
  defaultValue: DurationWheelValue;
  onChange: (v: DurationWheelValue) => void;
  className?: string;
};

/**
 * iOS-ähnliches Rad: vier Spalten (Tg 0–7, Std 0–23, Min 0–59, Sek 0–59).
 * Zentriert vor dem Start, grosse Ziffern. Neuaufsetzen: Parent `key` erhöhen.
 */
export function DurationWheelPicker({ defaultValue, onChange, className = "" }: Props) {
  const [d, setD] = useState(() => defaultValue.days);
  const [h, setH] = useState(() => defaultValue.hours);
  const [m, setM] = useState(() => defaultValue.minutes);
  const [s, setS] = useState(() => defaultValue.seconds);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current({ days: d, hours: h, minutes: m, seconds: s });
  }, [d, h, m, s]);

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center justify-center gap-1 ${className}`}>
      <p className="text-center text-sm text-[#6B7280]">Auktionsdauer (einmal, vor Start)</p>
      <div className="mt-1 flex w-full max-w-2xl items-start justify-center gap-2 overflow-x-auto px-1 pb-1 sm:gap-4">
        <WheelColumn
          label="Tg"
          max={7}
          value={d}
          onValueChange={setD}
          aria-label="Tage"
        />
        <WheelColumn
          label="Std"
          max={23}
          value={h}
          onValueChange={setH}
          aria-label="Stunden"
        />
        <WheelColumn
          label="Min"
          max={59}
          value={m}
          onValueChange={setM}
          aria-label="Minuten"
        />
        <WheelColumn
          label="Sek"
          max={59}
          value={s}
          onValueChange={setS}
          aria-label="Sekunden"
        />
      </div>
    </div>
  );
}

export function durationToSekunden(d: DurationWheelValue): number {
  return d.days * 86400 + d.hours * 3600 + d.minutes * 60 + d.seconds;
}
