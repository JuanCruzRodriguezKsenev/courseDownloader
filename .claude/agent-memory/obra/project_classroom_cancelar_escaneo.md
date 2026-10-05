---
name: classroom-cancelar-escaneo
description: Cancelación de escaneo en fila "Escaneando…" del loader para recorrido multi-curso y un curso en Classroom
metadata:
  type: project
---

# Cancelación de escaneo (Classroom y recorrido multi-curso)

## Puntos clave de la ejecución
- **Contrato de corte y motivo (`core/estado/recorridoTodos.ts`)**:
  - `MotivoCorte = "visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta" | "cancelado"`.
  - Evento `fin` admite `tabId` y `sitioId` opcionales.
  - Soporte de `fin` sin previo: crea un recorrido cortado de una parada (cierra el hueco de cancelación sin `inicio`).
  - Guarda en `inicio`: si ya existe un recorrido terminal (`"completado"` o `"cortado"`) con el mismo `id`, se ignora para evitar reactivación accidental.
  - Textos de resumen dedicados: `"Recorrido cancelado"` cuando el motivo es `"cancelado"`, y `"Sin cursos para escanear"` cuando `total === 0` (PA-1).
- **Control de cancelación en scraper (`sitio/google-classroom/scraper.js`)**:
  - Oyente directo de mensajes en content script: `cancelar_escaneo` activa `cancelado = true` y dispara `abortarEsperas()`.
  - `dormir` inmediato: si `cancelado` ya es true, retorna inmediatamente sin esperar el timeout.
  - `finally` exterior: asegura `chrome.runtime.onMessage.removeListener` al salir tanto en escaneo de un curso como en recorrido multi-curso.
  - Control de cancelación en modo un curso: limpia esperas y lanza error de cancelación para evitar procesamiento posterior.
  - Control de cancelación en modo multi-curso: corta el bucle sin intentar volver a `/h`.
  - **Control negativo verificado**: al mutar el catch de la carrera omitiendo `if (cancelado) throw ...`, el test S1 falló porque el índice 1 se marcaba erróneamente como fallido en lugar de frenar el recorrido, violando RN-11. Restaurado inmediatamente.
- **Capacidad en puerto (`core/puertos/sitio.ts` y `sitio/google-classroom/config.ts`)**:
  - `escaneoCancelable?: boolean` en `PuertoSitio`.
  - Activado `escaneoCancelable: true` en la configuración de Google Classroom.
  - Conteo de miembros de `PuertoSitio` medido exactamente en 19 (se actualizaron las referencias en `AGENTS.md` y `docs/multisitio-diseno.md`).
- **UI en loader con detalle (`popup/features/loaderDetalle.preact.js` y `styles/components/loader.css`)**:
  - Soporte de `cancelar: { onCancelar, cancelando }` en el estado de la isla.
  - Métodos `habilitarCancelar`, `marcarCancelando` y `getCancelar`.
  - Renderizado condicional del botón `<button class="btn-cancel loader-cancelar">` en la fila del curso actual ("Escaneando…") cuando no está ya cancelando.
  - Estilos CSS con alineación a la izquierda vía `&:has(.loader-cancelar) { justify-content: flex-start; }`.
- **Cableado en popup (`popup.js`)**:
  - Recorrido multi-curso: `pedirCancelacionRecorrido` envía `cancelar_escaneo` a la pestaña activa, marca `cancelando: true` en la UI y establece un timeout de seguridad de 3 s que emite `fin` cortado por `"cancelado"` si la pestaña no responde.
  - Escaneo de un curso: `cerrarPorCancelacion` envía `cancelar_escaneo`, desarma el loader y restaura la lista previa si existía (`mostrarListaGuardada`) o muestra tarjeta de info cancelada.
- **Batería y documentación**:
  - Baseline actualizada a 46 archivos y 813 tests (+11 tests: +4 en `recorridoTodos.test.ts`, +4 en `scraper.test.js`, +3 en `loaderDetalle.preact.test.js`).
  - Documentados `docs/data-model.md`, `docs/patterns.md`, `docs/testing.md` y sección 11 en `docs/portal-google-classroom-diseno.md`.
