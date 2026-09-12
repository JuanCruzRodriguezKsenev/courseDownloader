---
name: google-classroom
description: Portal 3 (Google Classroom) en medición desde 2026-09-12; decisiones D1–D12, resultados M0–M2 y qué destraba la próxima ronda
metadata:
  type: project
---

Classroom es el 3er portal; después viene Moodle. Doc: `docs/portal-google-classroom-diseno.md` (D1–D12, §8 resultados).
Sonda descartable: `docs/muestras/google-classroom/sonda-sw/` (gitignorada + ignorada por eslint), baja a
`~/Descargas/medicion-classroom/`; yo muevo lo medido a `docs/muestras/google-classroom/`.

Hecho: M0 (SW manda cookies; `authuser=N` obligatorio), C1, M1 (abrir ítems con click), M1b (espera por estabilidad alcanza),
M2 en 6 cursos activos. 8 cursos: 6 activos + 2 archivados (Bianchi `Fisica_II_G25_2026`, `MB5 2024`). Palacio = Física II G22.
Decidido por el dueño: D9 destino en ~/U.N.L.P con mapeo por CURSO y tema (rompe contrato de disco → ADR nueva),
D10 videos/YouTube/vínculos = acceso .md. Decidido por evidencia: D11 escanear también Novedades (19 adjuntos sólo ahí),
D12 nombres repetidos en una carpeta → título del material antes de la extensión, sólo para el grupo.

**Why:** defectos silenciosos medidos: lista cortada (C1), adjuntos perezosos, Novedades, choques de nombre en 2/6 cursos,
"ya descargado" con `includes` y sin nombre saneado (`popup.js:1508-1519`, afecta Anatomy en main), curso vacío espera 20 s.

Trampas medidas en Chrome (2026-09-12): (1) con la pestaña en segundo plano Classroom NO pinta → toda medición o escaneo
con la pestaña al frente; (2) cada tema muestra 10 ítems + `button[aria-label="Ver más publicaciones"]` (en todos los temas;
`disabled` cuando ya cargó todo) → la "espera por estabilidad" NO alcanza; retiré M1b por eso. Sonda guarda por el server Bun.

M3 ✅: pagina de a 10; señal = botón VISIBLE y habilitado → click, esperar que crezca, repetir (`disabled` = cargando). → D13.
Medición COMPLETA al 2026-09-12 (evidencia en docs/muestras/google-classroom/{click,recorrido-1..4}). Totales: ~296 adjuntos
en Trabajo en clase + ~52 sólo en Novedades, en 8 cursos.

M4 ✅: "Novedades" por el nav del curso es navegación interna (el script sobrevive) → un escaneo, una inyección.
Dueño decidió (2026-09-12): DOS cortes; mapeo por ruta escrita (el selector del backend es PowerShell y cambia la raíz
de todos los portales); Novedades → subcarpeta `Novedades` por defecto (corte 2).
Plan corte 1: `docs/plan-classroom-corte-1.md`, rama `classroom-corte-1`. Claves del plan: `credencialesAdjunto` opcional
en PuertoSitio, rechazo de HTML en rama adjunto, `nombreEnDisco` (réplica exacta del backend; sanitizarTexto colapsa
espacios), "ya descargado" exacto para adjuntos, `ResultadoEscaneo.aviso` + card `portal`, modulo = "curso › tema",
accesos = `acceso:<url>:<título>` resueltos a `data:` URL (sin tipo nuevo en la identidad).

**How to apply:** próxima ronda abre con el informe de `obra`: verificar A de forma independiente (subagente verificador),
enrutar hallazgos, y la verificación B la corre el dueño en Chrome. Después: plan del corte 2 (mapeo + ADR-0016). Después: plan del corte 1
para `obra` (probablemente partido: escaneo+descarga a carpeta aparte, y destino con mapeo + ADR).
Hallazgos sin enrutar a TECHNICAL_DEBT: `includes` de popup.js:1512; `AGENTS.md:150` cita `.agents/skills/` inexistente.
