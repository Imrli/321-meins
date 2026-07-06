-- QR-Scan / Zahlungsfreigabe: Zeitstempel für 3-Tage-Sichtbarkeit im Dashboard

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS freigegeben_am timestamptz;

COMMENT ON COLUMN public.auktionen.freigegeben_am IS
  'Zeitpunkt der Lieferbestätigung (QR-Scan) und Zahlungsfreigabe (status=bezahlt). '
  'Dashboard zeigt abgeschlossene Auktionen nur 3 Tage danach.';

-- Bestehende abgeschlossene Auktionen (Fallback-Zeitpunkt)
UPDATE public.auktionen
SET freigegeben_am = COALESCE(freigegeben_am, awarded_at, erstellt_am)
WHERE status IN ('bezahlt', 'geliefert', 'abgeschlossen')
  AND freigegeben_am IS NULL;

CREATE INDEX IF NOT EXISTS idx_auktionen_freigegeben_am
  ON public.auktionen (freigegeben_am)
  WHERE freigegeben_am IS NOT NULL;

-- Lieferbestätigung per QR (Prod + Testmodus)
CREATE OR REPLACE FUNCTION public.confirm_auktion_delivery(
  p_anzeige_id text,
  p_qr_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF NOT public.is_transporteur(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_anzeige_id IS NULL OR trim(p_anzeige_id) = '' OR p_qr_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  UPDATE public.auktionen a
  SET
    status = 'bezahlt',
    qr_token = NULL,
    freigegeben_am = now()
  WHERE a.anzeige_id = trim(p_anzeige_id)
    AND a.awarded_transporteur_id = auth.uid()
    AND a.qr_token = p_qr_token
    AND a.status IN ('awarded', 'bezahlt_simuliert');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  RETURN jsonb_build_object('ok', true, 'simulated', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_auktion_delivery_test_simulate(p_anzeige_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF NOT public.is_transporteur(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_anzeige_id IS NULL OR trim(p_anzeige_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  UPDATE public.auktionen a
  SET
    status = 'bezahlt',
    qr_token = NULL,
    freigegeben_am = now()
  WHERE a.anzeige_id = trim(p_anzeige_id)
    AND a.awarded_transporteur_id = auth.uid()
    AND a.status IN ('awarded', 'bezahlt_simuliert')
    AND a.qr_token IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  RETURN jsonb_build_object('ok', true, 'simulated', true);
END;
$$;
