---
name: loader-con-progreso
description: Detalles de implementación del loader con progreso en escaneos individual y multi-curso
metadata:
  type: project
---

# Loader con progreso (individual y multi-curso)

## Puntos clave de la ejecución
- **Inicialización de throttle en scraper (`ultimoReporteMs = 0`)**: Al implementar el límite de 500 ms en `sitio/google-classroom/scraper.js`, inicializar `ultimoReporteMs = Date.now()` hacía que la primera fase (`trabajo`) cayera en el buffer y fuera sobreescrita antes de enviar. Inicializar en `0` garantiza emisión inmediata de la primera fase y respeta el espaciado `>= 500 ms` subsiguiente.
- **Isla Preact de detalle (`loaderDetalle.preact.js`) y fake timers en tests**:
  - El contenedor `#ui-loader-detalle` aloja la lista de items escaneados, reloj y contador.
  - En tests con Vitest fake timers (`vi.useFakeTimers()`), un tick asíncrono (`await vi.advanceTimersByTimeAsync(100)`) es necesario antes de verificar el reloj inicial `0:00` para permitir que el `useEffect` de Preact complete el montaje del `setInterval` en jsdom.
- **Sincronización unificada en `popup.js`**:
  - `sincronizarLoaderRecorrido()` proyecta `vistaLoaderRecorrido` al loader y reemplaza la card estática `#ui-recorrido-progreso` que antes vivía en Disponibles.
  - `ocultarLoader()` invoca `limpiarLoaderDetalle()` para no dejar estado residual si más tarde se muestra un loader genérico ("Conectando con el servidor…").
- **Vuelta automática a portada (`/h`)**:
  - `ejecutarEscaneoTodosClassroom` navega de regreso a la portada una vez completados todos los cursos (o al detenerse), garantizando que el usuario quede en contexto natural de Classroom al finalizar.
- **Compuerta final**: 46 archivos, 796 tests unitarios pasando, 0 errores/warnings en lint, typecheck limpio (`tsc --noEmit`) y build verificado (270.53 kB).
