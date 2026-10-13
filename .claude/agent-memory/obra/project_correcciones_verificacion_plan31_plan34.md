---
name: Correcciones de la verificación del Plan 31 (Plan 34)
description: Serialización FIFO IPC SW, silenciado tras pagehide en scrapers Moodle, extracción nombre visible /my/, extensión real Moodle/Drive y miembros 21-22 en PuertoSitio
metadata:
  type: project
---

### Resumen del plan
- Correcciones detectadas durante la verificación interactiva del Plan 31.
- Paso 1: Serialización de eventos IPC `recorrido_evento` en `background.js` con cola de promesas FIFO por pestaña (`colaEventosPorPestana`).
- Paso 2: Supresión de avisos de error tras descarga/navegación mediante variable `paginaSaliendo` y oyente `pagehide` en los 3 scrapers Moodle.
- Paso 3: Extracción de nombres visibles limpios en `/my/` descartando texto accesible oculto (`.sr-only`, `.accesshide`) con `extraerNombreVisible`.
- Paso 4: Detección dinámica de extensiones reales de recursos en Ingeniería y Asignaturas (`Content-Type` y `Content-Disposition` con HEAD o fallback GET abortado).
- Paso 5: Manejo de `.md` para accesos directos Drive y asignación `.pdf` a PDFs en `sitio/sites-matec/descargarAdjunto.js`.
- Paso 6: Miembro 21 en `PuertoSitio`: `sugerenciaPortada`, sugerencia en raíz de Moodle para navegar a `/my/`.
- Paso 7: Miembro 22 en `PuertoSitio`: `textosUI`, textos contextuales por portal para escaneo multicurso y portada.
- Paso 8: Documentación de los miembros 21 y 22, actualización de baseline a 87 archivos / 1330 tests (+17 tests).

### Hallazgos y puntos a recordar
1. **Vitest y worktrees**: Al correr Vitest directamente sin el flag `--exclude '.worktrees/**'`, se descubren archivos de pruebas en `.worktrees/asignaturas-kaltura` y `.worktrees/ideas-info`. Como no tienen el directorio generado `.wxt/`, fallan con `TSConfckParseError: failed to resolve "extends":"./.wxt/tsconfig.json"`. Las invocaciones deben incluir siempre `--exclude '.worktrees/**'`.
2. **Contrato `PuertoSitio`**: Alcanza 22 miembros formales en `core/puertos/sitio.ts` v1.12.0. Los miembros 21 (`sugerenciaPortada`) y 22 (`textosUI`) son opcionales y personalizan la UI del popup sin acoplamiento.
3. **Paridad de tres vías en Moodle**: El bloque `<recorrido-moodle>` se mantiene idéntico byte a byte entre LINTI, Asignaturas e Ingeniería (validado por `sitio/moodle-recorrido-paridad.test.js`).
4. **Verificación interactiva en navegador**: Detenida previo a los pasos interactivos V-1 a V-8 debido al paso `[USUARIO]` de autenticación en el entorno real de Moodle Ingeniería.
