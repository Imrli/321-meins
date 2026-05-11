-- Lieferbestätigung: Endstatus „bezahlt“ (Zahlung/Capture über Edge Function confirm-delivery-payment)

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
    qr_token = NULL
  WHERE a.anzeige_id = trim(p_anzeige_id)
    AND a.awarded_transporteur_id = auth.uid()
    AND a.qr_token = p_qr_token
    AND a.status = 'awarded';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.confirm_auktion_delivery(text, uuid) IS
  'Transporteur bestätigt Lieferung per QR-Token; setzt status=bezahlt und invalidiert Token. '
  'Live-Zahlung: Edge Function confirm-delivery-payment verwenden (Stripe Capture + Transfer).';
