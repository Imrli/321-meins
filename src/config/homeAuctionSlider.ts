/** Intervall für automatischen Slidewechsel (ms). Über VITE_HOME_AUCTION_SLIDER_INTERVAL_MS setzbar, Standard 30 s. */
function parseIntervalMs(raw: string | undefined, fallback: number): number {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 5000) return fallback;
  return n;
}

export const HOME_AUCTION_SLIDER_INTERVAL_MS = parseIntervalMs(
  import.meta.env.VITE_HOME_AUCTION_SLIDER_INTERVAL_MS as string | undefined,
  30_000,
);

export const HOME_AUCTION_SLIDER_FADE_MS = 500;
