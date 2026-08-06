-- Objetivo: agregar de forma compatible las columnas que preparan reports
-- para multi-ciudad, seguimiento público y estados separados.
-- Precondiciones: public.reports y public.cities existen; las columnas nuevas
-- todavía no existen.
-- Postcondiciones: las seis columnas nuevas existen y permanecen anulables
-- hasta completar el backfill y validar restricciones; las inserciones
-- públicas permanecen bloqueadas hasta 20260805010600.
-- Reversión: conservar las columnas sin utilizarlas. No se propone eliminarlas.
-- Objetos afectados: public.reports.

BEGIN;

REVOKE INSERT
ON TABLE public.reports
FROM anon, authenticated;

ALTER TABLE public.reports
  ADD COLUMN tracking_code text,
  ADD COLUMN city_id uuid,
  ADD COLUMN address_text text,
  ADD COLUMN occurred_at timestamp with time zone,
  ADD COLUMN moderation_status text,
  ADD COLUMN workflow_status text;

COMMIT;
