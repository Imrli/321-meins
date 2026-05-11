-- App-Integration: Auftraggeber / Transporteure / Auktionen / Gebote
-- Ersetzt das ältere profile/auftraege-Modell für diese App.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS trg_profile_zahlungsstatus ON public.profile;
DROP FUNCTION IF EXISTS public.profile_schuetze_zahlungsstatus();

DROP TABLE IF EXISTS public.gebote CASCADE;
DROP TABLE IF EXISTS public.auftraege CASCADE;
DROP TABLE IF EXISTS public.profile CASCADE;

DROP FUNCTION IF EXISTS public.auftrag_countdown_laeuft(text, timestamptz);

CREATE TABLE public.auftraggeber (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  vorname text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  strasse text NOT NULL,
  plz text NOT NULL,
  ort text NOT NULL,
  telefon text NOT NULL,
  benutzername text NOT NULL UNIQUE,
  passwort_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transporteure (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  firmenname text NOT NULL,
  vorname_kontakt text NOT NULL,
  name_kontakt text NOT NULL,
  uid text NOT NULL,
  strasse text NOT NULL,
  plz text NOT NULL,
  ort text NOT NULL,
  telefon text NOT NULL,
  email text NOT NULL,
  benutzername text NOT NULL UNIQUE,
  passwort_hash text,
  versicherungsnachweis_url text,
  kuerzel text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.auktionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftraggeber_id uuid NOT NULL REFERENCES public.auftraggeber (id) ON DELETE CASCADE,
  startort text NOT NULL,
  zielort text NOT NULL,
  lieferdatum date,
  lieferzeit text,
  hoehe text,
  breite text,
  tiefe text,
  gewicht text,
  notizen text,
  startpreis numeric NOT NULL,
  aktuelles_gebot numeric,
  dauer_sekunden int NOT NULL,
  status text NOT NULL DEFAULT 'live',
  bilder_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  endet_am timestamptz NOT NULL,
  awarded_betrag numeric,
  awarded_transporteur_id uuid REFERENCES public.transporteure (id),
  rejected_at timestamptz,
  awarded_at timestamptz,
  anzeige_id text UNIQUE
);

CREATE INDEX idx_auktionen_ag ON public.auktionen (auftraggeber_id);
CREATE INDEX idx_auktionen_status_endet ON public.auktionen (status, endet_am);

CREATE TABLE public.gebote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auktion_id uuid NOT NULL REFERENCES public.auktionen (id) ON DELETE CASCADE,
  transporteur_id uuid NOT NULL REFERENCES public.transporteure (id) ON DELETE CASCADE,
  betrag numeric NOT NULL CHECK (betrag > 0),
  kuerzel text NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  bidder_key text NOT NULL DEFAULT ''
);

CREATE INDEX idx_gebote_auktion ON public.gebote (auktion_id);
CREATE INDEX idx_gebote_transporteur ON public.gebote (transporteur_id);

ALTER TABLE public.auktionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gebote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auftraggeber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporteure ENABLE ROW LEVEL SECURITY;

CREATE POLICY auftraggeber_select_own ON public.auftraggeber
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY auftraggeber_insert_own ON public.auftraggeber
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY auftraggeber_update_own ON public.auftraggeber
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY transporteure_select_own ON public.transporteure
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY transporteure_insert_own ON public.transporteure
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY transporteure_update_own ON public.transporteure
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY transporteure_select_benutzername ON public.transporteure
  FOR SELECT TO authenticated USING (true);

CREATE POLICY auftraggeber_benutzername_lookup ON public.auftraggeber
  FOR SELECT TO authenticated USING (true);

CREATE POLICY auftraggeber_lookup_anon ON public.auftraggeber
  FOR SELECT TO anon USING (true);

CREATE POLICY transporteur_lookup_anon ON public.transporteure
  FOR SELECT TO anon USING (true);

CREATE POLICY auktionen_select_owner ON public.auktionen
  FOR SELECT TO authenticated
  USING (auftraggeber_id = auth.uid());

CREATE POLICY auktionen_select_transporteur_live ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
    AND status = 'live'
    AND endet_am >= now()
    AND rejected_at IS NULL
    AND awarded_transporteur_id IS NULL
  );

CREATE POLICY auktionen_select_transporteur_gebot ON public.auktionen
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.gebote g
      WHERE g.auktion_id = auktionen.id AND g.transporteur_id = auth.uid()
    )
  );

CREATE POLICY auktionen_insert_owner ON public.auktionen
  FOR INSERT TO authenticated
  WITH CHECK (auftraggeber_id = auth.uid());

CREATE POLICY auktionen_update_owner ON public.auktionen
  FOR UPDATE TO authenticated
  USING (auftraggeber_id = auth.uid()) WITH CHECK (auftraggeber_id = auth.uid());

CREATE POLICY gebote_select ON public.gebote
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.auktionen a WHERE a.id = auktion_id AND a.auftraggeber_id = auth.uid())
    OR transporteur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.auktionen a
      WHERE a.id = auktion_id
        AND EXISTS (SELECT 1 FROM public.transporteure t WHERE t.id = auth.uid())
        AND (
          (a.status = 'live' AND a.endet_am >= now() AND a.rejected_at IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.gebote g2
            WHERE g2.auktion_id = a.id AND g2.transporteur_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY gebote_insert_transporteur ON public.gebote
  FOR INSERT TO authenticated
  WITH CHECK (transporteur_id = auth.uid());

CREATE OR REPLACE FUNCTION public.trg_gebot_set_fuehrungsgebot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auktionen a
  SET aktuelles_gebot = LEAST(COALESCE(a.aktuelles_gebot, a.startpreis), NEW.betrag)
  WHERE a.id = NEW.auktion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gebot_fuehrung AFTER INSERT ON public.gebote
  FOR EACH ROW EXECUTE PROCEDURE public.trg_gebot_set_fuehrungsgebot();

ALTER PUBLICATION supabase_realtime ADD TABLE public.auktionen;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gebote;

-- Registrierung: Profilzeile aus auth.users.raw_user_meta_data (app_role)
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
  em := NEW.email;
  ar := NEW.raw_user_meta_data ->> 'app_role';

  IF ar = 'transporteur' THEN
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
    );
  ELSE
    INSERT INTO public.auftraggeber (
      id, vorname, name, email, strasse, plz, ort, telefon, benutzername
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'vorname', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
      em,
      COALESCE(NEW.raw_user_meta_data ->> 'strasse', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'plz', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'ort', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'telefon', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'benutzername', split_part(em, '@', 1))
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'versicherungsnachweise',
  'versicherungsnachweise',
  true,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY versicherung_insert_eigener_ordner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'versicherungsnachweise'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY versicherung_update_eigener_ordner ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'versicherungsnachweise' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY versicherung_delete_eigener_ordner ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'versicherungsnachweise' AND (storage.foldername(name))[1] = auth.uid()::text);
