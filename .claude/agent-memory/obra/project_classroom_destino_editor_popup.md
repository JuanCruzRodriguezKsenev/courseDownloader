---
name: classroom-destino-editor-popup
description: Apertura del editor web de adopción del corte 2a de Classroom desde el popup (servidor Bun en puerto 3001)
metadata:
  type: project
---

# Classroom: Editor de adopción desde el popup (Corte 2a)

## Puntos clave de la ejecución
- **Alcance**: `docs/plan-classroom-destino-2a-editor-popup.md`. Montaje del editor en el servidor existente del puerto 3001 bajo `/adopcion/` y enlace directo 🗂️ en el popup.
- **Backend (`backend/adopcion/editor.js` & `backend/server.js`)**:
  - `editor.js`: extracción de `opcionesPorDefecto()` y `crearManejadorEditor(opts, prefijo = "")`. Maneja `prefijo/`, `prefijo/api/datos`, `prefijo/api/guardar` y `prefijo/api/ensayo`.
  - Redirección 301 de `GET prefijo` a `prefijo/` para resolver `fetch` relativos correctamente.
  - Guardia de host: rechaza con 403 (`"host no permitido"`) si `url.hostname` no es `127.0.0.1` o `localhost` (previene DNS rebinding contra el 3001).
  - Guardia de origen: en `POST` de `/api/guardar` y `/api/ensayo`, rechaza con 403 (`"origen no permitido"`) si `req.headers.get("origin")` difiere de `url.origin`.
  - `server.js`: monta `manejarAdopcion` para `/adopcion` y `/adopcion/*` tras OPTIONS y antes del 404 final.
- **Frontend / Popup (`entrypoints/popup/index.html` & `styles/components/help-button.css`)**:
  - Enlace estático `#ui-link-adopcion` con clase `.btn-help-icon`, `target="_blank"`, `rel="noopener"`, apuntando a `http://127.0.0.1:3001/adopcion/`. Sin JS ni feature (sigue precedente de onboarding).
  - `help-button.css`: `text-decoration: none;` en `.btn-help-icon`.
- **Docs**:
  - `docs/deployment.md`: párrafo explicativo fuera de la tabla de endpoints aclarando que `/adopcion/` es temporal del corte 2a y opera en el navegador.
  - `docs/ramas-en-revision.md`: paso A-2 actualizado para abrir con 🗂️ desde el popup sobre el 3001.
- **Verificación A**:
  - Batería delegada a `verificador`: 50 archivos / 837 tests verdes, 0 errores/warnings lint, typecheck limpio, build OK.
  - `(p)`: 0 fetch absolutos en `editor.html`.
  - `(q)`: sólo `backend/server.js` importa `adopcion/editor`.
  - `(r)`: 1 coincidencia de `ui-link-adopcion` en el HTML compilado.
  - Modo suelto en 3002: pasos (a)-(n) y control negativo pasados idénticos a la versión previa.
  - Montaje en 3001: pasos (s)-(ac) verificados (redirección 301, datos 7 cursos / 45 temas / 366 archivos, ensayo código 1 por choques, guardias de origen y host 403, 404 en ruta no encontrada, y sha256 idéntico garantizando que nada escribió en TSV reales).
