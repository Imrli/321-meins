export type ProfilRolle = "kunde" | "transporteur";

/** offen = Auktion; vermittelt = Sieger fest; leer = keine Gebote, 1h Sperre */
export type AuftragStatus = "offen" | "vermittelt" | "leer_abgelaufen";

export interface Profil {
  id: string;
  rolle: ProfilRolle;
  benutzername: string;
  zahlungsstatus: boolean;
  created_at: string;
  /** Mock-Router: Anzeige wie Supabase-Transporteur (Gebotslisten) */
  gebotsliste_verifiziert?: boolean;
  gebotsliste_bewertung?: number | null;
}

export interface Auftrag {
  id: string;
  kunde_id: string;
  /** z. B. Möbel, Paletten – Mock-Legacy; Supabase nutzt dienstleistung_typ */
  dienstleistung_typ: string;
  beschreibung: string | null;
  notizen: string | null;
  bilder: string[];
  abholort: string | null;
  zielort: string | null;
  gewicht_kg: number | null;
  laenge_cm: number | null;
  breite_cm: number | null;
  hoehe_cm: number | null;
  /** Gewählte Auktionsdauer (H MS-Picker) */
  countdown_dauer_sekunden: number;
  countdown_ende: string;
  status: AuftragStatus;
  /** Nach Holländische Auktion: niedrigstes (frühester bei gleichem Kurs) */
  bestes_gebot_id: string | null;
  /** Eindeutige Sperr-Referenz: gleiche Anfrage während Cooldown */
  anfrage_key: string;
  /** Nach leerer Auktion: danach erneut startbar (ISO) */
  wiederholbar_ab: string | null;
  created_at: string;
}

export interface Gebot {
  id: string;
  auftrag_id: string;
  transporteur_id: string;
  preis_chf: number;
  created_at: string;
}
