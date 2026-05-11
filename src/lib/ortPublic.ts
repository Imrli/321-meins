/** Nur Ortsname / Kurzbezeichnung – für öffentliche Transporteur-Ansichten. */
export function ortOeffentlich(raw: string): string {
  const s = raw.trim();
  if (!s) return "—";
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const plzOrt = last.match(/^(\d{4})\s+(.+)$/);
    if (plzOrt) return plzOrt[2];
    return last;
  }
  return s;
}
