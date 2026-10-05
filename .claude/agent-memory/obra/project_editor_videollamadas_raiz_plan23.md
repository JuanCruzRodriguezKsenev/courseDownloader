---
name: Omitir videollamadas en bloque y raíz decidida en el editor (Plan 23)
description: Detección y omisión en bloque de videollamadas con chip 📹 en editor.html, selector con opción vacía inicial para temas sin regla y adopción de raíz decidida (regla 'si' con '.'), probado con suite unitaria y humo jsdom
metadata:
  type: project
---

# Omitir videollamadas en bloque y raíz decidida en el editor (Plan 23)

- **Núcleo (`core/destino/videollamada.ts` y `.test.ts`)**:
  - `DOMINIOS_VIDEOLLAMADA` (7 dominios) y `esEnlaceVideollamada(url)` replicando la lógica de `scraper.js` de Classroom.
  - `claveEsVideollamada(clave)` con regex `/^[^:]+:acceso:([^:]+):/` y decodificación protegida.
  - Test de deriva en `core/destino/videollamada.test.ts` contra `sitio/google-classroom/scraper.js` para asegurar paridad de dominios.
  - 11 tests unitarios cubriendo AC-6 (tabla de URLs y claves).
- **Vistas e índice (`core/destino/vistas.test.ts`)**:
  - Test AC-5 / RN-5: videollamadas omitidas previamente conservan acción `omitir` y una nueva llega como `copiar`.
- **Editor web (`backend/adopcion/editor.html`)**:
  - `temaSinDestino(tema)` unificado: `Boolean(tema) && tema.destino !== "-" && (tema.regla === "no" || !tema.destino)`. Destino `.` con regla `si` ya no se marca como problema.
  - Rótulos: `.` rotulado como `Raíz de la materia` (tanto a nivel de tema como por archivo).
  - Selector de tema: incluye `<option value="" disabled selected>— elegir carpeta —</option>` sólo cuando `isSinRegla`. Al elegir `.`, dispara `change` y pasa a `regla = "si"`.
  - «Aplicar reglas automáticas» (`btnAutoAll`): sólo toca temas que cumplen `temaSinDestino(t)`.
  - Grupo de videollamadas en cabecera (`#grupoVideollamadas`): botones `Omitir N videollamadas` y `Volver a ofrecerlas` con delegación de eventos y conteo reactivo.
  - Chip visual `📹 Videollamada` (`badge neutral`) en filas correspondientes a accesos de videollamada.
- **Humo jsdom (`backend/adopcion/humo-editor-videollamadas-raiz.js`)**:
  - Aserciones de AC-1 a AC-13 (omisión masiva, preservación de `ya-esta`, botón ausente en curso sin videollamadas, volver a ofrecer, chip 📹, paridad DOM/Core, raíz decidida, selector con opción vacía inicial y reglas automáticas).
  - Tres controles negativos validados durante la ejecución (regresión forzada en `temaSinDestino`, eliminación de opción vacía y mock falso de `esFilaVideollamada`).
- **Baseline de compuerta**:
  - 80 archivos / 1203 tests (+12 tests, +1 archivo).
