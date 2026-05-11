-- 1. Spalte hinzufügen (sicher, falls sie nicht existiert)
ALTER TABLE public.transporteure
ADD COLUMN IF NOT EXISTS verifiziert boolean NOT NULL DEFAULT false;

-- 2. Deinen Test-Transporteur auf verifiziert setzen
UPDATE public.transporteure
SET verifiziert = true
WHERE firmenname = 'bibi';