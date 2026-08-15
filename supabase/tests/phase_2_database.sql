-- Fase 2: validación transaccional. Ejecutar únicamente en local o staging
-- autorizado después de Fase 1B y las dos migraciones de Fase 2.

BEGIN;

DO $test$
DECLARE
  function_signature text :=
    'public.submit_report_v1(uuid,text,text,uuid,uuid,text,double precision,double precision,text)';
  function_record record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE pg_catalog.pg_policies.schemaname = 'public'
      AND pg_catalog.pg_policies.tablename = 'reports'
      AND pg_catalog.pg_policies.policyname = 'Public can create pending reports'
  ) THEN
    RAISE EXCEPTION 'The inherited public INSERT policy still exists';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.reports', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.reports', 'INSERT')
     OR pg_catalog.has_table_privilege('service_role', 'public.reports', 'INSERT')
     OR pg_catalog.has_table_privilege('service_role', 'public.reports', 'SELECT')
     OR pg_catalog.has_table_privilege(
       'service_role',
       'posadas_reporta_private.report_submission_rate_events',
       'SELECT'
     ) THEN
    RAISE EXCEPTION 'Unexpected direct table privilege detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      ARRAY[
        'category_id', 'subcategory_id', 'description', 'latitude',
        'longitude', 'address', 'urgency', 'status'
      ]::text[]
    ) AS public_column(column_name)
    CROSS JOIN pg_catalog.unnest(
      ARRAY['anon', 'authenticated']::text[]
    ) AS public_role(role_name)
    WHERE pg_catalog.has_column_privilege(
      public_role.role_name,
      'public.reports',
      public_column.column_name,
      'INSERT'
    )
  ) THEN
    RAISE EXCEPTION 'A public report column still allows direct INSERT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc
    JOIN pg_catalog.pg_namespace
      ON pg_catalog.pg_namespace.oid = pg_catalog.pg_proc.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        pg_catalog.pg_proc.proacl,
        pg_catalog.acldefault('f'::"char", pg_catalog.pg_proc.proowner)
      )
    ) AS function_acl
    WHERE pg_catalog.pg_namespace.nspname = 'public'
      AND pg_catalog.pg_proc.proname = 'submit_report_v1'
      AND function_acl.grantee = 0::oid
      AND function_acl.privilege_type = 'EXECUTE'
  )
     OR pg_catalog.has_function_privilege('anon', function_signature, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', function_signature, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', function_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'submit_report_v1 EXECUTE privileges are invalid';
  END IF;

  SELECT
    pg_catalog.pg_get_userbyid(pg_catalog.pg_proc.proowner) AS owner_name,
    pg_catalog.pg_proc.prosecdef AS security_definer,
    pg_catalog.pg_proc.proconfig AS configuration
  INTO function_record
  FROM pg_catalog.pg_proc
  JOIN pg_catalog.pg_namespace
    ON pg_catalog.pg_namespace.oid = pg_catalog.pg_proc.pronamespace
  WHERE pg_catalog.pg_namespace.nspname = 'public'
    AND pg_catalog.pg_proc.proname = 'submit_report_v1'
  LIMIT 1;

  IF function_record.owner_name IS DISTINCT FROM 'postgres'
     OR function_record.security_definer IS DISTINCT FROM true
     OR NOT COALESCE(
       function_record.configuration @> ARRAY['search_path=""'::text],
       false
     ) THEN
    RAISE EXCEPTION 'submit_report_v1 security metadata is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE cron.job.jobname = 'posadas-reporta-rate-limit-cleanup'
      AND cron.job.command =
        'SELECT posadas_reporta_private.delete_expired_report_submission_rate_events();'
  ) THEN
    RAISE EXCEPTION 'The rate-limit cleanup job is unavailable';
  END IF;

  IF has_schema_privilege('anon', 'cron', 'USAGE')
     OR has_schema_privilege('authenticated', 'cron', 'USAGE')
     OR has_schema_privilege('service_role', 'cron', 'USAGE') THEN
    RAISE EXCEPTION 'A public role can use the cron schema';
  END IF;

  IF NOT has_schema_privilege('postgres', 'cron', 'USAGE')
     OR NOT has_table_privilege('postgres', 'cron.job', 'SELECT') THEN
    RAISE EXCEPTION 'postgres cannot manage pg_cron';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE pg_catalog.pg_indexes.schemaname = 'posadas_reporta_private'
      AND pg_catalog.pg_indexes.tablename = 'report_submission_rate_events'
      AND pg_catalog.pg_indexes.indexname = 'report_submission_rate_events_created_at_idx'
  ) THEN
    RAISE EXCEPTION 'The rate-limit cleanup index is unavailable';
  END IF;

  IF pg_catalog.has_function_privilege(
       'service_role', 'public.prepare_report_initial_values()', 'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'service_role', 'public.generate_report_tracking_code()', 'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'service_role', 'public.set_updated_at()', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'service_role can execute an auxiliary trigger function';
  END IF;
END;
$test$ LANGUAGE plpgsql;

-- Configuración sintética y reversible para las pruebas. No representa los
-- límites reales de Posadas y la transacción completa termina con ROLLBACK.
UPDATE public.cities
SET reporting_min_latitude = -90,
    reporting_max_latitude = 90,
    reporting_min_longitude = -180,
    reporting_max_longitude = 180
WHERE public.cities.slug = 'posadas';

DO $test$
DECLARE
  category_id uuid;
  request_id uuid := '20000000-0000-4000-8000-000000000001'::uuid;
  rate_key text := pg_catalog.repeat('a', 64);
  first_result record;
  retry_result record;
  event_count bigint;
  report_count bigint;
BEGIN
  SELECT public.categories.id
  INTO category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  SELECT *
  INTO first_result
  FROM public.submit_report_v1(
    request_id,
    rate_key,
    'posadas',
    category_id,
    NULL,
    'Reporte idempotente de Fase 2',
    -27.36,
    -55.90,
    'medium'
  );

  SELECT *
  INTO retry_result
  FROM public.submit_report_v1(
    request_id,
    rate_key,
    'posadas',
    category_id,
    NULL,
    'Reporte idempotente de Fase 2',
    -27.36,
    -55.90,
    'medium'
  );

  IF first_result.tracking_code IS DISTINCT FROM retry_result.tracking_code
     OR first_result.created_at IS DISTINCT FROM retry_result.created_at
     OR retry_result.status IS DISTINCT FROM 'received' THEN
    RAISE EXCEPTION 'An idempotent retry changed the public receipt';
  END IF;

  SELECT pg_catalog.count(*)
  INTO report_count
  FROM public.reports
  WHERE public.reports.submission_id = request_id;

  SELECT pg_catalog.count(*)
  INTO event_count
  FROM posadas_reporta_private.report_submission_rate_events
  WHERE posadas_reporta_private.report_submission_rate_events.submission_id = request_id;

  IF report_count <> 1 OR event_count <> 1 THEN
    RAISE EXCEPTION 'An idempotent retry inserted or charged more than once';
  END IF;

  UPDATE public.categories
  SET is_active = false
  WHERE public.categories.id = category_id;

  SELECT *
  INTO retry_result
  FROM public.submit_report_v1(
    request_id,
    rate_key,
    'posadas',
    category_id,
    NULL,
    'Reporte idempotente de Fase 2',
    -27.36,
    -55.90,
    'medium'
  );

  IF first_result.tracking_code IS DISTINCT FROM retry_result.tracking_code
     OR first_result.created_at IS DISTINCT FROM retry_result.created_at THEN
    RAISE EXCEPTION 'Mutable catalog state broke an idempotent retry';
  END IF;

  UPDATE public.categories
  SET is_active = true
  WHERE public.categories.id = category_id;

  BEGIN
    PERFORM *
    FROM public.submit_report_v1(
      request_id,
      rate_key,
      'posadas',
      category_id,
      NULL,
      'Contenido diferente para el mismo request',
      -27.36,
      -55.90,
      'medium'
    );
    RAISE EXCEPTION 'A reused requestId with different content was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM <> 'IDEMPOTENCY_CONFLICT' THEN
        RAISE;
      END IF;
  END;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  category_id uuid;
  rate_key text := pg_catalog.repeat('1', 64);
  generated_request_id uuid;
  index_number integer;
BEGIN
  SELECT public.categories.id
  INTO category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  FOR index_number IN 1..5 LOOP
    generated_request_id := pg_catalog.gen_random_uuid();

    INSERT INTO public.reports (
      submission_id, submission_fingerprint, city_id, category_id, description,
      latitude, longitude, urgency, status, moderation_status, workflow_status
    )
    SELECT
      generated_request_id,
      pg_catalog.repeat('1', 64),
      public.cities.id,
      category_id,
      'Evento sintético de límite de quince minutos',
      -27.36,
      -55.90,
      'medium',
      'pending',
      'pending',
      'received'
    FROM public.cities
    WHERE public.cities.slug = 'posadas';

    INSERT INTO posadas_reporta_private.report_submission_rate_events (
      submission_id, rate_limit_key, created_at
    )
    VALUES (
      generated_request_id,
      rate_key,
      pg_catalog.statement_timestamp() - INTERVAL '14 minutes'
    );
  END LOOP;

  BEGIN
    PERFORM *
    FROM public.submit_report_v1(
      '20000000-0000-4000-8000-000000000098'::uuid,
      rate_key,
      'posadas',
      category_id,
      NULL,
      'Debe respetar el límite de quince minutos',
      -27.36,
      -55.90,
      'medium'
    );
    RAISE EXCEPTION 'The rolling 15-minute limit was not enforced';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'RATE_LIMIT_EXCEEDED' THEN
        RAISE;
      END IF;
  END;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  category_id uuid;
  rate_key text := pg_catalog.repeat('b', 64);
  generated_request_id uuid;
  within_24_hours_timestamp timestamp with time zone :=
    pg_catalog.statement_timestamp() - INTERVAL '23 hours';
  index_number integer;
BEGIN
  SELECT public.categories.id
  INTO category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  FOR index_number IN 1..20 LOOP
    generated_request_id := pg_catalog.gen_random_uuid();

    INSERT INTO public.reports (
      submission_id,
      submission_fingerprint,
      city_id,
      category_id,
      description,
      latitude,
      longitude,
      urgency,
      status,
      moderation_status,
      workflow_status,
      created_at
    )
    SELECT
      generated_request_id,
      pg_catalog.repeat('c', 64),
      public.cities.id,
      category_id,
      'Evento sintético de límite móvil',
      -27.36,
      -55.90,
      'medium',
      'pending',
      'pending',
      'received',
      within_24_hours_timestamp
    FROM public.cities
    WHERE public.cities.slug = 'posadas';

    INSERT INTO posadas_reporta_private.report_submission_rate_events (
      submission_id,
      rate_limit_key,
      created_at
    )
    VALUES (generated_request_id, rate_key, within_24_hours_timestamp);
  END LOOP;

  BEGIN
    PERFORM *
    FROM public.submit_report_v1(
      '20000000-0000-4000-8000-000000000099'::uuid,
      rate_key,
      'posadas',
      category_id,
      NULL,
      'Debe respetar veinticuatro horas móviles',
      -27.36,
      -55.90,
      'medium'
    );
    RAISE EXCEPTION 'The rolling 24-hour limit was not enforced';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'RATE_LIMIT_EXCEEDED' THEN
        RAISE;
      END IF;
  END;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  category_id uuid;
  old_submission_id uuid := '20000000-0000-4000-8000-000000000101'::uuid;
  fresh_submission_id uuid := '20000000-0000-4000-8000-000000000102'::uuid;
  deleted_count bigint;
BEGIN
  SELECT public.categories.id
  INTO category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  INSERT INTO public.reports (
    submission_id, submission_fingerprint, city_id, category_id, description,
    latitude, longitude, urgency, status, moderation_status, workflow_status
  )
  SELECT
    source.submission_id,
    pg_catalog.repeat('d', 64),
    public.cities.id,
    category_id,
    'Prueba sintética de limpieza programada',
    -27.36,
    -55.90,
    'medium',
    'pending',
    'pending',
    'received'
  FROM public.cities
  CROSS JOIN (
    VALUES (old_submission_id), (fresh_submission_id)
  ) AS source(submission_id)
  WHERE public.cities.slug = 'posadas';

  INSERT INTO posadas_reporta_private.report_submission_rate_events (
    submission_id, rate_limit_key, created_at
  )
  VALUES
    (old_submission_id, pg_catalog.repeat('e', 64),
      pg_catalog.statement_timestamp() - INTERVAL '49 hours'),
    (fresh_submission_id, pg_catalog.repeat('f', 64),
      pg_catalog.statement_timestamp() - INTERVAL '47 hours');

  SELECT posadas_reporta_private.delete_expired_report_submission_rate_events()
  INTO deleted_count;

  IF deleted_count < 1
     OR EXISTS (
       SELECT 1 FROM posadas_reporta_private.report_submission_rate_events
       WHERE submission_id = old_submission_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM posadas_reporta_private.report_submission_rate_events
       WHERE submission_id = fresh_submission_id
     ) THEN
    RAISE EXCEPTION 'Expired rate-limit identifier cleanup failed';
  END IF;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  selected_category_id uuid;
BEGIN
  SELECT public.categories.id
  INTO selected_category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  LIMIT 1;

  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency, status
    ) VALUES (
      selected_category_id,
      'Inserción pública que debe ser rechazada',
      -27.36,
      -55.90,
      'medium',
      'pending'
    );
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'Direct public INSERT was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
END;
$test$ LANGUAGE plpgsql;

-- La concurrencia real requiere dos sesiones PostgreSQL simultáneas y debe
-- ejecutarse desde el runner local/CI de integración. Esta suite transaccional
-- verifica aquí el advisory lock y la constraint UNIQUE de forma estructural.

ROLLBACK;
