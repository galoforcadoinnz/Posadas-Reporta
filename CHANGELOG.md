# Changelog

Todos los cambios relevantes de Posadas Reporta se documentan en este archivo.

## [Unreleased]

### Fase 2 — Envío público seguro (implementación local)

#### Agregado

- Edge Function con validación explícita de clave publicable, CORS por entorno,
  lectura limitada del cuerpo y validación estricta.
- Turnstile mediante Siteverify con acción, hostname e idempotency key.
- RPC de mínimo privilegio que devuelve únicamente tracking, fecha y estado.
- Idempotencia con huella canónica y control de concurrencia.
- Rate limiting atómico con ventanas móviles de 15 minutos y 24 horas.
- Limpieza programada de HMAC vencidos después de 48 horas.
- Pantalla de confirmación y suites Deno, React, SQL y E2E locales.
- Integración local del handler Edge con la RPC PostgreSQL real mediante un
  contenedor efímero, sin montar el repositorio ni usar servicios remotos.
- Envolvente WGS84 versionada para Posadas a partir del GeoJSON oficial de
  municipios de Datos Argentina/IGN.
- Staging gratuito en Cloudflare Pages y widget Turnstile restringido a su
  hostname.

#### Seguridad

- La IP no se almacena; solo se persiste un HMAC-SHA-256 estable.
- En Supabase hosted la IP se toma exclusivamente de `cf-connecting-ip`; se
  ignora `x-forwarded-for` para impedir que el cliente falsifique la identidad
  de cuota. El proxy local requiere habilitación explícita.
- La IP se canonicaliza, se rechazan valores ausentes o ambiguos y el pepper
  exige al menos 32 bytes.
- Los reintentos confirmados conservan su comprobante aunque cambie después la
  configuración de ciudad o catálogo.
- `service_role` conserva cero privilegios directos de tabla.
- La migración de corte elimina la vía pública directa sin habilitar SELECT.
- Los límites geográficos usan una envolvente rectangular oficial; se documenta
  que puede incluir pequeñas áreas exteriores al multipolígono municipal.
- El prerrequisito `pg_cron`, la migración RPC aditiva, los límites,
  `submit-report` v3 y un canary real con Turnstile se validaron en el staging
  dedicado `ftpnmjshhzowbmdgbpkr`. No se aplicó el corte RLS ni se accedió a
  producción.
- Se aplicó exclusivamente en staging una migración progresiva que conserva el
  event trigger de RLS y revoca la ejecución directa de
  `public.rls_auto_enable()` a roles cliente y `service_role`; el advisor
  0028/0029 y un canary real quedaron validados.
- El archivo local del hardening replica la versión y el nombre exactos del
  ledger remoto; el único timestamp deliberadamente pendiente en staging es el
  cutover RLS.

### Fase 1B — Base de datos versionada

#### Agregado

- Baseline protegida para reconstruir exclusivamente bases vacías.
- Migraciones aditivas para ciudades, tracking, estados separados e historial.
- Backfill que conserva los reportes existentes y sus columnas heredadas.
- Integridad de coordenadas y de la relación categoría–subcategoría.
- Generación PostgreSQL de tracking con 80 bits, reintentos y unicidad.
- Triggers separados para valores iniciales, tracking y `updated_at`.
- Hardening local de grants y políticas RLS, con `INSERT` público limitado a
  las ocho columnas consumidas por el frontend, `service_role` sin privilegios
  directos de tabla y reversión documentada.
- Seed idempotente que preserva el catálogo inventariado.
- Pruebas SQL transaccionales para entornos locales o staging descartable.
- Documentación de rutas separadas para baseline y upgrade.
- Validación completa realizada el 5 de agosto de 2026 en el staging autorizado
  `ftpnmjshhzowbmdgbpkr`, sobre el commit SQL
  `fd0fe336601265cb2538ac04b757a6bde6c1f2f7`: baseline, siete migraciones,
  seed y suite SQL aprobados.

#### Seguridad

- No se agregó lectura pública de `reports` ni consulta pública por tracking.
- Las funciones auxiliares no son invocables directamente por roles públicos.
- No se modificaron `.env.local`, autenticación ni frontend.
- La producción protegida `xouoxuoueutukemaqjro` no fue accedida ni modificada.
- La Fase 2 con validación de servidor y controles antiabuso continúa siendo
  obligatoria antes de cualquier aplicación en producción.

#### Cambiado

- El prototipo ejecutable heredado `posadas_reporta.html` se eliminó del árbol
  actual. Su contenido continúa disponible únicamente en el historial Git y no
  forma parte de la aplicación Vite ni del despliegue actual.

### Estabilización del MVP 0.2

#### Agregado

- Modelo compartido `ReportDraft` para centralizar el reporte en curso.
- Tipos compartidos para ubicación, pasos y urgencia.
- Validación por nombre de las variables de entorno requeridas.
- Estados accesibles de carga de geolocalización, validación y error de envío.
- Reglas permanentes de desarrollo y seguridad en `AGENTS.md`.
- Documentación específica del proyecto en `README.md`.

#### Cambiado

- El borrador se conserva al avanzar y volver entre pasos.
- Los valores internos de urgencia se unificaron en `low`, `medium` y `high`.
- La categoría y ubicación seleccionadas se restauran al regresar a sus pasos.
- La previsualización informa que la fotografía todavía no se guarda.
- La previsualización local utiliza lectura asíncrona sin object URLs.
- Los errores visibles ya no incluyen detalles técnicos de Supabase.
- El envío bloquea acciones repetidas mientras está en curso.
- La creación de reportes ya no depende de un `SELECT` posterior al `INSERT`.
- Se completaron los estilos del paso de categorías y estados del flujo.
- El documento HTML declara idioma español y el nombre correcto del proyecto.

#### Eliminado

- Tipos `Category` duplicados en componentes.
- Componente temporal `CategoriesTest`.
- CSS y recursos sin uso identificados en la primera limpieza del template.
- Fugas asociadas a `URL.createObjectURL` en la previsualización.

#### Seguridad

- `.env.local` permanece ignorado y fuera de Git.
- No se modificaron RLS, tablas, datos ni configuración remota de Supabase.
- No se ejecutó SQL ni se publicó en producción.

#### Pendiente

- Protección antiabuso y validación de servidor antes de producción.
- Migraciones Supabase versionadas y aislamiento multi-ciudad.
- Almacenamiento privado y validación de fotografías.
- Pruebas automatizadas.
- Sustitución de recursos restantes del template y del CDN de marcadores.
- Revisión del tamaño del bundle de producción.
