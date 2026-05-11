-- Sicherstellen, dass die Policy für Zuschläge existiert (Re-Deploy / Repair).
-- Ohne transporteur_has_bid_on: jede Zeile mit awarded_transporteur_id = ich ist lesbar.

DROP POLICY IF EXISTS auktionen_select_transporteur_awarded ON public.auktionen;

CREATE POLICY auktionen_select_transporteur_awarded ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    public.is_transporteur(auth.uid())
    AND awarded_transporteur_id = auth.uid()
  );
