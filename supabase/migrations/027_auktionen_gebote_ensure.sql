-- Behebt: „Could not find the table 'public.auktionen' in the schema cache“
-- Die App schreibt in public.auktionen (nicht in eine Tabelle mit von_ort/nach_ort).

-- Voraussetzung: public.auftraggeber (Migration 025/026)

CREATE TABLE IF NOT EXISTS public.transporteure (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  firmenname text NOT NULL DEFAULT '',
  vorname_kontakt text NOT NULL DEFAULT '',
  name_kontakt text NOT NULL DEFAULT '',
  uid text NOT NULL DEFAULT '',
  strasse text NOT NULL DEFAULT '',
  plz text NOT NULL DEFAULT '',
  ort text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  benutzername text UNIQUE,
  kuerzel text NOT NULL DEFAULT 'TX',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auktionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftraggeber_id uuid NOT NULL REFERENCES public.auftraggeber (id) ON DELETE CASCADE,
  startort text NOT NULL,
  zielort text NOT NULL,
  lieferdatum date,
  lieferzeit text,
  abholdatum date,
  hoehe text,
  breite text,
  tiefe text,
  gewicht text,
  notizen text,
  startpreis numeric NOT NULL,
  aktuelles_gebot numeric,
  dauer_sekunden int NOT NULL,
  status text NOT NULL DEFAULT 'live',
  bilder_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  endet_am timestamptz NOT NULL,
  awarded_betrag numeric,
  awarded_transporteur_id uuid REFERENCES public.transporteure (id),
  rejected_at timestamptz,
  awarded_at timestamptz,
  anzeige_id text UNIQUE,
  empf_vorname text NOT NULL DEFAULT '',
  empf_name text NOT NULL DEFAULT '',
  empf_strasse text NOT NULL DEFAULT '',
  empf_plz text NOT NULL DEFAULT '',
  empf_ort text NOT NULL DEFAULT '',
  abs_vorname text NOT NULL DEFAULT '',
  abs_name text NOT NULL DEFAULT '',
  abs_strasse text NOT NULL DEFAULT '',
  abs_plz text NOT NULL DEFAULT '',
  abs_ort text NOT NULL DEFAULT '',
  abs_email text NOT NULL DEFAULT '',
  abs_telefon text NOT NULL DEFAULT '',
  qr_token uuid
);

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS abholdatum date,
  ADD COLUMN IF NOT EXISTS empf_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_telefon text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qr_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auktionen_anzeige_id
  ON public.auktionen (anzeige_id)
  WHERE anzeige_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auktionen_ag ON public.auktionen (auftraggeber_id);
CREATE INDEX IF NOT EXISTS idx_auktionen_status_endet ON public.auktionen (status, endet_am);

CREATE TABLE IF NOT EXISTS public.gebote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auktion_id uuid NOT NULL REFERENCES public.auktionen (id) ON DELETE CASCADE,
  transporteur_id uuid NOT NULL REFERENCES public.transporteure (id) ON DELETE CASCADE,
  betrag numeric NOT NULL CHECK (betrag > 0),
  kuerzel text NOT NULL DEFAULT 'TX',
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  bidder_key text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_gebote_auktion ON public.gebote (auktion_id);

-- Tabellenrechte
GRANT SELECT, INSERT, UPDATE ON public.auktionen TO authenticated;
GRANT SELECT ON public.auktionen TO anon;
GRANT SELECT, INSERT ON public.gebote TO authenticated;
GRANT SELECT ON public.gebote TO anon;
GRANT SELECT ON public.transporteure TO authenticated;
GRANT SELECT ON public.transporteure TO anon;

ALTER TABLE public.transporteure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transporteure_select_benutzername ON public.transporteure;
CREATE POLICY transporteure_select_benutzername ON public.transporteure
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS transporteur_lookup_anon ON public.transporteure;
CREATE POLICY transporteur_lookup_anon ON public.transporteure
  FOR SELECT TO anon
  USING (true);

ALTER TABLE public.auktionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gebote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auktionen_select_owner ON public.auktionen;
CREATE POLICY auktionen_select_owner ON public.auktionen
  FOR SELECT TO authenticated
  USING (auftraggeber_id = auth.uid());

DROP POLICY IF EXISTS auktionen_insert_owner ON public.auktionen;
CREATE POLICY auktionen_insert_owner ON public.auktionen
  FOR INSERT TO authenticated
  WITH CHECK (auftraggeber_id = auth.uid());

DROP POLICY IF EXISTS auktionen_update_owner ON public.auktionen;
CREATE POLICY auktionen_update_owner ON public.auktionen
  FOR UPDATE TO authenticated
  USING (auftraggeber_id = auth.uid())
  WITH CHECK (auftraggeber_id = auth.uid());

DROP POLICY IF EXISTS auktionen_select_anon_homepage_slider ON public.auktionen;
CREATE POLICY auktionen_select_anon_homepage_slider ON public.auktionen
  FOR SELECT TO anon
  USING (
    status = 'live'
    AND endet_am > now()
    AND rejected_at IS NULL
  );

DROP POLICY IF EXISTS auktionen_select_transporteur_live ON public.auktionen;
CREATE POLICY auktionen_select_transporteur_live ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
    AND status = 'live'
    AND endet_am >= now()
    AND rejected_at IS NULL
    AND awarded_transporteur_id IS NULL
  );

DROP POLICY IF EXISTS gebote_insert_transporteur ON public.gebote;
CREATE POLICY gebote_insert_transporteur ON public.gebote
  FOR INSERT TO authenticated
  WITH CHECK (transporteur_id = auth.uid());

DROP POLICY IF EXISTS gebote_select ON public.gebote;
CREATE POLICY gebote_select ON public.gebote
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.auktionen a
      WHERE a.id = auktion_id AND a.auftraggeber_id = auth.uid()
    )
    OR transporteur_id = auth.uid()
  );

-- PostgREST Schema-Cache aktualisieren
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.auktionen IS
  'Transport-Auktionen. App-Felder: startort, zielort (nicht von_ort/nach_ort).';
