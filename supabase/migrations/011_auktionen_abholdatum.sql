-- Gewünschtes Abholdatum (Pflicht bei neuen Auktionen in der App)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS abholdatum date;

COMMENT ON COLUMN public.auktionen.abholdatum IS 'Gewünschtes Abholdatum (Auftraggeber)';
