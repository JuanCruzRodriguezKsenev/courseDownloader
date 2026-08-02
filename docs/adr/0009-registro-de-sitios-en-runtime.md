# 0009 — Selección del sitio en runtime (registro por URL), no una build por portal

**Fecha**: 2026-08-02
**Estado**: Aceptada
**Contexto previo**: [ADR-0008](0008-arquitectura-nucleo-adaptadores.md) (define las capas;
esta decisión resuelve un punto que quedó abierto en su diseño de ejecución)

## Contexto

La Capa 2 ya existe: todo lo específico de Ramón Net vive en `sitio/ramonnet/` y hoy
`SitioActivo = SitioRamonNet` es una constante. Para soportar un segundo portal hacía falta
decidir **cómo se elige el adaptador activo**. Las dos opciones eran:

1. **Una build por portal**: el bundler compila un artefacto por sitio, cada uno con su
   manifest (sólo sus `host_permissions` y sus reglas dNR).
2. **Registro en runtime**: una sola extensión que conoce N adaptadores y elige según la URL
   de la pestaña / de la clase.

El diseño de ejecución (`docs/rearquitectura-diseno.md`) recomendaba la opción 1, apoyándose
en gran medida en que pedir `host_permissions` de todos los portales soportados es una señal
de rechazo en la review de la Chrome Web Store y desconfianza para el usuario final.

**Ese argumento no aplica a este proyecto**: la extensión es de uso personal, se carga
descomprimida en modo desarrollador y no se va a publicar nunca (ver
`docs/deployment.md`). Sin la restricción de la Store, la comparación se decide por
simplicidad de uso y mantenimiento, donde la opción 2 gana claramente: una sola extensión
instalada, una sola recarga, sin configuración de targets del bundler.

## Decisión

Adoptar el **registro de sitios en runtime**. `SitioActivo` deja de ser una constante y pasa
a resolverse a partir de una URL contra un registro de adaptadores:

```js
const SITIOS = [SitioRamonNet /*, SitioOtroPortal, ... */];
function resolverSitio(url) {
  return SITIOS.find(s => s.esPaginaDelSitio(url)) || null;
}
```

Cada adaptador ya expone `host` y `esPaginaDelSitio(url)`, así que el registro no necesita
nada nuevo de la Capa 2.

### Dónde se resuelve

- **Popup**: con la URL de la pestaña activa (que ya consulta para decidir si puede escanear).
- **Service worker**: **por ítem de la cola**, usando su `urlInterna` — no una vez global. La
  cola es persistente y puede mezclar clases de dos portales; resolver el adaptador una sola
  vez al arrancar la ráfaga descargaría un ítem con el parser y el CDN del portal equivocado.

## Lo que sigue siendo estático (y hay que mantener a mano)

El manifest no se puede modificar en runtime, así que agregar un portal implica **también**
editarlo:

- **`host_permissions`**: tiene que listar los orígenes de todos los portales soportados. La
  alternativa más prolija es declararlos en `optional_host_permissions` y pedirlos con
  `chrome.permissions.request()` la primera vez que se usa ese portal; para uso personal,
  listarlos directo es suficiente.
- **Reglas `declarativeNetRequest`**: los rulesets se declaran en el manifest, uno por sitio
  (`sitio/<portal>/rules.json`), y se pueden dejar con `"enabled": false` y activarlos según
  el portal en uso con `chrome.declarativeNetRequest.updateEnabledRulesets`. Para un solo
  portal activo a la vez alcanza con dejarlos todos habilitados: las reglas están acotadas por
  `urlFilter` al dominio de su CDN. (Confirmar la firma exacta de esa API contra la doc de
  Chrome al implementarlo: la referencia vendorizada en `.agents/skills/` documenta el flag
  `enabled` del manifest pero no la llamada de conmutación.)

## Consecuencias

- Se **desbloquea la Fase 3** de `docs/rearquitectura-diseno.md`: WXT ya no necesita
  configuración de targets por portal, y `wxt.config.ts` genera un único manifest.
- Agregar un portal = escribir `sitio/<portal>/` + sumarlo al registro + agregar su origen y
  su ruleset al manifest. Sin tocar el núcleo.
- El núcleo y la UI **no** reciben más `SitioActivo` como constante importada: se les inyecta
  el adaptador resuelto (`ctx.sitio`, como ya hacen `FacetaFeature` y `FilterFeature`). Los
  call-sites que hoy usan la global `SitioActivo` directo (`popup.js`, `background.js`) son los
  que hay que convertir cuando esto se implemente.
- Riesgo asumido: si dos adaptadores matchean la misma URL, gana el primero del registro. Con
  hosts distintos no pasa; si algún día se soportan dos portales del mismo dominio, hará falta
  un criterio de desempate más fino que `url.includes(host)`.
