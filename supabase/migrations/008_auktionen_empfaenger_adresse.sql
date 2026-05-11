-- Empfänger-Adresse pro Auktion (Absender = Profil auftraggeber, nicht hier gespeichert)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS empf_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_ort text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.auktionen.empf_vorname IS 'Empfänger Vorname (Abholung/Zustellung Kontakt)';
COMMENT ON COLUMN public.auktionen.empf_name IS 'Empfänger Name';
COMMENT ON COLUMN public.auktionen.empf_strasse IS 'Empfänger Strasse und Hausnummer';
COMMENT ON COLUMN public.auktionen.empf_plz IS 'Empfänger PLZ';
COMMENT ON COLUMN public.auktionen.empf_ort IS 'Empfänger Ort';
