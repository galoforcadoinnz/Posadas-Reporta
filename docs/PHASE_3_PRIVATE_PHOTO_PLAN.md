# Fase 3 — Fotografías privadas y moderadas

Estado: diseño local para revisión; no autoriza migraciones, creación de buckets,
despliegues ni cambios remotos.

## 1. Objetivo

Permitir una fotografía opcional por reporte sin exponer el archivo original,
sus metadatos ni una vía de escritura directa desde el navegador. La fotografía
debe quedar privada y pendiente de moderación.

Esta fase no incorpora todavía un mapa público, lectura ciudadana de reportes,
autenticación administrativa ni publicación de imágenes.

## 2. Principios no negociables

- El bucket `report-photos-private` será privado y nunca tendrá lectura pública.
- `anon` y `authenticated` no recibirán políticas de escritura o lectura sobre
  sus objetos.
- El navegador no usará `supabase.storage.upload()` ni conocerá una clave
  administrativa.
- La Edge Function será la única entrada para fotografías.
- Ningún archivo se almacenará antes de validar tamaño, formato, dimensiones y
  estructura, y de eliminar metadatos.
- El nombre original, EXIF, GPS, perfil de cámara y otros metadatos no se
  conservarán.
- Una imagen pendiente, rechazada o sensible nunca podrá publicarse.
- El objeto y su registro usarán identificadores aleatorios; no incluirán el
  tracking, nombre original, descripción ni coordenadas en la ruta.
- Ante una duda de validación o saneamiento, la operación fallará cerrada y el
  reporte textual continuará siendo válido.

## 3. Amenazas consideradas

- subida anónima ilimitada y agotamiento de cuota;
- sustitución o sobrescritura de objetos;
- asociación de una foto con un reporte ajeno;
- reutilización o filtración de una autorización de carga;
- MIME falso, polyglots, archivos truncados y bombas de descompresión;
- EXIF con coordenadas, identificadores del dispositivo o miniaturas;
- XMP, ICC y chunks auxiliares no requeridos;
- nombres y rutas controlados por el cliente;
- carreras entre reintentos y doble envío;
- objetos huérfanos entre Storage y PostgreSQL;
- lectura, listado o URL pública accidental;
- exposición de imágenes sin moderación;
- secretos, tokens o contenido sensible en logs.

## 4. Decisión de arquitectura

Se utilizará un flujo en dos operaciones:

1. `submit-report` recibe opcionalmente una intención de fotografía ya
   normalizada en el cliente. La intención contiene exclusivamente SHA-256,
   bytes y MIME esperado. La Edge Function deriva una capacidad impredecible
   de 256 bits mediante HMAC, almacena solo su hash y la vincula al reporte
   dentro de la RPC.
2. `upload-report-photo` recibe el binario junto con esa capacidad. Valida y
   sanea la imagen, la almacena con `upsert: false` y completa el registro de la
   fotografía mediante una RPC idempotente.

La capacidad:

- será independiente del tracking y no servirá para consultar el reporte;
- se derivará de `requestId`, intención y versión mediante un pepper exclusivo
  de al menos 32 bytes que solo existirá en Edge;
- expirará a los 10 minutos;
- admitirá una sola fotografía y un máximo acotado de intentos;
- estará ligada al reporte, SHA-256, tamaño y MIME declarados;
- se marcará consumida solo después de confirmar Storage y PostgreSQL;
- nunca se persistirá en texto claro ni se registrará en logs.

No se usará el código de seguimiento como credencial. Tampoco se reutilizará el
token de Turnstile, porque los tokens son de un solo uso.

## 5. Contratos propuestos

### 5.1 Intención en `submit-report`

Campo opcional:

```json
{
  "photoIntent": {
    "sha256": "64 caracteres hexadecimales",
    "byteSize": 123456,
    "mimeType": "image/webp"
  }
}
```

Cuando no existe fotografía, la respuesta pública actual no cambia. Cuando
existe, agrega una capacidad efímera:

```json
{
  "trackingCode": "PR-…",
  "createdAt": "…",
  "status": "received",
  "photoUpload": {
    "token": "valor efímero",
    "expiresAt": "…"
  }
}
```

Los reintentos con el mismo `requestId` y la misma intención deben devolver la
misma autorización mientras siga vigente. Una intención diferente con el mismo
`requestId` produce `IDEMPOTENCY_CONFLICT`.

### 5.2 `upload-report-photo`

- Método: `POST`.
- `Content-Type`: exclusivamente `image/webp` en la primera versión.
- Cuerpo: binario, no multipart.
- Capacidad: encabezado dedicado, nunca query string.
- `Content-Length`: obligatorio y verificado también durante la lectura.
- Respuesta: identificador opaco y estado `pending`; nunca una URL.
- CORS, clave publicable, hostname y origen: misma política cerrada que
  `submit-report`.

El endpoint no aceptará rutas, nombres de archivo, `report_id`, tracking ni
estado de moderación aportados por el cliente.

## 6. Límites iniciales

| Control | Límite |
| --- | ---: |
| Archivo elegido en el cliente | 10 MiB |
| Lado mayor antes de enviar | 1600 píxeles |
| Píxeles decodificados | 12 megapíxeles |
| Binario WebP enviado | 2 MiB |
| Fotografías por reporte | 1 |
| Vigencia de capacidad | 10 minutos |
| Intentos por capacidad | 3 |

El cliente reducirá dimensiones y convertirá a WebP antes de calcular el hash.
Estos controles mejoran UX, pero el servidor volverá a aplicar todos los
límites y no confiará en MIME, extensión, dimensiones ni hash del navegador.

## 7. Saneamiento obligatorio

La implementación de Edge deberá usar una dependencia WASM fijada por versión
y lockfile que pueda decodificar y volver a codificar WebP dentro de los límites
de CPU y memoria medidos en pruebas.

La salida se volverá a codificar desde píxeles, sin copiar chunks auxiliares. De
esta forma se eliminan EXIF, XMP, ICC, comentarios, miniaturas y nombres. No es
suficiente borrar únicamente el segmento EXIF ni confiar en la conversión del
navegador.

Antes de adoptar la dependencia se requiere:

- revisar mantenedor, licencia, artefactos y dependencias transitivas;
- fijar versión e integridad en `supabase/deno.lock`;
- probar archivos válidos, truncados, polyglot y de dimensiones extremas;
- medir CPU y memoria con el máximo permitido;
- demostrar que la salida no contiene EXIF, XMP ni chunks desconocidos;
- fallar cerrada si la decodificación o recodificación no termina.

La evaluación local vigente está documentada en
[`PHASE_3_IMAGE_PROCESSOR_EVALUATION.md`](./PHASE_3_IMAGE_PROCESSOR_EVALUATION.md).
El Gate B está aprobado únicamente para integración local con
`@imagemagick/magick-wasm@0.0.43`, configuración WebP acotada y límites de
recursos. La alternativa jSquash evaluada fue rechazada porque empaqueta una
versión vulnerable de libwebp. El bundle con Supabase CLI y el canary de staging
siguen siendo gates independientes.

Si el procesamiento no cumple los límites de Edge Functions, la Fase 3 se
detiene. No se almacenará temporalmente el original como atajo.

## 8. Modelo de datos propuesto

### `public.report_photos`

- `id uuid` generado por PostgreSQL;
- `report_id uuid` único y FK `ON DELETE RESTRICT`;
- `bucket_id text` con valor fijo;
- `object_path text` único;
- `mime_type text` restringido a `image/webp`;
- `byte_size integer` con rango estricto;
- `width integer` y `height integer` con rangos estrictos;
- `sha256 text` con formato hexadecimal y unicidad por reporte;
- `moderation_status text`: `pending | approved | rejected | sensitive`;
- `scan_status text`: `pending | clean | rejected | error`;
- `created_at` y `sanitized_at` con zona horaria.

La tabla tendrá RLS habilitada, cero políticas públicas y cero privilegios para
`anon`, `authenticated` y `service_role`. Las operaciones privilegiadas se
harán mediante funciones específicas con `search_path = ''`, ownership
controlado y `EXECUTE` revocado a `PUBLIC`.

### Capacidad privada

`posadas_reporta_private.report_photo_upload_capabilities` almacenará:

- `report_id` único;
- hash de la capacidad;
- hash, tamaño y MIME esperados;
- vencimiento, intentos y marca de consumo;
- timestamps de creación y último intento.

La tabla estará fuera del esquema expuesto, con RLS y sin CRUD concedido. Un
índice parcial por vencimiento permitirá la limpieza acotada.

## 9. Storage y RLS

El bucket tendrá:

- `public = false`;
- MIME permitido `image/webp`;
- límite de 2 MiB;
- rutas generadas por servidor con UUID criptográficamente aleatorio;
- cache privada y sin URLs públicas.

No se crearán políticas para clientes públicos. La Edge Function usará la clave
secreta únicamente en servidor y `upsert: false`. Cualquier futura lectura de
moderación requerirá autenticación administrativa, autorización independiente
y URL firmada de duración máxima de cinco minutos.

Las filas de `storage.objects` se tratarán como metadatos administrados por
Storage. Las subidas y eliminaciones usarán la API de Storage; no se borrarán
filas de ese esquema mediante SQL.

## 10. Consistencia, concurrencia y reintentos

- La creación de capacidad formará parte de la transacción del reporte.
- Las RPC tomarán advisory locks separados por `requestId` y `report_id`.
- La ruta final será determinista desde IDs generados por servidor.
- La carga usará `upsert: false` para impedir reemplazos.
- Si Storage confirma y PostgreSQL falla, la Edge Function intentará eliminar
  el objeto mediante la API y devolverá un error reintentable genérico.
- Un reintento comprobará si el objeto y el registro ya coinciden antes de
  responder; nunca aceptará contenido diferente.
- Un reconciliador operativo detectará objetos huérfanos sin leer su contenido
  y los eliminará mediante la API después de una ventana de seguridad.
- La limpieza de capacidades vencidas no tocará reportes ni fotografías
  confirmadas.

## 11. Moderación y privacidad

- La fotografía nace en `pending` y no cambia automáticamente a `approved`.
- El original saneado sigue siendo privado incluso después de aprobación.
- Una futura imagen pública será una derivada separada, con dimensiones
  reducidas y ubicación aproximada según la política de sensibilidad.
- No se mostrarán imágenes, coordenadas exactas ni descripciones antes de una
  revisión humana y reglas específicas para menores, domicilios y situaciones
  sensibles.
- La política de privacidad deberá explicar finalidad, conservación,
  moderación, proveedor y mecanismo de eliminación antes de habilitar fotos.
- Logs y errores excluirán capacidad, hash, binario, tracking, coordenadas,
  EXIF, rutas internas y respuestas completas de Storage.

## 12. Pruebas obligatorias

### Unitarias y Deno

- compresión y conversión del cliente;
- límites de dimensiones y bytes;
- lectura binaria limitada con y sin `Content-Length`;
- firmas válidas y MIME falso;
- EXIF/XMP/ICC removidos;
- token ausente, vencido, consumido o alterado;
- hash y tamaño divergentes;
- doble envío concurrente;
- errores genéricos sin datos sensibles.

### SQL local

- constraints, índices, grants y RLS;
- cero acceso de `anon`, `authenticated` y `service_role` a ambas tablas;
- funciones no ejecutables por `PUBLIC`;
- capacidad idempotente, vencimiento y consumo atómico;
- asociación única de fotografía por reporte;
- concurrencia y limpieza sin borrar registros vigentes.

### Integración y E2E

- handler real contra PostgreSQL local y Storage simulado;
- compensación cuando falla Storage o la confirmación SQL;
- reporte sin foto sin regresiones;
- reporte con foto, reintento y confirmación `pending`;
- prueba negativa que demuestre que el navegador nunca llama directamente a
  `/storage/v1/object`.

## 13. Migraciones y entregas previstas

Las implementaciones se separarán en PR independientes:

1. tipos, normalización WebP y pruebas puramente locales;
2. migración aditiva de tablas, funciones y limpieza;
3. creación reproducible del bucket privado y verificación de configuración;
4. Edge Function `upload-report-photo` y pruebas;
5. integración con `submit-report` e idempotencia;
6. frontend y E2E;
7. canary exclusivo de staging;
8. revisión de privacidad y moderación antes de cualquier producción.

Cada migración se creará con Supabase CLI, se mostrará completa y requerirá
aprobación específica antes de ejecutarse en un entorno remoto.

## 14. Gates de aprobación

- Gate A: aprobar este diseño y los límites.
- Gate B: aprobar la dependencia de procesamiento después de su evaluación.
- Gate C: aprobar el SQL completo y sus pruebas locales.
- Gate D: autorizar bucket, secretos y funciones exclusivamente en staging.
- Gate E: aprobar canary y operación de moderación.
- Gate F: autorización separada y explícita para producción.

Ningún gate implica automáticamente el siguiente.

## 15. Decisiones descartadas

- bucket público;
- subida directa anónima desde React;
- ruta basada en tracking o nombre original;
- confiar solo en extensión, MIME o saneamiento del cliente;
- guardar el original y sanearlo después;
- usar tracking como autorización;
- reutilizar Turnstile como token de carga;
- borrar directamente metadatos de `storage.objects` mediante SQL;
- publicar automáticamente al completar la carga.

## 16. Referencias

- Supabase Storage, buckets privados:
  <https://supabase.com/docs/guides/storage/buckets/fundamentals>
- Supabase Storage, control de acceso:
  <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase Storage, límites:
  <https://supabase.com/docs/guides/storage/uploads/file-limits>
- Supabase Storage, esquema administrado:
  <https://supabase.com/docs/guides/storage/schema/design>
- Supabase Edge Functions, límites:
  <https://supabase.com/docs/guides/functions/limits>
