-- Bewertungen nach Lieferbestätigung (QR-Scan → Status bezahlt): Speicherung pro Auktion,
-- Durchschnitt auf transporteure / auftraggeber, E-Mail-Einladung idempotent über rating_invite_sent_at.

ALTER TABLE public.auktionen
  ADD COLUMN IF NOT EXISTS bewertung_ag_sterne int
    CHECK (bewertung_ag_sterne IS NULL OR (bewertung_ag_sterne >= 1 AND bewertung_ag_sterne <= 5)),
  ADD COLUMN IF NOT EXISTS bewertung_ag_kommentar text,
  ADD COLUMN IF NOT EXISTS bewertung_tr_sterne int
    CHECK (bewertung_tr_sterne IS NULL OR (bewertung_tr_sterne >= 1 AND bewertung_tr_sterne <= 5)),
  ADD COLUMN IF NOT EXISTS bewertung_tr_kommentar text,
  ADD COLUMN IF NOT EXISTS rating_invite_sent_at timestamptz;

COMMENT ON COLUMN public.auktionen.bewertung_ag_sterne IS 'Sterne (1–5), die der Auftraggeber dem Transporteur gibt.';
COMMENT ON COLUMN public.auktionen.bewertung_tr_sterne IS 'Sterne (1–5), die der Transporteur dem Auftraggeber gibt.';
COMMENT ON COLUMN public.auktionen.rating_invite_sent_at IS 'E-Mail „Bewerte deine Erfahrung“ versendet (idempotent).';

ALTER TABLE public.transporteure
  ADD COLUMN IF NOT EXISTS bewertung_kommentar text;

COMMENT ON COLUMN public.transporteure.bewertung_kommentar IS 'Letzter erhaltener Kommentar aus Auftraggeber-Bewertungen (Anzeige im Profil).';

ALTER TABLE public.auftraggeber
  ADD COLUMN IF NOT EXISTS bewertung numeric(2, 1)
    CHECK (bewertung IS NULL OR (bewertung >= 0 AND bewertung <= 5)),
  ADD COLUMN IF NOT EXISTS bewertung_kommentar text;

COMMENT ON COLUMN public.auftraggeber.bewertung IS 'Durchschnittliche Sternbewertung durch Transporteure (0–5).';
COMMENT ON COLUMN public.auftraggeber.bewertung_kommentar IS 'Letzter erhaltener Kommentar (Anzeige im Profil).';

CREATE OR REPLACE FUNCTION public.recompute_transporteur_rating(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric(2, 1);
  v_k text;
BEGIN
  SELECT round(avg(a.bewertung_ag_sterne)::numeric, 1)
    INTO v_avg
  FROM public.auktionen a
  WHERE a.awarded_transporteur_id = p_id
    AND a.bewertung_ag_sterne IS NOT NULL;

  SELECT trim(coalesce(a2.bewertung_ag_kommentar, ''))
    INTO v_k
  FROM public.auktionen a2
  WHERE a2.awarded_transporteur_id = p_id
    AND a2.bewertung_ag_sterne IS NOT NULL
  ORDER BY a2.erstellt_am DESC NULLS LAST, a2.id DESC
  LIMIT 1;

  UPDATE public.transporteure t
  SET
    bewertung = v_avg,
    bewertung_kommentar = CASE
      WHEN v_k IS NULL OR v_k = '' THEN NULL
      ELSE left(v_k, 300)
    END
  WHERE t.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_auftraggeber_rating(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric(2, 1);
  v_k text;
BEGIN
  SELECT round(avg(a.bewertung_tr_sterne)::numeric, 1)
    INTO v_avg
  FROM public.auktionen a
  WHERE a.auftraggeber_id = p_id
    AND a.bewertung_tr_sterne IS NOT NULL;

  SELECT trim(coalesce(a2.bewertung_tr_kommentar, ''))
    INTO v_k
  FROM public.auktionen a2
  WHERE a2.auftraggeber_id = p_id
    AND a2.bewertung_tr_sterne IS NOT NULL
  ORDER BY a2.erstellt_am DESC NULLS LAST, a2.id DESC
  LIMIT 1;

  UPDATE public.auftraggeber ag
  SET
    bewertung = v_avg,
    bewertung_kommentar = CASE
      WHEN v_k IS NULL OR v_k = '' THEN NULL
      ELSE left(v_k, 300)
    END
  WHERE ag.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_transporteur_rating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_auftraggeber_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_transporteur_rating(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_auftraggeber_rating(uuid) TO service_role;

COMMENT ON FUNCTION public.recompute_transporteur_rating(uuid) IS
  'Aktualisiert transporteure.bewertung und bewertung_kommentar aus Auktionsbewertungen (Service Role / Edge).';
COMMENT ON FUNCTION public.recompute_auftraggeber_rating(uuid) IS
  'Aktualisiert auftraggeber.bewertung und bewertung_kommentar aus Auktionsbewertungen (Service Role / Edge).';
