# Plan controlado de producción — Fase 2

**Estado:** borrador operativo; no autorizado para ejecución

**Base revisada:** `main` en `e752795`

**Última validación de staging:** 15 de agosto de 2026

## 1. Objetivo y límites

Este documento define los gates para llevar el envío seguro de reportes desde
staging a producción. Preparar o aprobar este plan no autoriza acceso, SQL,
secretos, despliegues, DNS, datos de prueba ni cambios de configuración en
producción.

Reglas obligatorias:

- una persona opera y otra revisa la evidencia;
- cada escritura remota requiere aprobación explícita y específica;
- todo SQL debe mostrarse completo antes de ejecutarse;
- no se usa la baseline sobre una base existente;
- no se ejecuta `db reset --linked`, `--include-seed` ni un reset equivalente;
- no se usa `migration repair` sin demostrar primero que el esquema real y el
  ledger difieren únicamente en el registro indicado;
- nunca se imprimen secretos, conexiones, IP, descripciones ni coordenadas;
- ante duda, el flujo público permanece bloqueado y se corrige hacia adelante.

## 2. Estado ya demostrado

Staging validó la cadena Turnstile → Edge Function → RPC → PostgreSQL, el
tratamiento de IP mediante HMAC, las dos ventanas de rate limiting, la limpieza
con `pg_cron`, la idempotencia y el rechazo del INSERT directo. El ledger local
y el de staging coinciden en doce timestamps.

El commit de integración `e752795` superó los seis checks de `main`. Esto es
evidencia de calidad de la versión candidata, no evidencia del estado actual de
producción.

## 3. Responsables y ventana

Antes de solicitar acceso se registran:

- responsable de negocio que autoriza la apertura pública;
- operador de Supabase;
- revisor técnico independiente;
- responsable de Cloudflare, DNS y Turnstile;
- contacto y canal de incidentes;
- inicio y fin de la ventana;
- RPO y RTO aceptados;
- criterio para abortar antes del cutover.

Durante la ventana se congela `main`. No se mezclan correcciones ajenas y una
sola persona ejecuta migraciones.

## 4. Gate P0 — paquete local inmutable

Condiciones:

1. seleccionar un commit o tag exacto basado en `e752795` o posterior;
2. ejecutar desde cero:

   ```bash
   npm ci
   npm run build
   npm run lint
   npm run test:unit
   npm run test:e2e
   deno task --config supabase/deno.json check
   bash supabase/tests/run_local_database_tests.sh
   ```

3. registrar SHA-256 de las doce migraciones y de la Edge Function;
4. comprobar que el SQL del cutover conserva identidad con el validado en
   staging;
5. confirmar que GitHub Actions no contiene un job de despliegue productivo;
6. adjuntar resultados sin secretos ni datos de reportes.

Resultado: candidato reproducible. No habilita acceso remoto.

## 5. Gate P1 — inventario productivo de solo lectura

Requiere una autorización independiente que identifique el proyecto exacto y
permita únicamente lecturas. El operador debe obtener:

- estado, región y versión de PostgreSQL;
- configuración de exposición del Data API;
- ledger completo de migraciones;
- tablas, columnas, constraints, índices y conteos agregados;
- RLS, políticas, grants, propietarios y privilegios por columna;
- funciones, firmas, `SECURITY DEFINER/INVOKER`, `search_path` y ACL;
- triggers y event triggers;
- extensiones disponibles, incluida `pg_cron`;
- jobs de cron existentes y sus nombres, sin alterar ninguno;
- Edge Functions existentes y sus versiones;
- nombres de secretos requeridos presentes o ausentes, nunca sus valores;
- configuración de Cloudflare Pages, rama productiva y despliegues automáticos;
- hostname final, estado de DNS y widget Turnstile previsto.

Se comparan invariantes y schema con el inventario versionado. No se consulta
contenido de reportes, IP, descripciones, fotografías ni coordenadas.

### Condición de detención

Si el ledger no coincide con el esquema, si hay objetos desconocidos o si un
`db push --dry-run` propone más archivos que el grupo aprobado, se detiene el
rollout. Primero se documenta la divergencia y se abre una corrección separada.

## 6. Gate P2 — backup verificable

Antes de cualquier escritura:

- confirmar la política de backups disponible en el plan contratado;
- generar un backup lógico de esquema y datos por un canal autorizado;
- cifrarlo, limitar acceso, registrar tamaño, timestamp y SHA-256;
- restaurarlo en PostgreSQL local o en un entorno descartable aislado;
- verificar conteos, claves foráneas y capacidad de recuperar `reports`;
- registrar ubicación, retención, responsable y procedimiento de borrado;
- confirmar RPO/RTO con el responsable de negocio.

Un backup no restaurado no cuenta como backup verificado. Los dumps no se
agregan al repositorio y no se copian a conversaciones o logs.

## 7. Gate P3 — configuración productiva separada

### Supabase Edge Function

Los secretos se cargan por canal seguro y por nombre:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEYS`;
- `SUPABASE_SECRET_KEYS`;
- `ALLOWED_ORIGINS` con el origen HTTPS productivo exacto;
- `TURNSTILE_SECRET_KEY`;
- `TURNSTILE_ALLOWED_HOSTNAMES` con el hostname productivo exacto;
- `TURNSTILE_EXPECTED_ACTION=submit_report`;
- `RATE_LIMIT_PEPPER` aleatorio y exclusivo de producción, mínimo 32 bytes.

`TRUST_LOCAL_PROXY_HEADERS` debe estar ausente o ser falso en hosted. No se
reutilizan secretos de staging y nunca se expone `service_role` en Vite.

### Cloudflare Pages y Turnstile

- usar un proyecto o entorno de Pages claramente identificado como producción;
- confirmar qué rama es productiva;
- mantener desactivado el despliegue automático hasta completar el gate P7;
- crear un widget Turnstile separado, restringido al hostname productivo;
- no autorizar comodines, `localhost`, `127.0.0.1` ni el hostname de staging;
- configurar en frontend sólo la sitekey pública;
- conservar el secret exclusivamente en la Edge Function;
- verificar que backend valide `success`, `action` y `hostname`.

## 8. Gate P4 — estrategia de migraciones

El inventario determina qué migraciones están realmente pendientes. La baseline
`supabase/baseline/00000000000000_current_schema.sql` nunca se aplica a una
base existente.

Orden canónico:

1. `20260805010100_create_cities.sql`
2. `20260805010200_add_report_growth_columns.sql`
3. `20260805010300_backfill_existing_reports.sql`
4. `20260805010400_add_report_integrity_indexes_and_triggers.sql`
5. `20260805010500_create_report_status_history.sql`
6. `20260805010600_harden_grants_and_rls.sql`
7. `20260805010700_seed_global_categories.sql`
8. `20260815053645_enable_pg_cron.sql`
9. `20260815054156_create_secure_report_submission.sql`
10. `20260815184117_configure_posadas_reporting_bounds.sql`
11. `20260815190312_20260815185725_restrict_rls_auto_enable_execute.sql`
12. `20260815193128_20260815054157_disable_direct_report_inserts.sql`

### Separación obligatoria

Las migraciones 1–11 forman la etapa preparatoria. La migración 12 es el
cutover irreversible operacionalmente: no borra datos, pero elimina la política
heredada y revoca la inserción directa.

`supabase db push` aplica todas las migraciones pendientes. Por eso no puede
usarse de forma genérica si el dry-run incluye la migración 12 durante la etapa
preparatoria. Después del inventario se debe documentar y probar localmente un
mecanismo que preserve los timestamps y aplique sólo el grupo autorizado. No
se improvisa moviendo archivos, editando el ledger ni ejecutando SQL desde el
panel.

Cada grupo requiere:

- SQL completo mostrado;
- dry-run o manifiesto exacto;
- aprobación específica;
- una única ejecución;
- postcondiciones y advisors antes de continuar.

## 9. Gate P5 — etapa preparatoria de base de datos

Con autorización explícita se aplican únicamente las migraciones pendientes del
grupo 1–11. Después de cada bloque se verifican:

- conteos e invariantes originales;
- RLS activo en todas las tablas expuestas;
- ausencia de lectura pública de reportes;
- grants mínimos;
- RPC `submit_report_v1` ejecutable sólo por `service_role`;
- trigger y funciones auxiliares con ACL y `search_path` esperados;
- idempotencia y constraints;
- `pg_cron` activo con un único job de limpieza;
- límites geográficos de Posadas;
- advisors de seguridad y rendimiento.

El INSERT heredado permanece disponible sólo durante esta etapa y por el menor
tiempo posible. No se habilita todavía el frontend público.

## 10. Gate P6 — Edge Function y canary cerrado

1. cargar secretos productivos sin imprimir valores;
2. desplegar la versión exacta de `submit-report` desde el commit candidato;
3. verificar CORS permitido y denegado;
4. verificar límite del cuerpo, método HTTP y `apikey`;
5. probar rechazo de Turnstile inválido, action incorrecta y hostname ajeno;
6. habilitar un frontend canary no público sobre el hostname productivo;
7. enviar un único reporte técnico sin datos personales ni fotografía;
8. verificar un reporte, un `submission_id` y un evento de rate limiting;
9. probar reintento con la misma idempotency key y doble envío concurrente;
10. revisar logs redactados y confirmar ausencia de IP o payload sensible.

Si falla cualquier punto, se revierte la versión de frontend/Edge Function y
se mantiene cerrado el acceso público. No se avanza al cutover.

## 11. Gate P7 — cutover RLS

Requiere una nueva autorización que nombre explícitamente la migración 12 y
acepte `DROP POLICY` y los `REVOKE` incluidos.

Antes de ejecutarla:

- confirmar backup y canary vigentes;
- volver a inventariar política y grants que eliminará;
- mostrar el SQL completo;
- confirmar que la Edge Function productiva responde correctamente;
- bloquear cambios paralelos.

Después:

- confirmar que la política heredada no existe;
- confirmar que `anon` y `authenticated` no poseen INSERT de tabla ni columna;
- ejecutar pruebas negativas transaccionales con ambos roles;
- confirmar que sólo `service_role` ejecuta la RPC;
- repetir advisors;
- repetir el canary completo y correlacionar sólo tracking y estados.

No se restauran grants directos como rollback. Si la ruta segura falla después
del cutover, se muestra mantenimiento y se corrige hacia adelante.

## 12. Gate P8 — apertura pública

La apertura requiere aprobación del responsable de negocio y evidencia de los
gates anteriores.

- habilitar el despliegue productivo controlado del frontend;
- verificar TLS, DNS, CORS y Turnstile desde el hostname final;
- ejecutar smoke test sin fotografía;
- comprobar accesibilidad móvil y mensajes de error;
- confirmar que no hay `POST /rest/v1/reports` desde el navegador;
- verificar que staging y producción usan claves y widgets distintos;
- publicar política de privacidad y aviso de no emergencia.

No se habilita todavía publicación pública de reportes, fotografías ni lectura
por tracking.

## 13. Monitoreo y criterios de abortar

Durante la primera hora revisar cada 5–10 minutos y luego a 24 y 48 horas:

- tasa de éxito y distribución de códigos HTTP de la Edge Function;
- errores de Turnstile por código, action y hostname;
- rechazos de rate limiting y tamaño de la tabla de eventos;
- duración y resultado del job de limpieza;
- latencia y errores de la RPC;
- duplicados por `submission_id`;
- advisors y cambios inesperados de grants/RLS.

No registrar IP, token Turnstile, descripción, coordenadas, fotografía, claves o
respuesta completa del backend.

Se aborta la apertura si existe pérdida o duplicación de datos, bypass del
cutover, exposición de secretos, CORS amplio, hostname inválido aceptado,
errores sostenidos o imposibilidad de observar el sistema.

## 14. Matriz de recuperación

| Incidente | Respuesta segura |
| --- | --- |
| Falla una migración transaccional | detener; verificar rollback; no reintentar manualmente sin diagnóstico |
| Edge Function falla antes del cutover | volver a la versión anterior y mantener frontend cerrado |
| Frontend falla | revertir el despliegue de Pages; no tocar la base |
| Turnstile o CORS falla | mantener cerrado; corregir secretos/orígenes con aprobación |
| Ruta segura falla después del cutover | mostrar mantenimiento y corregir Edge/RPC hacia adelante |
| Inserción directa sigue disponible | detener apertura; inventariar grants/políticas y corregir antes de continuar |
| Datos o secretos expuestos | cerrar el flujo, preservar evidencia y activar respuesta a incidentes |

Restaurar un backup es una decisión extraordinaria porque puede perder cambios
posteriores al punto restaurado. Requiere evaluación de impacto y autorización
separada; nunca es la respuesta automática a un fallo de despliegue.

## 15. Evidencia de cierre

El rollout se considera aprobado cuando existe un paquete sin secretos con:

- commit/tag y hashes;
- responsables y ventana;
- inventario antes/después;
- comprobante de backup restaurado;
- migraciones aplicadas y ledger final;
- advisors antes/después;
- versiones de Edge Function y frontend;
- hostname y widget utilizados, sin secretos;
- tracking del canary controlado;
- checks de idempotencia, concurrencia y bloqueo directo;
- métricas de la primera hora;
- decisión firmada de continuar o revertir apertura.

## 16. Aprobaciones independientes requeridas

1. inventario productivo de solo lectura;
2. creación/verificación del backup;
3. configuración de secretos, Pages y Turnstile;
4. aplicación del grupo preparatorio de migraciones;
5. despliegue de Edge Function y frontend canary;
6. ejecución de un reporte canary;
7. aplicación explícita del cutover RLS;
8. apertura del frontend público;
9. cualquier restauración, rotación de claves o respuesta a incidente.

Ninguna aprobación se hereda automáticamente al gate siguiente.

## 17. Referencias operativas

- [Supabase: migraciones de base de datos](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI: `db push`](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase: despliegue de Edge Functions](https://supabase.com/docs/guides/functions/deploy)
- [Supabase: base de datos y backups](https://supabase.com/docs/guides/database/overview)
- [Cloudflare Pages: control de ramas](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [Cloudflare Turnstile: hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
