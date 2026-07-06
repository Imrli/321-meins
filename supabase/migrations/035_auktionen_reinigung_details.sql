-- Reinigungsformular: strukturierte Felder als JSON (Dienstleistungstyp „Reinigung“)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS reinigung_details jsonb;

COMMENT ON COLUMN public.auktionen.reinigung_details IS
  'JSON mit Reinigungsformular-Feldern (Adresse, Art, Zusatzleistungen, Zugang).';
