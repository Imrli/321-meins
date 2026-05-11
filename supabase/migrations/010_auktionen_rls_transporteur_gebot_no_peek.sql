-- Transporteure mit Gebot dürfen Zeilen nur noch lesen, solange kein Dritter
-- den Zuschlag erhalten hat. Nach Zuschlag an einen anderen Transporteur: kein Zugriff
-- mehr (verhindert Auslesen der Adressdaten über die API).

DROP POLICY IF EXISTS auktionen_select_transporteur_gebot ON public.auktionen;

CREATE POLICY auktionen_select_transporteur_gebot ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    public.is_transporteur(auth.uid())
    AND public.transporteur_has_bid_on(id, auth.uid())
    AND (
      awarded_transporteur_id = auth.uid()
      OR awarded_transporteur_id IS NULL
    )
  );
