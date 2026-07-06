export type UmzugUmzugsart = "Privat" | "Gewerbe" | "Büro";
export type UmzugJaNein = "Ja" | "Nein";
export type UmzugMoebelDemontage =
  | "Ja, mit Demontage"
  | "Ja, ohne Demontage"
  | "Nein";
export type UmzugZeitfenster = "Flexibel" | "Vormittag" | "Nachmittag";

export type UmzugDetails = {
  von: string;
  nach: string;
  umzugsart: UmzugUmzugsart;
  wohnungsgroesse_qm: number;
  zimmeranzahl: number;
  stockwerk_start: number;
  aufzug_start: boolean;
  stockwerk_ziel: number;
  aufzug_ziel: boolean;
  parkplatz: UmzugJaNein;
  moebel_demontage: UmzugMoebelDemontage;
  besondere_moebel?: string;
  schachteln_benoetigt: UmzugJaNein;
  schachteln_kunde_gepackt?: number;
  schachteln_unternehmen?: UmzugJaNein;
  schachteln_auspacken?: UmzugJaNein;
  zusaetzliche: {
    einpacken: boolean;
    auspacken: boolean;
    entsorgung_verpackung: boolean;
  };
  datum_uhrzeit: string;
  zeitfenster: UmzugZeitfenster;
  notizen?: string;
};

export function zeitfensterToLieferzeit(
  z: UmzugZeitfenster,
): "flexibel" | "vormittags" | "nachmittags" {
  if (z === "Vormittag") return "vormittags";
  if (z === "Nachmittag") return "nachmittags";
  return "flexibel";
}

export function datumUhrzeitToAbholdatum(isoLocal: string): string {
  const d = isoLocal.trim();
  if (!d) return "";
  return d.slice(0, 10);
}
