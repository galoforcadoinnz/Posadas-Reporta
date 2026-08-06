-- Objetivo: crear el catálogo de ciudades y registrar Posadas con identidad
-- estable para el backfill y la compatibilidad temporal del MVP.
-- Precondiciones: public.cities no existe; el rol postgres ejecuta la migración.
-- Postcondiciones: public.cities existe, Posadas está activa y RLS está activa
-- sin políticas públicas hasta la migración de hardening.
-- Reversión: conservar la tabla y dejar de utilizarla. No se propone eliminar
-- objetos ni datos como parte de una reversión automática.
-- Objetos afectados: public.cities.

BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'extensions.gen_random_bytes(integer)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Phase 1B aborted: required cryptographic function extensions.gen_random_bytes(integer) is unavailable';
  END IF;
END;
$preflight$ LANGUAGE plpgsql;

CREATE TABLE public.cities (
  id uuid DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  province text NOT NULL,
  country_code text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  updated_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  CONSTRAINT cities_pkey PRIMARY KEY (id),
  CONSTRAINT cities_slug_key UNIQUE (slug),
  CONSTRAINT cities_name_not_blank_check
    CHECK (pg_catalog.btrim(name) <> ''::text),
  CONSTRAINT cities_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text),
  CONSTRAINT cities_province_not_blank_check
    CHECK (pg_catalog.btrim(province) <> ''::text),
  CONSTRAINT cities_country_code_check
    CHECK (country_code ~ '^[A-Z]{2}$'::text)
);

ALTER TABLE public.cities OWNER TO postgres;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cities (
  id,
  name,
  slug,
  province,
  country_code,
  is_active
)
SELECT
  'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid,
  'Posadas'::text,
  'posadas'::text,
  'Misiones'::text,
  'AR'::text,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cities
  WHERE public.cities.id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cities
    WHERE public.cities.id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
      AND public.cities.name = 'Posadas'::text
      AND public.cities.slug = 'posadas'::text
      AND public.cities.province = 'Misiones'::text
      AND public.cities.country_code = 'AR'::text
      AND public.cities.is_active = true
  ) THEN
    RAISE EXCEPTION 'Posadas city seed validation failed';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

COMMIT;
