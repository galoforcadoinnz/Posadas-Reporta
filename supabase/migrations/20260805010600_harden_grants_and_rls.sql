-- Objetivo: aplicar RLS objetivo y mínimo privilegio a los roles públicos y
-- retirar el acceso directo de service_role hasta que Fase 2 defina operaciones
-- administrativas concretas.
-- Precondiciones: tablas, triggers, constraints y funciones de Fase 1B existen;
-- las políticas inventariadas conservan sus nombres originales.
-- Postcondiciones: anon y authenticated solo leen catálogos activos e insertan
-- las columnas públicas del reporte; reports e historial no tienen lectura
-- pública ni privilegios sobre columnas internas; service_role no conserva
-- privilegios directos sobre las cinco tablas de Fase 1B.
-- Reversión: el SQL comentado al final restaura temporalmente los privilegios
-- excesivos inventariados. La reversión vuelve a habilitar capacidades
-- peligrosas, incluido TRUNCATE, que no está protegido por RLS.
-- Objetos afectados: RLS, políticas y grants de las cinco tablas públicas.
-- No se modifican grants de postgres.

BEGIN;

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active cities"
ON public.cities
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Public can read active subcategories"
ON public.subcategories
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id = public.subcategories.category_id
      AND public.categories.is_active = true
  )
);

ALTER POLICY "Public can create pending reports"
ON public.reports
TO anon, authenticated
WITH CHECK (
  status = 'pending'::text
  AND urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])
  AND moderation_status = 'pending'::text
  AND workflow_status = 'received'::text
  AND tracking_code IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.cities
    WHERE public.cities.id = public.reports.city_id
      AND public.cities.is_active = true
  )
  AND EXISTS (
    SELECT 1
    FROM public.categories
    WHERE public.categories.id = public.reports.category_id
      AND public.categories.is_active = true
  )
  AND (
    subcategory_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.subcategories
      WHERE public.subcategories.id = public.reports.subcategory_id
        AND public.subcategories.category_id = public.reports.category_id
        AND public.subcategories.is_active = true
    )
  )
);

REVOKE ALL PRIVILEGES
ON TABLE
  public.cities,
  public.categories,
  public.subcategories,
  public.report_status_history
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.reports
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE
  public.cities,
  public.categories,
  public.subcategories,
  public.reports,
  public.report_status_history
FROM service_role;

GRANT SELECT
ON TABLE
  public.cities,
  public.categories,
  public.subcategories
TO anon, authenticated;

GRANT INSERT (
  category_id,
  subcategory_id,
  description,
  latitude,
  longitude,
  address,
  urgency,
  status
)
ON TABLE public.reports
TO anon, authenticated;

COMMIT;

-- Verificación requerida después de aplicar en staging:
-- 1. anon y authenticated leen únicamente cities/categories/subcategories.
-- 2. ambos roles insertan un reporte válido usando solo las ocho columnas
--    públicas y sin SELECT posterior.
-- 3. SELECT, UPDATE, DELETE y TRUNCATE sobre reports fallan.
-- 4. INSERT sobre id, tracking_code, city_id, timestamps, address_text,
--    occurred_at, moderation_status y workflow_status falla.
-- 5. report_status_history no permite acceso público.
-- 6. service_role no tiene privilegios directos sobre las cinco tablas.
-- 7. el frontend mantiene la carga de categorías y el envío sin retorno de fila.
--
-- SQL DE REVERSIÓN DE EMERGENCIA — NO EJECUTAR SIN APROBACIÓN EXPLÍCITA.
-- Esta reversión vuelve a habilitar privilegios peligrosos y debe utilizarse
-- únicamente dentro de una transacción controlada y con respaldo verificado.
--
-- GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE
-- ON TABLE public.categories
-- TO anon, authenticated;
--
-- GRANT INSERT, REFERENCES, TRIGGER, TRUNCATE
-- ON TABLE public.reports
-- TO anon, authenticated;
--
-- GRANT REFERENCES, TRIGGER, TRUNCATE
-- ON TABLE public.subcategories
-- TO anon, authenticated;
