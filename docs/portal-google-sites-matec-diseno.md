# Portal nuevo: Google Sites Mate C — diseño y adaptador

**Estado al 2026-10-01:** 🔬 Medición completa. Spec aprobada en [`specs/google-sites-matec/spec.md`](./specs/google-sites-matec/spec.md).
**Diseño canónico en Bóveda:** `~/Boveda/Proyectos/courseDownloader/Diseños/Google Sites Mate C - diseño y medición.md`.
**Plan de ejecución:** `~/Boveda/Proyectos/courseDownloader/Planes/11 - Sites-MateC El adaptador de la Videoteca y accesos.md`.
**Autor:** tanda (Antigravity, Gemini 3.8 Flash High)
**Firmado:** tanda agy 3.8 flash high

---

## Resumen del portal

- **Host y alcance:** `https://sites.google.com/ing.unlp.edu.ar/matec*` (Videoteca de Matemática C).
- **Estructura:** 9 subpáginas temáticas (`series`, `sistemas`, `matrices`, `espacios`, `transformaciones`, `autovalores`, `diferenciales`, `fourier` y `autoevaluaciones`).
- **Contenido verificado (128 elementos):**
  - **28 PDFs** en Google Drive: se descargan binarios vía `/api/bypass-stream` con `credencialesAdjunto: "include"`.
  - **8 videos** en Google Drive (.mp4/.MOV): se guardan como accesos directos `.md` con frontmatter (`tipo: acceso`).
  - **81 videos** en YouTube: se guardan como accesos directos `.md`.
  - **11 formularios** Google Forms: se guardan como accesos directos `.md` bajo `Autoevaluaciones/`.
- **Destino e índice:** Mapea directamente sobre las 9 carpetas de `~/Boveda/Areas/Facultad/Ingenieria/Matematica C/`.

---

Firmado: tanda agy 3.8 flash high
