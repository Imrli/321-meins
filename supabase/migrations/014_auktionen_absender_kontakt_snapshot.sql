-- Absender Kontakt (Snapshot bei Erstellung), sichtbar für Zuschlag-Transporteur über auktionen-Zeile

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS abs_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_telefon text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.auktionen.abs_email IS 'Absender E-Mail (Snapshot bei Erstellung)';
COMMENT ON COLUMN public.auktionen.abs_telefon IS 'Absender Telefon (Snapshot bei Erstellung)';

UPDATE public.auktionen a
SET
  abs_email = CASE
    WHEN NULLIF(trim(a.abs_email), '') IS NULL THEN COALESCE(trim(ag.email), '')
    ELSE a.abs_email
  END,
  abs_telefon = CASE
    WHEN NULLIF(trim(a.abs_telefon), '') IS NULL THEN COALESCE(trim(ag.telefon), '')
    ELSE a.abs_telefon
  END
FROM public.auftraggeber ag
WHERE a.auftraggeber_id = ag.id;
