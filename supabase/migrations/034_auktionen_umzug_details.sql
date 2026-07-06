-- Umzugsformular: strukturierte Felder als JSON (Dienstleistungstyp „Umzug“)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS umzug_details jsonb;

COMMENT ON COLUMN public.auktionen.umzug_details IS
  'JSON mit Umzugsformular-Feldern (Adressen, Details, Schachteln, Zusatzleistungen).';
