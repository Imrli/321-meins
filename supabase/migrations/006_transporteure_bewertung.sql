-- Durchschnittsbewertung Transporteur (0–5, eine Nachkommastelle); für Gebotslisten.

ALTER TABLE public.transporteure
  ADD COLUMN IF NOT EXISTS bewertung numeric(2,1)
    CHECK (bewertung IS NULL OR (bewertung >= 0 AND bewertung <= 5));

COMMENT ON COLUMN public.transporteure.bewertung IS
  'Öffentlicher Durchschnittswert (Gebotslisten); NULL wenn noch keine Bewertung.';
