-- Ergänzung zum Init-Schema: Holländische Auktion, Minuten, Wiederholung
-- (Lokal aktuell Mock; bei Supabase nach Einrichtung anwenden)

ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS transport_art text,
  ADD COLUMN IF NOT EXISTS notizen text,
  ADD COLUMN IF NOT EXISTS countdown_minuten int CHECK (countdown_minuten IN (1, 2, 3, 5, 10)),
  ADD COLUMN IF NOT EXISTS anfrage_key text,
  ADD COLUMN IF NOT EXISTS wiederholbar_ab timestamptz;
-- bestes_gebot_id (001) = Sieger-Gebot

-- Status-Werte (bestehende Tabelle ggf. anpassen/ersetzen):
--   offen | vermittelt | leer_abgelaufen
-- ALTER + Datenmigration in einem separaten Schritt, wenn 001 schon in Produktion war.

COMMENT ON COLUMN public.auftraege.wiederholbar_ab IS
  'Nach leerer Auktion: früheste Zeit für „Wiederholen“ derselben Anfrage (1h)';

COMMENT ON COLUMN public.auftraege.anfrage_key IS
  'Eindeutige Sperrkennung pro Kunde und Route/Art (cooldown)';
