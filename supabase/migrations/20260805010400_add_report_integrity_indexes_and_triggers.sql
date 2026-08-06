-- Objetivo: validar integridad, crear índices y separar los triggers de
-- preparación inicial, tracking y updated_at.
-- Precondiciones: el backfill terminó; extensions.gen_random_bytes(integer)
-- está disponible; no hay tracking codes duplicados.
-- Postcondiciones: nuevos reportes reciben valores seguros, las relaciones y
-- estados están validados y updated_at se mantiene automáticamente.
-- Reversión: dejar de consumir los campos nuevos y conservar todos los objetos.
-- No se propone eliminar constraints, funciones, triggers ni índices.
-- Objetos afectados: public.reports, public.subcategories, public.cities y las
-- funciones auxiliares indicadas abajo.

BEGIN;

DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'Required cryptographic function is unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cities
    WHERE public.cities.id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
      AND public.cities.slug = 'posadas'::text
      AND public.cities.is_active = true
  ) THEN
    RAISE EXCEPTION 'Posadas city precondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reports
    WHERE public.reports.tracking_code IS NULL
       OR public.reports.city_id IS NULL
       OR public.reports.occurred_at IS NULL
       OR public.reports.moderation_status IS NULL
       OR public.reports.workflow_status IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill precondition failed';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

ALTER TABLE public.subcategories
  ADD CONSTRAINT subcategories_id_category_id_key
  UNIQUE (id, category_id);

ALTER TABLE public.reports
  ADD CONSTRAINT reports_city_id_fkey
    FOREIGN KEY (city_id)
    REFERENCES public.cities(id)
    NOT VALID,
  ADD CONSTRAINT reports_subcategory_category_fkey
    FOREIGN KEY (subcategory_id, category_id)
    REFERENCES public.subcategories(id, category_id)
    NOT VALID,
  ADD CONSTRAINT reports_latitude_range_check
    CHECK (latitude BETWEEN (-90)::double precision AND 90::double precision)
    NOT VALID,
  ADD CONSTRAINT reports_longitude_range_check
    CHECK (longitude BETWEEN (-180)::double precision AND 180::double precision)
    NOT VALID,
  ADD CONSTRAINT reports_tracking_code_format_check
    CHECK (tracking_code ~ '^PR-[0-9A-F]{20}$'::text)
    NOT VALID,
  ADD CONSTRAINT reports_moderation_status_check
    CHECK (
      moderation_status = ANY (
        ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'sensitive'::text]
      )
    )
    NOT VALID,
  ADD CONSTRAINT reports_workflow_status_check
    CHECK (
      workflow_status = ANY (
        ARRAY[
          'received'::text,
          'in_review'::text,
          'referred'::text,
          'in_progress'::text,
          'resolved'::text,
          'closed'::text
        ]
      )
    )
    NOT VALID,
  ADD CONSTRAINT reports_tracking_code_required_check
    CHECK (tracking_code IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT reports_city_id_required_check
    CHECK (city_id IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT reports_occurred_at_required_check
    CHECK (occurred_at IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT reports_moderation_status_required_check
    CHECK (moderation_status IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT reports_workflow_status_required_check
    CHECK (workflow_status IS NOT NULL)
    NOT VALID,
  ADD CONSTRAINT reports_tracking_code_key
    UNIQUE (tracking_code);

ALTER TABLE public.reports VALIDATE CONSTRAINT reports_city_id_fkey;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_subcategory_category_fkey;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_latitude_range_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_longitude_range_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_tracking_code_format_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_moderation_status_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_workflow_status_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_tracking_code_required_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_city_id_required_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_occurred_at_required_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_moderation_status_required_check;
ALTER TABLE public.reports VALIDATE CONSTRAINT reports_workflow_status_required_check;

CREATE INDEX reports_city_id_idx
ON public.reports USING btree (city_id);

CREATE INDEX reports_category_id_idx
ON public.reports USING btree (category_id);

CREATE INDEX reports_subcategory_id_idx
ON public.reports USING btree (subcategory_id);

CREATE INDEX reports_city_workflow_created_at_idx
ON public.reports USING btree (city_id, workflow_status, created_at DESC);

CREATE INDEX reports_city_moderation_created_at_idx
ON public.reports USING btree (city_id, moderation_status, created_at DESC);

CREATE FUNCTION public.prepare_report_initial_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF NEW.tracking_code IS NOT NULL THEN
      RAISE EXCEPTION 'Public clients cannot provide a tracking code';
    END IF;

    -- Compatibilidad temporal del MVP. Eliminar en Fase 2 cuando una RPC o
    -- Edge Function valide y asigne la ciudad explícitamente.
    NEW.city_id := 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid;
    NEW.status := 'pending'::text;
    NEW.moderation_status := 'pending'::text;
    NEW.workflow_status := 'received'::text;
  ELSE
    NEW.city_id := COALESCE(
      NEW.city_id,
      'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
    );
    NEW.status := COALESCE(NEW.status, 'pending'::text);
    NEW.moderation_status := COALESCE(
      NEW.moderation_status,
      'pending'::text
    );
    NEW.workflow_status := COALESCE(
      NEW.workflow_status,
      'received'::text
    );
  END IF;

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

CREATE FUNCTION public.generate_report_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  candidate text;
  attempt_number integer;
BEGIN
  IF NEW.tracking_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR attempt_number IN 1..8 LOOP
    candidate :=
      'PR-'::text
      || pg_catalog.upper(
        pg_catalog.encode(extensions.gen_random_bytes(10), 'hex'::text)
      );

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(candidate, 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.reports
      WHERE public.reports.tracking_code = candidate
    ) THEN
      NEW.tracking_code := candidate;
      RETURN NEW;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Unable to generate tracking code';
END;
$function$;

ALTER FUNCTION public.generate_report_tracking_code() OWNER TO postgres;

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.statement_timestamp();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

CREATE TRIGGER reports_10_prepare_initial_values
BEFORE INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.prepare_report_initial_values();

CREATE TRIGGER reports_20_generate_tracking_code
BEFORE INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.generate_report_tracking_code();

CREATE TRIGGER reports_90_set_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cities_90_set_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL PRIVILEGES
ON FUNCTION public.prepare_report_initial_values()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.generate_report_tracking_code()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;

COMMIT;
