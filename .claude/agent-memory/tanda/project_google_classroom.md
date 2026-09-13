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

Ronda 2026-09-12 (informe de obra del corte 1): verificación A independiente = lint/tsc/build/--listFiles verdes;
`pnpm test` tenía 33 rojos PREEXISTENTES en main (`sitio/anatomy-by-chris/scraper.test.js:106`): Node >=25 trae
localStorage global undefined que tapa el de jsdom. Corregido en el test (reinstala `globalThis.jsdom.window.localStorage`),
sin commitear al cerrar la ronda. Hallazgo `@ts-expect-error node:fs` → TECHNICAL_DEBT ⚪ (arreglo `?raw`).
Verificación B, primer intento: "no escanea el curso" = `scraper.js:19` era método abreviado (`async escanearListado(){}`),
el plan pedía `async function` y obra se apartó; `executeScript` serializa → SyntaxError. Corregido (1 línea), sin commitear.
Deuda 🟠 #11: test de serialización. Lección: en planes con código inyectado, pedir el test de `toString()` explícito.
Verificación B, 2do intento: el escaneo SÍ termina (storage con 343 ítems google-classroom, G22 numeroOriginal 57), pero la
tarjeta "No se pudo contactar el sitio" tapa la lista (popup.js:2485). CONFIRMADO en la consola del popup (`ERR_BLOCKED_BY_RESPONSE.NotSameSite`; `/favicon.ico` → OK basic): con sesión, `classroom.google.com/`
responde 200 con `CORP: same-site` → el HEAD no-cors del popup (chrome-extension://, manda cookies) rechaza → internet=false.
`/favicon.ico` da 404 sin CORP. Radio: `background.js:539` abre `urlSondeoInternet` en la notificación de fallo → no cambiar
esa URL sola; separar sonda de "abrir portal" (urlListado) toca los 3 portales.
Entorno real: el dueño usa BRAVE (~/.config/BraveSoftware/Brave-Browser/Default), extensión id daameiendaidaagnimcbpmdjkpccfemh;
chrome.storage.local legible en `Local Extension Settings/<id>/000003.log`; la sonda-sw sigue cargada (inofensiva, sólo onClicked).
Claude in Chrome maneja ese mismo Brave pero no abre chrome-extension:// → el contexto del popup lo prueba el dueño.
Dueño decidió (2026-09-12): la notificación abre `urlListado`; el test de serialización (deuda #11) entra al mismo plan.
Plan: `docs/plan-classroom-corte-1-verificacion-b.md`. Test validado antes de escribirlo (4/4 con control negativo).
Lección de método: medir un fetch desde una pestaña NO equivale al contexto de la extensión (cookies + CORP) → pedir la consola del popup temprano.
Ojo: el informe de obra decía "verificación A en verde" con 33 rojos → siempre re-verificar.

Ronda 2026-09-12 noche: plan verif. B ejecutado (`e41e682`) y verificado por mí: 42 archivos/706 tests, lint/tsc/build
verdes, diff = plan, `urlSondeoInternet` en background.js sólo en CHANGELOG, favicon.ico en los 2 bundles. Push de la
rama lo bloquea el clasificador de auto mode → lo pushea el dueño.

**How to apply:** próxima ronda: el dueño corre la verificación B en Brave (plan verif. B §4.B primero, después checklist de `docs/ramas-en-revision.md` desde el paso 2);
después merge y plan del corte 2 (mapeo por ruta escrita + ADR-0016). `includes` y `.agents/skills/` ya están enrutados.
