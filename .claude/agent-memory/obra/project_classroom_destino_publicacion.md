---
name: classroom-destino-publicacion
description: Sugerencia de destino en adopción Classroom considerando el título de la publicación (RN-7a) y regex links? en Teorias (RN-7b)
metadata:
  type: project
---

# Classroom: Sugerencia de destino por título de publicación (Corte 2a)

## Puntos clave de la ejecución
- **Alcance**: `docs/plan-classroom-destino-2a-publicacion.md` sobre `docs/specs/classroom-destino/spec.md` (RN-6, RN-7, RN-7a, RN-7b).
- **Lógica de destino (`core/destino/carpetas.ts`)**:
  - RN-7b: se amplió la regla de videos en `REGLAS_DESTINO` a `/video|simulaci|\blinks?\b/i` asignando `Teorias`.
  - RN-7a: nueva firma `sugerirDestino(tema?, publicaciones = [])`. El tema manda siempre. Si ninguna regla matchea el tema, se evalúan las publicaciones por adjunto: el destino no-`"."` más repetido gana si suma estrictamente más de la mitad (`maxCuenta * 2 > publicaciones.length`), devolviendo `{ destino, regla: true }`. Si no, `{ destino: ".", regla: false }`.
- **Propagación de `publicacion`**:
  - `sitio/google-classroom/scraper.js`: `item.material` se incluye como `publicacion: item.material` en cada objeto de `enlaces`.
  - `core/puertos/sitio.ts`: `EnlaceListado` tipa opcionalmente `publicacion?: string`.
  - `popup.js`: `aplicarEnlacesEscaneados` estampa `publicacion: item.publicacion` en el ítem de la lista persistente.
- **Generación de TSV (`backend/adopcion/generar.js`)**:
  - `paresTemaCurso` acumula `{ cant, publicaciones: [] }` pasando `item.publicacion ?? ""`.
  - Se calcula `sugerirDestino(tema, publicaciones)` una sola vez por par, poblando `temas.tsv` y compartiéndolo con la columna `carpeta` de `archivos.tsv` por `parKey`.
  - Resumen por consola informa `Ítems sin título de publicación: n` y advierte si la lista es anterior al campo.
- **Verificación A**:
  - (a) callers únicos de `sugerirDestino`: `carpetas.ts` y `generar.js:231`.
  - (b) conteos de `publicacion` >= 1 en los 4 archivos.
  - (c) ensayo sobre storage actual: 366 ítems (55/4/8/299), temas con regla=no bajó a 10 (por los dos temas Links de Física I), 366 sin publicación con aviso de lista previa, y 2 choques.
  - (d) Links-Módulo I y II en `Teorias si`.
  - (e) 18 filas de Links en `Teorias`.
  - (f) diff de `temas.tsv` contra `~/Descargas/adopcion-classroom` vacío ignorando Links.
  - Controles negativos obligatorios:
    1. Sacar `publicacion` en `scraper.js`: cayó test 5b (`expected undefined to be 'TP 1'`).
    2. Cambiar `>` por `>=` en `carpetas.ts`: cayó test T5 (`expected Practicas to deeply equal .`).
    3. Invertir orden tema/publicaciones: cayó test T4 (`expected Parciales to deeply equal .`).
- **Batería de verificación**:
  - Delegada al subagente `verificador`: 50 archivos pasados, 843 tests pasados (837 + 6), 0 errores/warnings en lint, typecheck limpio, build exitoso.
