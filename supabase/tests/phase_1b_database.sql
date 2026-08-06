-- POSADAS REPORTA — PRUEBAS LOCALES DE FASE 1B
-- EJECUTAR ÚNICAMENTE EN UNA BASE LOCAL O STAGING DESCARTABLE.
-- NO EJECUTAR EN PRODUCCIÓN NI EN xouoxuoueutukemaqjro.
--
-- El archivo se ejecuta dentro de una transacción y termina con ROLLBACK.
-- Las sentencias UPDATE, DELETE y TRUNCATE incluidas como texto dinámico son
-- pruebas negativas de permisos públicos. Si alguna resultara autorizada, la
-- prueba falla y la subtransacción revierte esa operación.
-- Estas pruebas validan el estado final posterior a 010600; no simulan la
-- ventana intermedia en la que 010200 mantiene bloqueadas las inserciones.

BEGIN;
SET LOCAL search_path = '';

DO $test$
DECLARE
  required_table_count integer;
  required_column_count integer;
BEGIN
  IF pg_catalog.to_regprocedure(
    'extensions.gen_random_bytes(integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Required cryptographic function is unavailable';
  END IF;

  SELECT pg_catalog.count(*)
  INTO required_table_count
  FROM information_schema.tables
  WHERE information_schema.tables.table_schema = 'public'
    AND information_schema.tables.table_name = ANY (
      ARRAY['cities', 'categories', 'subcategories', 'reports', 'report_status_history']
    );

  IF required_table_count <> 5 THEN
    RAISE EXCEPTION 'Expected five Phase 1B tables';
  END IF;

  SELECT pg_catalog.count(*)
  INTO required_column_count
  FROM information_schema.columns
  WHERE information_schema.columns.table_schema = 'public'
    AND information_schema.columns.table_name = 'reports'
    AND information_schema.columns.column_name = ANY (
      ARRAY[
        'tracking_code',
        'city_id',
        'address_text',
        'occurred_at',
        'moderation_status',
        'workflow_status',
        'address',
        'status'
      ]
    );

  IF required_column_count <> 8 THEN
    RAISE EXCEPTION 'Report column validation failed';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.subcategories) <> 0 THEN
    RAISE EXCEPTION 'The Phase 1B seed must not invent subcategories';
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
    RAISE EXCEPTION 'Existing report backfill validation failed';
  END IF;
END;
$test$ LANGUAGE plpgsql;

DO $test$
BEGIN
  IF EXISTS (
    WITH expected_functions (
      function_name,
      security_definer
    ) AS (
      VALUES
        ('prepare_report_initial_values'::name, false),
        ('generate_report_tracking_code'::name, true),
        ('set_updated_at'::name, false)
    )
    SELECT 1
    FROM expected_functions
    LEFT JOIN pg_catalog.pg_proc
      ON pg_catalog.pg_proc.proname = expected_functions.function_name
      AND pg_catalog.pg_get_function_identity_arguments(
        pg_catalog.pg_proc.oid
      ) = ''::text
    LEFT JOIN pg_catalog.pg_namespace
      ON pg_catalog.pg_namespace.oid = pg_catalog.pg_proc.pronamespace
      AND pg_catalog.pg_namespace.nspname = 'public'::name
    LEFT JOIN pg_catalog.pg_roles
      ON pg_catalog.pg_roles.oid = pg_catalog.pg_proc.proowner
    WHERE pg_catalog.pg_proc.oid IS NULL
       OR pg_catalog.pg_namespace.oid IS NULL
       OR pg_catalog.pg_roles.rolname IS DISTINCT FROM 'postgres'::name
       OR pg_catalog.pg_proc.prosecdef IS DISTINCT FROM
          expected_functions.security_definer
       OR NOT COALESCE(
         pg_catalog.pg_proc.proconfig
           @> ARRAY['search_path=""'::text],
         false
       )
  ) OR (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_proc
    JOIN pg_catalog.pg_namespace
      ON pg_catalog.pg_namespace.oid = pg_catalog.pg_proc.pronamespace
    WHERE pg_catalog.pg_namespace.nspname = 'public'::name
      AND pg_catalog.pg_proc.proname = ANY (
        ARRAY[
          'prepare_report_initial_values'::name,
          'generate_report_tracking_code'::name,
          'set_updated_at'::name
        ]
      )
      AND pg_catalog.pg_get_function_identity_arguments(
        pg_catalog.pg_proc.oid
      ) = ''::text
  ) <> 3 THEN
    RAISE EXCEPTION 'Auxiliary function metadata validation failed';
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
    WHERE pg_catalog.pg_namespace.nspname = 'public'::name
      AND pg_catalog.pg_proc.proname = ANY (
        ARRAY[
          'prepare_report_initial_values'::name,
          'generate_report_tracking_code'::name,
          'set_updated_at'::name
        ]
      )
      AND pg_catalog.pg_get_function_identity_arguments(
        pg_catalog.pg_proc.oid
      ) = ''::text
      AND function_acl.grantee = 0::oid
      AND function_acl.privilege_type = 'EXECUTE'::text
  ) THEN
    RAISE EXCEPTION 'PUBLIC can execute an auxiliary function directly';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.prepare_report_initial_values()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated',
    'public.prepare_report_initial_values()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon',
    'public.generate_report_tracking_code()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated',
    'public.generate_report_tracking_code()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon',
    'public.set_updated_at()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated',
    'public.set_updated_at()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'service_role',
    'public.prepare_report_initial_values()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'service_role',
    'public.generate_report_tracking_code()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'service_role',
    'public.set_updated_at()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Restricted role can execute an auxiliary function directly';
  END IF;

  IF EXISTS (
    WITH expected_triggers (
      trigger_name,
      table_name,
      function_name,
      trigger_type
    ) AS (
      VALUES
        (
          'cities_90_set_updated_at'::name,
          'cities'::name,
          'set_updated_at'::name,
          19::smallint
        ),
        (
          'reports_10_prepare_initial_values'::name,
          'reports'::name,
          'prepare_report_initial_values'::name,
          7::smallint
        ),
        (
          'reports_20_generate_tracking_code'::name,
          'reports'::name,
          'generate_report_tracking_code'::name,
          7::smallint
        ),
        (
          'reports_90_set_updated_at'::name,
          'reports'::name,
          'set_updated_at'::name,
          19::smallint
        )
    ),
    actual_triggers AS (
      SELECT
        pg_catalog.pg_trigger.tgname AS trigger_name,
        pg_catalog.pg_class.relname AS table_name,
        pg_catalog.pg_proc.proname AS function_name,
        pg_catalog.pg_trigger.tgtype AS trigger_type,
        pg_catalog.pg_trigger.tgenabled AS trigger_enabled
      FROM pg_catalog.pg_trigger
      JOIN pg_catalog.pg_class
        ON pg_catalog.pg_class.oid = pg_catalog.pg_trigger.tgrelid
      JOIN pg_catalog.pg_namespace
        ON pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
      JOIN pg_catalog.pg_proc
        ON pg_catalog.pg_proc.oid = pg_catalog.pg_trigger.tgfoid
      WHERE pg_catalog.pg_namespace.nspname = 'public'::name
        AND pg_catalog.pg_class.relname = ANY (
          ARRAY[
            'cities'::name,
            'categories'::name,
            'subcategories'::name,
            'reports'::name,
            'report_status_history'::name
          ]
        )
        AND NOT pg_catalog.pg_trigger.tgisinternal
    ),
    unexpected_triggers AS (
      SELECT
        actual_triggers.trigger_name,
        actual_triggers.table_name,
        actual_triggers.function_name,
        actual_triggers.trigger_type
      FROM actual_triggers
      WHERE actual_triggers.trigger_enabled = 'O'::"char"
      EXCEPT
      SELECT * FROM expected_triggers
    ),
    missing_triggers AS (
      SELECT * FROM expected_triggers
      EXCEPT
      SELECT
        actual_triggers.trigger_name,
        actual_triggers.table_name,
        actual_triggers.function_name,
        actual_triggers.trigger_type
      FROM actual_triggers
      WHERE actual_triggers.trigger_enabled = 'O'::"char"
    )
    SELECT 1 FROM unexpected_triggers
    UNION ALL
    SELECT 1 FROM missing_triggers
  ) OR (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_trigger
    JOIN pg_catalog.pg_class
      ON pg_catalog.pg_class.oid = pg_catalog.pg_trigger.tgrelid
    JOIN pg_catalog.pg_namespace
      ON pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
    WHERE pg_catalog.pg_namespace.nspname = 'public'::name
      AND pg_catalog.pg_class.relname = ANY (
        ARRAY[
          'cities'::name,
          'categories'::name,
          'subcategories'::name,
          'reports'::name,
          'report_status_history'::name
        ]
      )
      AND NOT pg_catalog.pg_trigger.tgisinternal
  ) <> 4 THEN
    RAISE EXCEPTION 'Trigger definition validation failed';
  END IF;

  IF (
    SELECT pg_catalog.array_agg(
      pg_catalog.pg_trigger.tgname::text
      ORDER BY pg_catalog.pg_trigger.tgname
    )
    FROM pg_catalog.pg_trigger
    WHERE pg_catalog.pg_trigger.tgrelid = 'public.reports'::regclass
      AND NOT pg_catalog.pg_trigger.tgisinternal
      AND (pg_catalog.pg_trigger.tgtype & 4::smallint) = 4::smallint
  ) IS DISTINCT FROM ARRAY[
    'reports_10_prepare_initial_values'::text,
    'reports_20_generate_tracking_code'::text
  ] THEN
    RAISE EXCEPTION 'Report INSERT trigger order validation failed';
  END IF;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  active_category_id uuid;
  posadas_city_id uuid;
  compatible_category_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  other_category_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  inactive_category_id uuid := '33333333-3333-4333-8333-333333333333'::uuid;
  compatible_subcategory_id uuid := '44444444-4444-4444-8444-444444444444'::uuid;
  inactive_subcategory_id uuid := '55555555-5555-4555-8555-555555555555'::uuid;
  missing_subcategory_id uuid := '66666666-6666-4666-8666-666666666666'::uuid;
  report_id uuid;
  first_tracking text;
  provided_tracking text;
  preserved_tracking text;
  generated_codes text[] := ARRAY[]::text[];
  old_updated_at timestamp with time zone;
  new_updated_at timestamp with time zone;
  iteration integer;
BEGIN
  SELECT public.categories.id
  INTO active_category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  SELECT public.cities.id
  INTO posadas_city_id
  FROM public.cities
  WHERE public.cities.slug = 'posadas'::text
    AND public.cities.is_active = true;

  IF active_category_id IS NULL OR posadas_city_id IS NULL THEN
    RAISE EXCEPTION 'Required catalog fixture is unavailable';
  END IF;

  FOR iteration IN 1..24 LOOP
    INSERT INTO public.reports (
      category_id,
      description,
      latitude,
      longitude,
      urgency
    )
    VALUES (
      active_category_id,
      'phase-1b-tracking-test'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text
    )
    RETURNING public.reports.id, public.reports.tracking_code
    INTO report_id, first_tracking;

    IF first_tracking !~ '^PR-[0-9A-F]{20}$'::text THEN
      RAISE EXCEPTION 'Tracking format validation failed';
    END IF;

    generated_codes := pg_catalog.array_append(generated_codes, first_tracking);
  END LOOP;

  IF (
    SELECT pg_catalog.count(DISTINCT generated_code)
    FROM pg_catalog.unnest(generated_codes) AS generated_code
  ) <> 24 THEN
    RAISE EXCEPTION 'Tracking uniqueness validation failed';
  END IF;

  provided_tracking :=
    'PR-'::text
    || pg_catalog.upper(
      pg_catalog.encode(extensions.gen_random_bytes(10), 'hex'::text)
    );

  INSERT INTO public.reports (
    tracking_code,
    category_id,
    description,
    latitude,
    longitude,
    urgency
  ) VALUES (
    provided_tracking,
    active_category_id,
    'privileged-tracking-preservation'::text,
    (-27.3621)::double precision,
    (-55.9009)::double precision,
    'medium'::text
  )
  RETURNING public.reports.tracking_code
  INTO preserved_tracking;

  IF preserved_tracking IS DISTINCT FROM provided_tracking THEN
    RAISE EXCEPTION 'Privileged tracking code was overwritten';
  END IF;

  SELECT public.reports.updated_at
  INTO old_updated_at
  FROM public.reports
  WHERE public.reports.id = report_id;

  PERFORM pg_catalog.pg_sleep(0.01);

  UPDATE public.reports
  SET description = 'phase-1b-updated-at-test'::text
  WHERE public.reports.id = report_id;

  SELECT public.reports.updated_at
  INTO new_updated_at
  FROM public.reports
  WHERE public.reports.id = report_id;

  IF new_updated_at <= old_updated_at THEN
    RAISE EXCEPTION 'updated_at trigger validation failed';
  END IF;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency
    ) VALUES (
      active_category_id, 'invalid-latitude'::text,
      91::double precision, (-55.9009)::double precision, 'medium'::text
    );
    RAISE EXCEPTION 'Invalid latitude was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency
    ) VALUES (
      active_category_id, 'invalid-longitude'::text,
      (-27.3621)::double precision, 181::double precision, 'medium'::text
    );
    RAISE EXCEPTION 'Invalid longitude was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency,
      moderation_status, workflow_status
    ) VALUES (
      active_category_id, 'invalid-state'::text,
      (-27.3621)::double precision, (-55.9009)::double precision, 'medium'::text,
      'unknown'::text, 'received'::text
    );
    RAISE EXCEPTION 'Invalid moderation state was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.categories (id, name, is_active)
  VALUES
    (compatible_category_id, 'Phase 1B category A'::text, true),
    (other_category_id, 'Phase 1B category B'::text, true),
    (inactive_category_id, 'Phase 1B inactive category'::text, false);

  INSERT INTO public.subcategories (id, category_id, name, is_active)
  VALUES
    (
      compatible_subcategory_id,
      compatible_category_id,
      'Phase 1B subcategory'::text,
      true
    ),
    (
      inactive_subcategory_id,
      compatible_category_id,
      'Phase 1B inactive subcategory'::text,
      false
    );

  INSERT INTO public.reports (
    category_id, subcategory_id, description, latitude, longitude, urgency
  ) VALUES (
    compatible_category_id,
    compatible_subcategory_id,
    'compatible-subcategory'::text,
    (-27.3621)::double precision,
    (-55.9009)::double precision,
    'low'::text
  );

  INSERT INTO public.reports (
    category_id, subcategory_id, description, latitude, longitude, urgency
  ) VALUES (
    compatible_category_id,
    NULL,
    'null-subcategory'::text,
    (-27.3621)::double precision,
    (-55.9009)::double precision,
    'low'::text
  );

  BEGIN
    INSERT INTO public.reports (
      category_id, subcategory_id, description, latitude, longitude, urgency
    ) VALUES (
      other_category_id,
      compatible_subcategory_id,
      'mismatched-subcategory'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'low'::text
    );
    RAISE EXCEPTION 'Mismatched subcategory was accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, subcategory_id, description, latitude, longitude, urgency
    ) VALUES (
      compatible_category_id,
      missing_subcategory_id,
      'missing-subcategory'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'low'::text
    );
    RAISE EXCEPTION 'Missing subcategory was accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;
END;
$test$ LANGUAGE plpgsql;

-- Estos checks validan la coherencia interna de cada fila de historial. Fase
-- 1B no comprueba automáticamente que los valores previos o nuevos coincidan
-- con el estado actual almacenado en public.reports.
DO $test$
DECLARE
  active_category_id uuid;
  report_id uuid;
BEGIN
  SELECT public.categories.id
  INTO active_category_id
  FROM public.categories
  WHERE public.categories.is_active = true
  ORDER BY public.categories.id
  LIMIT 1;

  INSERT INTO public.reports (
    category_id, description, latitude, longitude, urgency
  ) VALUES (
    active_category_id,
    'history-check-fixture'::text,
    (-27.3621)::double precision,
    (-55.9009)::double precision,
    'medium'::text
  )
  RETURNING public.reports.id INTO report_id;

  INSERT INTO public.report_status_history (
    report_id, previous_moderation_status, moderation_status
  ) VALUES (
    report_id, NULL, 'pending'::text
  );

  INSERT INTO public.report_status_history (
    report_id, previous_workflow_status, workflow_status
  ) VALUES (
    report_id, 'received'::text, 'in_review'::text
  );

  BEGIN
    INSERT INTO public.report_status_history (
      report_id, previous_moderation_status, moderation_status
    ) VALUES (
      report_id, 'pending'::text, 'pending'::text
    );
    RAISE EXCEPTION 'Equal moderation states were accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.report_status_history (
      report_id, previous_workflow_status, workflow_status
    ) VALUES (
      report_id, 'received'::text, NULL
    );
    RAISE EXCEPTION 'State to NULL transition was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.report_status_history (report_id)
    VALUES (report_id);
    RAISE EXCEPTION 'History row without a real change was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$test$ LANGUAGE plpgsql;

DO $test$
DECLARE
  public_role text;
  report_column text;
  phase_table text;
  phase_privilege text;
  phase_column record;
BEGIN
  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_class
    JOIN pg_catalog.pg_namespace
      ON pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
    WHERE pg_catalog.pg_namespace.nspname = 'public'::name
      AND pg_catalog.pg_class.relname = ANY (
        ARRAY[
          'cities'::name,
          'categories'::name,
          'subcategories'::name,
          'reports'::name,
          'report_status_history'::name
        ]
      )
      AND pg_catalog.pg_class.relrowsecurity
  ) <> 5 THEN
    RAISE EXCEPTION 'RLS is not enabled on every Phase 1B table';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE information_schema.table_privileges.table_schema::text = 'public'::text
      AND information_schema.table_privileges.table_name::text = ANY (
        ARRAY[
          'cities'::text,
          'categories'::text,
          'subcategories'::text,
          'reports'::text,
          'report_status_history'::text
        ]
      )
      AND information_schema.table_privileges.grantee::text = 'PUBLIC'::text
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.column_privileges
    WHERE information_schema.column_privileges.table_schema::text = 'public'::text
      AND information_schema.column_privileges.table_name::text = ANY (
        ARRAY[
          'cities'::text,
          'categories'::text,
          'subcategories'::text,
          'reports'::text,
          'report_status_history'::text
        ]
      )
      AND information_schema.column_privileges.grantee::text = 'PUBLIC'::text
  ) THEN
    RAISE EXCEPTION 'Unexpected privilege granted through PUBLIC';
  END IF;

  IF EXISTS (
    WITH expected_policies (
      table_name,
      policy_name,
      command_name
    ) AS (
      VALUES
        (
          'cities'::name,
          'Public can read active cities'::name,
          'SELECT'::text
        ),
        (
          'categories'::name,
          'Public can read active categories'::name,
          'SELECT'::text
        ),
        (
          'subcategories'::name,
          'Public can read active subcategories'::name,
          'SELECT'::text
        ),
        (
          'reports'::name,
          'Public can create pending reports'::name,
          'INSERT'::text
        )
    ),
    actual_policies AS (
      SELECT
        pg_catalog.pg_policies.tablename AS table_name,
        pg_catalog.pg_policies.policyname AS policy_name,
        pg_catalog.pg_policies.cmd AS command_name
      FROM pg_catalog.pg_policies
      WHERE pg_catalog.pg_policies.schemaname = 'public'::name
        AND pg_catalog.pg_policies.roles
          && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]
    ),
    unexpected_policies AS (
      SELECT * FROM actual_policies
      EXCEPT
      SELECT * FROM expected_policies
    ),
    missing_policies AS (
      SELECT * FROM expected_policies
      EXCEPT
      SELECT * FROM actual_policies
    )
    SELECT 1 FROM unexpected_policies
    UNION ALL
    SELECT 1 FROM missing_policies
  ) THEN
    RAISE EXCEPTION 'Public RLS policy set validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE information_schema.role_table_grants.table_schema = 'public'
      AND information_schema.role_table_grants.grantee IN (
        'anon'::text,
        'authenticated'::text
      )
      AND NOT (
        (
          information_schema.role_table_grants.table_name IN (
            'cities'::text,
            'categories'::text,
            'subcategories'::text
          )
          AND information_schema.role_table_grants.privilege_type = 'SELECT'::text
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected public table privilege detected';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE pg_catalog.pg_roles.rolname = 'service_role'::name
      AND pg_catalog.pg_roles.rolsuper = false
      AND pg_catalog.pg_roles.rolinherit = true
      AND pg_catalog.pg_roles.rolbypassrls = true
  ) THEN
    RAISE EXCEPTION 'service_role attribute validation failed';
  END IF;

  FOREACH phase_table IN ARRAY ARRAY[
    'cities'::text,
    'categories'::text,
    'subcategories'::text,
    'reports'::text,
    'report_status_history'::text
  ] LOOP
    FOREACH phase_privilege IN ARRAY ARRAY[
      'SELECT'::text,
      'INSERT'::text,
      'UPDATE'::text,
      'DELETE'::text,
      'TRUNCATE'::text,
      'REFERENCES'::text,
      'TRIGGER'::text
    ] LOOP
      IF pg_catalog.has_table_privilege(
        'service_role',
        'public.' || phase_table,
        phase_privilege
      ) THEN
        RAISE EXCEPTION 'Unexpected service_role privilege % on public.%',
          phase_privilege,
          phase_table;
      END IF;
    END LOOP;

    FOR phase_column IN
      SELECT information_schema.columns.column_name
      FROM information_schema.columns
      WHERE information_schema.columns.table_schema = 'public'::name
        AND information_schema.columns.table_name = phase_table
    LOOP
      FOREACH phase_privilege IN ARRAY ARRAY[
        'SELECT'::text,
        'INSERT'::text,
        'UPDATE'::text,
        'REFERENCES'::text
      ] LOOP
        IF pg_catalog.has_column_privilege(
          'service_role',
          'public.' || phase_table,
          phase_column.column_name,
          phase_privilege
        ) THEN
          RAISE EXCEPTION
            'Unexpected service_role column privilege % on public.%.%',
            phase_privilege,
            phase_table,
            phase_column.column_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF NOT pg_catalog.has_table_privilege('anon', 'public.cities', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.cities', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('anon', 'public.categories', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.categories', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('anon', 'public.subcategories', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.subcategories', 'SELECT') THEN
    RAISE EXCEPTION 'Required public table privilege is missing';
  END IF;

  FOREACH public_role IN ARRAY ARRAY['anon'::text, 'authenticated'::text] LOOP
    FOREACH report_column IN ARRAY ARRAY[
      'category_id'::text,
      'subcategory_id'::text,
      'description'::text,
      'latitude'::text,
      'longitude'::text,
      'address'::text,
      'urgency'::text,
      'status'::text
    ] LOOP
      IF NOT pg_catalog.has_column_privilege(
        public_role,
        'public.reports',
        report_column,
        'INSERT'
      ) THEN
        RAISE EXCEPTION 'Missing INSERT privilege for role % on reports.%',
          public_role,
          report_column;
      END IF;
    END LOOP;

    FOREACH report_column IN ARRAY ARRAY[
      'id'::text,
      'tracking_code'::text,
      'city_id'::text,
      'created_at'::text,
      'updated_at'::text,
      'address_text'::text,
      'occurred_at'::text,
      'moderation_status'::text,
      'workflow_status'::text
    ] LOOP
      IF pg_catalog.has_column_privilege(
        public_role,
        'public.reports',
        report_column,
        'INSERT'
      ) THEN
        RAISE EXCEPTION 'Unexpected INSERT privilege for role % on reports.%',
          public_role,
          report_column;
      END IF;
    END LOOP;
  END LOOP;
END;
$test$ LANGUAGE plpgsql;

SET LOCAL ROLE anon;

INSERT INTO public.reports (
  category_id,
  subcategory_id,
  description,
  latitude,
  longitude,
  address,
  urgency,
  status
)
VALUES (
  '571327a9-905c-4d14-99af-5c75f71fa134'::uuid,
  NULL,
  'anon-public-insert'::text,
  (-27.3621)::double precision,
  (-55.9009)::double precision,
  NULL,
  'medium'::text,
  'resolved'::text
);

INSERT INTO public.reports (
  category_id,
  subcategory_id,
  description,
  latitude,
  longitude,
  urgency
)
VALUES (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid,
  'anon-compatible-subcategory'::text,
  (-27.3621)::double precision,
  (-55.9009)::double precision,
  'medium'::text
);

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id =
      '33333333-3333-4333-8333-333333333333'::uuid
  ) OR EXISTS (
    SELECT 1
    FROM public.subcategories
    WHERE public.subcategories.id =
      '55555555-5555-4555-8555-555555555555'::uuid
  ) THEN
    RAISE EXCEPTION 'anon can read an inactive catalog entry';
  END IF;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency
    ) VALUES (
      '33333333-3333-4333-8333-333333333333'::uuid,
      'anon-inactive-category'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text
    );
    RAISE EXCEPTION 'Public insert accepted an inactive category';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, subcategory_id, description, latitude, longitude, urgency
    ) VALUES (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '55555555-5555-4555-8555-555555555555'::uuid,
      'anon-inactive-subcategory'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text
    );
    RAISE EXCEPTION 'Public insert accepted an inactive subcategory';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM 1 FROM public.reports;
    RAISE EXCEPTION 'Public SELECT on reports was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE 'UPDATE public.reports SET description = description';
    RAISE EXCEPTION 'Public UPDATE on reports was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE 'DELETE FROM public.reports WHERE false';
    RAISE EXCEPTION 'Public DELETE on reports was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE 'TRUNCATE TABLE public.reports';
    RAISE EXCEPTION 'Public TRUNCATE on reports was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM 1 FROM public.report_status_history;
    RAISE EXCEPTION 'Public history access was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency, tracking_code
    ) VALUES (
      '571327a9-905c-4d14-99af-5c75f71fa134'::uuid,
      'public-tracking-override'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text,
      'PR-00000000000000000000'::text
    );
    RAISE EXCEPTION 'Public tracking override was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$test$ LANGUAGE plpgsql;

RESET ROLE;

DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.reports
    WHERE public.reports.description = 'anon-public-insert'::text
      AND public.reports.city_id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
      AND public.reports.status = 'pending'::text
      AND public.reports.moderation_status = 'pending'::text
      AND public.reports.workflow_status = 'received'::text
      AND public.reports.tracking_code ~ '^PR-[0-9A-F]{20}$'::text
  ) THEN
    RAISE EXCEPTION 'Public initial value normalization failed';
  END IF;
END;
$test$ LANGUAGE plpgsql;

SET LOCAL ROLE authenticated;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id =
      '33333333-3333-4333-8333-333333333333'::uuid
  ) OR EXISTS (
    SELECT 1
    FROM public.subcategories
    WHERE public.subcategories.id =
      '55555555-5555-4555-8555-555555555555'::uuid
  ) THEN
    RAISE EXCEPTION 'authenticated can read an inactive catalog entry';
  END IF;

  BEGIN
    INSERT INTO public.reports (
      category_id, description, latitude, longitude, urgency
    ) VALUES (
      '33333333-3333-4333-8333-333333333333'::uuid,
      'authenticated-inactive-category'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text
    );
    RAISE EXCEPTION 'Authenticated insert accepted an inactive category';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reports (
      category_id, subcategory_id, description, latitude, longitude, urgency
    ) VALUES (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '55555555-5555-4555-8555-555555555555'::uuid,
      'authenticated-inactive-subcategory'::text,
      (-27.3621)::double precision,
      (-55.9009)::double precision,
      'medium'::text
    );
    RAISE EXCEPTION 'Authenticated insert accepted an inactive subcategory';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$test$ LANGUAGE plpgsql;

INSERT INTO public.reports (
  category_id,
  description,
  latitude,
  longitude,
  urgency
)
VALUES (
  '571327a9-905c-4d14-99af-5c75f71fa134'::uuid,
  'authenticated-public-insert'::text,
  (-27.3621)::double precision,
  (-55.9009)::double precision,
  'low'::text
);

RESET ROLE;

DELETE FROM public.reports
WHERE public.reports.category_id = ANY (
  ARRAY[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid
  ]
);

DELETE FROM public.subcategories
WHERE public.subcategories.id = ANY (
  ARRAY[
    '44444444-4444-4444-8444-444444444444'::uuid,
    '55555555-5555-4555-8555-555555555555'::uuid
  ]
);

DELETE FROM public.categories
WHERE public.categories.id = ANY (
  ARRAY[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid
  ]
);

DO $test$
DECLARE
  reinserted_count integer;
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.categories) <> 8
     OR EXISTS (
    WITH expected_categories (
      id,
      name,
      description,
      icon,
      is_active,
      created_at
    ) AS (
      VALUES
        ('571327a9-905c-4d14-99af-5c75f71fa134'::uuid, 'Agua e inundaciones'::text, 'Problemas relacionados con agua, drenaje, inundaciones y acumulación de agua.'::text, '💧'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('b74c4365-5b99-4432-9a1d-a2c873265b97'::uuid, 'Alumbrado público'::text, 'Problemas relacionados con luminarias, postes y falta de iluminación en espacios públicos.'::text, '💡'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('2f51a29c-04e5-4b54-854b-180f2d252d64'::uuid, 'Baches y calles'::text, 'Baches, pozos, calles deterioradas y problemas de infraestructura vial.'::text, '🕳️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('f3910bf2-56cc-4662-89ec-cd260e94da1b'::uuid, 'Basura y residuos'::text, 'Acumulación de basura, residuos y problemas relacionados con la limpieza urbana.'::text, '🗑️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('b2a9c3c9-2c5d-4693-910f-97669ec9d414'::uuid, 'Espacios públicos'::text, 'Problemas relacionados con plazas, parques, paseos y otros espacios públicos.'::text, '🌳'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('fb94c948-b390-42c7-b64b-28a0e66d2c8f'::uuid, 'Inseguridad'::text, 'Situaciones o hechos relacionados con la seguridad en la vía pública.'::text, '🚨'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('087bd262-3dab-4799-9255-1a8dea7c02f6'::uuid, 'Obras públicas'::text, 'Problemas o situaciones relacionadas con obras y trabajos de infraestructura pública.'::text, '🏗️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
        ('25d7b3c0-aaae-411e-9a3c-226830bb553b'::uuid, 'Tránsito y movilidad'::text, 'Problemas relacionados con semáforos, señalización, tránsito, estacionamiento y movilidad.'::text, '🚦'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz)
    )
    SELECT 1
    FROM expected_categories
    LEFT JOIN public.categories
      ON public.categories.id = expected_categories.id
    WHERE public.categories.id IS NULL
       OR public.categories.name IS DISTINCT FROM expected_categories.name
       OR public.categories.description IS DISTINCT FROM expected_categories.description
       OR public.categories.icon IS DISTINCT FROM expected_categories.icon
       OR public.categories.is_active IS DISTINCT FROM expected_categories.is_active
       OR public.categories.created_at IS DISTINCT FROM expected_categories.created_at
  ) THEN
    RAISE EXCEPTION 'Category seed divergence detected';
  END IF;

  WITH reinserted AS (
    INSERT INTO public.categories (
      id,
      name,
      description,
      icon,
      is_active,
      created_at
    )
    SELECT
      public.categories.id,
      public.categories.name,
      public.categories.description,
      public.categories.icon,
      public.categories.is_active,
      public.categories.created_at
    FROM public.categories
    WHERE public.categories.id = ANY (
      ARRAY[
        '571327a9-905c-4d14-99af-5c75f71fa134'::uuid,
        'b74c4365-5b99-4432-9a1d-a2c873265b97'::uuid,
        '2f51a29c-04e5-4b54-854b-180f2d252d64'::uuid,
        'f3910bf2-56cc-4662-89ec-cd260e94da1b'::uuid,
        'b2a9c3c9-2c5d-4693-910f-97669ec9d414'::uuid,
        'fb94c948-b390-42c7-b64b-28a0e66d2c8f'::uuid,
        '087bd262-3dab-4799-9255-1a8dea7c02f6'::uuid,
        '25d7b3c0-aaae-411e-9a3c-226830bb553b'::uuid
      ]
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING public.categories.id
  )
  SELECT pg_catalog.count(*)
  INTO reinserted_count
  FROM reinserted;

  IF reinserted_count <> 0 THEN
    RAISE EXCEPTION 'Seed idempotency validation failed';
  END IF;

  BEGIN
    UPDATE public.categories
    SET description = 'intentional-divergence'::text
    WHERE public.categories.id = '571327a9-905c-4d14-99af-5c75f71fa134'::uuid;

    IF (SELECT pg_catalog.count(*) FROM public.categories) <> 8
       OR EXISTS (
      WITH expected_categories (
        id,
        name,
        description,
        icon,
        is_active,
        created_at
      ) AS (
        VALUES
          ('571327a9-905c-4d14-99af-5c75f71fa134'::uuid, 'Agua e inundaciones'::text, 'Problemas relacionados con agua, drenaje, inundaciones y acumulación de agua.'::text, '💧'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('b74c4365-5b99-4432-9a1d-a2c873265b97'::uuid, 'Alumbrado público'::text, 'Problemas relacionados con luminarias, postes y falta de iluminación en espacios públicos.'::text, '💡'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('2f51a29c-04e5-4b54-854b-180f2d252d64'::uuid, 'Baches y calles'::text, 'Baches, pozos, calles deterioradas y problemas de infraestructura vial.'::text, '🕳️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('f3910bf2-56cc-4662-89ec-cd260e94da1b'::uuid, 'Basura y residuos'::text, 'Acumulación de basura, residuos y problemas relacionados con la limpieza urbana.'::text, '🗑️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('b2a9c3c9-2c5d-4693-910f-97669ec9d414'::uuid, 'Espacios públicos'::text, 'Problemas relacionados con plazas, parques, paseos y otros espacios públicos.'::text, '🌳'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('fb94c948-b390-42c7-b64b-28a0e66d2c8f'::uuid, 'Inseguridad'::text, 'Situaciones o hechos relacionados con la seguridad en la vía pública.'::text, '🚨'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('087bd262-3dab-4799-9255-1a8dea7c02f6'::uuid, 'Obras públicas'::text, 'Problemas o situaciones relacionadas con obras y trabajos de infraestructura pública.'::text, '🏗️'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz),
          ('25d7b3c0-aaae-411e-9a3c-226830bb553b'::uuid, 'Tránsito y movilidad'::text, 'Problemas relacionados con semáforos, señalización, tránsito, estacionamiento y movilidad.'::text, '🚦'::text, true, '2026-08-04 00:14:58.195882+00'::timestamptz)
      )
      SELECT 1
      FROM expected_categories
      LEFT JOIN public.categories
        ON public.categories.id = expected_categories.id
      WHERE public.categories.id IS NULL
         OR public.categories.name IS DISTINCT FROM expected_categories.name
         OR public.categories.description IS DISTINCT FROM expected_categories.description
         OR public.categories.icon IS DISTINCT FROM expected_categories.icon
         OR public.categories.is_active IS DISTINCT FROM expected_categories.is_active
         OR public.categories.created_at IS DISTINCT FROM expected_categories.created_at
    ) THEN
      RAISE EXCEPTION 'Category seed divergence detected';
    END IF;

    RAISE EXCEPTION 'Category seed divergence was not detected';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'Category seed divergence detected' THEN
        RAISE;
      END IF;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id = '571327a9-905c-4d14-99af-5c75f71fa134'::uuid
      AND public.categories.name = 'Agua e inundaciones'::text
      AND public.categories.description =
        'Problemas relacionados con agua, drenaje, inundaciones y acumulación de agua.'::text
      AND public.categories.icon = '💧'::text
      AND public.categories.is_active = true
      AND public.categories.created_at =
        '2026-08-04 00:14:58.195882+00'::timestamptz
  ) THEN
    RAISE EXCEPTION 'Seed divergence subtransaction did not roll back';
  END IF;
END;
$test$ LANGUAGE plpgsql;

ROLLBACK;
