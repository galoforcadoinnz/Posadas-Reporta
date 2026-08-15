#!/usr/bin/env bash

set -euo pipefail

container_name="posadas-reporta-db-test-${GITHUB_RUN_ID:-local}-$$"
postgres_image="public.ecr.aws/supabase/postgres@sha256:3866d94d8426927e8db3f1c5d790752292bfbe27b5f1f46e199ae1b7d3c1710b"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
audit_tmp="$(mktemp -d)"

cleanup() {
  docker stop "${container_name}" >/dev/null 2>&1 || true
  rm -rf "${audit_tmp}"
}
trap cleanup EXIT

docker run --rm \
  --name "${container_name}" \
  --env POSTGRES_PASSWORD=local-database-test-only \
  --detach \
  "${postgres_image}" >/dev/null

ready_checks=0
for _attempt in $(seq 1 60); do
  if docker exec "${container_name}" pg_isready -U postgres >/dev/null 2>&1; then
    ready_checks=$((ready_checks + 1))
    if [ "${ready_checks}" -eq 3 ]; then
      break
    fi
  else
    ready_checks=0
  fi
  sleep 1
done

test "${ready_checks}" -eq 3
docker exec "${container_name}" pg_isready -U postgres >/dev/null

run_sql_file() {
  docker exec --interactive "${container_name}" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    <"${repository_root}/$1"
}

sql_files=(
  supabase/baseline/00000000000000_current_schema.sql
  supabase/migrations/20260805010100_create_cities.sql
  supabase/migrations/20260805010200_add_report_growth_columns.sql
  supabase/migrations/20260805010300_backfill_existing_reports.sql
  supabase/migrations/20260805010400_add_report_integrity_indexes_and_triggers.sql
  supabase/migrations/20260805010500_create_report_status_history.sql
  supabase/migrations/20260805010600_harden_grants_and_rls.sql
  supabase/migrations/20260805010700_seed_global_categories.sql
)

for sql_file in "${sql_files[@]}"; do
  run_sql_file "${sql_file}"
done

# La imagen local concede EXECUTE a service_role mediante un event trigger que
# no estaba activo en el staging donde se validó Fase 1B. Normalizamos ese ACL
# local para comprobar el estado objetivo de la fase sin editar migraciones ya
# aplicadas.
docker exec "${container_name}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  'REVOKE ALL PRIVILEGES ON FUNCTION public.prepare_report_initial_values(), public.generate_report_tracking_code(), public.set_updated_at() FROM service_role;'
run_sql_file supabase/tests/phase_1b_database.sql

docker exec "${container_name}" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION pg_cron;'

run_sql_file supabase/migrations/20260806010100_create_secure_report_submission.sql
run_sql_file supabase/migrations/20260806010200_disable_direct_report_inserts.sql

run_sql_file supabase/tests/phase_2_database.sql

deno_binary="${DENO_BIN:-deno}"
if ! command -v "${deno_binary}" >/dev/null 2>&1; then
  echo "Deno is required for the Edge-to-RPC integration test" >&2
  exit 1
fi

POSADAS_DATABASE_TEST_CONTAINER="${container_name}" "${deno_binary}" test \
  --config "${repository_root}/supabase/deno.json" \
  --allow-env=POSADAS_DATABASE_TEST_CONTAINER \
  --allow-run=docker \
  "${repository_root}/supabase/functions/integration/submit-report.database.test.ts"

docker exec "${container_name}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.cities SET reporting_min_latitude=-90, reporting_max_latitude=90, reporting_min_longitude=-180, reporting_max_longitude=180 WHERE slug='posadas';"

concurrent_sql="SELECT * FROM public.submit_report_v1('20000000-0000-4000-8000-00000000c001'::uuid, repeat('9',64), 'posadas', '2f51a29c-04e5-4b54-854b-180f2d252d64'::uuid, NULL, 'Prueba concurrente automatizada de Fase 2', -27.36, -55.90, 'medium');"

docker exec "${container_name}" psql -U postgres -d postgres -At -c "${concurrent_sql}" \
  >"${audit_tmp}/concurrent-1" &
first_pid=$!
docker exec "${container_name}" psql -U postgres -d postgres -At -c "${concurrent_sql}" \
  >"${audit_tmp}/concurrent-2" &
second_pid=$!
wait "${first_pid}"
wait "${second_pid}"
cmp "${audit_tmp}/concurrent-1" "${audit_tmp}/concurrent-2"

concurrent_counts="$(docker exec "${container_name}" psql -U postgres -d postgres -At -c \
  "SELECT (SELECT count(*) FROM public.reports WHERE submission_id='20000000-0000-4000-8000-00000000c001'::uuid), (SELECT count(*) FROM posadas_reporta_private.report_submission_rate_events WHERE submission_id='20000000-0000-4000-8000-00000000c001'::uuid);")"
test "${concurrent_counts}" = '1|1'
