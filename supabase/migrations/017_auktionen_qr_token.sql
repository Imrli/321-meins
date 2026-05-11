-- Einmaliger Token für QR-Code bei Auftragserteilung (Empfänger-Übergabe)

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS qr_token uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auktionen_qr_token_unique
  ON public.auktionen (qr_token)
  WHERE qr_token IS NOT NULL;

COMMENT ON COLUMN public.auktionen.qr_token IS 'Zufälliger Token für QR-Code / Übergabeprüfung';
