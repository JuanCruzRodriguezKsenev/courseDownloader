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
verdes, diff = plan, `urlSondeoInternet` en background.js sólo en CHANGELOG, favicon.ico en los 2 bundles. Push: el clasificador de auto mode
bloquea `git push` por iniciativa propia; con pedido explícito del dueño ("pushea") pasa.

Verif. B 2026-09-13: G22 = 57 ✅. Dueño reportó 2 problemas y DECIDIÓ (entran al corte 1 antes del merge, un plan con lo que
traiga la checklist): (1) popup re-escanea al abrir SIEMPRE en los 3 portales (popup.js:778/793/841; `listaPersistente` no
guarda de qué curso salió) → en Classroom mostrar la lista guardada si es del MISMO curso (idCurso de la URL), si no escanear;
hace falta 🔄 visible en la toolbar (hoy "Re-escanear" sólo aparece con escaneo muerto, popup.js:2296) — lo decidí yo.
(2) Explorar = PowerShell (backend/handlers.js:325) → en Linux usar xdg-desktop-portal FileChooser (activo: backend gtk en
Hyprland; python3+gi 3.56 disponible; script de prueba en scratchpad). Prueba 1: Response code 2 + log "Unhandled parent
window type" → el dueño CONFIRMÓ que apareció y la cerró (code 2 = cerrar ventana). Portal viable. Backend sin tests; contrato en docs/deployment.md:38.
C3 (batchexecute) 2026-09-13, dueño pidió medir sin tocar lo que anda: G22 no trae listado en el HTML (AF_initData 385 B); la carga
hace `dpT4Vd` ×13 (≈tema) y `sLc6hf` ×~50 (≈ítem); después, Ver más/abrir ítem NO piden nada. Claude in Chrome: read_network_requests
NO ve nada en Brave, y un hook XHR puesto después de cargar se pierde los listados; pestaña del grupo sin foco no pinta. → HAR manual
del dueño a docs/muestras/google-classroom/c3/g22.har (gitignorado). VEREDICTO: `dpT4Vd` (hrcw.qr, por tema, de a 10) trae
títulos/ids de ítem SIN Drive; 2do HAR con ítems abiertos (pisó g22.har): `t51ITc` ×49 (uno por ítem,
`[[idItem,[idCurso]]]`) trae nombre+id Drive+MIME → 57 ids (DOM 56). Tokens en WIZ_global_data (SNlM0e/FdrFJe/cfb2h).
VIABLE para Trabajo en clase; sin medir: Novedades, YouTube/vínculos, paginación. Corte 1 sigue DOM; API = corte aparte.
M5 (2026-09-13, consola del dueño, G22): abrir los 49 ítems DE UNA (click a todos + esperar 3 s de quietud) =
5529 ms, 57 adjuntos, 49/49 abiertos; de a uno (script con 800 ms) dio 56. Hoy scraper.js:282-298 abre de a uno
(~555 ms/ítem o 1,5 s sinAdjuntos). Dueño: entra al corte 1 antes del merge, plan aparte tras el de obra.
Plan: `docs/plan-classroom-corte-1-abrir-todos.md` (escrito sin commitear mientras obra ejecutaba el de lista guardada).
Orden: obra plan lista-guardada → yo verifico y commiteo docs → obra plan abrir-todos.
Ronda 2026-09-13 (informe lista-guardada, `4623593`): diff revisado = plan; loader OK (compuerta devuelve false sólo con
escaneo en curso; rama guardada apaga ella), escaneo vacío/abortado conserva lista Y origen (coherente). 🔄 re-habilitado en
`desbanearFiltros` = mismo patrón que el buscador (la región bloqueada lleva aria-disabled). `__pycache__/` → .gitignore (yo).
Plan abrir-todos ajustado: baseline literal 716, M5 después de "Verificación B (2026-09-13)".
Lección: primero di "no viable" con un HAR sólo de carga — no concluir sobre lazy-load sin capturar la interacción.
Plan escrito: `docs/plan-classroom-corte-1-lista-guardada-y-explorar.md` (origenListado + claveDeListado? + 🔄 + python portal).
Baseline esperado tras ejecutarlo: 43 archivos / 715 tests.

Ronda 2026-09-13 (informe abrir-todos `38ddd5b`, sin hallazgos): verificado por mí = diff idéntico al plan; 43/716, lint/tsc/build
verdes (verificador); contraste propio: test 11 contra scraper de `4f59c98` FALLA por tiempos (copia temporal en sitio/, borrada).
Ojo para B: el paso 7 nuevo espera también los li SIN botón (el viejo los salteaba) → si uno nunca expande, 30 s de espera.
Si G22 tarda ~30 s en B paso 1, es eso.

2026-09-13 "Explorar no anda": backend STALE (arrancado 00:09, selector Linux en 4623593 01:44; Bun no recarga) → corría el
handler viejo = powershell en Linux. Diagnóstico: `ps -o lstart= -p <pid>` vs `git log -1 --format=%ci -- backend/`; portal gtk
sin log. Popup traga el error (popup.js:924-929, sólo console.error). Lección: tras commits en backend/, pedir reinicio ANTES de B.

Análisis destino corte 2 (2026-09-13, pedido del dueño "que respete mi estructura"): hoy = raíz global + google-classroom/ +
curso saneado a minúsculas y _ (sanearNombreCarpeta texto.ts:97; backend .toLowerCase handlers.js:26/75/256; procesadorCola.ts:808).
Temas reales: G22 12 temas (6 "Guía de TP Nº N…", Laboratorios, Clases Teóricas Módulo I, Cronogramas, Videos, Bibliografía,
Pruebas diagnósticas); G25 7 (Presentaciones teóricas 20/26). Disco: Fisica 2/{Teorias/{Bianchi,Palacio},Practicas,Parciales}. CORREGIDO 2026-09-13: los " (N)" (P3.- Ley de Gauss-2023 (2).pdf,
02_CampoE (2).pdf) y "Palacio - Clase N…" son los nombres TAL CUAL en Classroom (G25/G22), no bajadas repetidas ni renombres →
no se renombra nada y la igualdad exacta los reconoce. Tamaño: t51ITc NO trae bytes ni md5 (buscado 930537 en el HAR) →
sólo se sabe al bajar. Fotos WhatsApp Prog 3 (1)/(2): md5 distintos, no son duplicados. Mi recomendación:
raíz=~/U.N.L.P; por curso elegir carpeta de materia con 📂 (ya hay selector Linux) + tabla tema→subcarpeta con sugerencia editable.

Cursos → materia → quién publica en Novedades (recorrido-3, "Publicación de"): G22 → Fisica 2 (Grumel 9, Palacio 3);
G25 archivado → Fisica 2 (Bianchi 25, Haucke 14); Física I-Grupo G 2024 → Fisica 1 ("Lucila Física" 21, Santillan 9, Sergio R 6);
MC4/MC2/MC6 → Matematica C (CONFIRMADO; teorías separadas por docente: MC6=Bava, MC4=Rey Grange, MC2 asumido Rey Grange);
MB5 2024 archivado → Matematica B (CONFIRMADO); Q5 2023 → ¿? vacío,
sin carpeta en U.N.L.P. Autor de post ≠ titular necesariamente.

2026-09-13 docentes: Física 1 Classroom = Lucila (sin apellido); `teorias pedro 2023` = Pedro Mendoza Zélis (firmado en PDF);
`teorias/C1..C9` sin firma pero 9/9 temas = "Clases teóricas - Módulo I" de Lucila → el dueño SÍ renombra (CN Tema); M-1 = md5 tras bajar.
Q5 = Química para Ingeniería, docente Sonia; Personas (/u/2/r/NTQzMTM5MTE1OTUz/sort-last-name) sólo "Comision Q5" → apellido no está (M-2).
Claude in Chrome: Personas tarda ~5 s en pintar; get_page_text antes da la lista vacía.

Formateo ~/U.N.L.P/Ingenieria (plan docs/plan-unlp-formateo-ingenieria.md + .tsv) EJECUTADO y verificado por mí 2026-09-13:
U.N.L.P `f028086` (39 A) + `3b7c557` (114 R + 2 D), SIN push. Cada destino de la TSV existe y está en HEAD; md5 que faltan = zip + xls;
Informática intacta (511 líneas de status fuera de Ingenieria antes y después). Formato: minúsculas, NN_tema, modN_, parciales
modN_AAAA-MM-DD_detalle, Teorias/<Apellido> sólo con >1 docente; vault no se tocó. Pendientes del dueño: M-1..M-3, C-1..C-3 (plan §4).
Errores MÍOS del plan (no rompieron nada): "*.zip en .gitignore" falso (el .gitignore versionado está vacío, el de disco es UTF-16 →
`git check-ignore` antes de afirmarlo; el zip estaba versionado desde e38b6cf); "41 sin versionar" eran 39; "515 menos 0" contaba
líneas de Ingenieria → para aislar, contar `git status --short | grep -v <ruta tocada>`.
Trampas U.N.L.P: `core.ignorecase=true` en .git/config (Linux) → renombre sólo de mayúsculas: `git add -A` deja D + ?? → add por ruta;
`core.quotepath` cita rutas con tilde → filtros con `-c core.quotepath=false`. NFD en "Proyección…(Resumen).pdf"; nombres viejos de Mendoza mienten.
El verificador corre la batería de courseDownloader: no verifica planes sobre otro repo → contraste propio.

**How to apply:** próxima ronda: reescribir `docs/specs/classroom-destino/` con el formato ya aplicado como regla (reemplaza supuestos
5, 13, 22) → plan del corte 2 con tabla nombre Classroom → nombre sencillo por curso. Antes (dueño): verificación B en Brave
(plan abrir-todos §4.B + checklist de `docs/ramas-en-revision.md`), merge. `includes` y `.agents/skills/` ya están enrutados.
