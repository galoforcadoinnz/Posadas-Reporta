-- Fixture exclusiva de pruebas locales. Supabase Hosted instala esta función
-- de plataforma, pero la imagen PostgreSQL fijada para CI no la incluye.
-- Reproduce únicamente los metadatos y la asociación necesarias para validar
-- el hardening de privilegios; no implementa la lógica administrada del host.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fixture$
BEGIN
  NULL;
END;
$fixture$;

ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

CREATE EVENT TRIGGER test_rls_auto_enable
ON ddl_command_end
EXECUTE FUNCTION public.rls_auto_enable();
