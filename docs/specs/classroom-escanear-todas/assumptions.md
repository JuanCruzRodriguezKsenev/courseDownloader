# Supuestos — Classroom: escanear todos los cursos

Traza de la spec `spec.md` (skill `spec`). Estados: `asumido` · `rechazado` · `resuelto` · `a medir`.

**Historia (2026-09-25)**: como alumno, cuando estoy en la portada de Google Classroom ("Todas mis
clases", `/u/<n>/h`), quiero que la extensión escanee todos mis cursos de una vez, en vez de entrar
curso por curso. Orden del dueño: esto, después el destino (`docs/specs/classroom-destino/`),
después el rediseño de la extensión.

**Contexto ya decidido (no son supuestos)**:
- El escaneo de un curso (Trabajo en clase + Novedades, D11; "Ver más", D13; identidad del curso
  por sidebar/`<h1>`) está en `main` desde el 2026-09-25 → `docs/portal-google-classroom-diseno.md`.
- El scraper navega **dentro de la SPA** con `click()` sobre links de `nav` (`scraper.js:298`,
  `:501`, `:577`), así que un script inyectado sobrevive a cambiar de vista.
- Classroom no pinta con la pestaña en segundo plano (diseño §8).
- Hoy la portada no es "página del sitio": `esPaginaDelSitio` sólo reclama `/c/` y `/w/`
  (`sitio/google-classroom/config.ts:53-56`).
- El resultado de un escaneo trae **una** `materia` (`scraper.js:39`) y el popup guarda **una**
  lista con **un** origen (`popup.js:1516-1517`).
- Cerrar el popup a mitad de escaneo descarta el resultado (`TECHNICAL_DEBT.md`, ⚪ abierto).
- M2 (2026-09-12): 8 cursos, 6 activos + 2 archivados en `/u/<n>/h/archived`.

## Ronda 1 — 2026-09-25

| # | Categoría | Supuesto | Estado |
|---|---|---|---|
| 1 | Alcance | En la portada el popup ofrece un botón "Escanear todos los cursos"; **no** escanea solo al abrirse | resuelto |
| 2 | Alcance | Entran los cursos activos **y** los archivados | resuelto |
| 3 | Alcance | De cada curso se escanea lo mismo que hoy: Trabajo en clase + Novedades | resuelto |
| 4 | Alcance | Termina en la lista; no descarga nada automáticamente | resuelto |
| 5 | Alcance | Los cursos sin material (MC6, Q5) no aparecen en la lista, sólo en el resumen | resuelto |
| 6 | Reglas | Recorre los cursos en la misma pestaña, uno tras otro, en el orden de la portada y los archivados al final | resuelto |
| 7 | Reglas | Si un curso falla, se saltea y se sigue; al final se listan los fallidos con su motivo | resuelto |
| 8 | Reglas | Si la pestaña pasa a segundo plano o el usuario navega a mano, se corta y se conservan los cursos ya completos | resuelto |
| 9 | Reglas | Cada curso baja a su carpeta de hoy, `raíz/google-classroom/<curso>/` | resuelto |
| 10 | Reglas | Un mismo archivo de Drive en dos cursos aparece dos veces, una por curso | resuelto |
| 11 | Reglas | La lista de "todos" reemplaza a la lista guardada; abrir el popup después dentro de un curso vuelve a escanear ese curso, como hoy | resuelto |
| 12 | Reglas | 🔄 en la portada vuelve a recorrer todos los cursos | resuelto |
| 13 | Datos | El resultado se guarda en storage y sobrevive a cerrar el popup | resuelto |
| 14 | Errores | Cerrar el popup a mitad de recorrido **no** lo corta: sigue en la pestaña y al reabrir se ve el progreso o el resultado | resuelto |
| 15 | Errores | Cada curso conserva su tope actual (180 s); no hay tope global | resuelto |
| 16 | UX | La tarjeta de escaneo muestra el progreso: "Curso 3 de 8: MC2 2025" | resuelto |
| 17 | UX | La lista aparece recién al terminar, no curso a curso | resuelto |
| 18 | UX | La lista se agrupa por curso, con encabezado y conteo; sin controles nuevos (el rediseño decide el resto) | resuelto |
| 19 | UX | Al terminar hay un resumen: "8 cursos: 6 con material, 2 vacíos, 0 fallidos" | resuelto |
| 20 | UX | Antes de arrancar avisa la duración estimada y que la pestaña quede al frente | resuelto |
| 21 | No funcionales | Los 8 cursos se escanean en menos de 6 minutos | resuelto |
| 22 | No funcionales | El escaneo de un solo curso no cambia en nada | resuelto |
| 23 | Integraciones | Sólo la cuenta `/u/<n>` de la pestaña actual | resuelto |

**Respuesta del dueño (2026-09-25)**: *"aprobado, sin leer"*. Los 23 pasan a `resuelto` con su
definición original, **sin discusión**: ninguno fue examinado por el dueño. La spec lo avisa en su
encabezado y señala los tres de más filo (14 → RN-15, 11 → RN-16/RN-18, 8 → RN-9).

## Hechos separados de los supuestos (no se preguntan, se miden)

- **21 (menos de 6 min)** queda como NFR-1 pero depende de **M-1** (cronometrar los 8 en Brave).
- **2 (archivados)**: **M-2 cerrado** el 2026-09-25 en Brave — portada → archivadas → curso → portada navega todo por la SPA (una marca en `window` sobrevive). Hoy: 5 activos + 2 archivados.
- **6 (orden de la portada)**: **M-3 cerrado** el 2026-09-25 sobre las muestras — la portada trae
  los 6 activos sin "Ver más" y el link a archivadas; la página de archivadas enumera los 8.

## Derivados encontrados al escribir (van a la próxima ronda si el dueño lee)

- **D-1** — Abrir el popup a mitad del recorrido cae en una página de curso y el disparo de hoy
  escanearía ese curso encima → escrito como RN-16 y fila 1 de la tabla de decisión.
- **D-2** — Al terminar, ¿la pestaña vuelve a la portada? → PA-1 (sin decisión: queda donde está).
- **D-3** — Cerrar la pestaña de Classroom a mitad → A7 (se conservan los completos).
