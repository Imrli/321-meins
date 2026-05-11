-- 321 meins – Initialschema (Supabase / PostgreSQL)
-- Ausführen im SQL Editor deines Projekts oder per: supabase db push

-- ---------------------------------------------------------------------------
-- Profile (1:1 zu auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profile (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  rolle text NOT NULL CHECK (rolle IN ('kunde', 'transporteur')),
  benutzername text NOT NULL UNIQUE,
  zahlungsstatus boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profile IS
  'Erweitert auth.users. zahlungsstatus nur für transporteur; für Tests manuell in der DB setzen.';

-- ---------------------------------------------------------------------------
-- Aufträge
-- bestes_gebot_id wird nach Erstellung der Tabelle ``gebote`` verknüpft
-- ---------------------------------------------------------------------------
CREATE TABLE public.auftraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id uuid NOT NULL REFERENCES public.profile (id) ON DELETE CASCADE,
  beschreibung text,
  bilder text[] NOT NULL DEFAULT '{}',
  abholort text,
  zielort text,
  gewicht_kg numeric,
  laenge_cm numeric,
  breite_cm numeric,
  hoehe_cm numeric,
  countdown_ende timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'gebote_fertig', 'angenommen', 'abgelehnt')),
  bestes_gebot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auftraege_kunde ON public.auftraege (kunde_id);
CREATE INDEX idx_auftraege_status_countdown
  ON public.auftraege (status, countdown_ende)
  WHERE status = 'offen';

-- ---------------------------------------------------------------------------
-- Gebote
-- ---------------------------------------------------------------------------
CREATE TABLE public.gebote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.auftraege (id) ON DELETE CASCADE,
  transporteur_id uuid NOT NULL REFERENCES public.profile (id) ON DELETE CASCADE,
  preis_chf numeric NOT NULL CHECK (preis_chf > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gebote_auftrag ON public.gebote (auftrag_id);
CREATE INDEX idx_gebote_transporteur ON public.gebote (transporteur_id);

ALTER TABLE public.auftraege
  ADD CONSTRAINT auftraege_bestes_gebot_fk
  FOREIGN KEY (bestes_gebot_id) REFERENCES public.gebote (id) ON DELETE SET NULL;

-- optional: schnell niedrigsten Preis pro Auftrag
CREATE INDEX idx_gebote_min_preis ON public.gebote (auftrag_id, preis_chf);

-- ---------------------------------------------------------------------------
-- Beim Registrieren: Metadaten in signUp: { "rolle", "benutzername" } setzen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  b text;
BEGIN
  r := new.raw_user_meta_data ->> 'rolle';
  b := new.raw_user_meta_data ->> 'benutzername';

  IF r IS NULL OR r NOT IN ('kunde', 'transporteur') THEN
    r := 'kunde';
  END IF;

  IF b IS NULL OR length(trim(b)) = 0 THEN
    b := coalesce(new.email, split_part(new.id::text, '-', 1));
  END IF;

  -- Transporteur: zahlungsstatus = false, für Tests/Admin in SQL auf true
  INSERT INTO public.profile (id, rolle, benutzername, zahlungsstatus)
  VALUES (new.id, r, b, false);

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: „Countdown noch aktiv?“
-- (App und RLS: gleiche Regel)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auftrag_countdown_laeuft(
  p_status text,
  p_countdown timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_status = 'offen' AND p_countdown >= now();
$$;

-- Zahlungsstatus nur per Service-Role/Backend ändern (nicht per Client)
CREATE OR REPLACE FUNCTION public.profile_schuetze_zahlungsstatus()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt text;
BEGIN
  jwt := coalesce(
    (auth.jwt() ->> 'role'),
    nullif(current_setting('request.jwt.claim.role', true), '')
  );

  -- Normale angemeldete Nutzer*innen: kein Togglen von zahlungsstatus
  -- SQL Editor / service_role: erlaubt (Tests, Admin)
  IF tg_op = 'UPDATE'
     AND new.zahlungsstatus IS DISTINCT FROM old.zahlungsstatus
     AND jwt = 'authenticated' THEN
    RAISE EXCEPTION 'Zahlungsstatus darf nur serverseitig geändert werden (service_role, SQL-Editor).';
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_profile_zahlungsstatus
  BEFORE UPDATE ON public.profile
  FOR EACH ROW
  EXECUTE PROCEDURE public.profile_schuetze_zahlungsstatus();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auftraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gebote ENABLE ROW LEVEL SECURITY;

-- Profile: jede*r kann id/benutzername/rolle lesen (Börsen‑UI, Gebote);
--   schreibt nur die eigene Zeile (Zahlung siehe Trigger)
CREATE POLICY "profile_select_authenticated" ON public.profile
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profile_update_eigene" ON public.profile
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kunde: eigene Aufträge
CREATE POLICY "auftraege_select_kunde" ON public.auftraege
  FOR SELECT TO authenticated
  USING (kunde_id = auth.uid());

-- Transporteur: offene Aufträge, solange Countdown & Status offen
CREATE POLICY "auftraege_select_transporteur_boerse" ON public.auftraege
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profile p WHERE p.id = auth.uid() AND p.rolle = 'transporteur')
    AND status = 'offen'
    AND public.auftrag_countdown_laeuft(status, countdown_ende)
  );

-- Transporteur: Aufträge, auf die ein Gebot existiert
CREATE POLICY "auftraege_select_transporteur_gebot" ON public.auftraege
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profile p WHERE p.id = auth.uid() AND p.rolle = 'transporteur')
    AND EXISTS (
      SELECT 1 FROM public.gebote g
      WHERE g.auftrag_id = auftraege.id AND g.transporteur_id = auth.uid()
    )
  );

-- Insert nur als Kunde, eigener Datensatz
CREATE POLICY "auftraege_insert_kunde" ON public.auftraege
  FOR INSERT TO authenticated
  WITH CHECK (
    kunde_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profile p WHERE p.id = auth.uid() AND p.rolle = 'kunde')
  );

-- Update nur Kunde, eigener Auftrag
CREATE POLICY "auftraege_update_kunde" ON public.auftraege
  FOR UPDATE TO authenticated
  USING (kunde_id = auth.uid())
  WITH CHECK (kunde_id = auth.uid());

-- Gebote: sichtbar für Kunde (eigener Auftrag), an Transporteuren mit sichtbarem Auftrag,
--   an alle Transporteure bei aktiver Börse (gleiche Auftrags-ID)
CREATE POLICY "gebote_select" ON public.gebote
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.auftraege a WHERE a.id = auftrag_id AND a.kunde_id = auth.uid())
    OR transporteur_id = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public.profile p WHERE p.id = auth.uid() AND p.rolle = 'transporteur')
      AND EXISTS (
        SELECT 1 FROM public.auftraege a2
        WHERE a2.id = auftrag_id
          AND a2.status = 'offen'
          AND public.auftrag_countdown_laeuft(a2.status, a2.countdown_ende)
      )
    )
  );

-- Gebot: nur als Transporteur, nur wenn gezahlt, Countdown läuft, Auftrag offen
CREATE POLICY "gebote_insert" ON public.gebote
  FOR INSERT TO authenticated
  WITH CHECK (
    transporteur_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.id = auth.uid() AND p.rolle = 'transporteur' AND p.zahlungsstatus = true
    )
    AND EXISTS (
      SELECT 1 FROM public.auftraege a
      WHERE a.id = auftrag_id
        AND a.status = 'offen'
        AND public.auftrag_countdown_laeuft(a.status, a.countdown_ende)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (neue Aufträge / ggf. später Gebote)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.auftraege;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gebote;

-- ---------------------------------------------------------------------------
-- Storage: öffentliches Lesen der Bild-URLs, Upload nur in eigenem User-Ordner
-- (Produktiv: optional auf private Buckets + signierte URLs umstellen)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'auftragsbilder',
  'auftragsbilder',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auftragsbilder_insert_eigener_ordner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'auftragsbilder'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "auftragsbilder_update_eigener_ordner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'auftragsbilder' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auftragsbilder_delete_eigener_ordner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'auftragsbilder' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Öffentliches bucket.public = true: Lesen ist ohne Policy möglich bzw. für alle;
--   bei Bedarf zusätzlich SELECT-Policies für authentifiziert einrichten (Projekt-Default prüfen)
