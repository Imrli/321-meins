-- „permission denied for table auftraggeber“: Rolle authenticated braucht Tabellen-Rechte.
-- RLS-Policies allein reichen nicht, wenn GRANT fehlt.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.auftraggeber TO authenticated;
GRANT SELECT ON public.auftraggeber TO anon;

-- Policies idempotent (falls 025 nicht vollständig lief)
ALTER TABLE public.auftraggeber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auftraggeber_select_own ON public.auftraggeber;
CREATE POLICY auftraggeber_select_own ON public.auftraggeber
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS auftraggeber_insert_own ON public.auftraggeber;
CREATE POLICY auftraggeber_insert_own ON public.auftraggeber
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS auftraggeber_update_own ON public.auftraggeber;
CREATE POLICY auftraggeber_update_own ON public.auftraggeber
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
