-- Stripe: PaymentIntent bei Auftragserteilung, Connect-Konto des Transporteurs

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS payment_intent_id text;

ALTER TABLE public.transporteure
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

COMMENT ON COLUMN public.auktionen.payment_intent_id IS
  'Stripe PaymentIntent (z. B. capture_method manual), gesetzt bei Zahlungsautorisierung.';
COMMENT ON COLUMN public.transporteure.stripe_connect_account_id IS
  'Stripe Connect Account ID (acct_…) für Auszahlung an den Transporteur.';
