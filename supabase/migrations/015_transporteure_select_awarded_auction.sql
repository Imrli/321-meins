-- Auftraggeber darf Kontaktdaten des Transporteurs lesen, dem er auf einer
-- eigenen Auktion den Zuschlag erteilt hat (ohne generelles transporteure-SELECT).

CREATE POLICY transporteure_select_awarded_on_my_auction ON public.transporteure
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.auktionen a
      WHERE a.awarded_transporteur_id = id
        AND a.auftraggeber_id = auth.uid()
    )
  );
