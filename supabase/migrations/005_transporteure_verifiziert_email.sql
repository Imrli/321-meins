-- E-Mail bei Änderung von transporteure.verifiziert (via Edge Function + Infomaniak SMTP).
-- Einmalig konfigurieren (SQL Editor, Rolle postgres), nachdem die Function deployed ist:
--   UPDATE public.webhook_runtime_config SET
--     transporteur_verifiziert_url = 'https://<PROJEKTREF>.supabase.co/functions/v1/transporteur-verifiziert-email',
--     transporteur_verifiziert_secret = '<gleicher Wert wie Secret TRANSPORTEUR_VERIFIZIERT_WEBHOOK_SECRET>';
-- Edge Secrets: TRANSPORTEUR_VERIFIZIERT_WEBHOOK_SECRET, INFOMANIAK_SMTP_PASS (App-Passwort).
-- Optional für Dry-Run ohne Versand: VITE_MOCK=true (lokal / Staging).

CREATE TABLE IF NOT EXISTS public.webhook_runtime_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  transporteur_verifiziert_url text,
  transporteur_verifiziert_secret text
);

INSERT INTO public.webhook_runtime_config (
  id,
  transporteur_verifiziert_url,
  transporteur_verifiziert_secret
)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.webhook_runtime_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.webhook_runtime_config FROM PUBLIC;
REVOKE ALL ON public.webhook_runtime_config FROM anon;
REVOKE ALL ON public.webhook_runtime_config FROM authenticated;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_transporteur_verifiziert_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conf public.webhook_runtime_config%ROWTYPE;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO conf
  FROM public.webhook_runtime_config
  WHERE id = 1;

  IF conf.transporteur_verifiziert_url IS NULL
     OR conf.transporteur_verifiziert_secret IS NULL
     OR length(trim(conf.transporteur_verifiziert_url)) = 0
     OR length(trim(conf.transporteur_verifiziert_secret)) = 0 THEN
    RAISE NOTICE
      'notify_transporteur_verifiziert: webhook_runtime_config URL/secret fehlt — kein HTTP-Aufruf';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := trim(conf.transporteur_verifiziert_url),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || trim(conf.transporteur_verifiziert_secret)
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'verifiziert', NEW.verifiziert
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transporteure_verifiziert_email ON public.transporteure;

CREATE TRIGGER trg_transporteure_verifiziert_email
  AFTER UPDATE OF verifiziert ON public.transporteure
  FOR EACH ROW
  WHEN (OLD.verifiziert IS DISTINCT FROM NEW.verifiziert)
  EXECUTE PROCEDURE public.notify_transporteur_verifiziert_change();
