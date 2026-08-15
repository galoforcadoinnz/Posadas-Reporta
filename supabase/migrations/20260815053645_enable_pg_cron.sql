-- Objetivo: habilitar Supabase Cron como prerrequisito versionado de la
-- limpieza de identificadores HMAC de Fase 2.
-- Precondiciones: la imagen o el proyecto Supabase debe ofrecer pg_cron.
-- Postcondiciones: cron.schedule(text,text,text) y cron.job están disponibles
-- para que la siguiente migración programe y verifique el trabajo de limpieza.
-- Reversión: no eliminar automáticamente la extensión, porque DROP EXTENSION
-- borraría todos los trabajos cron. Ante un fallo se corrige hacia adelante.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_available_extensions
    WHERE pg_catalog.pg_available_extensions.name = 'pg_cron'
  ) THEN
    RAISE EXCEPTION
      'Phase 2 prerequisite aborted: pg_cron is unavailable';
  END IF;
END;
$preflight$ LANGUAGE plpgsql;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

REVOKE ALL PRIVILEGES
ON SCHEMA cron
FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

DO $postcondition$
BEGIN
  IF pg_catalog.to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR pg_catalog.to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION
      'Phase 2 prerequisite aborted: pg_cron validation failed';
  END IF;

  IF pg_catalog.has_schema_privilege('anon', 'cron', 'USAGE')
     OR pg_catalog.has_schema_privilege('authenticated', 'cron', 'USAGE')
     OR pg_catalog.has_schema_privilege('service_role', 'cron', 'USAGE') THEN
    RAISE EXCEPTION
      'Phase 2 prerequisite aborted: public roles can use the cron schema';
  END IF;

  IF NOT pg_catalog.has_schema_privilege('postgres', 'cron', 'USAGE')
     OR NOT pg_catalog.has_table_privilege('postgres', 'cron.job', 'SELECT') THEN
    RAISE EXCEPTION
      'Phase 2 prerequisite aborted: postgres cannot manage cron jobs';
  END IF;
END;
$postcondition$ LANGUAGE plpgsql;

COMMIT;
