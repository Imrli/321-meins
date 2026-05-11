-- Snapshot der Absender-Adresse zum Auktionszeitpunkt (Profil kopiert)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS abs_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_ort text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.auktionen.abs_vorname IS 'Absender Vorname (Snapshot bei Erstellung)';
COMMENT ON COLUMN public.auktionen.abs_name IS 'Absender Name';
COMMENT ON COLUMN public.auktionen.abs_strasse IS 'Absender Strasse und Hausnummer';
COMMENT ON COLUMN public.auktionen.abs_plz IS 'Absender PLZ';
COMMENT ON COLUMN public.auktionen.abs_ort IS 'Absender Ort';
