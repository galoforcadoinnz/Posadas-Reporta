# Auditoría técnica — Posadas Reporta MVP 0.2

**Fecha:** 4 de agosto de 2026

**Alcance:** revisión estática del ZIP `posadas-reporta-auditoria.zip`

**Estado general:** prototipo funcional temprano, con una base válida, pero todavía no apto para producción.

## Resumen ejecutivo

El proyecto ya demuestra el flujo principal: mapa, selección de ubicación, categorías desde Supabase, detalles, fotografía local, previsualización y un servicio inicial para insertar reportes. La separación inicial entre `components`, `services`, `lib` y `types` es una buena dirección.

Antes de agregar nuevas funciones conviene realizar una estabilización técnica. Hay inconsistencias de tipos, estado del formulario que se pierde al volver, fotografías que no se guardan, texto de previsualización desactualizado, ausencia de migraciones SQL versionadas y una arquitectura de seguridad insuficiente para inserciones anónimas públicas.

La decisión más importante que debe tomarse ahora es incorporar desde el modelo de datos el soporte multi-ciudad (`city_id`), un identificador público de seguimiento y un mecanismo seguro de creación de reportes que no dependa de insertar directamente desde el navegador sin control antiabuso.

## Lo que ya está hecho

- React + TypeScript + Vite.
- Leaflet + OpenStreetMap.
- Selección manual de ubicación.
- Geolocalización del navegador.
- Flujo por pasos: mapa → categoría → detalles → vista previa.
- Categorías activas leídas desde Supabase.
- Cliente Supabase centralizado.
- Servicio inicial de categorías.
- Servicio inicial de creación de reportes.
- Tablas remotas `categories`, `subcategories` y `reports`.
- RLS de lectura de categorías.
- RLS inicial de inserción de reportes.
- Documento inicial de arquitectura.
- Exclusión de `.env.local` mediante `.gitignore`.

## Hallazgos críticos

### 1. Tipos `Category` duplicados e incompatibles

`src/types/category.ts` define `icon` y `description` como valores anulables, pero `ReportDetails.tsx` y `ReportPreview.tsx` vuelven a definir `Category` como no anulable. Esto rompe la fuente única de verdad y probablemente genera errores de TypeScript al compilar.

**Acción:** eliminar todos los tipos locales y reutilizar `src/types/category.ts`.

### 2. La edición del borrador pierde datos

`ReportDetails` guarda descripción, foto y urgencia en estado local. Al pasar a la vista previa el componente se desmonta. Si el usuario vuelve a editar, el formulario se crea desde cero y aparece vacío, aunque `App.tsx` conserve parte de los datos.

**Acción:** convertir `App.tsx` o un `useReportDraft` en la única fuente del borrador y pasar valores iniciales/controlados a cada paso.

### 3. La fotografía se selecciona, pero se descarta

La interfaz permite adjuntar una foto y la muestra en la previsualización, pero `createReport()` no la sube ni la relaciona con el reporte. El usuario puede creer que fue enviada.

**Acción:** hasta implementar Storage, ocultar la foto o indicar de forma explícita que no se enviará. Luego crear bucket privado, tabla `report_photos`, validación de tamaño/tipo y subida segura.

### 4. Posible fallo al insertar por `.select().single()`

`reports.ts` realiza `insert(...).select(...).single()`. La política creada permite `INSERT`, pero no necesariamente `SELECT`. Supabase puede insertar la fila y luego fallar al intentar devolverla.

**Acción recomendada:** no depender de `SELECT` público sobre `reports`. Crear el reporte mediante una función RPC o Edge Function que devuelva únicamente `tracking_code`, o generar un UUID público antes de insertar y no ejecutar `.select()`.

### 5. Inserción anónima sin protección contra abuso

Una política pública de `INSERT` directo permite spam automatizado, reportes masivos, contenido ofensivo y consumo de almacenamiento.

**Acción:** antes de producción, usar Edge Function/RPC con CAPTCHA, rate limiting, validación, límites de longitud, verificación geográfica y moderación inicial.

### 6. El esquema no está versionado en el repositorio

Las tablas, grants y políticas existen solamente en Supabase. No hay `supabase/migrations` ni seeds. La base no se puede reconstruir de manera confiable.

**Acción:** crear migraciones SQL versionadas y un seed de categorías/subcategorías.

### 7. El modelo dice “multi-ciudad”, pero no tiene `city_id`

La documentación promete reutilización para otras ciudades, pero las tablas actuales no contemplan ciudad, jurisdicción o geometría de cobertura.

**Acción urgente antes de acumular datos:** crear `cities`, agregar `city_id` a categorías configurables, zonas, organismos, canales y reportes.

## Hallazgos de alta prioridad

- El aviso de `ReportPreview.tsx` dice que el reporte todavía no se guarda, aunque ya existe lógica de inserción.
- `URL.createObjectURL(photo)` se ejecuta en cada render y nunca se revoca; produce pérdida de memoria.
- No hay estado `submitting`; el botón puede pulsarse varias veces y duplicar reportes.
- Se usan valores de urgencia en español y en inglés (`baja/media/alta` y `low/medium/high`), con conversiones frágiles.
- `updated_at` existe en la tabla, pero no hay trigger que lo actualice automáticamente.
- `category_id` y `subcategory_id` pueden apuntar a categorías diferentes; falta una restricción/trigger de coherencia.
- No hay límites de coordenadas: se pueden crear reportes fuera de Posadas.
- El GPS coloca el marcador, pero el mapa no se centra ni hace `flyTo` a la ubicación.
- El marcador de Leaflet depende de imágenes remotas de unpkg; conviene empaquetarlas localmente.
- El tile server público estándar de OpenStreetMap no debe considerarse infraestructura gratuita ilimitada para producción.
- No hay geocodificación inversa ni dirección aproximada.
- No existe fecha/hora del hecho, solo fecha de creación.
- No existe identificador público amigable de seguimiento.
- No existe pantalla de confirmación persistente ni opción de copiar/guardar el seguimiento.
- No hay moderación ni separación entre reporte recibido y reporte publicado.
- No existe política específica para reportes de inseguridad, emergencias y datos sensibles.

## Calidad del frontend

### Aspectos positivos

- Componentes separados por etapa.
- Servicio de categorías fuera del componente.
- Cliente Supabase centralizado.
- Tipos TypeScript iniciales.
- Diseño básico responsive.

### Problemas

- `App.tsx` administra demasiados estados y transiciones manuales; pronto será difícil de mantener.
- Conviene usar `useReducer` o un hook `useReportDraft` antes de sumar subcategorías y fotos.
- `CategoriesTest.tsx` es código temporal y duplica el tipo `Category`.
- `App.css`, `react.svg`, `vite.svg` y `hero.png` parecen residuos del template.
- Faltan estilos para las clases de categorías (`category-grid`, `category-card`, etc.).
- Uso excesivo de `alert()`; no es accesible ni adecuado para una UX final.
- Faltan mensajes con `aria-live`, foco automático por paso y navegación con teclado revisada.
- Botones sin `type="button"` en varios componentes.
- No hay Error Boundary.
- No hay router ni URLs recuperables para reporte/seguimiento.
- No hay validación del tamaño y tipo real de imagen.

## Calidad de documentación y repositorio

- `README.md` sigue siendo el template de Vite y no explica instalación, variables, Supabase, scripts ni estado del proyecto.
- `ARCHITECTURE.md` es una declaración de intención, pero no refleja todavía decisiones concretas, diagramas, límites ni amenazas.
- Hay archivos `.DS_Store` dentro del ZIP.
- La versión del paquete sigue en `0.0.0`.
- No hay `CHANGELOG`, ADRs, política de ramas ni convenciones de commits.
- No hay CI para ejecutar build/lint/tests.

## Modelo de datos recomendado antes de crecer

### Mínimo inmediato

- `cities`
- `categories`
- `subcategories`
- `reports`
- `report_status_history`
- `report_photos`

### Campos importantes en `reports`

- `id` UUID interno.
- `tracking_code` público, único y no secuencial predecible.
- `city_id`.
- `category_id`.
- `subcategory_id`.
- `description`.
- `latitude` / `longitude` o `geography(Point,4326)`.
- `address_text`.
- `occurred_at`.
- `urgency`.
- `moderation_status`.
- `workflow_status`.
- `reporter_user_id` o `anonymous_session_id`.
- `created_at` / `updated_at`.

### Posterior

- `organizations`
- `organization_areas`
- `official_channels`
- `routing_rules`
- `zones`
- `official_claims`
- `report_confirmations`
- `comments`
- `audit_log`

## Seguridad y privacidad

Antes de publicar:

- CAPTCHA y rate limit.
- Validación de longitud y contenido en servidor.
- Límites geográficos de Posadas.
- Moderación previa a publicación.
- Eliminación/ocultamiento de datos personales en texto e imágenes.
- Política de privacidad y términos.
- Aviso claro: Posadas Reporta no reemplaza 911 ni denuncias oficiales.
- Metadatos EXIF de imágenes eliminados.
- Bucket de fotos no público por defecto; usar URLs firmadas o imágenes moderadas derivadas.
- Registro de auditoría administrativo.
- Backups y plan de recuperación.

## Pruebas necesarias

- Unitarias: conversión de urgencia, validación y servicios.
- Componentes: selección de categorías, validación de detalles y vuelta entre pasos.
- Integración: creación de reporte contra entorno Supabase de pruebas.
- E2E con Playwright: flujo completo móvil y escritorio.
- Seguridad: RLS para anon/authenticated/admin.
- Accesibilidad: teclado, lector de pantalla, contraste y foco.

## Plan recomendado

### Fase 0 — Estabilización (primero)

1. Crear Git y commit de respaldo.
2. Corregir tipos duplicados.
3. Crear `ReportDraft` y `Urgency` compartidos.
4. Mantener el borrador al volver entre pasos.
5. Corregir vista previa y estado de envío.
6. Evitar doble envío.
7. Eliminar archivos del template y estilos muertos.
8. Reescribir README.
9. Conseguir `npm run build` y `npm run lint` en verde.

### Fase 1 — Base de datos reproducible

1. Crear `supabase/migrations`.
2. Incorporar `cities` y `city_id`.
3. Incorporar `tracking_code`.
4. Agregar trigger `updated_at`.
5. Agregar coherencia categoría/subcategoría.
6. Versionar grants y RLS.
7. Crear seeds.

### Fase 2 — Primer flujo real seguro

1. Crear reporte mediante RPC/Edge Function.
2. Mostrar pantalla de éxito con seguimiento.
3. Guardar reporte sin foto inicialmente.
4. Validar reporte en Supabase.
5. Confirmar en Table Editor y mediante prueba automatizada.

### Fase 3 — Fotografías

1. Bucket privado.
2. Compresión del lado cliente.
3. Validación del lado servidor.
4. Eliminación de EXIF.
5. Moderación.
6. Tabla `report_photos`.

### Fase 4 — Mapa público y moderación

1. Solo reportes aprobados.
2. Clustering y filtros.
3. Protección de ubicaciones sensibles.
4. Panel administrativo básico.

### Fase 5 — Derivación oficial

1. Organismos.
2. Áreas.
3. Canales oficiales.
4. Zonas.
5. Reglas de derivación configurables.
6. Registro del reclamo oficial separado del reporte ciudadano.

## Veredicto

El proyecto tiene una base válida para un MVP y no necesita ser descartado ni reescrito desde cero. Sí necesita una refactorización corta y controlada antes de agregar subcategorías, fotos, mapa público o panel administrativo.

La prioridad no es “más funcionalidades”, sino asegurar cuatro fundamentos: **borrador consistente, modelo multi-ciudad, esquema versionado y creación segura de reportes**.
