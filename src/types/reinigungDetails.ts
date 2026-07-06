export type ReinigungJaNein = "Ja" | "Nein";
export type ReinigungArt =
  | "Standard-Reinigung"
  | "Tiefenreinigung"
  | "Bau-Endreinigung";
export type ReinigungZeitfenster = "Flexibel" | "Vormittag" | "Nachmittag";
export type ReinigungZugang = "Schlüsselübergabe" | "Vor-Ort-Termin";

export type ReinigungDetails = {
  adresse: string;
  wohnungsgroesse_qm: number;
  zimmeranzahl: number;
  reinigungsart: ReinigungArt;
  fensterreinigung: ReinigungJaNein;
  kuechenreinigung: ReinigungJaNein;
  kuehlschrank_abtauen: ReinigungJaNein;
  waschmaschine_tumbler: ReinigungJaNein;
  balkon_vorhanden: ReinigungJaNein;
  balkon_qm?: number;
  sonderwuensche?: string;
  abgabegarantie: boolean;
  datum_uhrzeit: string;
  zeitfenster: ReinigungZeitfenster;
  zugang: ReinigungZugang;
};

export {
  datumUhrzeitToAbholdatum,
  zeitfensterToLieferzeit,
} from "./umzugDetails";
