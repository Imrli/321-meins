import type {
  UmzugDetails,
  UmzugMoebelDemontage,
  UmzugUmzugsart,
  UmzugZeitfenster,
} from "@/types/umzugDetails";

export type UmzugFormState = {
  von: string;
  nach: string;
  umzugsart: UmzugUmzugsart | "";
  wohnungsgroesse_qm: string;
  zimmeranzahl: string;
  stockwerk_start: string;
  aufzug_start: boolean;
  stockwerk_ziel: string;
  aufzug_ziel: boolean;
  parkplatz: "" | "Ja" | "Nein";
  moebel_demontage: UmzugMoebelDemontage | "";
  besondere_moebel: string;
  schachteln_benoetigt: "" | "Ja" | "Nein";
  schachteln_kunde_gepackt: string;
  schachteln_unternehmen: "" | "Ja" | "Nein";
  schachteln_auspacken: "" | "Ja" | "Nein";
  zusaetzlich_einpacken: boolean;
  zusaetzlich_auspacken: boolean;
  zusaetzlich_entsorgung: boolean;
  datum_uhrzeit: string;
  zeitfenster: UmzugZeitfenster | "";
  notizen: string;
};

export const initialUmzugForm: UmzugFormState = {
  von: "",
  nach: "",
  umzugsart: "",
  wohnungsgroesse_qm: "",
  zimmeranzahl: "",
  stockwerk_start: "",
  aufzug_start: false,
  stockwerk_ziel: "",
  aufzug_ziel: false,
  parkplatz: "",
  moebel_demontage: "",
  besondere_moebel: "",
  schachteln_benoetigt: "",
  schachteln_kunde_gepackt: "",
  schachteln_unternehmen: "",
  schachteln_auspacken: "",
  zusaetzlich_einpacken: false,
  zusaetzlich_auspacken: false,
  zusaetzlich_entsorgung: false,
  datum_uhrzeit: "",
  zeitfenster: "",
  notizen: "",
};

export const UMZUG_REQUIRED_KEYS: (keyof UmzugFormState)[] = [
  "von",
  "nach",
  "umzugsart",
  "wohnungsgroesse_qm",
  "zimmeranzahl",
  "stockwerk_start",
  "stockwerk_ziel",
  "parkplatz",
  "moebel_demontage",
  "schachteln_benoetigt",
  "datum_uhrzeit",
  "zeitfenster",
];

export function collectUmzugMissing(form: UmzugFormState): Set<keyof UmzugFormState> {
  const missing = new Set<keyof UmzugFormState>();
  for (const k of UMZUG_REQUIRED_KEYS) {
    const v = form[k];
    if (typeof v === "string" && !v.trim()) missing.add(k);
  }
  return missing;
}

export function buildUmzugDetails(form: UmzugFormState): UmzugDetails {
  const details: UmzugDetails = {
    von: form.von.trim(),
    nach: form.nach.trim(),
    umzugsart: form.umzugsart as UmzugUmzugsart,
    wohnungsgroesse_qm: Number(form.wohnungsgroesse_qm),
    zimmeranzahl: Number(form.zimmeranzahl),
    stockwerk_start: Number(form.stockwerk_start),
    aufzug_start: form.aufzug_start,
    stockwerk_ziel: Number(form.stockwerk_ziel),
    aufzug_ziel: form.aufzug_ziel,
    parkplatz: form.parkplatz as "Ja" | "Nein",
    moebel_demontage: form.moebel_demontage as UmzugMoebelDemontage,
    schachteln_benoetigt: form.schachteln_benoetigt as "Ja" | "Nein",
    zusaetzliche: {
      einpacken: form.zusaetzlich_einpacken,
      auspacken: form.zusaetzlich_auspacken,
      entsorgung_verpackung: form.zusaetzlich_entsorgung,
    },
    datum_uhrzeit: form.datum_uhrzeit.trim(),
    zeitfenster: form.zeitfenster as UmzugZeitfenster,
  };
  const besondere = form.besondere_moebel.trim();
  if (besondere) details.besondere_moebel = besondere;
  if (form.schachteln_benoetigt === "Ja") {
    const gepackt = form.schachteln_kunde_gepackt.trim();
    if (gepackt) details.schachteln_kunde_gepackt = Number(gepackt);
    if (form.schachteln_unternehmen)
      details.schachteln_unternehmen = form.schachteln_unternehmen;
    if (form.schachteln_auspacken)
      details.schachteln_auspacken = form.schachteln_auspacken;
  }
  const notizen = form.notizen.trim();
  if (notizen) details.notizen = notizen;
  return details;
}
