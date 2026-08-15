-- Objetivo: habilitar reportes para Posadas mediante la envolvente WGS84 del
-- municipio publicada por Datos Argentina y provista por el IGN.
-- Fuente: https://infra.datos.gob.ar/georef/municipios.geojson
-- Entidad: Municipio Posadas, id 540119, fuente declarada IGN.
-- Recurso consultado: 2026-08-15; última modificación HTTP: 2023-12-06.
-- SHA-256 del recurso: 60efa80ef95a0c1c7429fdc15b6408c6a29846300e0c3833c96aa25810ab6d40.
-- Limitación: public.cities almacena una envolvente rectangular, no el
-- multipolígono; por lo tanto puede incluir áreas exteriores al municipio.
-- Precondiciones: Posadas está activa y sus cuatro límites siguen en NULL.
-- Postcondiciones: exactamente la ciudad Posadas tiene límites completos.
-- Reversión controlada: restaurar los cuatro campos a NULL únicamente si
-- todavía conservan exactamente estos valores y se decide volver a bloquear
-- envíos. No se incluye una reversión automática ni destructiva.

BEGIN;

DO $migration$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.cities
  SET
    reporting_min_latitude = (-27.5822986159999)::double precision,
    reporting_max_latitude = (-27.3242615789999)::double precision,
    reporting_min_longitude = (-56.0585472499999)::double precision,
    reporting_max_longitude = (-55.8426106539999)::double precision
  WHERE id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
    AND slug = 'posadas'::text
    AND is_active = true
    AND reporting_min_latitude IS NULL
    AND reporting_max_latitude IS NULL
    AND reporting_min_longitude IS NULL
    AND reporting_max_longitude IS NULL;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one active Posadas row with unconfigured bounds; updated %',
      updated_rows;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cities
    WHERE id = 'a03b4d86-3784-41ae-a264-a51441e0b397'::uuid
      AND reporting_min_latitude = (-27.5822986159999)::double precision
      AND reporting_max_latitude = (-27.3242615789999)::double precision
      AND reporting_min_longitude = (-56.0585472499999)::double precision
      AND reporting_max_longitude = (-55.8426106539999)::double precision
  ) THEN
    RAISE EXCEPTION 'Posadas reporting bounds verification failed';
  END IF;
END;
$migration$ LANGUAGE plpgsql;

COMMIT;
