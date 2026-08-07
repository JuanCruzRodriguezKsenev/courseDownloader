# 0013 — Las credenciales de un portal son suyas y del usuario, no de la clase

**Fecha**: 2026-08-07
**Estado**: Aceptada
**Contexto previo**: [ADR-0009](0009-registro-de-sitios-en-runtime.md) (registro de sitios en
runtime), [ADR-0010](0010-el-sitio-es-del-item.md) (el sitio es una propiedad del ítem) y
[ADR-0008](0008-arquitectura-nucleo-adaptadores.md) (núcleo + adaptadores).
**Diseño de ejecución**: `docs/portal-anatomy-by-chris-diseno.md` y
`docs/multisitio-diseno.md` §Cómo escribir un portal nuevo.

## Contexto

El corte 7 —escribir el segundo portal— prometía no tocar `core/`. **No se pudo cumplir**, y
conviene dejar escrito por qué, porque el motivo no es de este portal en particular.

Ramón Net resuelve el manifiesto de una clase haciendo `fetch` del HTML de su página con
`credentials: "include"`: el navegador manda la cookie de sesión solo, así que el service
worker no necesita saber nada del usuario. Anatomy by Chris (Hotmart Club) **no**: el iframe
del player lo inyecta JavaScript, y el service worker no ejecuta el JS de la página. La única
vía medida es su API (`GET …/v2/web/lessons/<hash>`), que pide
`Authorization: Bearer <id_token>` — y ese `id_token` vive en el `localStorage` de la pestaña
del portal.

O sea: **un dato que sólo existe dentro de la pestaña y que necesita el service worker**, que
por diseño no tiene pestaña (ADR-0010: la cola está desacoplada a propósito, y sobrevive a que
el usuario cierre el portal). El contrato del escaneo, `ResultadoEscaneo`, es
`{ materia, enlaces[] }` y no tiene dónde llevarlo.

Antes de decidir se **midió** el camino completo del resultado del escaneo hasta el SW, que es
la regla que esta re-arquitectura se saltó cuatro veces (y las cuatro el corte resultó de otro
tamaño). Lo medido:

1. `escanearListado` tiene **un solo consumidor**: `popup.js`, vía `chrome.scripting.executeScript`.
2. Su resultado se re-mapea **campo por campo, a mano**, dos veces: en `popup.js` (a `Clase`) y
   en `popup/features/queue.js` (a `ColaItem`, siete campos elegidos explícitamente).
3. La cola se persiste en `chrome.storage.local` y el **service worker la lee por su cuenta**,
   sin pasar por la normalización de `AppState`.
4. El bucle (`core/cola/procesadorCola.ts`) resuelve el portal por ítem y llama
   `sitio.resolverManifiesto(item.urlInterna, signal)`.

## Decisión

**Las credenciales son un dato del par (usuario, portal), no de la clase**, y se guardan una
sola vez por portal.

- `ResultadoEscaneo` gana un campo **opcional** `credenciales?: Record<string, string>`.
- El popup las guarda al escanear en **`core/estado/credencialesPortal.ts`**, un módulo chico
  sobre `PuertoAlmacenamiento` con la clave `credencialesPortal: { [sitioId]: {...} }`.
- El bucle de descarga las lee **por ítem, en el momento de bajar** —no una vez por ráfaga— y
  se las pasa a `resolverManifiesto(urlClase, signal, credenciales)`, que gana un tercer
  parámetro opcional.
- El contenido es **opaco para el núcleo**: qué claves lleva (`idToken`, …) lo decide cada
  adaptador. Capa 1 no nombra ninguna.
- El módulo se instancia en `plataforma/composicion.ts` y se inyecta a los dos lados, como
  `sitios` e `identidadClase`, y por el mismo motivo: **lo escribe el popup y lo lee el SW**, y
  dos accesos armados por separado a la misma clave es cómo divergen en silencio.

## Alternativas consideradas

**Que la credencial viaje con el ítem** (campo en `Clase` y en `ColaItem`). Es lo primero que
parece, y la medición es lo que lo descartó: obliga a tocar los **cuatro** saltos del camino,
agrega un campo al esquema persistido de **dos** colecciones, **duplica el token en cada ítem**
—con copias que envejecen por separado— y deja credenciales dispersas en storage. Y además no
compra nada: dos clases del mismo portal jamás tendrían credenciales distintas.

**Cosechar el `medias[].url` ya resuelto al encolar** (evita el token en el SW por completo).
Se descartó por medición: el `jwtToken` del embed dura **24 h** y el `hdnts` del master **500
s**, así que encolar resuelto ata la descarga a arrancar dentro de ese plazo — justo lo que la
cola desacoplada existe para no exigir. Queda como plan B si la API cambiara.

**Que el service worker lea el `localStorage` de la pestaña cuando lo necesite** (vía
`chrome.scripting`). Se descartó porque **exige que el portal esté abierto** en el momento de
bajar, que es exactamente la dependencia que ADR-0010 elimina.

**Un miembro `fijarCredenciales()` en el descriptor, con el token en estado de módulo del
adaptador.** Evita tocar el puerto en la firma de `resolverManifiesto`, pero mete estado mutable
en Capa 2, no sobrevive a que el service worker se suspenda (MV3 lo hace todo el tiempo) y deja
sin definir quién lo re-hidrata. Peor por todos lados.

## Consecuencias

- **Se toca Capa 1**, contra lo que el corte 7 prometía: `core/puertos/sitio.ts` (dos campos
  opcionales) y `core/cola/procesadorCola.ts` (un colaborador nuevo). Es un costo real y hay que
  decirlo: **"un portal nuevo no toca `core/`" vale mientras el portal resuelva con la sesión
  del navegador.** Un portal con auth por token la rompe, y el paso a paso genérico ahora lo
  advierte.
- **Los dos campos son opcionales, así que Ramón Net no cambia** ni una línea: ignora el tercer
  parámetro y nunca escribe credenciales.
- **Cambia la forma de storage** → `docs/data-model.md`, en el mismo cambio. **Sin migración**:
  la clave ausente se lee como `{}`.
- **La extensión pasa a guardar una credencial, y antes no guardaba ninguna.** Eso tiene su
  propia sección en `docs/security.md` (qué es, por qué no agrega superficie sobre el
  `localStorage` del portal, y la regla de no loguearla nunca), y desactualiza una afirmación
  que ese doc daba por obvia.
- **Renovar el token es re-escanear el portal**, y como las credenciales son del portal y no del
  ítem, ese re-escaneo arregla **toda** la cola de ese portal de una vez. Que el bucle las lea
  por ítem y no al arrancar la ráfaga es lo que hace que eso funcione a mitad de una cola larga.
- Cuando falta el token, `resolverManifiesto` falla con un mensaje que **dice qué hacer**
  ("re-escaneá el portal"). Sin eso, el síntoma sería "no encontré el video", indistinguible de
  un cambio de markup.
