# Re-arquitectura a núcleo + adaptadores — diseño de ejecución

Diseño concreto de la re-arquitectura de puertos-y-adaptadores + migración a TypeScript.
La **decisión** y su justificación viven en `docs/adr/0008-arquitectura-nucleo-adaptadores.md`
(que supersede a ADR-0001); **este documento es el "cómo"**: estructura de carpetas
objetivo, interfaces de los puertos, elección de bundler y orden de migración. Es el
equivalente de `docs/preact-migration.md` pero para el corte núcleo/adaptadores.

> **Estado**: diseño aceptado, **ejecución no iniciada**. No forma parte de la tanda de
> saldado de deuda técnica (esa queda en JS — ver `docs/ROADMAP.md` Fase 2 y el bug 400 en
> `docs/TECHNICAL_DEBT.md`). Se ejecuta después, incremental, en fases (abajo).

## Objetivo en una línea

Que re-clonar la extensión a **otro sitio** = escribir un adaptador de Capa 2, y a **otro
navegador** = un adaptador de Capa 3, **sin tocar el núcleo**. Hoy los tres tipos de código
(genérico / de sitio / de navegador) están entrelazados en los mismos archivos.

## Estructura de carpetas objetivo

```
src/
  core/                    # Capa 1 — genérico, cero chrome.*, cero Ramón Net
    hls/                   #   motor: pool de workers, parseo M3U8, AES-CBC
    cola/                  #   FIFO + máquina de estados de descarga
    conexion/              #   lógica del daemon (sondeo, clasificación de fallas)
    backend/               #   BunClient (contrato /api/*)
    puertos/               #   TODAS las interfaces (ver abajo)
  sitio/
    ramonnet/              # Capa 2 — implementa PuertoSitio
      scraper.ts           #   selectores DOM            (hoy popup/scraper.js)
      parserTitulos.ts     #   formatTitleStructured / clasificarCatedraYCarpeta / parseSmartDate
      resolverManifiesto.ts#   iframe Bunny + CDN + fallbacks regex (hoy hlsEngine)
      config.ts            #   URL_SONDEO_INTERNET, reglas dNR, cátedras A-D
  plataforma/
    chrome/                # Capa 3 — implementa los puertos de navegador (99 usos chrome.*)
  ui/                      # islas Preact + features (consumen core vía puertos)
  entrypoints/             # popup, service worker, offscreen (composición: inyectan adaptadores)
```

El catálogo exacto de qué archivo/función de hoy migra a cada capa está en **ADR-0008**
(no se repite acá — regla DRY, ADR-0007).

## Puertos propuestos (interfaces TypeScript)

Los puertos son el corazón del diseño y el mayor payoff de fusionar TypeScript: que un
adaptador cumpla su interfaz lo **verifica el compilador**, no una revisión manual. Cada
invariante operativo de hoy pasa a ser parte de una firma.

```ts
// core/puertos/sitio.ts — lo que un sitio DEBE proveer para ser descargable
export interface PuertoSitio {
  escanearListado(doc: Document): ClaseScrapeada[];
  parsearTitulo(crudo: string): TituloEstructurado;         // nombre canónico + fecha
  clasificarCarpeta(t: TituloEstructurado): { catedra: string; carpeta: string };
  resolverManifiesto(htmlPagina: string): Promise<string>;  // URL .m3u8
  urlSondeoInternet: string;
  reglasRed?: RuleSet;                                      // dNR opcional
}

// core/puertos/almacenamiento.ts — hoy chrome.storage.local/.session/.onChanged
export interface PuertoAlmacenamiento {
  get<T>(claves: string[]): Promise<Partial<T>>;
  set(valores: Record<string, unknown>): Promise<void>;     // atómico multi-clave (invariante del SW)
  onCambio(cb: (cambios: CambiosStorage) => void): () => void;
}

// core/puertos/mensajeria.ts — hoy chrome.runtime.sendMessage/onMessage
// La unión discriminada REEMPLAZA los strings sueltos de `action`: el compilador
// verifica cada handler y cada emisor (hoy un typo en "clase_con_error" compila igual,
// y de hecho existe un handler que nadie emite — ver TECHNICAL_DEBT bug 400).
export type MensajeIPC =
  | { action: "iniciar_descarga_cola" }
  | { action: "inyectar_items_en_cola_activa"; items: ClaseCola[] }
  | { action: "obtener_estados_en_progreso" }
  | { action: "clase_guardada_ok"; titulo: string; suaveFrenado: boolean }
  | { action: "clase_con_error"; titulo: string; motivo: string }
  | { action: "cola_pausada_por_error"; tipo: TipoFalla };
  /* ...catálogo completo al ejecutar */
export interface PuertoMensajeria {
  enviar<R>(m: MensajeIPC): Promise<R>;
  onMensaje(cb: (m: MensajeIPC, responder: (r: unknown) => void) => boolean): void;
}

// core/puertos/programador.ts — hoy chrome.alarms (autoheal)
export interface PuertoProgramador {
  programar(nombre: string, opciones: { periodoMin: number }): Promise<void>;
  cancelar(nombre: string): Promise<void>;
  onDisparo(cb: (nombre: string) => void): void;
}

// + PuertoTabs (query/onUpdated), PuertoInyeccion (executeScript),
//   PuertoDescargas (download/search — solo path legacy no-Turbo)
```

**Por qué así:** el `.set()` atómico multi-clave (hoy convención en comentarios — ver
`docs/patterns.md` §State ownership y las escrituras consolidadas de `background.js`) pasa a
ser la **firma** del puerto; un adaptador de sitio nuevo no compila si le falta
`resolverManifiesto`; y el catálogo IPC tipado cierra la clase de bugs "handler que nadie
emite".

## Bundler: recomendación WXT (sobre Vite + CRXJS)

| | WXT | Vite + CRXJS |
|---|---|---|
| Manifest MV3 | Generado desde `entrypoints/` | A mano |
| Multi-navegador | `wxt build -b firefox` de fábrica | Manual |
| HMR popup + SW | Sí | Parcial |
| Mantenimiento | Activo, dedicado a extensiones | Históricamente irregular |

El objetivo de la Capa 3 (apuntar a otro navegador) coincide con el target multi-browser
nativo de WXT, así que es el **default propuesto**. Decisión final al arrancar la ejecución.
Esto acepta el paso de build que ADR-0001 evitaba — a cambio de reutilización + tipos
(justificación completa en ADR-0008).

## Orden de migración (incremental — nunca big-bang)

1. **Parsers puros → `sitio/ramonnet/`** (`parserTitulos`, `resolverManifiesto`): sin
   `chrome.*`, con los 39 tests de caracterización ya existentes como red.
2. **`BunClient` + lógica del daemon → `core/`**: fetch puro, ya testeados.
3. **`PuertoAlmacenamiento` + `PuertoMensajeria`** + adaptador Chrome: el corte transversal
   grande — conversión de globales `window.X`/`self.X` a módulos ES + TS de cada archivo al
   tocarlo, **una sola pasada por archivo** (por eso TS va fusionado, no aparte).
4. **Motor HLS → `core/hls/`** consumiendo puertos (llega con el pool ya testeado, si se
   ejecutó A3 del roadmap antes).
5. **`background.js` y `popup.js`** quedan como composición en `entrypoints/` (inyectan los
   adaptadores concretos en el núcleo).

## Estado de avance

| Fase de migración | Estado |
|---|---|
| Diseño (este doc + ADR-0008) | ✅ Redactado (2026-07-19) |
| 1 — Parsers puros → `sitio/` | ⏳ No iniciada |
| 2 — BunClient + daemon → `core/` | ⏳ No iniciada |
| 3 — Puertos storage/IPC + adaptador Chrome + TS transversal | ⏳ No iniciada |
| 4 — Motor HLS → `core/hls/` | ⏳ No iniciada |
| 5 — Entrypoints (composición) | ⏳ No iniciada |
