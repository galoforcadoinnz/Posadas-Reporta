-- Objetivo: crear la operación interna, idempotente y limitada que utilizará
-- la Edge Function de Fase 2 para recibir reportes públicos.
-- Precondiciones: Fase 1B completa; pgcrypto y pg_cron ya habilitados.
-- Postcondiciones: la RPC es la única operación privilegiada nueva concedida a
-- service_role; los límites geográficos permanecen pendientes hasta cargar una
-- fuente oficial revisada. Esta migración todavía no cierra el INSERT heredado.
-- Reversión: dejar de invocar la RPC y conservar los objetos aditivos. No se
-- eliminan reportes ni se restauran privilegios públicos.

BEGIN;

-- El preflight ocurre antes de crear o alterar objetos. La migración no instala
-- ni mueve extensiones silenciosamente.
DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION
      'Phase 2 aborted: extensions.digest(bytea,text) is unavailable';
  END IF;

  IF pg_catalog.to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR pg_catalog.to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION
      'Phase 2 aborted: pg_cron scheduling capability is unavailable';
  END IF;
END;
$preflight$ LANGUAGE plpgsql;

ALTER TABLE public.cities
  ADD COLUMN reporting_min_latitude double precision,
  ADD COLUMN reporting_max_latitude double precision,
  ADD COLUMN reporting_min_longitude double precision,
  ADD COLUMN reporting_max_longitude double precision,
  ADD CONSTRAINT cities_reporting_latitude_bounds_check
    CHECK (
      (reporting_min_latitude IS NULL AND reporting_max_latitude IS NULL)
      OR (
        reporting_min_latitude BETWEEN (-90)::double precision AND 90::double precision
        AND reporting_max_latitude BETWEEN (-90)::double precision AND 90::double precision
        AND reporting_min_latitude < reporting_max_latitude
      )
    ),
  ADD CONSTRAINT cities_reporting_longitude_bounds_check
    CHECK (
      (reporting_min_longitude IS NULL AND reporting_max_longitude IS NULL)
      OR (
        reporting_min_longitude BETWEEN (-180)::double precision AND 180::double precision
        AND reporting_max_longitude BETWEEN (-180)::double precision AND 180::double precision
        AND reporting_min_longitude < reporting_max_longitude
      )
    ),
  ADD CONSTRAINT cities_reporting_bounds_complete_check
    CHECK (
      (reporting_min_latitude IS NULL) = (reporting_max_latitude IS NULL)
      AND (reporting_min_latitude IS NULL) = (reporting_min_longitude IS NULL)
      AND (reporting_min_latitude IS NULL) = (reporting_max_longitude IS NULL)
    );

-- Los valores de Posadas quedan intencionalmente pendientes. La Mapoteca de la
-- Municipalidad es la fuente oficial candidata, pero requiere una conversión
-- geográfica revisada antes de configurar el rectángulo.

ALTER TABLE public.reports
  ADD COLUMN submission_id uuid,
  ADD COLUMN submission_fingerprint text,
  ADD CONSTRAINT reports_submission_id_key UNIQUE (submission_id),
  ADD CONSTRAINT reports_submission_fingerprint_format_check
    CHECK (
      submission_fingerprint IS NULL
      OR submission_fingerprint ~ '^[0-9a-f]{64}$'::text
    ),
  ADD CONSTRAINT reports_submission_pair_check
    CHECK (
      (submission_id IS NULL AND submission_fingerprint IS NULL)
      OR (submission_id IS NOT NULL AND submission_fingerprint IS NOT NULL)
    );

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL PRIVILEGES
ON SCHEMA private
FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.report_submission_rate_events (
  submission_id uuid NOT NULL,
  rate_limit_key text NOT NULL,
  created_at timestamp with time zone DEFAULT pg_catalog.statement_timestamp() NOT NULL,
  CONSTRAINT report_submission_rate_events_pkey PRIMARY KEY (submission_id),
  CONSTRAINT report_submission_rate_events_submission_id_fkey
    FOREIGN KEY (submission_id)
    REFERENCES public.reports(submission_id)
    ON DELETE CASCADE,
  CONSTRAINT report_submission_rate_events_rate_limit_key_check
    CHECK (rate_limit_key ~ '^[0-9a-f]{64}$'::text)
);

ALTER TABLE private.report_submission_rate_events OWNER TO postgres;
ALTER TABLE private.report_submission_rate_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX report_submission_rate_events_key_created_at_idx
ON private.report_submission_rate_events USING btree (rate_limit_key, created_at DESC);

REVOKE ALL PRIVILEGES
ON TABLE private.report_submission_rate_events
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.delete_expired_report_submission_rate_events()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM private.report_submission_rate_events
  WHERE private.report_submission_rate_events.created_at
    < pg_catalog.statement_timestamp() - INTERVAL '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

ALTER FUNCTION private.delete_expired_report_submission_rate_events()
OWNER TO postgres;

REVOKE ALL PRIVILEGES
ON FUNCTION private.delete_expired_report_submission_rate_events()
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.submit_report_v1(
  p_submission_id uuid,
  p_rate_limit_key text,
  p_city_slug text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_urgency text
)
RETURNS TABLE (
  tracking_code text,
  created_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  normalized_description text := pg_catalog.btrim(p_description);
  normalized_city_slug text := pg_catalog.lower(pg_catalog.btrim(p_city_slug));
  canonical_content text;
  content_fingerprint text;
  city_record public.cities%ROWTYPE;
  existing_report public.reports%ROWTYPE;
  count_15_minutes bigint;
  count_24_hours bigint;
  inserted_tracking_code text;
  inserted_created_at timestamp with time zone;
BEGIN
  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  IF p_rate_limit_key IS NULL
     OR p_rate_limit_key !~ '^[0-9a-f]{64}$'::text THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  IF normalized_city_slug IS NULL
     OR normalized_city_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text
     OR p_category_id IS NULL
     OR normalized_description IS NULL
     OR pg_catalog.char_length(normalized_description) < 10
     OR pg_catalog.char_length(normalized_description) > 1000
     OR p_latitude IS NULL
     OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN (-90)::double precision AND 90::double precision
     OR p_longitude NOT BETWEEN (-180)::double precision AND 180::double precision
     OR p_urgency IS NULL
     OR p_urgency <> ALL (ARRAY['low'::text, 'medium'::text, 'high'::text]) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  SELECT public.cities.*
  INTO city_record
  FROM public.cities
  WHERE public.cities.slug = normalized_city_slug
    AND public.cities.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  IF city_record.reporting_min_latitude IS NULL
     OR city_record.reporting_max_latitude IS NULL
     OR city_record.reporting_min_longitude IS NULL
     OR city_record.reporting_max_longitude IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'CITY_REPORTING_BOUNDS_UNAVAILABLE';
  END IF;

  IF p_latitude NOT BETWEEN city_record.reporting_min_latitude
                         AND city_record.reporting_max_latitude
     OR p_longitude NOT BETWEEN city_record.reporting_min_longitude
                            AND city_record.reporting_max_longitude THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'LOCATION_OUTSIDE_CITY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id = p_category_id
      AND public.categories.is_active = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  IF p_subcategory_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.subcategories
       WHERE public.subcategories.id = p_subcategory_id
         AND public.subcategories.category_id = p_category_id
         AND public.subcategories.is_active = true
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBMISSION';
  END IF;

  canonical_content := pg_catalog.jsonb_build_object(
    'categoryId', p_category_id,
    'citySlug', normalized_city_slug,
    'description', normalized_description,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'subcategoryId', p_subcategory_id,
    'urgency', p_urgency
  )::text;

  content_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(canonical_content, 'UTF8'),
      'sha256'::text
    ),
    'hex'::text
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_submission_id::text, 0)
  );

  SELECT public.reports.*
  INTO existing_report
  FROM public.reports
  WHERE public.reports.submission_id = p_submission_id;

  IF FOUND THEN
    IF existing_report.submission_fingerprint IS DISTINCT FROM content_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'IDEMPOTENCY_CONFLICT';
    END IF;

    RETURN QUERY
    SELECT
      existing_report.tracking_code,
      existing_report.created_at,
      'received'::text;
    RETURN;
  END IF;

  -- Serializa las solicitudes de un mismo identificador pseudónimo para que
  -- el conteo y el incremento de las dos ventanas móviles sean atómicos.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_rate_limit_key, 1)
  );

  SELECT
    pg_catalog.count(*) FILTER (
      WHERE private.report_submission_rate_events.created_at
        > pg_catalog.statement_timestamp() - INTERVAL '15 minutes'
    ),
    pg_catalog.count(*) FILTER (
      WHERE private.report_submission_rate_events.created_at
        > pg_catalog.statement_timestamp() - INTERVAL '24 hours'
    )
  INTO count_15_minutes, count_24_hours
  FROM private.report_submission_rate_events
  WHERE private.report_submission_rate_events.rate_limit_key = p_rate_limit_key
    AND private.report_submission_rate_events.created_at
      > pg_catalog.statement_timestamp() - INTERVAL '24 hours';

  IF count_15_minutes >= 5 OR count_24_hours >= 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_EXCEEDED';
  END IF;

  INSERT INTO public.reports (
    submission_id,
    submission_fingerprint,
    city_id,
    category_id,
    subcategory_id,
    description,
    latitude,
    longitude,
    address,
    urgency,
    status,
    moderation_status,
    workflow_status
  )
  VALUES (
    p_submission_id,
    content_fingerprint,
    city_record.id,
    p_category_id,
    p_subcategory_id,
    normalized_description,
    p_latitude,
    p_longitude,
    NULL,
    p_urgency,
    'pending'::text,
    'pending'::text,
    'received'::text
  )
  RETURNING public.reports.tracking_code, public.reports.created_at
  INTO inserted_tracking_code, inserted_created_at;

  INSERT INTO private.report_submission_rate_events (
    submission_id,
    rate_limit_key,
    created_at
  )
  VALUES (
    p_submission_id,
    p_rate_limit_key,
    inserted_created_at
  );

  RETURN QUERY
  SELECT inserted_tracking_code, inserted_created_at, 'received'::text;
EXCEPTION
  WHEN unique_violation THEN
    SELECT public.reports.*
    INTO existing_report
    FROM public.reports
    WHERE public.reports.submission_id = p_submission_id;

    IF FOUND
       AND existing_report.submission_fingerprint IS NOT DISTINCT FROM content_fingerprint THEN
      RETURN QUERY
      SELECT
        existing_report.tracking_code,
        existing_report.created_at,
        'received'::text;
      RETURN;
    END IF;

    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'IDEMPOTENCY_CONFLICT';
END;
$function$;

ALTER FUNCTION public.submit_report_v1(
  uuid, text, text, uuid, uuid, text, double precision, double precision, text
) OWNER TO postgres;

REVOKE ALL PRIVILEGES
ON FUNCTION public.submit_report_v1(
  uuid, text, text, uuid, uuid, text, double precision, double precision, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.submit_report_v1(
  uuid, text, text, uuid, uuid, text, double precision, double precision, text
)
TO service_role;

SELECT cron.schedule(
  'posadas-reporta-rate-limit-cleanup',
  '23 * * * *',
  $cron$SELECT private.delete_expired_report_submission_rate_events();$cron$
)
WHERE NOT EXISTS (
  SELECT 1
  FROM cron.job
  WHERE cron.job.jobname = 'posadas-reporta-rate-limit-cleanup'
);

DO $postcondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE cron.job.jobname = 'posadas-reporta-rate-limit-cleanup'
      AND cron.job.schedule = '23 * * * *'
      AND cron.job.command =
        'SELECT private.delete_expired_report_submission_rate_events();'
  ) THEN
    RAISE EXCEPTION 'Phase 2 aborted: rate-limit cleanup job validation failed';
  END IF;
END;
$postcondition$ LANGUAGE plpgsql;

COMMIT;
