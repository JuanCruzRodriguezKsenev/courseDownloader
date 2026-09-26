# 0016 — Un script inyectado puede avisar al service worker vía IPC

**Fecha**: 2026-09-25
**Estado**: Aceptada
**Contexto previo**: [ADR-0008](0008-arquitectura-nucleo-adaptadores.md) (núcleo y adaptadores), [ADR-0010](0010-el-sitio-es-del-item.md) (el sitio es del ítem).
**Diseño de ejecución**: `docs/specs/classroom-escanear-todas/spec.md`, `docs/plan-classroom-escanear-todas.md`.

## Contexto

El modelo original de la extensión asumía que el escaneo de un aula virtual duraba lo que el popup
estaba abierto: el popup llamaba a `chrome.scripting.executeScript`, el script inyectado retornaba su
resultado al terminar el escaneo y el callback del popup procesaba las clases encontradas.

Con el escaneo de todos los cursos de Google Classroom desde la portada (`/h`), ese supuesto se
rompe: recorrer 5 a 20 cursos toma varios minutos. Durante ese tiempo:
- El **popup se cierra** ante cualquier click fuera de él o al cambiar de foco (su ciclo de vida es
  efímero y no controlable por la extensión). Si el popup orquestara o esperara el retorno sincrónico
  del script, cerrar el popup abortaría o perdería el resultado del escaneo entero.
- El **service worker de MV3 se suspende** por inactividad a los 30 segundos si no hay eventos activos.
- La **pestaña del navegador**, en cambio, es el único contexto de ejecución que sobrevive de forma
  continua mientras el usuario la mantenga abierta.

## Decisión

**Un script inyectado en la pestaña puede mandar mensajes directamente al Service Worker vía
`chrome.runtime.sendMessage` cuando su trabajo dura más que el popup.**

En particular, para el recorrido multi-curso de Classroom:
1. El script inyectado emite eventos estructurados (`recorrido_evento`: `inicio`, `latido`, `curso`,
   `fin`) invocando `chrome.runtime.sendMessage`.
2. El Service Worker escucha `recorrido_evento`, actualiza el estado agregador con un reductor puro
   (`aplicarEvento`) y lo persiste en `chrome.storage.local.recorridoTodos`.
3. Al despertar o reabrir el popup, éste lee el estado del recorrido desde storage a través de
   `RecorridoTodos` (`crearLectorRecorrido`) y decide si mostrar el progreso o materializar el listado
   sin acoplarse al ciclo de vida del script inyectado.

### Relación con `PuertoMensajeria` y aislamiento de contextos

En `AGENTS.md` (§Execution contexts) la regla establece que "IPC goes through `PuertoMensajeria`".
Sin embargo, **el script inyectado (`Scraper.escanearAulaVirtual`) corre en el DOM de la página del
tercero y no puede importar módulos ES**: se inyecta como función autocontenida sin imports.
Por la misma razón que no puede importar `config.ts` o helpers del núcleo, no puede importar
`PuertoMensajeria`. Su llamada a `chrome.runtime.sendMessage` es una excepción explícita y delimitada a
la frontera de inyección.

## Consecuencias

- **A favor**: El recorrido sobrevive al cierre del popup; el usuario puede cerrar la ventana de la
  extensión y volver a abrirla para ver el progreso vivo o el resultado terminado; el estado reside en
  storage local administrado por el SW.
- **IPC deja de ser exclusivamente popup ↔ SW**: ahora existe emisión desde la pestaña hacia el SW.
- **El script inyectado sigue autocontenido**: no requiere empaquetado ni imports externos; recibe sus
  parámetros como argumentos serializables y utiliza `chrome.runtime.sendMessage` directamente.
- **Tests**: los tests de integración y unidad del scraper stubean `chrome.runtime.sendMessage` para
  afirmar la secuencia de eventos sin requerir un service worker real.

## Alternativas descartadas

- **Orquestar el recorrido desde el Service Worker.**
  Implicaba que el SW navegara la pestaña curso por curso, inyectando un scraper individual por cada
  uno, esperando y manejando timeouts con alarmas de Chrome para no suspenderse. Multiplicaba la
  complejidad de sincronización y fragilidad ante la navegación del usuario. En cambio, dejar que la
  pestaña navegue su propia SPA con `pushState` / DOM y reporte latidos es mucho más simple y rápido.
- **Exigir mantener el popup abierto durante todo el escaneo.**
  Inviable: en Chrome/Brave un popup se cierra automáticamente con cualquier interacción con el
  navegador o el sistema operativo. Un escaneo de varios minutos fracasaría el 100% de las veces.
