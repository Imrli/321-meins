-- Spalte verifiziert: nur Admins (service_role / Dashboard) dürfen sie setzen oder ändern.

ALTER TABLE public.transporteure
  ADD COLUMN IF NOT EXISTS verifiziert boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.transporteure.verifiziert IS
  'Nur per Service Role oder SQL-Editor setzbar; Transporteure können dies nicht ändern.';

CREATE OR REPLACE FUNCTION public.transporteure_enforce_verifiziert_only_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := auth.jwt() ->> 'role';

  IF TG_OP = 'INSERT' THEN
    IF NEW.verifiziert IS DISTINCT FROM false THEN
      IF jwt_role IS NOT NULL AND jwt_role IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'verifiziert kann nur von einem Administrator gesetzt werden';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.verifiziert IS DISTINCT FROM OLD.verifiziert THEN
    IF jwt_role IS NOT NULL AND jwt_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'verifiziert kann nur von einem Administrator geändert werden';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transporteure_verifiziert_guard ON public.transporteure;

CREATE TRIGGER trg_transporteure_verifiziert_guard
  BEFORE INSERT OR UPDATE ON public.transporteure
  FOR EACH ROW
  EXECUTE PROCEDURE public.transporteure_enforce_verifiziert_only_admin();
