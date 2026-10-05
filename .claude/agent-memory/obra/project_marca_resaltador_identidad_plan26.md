---
name: Marca Resaltador, identidad (Plan 26)
description: Identidad de marca Resaltador (tokens semánticos en variables.css, clasificación en 22 hojas CSS, exportación de íconos SVG->PNG, wordmark Bricolage Grotesque empaquetado y carpeta por defecto en backend).
metadata:
  type: project
---

# Marca «Resaltador»: identidad (Plan 26)

- **Tokens de diseño (`styles/variables.css`)**:
  - Reemplazo del naranja heredado por `--accent-brand: #FFD60A` en ambos temas.
  - Nuevos tokens semánticos: `--accent-brand-text: #8A6D00` (claro) / `#FFD60A` (oscuro) para legibilidad de texto sobre fondos claros; `--accent-brand-line: #E6BE00` (claro) / `#FFD60A` (oscuro) para bordes, halos y aros de foco; `--accent-brand-hover` y `--glow-brand`.
  - Renombre del botón sincronizar disco: `--accent-disco` (#1C1C1E tinta en claro / #F2F0E6 tiza en oscuro) y `--text-on-disco`.
- **Clasificación y renombre de usos en hojas de estilo**:
  - Clasificación de los 22 archivos CSS y scripts inline (`queue.js`, `core/puertos/sitio.ts`, `listaClases.preact.js`) distinguiendo texto (`--accent-brand-text`), bordes/aros (`--accent-brand-line`), rellenos con texto (`--accent-brand` + `--text-on-brand`) y translúcidos (`--accent-brand-rgb`).
  - Eliminación total de variables y literales viejos (`--accent-orange`, `--text-on-orange`, `--accent-cyan-disco`, etc.).
- **Íconos (`public/icons/`)**:
  - Exportación desde `docs/marca/logo.svg` a PNG con `rsvg-convert` en 16x16, 48x48 y 128x128.
  - Revisión visual del ícono de 16 px: flecha negra y trazo biselado amarillo nítidos con buen contraste sobre el fondo lino.
- **Wordmark (`entrypoints/popup/main.js`, `index.html`, `styles/components/header.css`)**:
  - Dependencia empaquetada `@fontsource/bricolage-grotesque` (subset latino, peso 800, sin llamadas de red a Google Fonts).
  - Markup `<h4 class="wordmark">Course <span>Downloader</span></h4>`.
  - Resaltado con `linear-gradient` en `Downloader` y contorno en modo oscuro (`-webkit-text-stroke: 1px var(--bg-main); paint-order: stroke fill`).
  - Crecimiento acotado del bundle: 356K -> 404K en disco (+42.3 kB en total wxt con woff/woff2).
- **Carpeta por defecto del backend (`backend/destino/raizPorDefecto.js`, `backend/config.js`)**:
  - Función pura `elegirRaizPorDefecto` que preserva `Downloads/RamonNet_Turbo` si ya existe en disco, o usa `Downloads/CourseDownloader` para instalaciones nuevas.
  - Test suite pura con 3 casos en `backend/destino/raizPorDefecto.test.js`.
- **Compuerta y verificación**:
  - 82 archivos / 1242 tests (+3 tests respecto a la baseline 1239 de Plan 22), lint 0, tsc limpio, build ok.
