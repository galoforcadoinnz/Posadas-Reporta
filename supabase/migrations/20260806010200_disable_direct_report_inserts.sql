-- Objetivo: completar el corte de Fase 2 y hacer que todos los reportes
-- públicos ingresen exclusivamente por la Edge Function y submit_report_v1.
-- Precondiciones: la migración 20260806010100 fue aplicada y la Edge Function
-- fue validada en el entorno objetivo.
-- Postcondiciones: anon y authenticated no pueden insertar directamente y la
-- política pública heredada deja de existir. No se habilita lectura pública.
-- Reversión: mantener el envío bloqueado y corregir hacia adelante. Recrear la
-- política o los grants heredados requiere una aprobación de seguridad aparte.

BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.submit_report_v1(uuid,text,text,uuid,uuid,text,double precision,double precision,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Phase 2 cutover aborted: submit_report_v1 is unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE pg_catalog.pg_policies.schemaname = 'public'
      AND pg_catalog.pg_policies.tablename = 'reports'
      AND pg_catalog.pg_policies.policyname = 'Public can create pending reports'
  ) THEN
    RAISE EXCEPTION 'Phase 2 cutover aborted: inherited public insert policy is unavailable';
  END IF;
END;
$preflight$ LANGUAGE plpgsql;

REVOKE INSERT
ON TABLE public.reports
FROM anon, authenticated;

REVOKE INSERT (
  category_id,
  subcategory_id,
  description,
  latitude,
  longitude,
  address,
  urgency,
  status
)
ON TABLE public.reports
FROM anon, authenticated;

DROP POLICY "Public can create pending reports"
ON public.reports;

CREATE OR REPLACE FUNCTION public.prepare_report_initial_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Direct public report inserts are disabled';
  END IF;

  IF NEW.city_id IS NULL THEN
    RAISE EXCEPTION 'A city is required for every new report';
  END IF;

  NEW.status := COALESCE(NEW.status, 'pending'::text);
  NEW.moderation_status := COALESCE(
    NEW.moderation_status,
    'pending'::text
  );
  NEW.workflow_status := COALESCE(
    NEW.workflow_status,
    'received'::text
  );
  NEW.occurred_at := COALESCE(
    NEW.occurred_at,
    NEW.created_at,
    pg_catalog.statement_timestamp()
  );
  NEW.address_text := COALESCE(NEW.address_text, NEW.address);

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.prepare_report_initial_values() OWNER TO postgres;

REVOKE ALL PRIVILEGES
ON FUNCTION public.prepare_report_initial_values()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
