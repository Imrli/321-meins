-- Stellt public.auftraggeber bereit (falls Cloud-DB ohne Migration 003).
-- Kernspalten laut App-Spezifikation + Felder für Login/Profil (email, telefon, benutzername).

CREATE TABLE IF NOT EXISTS public.auftraggeber (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  vorname text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  strasse text NOT NULL DEFAULT '',
  hausnummer text NOT NULL DEFAULT '',
  plz text NOT NULL DEFAULT '',
  ort text NOT NULL DEFAULT '',
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  benutzername text UNIQUE,
  bewertung numeric,
  bewertung_kommentar text
);

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS hausnummer text NOT NULL DEFAULT '';

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS erstellt_am timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS telefon text NOT NULL DEFAULT '';

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS benutzername text;

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS bewertung numeric;

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS bewertung_kommentar text;

-- Bestehende created_at-Werte nach erstellt_am übernehmen (Migration 003)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auftraggeber'
      AND column_name = 'created_at'
  ) THEN
    UPDATE public.auftraggeber ag
    SET erstellt_am = ag.created_at
    WHERE ag.created_at IS NOT NULL
      AND (ag.erstellt_am IS NULL OR ag.erstellt_am = '1970-01-01 00:00:00+00'::timestamptz);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auftraggeber_benutzername
  ON public.auftraggeber (benutzername)
  WHERE benutzername IS NOT NULL;

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

DROP POLICY IF EXISTS auftraggeber_benutzername_lookup ON public.auftraggeber;
CREATE POLICY auftraggeber_benutzername_lookup ON public.auftraggeber
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS auftraggeber_lookup_anon ON public.auftraggeber;
CREATE POLICY auftraggeber_lookup_anon ON public.auftraggeber
  FOR SELECT TO anon
  USING (true);

-- Registrierung: Zeile in auftraggeber aus user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ar text;
  em text;
BEGIN
  em := COALESCE(NEW.email, '');
  ar := NEW.raw_user_meta_data ->> 'app_role';

  IF ar = 'transporteur' THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'transporteure'
    ) THEN
      INSERT INTO public.transporteure (
        id, firmenname, vorname_kontakt, name_kontakt, uid,
        strasse, plz, ort, telefon, email, benutzername, kuerzel,
        versicherungsnachweis_url
      )
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'firmenname', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'vorname_kontakt', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'name_kontakt', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'uid', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'strasse', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'plz', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'ort', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'telefon', ''),
        em,
        COALESCE(NEW.raw_user_meta_data ->> 'benutzername', split_part(em, '@', 1)),
        upper(left(trim(COALESCE(NEW.raw_user_meta_data ->> 'kuerzel', 'TX')), 2)),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'versicherungsnachweis_url'), '')
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSE
    INSERT INTO public.auftraggeber (
      id, vorname, name, email, strasse, hausnummer, plz, ort, telefon, benutzername
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'vorname', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
      em,
      COALESCE(NEW.raw_user_meta_data ->> 'strasse', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'hausnummer', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'plz', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'ort', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'telefon', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'benutzername', split_part(em, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

COMMENT ON TABLE public.auftraggeber IS
  'Profil Auftraggeber (1:1 auth.users). Absenderadresse für Auktionen.';

-- Bestehende Auth-User ohne Zeile (z. B. vor Trigger) aus Metadaten anlegen
INSERT INTO public.auftraggeber (
  id, vorname, name, email, strasse, hausnummer, plz, ort, telefon, benutzername
)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'vorname', ''),
  COALESCE(u.raw_user_meta_data ->> 'name', ''),
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data ->> 'strasse', ''),
  COALESCE(u.raw_user_meta_data ->> 'hausnummer', ''),
  COALESCE(u.raw_user_meta_data ->> 'plz', ''),
  COALESCE(u.raw_user_meta_data ->> 'ort', ''),
  COALESCE(u.raw_user_meta_data ->> 'telefon', ''),
  COALESCE(
    u.raw_user_meta_data ->> 'benutzername',
    split_part(COALESCE(u.email, 'user'), '@', 1)
  )
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data ->> 'app_role', 'auftraggeber') <> 'transporteur'
  AND NOT EXISTS (
    SELECT 1 FROM public.auftraggeber ag WHERE ag.id = u.id
  )
ON CONFLICT (id) DO NOTHING;
