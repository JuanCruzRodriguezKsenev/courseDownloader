---
proyecto: courseDownloader
tipo: diseño
revisado: 2026-09-30
---

# Moodle del LINTI (`catedras.linti.unlp.edu.ar`) — medición para el cuarto portal

Medido el 2026-09-30 sobre el curso `course/view.php?id=1352` (ISO-CSO, segundo semestre 2026), con el script de diagnóstico de la ronda y con `fetch` desde la consola, sesión iniciada en el navegador. **No es una spec ni un plan**: es lo medido, para que la spec arranque de ahí.

## Veredicto: portal barato

- Moodle 4.5 (`2024100708`), tema Boost, formato de curso `topics`. HTML **renderizado en el servidor**: la página del curso trae las 6 secciones y las 22 actividades sin XHR de contenido.
- Sin señales de portal caro: 0 clases ofuscadas, 0 shadow roots, 0 iframes, sin framework de SPA, sin paginación ni scroll infinito.
- Marcado estable de Moodle: `li[data-for="cmitem"]` con `id="module-<id>"`, clase `modtype_<tipo>` y `data-activityname`; secciones con `data-for="section"`. **El índice lateral duplica cada actividad**: contar con la clase `modtype_*` sobre todo el documento da el doble (se midió mal una vez: 16/6/10 en vez de 8/3/5).
- Autenticación: la cookie de sesión del navegador, igual que Ramón Net (caso 1 de «¿cómo se autentica el portal?» en `~/Dev/courseDownloader/docs/multisitio-diseno.md`). No hay decisión que tomar.

## Qué hay en el curso medido (22 actividades)

| Tipo | Cant. | Cómo se resuelve |
|---|---|---|
| `resource` | 8 | `mod/resource/view.php?id=…` redirige **directo** a `…/pluginfile.php/<ctx>/mod_resource/content/1/<archivo>` (8 de 8, sin página intermedia). El `Content-Disposition` llega con el nombre roto (`RÃ©gimen`): **el nombre sale de la URL**, no del header. |
| `folder` | 3 | `mod/folder/view.php?id=…` lista cada archivo como `pluginfile.php/<ctx>/mod_folder/content/0/<subcarpeta>/<archivo>?forcedownload=1`. **La estructura de subcarpetas viaja en la ruta.** «Material y Transparencias» trae 11 PDF en 3 subcarpetas (`Tema 1…`, `Tema 2…`, `Tema 3…`, un nivel); las otras dos son planas (3 y 2 archivos). Se resuelve con `fetch` con sesión: **no hace falta clickear nada** (en Classroom se clickea porque la SPA expande en la misma página; Moodle navega a otra). |
| `url` | 5 | Dos de los tres medidos muestran la página intermedia con el destino leíble (`t.me/…`, un blog); el de WhatsApp responde con un 302 directo a un dominio externo y el `fetch` desde la pestaña lo bloquea por CORS: **ese destino no se lee sin navegar**. |
| `forum` | 2 | Sin medir. |
| `quiz` | 2 | Sin medir. |
| `page` | 1 | Sin medir. |
| `choice` | 1 | Sin medir. |

## Lo que falta decidir (es del dueño, va a la spec)

- Qué se hace con los **`url`**: ¿acceso `.md` como en Classroom (RN-17)? Y con los que redirigen sin página intermedia, ¿se guarda la URL de Moodle (`mod/url/view.php?id=…`, que redirige con la sesión)?
- Qué se hace con **foros, cuestionarios, páginas y encuestas**: ¿se ignoran?
- Cómo encaja en el **índice de destino** de `~/Boveda/Areas/Facultad` (`cursos` ya admite el prefijo de portal: `moodle-linti:<id>`; la spec del destino lo previó para «los Moodle de la UNLP»): temas ↔ secciones del curso, y asociación a materia.
- El `id` del portal (es el nombre de carpeta en disco y media identidad de cada clase: decisión de datos, no de estilo).

## Cómo seguir

1. Cerrar el corte 2 de Classroom (planes 00-08 en `Planes/`): si no, el portal nuevo nace sin raíz propia ni índice.
2. Ronda de spec con el dueño (skill `spec`) sobre las preguntas de arriba.
3. Plan siguiendo `docs/multisitio-diseno.md` §«Cómo escribir un portal nuevo»: cuatro archivos en `sitio/<portal>/`, registro, `host_permissions` de `catedras.linti.unlp.edu.ar`, entrypoints y verificación en Brave. El fixture es el HTML del curso, **sin datos personales**.
4. Medir antes de planificar: los `forum`/`quiz`/`page`/`choice` si la spec los incluye, y otro curso para confirmar que el marcado es el mismo.
