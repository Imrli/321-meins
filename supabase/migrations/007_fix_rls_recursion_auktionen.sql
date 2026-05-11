-- Fix: "infinite recursion detected in policy for relation auktionen"
--
-- Ursache: In 003_321meins_app_schema.sql referenzieren sich
--   auktionen_select_transporteur_gebot  -> SELECT auf gebote
--   gebote_select                        -> SELECT auf auktionen
-- gegenseitig. Sobald INSERT … RETURNING auf auktionen läuft (PostgREST .select()
-- nach Insert), wertet Postgres die SELECT-Policies aus und gerät in Endlosrekursion.
--
-- Lösung: Cross-Table-Checks in SECURITY DEFINER-Helfer kapseln; SECURITY DEFINER
-- umgeht die RLS der Untertabelle und bricht damit die Rekursion sauber.
--
-- Hinweis: Parameter NICHT "uid" nennen — public.transporteure besitzt eine
-- Spalte "uid" (Schweizer UID-Nummer, text). Das würde im SQL-Body zu
-- "operator does not exist: uuid = text" führen.

-- ---------- Helper ----------
CREATE OR REPLACE FUNCTION public.is_transporteur(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transporteure t WHERE t.id = p_user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_transporteur(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_transporteur(uuid)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.is_auktion_owner(
  p_auktion_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auktionen a
    WHERE a.id = p_auktion_id AND a.auftraggeber_id = p_user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_auktion_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_auktion_owner(uuid, uuid)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.transporteur_has_bid_on(
  p_auktion_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gebote g
    WHERE g.auktion_id = p_auktion_id AND g.transporteur_id = p_user_id
  )
$$;

REVOKE ALL ON FUNCTION public.transporteur_has_bid_on(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transporteur_has_bid_on(uuid, uuid)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.auktion_is_open_or_user_bidded(
  p_auktion_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auktionen a
    WHERE a.id = p_auktion_id
      AND (
        (a.status = 'live' AND a.endet_am >= now() AND a.rejected_at IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.gebote g
          WHERE g.auktion_id = a.id AND g.transporteur_id = p_user_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.auktion_is_open_or_user_bidded(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auktion_is_open_or_user_bidded(uuid, uuid)
  TO authenticated, anon, service_role;

-- ---------- Alte rekursive Policies entfernen ----------
DROP POLICY IF EXISTS auktionen_select_transporteur_live  ON public.auktionen;
DROP POLICY IF EXISTS auktionen_select_transporteur_gebot ON public.auktionen;
DROP POLICY IF EXISTS gebote_select                       ON public.gebote;

-- ---------- Neue Policies ohne Zirkelbezug ----------
CREATE POLICY auktionen_select_transporteur_live ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    public.is_transporteur(auth.uid())
    AND status = 'live'
    AND endet_am >= now()
    AND rejected_at IS NULL
    AND awarded_transporteur_id IS NULL
  );

CREATE POLICY auktionen_select_transporteur_gebot ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    public.is_transporteur(auth.uid())
    AND public.transporteur_has_bid_on(id, auth.uid())
  );

CREATE POLICY gebote_select ON public.gebote
  FOR SELECT TO authenticated
  USING (
    public.is_auktion_owner(auktion_id, auth.uid())
    OR transporteur_id = auth.uid()
    OR (
      public.is_transporteur(auth.uid())
      AND public.auktion_is_open_or_user_bidded(auktion_id, auth.uid())
    )
  );
