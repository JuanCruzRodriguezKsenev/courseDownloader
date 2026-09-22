---
name: google-classroom
description: Portal 3 (Google Classroom): corte 1 esperando Verificación B en Brave con un 🔴 de archivados planificado sin ejecutar; decisiones D1–D13, mediciones M0–M6 y spec del corte 2
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

## Estado al 2026-09-22

Rama `classroom-corte-1`, **32+ commits** sobre `main` (que sigue en `733ec91` del 2026-08-28). Compuerta verde
verificada por mí: **43 archivos / 723 tests**, lint 0/0, tsc limpio, build OK.

Planes ejecutados y verificados: corte 1 base, verificación B, lista-guardada-y-explorar, abrir-todos,
adjuntos-sin-resolver, identidad-del-curso. **Falta la Verificación B en Brave** (checklist de 15 pasos en
`docs/ramas-en-revision.md`) y después el merge. Luego el corte 2 sobre la spec.

**🔴 abierto con plan escrito y SIN ejecutar**: `docs/plan-classroom-corte-1-identidad-en-archivados.md`.
El plan de identidad dejó **G25 y MB5 sin poder escanearse** (aviso "No pudimos confirmar de qué curso"): la rama de
archivados excluía por texto las anclas de vista usando `buscarLinkNav`, que devuelve el encabezado del `<h1>` — la
única fuente que podía confirmar. Arreglo medido: confirmar con `h1 a[href]` + `hrefDelCurso`. Baseline 723 → **724**.

**M-6c sigue pendiente del dueño** y es lo único que puede reabrir el 🟡 de Novedades (re-escanear G25 con la pestaña
al frente y mirar el storage enseguida).

## Spec del corte 2 (destino en ~/U.N.L.P)

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
  un plan mío, con compuerta verde y diff idéntico: lo cazó simular la función nueva sobre las 62 muestras.
- Los informes de obra dijeron "verificación A en verde" con 33 tests rojos → **siempre re-verificar**.
- Medir un fetch desde una pestaña **no** equivale al contexto de la extensión (cookies + CORP) → pedir la consola
  del popup temprano.
