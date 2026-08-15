# Fase 2 — Envío público seguro de reportes

**Estado:** migración aditiva y Edge Function v2 validadas en staging; corte
RLS, límites geográficos y frontend de staging pendientes

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
debe usar un widget propio restringido a su hostname definitivo.

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

## Geografía y bloqueo de staging

Fuente oficial consultada el 6 de agosto de 2026:

- Mapoteca de la Secretaría de Planificación Estratégica y Territorial de la
  Municipalidad de Posadas:
  `https://posadas.gov.ar/planurbano/mapoteca/`.

La fuente publica mapas base, subdivisiones y archivos editables, pero no se
encontró un rectángulo georreferenciado verificable que pueda copiarse sin
interpretación cartográfica. Los cuatro límites quedan en `NULL` y la RPC
responde `CITY_REPORTING_BOUNDS_UNAVAILABLE`.

Este es un bloqueo deliberado para staging. Antes de habilitar envíos se
debe obtener el archivo municipal georreferenciado, documentar su sistema de
referencia, convertirlo a WGS84/EPSG:4326, calcular su envolvente y revisar los
cuatro extremos. No se aceptan coordenadas aproximadas.

## Migraciones y corte

1. `20260815053645_enable_pg_cron.sql`: habilita y valida Supabase Cron sin
   programar trabajos todavía.
2. `20260815054156_create_secure_report_submission.sql`: RPC, idempotencia,
   rate limiting, limpieza y límites configurables. Conserva temporalmente el
   INSERT heredado para probar la función.
3. `20260815054157_disable_direct_report_inserts.sql`: revoca el INSERT de
   `anon` y `authenticated`, elimina exclusivamente la política heredada y
   retira el fallback fijo de Posadas.

La tercera migración contiene `DROP POLICY`. No elimina filas ni columnas. La
alternativa es una política dormida detrás de grants revocados, pero deja una
capacidad latente. Antes de aplicarla se requiere backup del esquema, inventario
de grants/políticas y aprobación explícita del SQL completo.

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
3. Completado: secretos de canary y `submit-report` v2 desplegados.
4. Completado: CORS, `apikey`, anti-spoofing, límite corporal y cierre sin datos.
5. Pendiente: hostname aislado y widget Turnstile real de staging.
6. Pendiente: cargar y revisar límites oficiales.
7. Pendiente: probar Turnstile, RPC, idempotencia, cuota y respuesta extremos.
8. Pendiente: mostrar y aprobar la migración de corte.
9. Pendiente: aplicar el corte y desplegar el frontend.
10. Pendiente: ejecutar SQL, E2E y pruebas manuales finales.
11. Pendiente: confirmar que no existe tráfico directo a `reports`.

Producción requiere otro plan, backup, ventana y aprobación.
