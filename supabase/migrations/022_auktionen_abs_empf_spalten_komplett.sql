-- Idempotent: Alle Snapshot-Spalten, die insertAuction (supabaseAuctions.ts) schreibt.
-- Behebt u.a. "Could not find the 'abs_email' column … in the schema cache", wenn
-- frühere Migrationen (008, 009, 014) auf der DB fehlten.
-- Hinweis: Im Code heissen Empfängerfelder empf_* (nicht emp_*).

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS empf_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empf_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_vorname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abs_telefon text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.auktionen.abs_email IS 'Absender E-Mail (Snapshot bei Erstellung)';
COMMENT ON COLUMN public.auktionen.abs_telefon IS 'Absender Telefon (Snapshot bei Erstellung)';
