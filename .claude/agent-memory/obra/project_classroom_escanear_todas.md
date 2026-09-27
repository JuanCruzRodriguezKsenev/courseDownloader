---
name: classroom-escanear-todas
description: Detalles de implementación del escaneo multi-curso de Classroom desde la portada (/h)
metadata:
  type: project
---

# Classroom: Escaneo multi-curso (portada /h)

## Puntos clave de la ejecución
- **ADR-0016 (Script inyectado avisando al Service Worker)**: Dado que un recorrido de todos los cursos puede durar varios minutos y el popup se cierra ante cualquier click fuera de él, el script inyectado en la pestaña utiliza `chrome.runtime.sendMessage` para despachar eventos (`inicio`, `latido`, `curso`, `fin`) directamente al Service Worker.
- **Reductor puro y persistencia en SW**: `core/estado/recorridoTodos.ts` implementa `aplicarEvento` y `esVigente` sin dependencias de Chrome. El SW escucha `recorrido_evento` y persiste en `storage.local.recorridoTodos`.
- **Lector en composición**: El popup no accede a storage directo; consume `RecorridoTodos` (`crearLectorRecorrido`) exportado en `plataforma/composicion.ts`, con suscripción para reflejar progreso en vivo.
- **Tabla de decisión de apertura (`decidirAlAbrir`)**: Evalúa primero si hay recorrido vigente (`mostrar-recorrido`), luego si terminó sin materializar (`materializar-recorrido`), luego si aplica lista guardada por clave (`"todos"` en portada), luego si es portada (`ofrecer-todos`) y finalmente escaneo de curso individual.
- **Agrupamiento en Preact (`ctx.grupos`)**: La lógica de orden y agrupamiento vive en `popup.js` (orden global de cursos + orden del comparador dentro del curso). La isla `listaClases.preact.js` es vista pura e intercala `<div class="grupo-curso">` antes del índice `desde`.
- **Selectores en tests de filas**: Cada fila de clase renderiza su título en `.video-label`, no en `.title` (`.title` es el atributo del contenedor).
- **Correcciones del recorrido multi-curso (2026-09-27)**:
  - *Asentado de Trabajo en clase (`asentadoVacio`)*: `[data-no-topic-items]` aparece antes de los ítems en primera visita (M-C). Se espera que se sostenga `asentadoVacio` (2000 ms) sin ítems, progressbar ni "Ver más" para no dar por vacío un curso con material.
  - *Espera de nav de curso (`navTrabajoOk`)*: Esperar enlace `/w/<id>/t/all` tras navegar para evitar falla en cursos con carga diferida de nav.
  - *Archivados y nombres*: Esperar 5000 ms a que pinten tarjetas en `/h/archived`; resolver nombres desde `aria-label` en sidebar o anclas globales para evitar iniciales pegadas del avatar e ids base64.
  - *Cancelación con `idCancelacion` y tests zombi*: En carrera de tope por curso, incrementar token de cancelación para abortar promesas en vuelo; el test 23 requiere que el zombi valide identidad en el DOM del curso siguiente para intentar navegar y hacer daño medible si no se cancela.
  - *Estado terminal en reductor*: `aplicarEvento` descarta `latido`, `curso` y `fin` si `prev.estado !== "escaneando"`.
  - *Popup en recorrido*: Modo `"recorriendo"` con label `""` oculta el botón; `ofreciendoTodos` como booleana desacoplada previene tapar la card de fin sin material.
- **Compuerta final**: 44 archivos, 764 tests unitarios pasando, 0 errores/warnings en lint, typecheck limpio y build verificado.
