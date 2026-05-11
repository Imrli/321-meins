-- Öffentliche Leserechte für den Startseiten-Auktions-Slider (nur anon-Client, kein JWT).
-- Nur laufende Live-Auktionen sind sichtbar.

CREATE POLICY auktionen_select_anon_homepage_slider ON public.auktionen
  FOR SELECT TO anon
  USING (
    status = 'live'
    AND endet_am > now()
    AND rejected_at IS NULL
  );

CREATE POLICY gebote_select_anon_homepage_slider ON public.gebote
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.auktionen a
      WHERE a.id = gebote.auktion_id
      AND a.status = 'live'
      AND a.endet_am > now()
      AND a.rejected_at IS NULL
    )
  );
