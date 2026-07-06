-- Dienstleistungstyp, JSON-Details und Abgabegarantie (konsolidiert mit 034/035)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS umzug_details jsonb,
  ADD COLUMN IF NOT EXISTS reinigung_details jsonb,
  ADD COLUMN IF NOT EXISTS dienstleistung_typ text,
  ADD COLUMN IF NOT EXISTS abgabegarantie boolean NOT NULL DEFAULT false;

ALTER TABLE public.auktionen
  DROP CONSTRAINT IF EXISTS auktionen_dienstleistung_typ_check;

ALTER TABLE public.auktionen
  ADD CONSTRAINT auktionen_dienstleistung_typ_check
  CHECK (
    dienstleistung_typ IN ('umzug', 'reinigung', 'umzug_reinigung', 'transport')
  );

-- Bestehende Transport-Auktionen
UPDATE public.auktionen
SET dienstleistung_typ = 'transport'
WHERE dienstleistung_typ IS NULL;

-- Bereits erfasste Umzugs-/Reinigungs-Auktionen (falls JSON schon gesetzt)
UPDATE public.auktionen
SET dienstleistung_typ = 'umzug_reinigung'
WHERE dienstleistung_typ = 'transport'
  AND umzug_details IS NOT NULL
  AND reinigung_details IS NOT NULL;

UPDATE public.auktionen
SET dienstleistung_typ = 'umzug'
WHERE dienstleistung_typ = 'transport'
  AND umzug_details IS NOT NULL
  AND reinigung_details IS NULL;

UPDATE public.auktionen
SET dienstleistung_typ = 'reinigung'
WHERE dienstleistung_typ = 'transport'
  AND reinigung_details IS NOT NULL
  AND umzug_details IS NULL;

ALTER TABLE public.auktionen
  ALTER COLUMN dienstleistung_typ SET DEFAULT 'transport';

ALTER TABLE public.auktionen
  ALTER COLUMN dienstleistung_typ SET NOT NULL;

COMMENT ON COLUMN public.auktionen.dienstleistung_typ IS
  'umzug | reinigung | umzug_reinigung | transport';

COMMENT ON COLUMN public.auktionen.umzug_details IS
  'JSON: Felder aus dem Umzug-Formular (Adressen nur nach Zuschlag+Zahlung für die Gegenseite sichtbar – App/RLS).';

COMMENT ON COLUMN public.auktionen.reinigung_details IS
  'JSON: Felder aus dem Reinigungs-Formular.';

COMMENT ON COLUMN public.auktionen.abgabegarantie IS
  'Abgabegarantie bei Reinigung (Treuhänder/Eigentümer gibt QR frei).';
