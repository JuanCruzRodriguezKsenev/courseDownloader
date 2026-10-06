---
name: Escaneo multicurso en Moodle LINTI e Informática (Plan 29)
description: Recorrido de todos los cursos en Moodle LINTI e Informática desde la portada /my/, extracción de escanearCurso, bloque duplicado con test de paridad y corte por sesión
metadata:
  type: project
---

### Resumen del plan
- Implementación del escaneo multi-curso en Moodle LINTI (`catedras.linti.unlp.edu.ar`) e Informática (`asignaturas.info.unlp.edu.ar`) desde sus portadas `/my/` y `/my/courses.php`.
- Extracción limpia de `escanearCurso(doc, ctx)` en ambos scrapers para mantener la inyección serializable y autocontenida sin romper el modo de curso individual.
- Bloque `<recorrido-moodle>` duplicado e idéntico byte a byte entre ambos scrapers, protegido por `sitio/moodle-recorrido-paridad.test.js`.
- Corte limpio por sesión (`motivoCorte: "sesion"`) y cancelación reactiva por `chrome.runtime.onMessage`.

### Hallazgos y puntos a recordar
1. **Cancelación en portales con un solo curso**: En Informática (`mis-cursos.html` con 1 curso), si la cancelación se dispara durante el escaneo del único curso pero el `fetch` mock no aborta arrojando excepción, el bucle `for` finaliza normalmente sin ingresar a la siguiente iteración. Se requiere chequear `if (cancelado)` inmediatamente después del bucle antes de emitir `fin terminado`.
2. **Inyección autocontenida**: Las funciones internas de `escanearCurso` (`esPantallaLogin`, `procesarActividad`, etc.) deben residir enteramente dentro del ámbito de `escanearListado`, asegurando que `toString()` serialice todo y no existan referencias libres en `sitio/inyeccion.test.js`.
3. **Paridad byte a byte**: El test de paridad `sitio/moodle-recorrido-paridad.test.js` garantiza que cualquier cambio o corrección futura en el recorrido multi-curso de Moodle aplique a todos los scrapers de la plataforma por igual.
4. **Baseline**: La compuerta pasa a 82 archivos y 1262 tests (+1 archivo, +23 tests).
