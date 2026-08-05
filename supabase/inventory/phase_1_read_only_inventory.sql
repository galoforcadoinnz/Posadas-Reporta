-- Posadas Reporta — Fase 1A
-- Inventario reproducible y estrictamente de solo lectura.
--
-- Este archivo no modifica esquema, datos, permisos ni configuración.
-- Todas las sentencias ejecutables son SELECT sobre information_schema,
-- pg_catalog, pg_policies o agregaciones sin datos personales.
-- Ejecutar manualmente solo después de obtener aprobación para consultar el
-- entorno correspondiente. No versionar la salida sin revisarla.

-- 1. Versión del motor PostgreSQL.
SELECT
  current_setting('server_version') AS postgresql_version;

-- 2. Existencia y tipo de las tablas relevantes.
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY table_name;

-- 3. Columnas, tipos, nulabilidad y valores por defecto.
SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  datetime_precision
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY table_name, ordinal_position;

-- 4. Primary keys, foreign keys, CHECK y UNIQUE.
SELECT
  namespace.nspname AS table_schema,
  relation.relname AS table_name,
  constraint_record.conname AS constraint_name,
  CASE constraint_record.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE constraint_record.contype::text
  END AS constraint_type,
  pg_get_constraintdef(constraint_record.oid, true) AS definition,
  constraint_record.convalidated AS is_validated
FROM pg_catalog.pg_constraint AS constraint_record
JOIN pg_catalog.pg_class AS relation
  ON relation.oid = constraint_record.conrelid
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
  AND constraint_record.contype IN ('p', 'f', 'c', 'u', 'x')
ORDER BY relation.relname, constraint_type, constraint_record.conname;

-- 5. Índices y sus definiciones.
SELECT
  schemaname AS table_schema,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS index_definition
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY tablename, indexname;

-- 6. Triggers no internos y funciones asociadas, sin mostrar código fuente.
SELECT
  table_namespace.nspname AS table_schema,
  table_relation.relname AS table_name,
  trigger_record.tgname AS trigger_name,
  trigger_record.tgenabled AS trigger_enabled,
  pg_get_triggerdef(trigger_record.oid, true) AS trigger_definition,
  function_namespace.nspname AS function_schema,
  function_record.proname AS function_name,
  pg_get_function_identity_arguments(function_record.oid) AS function_arguments,
  pg_get_function_result(function_record.oid) AS function_result,
  language_record.lanname AS function_language,
  function_record.prosecdef AS is_security_definer,
  function_record.provolatile AS volatility
FROM pg_catalog.pg_trigger AS trigger_record
JOIN pg_catalog.pg_class AS table_relation
  ON table_relation.oid = trigger_record.tgrelid
JOIN pg_catalog.pg_namespace AS table_namespace
  ON table_namespace.oid = table_relation.relnamespace
JOIN pg_catalog.pg_proc AS function_record
  ON function_record.oid = trigger_record.tgfoid
JOIN pg_catalog.pg_namespace AS function_namespace
  ON function_namespace.oid = function_record.pronamespace
JOIN pg_catalog.pg_language AS language_record
  ON language_record.oid = function_record.prolang
WHERE NOT trigger_record.tgisinternal
  AND table_namespace.nspname = 'public'
  AND table_relation.relname IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY table_relation.relname, trigger_record.tgname;

-- 7. Grants explícitos por tabla y rol.
SELECT
  table_schema,
  table_name,
  grantor,
  grantee,
  privilege_type,
  is_grantable,
  with_hierarchy
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY table_name, grantee, privilege_type;

-- 8. Políticas RLS y expresiones aplicadas.
SELECT
  schemaname AS table_schema,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY tablename, policyname;

-- 9. Estado de RLS y RLS forzada por tabla.
SELECT
  namespace.nspname AS table_schema,
  relation.relname AS table_name,
  relation.relrowsecurity AS rls_enabled,
  relation.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND relation.relname IN (
    'cities',
    'categories',
    'subcategories',
    'reports',
    'report_status_history'
  )
ORDER BY relation.relname;

-- 10. Cantidad exacta de filas en tablas actuales, sin mostrar registros.
SELECT
  'categories' AS table_name,
  COUNT(*) AS row_count
FROM public.categories
UNION ALL
SELECT
  'subcategories' AS table_name,
  COUNT(*) AS row_count
FROM public.subcategories
UNION ALL
SELECT
  'reports' AS table_name,
  COUNT(*) AS row_count
FROM public.reports
ORDER BY table_name;

-- 11. Distribución de valores controlados, sin datos de reportes.
SELECT
  urgency,
  COUNT(*) AS row_count
FROM public.reports
GROUP BY urgency
ORDER BY urgency NULLS FIRST;

SELECT
  status,
  COUNT(*) AS row_count
FROM public.reports
GROUP BY status
ORDER BY status NULLS FIRST;

-- 12. Nulabilidad y coordenadas inválidas como conteos agregados.
SELECT
  COUNT(*) FILTER (WHERE category_id IS NULL) AS missing_category_count,
  COUNT(*) FILTER (WHERE description IS NULL OR BTRIM(description) = '') AS missing_description_count,
  COUNT(*) FILTER (WHERE latitude IS NULL) AS missing_latitude_count,
  COUNT(*) FILTER (WHERE longitude IS NULL) AS missing_longitude_count,
  COUNT(*) FILTER (WHERE latitude NOT BETWEEN -90 AND 90) AS invalid_latitude_count,
  COUNT(*) FILTER (WHERE longitude NOT BETWEEN -180 AND 180) AS invalid_longitude_count,
  COUNT(*) FILTER (WHERE urgency IS NULL) AS missing_urgency_count,
  COUNT(*) FILTER (WHERE status IS NULL) AS missing_status_count
FROM public.reports;

-- 13. Integridad referencial actual, expresada solo como conteos.
SELECT
  COUNT(*) AS reports_with_missing_category_count
FROM public.reports AS report_record
WHERE report_record.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.categories AS category_record
    WHERE category_record.id = report_record.category_id
  );

SELECT
  COUNT(*) AS reports_with_missing_subcategory_count
FROM public.reports AS report_record
WHERE report_record.subcategory_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.subcategories AS subcategory_record
    WHERE subcategory_record.id = report_record.subcategory_id
  );

SELECT
  COUNT(*) AS reports_with_mismatched_subcategory_count
FROM public.reports AS report_record
JOIN public.subcategories AS subcategory_record
  ON subcategory_record.id = report_record.subcategory_id
WHERE subcategory_record.category_id IS DISTINCT FROM report_record.category_id;

SELECT
  COUNT(*) AS subcategories_with_missing_category_count
FROM public.subcategories AS subcategory_record
WHERE subcategory_record.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.categories AS category_record
    WHERE category_record.id = subcategory_record.category_id
  );

-- 14. Posibles duplicados de catálogo, solo como cantidad de grupos.
SELECT
  COUNT(*) AS duplicate_category_name_group_count
FROM (
  SELECT LOWER(BTRIM(name)) AS normalized_name
  FROM public.categories
  GROUP BY LOWER(BTRIM(name))
  HAVING COUNT(*) > 1
) AS duplicate_category_names;

SELECT
  COUNT(*) AS duplicate_subcategory_name_group_count
FROM (
  SELECT
    category_id,
    LOWER(BTRIM(name)) AS normalized_name
  FROM public.subcategories
  GROUP BY category_id, LOWER(BTRIM(name))
  HAVING COUNT(*) > 1
) AS duplicate_subcategory_names;
