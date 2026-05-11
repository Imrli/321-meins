import { useEffect, useMemo, useState } from "react";

function formatParts(ms: number) {
  if (ms <= 0) return { totalLabel: "00:00", withHours: "00:00" };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (h > 0) {
    return { totalLabel: `${p(h)}:${p(m)}:${p(s)}`, withHours: `${p(h)}:${p(m)}:${p(s)}` };
  }
  return { totalLabel: `${p(m)}:${p(s)}`, withHours: `${p(m)}:${p(s)}` };
}

const warned10 = new Set<string>();

export function useCountdown(endIso: string, vibrateId?: string) {
  const end = useMemo(() => new Date(endIso).getTime(), [endIso]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [end]);

  const remainingMs = end - Date.now();
  const parts = formatParts(remainingMs);
  const expired = remainingMs <= 0;
  const under10s = !expired && remainingMs <= 10_000;

  useEffect(() => {
    if (!under10s || !vibrateId) return;
    if (warned10.has(vibrateId)) return;
    warned10.add(vibrateId);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(200);
      } catch {
        /* ok */
      }
    }
  }, [under10s, vibrateId]);

  return {
    remainingLabel: expired ? "00:00" : parts.withHours,
    shortLabel: parts.totalLabel,
    expired,
    under10s,
  };
}
