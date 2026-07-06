-- Auktionszeiten als Schweizer Wanduhr (ohne UTC-Umrechnung in der Tabellenansicht).
-- Bestehende timestamptz-Werte werden nach Europe/Zurich umgerechnet.

ALTER TABLE public.auktionen
  ALTER COLUMN erstellt_am TYPE timestamp without time zone
    USING (erstellt_am AT TIME ZONE 'Europe/Zurich'),
  ALTER COLUMN endet_am TYPE timestamp without time zone
    USING (endet_am AT TIME ZONE 'Europe/Zurich');

ALTER TABLE public.auktionen
  ALTER COLUMN erstellt_am SET DEFAULT (timezone('Europe/Zurich', now()));

-- RLS/Vergleiche: „jetzt“ in Schweizer Ortszeit
DROP POLICY IF EXISTS auktionen_select_anon_homepage_slider ON public.auktionen;
CREATE POLICY auktionen_select_anon_homepage_slider ON public.auktionen
  FOR SELECT TO anon
  USING (
    status = 'live'
    AND endet_am > timezone('Europe/Zurich', now())
    AND rejected_at IS NULL
  );

DROP POLICY IF EXISTS auktionen_select_transporteur_live ON public.auktionen;
CREATE POLICY auktionen_select_transporteur_live ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
    AND status = 'live'
    AND endet_am >= timezone('Europe/Zurich', now())
    AND rejected_at IS NULL
    AND awarded_transporteur_id IS NULL
  );

DROP POLICY IF EXISTS gebote_select_transporteur_live ON public.gebote;
CREATE POLICY gebote_select_transporteur_live ON public.gebote
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.auktionen a
      WHERE a.id = auktion_id
        AND EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
        AND a.status = 'live'
        AND a.endet_am >= timezone('Europe/Zurich', now())
        AND a.rejected_at IS NULL
        AND a.awarded_transporteur_id IS NULL
    )
  );

NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.auktionen.erstellt_am IS
  'Schweizer Ortszeit (Europe/Zurich), ohne Zeitzone – Anzeige = Wanduhr CH.';
COMMENT ON COLUMN public.auktionen.endet_am IS
  'Schweizer Ortszeit (Europe/Zurich), Ende der Auktion.';
