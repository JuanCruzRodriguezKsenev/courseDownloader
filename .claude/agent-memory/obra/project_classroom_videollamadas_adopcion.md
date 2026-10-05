---
name: classroom-videollamadas-adopcion-plan12
description: Plan 12 videollamadas en Classroom con reconocimiento autocontenido, orden prioritario al tope, chip visual y omisión en adopción (78 archivos, 1135 tests)
metadata:
  type: project
---

# Classroom: Videollamadas y descarte en adopción (Plan 12)

## Puntos clave de la ejecución
- **Paso V-1 (`sitio/google-classroom/scraper.js` y `scraper.test.js`)**:
  - Reemplazo de `esEnlaceMeet` por `esEnlaceVideollamada` dentro de `escanearListado` (autocontenido, sin dependencias externas).
  - Reconocimiento por host (`meet.google.com`, `zoom.us`, `teams.microsoft.com`, `teams.live.com`, `webex.com`, `meet.jit.si`, `jitsi.net`) y regex fallback ante fallo de URL.
  - `clasificarAdjunto` devuelve acceso con `esVideollamada: true`.
  - Mapeo en resultado (bloque 14) preserva `esVideollamada: item.esVideollamada === true ? true : undefined`.
  - Test 5e reescrito cubriendo casos positivos y negativos.
- **Paso V-2 (`core/puertos/sitio.ts` y `popup.js`)**:
  - `EnlaceListado` gana `esVideollamada?: boolean` con comentario.
  - `popup.js` copia `esVideollamada: item.esVideollamada` al construir las nuevas clases escaneadas.
  - Sin test unitario directo en `popup.js` por ser script monolítico orquestador (anotado en hallazgos).
- **Paso V-3 (`popup/features/destino.js`, `destino.test.js`, `listaClases.preact.js`, `listaClases.preact.test.js`, `styles/list.css`)**:
  - `compararPrioridadDestino` antepone `esVideollamada`, luego `sinAsignar` y finalmente el resto.
  - Chip `.chip-videollamada` («📹 Videollamada») con title explicativo en `FilaClase` (ambas vistas: disponibles y cola).
  - Estilo CSS en `styles/list.css` sin animación ni transición.
  - 3 tests en `destino.test.js` y 2 tests en `listaClases.preact.test.js`.
- **Paso V-4 (`core/destino/vistas.test.ts`)**:
  - Test comprobando que ítems con `idArchivo` `acceso:<url>:<título>` se listan en el editor y con acción `omitir` se persisten en `cursos.<clave>.omitidos`.
  - Scripts de humo del backend verificados con 0 errores.
- **Paso V-5 (Controles negativos y batería final)**:
  - Control negativo 1: forzar `false` en `esEnlaceVideollamada` produce fallo rojo esperado en test 5e.
  - Control negativo 2: quitar `esVideollamada` en bloque 14 produce fallo rojo esperado en test 5e.
  - Batería completa verificada por `verificador`: 78 archivos pasados, 1135 tests pasados (+6 tests netos).
