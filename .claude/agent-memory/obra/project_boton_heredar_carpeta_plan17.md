---
name: Botón Heredar carpeta en editor (Plan 17)
description: Botón «↺ Que hereden» en tarjetas de tema de adopción, deshabilitación reactiva, exclusión de inmutables y omitidos, sin cascadear desde selector de tema
metadata:
  type: project
---

# Botón Heredar carpeta en editor (Plan 17)

- **D-1 a D-5 en `backend/adopcion/editor.html`**:
  - Plantilla de `.topic-right`: agregado `<button class="secondary-btn btn-heredar-carpeta">` antes de `.btn-drilldown-toggle`.
  - Deshabilitación reactiva: disabled si el tema está omitido (`tema.destino === "-"`) o si ningún archivo tiene override distinto del destino del tema (`cantHeredables === 0`).
  - Acción de herencia: sólo afecta a archivos no inmutables (`accion !== "ya-esta"`) y no omitidos (`accion !== "omitir"`). Pone `destinoPropio = ""` y `carpeta` resuelta con `resolverCarpeta(tema.destino, curso.docente)` (o `.` si no hay destino).
  - Toast informativo `N archivos de "<tema>" heredan <carpeta>`, `marcarCambio()` y `renderAll()`.
  - El selector `.topic-dest-select` no cascadea a los archivos (regla del dueño mantenida intacta).
- **Pruebas en `backend/adopcion/humo-editor-indice.js`**:
  - Ejercita tema con carpeta `Teorias`, 2 archivos con override `.`, 1 `ya-esta` (inmutable) y 1 `omitir`.
  - Afirma que tras el click en `.btn-heredar-carpeta`, ambos archivos pasan a `destinoPropio === ""` y `carpeta === "Teorias"`, mientras `ya-esta` y `omitir` quedan inalterados, y el botón se deshabilita.
  - Al guardar en disco, el índice generado no contiene claves en `curso.carpetas` para los archivos que heredan.
  - Regla del dueño probada: cambiar la carpeta del tema vía `.topic-dest-select` no altera el `destinoPropio` de los archivos.
  - Control negativo ejecutado con salida roja confirmada al forzar cascada en el selector de tema; restaurado limpiamente.
- **Suite unitaria en `core/destino/vistas.test.ts`**:
  - Test añadido para `destinoPropio === ""` en `filasEditorAIndice`: verifica que el archivo no se persista en `nuevoCurso.carpetas`.
- **Baseline de compuerta**:
  - 78 archivos / 1140 tests (+1 test en `vistas.test.ts`).
