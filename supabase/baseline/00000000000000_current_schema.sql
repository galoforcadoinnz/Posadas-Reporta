-- BASELINE PARA BASES VACÍAS.
-- NO EJECUTAR SOBRE EL PROYECTO REMOTO EXISTENTE.
-- PROJECT REF PROTEGIDO: xouoxuoueutukemaqjro.
--
-- Objetivo: reconstruir el esquema lógico confirmado al finalizar la Fase 1A.
-- Precondiciones: base Supabase vacía con los roles postgres, anon,
-- authenticated y service_role disponibles.
-- Postcondiciones: existen categories, subcategories y reports con sus
-- constraints, RLS, políticas y grants inventariados.
-- Reversión: descartar exclusivamente la base local vacía. Esta baseline no
-- define una reversión destructiva y nunca debe aplicarse a una base existente.
-- Objetos afectados: public.categories, public.subcategories, public.reports.
--
-- Esta baseline reproduce temporalmente los grants públicos excesivos
-- inventariados. Las migraciones posteriores aplican mínimo privilegio.
-- No contiene datos ni invoca automáticamente ninguna migración.

BEGIN;

CREATE TABLE public.categories (
  id uuid DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

ALTER TABLE public.categories OWNER TO postgres;

CREATE TABLE public.subcategories (
  id uuid DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  CONSTRAINT subcategories_pkey PRIMARY KEY (id),
  CONSTRAINT subcategories_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE CASCADE
);

ALTER TABLE public.subcategories OWNER TO postgres;

CREATE TABLE public.reports (
  id uuid DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  updated_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  category_id uuid NOT NULL,
  subcategory_id uuid,
  description text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  urgency text DEFAULT 'medium'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id),
  CONSTRAINT reports_subcategory_id_fkey
    FOREIGN KEY (subcategory_id)
    REFERENCES public.subcategories(id),
  CONSTRAINT reports_urgency_check
    CHECK (urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  CONSTRAINT reports_status_check
    CHECK (
      status = ANY (
        ARRAY[
          'pending'::text,
          'in_review'::text,
          'referred'::text,
          'in_progress'::text,
          'resolved'::text,
          'rejected'::text,
          'duplicate'::text
        ]
      )
    )
);

ALTER TABLE public.reports OWNER TO postgres;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Public can create pending reports"
ON public.reports
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'::text
  AND urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])
);

GRANT SELECT, REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.categories
TO anon, authenticated;

GRANT REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.categories
TO service_role;

GRANT INSERT, REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.reports
TO anon, authenticated;

GRANT REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.reports
TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.subcategories
TO anon, authenticated, service_role;

COMMIT;
