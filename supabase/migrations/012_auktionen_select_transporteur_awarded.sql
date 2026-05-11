-- Jede an diesen Transporteur vergebene Auktion SELECT-fähig, unabhängig von
-- transporteur_has_bid_on (z. B. Datenanomalien). Ergänzt die bestehenden Policies per OR.

CREATE POLICY auktionen_select_transporteur_awarded ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    public.is_transporteur(auth.uid())
    AND awarded_transporteur_id = auth.uid()
  );
