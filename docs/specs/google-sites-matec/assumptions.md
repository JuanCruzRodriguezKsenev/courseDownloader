# Traza de supuestos — Google Sites Mate C

**Fecha**: 2026-10-01
**Autor**: tanda (Antigravity, Gemini 3.8 Flash High)
**Firmado**: tanda agy 3.8 flash high

| # | Supuesto | Estado | Decisión y porqué |
|---|---|---|---|
| 1 | `id` del portal = `sites-matec` | asumido | Nombre corto y disjunto de Classroom y Moodle. → RN-1 |
| 2 | Videos de Drive se guardan como enlaces .md | resuelto | Decisión del dueño (2026-10-01): sólo Ramón Net y Anatomy descargan video; Classroom, Moodle y Google Sites sólo guardan el link. → RN-3 |
| 2b | Sólo los 28 PDFs de Drive se descargan en binario | resuelto | Ejercitación y apuntes en PDF entran por `/api/bypass-stream`. → RN-2 |
| 3 | 81 videos de YouTube se guardan como accesos directos `.md` | asumido | La extensión no posee motor de transcodificación de YouTube (regla Classroom D10). → RN-3 |
| 4 | 11 cuestionarios de Google Forms como accesos directos `.md` | asumido | Son actividades interactivas en la nube; no son archivos binarios. → RN-4 |
| 5 | Escaneo recorre en paralelo las 9 subpáginas temáticas | asumido | La portada del sitio no tiene videos; el usuario no debe escanear subpágina por subpágina a mano. → RN-5 |
| 6 | Destino por índice versionado en Bóveda | asumido | La materia `Ingenieria/Matematica C` ya existe en `~/Boveda/Areas/Facultad` y en `.course-downloader.json`. → RN-8, RN-9 |
| 7 | Nombres de archivos con prioridad del nombre en Drive | asumido | Los PDFs en Drive traen nombres limpios de ejercitación (`Ej Matrices.pdf`). → RN-7 |
| 8 | Confirmación de virus para archivos grandes en Drive | asumido | Los videos `.mp4` y `.MOV` en Drive superan 100 MB y requieren seguir el token `confirm`. → RN-12 |
| 9 | Archivos idénticos por md5 no se reescriben | asumido | Sigue la regla estándar de destino de Classroom (`destino:RN-18`). → RN-11 |
