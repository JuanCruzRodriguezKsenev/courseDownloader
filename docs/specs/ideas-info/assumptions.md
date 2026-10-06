# Traza de supuestos — IDEAS (LIDI, Informática)

Decididos por el dueño el 2026-10-05 (ronda de 4 preguntas):

| # | Decisión | Estado |
|---|---|---|
| 1 | Las secciones «Notas…» **se bajan** como cualquier otra (5 PDF de resultados) | resuelto (contra mi recomendación; ver filo en la spec) |
| 2 | Nombre del archivo = el del header `content-disposition`, leído al escanear | resuelto |
| 3 | Las secciones sin archivos (Información de cátedra, Promoción) se guardan como `.md` con su texto | resuelto |
| 4 | La Medioteca se incluye | resuelto |

Asumidos por mí (no preguntados; el dueño puede rechazarlos):

| # | Supuesto | Estado |
|---|---|---|
| 5 | Portal nuevo `ideas-info`, con destino por índice (`.course-downloader.json`) igual que `moodle-linti` | asumido |
| 6 | Multicurso desde `/home` desde el primer día (regla del dueño: todos los portales) | asumido |
| 7 | Clave de curso `ideas-info:<slug>` (el slug de la URL) | asumido |
| 8 | Tema de cada ítem = nombre de su sección (la Medioteca usa el tema «Medioteca») | asumido |
| 9 | Tope por curso 120 s (no 60): sólo leer los nombres de 32 archivos cuesta ~22 s y listar ~28 s | asumido |
| 10 | El `.zip` se baja tal cual como cualquier archivo; de qué sección sale es M-4 | asumido |
| 11 | Un archivo se baja con la cookie del navegador; sesión vencida pausa con aviso | asumido |
| 12 | Sin video | hecho medido |

**A medir:** M-1 (la cookie HttpOnly llega en el `fetch` del service worker), M-2 (tiempo real del escaneo de un curso con lectura de headers), M-3 (cómo se ve el texto de «Información de cátedra» y «Promoción» en `Show/<guid>`), M-4 (de qué sección sale el `.zip`), M-5 (cómo se ve `/home` con 2 o más cursos y si tiene paginación).
