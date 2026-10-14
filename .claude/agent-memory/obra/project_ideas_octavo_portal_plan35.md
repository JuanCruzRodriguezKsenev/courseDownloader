---
name: IDEAS, el octavo portal (Plan 35)
description: Octavo portal IDEAS (LIDI, UNLP) por curso y multicurso desde /home, compuerta M-1 desde service worker, fixtures reales saneados, content-disposition y desduplicación por choques
metadata:
  type: project
---

### Resumen del plan
- Implementación del octavo portal `ideas-info` (`ideas.info.unlp.edu.ar`).
- Paso 1 (M-1): Medición de cookie HttpOnly desde el service worker con credenciales previa al código; 200 application/pdf directo.
- Paso 2: Fixtures reales capturados y saneados (NFR-1) para home, material, medioteca, login y 9 secciones (33 archivos, sin datos personales).
- Paso 3: Módulos `parserTitulos.js` y `descargarAdjunto.js` (validación de `idArchivo` `<slug>/(material|medioteca)/<guid>`, corte por `/login` y rechazo 404/410).
- Paso 4: `scraper.js` autocontenido con escaneo de un curso y multicurso desde `/home` entre marcadores `// <recorrido-ideas>` y `// </recorrido-ideas>`, lectura de `content-disposition` con prioridad `filename*`, desduplicación de choques con texto del enlace y sufijo numérico, y paso previo por `EnterCourse`.
- Paso 5: Descriptor `config.ts`, alta en `sitio/registro.ts`, `entrypoints/background.js`, `entrypoints/popup/main.js`, `eslint.config.js`, `backend/destino/portales.js` y evaluación JSDOM en `sitio/inyeccion.test.js`.
- Paso 6: Documentación al día (`docs/multisitio-diseno.md`, `docs/architecture.md`, `docs/deployment.md`, `docs/testing.md`).
- Baseline final: 91 archivos, 1372 tests (+4 archivos, +38 tests), todo en verde.

### Hallazgos y puntos a recordar
1. **Nombres desde `content-disposition`**: IDEAS es el primer portal donde los nombres de archivo provienen del header `content-disposition` al escanear (GET cancelando body), priorizando `filename*=` (RFC 5987) sobre `filename=`.
2. **Desduplicación por choques en un tema (RN-6, AC-10)**: Si dos archivos en un mismo tema tienen el mismo nombre en disco, se agrega ` - <texto del enlace>`. Si siguen colisionando (mismo texto), se agrega ` (2)`, ` (3)`.
3. **Bloque multicurso independiente**: IDEAS no es Moodle, por lo que su recorrido vive en `// <recorrido-ideas>` y no entra en el test de paridad de Moodle.
4. **Paso previo `EnterCourse` por curso**: En el recorrido desde `/home`, antes de escanear cada curso se consulta su endpoint de bienvenida para inicializar el contexto de sesión del curso; si redirige a `/login`, el recorrido se corta inmediatamente sin registrar el curso como fallido.
5. **Sesión corta en IDEAS**: La sesión de IDEAS en el servidor vence en menos de 1 hora; si vence durante pruebas, basta enviar `#_submit` en `/login` aprovechando el autocompletado del perfil para restablecerla.
