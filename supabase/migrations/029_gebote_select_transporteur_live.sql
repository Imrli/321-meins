-- Transporteure sehen alle Gebote auf Live-Auktionen, die sie laut RLS lesen dürfen
-- (Dashboard, LiveAuctionTable, Führungsgebot).

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
        AND a.endet_am >= now()
        AND a.rejected_at IS NULL
        AND a.awarded_transporteur_id IS NULL
    )
  );

NOTIFY pgrst, 'reload schema';
