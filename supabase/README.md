# Supabase — esquema versionado

Este directorio contiene inventario, baseline, migraciones y pruebas de la base
de datos de Posadas Reporta. Ningún archivo se aplica automáticamente al
proyecto remoto.

## Proyecto protegido

```text
xouoxuoueutukemaqjro
```

No ejecutar SQL remoto sin mostrar previamente el contenido completo, preparar
un respaldo y obtener aprobación explícita.

## Estructura

```text
supabase/
  baseline/    Reconstrucción del esquema anterior para bases vacías
  inventory/   Consultas reproducibles de solo lectura
  migrations/  Upgrade aditivo ordenado
  tests/       Pruebas SQL para local o staging descartable
```

El catálogo privado utilizado para el seed permanece fuera del repositorio.
Solo los valores revisados y versionados aparecen en la migración del seed.

## Ruta para una base local vacía

Aplicar manualmente y en este orden:

1. `baseline/00000000000000_current_schema.sql`.
2. Migraciones `20260805010100` a `20260805010600`.
3. Seed `20260805010700_seed_global_categories.sql`.
4. `tests/phase_1b_database.sql`.

La baseline no debe utilizarse si ya existe cualquiera de las tablas
inventariadas.

## Ruta para una base existente

Esta ruta requiere una ventana de mantenimiento y un backup verificado.

1. Crear y verificar un backup de esquema y datos.
2. Registrar conteos e invariantes.
3. Revisar el SQL completo.
4. Iniciar la ventana de mantenimiento.
5. Aplicar únicamente los archivos de `migrations` en orden.
6. Ejecutar las pruebas en staging.
7. Verificar el frontend.
8. Solicitar una aprobación independiente antes de producción.

La baseline no participa en esta ruta.

`20260805010200` revoca temporalmente `INSERT` sobre `public.reports` a `anon`
y `authenticated`. Las inserciones públicas permanecen bloqueadas hasta
`20260805010600`, que concede únicamente el `INSERT` por columnas. Si una
migración intermedia falla, la base permanece segura sin nuevas inserciones:
se debe corregir el fallo y continuar la cadena, nunca restaurar los privilegios
amplios anteriores.

## Separación obligatoria

No se proporciona un comando, script o tarea que combine ambas rutas. La
selección del procedimiento debe ser manual, explícita y revisada.

## Tracking e inserción pública

PostgreSQL genera códigos de 80 bits con
`extensions.gen_random_bytes(10)`. La inserción pública no tiene lectura
posterior y no existe una política pública `SELECT` sobre `reports`.

`20260805010100` comprueba que
`extensions.gen_random_bytes(integer)` exista antes de crear cualquier objeto;
`20260805010400` repite la comprobación como defensa adicional. Ninguna
migración instala, mueve ni modifica `pgcrypto`.

Fase 1B revoca todos los privilegios directos de `service_role` sobre las cinco
tablas versionadas. Aunque el rol conserva `BYPASSRLS`, no puede leer, escribir,
truncar ni administrar estas tablas sin una migración posterior explícita. Fase
2 deberá conceder únicamente los permisos que requiera la operación de servidor
aprobada. La Fase 2 local concede únicamente `EXECUTE` sobre
`submit_report_v1` y vuelve a revocar las funciones auxiliares de triggers.

La devolución limitada del tracking se implementa mediante las migraciones
`20260815053645`, `20260815054156`, `20260815184117`, `20260815190312` y
`20260815193128`, la función `submit-report` y la suite
`phase_2_database.sql`. El prerrequisito, la RPC, los límites, el hardening de
`rls_auto_enable()`, `submit-report` v3 y el corte RLS fueron aplicados y
validados exclusivamente en staging.

La migración `20260815053645` exige `pg_cron` disponible, lo instala en
`pg_catalog` y valida su API antes de continuar. La siguiente migración falla
antes de alterar objetos si no puede programar la limpieza. La migración
`20260815184117` configura la envolvente WGS84 del municipio Posadas a partir
del GeoJSON oficial de Datos Argentina/IGN y documenta la limitación del modelo
rectangular.

La migración
`20260815190312_20260815185725_restrict_rls_auto_enable_execute.sql` conserva
el event trigger de la plataforma y revoca únicamente la ejecución directa de
`public.rls_auto_enable()` a `PUBLIC`, `anon`, `authenticated` y
`service_role`. Verifica firma, propietario, `SECURITY DEFINER` y trigger activo
antes y después del cambio. El doble timestamp reproduce exactamente la versión
y el nombre registrados por el conector en el ledger de staging.

Los eventos de rate limiting viven en el esquema exclusivo
`posadas_reporta_private`; ningún rol público ni `service_role` tiene acceso
directo. La limpieza dispone de un índice propio por `created_at`.

La migración
`20260815193128_20260815054157_disable_direct_report_inserts.sql` revoca el
INSERT directo y elimina la política pública heredada. Fue mostrada, aprobada,
aplicada y validada exclusivamente en staging.

El ledger local replica las versiones `20260815190312` y `20260815193128`, con
los nombres `20260815185725_restrict_rls_auto_enable_execute` y
`20260815054157_disable_direct_report_inserts` registrados en staging. No se
usa `migration repair`: el historial remoto conserva los registros reales
generados al aplicar ambas migraciones.

Las migraciones son de una sola ejecución y dependen del ledger de Supabase. Un
fallo transaccional se corrige hacia adelante; no se reejecutan manualmente
migraciones que el entorno ya registró como aplicadas.

## Pruebas

Las pruebas SQL terminan con `ROLLBACK`. Contienen intentos negativos de
`UPDATE`, `DELETE` y `TRUNCATE` ejecutados como rol público para demostrar que
son rechazados y verifican que `service_role` no tenga privilegios directos.
Nunca deben ejecutarse en producción.

La imagen PostgreSQL local no incluye la función administrada
`public.rls_auto_enable()` presente en Supabase Hosted. La suite carga una
fixture mínima que reproduce exclusivamente su firma y metadatos de seguridad
para probar la migración fail-closed; no replica su lógica de plataforma.

La regresión local completa se ejecuta con:

```bash
bash supabase/tests/run_local_database_tests.sh
```

El runner requiere Docker y Deno. Usa la imagen oficial de Supabase PostgreSQL fijada por digest,
levanta un contenedor descartable y envía cada SQL exclusivamente por stdin.
También verifica dos invocaciones PostgreSQL concurrentes con el mismo
`requestId` y ejecuta el handler Edge contra la RPC PostgreSQL real. El
transporte de integración usa `docker exec` sin shell y envía el SQL generado
por stdin. No monta el repositorio dentro del contenedor ni contiene una URL de
base de datos remota. La capa gateway/PostgREST queda fuera de esta prueba.

Si no hay Docker, Supabase CLI o un entorno local descartable, no debe
intentarse improvisar una ejecución contra el proyecto remoto.
