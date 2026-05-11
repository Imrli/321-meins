-- Erweiterte Statuswerte (text, ohne CHECK): u. a. pending_payment, bezahlt_simuliert.
-- pending_payment: Zuschlag erteilt, Auftraggeber muss noch zahlen (kein qr_token).
-- bezahlt_simuliert: Zahlung nur simuliert (ohne Stripe), QR aktiv bis Lieferbestätigung → bezahlt.

COMMENT ON COLUMN public.auktionen.status IS
  'live | rejected | pending_payment | awarded | bezahlt_simuliert | bezahlt | …';
