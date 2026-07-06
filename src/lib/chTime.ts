/** Schweiz (inkl. Sommer-/Winterzeit) – alle Anzeigen und Kalenderbezüge. */
export const APP_TIMEZONE = "Europe/Zurich";

type WallParts = {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  ms: number;
};

export function getZurichOffsetMinutes(atMs: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(atMs));
  const tz = p.find((x) => x.type === "timeZoneName")?.value ?? "GMT+0";
  const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const mins = m[3] ? Number(m[3]) : 0;
  return sign * (hours * 60 + mins);
}

function zurichWallParts(atMs: number): WallParts {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(atMs));
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    Number(p.find((x) => x.type === t)?.value ?? "0");
  return {
    y: g("year"),
    mo: g("month"),
    d: g("day"),
    h: g("hour"),
    mi: g("minute"),
    s: g("second"),
    ms: new Date(atMs).getMilliseconds(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function wallClockZurichToUtcMs(w: WallParts): number {
  const guessUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s, w.ms);
  const offsetMin = getZurichOffsetMinutes(guessUtc);
  return guessUtc - offsetMin * 60_000;
}

/** Schweizer Wanduhr ohne Zeitzone (Migration 030: `timestamp without time zone`). */
function parseNaiveSwissWall(s: string): WallParts | null {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/i.exec(
      s.trim(),
    );
  if (!m) return null;
  const [, ys, mos, ds, hs, mis, ss, frac] = m;
  return {
    y: Number(ys),
    mo: Number(mos),
    d: Number(ds),
    h: Number(hs),
    mi: Number(mis),
    s: Number(ss),
    ms: frac ? Number(frac.padEnd(3, "0").slice(0, 3)) : 0,
  };
}

function hasExplicitTimezone(s: string): boolean {
  return /[zZ]$/.test(s) || /[+-]\d{2}(:?\d{2})?$/.test(s);
}

/**
 * Schreibt Schweizer Wanduhr in die DB (nach Migration 030).
 * Filter/Vergleiche in Supabase weiter mit {@link auctionNowIsoForDbFilter} (ISO-UTC).
 */
export function toAuctionTimestamptzCh(ms: number): string {
  const w = zurichWallParts(ms);
  return `${w.y}-${pad2(w.mo)}-${pad2(w.d)} ${pad2(w.h)}:${pad2(w.mi)}:${pad2(w.s)}.${pad3(w.ms)}`;
}

/** „Jetzt“ als Schweizer Wanduhr für `.gt('endet_am', …)` (Migration 030). */
export function auctionNowForDbFilter(): string {
  return toAuctionTimestamptzCh(Date.now());
}

/** @deprecated Nur noch für Legacy-Vergleiche – bevorzugt {@link auctionNowForDbFilter}. */
export function auctionNowIsoForDbFilter(): string {
  return auctionNowForDbFilter();
}

/**
 * Liest Auktions-Zeitstempel.
 * - Mit `Z` / `+00` / Offset: echter UTC-Moment (legacy timestamptz).
 * - Ohne Zeitzone: Schweizer Wanduhr (Migration 030).
 */
export function parseAuctionTimestamptzCh(
  v: unknown,
  fallback = Date.now(),
): number {
  if (v == null || v === "") return fallback;
  const s = String(v).trim();
  if (!s) return fallback;

  if (hasExplicitTimezone(s)) {
    const iso = s.includes("T") ? s : s.replace(" ", "T");
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : fallback;
  }

  const naive = parseNaiveSwissWall(s);
  if (naive) return wallClockZurichToUtcMs(naive);

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : fallback;
}

export function formatTimeCh(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-CH", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeCh(ms: number): string {
  return new Date(ms).toLocaleString("de-CH", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
