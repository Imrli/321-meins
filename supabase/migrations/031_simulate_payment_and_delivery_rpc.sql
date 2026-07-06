-- Zahlungs- und Liefer-RPCs (Fallback wenn Edge Functions nicht deployed sind).
-- Testmodus: simulate_auktion_zahlung → status bezahlt_simuliert + qr_token.

CREATE OR REPLACE FUNCTION public.simulate_auktion_zahlung(p_anzeige_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.auktionen%ROWTYPE;
  v_qr uuid := gen_random_uuid();
  v_pi text := 'pi_sim_' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_row
  FROM public.auktionen
  WHERE anzeige_id = trim(p_anzeige_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.auftraggeber_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_row.status IN ('bezahlt_simuliert', 'awarded', 'bezahlt', 'geliefert') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'anzeige_id', v_row.anzeige_id,
      'already_paid', true
    );
  END IF;

  IF v_row.status <> 'pending_payment' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_state',
      'status', v_row.status
    );
  END IF;

  UPDATE public.auktionen
  SET
    status = 'bezahlt_simuliert',
    qr_token = v_qr,
    payment_intent_id = v_pi
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'anzeige_id', v_row.anzeige_id,
    'simulated', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_auktion_zahlung(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulate_auktion_zahlung(text) TO authenticated;

COMMENT ON FUNCTION public.simulate_auktion_zahlung(text) IS
  'Testmodus: Auftraggeber simuliert Zahlung → bezahlt_simuliert + QR-Token.';

-- Lieferbestätigung: auch nach bezahlt_simuliert (Testmodus) und nach awarded (Stripe-Hold).
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
    AND a.status IN ('awarded', 'bezahlt_simuliert');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  RETURN jsonb_build_object('ok', true, 'simulated', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_auktion_delivery(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_auktion_delivery(text, uuid)
  TO authenticated;

-- Testmodus: Lieferung ohne QR-Scan (nur wenn bezahlt_simuliert/awarded + Token gesetzt).
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
    qr_token = NULL
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

REVOKE ALL ON FUNCTION public.confirm_auktion_delivery_test_simulate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_auktion_delivery_test_simulate(text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
