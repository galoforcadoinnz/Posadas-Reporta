-- Objetivo: completar exclusivamente las columnas nuevas de todos los
-- reportes heredados, preservando las columnas y timestamps existentes.
-- Precondiciones: Posadas existe; las columnas de crecimiento están presentes;
-- extensions.gen_random_bytes(integer) está disponible.
-- Postcondiciones: tracking_code, city_id, occurred_at, moderation_status y
-- workflow_status están completos; address_text conserva address, incluso NULL.
-- Reversión: mantener los valores nuevos sin consumirlos. Restaurar únicamente
-- desde el backup autorizado si fuera necesario; no se borran datos.
-- Objetos afectados: public.reports.

BEGIN;

DO $migration$
DECLARE
  posadas_city_id uuid;
  report_record record;
  candidate text;
  attempt_number integer;
  generated boolean;
  report_count_before bigint;
  report_count_after bigint;
BEGIN
  IF pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'Required cryptographic function is unavailable';
  END IF;

  SELECT public.cities.id
  INTO posadas_city_id
  FROM public.cities
  WHERE public.cities.slug = 'posadas'::text
    AND public.cities.is_active = true;

  IF posadas_city_id IS NULL THEN
    RAISE EXCEPTION 'Posadas city precondition failed';
  END IF;

  SELECT pg_catalog.count(*)
  INTO report_count_before
  FROM public.reports;

  FOR report_record IN
    SELECT public.reports.id
    FROM public.reports
    WHERE public.reports.tracking_code IS NULL
    ORDER BY public.reports.id
  LOOP
    generated := false;

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
        UPDATE public.reports
        SET tracking_code = candidate
        WHERE public.reports.id = report_record.id
          AND public.reports.tracking_code IS NULL;

        generated := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT generated THEN
      RAISE EXCEPTION 'Unable to generate tracking code';
    END IF;
  END LOOP;

  UPDATE public.reports
  SET
    city_id = COALESCE(public.reports.city_id, posadas_city_id),
    address_text = COALESCE(
      public.reports.address_text,
      public.reports.address
    ),
    occurred_at = COALESCE(
      public.reports.occurred_at,
      public.reports.created_at
    ),
    moderation_status = COALESCE(
      public.reports.moderation_status,
      'pending'::text
    ),
    workflow_status = COALESCE(
      public.reports.workflow_status,
      'received'::text
    )
  WHERE public.reports.city_id IS NULL
     OR public.reports.occurred_at IS NULL
     OR public.reports.moderation_status IS NULL
     OR public.reports.workflow_status IS NULL
     OR (
       public.reports.address_text IS NULL
       AND public.reports.address IS NOT NULL
     );

  SELECT pg_catalog.count(*)
  INTO report_count_after
  FROM public.reports;

  IF report_count_after IS DISTINCT FROM report_count_before THEN
    RAISE EXCEPTION 'Report preservation validation failed';
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
    RAISE EXCEPTION 'Report backfill validation failed';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

COMMIT;
