# Posadas Reporta
# Arquitectura del Sistema

**Versión:** 1.0 (Arquitectura Base)

**Proyecto:** Posadas Reporta

**Estado:** En Desarrollo

**Autor del Proyecto:** José María Galo Forcado

---

# Índice

1. Visión
2. Misión
3. Objetivos
4. Alcance
5. Filosofía del Proyecto
6. Arquitectura General
7. Tecnologías
8. Principios de Diseño
9. Arquitectura del Software
10. Arquitectura de Datos
11. Arquitectura Frontend
12. Arquitectura Backend
13. Seguridad
14. Escalabilidad
15. Modelo de Negocio
16. Roadmap
17. Convenciones de Desarrollo
18. Organización del Repositorio
19. Reglas del Proyecto

---

# 1. Visión

Posadas Reporta será una plataforma digital de participación ciudadana que permitirá informar incidencias urbanas geolocalizadas, facilitar la comunicación con los organismos responsables y generar información útil para mejorar la calidad de vida en la ciudad.

El sistema será diseñado para crecer posteriormente hacia una plataforma reutilizable para múltiples municipios.

---

# 2. Misión

Facilitar la participación ciudadana mediante herramientas tecnológicas abiertas, intuitivas y confiables, promoviendo ciudades más inteligentes y transparentes.

---

# 3. Objetivos

## Objetivo Principal

Permitir que cualquier ciudadano pueda informar un problema urbano desde un mapa interactivo en menos de un minuto.

## Objetivos Secundarios

- Centralizar reportes urbanos.
- Facilitar el acceso al organismo competente.
- Mejorar la comunicación ciudadano–Estado.
- Generar estadísticas.
- Detectar zonas críticas.
- Favorecer la toma de decisiones basada en datos.

---

# 4. Alcance

El MVP incluirá:

- mapa interactivo;
- geolocalización;
- categorías;
- subcategorías;
- carga de reportes;
- fotografías;
- búsqueda;
- filtros;
- organismos;
- enlaces oficiales.

No reemplaza los canales oficiales de denuncia.

Actúa como plataforma de orientación y participación ciudadana.

---

# 5. Filosofía

Cada decisión del proyecto deberá responder:

- ¿Es útil?
- ¿Es escalable?
- ¿Es segura?
- ¿Es reutilizable?
- ¿Es sencilla?
- ¿Reduce trabajo futuro?

Si la respuesta es NO, deberá rediseñarse.

---

# 6. Arquitectura General

Ciudadano

↓

Aplicación Web (React)

↓

Supabase API

↓

PostgreSQL

↓

Storage

↓

Panel Administrativo

↓

Organismos

---

# 7. Stack Tecnológico

Frontend

- React
- TypeScript
- Vite
- Leaflet
- OpenStreetMap

Backend

- Supabase
- PostgreSQL

Base de Datos

- PostgreSQL
- UUID
- Row Level Security

Servicios futuros

- Storage
- Authentication
- Edge Functions
- Realtime
- Push Notifications

---

# 8. Principios de Diseño

El sistema será:

- Mobile First
- Responsive
- PWA Ready
- API First
- Cloud Native
- Modular
- Escalable
- Seguro
- Open Source cuando sea posible

---

# 9. Arquitectura del Software

Se dividirá en módulos independientes.

## Presentación

React

## Lógica

Servicios

## Persistencia

Supabase

## Datos

PostgreSQL

---

# 10. Arquitectura de Datos

Entidades principales:

Categories

↓

Subcategories

↓

Reports

↓

Photos

↓

Organizations

↓

Official Channels

↓

Users

↓

Notifications

↓

Audit Log

Cada entidad tendrá responsabilidades claramente definidas.

---

# 11. Arquitectura Frontend

Carpetas previstas:

src/

assets/

components/

pages/

hooks/

services/

config/

utils/

types/

layouts/

styles/

---

# 12. Arquitectura Backend

Supabase gestionará:

- autenticación;
- base de datos;
- almacenamiento;
- políticas de seguridad;
- API.

---

# 13. Seguridad

Principios:

- HTTPS obligatorio.
- Row Level Security.
- Sanitización de entradas.
- Validación frontend y backend.
- Protección contra spam.
- Protección contra abuso.
- Auditoría.

No se almacenará información sensible innecesaria.

---

# 14. Escalabilidad

El proyecto se desarrollará como una plataforma multi-ciudad.

Motor principal:

CivicCore (nombre interno)

Implementaciones:

- Posadas Reporta
- Garupá Reporta
- Oberá Reporta
- Eldorado Reporta
- Puerto Iguazú Reporta

Cada ciudad tendrá únicamente datos propios.

El código será compartido.

---

# 15. Modelo de Negocio

Posibles fuentes de ingresos:

- Publicidad local responsable.
- Comercios destacados.
- Patrocinios.
- Paneles municipales.
- Informes estadísticos.
- Licencias SaaS.
- API para terceros.

La publicidad nunca deberá afectar la experiencia del ciudadano.

---

# 16. Roadmap

Sprint 1

✔ Arquitectura

✔ Supabase

✔ Categorías

✔ Reportes

Sprint 2

- Guardar reportes
- Mostrar reportes
- Fotografías

Sprint 3

- Usuarios
- Panel administrador
- Moderación

Sprint 4

- Organismos
- Seguimiento

Sprint 5

- Aplicación Android

Sprint 6

- Aplicación iOS

Sprint 7

- Inteligencia Artificial

Sprint 8

- Plataforma Multi-Ciudad

---

# 17. Convenciones

Idioma

Documentación:

Español

Código:

Inglés

Tablas:

snake_case

Componentes React:

PascalCase

Funciones:

camelCase

---

# 18. Organización del Proyecto

docs/

src/

public/

supabase/

tests/

scripts/

assets/

---

# 19. Reglas de Desarrollo

Nunca desarrollar una funcionalidad sin:

- documentación;
- diseño;
- objetivo definido;
- pruebas;
- revisión.

Toda nueva funcionalidad deberá ser:

- documentada;
- versionada;
- escalable;
- mantenible.

---

# Objetivo Final

Construir la mejor plataforma de participación ciudadana de Argentina utilizando tecnologías abiertas, modernas y escalables, con una arquitectura preparada para evolucionar hacia una solución multi-ciudad y multiplataforma.

---

# 20. Decisiones de datos — Fase 1B

La base de datos se versiona mediante una baseline local separada y migraciones
de upgrade aditivas. La baseline se utiliza exclusivamente para bases vacías y
nunca debe aplicarse al proyecto remoto existente.

El modelo mínimo incorpora `cities`, `reports.city_id` y
`report_status_history`. `categories` y `subcategories` permanecen como
catálogos globales; la configuración por ciudad se resolverá posteriormente
sin duplicar categorías.

Moderación (`moderation_status`) y seguimiento operativo (`workflow_status`)
son dominios independientes. Las columnas heredadas `address` y `status` se
conservan durante la transición.

Los códigos de seguimiento son generados por PostgreSQL, no son secuenciales,
no derivan del UUID del reporte y tienen una restricción de unicidad. No existe
lectura pública de reportes ni consulta pública por tracking en Fase 1B.

Los roles `anon` y `authenticated` aplican mínimo privilegio: lectura de
catálogos activos e inserción validada limitada a las columnas públicas
`category_id`, `subcategory_id`, `description`, `latitude`, `longitude`,
`address`, `urgency` y `status`. No tienen privilegios de inserción sobre
identificadores, tracking, ciudad, timestamps ni estados internos. El historial
no tiene acceso público. `service_role` conserva su atributo `BYPASSRLS`, pero
Fase 1B le revoca todos los privilegios directos sobre las cinco tablas; Fase 2
deberá conceder solo los permisos concretos de la operación administrativa
aprobada. La futura creación segura y devolución limitada del tracking
corresponden a Fase 2 mediante RPC o Edge Function.

# 21. Decisiones de seguridad — Fase 2

La creación pública se implementa mediante la Edge Function `submit-report` y
la RPC interna `public.submit_report_v1`. El navegador no inserta directamente
en `reports`. Turnstile, validación estricta, HMAC de IP, ventanas móviles,
idempotencia y límites geográficos preceden a la inserción.

En Supabase hosted, la identidad efímera de rate limiting se deriva únicamente
de `cf-connecting-ip`. `x-forwarded-for` se ignora porque puede contener valores
aportados por el cliente; en local solo se acepta cuando el proxy de pruebas se
habilita explícitamente. La IP nunca se persiste: solo se almacena su HMAC.

La RPC es la única capacidad concedida a `service_role`; ese rol continúa sin
privilegios directos sobre tablas. La respuesta contiene exclusivamente
tracking, fecha y estado `received`. No existe lectura pública de reportes.

Los límites se configuran por ciudad. Posadas queda pendiente hasta convertir y
revisar una fuente cartográfica oficial; staging permanece bloqueado mientras
los cuatro valores sean nulos.
