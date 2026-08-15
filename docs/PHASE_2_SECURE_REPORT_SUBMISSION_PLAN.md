# Fase 2 — Envío público seguro de reportes

**Estado:** frontend, Turnstile, límites y Edge Function v3 validados en
staging; corte RLS pendiente

**Producción protegida:** `xouoxuoueutukemaqjro`

## Objetivo

Reemplazar el `INSERT` directo desde React por una Edge Function que valide
origen, entrada, Turnstile e IP confiable y que invoque una única RPC de mínimo
privilegio. La respuesta pública contiene exclusivamente `trackingCode`,
`createdAt` y `status: "received"`.

No se agrega lectura pública de reportes, consulta por tracking, fotografías,
autenticación, mapa público ni administración.

## Flujo y límites de confianza

```text
React + clave publicable
  → submit-report Edge Function
    → Siteverify de Cloudflare Turnstile
      → HMAC-SHA-256 de IP confiable
        → submit_report_v1 como service_role
          → PostgreSQL, triggers e integridad de Fase 1B
```

- CORS limita navegadores admitidos, pero no autentica.
- La función valida el header `apikey` contra las claves publicables configuradas.
- La secret key solo existe en el runtime de la Edge Function.
- `service_role` no recibe permisos directos sobre tablas; solo `EXECUTE` sobre
  `public.submit_report_v1`.
- La RPC es `SECURITY DEFINER`, propiedad de `postgres`, con `search_path = ''`
  y objetos calificados.

## Turnstile

La función llama siempre a Siteverify y exige `success = true`, acción
`submit_report` y un hostname de `TURNSTILE_ALLOWED_HOSTNAMES`. Envía el mismo
`requestId` como `idempotency_key` y la IP confiable como `remoteip`.

Cada invocación reinicia el widget. Las pruebas unitarias usan las claves
oficiales de prueba; ninguna clave real se versiona. En el runtime hospedado,
esas claves dummy devuelven `action = null` y `hostname = example.com`, por lo
que no pueden completar un canary que exige acción y hostname reales. Staging
usa un widget propio restringido a `posadas-reporta-staging.pages.dev`; sus
claves permanecen fuera del repositorio.

## IP y rate limiting

Cuando `SB_REGION` confirma Supabase hosted, la única fuente admitida es
`cf-connecting-ip`, que Cloudflare agrega como una dirección individual. La
función ignora `x-forwarded-for` porque puede conservar valores antepuestos por
el cliente. El canary verificó que una cabecera falsificada no cambia el flujo.
En local se requiere `TRUST_LOCAL_PROXY_HEADERS=true` y un único valor
sanitizado en `x-forwarded-for`; cualquier otro contexto falla cerrado.

La IP se canonicaliza y nunca se almacena. La Edge Function calcula un
HMAC-SHA-256 con separación de dominio y un `RATE_LIMIT_PEPPER` de al menos 32
bytes; PostgreSQL recibe 64 caracteres hexadecimales. La RPC
serializa cada HMAC y aplica ventanas móviles de 5 reportes en 15 minutos y 20
en 24 horas. Conteo, incremento, idempotencia e inserción son una transacción.

`pg_cron` elimina cada hora identificadores con más de 48 horas. La migración
de prerrequisito `20260815053645_enable_pg_cron.sql` instala la extensión en
`pg_catalog` mediante el procedimiento oficial de Supabase y comprueba
`cron.schedule(text,text,text)` y `cron.job`. La migración de la RPC repite esa
comprobación antes de alterar objetos. `PUBLIC`, `anon`, `authenticated` y
`service_role` no reciben `USAGE` sobre el esquema `cron`; solamente `postgres`
puede acceder al esquema y administrar los trabajos.

## Idempotencia

`reports.submission_id` es único. PostgreSQL calcula una huella SHA-256 del JSONB
canónico con ciudad, categoría, subcategoría, descripción normalizada,
coordenadas y urgencia.

- mismo `requestId` y contenido: mismo comprobante, sin nueva fila ni cuota;
- mismo `requestId` y contenido diferente: conflicto genérico;
- concurrencia: advisory lock y constraint `UNIQUE` preservan una fila.

El lookup por `submission_id` y la comparación de huella ocurren antes de
consultar configuración mutable. Un reporte confirmado conserva el mismo
comprobante aunque luego se desactive su ciudad o categoría o cambien límites.

## Geografía de staging

La migración `20260815184117_configure_posadas_reporting_bounds.sql` usa el
GeoJSON oficial de municipios publicado por Datos Argentina y provisto por el
Instituto Geográfico Nacional:

- recurso: `https://infra.datos.gob.ar/georef/municipios.geojson`;
- entidad: Municipio Posadas, id `540119`, geometría `MultiPolygon`;
- SHA-256 consultado el 15 de agosto de 2026:
  `60efa80ef95a0c1c7429fdc15b6408c6a29846300e0c3833c96aa25810ab6d40`;
- envolvente WGS84: latitud `-27.5822986159999` a
  `-27.3242615789999`; longitud `-56.0585472499999` a
  `-55.8426106539999`.

El esquema actual valida una envolvente rectangular, no el multipolígono. Esto
puede admitir pequeñas áreas exteriores al municipio y debe considerarse una
limitación explícita hasta incorporar validación poligonal, por ejemplo con
PostGIS. El cambio exige que los cuatro campos previos sean `NULL` y aborta si
no actualiza exactamente la fila activa y estable de Posadas.

## Migraciones y corte

1. `20260815053645_enable_pg_cron.sql`: habilita y valida Supabase Cron sin
   programar trabajos todavía.
2. `20260815054156_create_secure_report_submission.sql`: RPC, idempotencia,
   rate limiting, limpieza y límites configurables. Conserva temporalmente el
   INSERT heredado para probar la función.
3. `20260815184117_configure_posadas_reporting_bounds.sql`: registra la
   envolvente oficial revisada y habilita el flujo geográfico.
4. `20260815190312_20260815185725_restrict_rls_auto_enable_execute.sql`:
   restringe la ejecución directa del helper administrado de RLS.
5. `20260815193128_20260815054157_disable_direct_report_inserts.sql`: revoca
   el INSERT de `anon` y `authenticated` y elimina exclusivamente la política
   heredada. El doble timestamp reproduce la versión y el nombre registrados
   por el conector en staging.

La migración de corte contiene `DROP POLICY`. No elimina filas ni columnas. La
alternativa era una política dormida detrás de grants revocados, pero dejaba una
capacidad latente. Antes de aplicarla se verificaron el inventario de
grants/políticas y la aprobación explícita del SQL completo.

Si el corte falla, los envíos permanecen bloqueados y se corrige hacia adelante;
no se restauran automáticamente los grants públicos.

## Pruebas

- SQL: estructura, permisos, RPC, idempotencia, ambas ventanas móviles,
  limpieza y rechazo del INSERT directo.
- Deno: cuerpo streaming, tipos, campos desconocidos, IP, clave publicable,
  Turnstile, idempotency key, invocaciones simultáneas del handler y logs.
- React: servicio limitado y pantalla de comprobante.
- Playwright: flujo interceptado y ausencia de `POST /rest/v1/reports`.
- Integración local: handler Edge y mapeo de argumentos contra la RPC real en
  PostgreSQL efímero; el transporte de prueba usa `docker exec` y stdin.

La concurrencia real de PostgreSQL no pertenece al E2E interceptado. El runner
la ejecuta desde dos sesiones contra la base local descartable y comprueba un
único reporte y un único evento de cuota.

Las pruebas SQL y la integración usan exclusivamente el contenedor local
descartable creado por `supabase/tests/run_local_database_tests.sh`. Nunca se
ejecutan en producción.

Las migraciones versionadas son deliberadamente de una sola ejecución y dependen
del ledger de migraciones de Supabase; no deben reintentarse manualmente sobre
un esquema que ya las registró como aplicadas.

## Configuración de staging

Frontend pública:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_CITY_SLUG`;
- `VITE_TURNSTILE_SITE_KEY`.

Edge Function privada u operativa:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEYS` o fallback local `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEYS` o fallback heredado `SUPABASE_SERVICE_ROLE_KEY`;
- `ALLOWED_ORIGINS`;
- `TURNSTILE_SECRET_KEY`;
- `TURNSTILE_ALLOWED_HOSTNAMES`;
- `TURNSTILE_EXPECTED_ACTION=submit_report`;
- `RATE_LIMIT_PEPPER` con al menos 32 bytes aleatorios;
- `TRUST_LOCAL_PROXY_HEADERS=true` solo en local, nunca en hosted.

No se incluyen valores reales en el repositorio ni en comandos documentados.

## Estado y estrategia de staging

1. Completado: staging dedicado, inventario y Fase 1B verificados.
2. Completado: `pg_cron` y migración RPC aditiva aplicados.
3. Completado: secretos de canary y `submit-report` v3 desplegados.
4. Completado: CORS, `apikey`, anti-spoofing, límite corporal y cierre sin datos.
5. Completado: Cloudflare Pages y widget Turnstile restringidos al hostname de staging.
6. Completado: límites oficiales revisados y cargados mediante migración versionada.
7. Completado: canary real Turnstile → Edge Function → RPC, con una fila y un evento de cuota.
8. Completado: hardening progresivo de `rls_auto_enable()` aplicado y validado
   exclusivamente en staging; advisor 0028/0029 resuelto.
9. Completado: migración de corte mostrada y aprobada explícitamente.
10. Completado: corte aplicado exclusivamente en staging.
11. Completado: postcondiciones SQL y canary Turnstile posteriores al corte.
12. Completado: inserción directa rechazada para `anon` y `authenticated`.

El rollout productivo permanece sin autorizar y se rige por
`docs/PHASE_2_PRODUCTION_ROLLOUT_PLAN.md`, que exige inventario, backup,
ventana y aprobaciones independientes por gate.

## Gate previo al cutover

El inventario remoto de solo lectura del 15 de agosto de 2026 confirmó que:

- la política heredada `Public can create pending reports` continúa presente;
- `anon` y `authenticated` conservan `INSERT` por columnas sobre los ocho
  campos heredados, aunque no tengan `INSERT` de tabla;
- únicamente `service_role` puede ejecutar `submit_report_v1`;
- el job `posadas-reporta-rate-limit-cleanup` está activo con la expresión
  `23 * * * *` y conserva el comando de limpieza esperado;
- la migración de cutover revoca exactamente esa vía directa y elimina la
  política heredada.

El ledger local quedó alineado con staging. La versión remota del hardening es
`20260815190312` y la del cutover es `20260815193128`; sus nombres registrados
son `20260815185725_restrict_rls_auto_enable_execute` y
`20260815054157_disable_direct_report_inserts`, respectivamente. Los archivos
locales reproducen esas parejas de versión y nombre porque Supabase compara los
timestamps para determinar qué migraciones faltan.

El asesor de seguridad de Supabase detectó además que la función de soporte
`public.rls_auto_enable()` es `SECURITY DEFINER` y conserva el ACL implícito de
`PUBLIC`, por lo que aparece ejecutable por `anon` y `authenticated`. La función
es un event trigger de la plataforma, pero su exposición no es necesaria para
clientes. La migración progresiva
`20260815190312_20260815185725_restrict_rls_auto_enable_execute.sql` conserva
la función y el event trigger, valida sus metadatos y revoca `EXECUTE` a
`PUBLIC`, `anon`, `authenticated` y `service_role`. Fue aplicada y validada en
staging antes del cutover. El nombre local reproduce exactamente la versión y
el nombre guardados por el ledger remoto.

Los avisos `RLS enabled, no policy` sobre la tabla privada de rate limiting y
el historial de estados representan el diseño deny-by-default actual. Los dos
foreign keys sin índice de cobertura se registran como mejora de rendimiento
separada y no deben mezclarse con el corte de seguridad.
