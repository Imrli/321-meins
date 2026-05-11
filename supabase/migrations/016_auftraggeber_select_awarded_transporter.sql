-- Gewinner-Transporteur darf Profil-Kontakt des Auftraggebers lesen (JOIN in fetch), zusätzlich zu Snapshot-Spalten auf auktionen.

CREATE POLICY auftraggeber_select_if_awarded_my_transport ON public.auftraggeber
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.auktionen a
      WHERE a.auftraggeber_id = id
        AND a.awarded_transporteur_id = auth.uid()
    )
  );
