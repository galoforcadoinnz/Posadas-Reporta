# Fase 3 — Evaluación local del procesador de imágenes

Fecha: 2026-09-03

Estado: **Gate B aprobado para integración local con condiciones**.

Esta evaluación es exclusivamente local. No crea buckets, no modifica SQL, no
despliega Edge Functions y no accede a proyectos Supabase remotos.

## Requisitos

El procesador debe:

- aceptar únicamente un contenedor RIFF/WebP de hasta 2 MiB;
- rechazar animaciones, truncados, contenido agregado y dimensiones mayores a
  1600 × 1600 antes de invocar un decoder nativo o WASM;
- decodificar y volver a codificar los píxeles sin conservar EXIF, XMP, ICC,
  comentarios ni chunks desconocidos;
- fijar versiones e integridad en el lockfile;
- dejar margen suficiente dentro de los límites de 2 s de CPU, 256 MB de
  memoria y 20 MB de bundle local de Supabase Edge Functions.

## Entorno y muestra

- Deno `2.9.5`, macOS `26.5.2`, ARM64;
- entrada sintética ruidosa de 1600 × 1600;
- WebP de entrada de aproximadamente 1,21 MB con XMP y comentario;
- mediciones de una sola ejecución local, por lo que no sustituyen un canary de
  staging ni representan garantías de rendimiento alojado.

## Candidatos

### `@imagemagick/magick-wasm@0.0.43`

- licencia Apache-2.0;
- integridad npm
  `sha512-+Wlr3eEl4JlqLwrhAHBlf4VDzOWiFa8L2hYl7mOMXCgq896KghEnh3Go35nuZJMfmE6lX2waBZdr+u9FVluJLA==`;
- paquete descomprimido: 31.115.136 bytes;
- WASM x86: 14.828.458 bytes;
- ImageMagick 7.1.2-30 con libwebp 1.6.0 declarado en el artefacto;
- inicialización aislada observada: aproximadamente 135 ms;
- saneamiento 1600 × 1600 con `webp:method=1`: aproximadamente 738 ms;
- ejecución completa aislada: aproximadamente 1,07 s de CPU;
- RSS observado al finalizar el proceso aislado: aproximadamente 157 MB;
- eliminó perfiles y comentario al volver a codificar.

Supabase documenta `magick-wasm` como ejemplo compatible. La configuración por
defecto quedó demasiado cerca del límite de CPU, pero el esfuerzo de encoder 1
dejó margen local suficiente sin superar 2 MiB de salida en la muestra máxima.
Se adopta para integración y pruebas exclusivamente locales con versión exacta,
lockfile, formato de entrada explícito y límites de recursos obligatorios.

### `@jsquash/webp@1.5.0`

- licencia Apache-2.0;
- integridad npm
  `sha512-KggLoj2MnRSfIqTeKe1EmbljTX2vuV7mh79k89PCL1pyqiDULcPM1L47twxXt0hkb68F70bXiL31MxsuoZtKFw==`;
- única dependencia: `wasm-feature-detect@1.9.0`, fijable por lockfile;
- paquete descomprimido: 914.811 bytes;
- decoder más encoder SIMD: 483.544 bytes;
- inicialización observada: 46–72 ms;
- saneamiento 1600 × 1600 con método 1: aproximadamente 540 ms;
- RSS observado al finalizar: aproximadamente 129 MB;
- la salida fue un único chunk `VP8 ` sin XMP, EXIF, ICC ni comentario.

El artefacto publicado empaqueta **libwebp v1.0.2**. Esa versión es anterior a
libwebp 1.3.2, que corrigió CVE-2023-4863 en el decoder lossless. Debido a que el
endpoint procesará archivos no confiables, el buen rendimiento no compensa
esta dependencia vulnerable. No se adopta.

## Control incorporado sin codec

`supabase/functions/_shared/webp.ts` implementa un inspector estructural sin
dependencias que se ejecutará antes del futuro decoder. Comprueba tamaño total,
cabecera RIFF/WEBP, longitudes y padding de chunks, cantidad de chunks,
dimensiones VP8/VP8L/VP8X, consistencia del canvas, bits reservados, orden básico
de metadatos y ausencia de animación o bitstreams duplicados.

Las pruebas cubren WebP simple y extendido, cuerpo mayor a 2 MiB, truncado,
polyglot con bytes finales, dimensiones excesivas o contradictorias,
animaciones, duplicados, padding inválido, chunks fuera de orden y frames VP8
que no sean keyframe.

Este inspector reduce exposición, pero no demuestra que los píxeles sean
válidos ni reemplaza la decodificación y recodificación obligatorias.

## Decisión y desbloqueo

Gate B queda aprobado para integración local de `magick-wasm@0.0.43`. Esto no
autoriza SQL remoto, buckets, secretos, despliegues ni datos de prueba. Tampoco
se almacenarán originales como atajo.

Antes de aprobar un despliegue de staging se requiere:

1. inicializar una sola vez el WASM y fijar `format = WEBP`, dimensiones,
   memoria, disco, tiempo, perfiles y longitud de lista;
2. usar el inspector RIFF antes del decoder y volver a comprobar dimensiones y
   tamaño después de decodificar y codificar;
3. verificar el bundle real con Supabase CLI en Docker, porque el WASM x86 mide
   14,8 MB y el techo local es 20 MB;
4. cubrir corpus válido, truncado, polyglot, lossless malicioso, metadatos y
   carga máxima;
5. ejecutar un canary exclusivo de staging y revisar telemetría de CPU, memoria
   y errores sin registrar imágenes ni datos sensibles.

Fuentes primarias:

- Supabase, límites de Edge Functions:
  <https://supabase.com/docs/guides/functions/limits>
- Supabase, manipulación de imágenes con WASM:
  <https://supabase.com/docs/guides/functions/examples/image-manipulation>
- especificación oficial del contenedor WebP:
  <https://developers.google.com/speed/webp/docs/riff_container>
- historial oficial de versiones de libwebp:
  <https://github.com/webmproject/libwebp/blob/main/NEWS>
- CVE-2023-4863:
  <https://nvd.nist.gov/vuln/detail/CVE-2023-4863>
