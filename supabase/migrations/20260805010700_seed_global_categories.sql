-- Objetivo: reproducir el catálogo global de categorías inventariado en Fase
-- 1A conservando sus UUID y metadatos exactos.
-- Precondiciones: public.categories existe; el catálogo privado fue revisado y
-- no contiene datos personales ni secretos.
-- Postcondiciones: las ocho categorías esperadas existen y todos sus campos
-- coinciden exactamente. Las filas existentes nunca se actualizan.
-- Reversión: conservar las categorías. No se propone borrar datos del catálogo.
-- Objetos afectados: public.categories. No se crean subcategorías.

BEGIN;

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
INSERT INTO public.categories (
  id,
  name,
  description,
  icon,
  is_active,
  created_at
)
SELECT
  expected_categories.id,
  expected_categories.name,
  expected_categories.description,
  expected_categories.icon,
  expected_categories.is_active,
  expected_categories.created_at
FROM expected_categories
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories
  WHERE public.categories.id = expected_categories.id
)
ON CONFLICT (id) DO NOTHING;

DO $migration$
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
END;
$migration$ LANGUAGE plpgsql;

COMMIT;
