---
name: classroom-destino-2c4-editor-monocromo
description: Sub-corte 2c-4, nuevo editor web monocromo de alta densidad (backend/adopcion/editor.html, estética Monocromo Funcional Estricto, sidebar persistente, macro temas + Novedades RN-31, micro tick por archivo con selector de carpeta individual D-4, filtros chips, recálculo de choques, compatibilidad con humo-editor-indice.js y humo-editor.js, compuerta en 64 archivos / 1029 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2c-4 (Nuevo editor web monocromo de alta densidad)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08c - 2c-4 Nuevo editor web monocromo de alta densidad.md` en rama `classroom-destino-2c`.
- **Partida (K-1)**:
  - Verificada compuerta de partida en verde: 64 archivos / 1029 tests.
  - Humo en verde previo: `humo-editor.js` (errores: 0) y `humo-editor-indice.js` (errores: 0).
- **Construcción de `backend/adopcion/editor.html` (K-2)**:
  - Reemplazado `backend/adopcion/editor.html` basándose en el prototipo funcional validado en `~/Descargas/05-workspace-monocromo/`.
  - **CSS embebido en `<style>`**:
    - Tokens de Monocromo Funcional Estricto (`#F6F7F9` / `#FFFFFF` / `#0F172A` en claro, `#0B0D11` / `#13171F` / `#F8FAFC` en oscuro).
    - Color reservado únicamente al semáforo de datos: Verde (`#16A34A`/`#22C55E`), Ámbar (`#D97706`/`#FBBF24`), Rojo (`#DC2626`/`#EF4444`).
    - Scrollbar universal de 8px con `--scroll-thumb`.
    - Estilos neutros para panel de ensayo (`#panel-resultados`), inputs y botones.
  - **Estructura HTML**:
    - Header superior con marca neutra, `#aviso-cambios` con `.status-dot`, `#btn-probar` y `#btn-guardar`.
    - Layout con `.sidebar` (`#courseSearch`, `#courseList`, metadatos en pie) y `.workspace-main`.
    - Cabecera `#cabecera-curso` con `h2` ("Asociar curso" o nombre del curso), contenedor `.tabla-curso-cabecera` con select de materia y input de docente (compatibilidad estricta con `humo-editor-indice.js`).
    - Strip de filtros rápidos por chips (`all`, `ready`, `review`, `unassigned`, `omitted`, `clash`).
    - Toolbar con buscador `#filtro-texto-archivos`, toggle `#btnOnlyProblems`, botones de expandir/colapsar y aplicar reglas sugeridas.
    - Contenedor `#topicsContainer` con tarjetas macro de temas y tablón de Novedades (RN-31).
  - **Lógica JS**:
    - Rutas relativas `api/datos${location.search}`, `api/guardar${location.search}` y `api/ensayo${location.search}`.
    - Drilldown micro con tick individual (`.file-check`), input de renombre `inp-nom-${arch.clave}`, select de acción sincronizado `sel-acc-${arch.clave}` y selector de carpeta `file-dest-select` (`FilaArchivoEditor.carpeta`).
    - Recálculo en vivo de rutas y choques (`recalcularChoques`, `FILAS_CON_CHOQUE`).
    - En `renderTopics()`, los contenedores de drilldown `.files-drilldown` se conservan en el DOM con atributo `hidden` cuando están colapsados, permitiendo que los selectores de búsqueda e interactividad encuentren siempre las filas e inputs.
- **Comprobación de humo (K-3)**:
  - `bun backend/adopcion/humo-editor.js` → `errores: 0`.
  - `bun backend/adopcion/humo-editor-indice.js` → `errores: 0`.
- **Docs y estado**:
  - `docs/ramas-en-revision.md`: estado actualizado a Plan 08c ejecutado.
- **Batería y veredicto (K-4)**:
  - `verificador` ejecutó la batería completa del proyecto: 64 archivos pasados (64), 1029 tests pasados (1029), 0 errores / 0 warnings en ESLint, typecheck limpio, build de WXT exitoso (287.34 kB), y ambos scripts de humo en errores: 0.
