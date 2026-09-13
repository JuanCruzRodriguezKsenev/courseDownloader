# Ramas en revisión

**Hogar canónico del estado del trabajo en curso que todavía no está en `main`.**

Este doc existe para que ese estado deje de vivir en las reglas de agente (`AGENTS.md`). Es
información con fecha de vencimiento: cambia con cada merge, y mientras vivió en el banner de
`CLAUDE.md` lo hizo cambiar en 85 de 187 commits.

**Lo que este doc NO es:**

- No es el backlog. Los ítems abiertos viven en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- No es la baseline de la compuerta. Los números viven en `docs/testing.md` §Baseline.
- No es el diseño de nada. Cada corte apunta al doc que explica lo que construye.

---

## 🚧 En revisión: `classroom-corte-1` (desde el 2026-09-12)

- **Qué trae**: el tercer portal, Google Classroom. Escanea un curso entero y baja sus archivos
  de Drive a `raíz/google-classroom/<curso>/`; los videos, YouTube y los vínculos quedan como
  `.md` con el link.
  - Plan: `docs/plan-classroom-corte-1.md`.
  - Diseño y mediciones: `docs/portal-google-classroom-diseno.md`.
- **Estado**: código completo (Pasos 1 a 8). Verificación A en verde **desde el 2026-09-12 a la
  noche**: el informe de ejecución la daba en verde con 33 tests en rojo, preexistentes en `main`.
  **Verificación B frenada** en el paso 2: el escaneo termina y guarda, pero la lista no se ve.
  - Arreglado ya (correcciones puntuales, sin plan):
    - `sitio/anatomy-by-chris/scraper.test.js`: Node >= 25 tapaba el `localStorage` de jsdom.
    - `sitio/google-classroom/scraper.js:19`: método abreviado → `async function`. `executeScript`
      no lo podía inyectar (`SyntaxError`); los tests no lo ven.
  - **Hecho** (`docs/plan-classroom-corte-1-verificacion-b.md`):
    - Paso 1: sonda de Classroom a `/favicon.ico` (`sitio/google-classroom/config.ts`).
    - Paso 2: notificación de fallo abre `urlListado` (`background.js:539`, `core/puertos/sitio.ts`).
    - Paso 3: test de serialización de escaneos inyectados (`sitio/inyeccion.test.js`, +4 tests).
    - Paso 4: docs actualizados; Verificación A en verde con 42 archivos, 706 tests.
  - **Verificación B retomada el 2026-09-13**: Física II G22 trae 57 ✅. Destapó dos defectos que
    entran antes del merge, y se midió `batchexecute` (no trae los adjuntos: el escaneo sigue por DOM):
    - El popup re-escanea cada vez que se abre; en Classroom son minutos.
    - 📂 Explorar no anda en Linux (PowerShell).
  - **Pendiente de ejecutar**: `docs/plan-classroom-corte-1-lista-guardada-y-explorar.md`. La
    checklist de abajo se sigue **después** de ejecutarlo, con sus puntos 8 a 12.
- **Lo que no trae**: el mapeo a la carpeta del dueño (`U.N.L.P/`). Es el corte 2.

### Checklist de Verificación B (en navegador)

**Antes de empezar:**
- Levantar el backend: `cd backend && bun run server.js`
- `pnpm run build` y recargar la extensión desde `.output/chrome-mv3/`
- Usar la cuenta del curso de Google (`/u/2/`)
- Dejar la pestaña al frente durante cada escaneo

1. [ ] **Arranque**: el service worker arranca sin excepciones y el popup renderiza completo (`docs/rearquitectura-diseno.md` §Verificación en navegador, puntos 5 y 6).
2. [ ] **Escaneo curso por curso** (contrastar enlaces con los esperados del §8 del diseño):
   - [ ] Física II G22 (Palacio): 57 enlaces esperados
   - [ ] Física I 2024: 130 enlaces (129 Trabajo en clase + 1 sólo en Novedades)
   - [ ] Fisica_II_G25_2026 (Bianchi, archivado): 71 Trabajo en clase + hasta 28 en Novedades
   - [ ] MB5 2024: 24 enlaces
   - [ ] MC4 1S 2026: 13 enlaces
   - [ ] MC2 2025: 25 enlaces
   - [ ] MC6 y Q5: tarjeta "El escaneo no trajo clases" en segundos, sin esperar tope de 20 s
3. [ ] **Nombres repetidos**: en Física I, los 5 `informe de laboratorio fisica i 2024 (template)` aparecen con su material agregado; en Bianchi, los dos `interferencia2025` también.
4. [ ] **Pestaña oculta**: a mitad del escaneo de Física I, cambiar de pestaña. Aparece la tarjeta con aviso de visibilidad y la lista anterior se conserva en pantalla.
5. [ ] **Descarga** de 6 ítems y posterior re-sincronización de disco:
   - [ ] Un PDF en `raíz/google-classroom/<curso>/` con su nombre
   - [ ] Un video de Drive, uno de YouTube y un vínculo como `.md` funcionales
   - [ ] Imagen `27 abr 2026 a la(s) 5:36 p.m..jpg` de Bianchi
   - [ ] `MC4 2026  - Copia de P2F2.pdf` (conservando doble espacio)
   - [ ] Los 6 quedan marcados como descargados tras re-sincronizar
6. [ ] **Anatomy sigue igual**: bajar un PDF (funciona sin cookies) y comprobar que lo ya descargado sigue marcado como descargado.
7. [ ] **Aviso de fallo**: la notificación de un ítem de Classroom que falla enfoca la pestaña de Classroom, o si no hay ninguna abre `urlListado` (`background.js:539`, tras el plan de la verificación B).

## Lo último que se mergeó (2026-08-27)

La tanda `tanda-host-ramonnet-y-conexion` se verificó en Chrome y se mergeó.

Dónde quedó lo que traía, por si venís buscándolo:

- **La migración de host** (`plataforma.ramonnet.com.ar` → `ramonnet.com.ar`, dado de baja el
  primero) → el changelog de `sitio/ramonnet/config.ts` (v2.2.0) y `host_permissions` en
  `wxt.config.ts`. Verificado con clases reales escaneadas sobre el host nuevo.
- **El copy de conexión caída** ("Sin conexión a internet" → "No se pudo contactar el sitio",
  porque el daemon sondea el host del portal, no internet en general) → el changelog de
  `bannerConexion.preact.js` (v1.2.0), replicado en `conexionHeader.preact.js` y
  `notificaciones.ts`. Verificado en Chrome.
- **El badge de cátedra que se salía del popup** → el comentario sobre `min-width: 0` en
  `.input-path`, `styles/components/path-bar.css`. Verificado en Chrome.

---

## Cómo usar este doc la próxima vez

Cuando haya trabajo fuera de `main`, acá va: qué rama, qué trae, qué mirar en Chrome y cómo
aislar si algo falla. Cuando se mergea, esta sección vuelve a decir «nada en revisión», los
ítems abiertos se mudan a `TECHNICAL_DEBT.md` y el registro de la verificación a su hogar.

Lo que las tandas enseñaron sobre el proceso:

- **Una rama de integración deja `main` intacta** mientras se verifica, y si algo falla se
  descarta entera. Salió barato y conviene repetirlo.
- **Un commit por corte**, para que un `git revert` aísle.
  - **Y cuándo NO se puede**: si un archivo participa de varios cortes —el caso repetido es
    `popup.js`— separarlos deja commits intermedios que no compilan. Ahí conviene un commit
    grande y honesto antes que un historial lindo y roto. Se paga en granularidad del `revert`.
  - **El orden de los commits se elige para que cada estado intermedio compile.** En la última
    tanda eso decidió qué corte iba primero: el que introducía un módulo nuevo tenía que entrar
    antes que el que lo consume, aunque el consumidor fuera el arreglo más urgente.
- **Anotá también qué hace falta para poder MIRAR el resultado.** El loader invisible era
  precondición de la verificación del copy genérico, y eso no aparecía en ninguna lista de
  dependencias: las dos entradas se veían independientes.
- **Para lo que dura milisegundos, mirar no alcanza: hay que medir.** Los dos peores destellos
  del arranque (248 ms y 117 ms) no los encontró el ojo, los encontró el banco. Y el banco tiene
  que estar **apagado** al verificar el arreglo, porque demora el escaneo a propósito.
