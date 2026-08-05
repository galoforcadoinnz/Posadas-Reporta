# Changelog

Todos los cambios relevantes de Posadas Reporta se documentan en este archivo.

## [Unreleased]

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
