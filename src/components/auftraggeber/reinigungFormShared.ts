import type {
  ReinigungArt,
  ReinigungDetails,
  ReinigungZeitfenster,
  ReinigungZugang,
} from "@/types/reinigungDetails";

export type ReinigungFormState = {
  adresse: string;
  wohnungsgroesse_qm: string;
  zimmeranzahl: string;
  reinigungsart: ReinigungArt | "";
  fensterreinigung: "" | "Ja" | "Nein";
  kuechenreinigung: "" | "Ja" | "Nein";
  kuehlschrank_abtauen: "" | "Ja" | "Nein";
  waschmaschine_tumbler: "" | "Ja" | "Nein";
  balkon_vorhanden: "" | "Ja" | "Nein";
  balkon_qm: string;
  sonderwuensche: string;
  abgabegarantie: boolean;
  datum_uhrzeit: string;
  zeitfenster: ReinigungZeitfenster | "";
  zugang: ReinigungZugang | "";
};

export const initialReinigungForm: ReinigungFormState = {
  adresse: "",
  wohnungsgroesse_qm: "",
  zimmeranzahl: "",
  reinigungsart: "",
  fensterreinigung: "",
  kuechenreinigung: "",
  kuehlschrank_abtauen: "",
  waschmaschine_tumbler: "",
  balkon_vorhanden: "",
  balkon_qm: "",
  sonderwuensche: "",
  abgabegarantie: false,
  datum_uhrzeit: "",
  zeitfenster: "",
  zugang: "",
};

export const REINIGUNG_REQUIRED_KEYS: (keyof ReinigungFormState)[] = [
  "adresse",
  "wohnungsgroesse_qm",
  "zimmeranzahl",
  "reinigungsart",
  "fensterreinigung",
  "kuechenreinigung",
  "kuehlschrank_abtauen",
  "waschmaschine_tumbler",
  "balkon_vorhanden",
  "datum_uhrzeit",
  "zeitfenster",
  "zugang",
];

export function collectReinigungMissing(
  form: ReinigungFormState,
): Set<keyof ReinigungFormState> {
  const missing = new Set<keyof ReinigungFormState>();
  for (const k of REINIGUNG_REQUIRED_KEYS) {
    const v = form[k];
    if (typeof v === "string" && !v.trim()) missing.add(k);
  }
  return missing;
}

export function buildReinigungDetails(form: ReinigungFormState): ReinigungDetails {
  const details: ReinigungDetails = {
    adresse: form.adresse.trim(),
    wohnungsgroesse_qm: Number(form.wohnungsgroesse_qm),
    zimmeranzahl: Number(form.zimmeranzahl),
    reinigungsart: form.reinigungsart as ReinigungArt,
    fensterreinigung: form.fensterreinigung as "Ja" | "Nein",
    kuechenreinigung: form.kuechenreinigung as "Ja" | "Nein",
    kuehlschrank_abtauen: form.kuehlschrank_abtauen as "Ja" | "Nein",
    waschmaschine_tumbler: form.waschmaschine_tumbler as "Ja" | "Nein",
    balkon_vorhanden: form.balkon_vorhanden as "Ja" | "Nein",
    abgabegarantie: form.abgabegarantie,
    datum_uhrzeit: form.datum_uhrzeit.trim(),
    zeitfenster: form.zeitfenster as ReinigungZeitfenster,
    zugang: form.zugang as ReinigungZugang,
  };
  const sonder = form.sonderwuensche.trim();
  if (sonder) details.sonderwuensche = sonder;
  if (form.balkon_vorhanden === "Ja") {
    const qm = form.balkon_qm.trim();
    if (qm) details.balkon_qm = Number(qm);
  }
  return details;
}
