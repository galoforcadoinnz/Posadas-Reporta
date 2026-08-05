# Reglas permanentes de desarrollo — Posadas Reporta

Este archivo define las reglas obligatorias para cualquier persona o agente que trabaje en este repositorio. Se aplica a todo el árbol del proyecto. Ante un conflicto, prevalecen las instrucciones explícitas del responsable técnico, seguidas por este archivo y por `docs/ARCHITECTURE.md`.

## 1. Principios del proyecto

- Posadas Reporta es una plataforma de participación ciudadana; no reemplaza servicios de emergencia ni canales oficiales de denuncia.
- Toda decisión debe priorizar utilidad, simplicidad, seguridad, mantenibilidad, reutilización y evolución multi-ciudad.
- Mantener una separación clara entre presentación (`components`/`pages`), lógica reutilizable (`hooks`/`services`), configuración (`config`/`lib`) y tipos (`types`).
- No agregar funcionalidades sin objetivo, alcance, diseño, validación y documentación definidos.
- No reescribir el proyecto ni reemplazar tecnología estable sin una justificación técnica aprobada.
- Preservar el funcionamiento existente de React, TypeScript, Vite, Leaflet, OpenStreetMap y Supabase.

## 2. Alcance y control de cambios

- Inspeccionar el estado real del repositorio antes de editar y comparar la implementación con la documentación vigente.
- Realizar cambios pequeños, enfocados y reversibles. No mezclar refactorizaciones, funcionalidades y cambios de infraestructura en un mismo commit.
- No modificar archivos ajenos a la tarea ni descartar cambios existentes de otras personas.
- Detenerse y solicitar aprobación antes de tomar decisiones que afecten seguridad, RLS, datos existentes, arquitectura, contratos públicos, costos operativos o infraestructura remota.
- Mostrar previamente cualquier SQL, migración, política RLS, cambio de Storage o comando que pueda alterar servicios remotos.
- No realizar escrituras de prueba contra producción ni crear datos remotos sin autorización explícita.

## 3. Seguridad y privacidad

- Tratar texto, coordenadas, fotografías y metadatos de reportes como contenido potencialmente sensible y no confiable.
- Validar entradas tanto en cliente como en servidor. La validación del cliente nunca sustituye la validación del servidor.
- Antes de exposición pública, exigir controles antiabuso apropiados: CAPTCHA, rate limiting, límites de longitud y tamaño, validación geográfica, moderación y manejo seguro de errores.
- No publicar reportes sin moderación ni exponer ubicaciones sensibles de forma innecesaria.
- No incluir datos personales, tokens, claves, URLs firmadas, contenido de sesiones ni respuestas completas del backend en logs o mensajes de error para usuarios.
- Las fotografías deben validar tipo y tamaño, eliminar metadatos EXIF cuando corresponda y almacenarse en buckets privados salvo decisión de seguridad documentada.
- Mantener HTTPS, mínimo privilegio, auditoría y separación entre estados de recepción, moderación y publicación.
- Todo cambio de autenticación, autorización, RLS o permisos requiere revisión específica de seguridad.

## 4. Protección de secretos y variables de entorno

- Nunca abrir, copiar, imprimir, registrar, revelar, versionar ni modificar `.env.local` sin una instrucción explícita del responsable técnico.
- `.env.local`, archivos `*.local`, claves de servicio, tokens y credenciales deben permanecer fuera de Git.
- Solo se permite comprobar si una variable requerida existe; nunca mostrar su valor.
- En el frontend solo pueden utilizarse claves publicables diseñadas para exposición al navegador. Nunca usar `service_role` ni secretos administrativos en código cliente.
- Las variables requeridas deben validarse por nombre antes de inicializar clientes externos y los errores solo deben mencionar nombres faltantes.
- Antes de cada commit, comprobar que no se incorporaron secretos, archivos locales, dumps, logs o credenciales.

Variables frontend actualmente requeridas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 5. Reglas de Supabase

- Centralizar la creación del cliente Supabase; no crear clientes dispersos en componentes.
- Encapsular consultas y mutaciones en `services`; los componentes no deben contener acceso directo a tablas.
- Especificar columnas en los `select`; evitar `select('*')` sin justificación.
- Comprobar y manejar siempre los errores de Supabase sin revelar detalles sensibles al usuario.
- No depender de un `SELECT` posterior a un `INSERT` anónimo si la política pública solo garantiza inserción.
- No habilitar inserciones anónimas amplias sin validación de servidor, protección antiabuso y revisión de RLS.
- No otorgar acceso público de lectura a `reports` ni a fotografías sin reglas de moderación y privacidad aprobadas.
- Usar RPC o Edge Functions cuando una operación requiera validación privilegiada, rate limiting, generación segura de identificadores o una respuesta pública limitada.
- Mantener coherencia entre categoría y subcategoría, límites geográficos y estados válidos en la capa de datos, no solo en la interfaz.
- No cambiar tablas, políticas, grants, funciones, triggers, buckets ni configuración remota directamente desde el panel sin representar el cambio en una migración versionada.

## 6. Política de migraciones

- Todo cambio de esquema debe implementarse mediante una migración SQL versionada en `supabase/migrations`.
- Una migración debe incluir, según corresponda, tablas, índices, restricciones, claves foráneas, triggers, grants, RLS y comentarios necesarios.
- Las migraciones deben ser deterministas, revisables y reproducibles desde una base limpia.
- No editar una migración ya aplicada en un entorno compartido; crear una migración nueva y progresiva.
- Evaluar y documentar impacto, compatibilidad, bloqueo, backfill, rollback o estrategia de recuperación antes de modificar datos existentes.
- Separar cambios destructivos de cambios preparatorios. No eliminar columnas, tablas o datos sin respaldo y aprobación explícita.
- Probar migraciones y políticas en un proyecto Supabase de desarrollo o pruebas antes de producción.
- Mantener seeds de categorías y subcategorías separados de datos de producción, sin información sensible.
- Incluir `city_id`, aislamiento por ciudad y políticas correspondientes en todo modelo que deba ser multi-ciudad.

## 7. Convenciones de código

- Documentación y textos del proyecto: español. Identificadores de código: inglés.
- Componentes y tipos React/TypeScript: `PascalCase`. Funciones y variables: `camelCase`. Tablas y columnas: `snake_case`.
- Mantener TypeScript estricto: no usar `any`, `@ts-ignore` ni conversiones inseguras para silenciar errores sin justificación documentada.
- Definir cada concepto compartido una sola vez en `src/types`; no duplicar tipos locales incompatibles.
- `ReportDraft` es la fuente única del reporte en curso. Ningún paso debe perder datos al desmontarse y volver a montarse.
- Usar un único dominio de valores para urgencia: `low | medium | high`; traducir solo las etiquetas visibles.
- Evitar lógica de negocio en JSX y conversiones de dominio dispersas.
- Añadir `type="button"` a botones que no envían formularios.
- Revocar recursos temporales como URLs creadas con `URL.createObjectURL`.
- Incluir estados explícitos de carga, error y envío; bloquear acciones repetidas mientras una mutación está en curso.
- No usar `alert()` como solución final de UX para nuevas interfaces; preferir mensajes accesibles con foco y `aria-live`.
- Mantener navegación por teclado, etiquetas asociadas, contraste suficiente y diseño mobile-first.
- No dejar código de prueba manual, archivos del template, recursos sin referencias, `.DS_Store`, logs de depuración ni comentarios obsoletos.

## 8. Mapa y servicios externos

- Mantener la atribución obligatoria de OpenStreetMap.
- No asumir que el tile server público estándar de OpenStreetMap es infraestructura ilimitada para producción.
- No cambiar proveedor de mapas, geocodificación, tiles o CDN sin revisar términos, disponibilidad, privacidad y costos.
- No cargar recursos ejecutables desde terceros sin revisión. Preferir empaquetar recursos estáticos de Leaflet dentro del proyecto.
- Validar coordenadas y límites de cobertura antes de aceptar reportes en un flujo productivo.

## 9. Comandos de instalación y validación

Usar la versión de dependencias fijada en `package-lock.json`:

```bash
npm ci
```

Validaciones mínimas obligatorias después de cambios de código o configuración:

```bash
npm run build
npm run lint
```

Cuando existan suites de pruebas, ejecutar además las pruebas unitarias, de componentes, integración y E2E relevantes. No afirmar que una validación pasó si no se ejecutó o si su salida contiene errores.

## 10. Criterios de aceptación

Un cambio solo se considera terminado cuando:

- cumple exactamente el alcance aprobado y no agrega comportamiento no solicitado;
- `npm run build` finaliza correctamente;
- `npm run lint` finaliza sin errores;
- las pruebas relevantes pasan, o se documenta explícitamente que todavía no existen;
- el flujo existente de Leaflet/OpenStreetMap y la integración Supabase no se rompen;
- los datos del borrador se conservan al avanzar y volver entre pasos;
- las mutaciones impiden envíos duplicados y conservan el borrador ante errores;
- no se incluyeron secretos, datos sensibles ni `.env.local`;
- cualquier cambio de base de datos tiene migración, SQL revisado y aprobación previa;
- se documentaron riesgos, supuestos y verificaciones manuales pendientes;
- el árbol de trabajo no contiene artefactos temporales ni cambios ajenos;
- los commits son pequeños, descriptivos y separan responsabilidades.

## 11. Prohibiciones

Está prohibido:

- revelar o versionar secretos y archivos de entorno;
- usar una clave `service_role` en el navegador;
- deshabilitar RLS como solución rápida;
- aplicar SQL o cambiar Supabase remoto sin revisión previa;
- borrar o transformar datos existentes sin respaldo, plan y aprobación;
- insertar datos de prueba en producción;
- publicar reportes o fotografías sin controles de privacidad y moderación;
- almacenar fotografías en buckets públicos por defecto;
- silenciar errores de TypeScript, lint o seguridad para lograr una compilación verde;
- eliminar funcionalidades que funcionan para simplificar una refactorización;
- cambiar Leaflet, OpenStreetMap, Supabase o el stack base sin una decisión arquitectónica aprobada;
- incorporar dependencias, servicios externos o telemetría sin justificar necesidad, seguridad, privacidad y mantenimiento;
- mezclar cambios de esquema con refactorizaciones de interfaz en el mismo commit;
- continuar si aparece una decisión no aprobada que afecte seguridad, RLS, datos existentes o arquitectura.

## 12. Entrega y documentación

- Explicar qué cambió archivo por archivo y qué se verificó.
- Informar comandos ejecutados, resultados y advertencias pendientes.
- Mostrar el SQL completo antes de solicitar autorización para una migración o cambio remoto.
- Mantener `README.md`, `docs/ARCHITECTURE.md`, auditorías y decisiones técnicas coherentes con el estado real.
- Registrar decisiones arquitectónicas o de seguridad importantes antes de implementar el cambio correspondiente.
