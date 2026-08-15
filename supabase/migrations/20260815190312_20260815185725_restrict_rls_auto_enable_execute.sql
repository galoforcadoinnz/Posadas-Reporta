-- Objetivo: impedir que roles cliente ejecuten directamente la función
-- SECURITY DEFINER usada por el event trigger que habilita RLS en tablas nuevas.
-- El nombre del archivo refleja exactamente el ledger de staging: versión
-- remota 20260815190312 y nombre registrado por el conector
-- 20260815185725_restrict_rls_auto_enable_execute.
-- La función y el event trigger permanecen intactos y activos.
-- Precondiciones: existe exactamente public.rls_auto_enable(), pertenece a
-- postgres, devuelve event_trigger y conserva SECURITY DEFINER.
-- Postcondiciones: PUBLIC, anon, authenticated y service_role no pueden
-- ejecutar la función; al menos un event trigger activo sigue asociado a ella.
-- Reversión controlada: conceder EXECUTE requiere una migración posterior y
-- una revisión de seguridad específica. No se incluye reversión automática.

BEGIN;

DO $migration$
DECLARE
  target_function oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
BEGIN
  IF target_function IS NULL THEN
    RAISE EXCEPTION 'Expected public.rls_auto_enable() to exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    JOIN pg_catalog.pg_roles AS owner
      ON owner.oid = procedure.proowner
    WHERE procedure.oid = target_function
      AND namespace.nspname = 'public'
      AND procedure.proname = 'rls_auto_enable'
      AND procedure.pronargs = 0
      AND procedure.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
      AND procedure.prosecdef = true
      AND procedure.proconfig @> ARRAY['search_path=pg_catalog']::text[]
      AND owner.rolname = 'postgres'
  ) THEN
    RAISE EXCEPTION
      'public.rls_auto_enable() metadata differs from the reviewed platform function';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_event_trigger
    WHERE evtfoid = target_function
      AND evtenabled <> 'D'
  ) THEN
    RAISE EXCEPTION
      'Expected an enabled event trigger backed by public.rls_auto_enable()';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  target_function oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF pg_catalog.has_function_privilege(
      role_name,
      target_function,
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION
        'Role % can still execute public.rls_auto_enable()', role_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS privilege
    WHERE procedure.oid = target_function
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC still has EXECUTE on public.rls_auto_enable()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_event_trigger
    WHERE evtfoid = target_function
      AND evtenabled <> 'D'
  ) THEN
    RAISE EXCEPTION
      'The event trigger backed by public.rls_auto_enable() is not enabled';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

COMMIT;
