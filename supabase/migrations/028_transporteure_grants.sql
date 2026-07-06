-- Nach Migration 027: „permission denied for table transporteure“
-- Ursache: Tabelle wurde angelegt, aber ohne GRANT/RLS für authenticated/anon.
-- Die App lädt nach dem Insert Auktionen inkl. Join gebote → transporteure.

ALTER TABLE public.transporteure
  ADD COLUMN IF NOT EXISTS verifiziert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bewertung numeric,
  ADD COLUMN IF NOT EXISTS bewertung_kommentar text;

GRANT SELECT ON public.transporteure TO authenticated;
GRANT SELECT ON public.transporteure TO anon;

ALTER TABLE public.transporteure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transporteure_select_own ON public.transporteure;
CREATE POLICY transporteure_select_own ON public.transporteure
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS transporteure_select_benutzername ON public.transporteure;
CREATE POLICY transporteure_select_benutzername ON public.transporteure
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS transporteure_insert_own ON public.transporteure;
CREATE POLICY transporteure_insert_own ON public.transporteure
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS transporteure_update_own ON public.transporteure;
CREATE POLICY transporteure_update_own ON public.transporteure
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS transporteur_lookup_anon ON public.transporteure;
CREATE POLICY transporteur_lookup_anon ON public.transporteure
  FOR SELECT TO anon
  USING (true);

-- FK-Prüfung beim INSERT in auktionen darf nicht an fehlenden Rechten auf transporteure scheitern
ALTER TABLE public.auktionen
  DROP CONSTRAINT IF EXISTS auktionen_awarded_transporteur_id_fkey;

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS awarded_transporteur_id uuid;

-- Optional wieder verknüpfen, wenn transporteure-Zeilen existieren (ohne harte INSERT-Blockade)
-- ALTER TABLE public.auktionen
--   ADD CONSTRAINT auktionen_awarded_transporteur_id_fkey
--   FOREIGN KEY (awarded_transporteur_id) REFERENCES public.transporteure (id);

NOTIFY pgrst, 'reload schema';
