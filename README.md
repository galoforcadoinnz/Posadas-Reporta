# Posadas Reporta

Posadas Reporta es un MVP web de participación ciudadana para informar incidencias urbanas geolocalizadas en la ciudad de Posadas. La aplicación guía al usuario por un flujo breve de mapa, categoría, detalles y previsualización.

El proyecto no reemplaza servicios de emergencia ni canales oficiales de denuncia.

## Estado actual

El MVP permite:

- seleccionar una ubicación manualmente en el mapa;
- solicitar la ubicación del navegador;
- cargar categorías activas desde Supabase;
- completar una descripción y nivel de urgencia;
- seleccionar una fotografía para previsualización local;
- revisar el borrador antes de confirmarlo;
- conservar los datos al avanzar y volver entre pasos;
- crear un reporte mediante el servicio Supabase existente.

La fotografía seleccionada no se sube ni se guarda. La interfaz lo informa antes de confirmar.

## Tecnologías

- React 19
- TypeScript
- Vite
- Leaflet y React Leaflet
- OpenStreetMap
- Supabase

## Instalación

Instalá exactamente las dependencias registradas en `package-lock.json`:

```bash
npm ci
```

## Variables de entorno

La aplicación requiere estas variables frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Deben configurarse en `.env.local`. Ese archivo está ignorado por Git y sus valores no deben mostrarse, registrarse, copiarse a documentación ni incluirse en commits.

No se deben utilizar secret keys ni claves `service_role` en React, Vite o cualquier código frontend.

## Comandos

Iniciar el entorno de desarrollo:

```bash
npm run dev
```

Compilar para producción:

```bash
npm run build
```

Ejecutar ESLint:

```bash
npm run lint
```

Previsualizar el build local:

```bash
npm run preview
```

## Flujo del reporte

1. Selección de ubicación en Leaflet/OpenStreetMap.
2. Selección de una categoría obtenida desde Supabase.
3. Carga de descripción, urgencia y fotografía local opcional.
4. Previsualización del borrador.
5. Confirmación mediante el servicio de reportes.

`ReportDraft`, definido en `src/types/report.ts`, es la fuente única del reporte en curso. Los valores internos de urgencia son `low`, `medium` y `high`.

## Organización principal

```text
src/
  components/   Etapas y elementos visuales del flujo
  config/       Validación de configuración
  lib/          Clientes de infraestructura
  services/     Acceso a Supabase
  types/        Tipos compartidos
docs/           Arquitectura y auditoría técnica
```

## Seguridad

Las reglas permanentes de desarrollo están en `AGENTS.md`. Antes de cambiar Supabase, RLS, migraciones, datos existentes o arquitectura se requiere revisión y aprobación explícita.

No se debe:

- modificar Supabase remoto sin mostrar previamente el SQL;
- desactivar Row Level Security;
- ejecutar migraciones destructivas sin aprobación;
- publicar en producción sin aprobación;
- incluir secretos en código, logs, documentación o commits.

## Limitaciones conocidas

Este prototipo todavía no es apto para producción:

- la creación directa de reportes no tiene CAPTCHA ni rate limiting;
- no hay validación de servidor propia ni moderación;
- las fotografías no se almacenan;
- el esquema Supabase no está versionado en el repositorio;
- no existe aislamiento multi-ciudad mediante `city_id`;
- no hay código público de seguimiento;
- no existen pruebas automatizadas;
- los iconos de marcador de Leaflet dependen actualmente de `unpkg`;
- el tile server público de OpenStreetMap no debe tratarse como infraestructura productiva ilimitada.

## Validación obligatoria

Antes de considerar terminada una tarea:

```bash
npm run build
npm run lint
```

## Documentación

- `AGENTS.md`: reglas permanentes y acciones prohibidas.
- `docs/ARCHITECTURE.md`: visión y arquitectura base.
- `docs/AUDITORIA_TECNICA_POSADAS_REPORTA_MVP_0_2.md`: auditoría del MVP 0.2.
- `CHANGELOG.md`: cambios relevantes del proyecto.
