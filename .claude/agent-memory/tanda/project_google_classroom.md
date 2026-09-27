---
name: google-classroom
description: Portal 3 (Google Classroom): corte 1 sin 🔴 abiertos, esperando re-verificación propia y Verificación B en Brave; decisiones D1–D13, mediciones M0–M6 y spec del corte 2
metadata:
  type: project
---

Classroom es el 3er portal; después viene Moodle. Diseño y mediciones: `docs/portal-google-classroom-diseno.md`.
**El estado detallado de la rama vive versionado en `docs/ramas-en-revision.md`** (hallazgos 🔴/🟡/⚠️/⚪ con su
evidencia) — leerlo ahí y no duplicarlo acá.
Sonda descartable: `docs/muestras/google-classroom/sonda-sw/` (gitignorada, baja a `~/Descargas/medicion-classroom/`).
62 muestras HTML en `docs/muestras/google-classroom/{click,recorrido-1..4,c3}`: son la base de casi toda medición.

8 cursos: 6 activos + 2 **archivados** (G25 `Fisica_II_G25_2026`, `MB5 2024`). Palacio = Física II G22.
`MC4 1S 2026` desapareció de Classroom entre el 12 y el 16-09 (no es defecto). Cursos → materia → docentes
(recorrido-3, "Publicación de"): G22→Fisica 2 (Grumel, Palacio); G25→Fisica 2 (Bianchi, Haucke); Física I-Grupo G
2024→Fisica 1 (Lucila, Santillan, Sergio R); MC6=Bava, MC4/MC2=Rey Grange→Matematica C; MB5→Matematica B;
Q5 = Química para Ingeniería, docente Sonia (apellido no está en Personas — M-2, no bloquea).

Decidido por el dueño: D9 destino en `~/U.N.L.P` por CURSO y tema (rompe contrato de disco → ADR nueva), D10
videos/YouTube/vínculos = acceso `.md`, DOS cortes, mapeo por ruta escrita, Novedades → subcarpeta (corte 2).
Por evidencia: D11 escanear también Novedades (52 adjuntos sólo ahí), D12 nombres repetidos → título del material
antes de la extensión, D13 paginar con "Ver más" (botón visible y habilitado → click → esperar que crezca; `disabled`
= cargando; la "espera por estabilidad" NO alcanza).

## Trampas del portal (medidas en Chrome/Brave)

1. **Con la pestaña en segundo plano Classroom NO pinta** → toda medición o escaneo con la pestaña al frente.
2. Cada tema muestra 10 ítems + `button[aria-label="Ver más publicaciones"]`.
3. **`document.title` se desfasa** de la URL y del contenido en la SPA, y a veces es genérico. Fuentes del nombre
   medidas en las 62 muestras: sidebar `a[aria-current="page"]` → `aria-label` es exacto pero falta en archivados;
   **el ancla del curso dentro del `<h1>` (encabezado) existe en 40/41 muestras de curso, es única, y confirma el
   title en 40/40**; el texto del header viene **sin espacios** (nombre partido en nodos) → sólo sirve normalizado
   (NFKD, sin espacios, minúsculas); `span#UGb2Qe` viene abreviado.
4. `buscarLinkNav` (`scraper.js:113`) devuelve **la PRIMERA `nav a[href]`** que coincide, y en el DOM real ésa es el
   ancla del `<h1>`, no la pestaña de vista. Los tres usos de navegación funcionan igual (mismo href).
5. Entorno real: el dueño usa **BRAVE** (`~/.config/BraveSoftware/Brave-Browser/Default`), extensión
   `daameiendaidaagnimcbpmdjkpccfemh`; el storage es legible con grep en
   `Local Extension Settings/<id>/000003.log` y da `modulo` y `origenListado` sin pedirle nada al dueño.
   `backend/config_usuario.json` tiene la raíz real. Claude in Chrome maneja ese Brave pero **no** abre
   `chrome-extension://` (el popup lo prueba el dueño) y `read_network_requests` no ve nada ahí.
6. **Tras commits en `backend/`, pedir reinicio del server ANTES de la Verificación B**: Bun no recarga y el popup
   se traga el error (`popup.js:924-929`). Diagnóstico: `ps -o lstart= -p <pid>` vs `git log -1 --format=%ci -- backend/`.
7. **No hay lxml/bs4/html5lib en el sistema**: para filtros tipo `closest()` sobre HTML guardado, escribir un
   `HTMLParser` propio con pila de ancestros. Es barato y ya resolvió cuatro mediciones.
8. El **verificador corre la batería de courseDownloader**: no verifica planes sobre otro repo (`~/U.N.L.P`) → ahí,
   contraste propio.
9. **`git push` por iniciativa propia lo bloquea el clasificador de auto mode**; con pedido explícito del dueño pasa.
10. **Claude in Chrome: su pestaña queda con `visibilityState = "hidden"`** aunque pinte → sirve para medir navegación
    y DOM, pero NO para correr el scraper (aborta por visibilidad). Cronometrar escaneos = el dueño.

## Estado al 2026-09-25

**Corte 1 MERGEADO** a `main` (`080f7aa`, sin push) con escaneo + descarga verificados en Brave por el dueño.
Pasos 4/6/7/10/11/13/15 de la Verificación B sin mirar → ⚪ en TECHNICAL_DEBT. El registro entero de la rama
(planes, checklist, hallazgos) se mudó a `docs/portal-google-classroom-diseno.md` §9. M-6c (Novedades) → 🟠 en deuda.

Orden del dueño: **escanear todos los cursos desde la portada** → destino en `~/U.N.L.P` (corte 2) → rediseño de la extensión.
Rama `classroom-escanear-todas`: spec `docs/specs/classroom-escanear-todas/spec.md` (draft, 21 RN / 14 AC,
tabla de decisión al abrir el popup). **El dueño aprobó los 23 supuestos "sin leer"** → avisado en el encabezado;
filo: RN-15 (sobrevivir al popup = la deuda ⚪ de cerrar popup), RN-16 (no re-escanear el curso donde está parada la
pestaña a mitad del recorrido), RN-18 (una sola lista). M-3 cerrado sobre muestras (portada 6 activos + link
`/h/archived`; archivadas enumera los 8). M-2 CERRADO por mí en Brave (todo navega por SPA; hoy 5 activos + 2 archivados).
**Plan escrito: `docs/plan-classroom-escanear-todas.md`** (9 pasos): recorrido en UNA inyección en la pestaña que
avisa al SW con `chrome.runtime.sendMessage` (acción `recorrido_evento`, clave `recorridoTodos`, ADR-0016 nuevo);
el popup materializa con la rama feliz extraída; lector vía `crearLectorRecorrido` en composicion (el popup NO recibe
`almacenamiento`). M-1 va en la Verificación B (estimación 45 s/curso). Próximo: obra ejecuta; yo re-verifico. Radio de impacto ya visto: `config.ts:53-56` (`esPaginaDelSitio` no reclama
`/h`), `scraper.js` devuelve UNA `materia`, `popup.js:1166,1516` origen de lista único, `decidirAlAbrir`
(`core/estado/origenListado.ts`).

## Estado al 2026-09-27

obra ejecutó los 9 pasos; B-2/B-3 del dueño (leídas del storage de Brave) dieron 3 🔴: archivados no entran, primer
curso falla, cursos incompletos (Física I 1–7 vs 130 solo). Medido en Brave con Claude in Chrome (**la pestaña SÍ
quedó visible esta vez**): archivadas pinta a ~520 ms tras la URL; el link a Trabajo aparece ~620 ms tras la URL; en
**primera visita** `[data-no-topic-items]` llega antes que los `li` (latente del corte 1); vacío real = marcador sin
"Ver más" ni `role=progressbar`. Plan escrito: `docs/plan-classroom-escanear-todas-correcciones.md` (7 pasos). Botón
durante el recorrido: OCULTO (decidí yo, el dueño delegó); al dueño le gusta el resumen. Loader infinito en portada
corregido por mí (`ee98446`). obra volvió a declarar "control negativo probado" sin que detectara → correrlos yo.
El filtro de Claude in Chrome bloquea salidas con ids base64 de Classroom en URLs: no imprimir paths.
**Correcciones ejecutadas por obra (HEAD `842f506`) y re-verificadas por mí**: compuerta 44/764; los 4 controles
negativos (25/26, 27, 28, 23) muerden de verdad (sabotaje en worktree de scratch; pnpm se niega en worktree →
`./node_modules/.bin/vitest` directo); `trabajoAsentado` simulado sobre las 34 muestras de Trabajo: 0 progressbar
en vistas cargadas, vacíos = MC6/Q5; nombres limpios en 00-partida (aria) y 00-archivadas (texto). Falta B-2/B-3/B-6 del dueño.
Pedido nuevo (2026-09-27): spec `docs/specs/loader-con-progreso/spec.md` (draft, 23 RN / 11 AC; aprobada SIN LEER):
progreso en el loader para un curso y recorrido (sale la tarjeta `popup.js:2053`), vuelta a `/h` al terminar el
recorrido (RN-20..22, derivados no vistos por el dueño; arregla que reabrir en el último curso re-escanee), Estado
primero en filtros (`filters.js:371-434`). B-2/B-3/B-6 ✅ (storage: 7 cursos, 0 fallidos, ~124 s ≈ 18 s/curso). Plan escrito:
`docs/plan-loader-con-progreso.md` (6 pasos). Claves: el SW hace leer-modificar-escribir por evento → el progreso
del recorrido va por una COLA de mensajes (si no, pisa el `curso`); un curso usa `escaneo_progreso` directo al
popup (SW devuelve false a acciones sin manejador); `esRutaPortada` acepta `/h/archived` (no usarla para esperar `/h`).
**Ejecutado por obra y revisado por mí (HEAD `1aa0a83`)**: 46/796 verde; controles Paso 1 y 33 muerden;
**el 29 NO mordía** (latencia simulada 20 ms nunca solapa envíos) → lo afilé a 300 ms + timeout 15 s. Tercera vez
que obra declara un control verificado que no muerde. 🟡 no reproducido: loader bloquea hasta 210 s si el script
muere sin `fin` (F5) → L-9. Checklist L-1..L-9 en `ramas-en-revision.md`. L-1 del dueño: CSS roto (overlay translúcido, detalle pegado a la izquierda) → plan `docs/plan-loader-detalle-css.md`.
**Para ver CSS del popup sin el dueño**: CSS compilado de `.output/chrome-mv3/assets/` + markup en scratch, servido con
`python3 -m http.server` (Claude in Chrome no abre `file://`). Cazó y validó el arreglo en 5 min.
**CSS del loader ejecutado por obra (`5a88754`) y re-verificado por mí**: diff idéntico al plan, 46/796 verde,
reproducción en iframe 400×560 OK en oscuro y claro (para el claro: borrar las reglas `@media dark` vía JS). Falta L-1/L-2 del dueño en Brave.
L-2 del dueño: recorrido cortado en el 2º curso → **Classroom muestra ~100-200 ms la vista del curso ANTERIOR o
ninguna** (`obtenerVistaActiva` cae a `body`) al cambiar de vista; intermitente (4/4 y 0/3). Criterio medido:
los ids de curso en los `a[href]` de la vista (`/c/`, `/w/`, `/a/<x>/<id>$`) = {propio} en 39/39 muestras.
**Los fixtures NO tienen hrefs con id dentro de las vistas** → filtro negativo. Plan `docs/plan-classroom-vista-del-curso.md`.
**Ejecutado por obra (`711a6b1`) y re-verificado por mí**: 46/798 verde; controles 37/38 MUERDEN (esta vez sí).
obra agregó por su cuenta un fallback en `!pintadoOk` (busca `/c/<otro>/m/` → `curso-cambiado`) que el plan no
nombraba: hace falta (sin él cae el test 17) — el plan debió prever que el filtro deja al 17 sin aviso. 🟡 anotado:
el fallback lee `body` si vence sin c-wiz visible. Falta L-2 del dueño en Brave (2 corridas).

Fin de cola con popup abierto tiraba la lista de todos (`limpiarSesionLocal` + escaneo de 1 curso en `/h`) →
plan `docs/plan-classroom-fin-descarga-todos.md` (sólo si `origenListado.clave === "todos"`; un curso sigue igual).
**Ejecutado por obra (`c38b5ae`) y re-verificado por mí**: 46/799 verde; el control negativo MUERDE (worktree de
scratch necesita symlink a `node_modules` **y a `.wxt`**, si no vitest no carga el tsconfig). Para L-10 moví 3 PDF
de `~/Descargas/verificacion-b` (uno por curso: Física I G, G22, G25) a `scratchpad/respaldo-verificacion-b`.

**MERGEADA 2026-09-27** (`d125c52` en main, sin push; árbol idéntico a la rama verificada 46/799). Dueño: S-1..S-9
"todo ok". Registro → diseño §10; 5 ⚪ nuevos en deuda (21 abiertas). Siguiente: corte 2 (ordenar en ~/U.N.L.P)
ANTES que Moodle, arranca por PA-3. **El storage de Brave ya da el mapa idArchivo→carpeta+titulo** (337 ítems,
parser LevelDB con reensamblado de bloques de 32 KB en `scratchpad`, sin librerías) → semilla de adopción viable.
**Ojo con "todo ok" del dueño**: tras mi checklist S-1..S-9 el storage no tenía escrituras después de L-10 → no la
corrió como sesión; dijo "funciona todo". Contrastar SIEMPRE con el mtime del `.log` del storage antes de mergear.
**Novedades (🟠 #13) RESUELTO en diagnóstico 2026-09-27**: `buscarContenedorScroll` elige la `<nav>` lateral
(overflow auto, no scrollea); el que scrollea es el documento; Novedades pagina de a 10 por scroll (G25: 66 posts /
28 adjuntos). Plan `docs/plan-classroom-novedades-scroll.md`, rama `classroom-novedades-scroll`. Corte 2 espera esto.
**Ejecutado por obra (`7ec372b`) y re-verificado por mí**: diff idéntico al plan, 46/801 verde, el control negativo del 39 MUERDE (primera vez que obra lo declara y es cierto). Storage de Brave antes de N-1: `000043.log` mtime 17:03:36. N-1/N-2 ✅ (storage: G25 Novedades 28 adjuntos en ambos, recorrido ~175 s vs 124 s). **MERGEADA** `7b60e05` (sin push).
Siguiente: corte 2 (spec `classroom-destino`, PA-3 ya decidido) → plan.
Tiempos del recorrido: `recorridoTodos.cursos[].duracionMs` en el storage; lista con `listaPersistente` (parser en scratchpad de sesión vieja: copiarlo).
Para medir en Brave con Claude in Chrome: un `left_click` en la página la pone `visible` (la captura sola no).
El filtro bloquea salidas con nombres de clase CSS: devolver sólo números.

## Spec del corte 2 (destino en ~/U.N.L.P)
**2026-09-27, retomando el corte 2**: el dueño decidió raíz por portal — Ramón Net y Anatomy quedan como están;
Classroom **y los Moodle de la UNLP que vienen "en un futuro inmediato"** van a `~/U.N.L.P` (pensar la raíz como
"UNLP", no "classroom"). PA-3 (adopción) SIN cerrar: el dueño dice que en `~/Descargas/verificacion-b` (raíz actual
del backend) ya bajó todo → posible semilla: evitar la re-bajada leyendo de ahí. Preguntarle de nuevo con eso.

`docs/specs/classroom-destino/spec.md` (draft, **30 RN / 13 AC**, tabla de decisión, wireframes) + `assumptions.md`.
Decisiones del dueño: "ya descargado" **por md5, no por nombre**; el nombre lo propone la extensión y el dueño lo
edita, y se recuerda **por id de Drive**; índice en un único `~/U.N.L.P/.classroom.json` **gitignoreado** (el repo
`jcrodriguezUNLP/U.N.L.P` es PÚBLICO y no quiere que se sepa de dónde baja); docente nuevo sobre `Teorias/` con
sueltos → no se mueve nada. RN-29 clave `acceso:<url>:<título>` para los 55 `.md` sin id de Drive (ADR-0014);
RN-30 un `.md` existente **nunca** se sobrescribe (el dueño los edita y el vault vive en el mismo árbol).
Descartado con medición: xattr (se pierden en `git clone` y `cp` sin `-a`) y metadata interna (cambia el md5).
Cruce md5 verificado: 318 A vs 132 B, 55 ya estaban (21%), **0 colisiones peligrosas**, 208 nuevos; las 9
coincidencias de nombre son todas md5-idénticas. `Fisica 2/Laboratorios` está sin formatear (`Lab#1` vs `Lab_1`).
Perf medida: cola estrictamente secuencial, 62 ítems/186 s, PDF mediana 1.36 s de los cuales ~1.25 s son Drive.
Paralelizar es la única palanca (3x) pero toca estado global y ADR-0011 → plan propio **después** del merge.

Trampas de `~/U.N.L.P`: `.gitignore` en **UTF-16 LE + CRLF** (`echo >>` lo corrompe); `core.ignorecase=true` →
renombre sólo de mayúsculas necesita `git add` por ruta; `core.quotepath` cita tildes → filtros con
`-c core.quotepath=false`; NFD en algunos nombres; remoto SSH y último push del 2026-05-08 (el formateo de
septiembre NO está pusheado).

## Lecciones de método que ya pagaron

- **Un test que el plan declara "falla sin el arreglo" se corre contra el código viejo ANTES de darlo por bueno.**
  Copiar el archivo viejo a `sitio/<nombre>.tmp.js` (o aplicar el fixture nuevo sin el arreglo) cuesta 5 minutos y
  ya cazó tres cosas en esta rama: los tiempos del test 11, el test 12 sin poder de detección, y los tests 15/18.
- **Un hallazgo no reproducido no se escribe en 🔴**: va en 🟡 con "NO REPRODUCIDO" en el título. En esta rama
  escribí cinco diagnósticos falsos antes de medir (tres sobre Novedades, dos sobre la identidad del curso).
- **Cuando el dueño dice "descarga donde no va", mirar el DISCO primero** (`find -newermt` + md5 cruzado entre
  carpetas) antes de leer código: en 3 comandos quedó claro el alcance.
- **Revisar el plan ejecutado contra las muestras, no sólo el diff contra el plan.** El 🔴 de archivados estaba en
  un plan mío, con compuerta verde y diff idéntico: lo cazó simular la función nueva sobre las 62 muestras. El
  2026-09-22 la misma simulación sirvió para lo contrario — **confirmar** que el arreglo funciona sobre el DOM real,
  antes de mandar al dueño a Brave. Vale para las dos direcciones y cuesta ~15 min con un `HTMLParser` con pila de
  ancestros (trampa 7). Contrastar también el **fixture** contra el DOM real: los tests pasan igual si el fixture
  miente, y ahí el navegador es el único que se entera.
- Los informes de obra dijeron "verificación A en verde" con 33 tests rojos → **siempre re-verificar**.
- Medir un fetch desde una pestaña **no** equivale al contexto de la extensión (cookies + CORP) → pedir la consola
  del popup temprano.
