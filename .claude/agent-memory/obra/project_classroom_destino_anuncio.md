---
name: classroom-destino-anuncio
description: Nombrado de choques en Novedades por la primera frase del anuncio (RN-16a), resolución con sufijo _N y propagación a duplicados
metadata:
  type: project
---

# Classroom: Nombrado de choques en Novedades por anuncio (Corte 2a)

## Puntos clave de la ejecución
- **Alcance**: `docs/plan-classroom-destino-2a-anuncio.md` sobre `docs/specs/classroom-destino/spec.md` (RN-11, RN-12, RN-16, RN-16a).
- **Extracción de la primera frase (`core/destino/nombres.ts`)**:
  - `primeraFrase(texto)`: limpia saludos repetidos iniciales, muletillas (les compartimos, adjunto...), artículos iniciales, corta en el primer salto de línea o fin de oración (`\n|[.!?](?=\s|$)`), y toma hasta 8 palabras sin slugificar (el slug lo realiza `proponerNombre`).
- **Resolución de choques (`core/destino/choques.ts`)**:
  - `renombrarChoquesNovedades(filas)`: evalúa choques entre filas con `renombrable: accion === "copiar" && tema === "Novedades"` y frase no vacía. Propone nombre base con `primeraFrase + ext`.
  - Paso de residuo: si persisten choques (mismo anuncio como MC3), a la fila cuyo título original termina en `(N)` le añade `_N` antes de la extensión.
- **Scraper y propagación (`sitio/google-classroom/scraper.js`, `core/puertos/sitio.ts`, `popup.js`)**:
  - `textoDelAnuncio(post)`: toma el texto del elemento hermano anterior de `[data-include-stream-item-materials="true"]` recorriendo nodos sin usar `innerText` (incompatible con jsdom) y limitando a 500 caracteres.
  - Se propaga `anuncio` en `enlaces`, tipado en `EnlaceListado` y se persiste en `aplicarEnlacesEscaneados` en `popup.js`.
  - Fixture `sitio/google-classroom/__fixtures__/curso.html` actualizado con la estructura real del post.
- **Generación de adopción (`backend/adopcion/generar.js`)**:
  - Los ítems se acumulan en un array de filas en memoria, se ejecuta `renombrarChoquesNovedades`, se actualizan los nombres renombrados y los de sus filas con `accion === "duplicado"`.
  - Se reportan renombrados e ítems de Novedades sin anuncio en la consola.
- **Verificación A**:
  - (a) `anuncio` presente en los 4 archivos.
  - (b) `innerText` ausente en `scraper.js` (rc=1).
  - (c) Ensayo sobre storage actual: 0 renombrados (lista vieja), 45 sin anuncio, 2 choques, `archivos.tsv` y `temas.tsv` idénticos al de producción, y `diff cursos.tsv` sólo 2 líneas (docentes guardados).
  - Controles negativos:
    1. Sacar muletilla en `primeraFrase`: cayó caso 5.
    2. Sacar residuo en `renombrarChoquesNovedades`: cayó C2.
    3. Cambiar `previousElementSibling` por `nextElementSibling`: cayó test 5c.
- **Batería de verificación**:
  - Delegada al subagente `verificador`: 50 archivos pasados, 859 tests pasados (843 + 16), 0 errores/warnings en lint, typecheck limpio, build exitoso.
