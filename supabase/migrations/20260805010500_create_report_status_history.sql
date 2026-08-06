-- Objetivo: crear el historial separado de moderación y flujo operativo.
-- Precondiciones: public.reports existe con los checks de estados definitivos.
-- Postcondiciones: el historial admite únicamente transiciones coherentes y
-- reales; RLS está activa y no hay acceso público.
-- Reversión: conservar la tabla sin escribir en ella. No se propone eliminarla.
-- Objetos afectados: public.report_status_history.

BEGIN;

CREATE TABLE public.report_status_history (
  id uuid DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  report_id uuid NOT NULL,
  previous_moderation_status text,
  moderation_status text,
  previous_workflow_status text,
  workflow_status text,
  changed_by uuid,
  note text,
  created_at timestamp with time zone DEFAULT pg_catalog.now() NOT NULL,
  CONSTRAINT report_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT report_status_history_report_id_fkey
    FOREIGN KEY (report_id)
    REFERENCES public.reports(id)
    ON DELETE RESTRICT,
  CONSTRAINT report_status_history_previous_moderation_check
    CHECK (
      previous_moderation_status IS NULL
      OR previous_moderation_status = ANY (
        ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'sensitive'::text]
      )
    ),
  CONSTRAINT report_status_history_moderation_check
    CHECK (
      moderation_status IS NULL
      OR moderation_status = ANY (
        ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'sensitive'::text]
      )
    ),
  CONSTRAINT report_status_history_previous_workflow_check
    CHECK (
      previous_workflow_status IS NULL
      OR previous_workflow_status = ANY (
        ARRAY[
          'received'::text,
          'in_review'::text,
          'referred'::text,
          'in_progress'::text,
          'resolved'::text,
          'closed'::text
        ]
      )
    ),
  CONSTRAINT report_status_history_workflow_check
    CHECK (
      workflow_status IS NULL
      OR workflow_status = ANY (
        ARRAY[
          'received'::text,
          'in_review'::text,
          'referred'::text,
          'in_progress'::text,
          'resolved'::text,
          'closed'::text
        ]
      )
    ),
  CONSTRAINT report_status_history_moderation_pair_check
    CHECK (
      moderation_status IS NOT NULL
      OR previous_moderation_status IS NULL
    ),
  CONSTRAINT report_status_history_workflow_pair_check
    CHECK (
      workflow_status IS NOT NULL
      OR previous_workflow_status IS NULL
    ),
  CONSTRAINT report_status_history_moderation_changed_check
    CHECK (
      moderation_status IS NULL
      OR previous_moderation_status IS DISTINCT FROM moderation_status
    ),
  CONSTRAINT report_status_history_workflow_changed_check
    CHECK (
      workflow_status IS NULL
      OR previous_workflow_status IS DISTINCT FROM workflow_status
    ),
  CONSTRAINT report_status_history_real_change_check
    CHECK (
      moderation_status IS NOT NULL
      OR workflow_status IS NOT NULL
    )
);

ALTER TABLE public.report_status_history OWNER TO postgres;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX report_status_history_report_created_at_idx
ON public.report_status_history USING btree (report_id, created_at DESC);

COMMIT;
