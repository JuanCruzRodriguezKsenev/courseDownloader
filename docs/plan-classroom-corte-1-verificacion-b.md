# Plan — Classroom corte 1: lo que destapó la verificación B

**Rama**: `classroom-corte-1` (no se cambia de rama). **Árbol**: limpio al empezar.
**Contexto**: `docs/ramas-en-revision.md` §En revisión. Plan madre: `docs/plan-classroom-corte-1.md`.

La verificación B se frenó en el paso 2. El escaneo de Classroom **termina y guarda** (el storage
de la extensión tiene los 57 enlaces de Física II G22), pero la lista no se ve: la tarjeta
**"No se pudo contactar el sitio"** ocupa la región (`popup.js:2485`, `sincronizarBloqueosDeAlerta`).

Este plan trae dos cosas y nada más:

1. Que la sonda de conexión llegue a Classroom (Pasos 1 y 2).
2. El test que habría detectado que el escaneo no se podía inyectar (Paso 3; deuda 🟠 #11).

Dos correcciones puntuales ya están commiteadas y **no** son parte de este plan: el
`localStorage` de jsdom en `sitio/anatomy-by-chris/scraper.test.js` y el método abreviado de
`sitio/google-classroom/scraper.js:19`.

---

## 0. Lo medido que este plan da por hecho

Todo medido el 2026-09-12 en el Brave del dueño (el navegador real), con sesión en la cuenta `/u/2/`.

- **La sonda del popup falla contra Classroom.** Consola del popup, en cada latido:
  `HEAD https://classroom.google.com/ net::ERR_BLOCKED_BY_RESPONSE.NotSameSite 200 (OK)` →
  `🔌 [Conexion] estado → servidor=true internet=false`.
- **La causa es `Cross-Origin-Resource-Policy`.** Con sesión, `https://classroom.google.com/`
  responde `200` con `cross-origin-resource-policy: same-site`. El popup es `chrome-extension://`
  (otro sitio) y, por tener permiso de host, manda las cookies → recibe la respuesta autenticada
  con CORP → Brave la bloquea y el `fetch` rechaza. `core/conexion/conexion.ts:189-199` toma
  cualquier rechazo como "sin internet".
- **`https://classroom.google.com/favicon.ico` sí pasa.** Desde la misma consola del popup:
  `OK basic` (responde `404` y **sin** CORP). Un 404 alcanza: la sonda pregunta "¿llego al
  portal?", no "¿existe el recurso?", y `_chequearInternet` no mira el status.
- **Medirlo desde una pestaña mentía.** El mismo `HEAD no-cors` hecho desde `example.com`
  resolvía en <1 s, porque Brave no manda cookies de terceros a una página y la respuesta sin
  sesión es otra. Por eso hizo falta la consola del popup.
- **Hotmart y Ramón Net no mandan CORP** (`curl -sIL`): sus sondas no cambian.

---

## 1. Radio de impacto

`PuertoSitio.urlSondeoInternet` (`core/puertos/sitio.ts:211-216`) tiene **tres lectores** de
producción, y este plan los nombra todos:

| Lector | Qué hace con la URL | Qué pasa con este plan |
|---|---|---|
| `popup.js:545` — `conexion.fijarSondeo(() => sitioActivo.urlSondeoInternet)` | sonda del daemon en el popup, portal de la pestaña | pasa a sondear `/favicon.ico` en Classroom. **No se toca.** |
| `plataforma/composicion.ts:99-116` | sonda del daemon en el SW: portal del **primer ítem de la cola**, piso = legado | ídem. **No se toca.** |
| `background.js:539` — `chrome.tabs.create({ url: sitioDelFallo.urlSondeoInternet })` | la notificación de fallo abre esa URL si no hay pestaña del portal | **se cambia** (Paso 2): abriría un 404 |

**El SW también está roto hoy, aunque nadie lo vio todavía.** Con un ítem de Classroom primero en
la cola:

- `core/cola/procesadorCola.ts:1007-1008`: ante un fallo no tipado, `verificarAhora()` da
  `internet=false` → se clasifica `"internet"` aunque la red esté bien.
- `core/cola/procesadorCola.ts:1087-1090`: el auto-heal espera `est.internet` → **nunca llega**, la
  cola queda pausada para siempre.

El Paso 1 lo arregla sin tocar ese archivo. **No se toca el orden de clasificación** (`AGENTS.md`
§Execution contexts).

---

## 2. Paso a paso

### Paso 1 — La sonda de Classroom apunta a `/favicon.ico`

**Archivo**: `sitio/google-classroom/config.ts`.

1. Línea 34: `urlSondeoInternet: "https://classroom.google.com",` →
   `urlSondeoInternet: "https://classroom.google.com/favicon.ico",`
2. Justo arriba, un comentario que diga, en sustancia:
   - que la raíz con sesión responde `Cross-Origin-Resource-Policy: same-site` y el `fetch` desde la
     extensión rechaza (`ERR_BLOCKED_BY_RESPONSE.NotSameSite`), lo que marcaba "sin internet";
   - que `/favicon.ico` responde 404 sin CORP y el daemon no mira el status;
   - que **esta URL no se abre nunca** en una pestaña: para eso está `urlListado`;
   - medido el 2026-09-12 en la consola del popup; ver `docs/portal-google-classroom-diseno.md` §8.
3. Banner del archivo (líneas 1-8): `V1.0.0` → `V1.1.0`, con un `CHANGELOG v1.1.0` de una viñeta
   `[CLASSROOM VERIFICACIÓN B]` que resuma el punto 2.

**Contrastar antes de escribir**:

- `core/puertos/sitio.ts:211-216` dice *"Origen del portal… deliberadamente el sitio objetivo y no
  un genérico tipo google.com"*. `/favicon.ico` en `classroom.google.com` **sigue siendo el sitio
  objetivo**, así que no contradice la regla; lo que deja de ser cierto es "origen". Actualizar ese
  comentario (Paso 2, punto 3).
- `docs/architecture.md:437` (*"la sonda de internet apunta al portal a propósito"*): sigue cierto,
  no se toca.

### Paso 2 — La notificación de fallo abre `urlListado`

**Decidido por el dueño.** Hoy `background.js:539` abre `urlSondeoInternet`. Con el Paso 1, en
Classroom eso sería un 404.

1. `background.js:539`: `sitioDelFallo.urlSondeoInternet` → `sitioDelFallo.urlListado`.
   - **Qué es `urlListado` hoy en cada portal** (el cambio de comportamiento va a la vista):
     - Ramón Net (`sitio/ramonnet/config.ts:123`): `https://${this.host}/usuario/${this.marcaRutaClase}`,
       el listado de clases, en vez de la portada.
     - Anatomy (`sitio/anatomy-by-chris/config.ts:133-135`): `https://hotmart.com/es/club/${this.slugCurso}/products/${this.productId}`,
       la página del curso, en vez de `https://hotmart.com`.
     - Classroom (`sitio/google-classroom/config.ts:45-47`): `https://classroom.google.com/`.
   - Son **getters que usan `this`**. `sitioDelFallo` es el descriptor registrado
     (`plataforma/composicion.ts:211-212`, `sitios.obtener(...)`), así que `this` resuelve bien.
     **No desestructurar** `urlListado` fuera del objeto.
   - Hoy lo lee sólo el onboarding (`popup/features/onboarding.preact.js:135`), que no se toca.
2. Banner de `background.js` (líneas 1-12): `V7.1.0` → `V7.2.0`, con un `CHANGELOG v7.2.0` de una
   viñeta: la notificación sin pestaña abre `urlListado` y no `urlSondeoInternet`, porque la sonda
   dejó de ser una página navegable (Classroom).
3. `core/puertos/sitio.ts`:
   - Comentario de `urlSondeoInternet` (líneas 211-215): URL **del portal** que el daemon sondea.
     Tiene que responder sin un `Cross-Origin-Resource-Policy` que la bloquee desde la extensión
     (el caso de Classroom). No hace falta que sea navegable ni que dé 200, y **no se abre en una
     pestaña**. Mantener la frase de "no un genérico tipo google.com".
   - Comentario de `urlListado` (línea 222): sumar que también es lo que abre la notificación de
     fallo cuando no hay pestaña del portal.
   - Si el archivo tiene banner de versión (`sed -n 1,15p core/puertos/sitio.ts`), subirlo con
     su viñeta. **El puerto sigue en 13 miembros: no se agrega ninguno.**
4. **Tests**: `background.test.js`. No se agregan tests, se ajustan los existentes:
   - Doble `OTRO_PORTAL` (`:25-29`): sumar `urlListado: 'https://otro/listado'`.
   - Doble `globalThis.SitioActivo` (`:143-151`): sumar `urlListado: 'https://portal/listado'`.
   - Las expectativas de `tabsCreadas` en `:707`, `:718-719`, `:726` y `:734`: cambiar
     `.urlSondeoInternet` → `.urlListado`.
   - **Los valores tienen que ser distintos de `urlSondeoInternet`**: si fueran iguales, el test
     pasaría sin distinguir cuál de las dos abre.

**Contrastar antes de escribir**: `docs/multisitio-diseno.md:141-150` (§5) muestra
`chrome.tabs.create({ url: sitio.urlSondeoInternet })`. **No se edita**: es la cita del defecto
del corte 8, historia. `docs/TECHNICAL_DEBT.md:348` ídem, es una entrada cerrada.

### Paso 3 — El test de serialización de los escaneos inyectados

**Por qué**: `popup.js:1258-1260` inyecta `func: portal.escanearListado`; `executeScript` lo
serializa con `toString()` y lo corre como expresión. Un método abreviado (`async f() {}`) no
compila como expresión → `SyntaxError`, el escaneo no arranca y la suite no lo ve, porque los tests
de cada scraper llaman a la función directo. Es lo que pasó en `sitio/google-classroom/scraper.js:19`.

**Archivo nuevo**: `sitio/inyeccion.test.js`. **Tiene que ser `.js`**: un `.test.ts` no puede
importar los `scraper.js` (`allowJs: false`). Corre en el entorno `node`, **sin** docblock de jsdom.
Contenido exacto; **ya se corrió así, 4/4 en verde, con el control negativo tirando `SyntaxError`**:

```js
/**
 * Las funciones de escaneo se INYECTAN en la pestaña: `popup.js` hace
 * `executeScript({ func: portal.escanearListado })`, que las serializa con `toString()`.
 * Si no compilan como expresión, la inyección falla antes de correr una línea, y los tests
 * de cada scraper no lo ven porque llaman a la función directo.
 *
 * Esto NO ve que la función use algo de afuera (una constante del módulo, `this`): eso
 * compila y rompe recién en la pestaña. Eso sigue siendo del navegador (AGENTS.md, bullet
 * de `Scraper.escanearAulaVirtual`).
 */
import { describe, it, expect } from 'vitest';
// Los scrapers publican su global al cargarse, y el getter `escanearListado` de cada
// descriptor lee ese global.
import './ramonnet/scraper.js';
import './anatomy-by-chris/scraper.js';
import './google-classroom/scraper.js';
import { Sitios } from './registro.ts';

const compilaComoExpresion = (fn) => new Function(`return (${fn.toString()});`);

describe('inyección: la función de escaneo sobrevive a executeScript', () => {
  it.each(Sitios.todos().map((s) => [s.id, s]))('%s: escanearListado es una función serializable', (_id, sitio) => {
    const fn = sitio.escanearListado;
    expect(typeof fn).toBe('function');
    expect(() => compilaComoExpresion(fn)).not.toThrow();
  });

  it('control negativo: un método abreviado NO compila', () => {
    const abreviado = { async escanearListado() { return 1; } }.escanearListado;
    expect(() => compilaComoExpresion(abreviado)).toThrow(SyntaxError);
  });
});
```

`Sitios.todos()` hace que un cuarto portal quede cubierto sin tocar el test. Suma **1 archivo y
4 tests** (3 portales + el control).

### Paso 4 — Docs

1. **`docs/testing.md`**
   - Tabla, línea 33: `41 archivos, 702 tests` → `42 archivos, 706 tests`.
   - Antes de *"De dónde sale el 702"* (línea 38), un párrafo *"De dónde sale el 706"* con fecha.
     Los 702 más **+4** en `sitio/inyeccion.test.js` (archivo nuevo, 41 → 42), que fijan que
     `escanearListado` compila como expresión.
   - Mismo formato que el párrafo del 702. **Contrastar** con `docs/testing.md:31-57`.
2. **`docs/TECHNICAL_DEBT.md`**. **Contrastar** con `:15-40` (resumen) y `:568-573` (entrada).
   - La entrada `### 🟠 Ningún test serializa las funciones que se inyectan en la pestaña`
     (`:568`) pasa a `### ✅`, con `**Estado**: ✅ cerrado el 2026-09-12 (sitio/inyeccion.test.js)`.
     Se queda donde está: las ✅ conviven en §Abierto, como las de `:47-153`.
   - Resumen: `**ONCE** entradas` → `**DIEZ**`, `(3 🔴, 4 🟠, 4 ⚪)` → `(3 🔴, 3 🟠, 4 ⚪)`, y se
     saca el ítem 11 de la lista numerada.
   - En *"Lo que se cerró el 2026-09-12 (Classroom corte 1)"*, una viñeta del test de serialización.
3. **`docs/portal-google-classroom-diseno.md`**, al final de §8 (después de `### M4`, fin del
   archivo):
   - Una subsección `### Verificación B (2026-09-12) — la sonda de conexión choca con CORP`, con
     los hechos de la §0 de este plan.
   - Qué se hizo: sonda a `/favicon.ico`, y la notificación a `urlListado`.
   - La lección, en una línea: el fetch medido desde una pestaña **no** representa al de la
     extensión, que manda cookies y recibe otra respuesta.
   - Sin repetir la tabla de la §1.
4. **`AGENTS.md`**, patrón 2 de *"Lo que este proyecto cobra caro"* (el que empieza *"Medir desde
   una pestaña miente sobre el service worker"*).
   - Sumar **una** oración: la mentira también corre al revés. Desde la extensión viajan las
     cookies y el portal puede contestar con `Cross-Origin-Resource-Policy`, que bloquea el
     `fetch` (Classroom: la sonda del popup) aunque desde una pestaña resuelva.
   - Hogar del detalle: `docs/portal-google-classroom-diseno.md` §8.
   - **Contrastar** que no repita nada que ya diga el patrón.
5. **`docs/ramas-en-revision.md`**, bullet *"Pendiente, con plan"* del §En revisión: pasa a
   *"Hecho"*, con una línea por paso y la verificación A nueva (706). El punto 7 de la checklist
   ya está redactado para `urlListado`; no se toca.

---

## 3. Lo que no se toca

- `core/conexion/conexion.ts` (el daemon, su `HEAD no-cors` y su timeout).
- `core/cola/procesadorCola.ts`: ni la clasificación de fallos ni el auto-heal.
- `popup.js` y `plataforma/composicion.ts`: siguen leyendo `urlSondeoInternet`, y eso es correcto.
- `urlSondeoInternet` de Ramón Net y Anatomy.
- `backend/`, y `docs/muestras/`.
- `docs/multisitio-diseno.md` y las entradas cerradas de la deuda que citan el código viejo.

## 4. Verificación

**A. Automática.** Pegar la salida, no describirla.

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm exec vitest run sitio/inyeccion.test.js background.test.js
git grep -n 'urlSondeoInternet' -- background.js
grep -c 'classroom.google.com/favicon.ico' .output/chrome-mv3/background.js .output/chrome-mv3/chunks/popup-*.js
```

Resultado esperado:

- `pnpm test`: **42 archivos, 706 tests**, todo en verde.
- lint: 0 errores, 0 warnings. `tsc`: sin salida. El build compila.
- `sitio/inyeccion.test.js`: 4 tests en verde.
- `git grep … background.js`: **sin salida**. Sólo el CHANGELOG puede nombrarla; si aparece en el
  banner, pegar la línea.
- `grep -c`: **≥ 1 en los dos** bundles (el SW y el popup cargan el descriptor).

**B. En el navegador (la corre el dueño).** Build nuevo, ↻ en `chrome://extensions`, backend arriba.

1. "Inspeccionar ventana emergente" en Classroom. La consola **no** muestra
   `ERR_BLOCKED_BY_RESPONSE`, y `🔌 [Conexion]` queda en `internet=true`.
2. Escanear Física II G22: la lista aparece (57), sin la tarjeta "No se pudo contactar el sitio".
3. Seguir la checklist de `docs/ramas-en-revision.md` desde el paso 2.

## 5. Qué tiene que traer el reporte

- La salida literal de la verificación A.
- Archivos tocados, por paso.
- **Hallazgos**: lo que viste y no hiciste porque este plan no lo nombraba.
