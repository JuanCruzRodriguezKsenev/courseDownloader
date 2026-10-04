# 0019 — Raíz de destino por portal y el backend decide lo descargado

**Fecha**: 2026-09-30
**Estado**: Aceptada
**Contexto previo**: [ADR-0010](0010-el-sitio-es-del-item.md) (el sitio es del ítem), [ADR-0015](0015-un-solo-repo-para-extension-y-backend.md) (un solo repo), [ADR-0017](0017-indice-de-destino-en-la-raiz.md) (índice de destino en la raíz), [ADR-0018](0018-raiz-en-la-boveda-indice-versionado.md) (raíz en la bóveda).
**Diseño de ejecución**: `docs/specs/classroom-destino/spec.md`, `Planes/01 - 2b-1 Backend raíz por portal y servicio del índice.md`.

## Contexto

El corte 2b de Google Classroom hace que la extensión descargue directamente al árbol del dueño según las reglas de asociación e indexación de destino. Este cambio enfrentaba dos limitaciones del diseño histórico:

1. **Una sola raíz compartida para todos los portales**: `backend/config.js` guardaba una única variable `CARPETA_RAIZ_VIDEOS` y el endpoint `/api/seleccionar-carpeta` la reemplazaba globalmente guardando `{ rutaRaiz }` en `config_usuario.json`. Classroom exige su propia raíz (`~/Boveda/Areas/Facultad`, fijada por ADR-0018) sin alterar la raíz de Ramón Net ni la de Anatomy.
2. **La determinación de "ya descargado" requiere acceso al disco**: Antes se comparaban nombres de archivo planos en la extensión (`popup.js`, `escanearDisco`). Sin embargo, según la especificación de destino (RN-18 a RN-22), "ya descargado" depende de consultar el índice por ID y comprobar si el archivo o su contenido (md5) existe físicamente en el árbol o fue movido/renombrado. La extensión en el navegador no tiene acceso al sistema de archivos local ni capacidad de calcular hashes ni resolver rutas seguras; el backend sí.

## Decisión

1. **La tabla de decisión se implementa una sola vez en TypeScript puro (`core/destino/decidir.ts`)**:
   Se definen `decidirAntes` (evalúa filas 0, 0b, 1, 2, 3, 4 previo a la descarga) y `decidirDespues` (evalúa filas 0, 5, 6 y rechazo al terminar la descarga). El backend importa directamente esta lógica del núcleo (apoyándose en el precedente de `backend/adopcion/`).
2. **Raíz configurable por portal en `config_usuario.json`**:
   El archivo de configuración pasa a admitir la estructura `{ "rutaRaiz": "...", "raices": { "google-classroom": "..." } }`.
   - La raíz efectiva para un portal es `raices[portal] ?? rutaRaiz`.
   - Para `google-classroom`, el valor por defecto si no está en `raices` es `RAIZ_FACULTAD` (`~/Boveda/Areas/Facultad`).
   - Ramón Net y Anatomy siguen utilizando `rutaRaiz`.
   - El endpoint `GET /api/seleccionar-carpeta` acepta el parámetro opcional `?portal=<id>`. Si se especifica un portal válido, actualiza `raices[portal]` y conserva `rutaRaiz`.
3. **El backend sirve el estado del índice mediante endpoints dedicados**:
   - `GET /api/destino/indice?portal=` lee y sirve el `.course-downloader.json` de la raíz del portal.
   - `POST /api/destino/estado` evalúa la tabla de decisión contra el disco y el índice para cada ítem escaneado, corrigiendo rutas automáticamente si un archivo fue movido (RN-19, AC-5, AC-5b) y reportando el estado (`descargado` o `pendiente`) sin que la extensión tenga que inventar o adivinar rutas en disco.
4. **Escritura protegida y decisión al finalizar descarga (D-6, D-7)**:
   - `accumulator.js` añade soporte para `preservarDestino` (omite borrado preliminar) y un gancho `alFinalizar` donde el backend ejecuta la decisión `decidirDespues` al completarse los fragmentos.
   - Si el archivo destino existe con contenido diferente y no es `.md`, se protege intacto el archivo del dueño rechazando con 409 `DESTINO_OCUPADO` (D-7, NFR-4).

## Consecuencias

- **A favor**: Desacoplamiento de raíces entre portales independientes; lógica de decisión unificada y testeable en Vitest; eliminación del riesgo de sobrescribir archivos ajenos o desconfigurar portales existentes; soporte nativo para archivos movidos o renombrados en la bóveda; acumulación segura sin pisar archivos preexistentes del dueño.
- **En contra**: El backend asume la responsabilidad de responder consultas de estado por lote antes de descargar, requiriendo que esté en ejecución para resolver si un ítem de Classroom ya está descargado.
