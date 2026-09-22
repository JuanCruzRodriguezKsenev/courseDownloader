---
name: classroom-adjuntos-sin-resolver
description: Detección y descarte de adjuntos a medio hidratar en Classroom con aviso en UI
metadata:
  type: project
---

# Classroom corte 1: No listar adjuntos a medio hidratar

## Puntos clave de la ejecución
- **Señal de placeholder**: El contenedor `[data-attachment-id]` aparece antes de hidratar el material; en esa ventana el ancla apunta a `drive.google.com/open?id=` y lleva `aria-label="Archivo adjunto: Desconocido: Archivo de Drive"`. Como las etiquetas de texto están localizadas por idioma, la señal estable es el href (`!/drive\.google\.com\/open\?id=/.test(href)`).
- **Espera y descarte en scraper (`sitio/google-classroom/scraper.js`)**: El paso 7 espera que `adjuntosSinResolver(li).length === 0`. Se agregó paso 7b para ítems que ya venían abiertos en Trabajo en clase, y espera análoga en paso 9 para Novedades con timeout `tiempos.hidratacion` (10000 ms). Los que siguen sin resolver se descartan (para no generar `.md` falsos) y su cuenta se retorna en `ResultadoEscaneo.adjuntosSinResolver`.
- **UI no bloqueante**: La cuenta no utiliza `ResultadoEscaneo.aviso` (que reemplaza el listado), sino `ctx.nota` en el view-model de `ListaClases.render` (sólo en Disponibles). La isla #4 (`listaClases.preact.js`) pinta `<p class="lista-nota">` arriba de las filas dentro de `modo:'lista'` respetando la regla de un solo dueño para `#ui-list`.
- **Tests**: +2 en `sitio/google-classroom/scraper.test.js` (test 12: hidratación demorada con setTimeout a 50 ms; test 13: descarte y conteo de adjunto no resuelto) y +1 en `popup/features/listaClases.preact.test.js` (renderizado de `.lista-nota` antes de la primera fila). Total de la suite: 43 archivos, 719 tests pasados.
