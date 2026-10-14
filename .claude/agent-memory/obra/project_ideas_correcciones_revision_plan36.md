---
name: IDEAS: Correcciones de la revisión del plan 35 (Plan 36)
description: Saneamiento de GUID de usuario en la historia git, manejo estricto de errores del portal como cursos fallidos, orden de secciones, origen seguro y GUID en mayúsculas
metadata:
  type: project
---

### Resumen del plan
- **Paso 1 (NFR-1)**: Sacado de la historia el GUID real de usuario de `/getUserPicture/<guid>/` en las muestras mediante `fixup` sobre `4e977a7` y `rebase -i --autosquash 23455a5` no interactivo. 0 ocurrencias en `23455a5..HEAD`.
- **Paso 2 (A1, RN-15, RN-12, RN-9, RN-5)**: Scraper actualizado para no dar por bueno ningún error del portal:
  - Chequeo de `!respMaterial.ok` antes de leer texto con aviso de portal.
  - Secciones procesadas concurrentemente pero acumulando en `fallaPortal` si hay error HTTP o de red, preservando el orden estricto de secciones en `archivosCandidatos = resultadosPorSeccion.flat()`.
  - Medioteca con chequeo de `!respMedioteca.ok` y error de red con motivo de portal.
  - Headers: 404/410 saltea el archivo (RN-12); cualquier otro error HTTP cancela el body y marca `fallaPortal` con aviso específico; error de red también marca `fallaPortal`.
  - Origen seguro: validación `u.origin === new URL(origen).origin` antes de agregar candidatos a headers.
  - `SLUG_VALIDO = /^[a-z0-9-]+$/` definido dentro de `escanearListado`, aplicado en recorrido (curso fallido con motivo explicativo sin fetch) y en curso individual (`fuera-de-curso`).
  - EnterCourse: `!respEnter.ok` emite curso fallido `HTTP <status>`, y lectura de texto en `try-catch` capturando tope o error de red.
  - Cabecera V1.1.0 con bullet `[PLAN 36]`.
- **Paso 3 (RN-5)**: `REGEX_ID_ARCHIVO` en `descargarAdjunto.js` ampliado para aceptar GUID con hexadecimales en mayúsculas `/^([a-z0-9-]+)\/(material|medioteca)\/([0-9a-fA-F-]{36})$/`.
- **Paso 4 (Tests)**: Agregados tests T-1 a T-12 en `scraper.test.js` y tests 8 y 9 en `descargarAdjunto.test.js`. Baseline actualizado en `docs/testing.md` a 91 archivos / 1386 tests (+14 tests).
- **Paso 5 (Docs)**: Restaurada línea `>` vacía en `docs/multisitio-diseno.md`, actualizados `Estado.md` y `Ramas en revisión.md` en la bóveda.

### Puntos clave aprendidos
1. **Errores del portal nunca son cursos vacíos ni incompletos**: Si una sección, material o header devuelve error HTTP (excepto 404/410 en header, que es ítem salteado por RN-12), el curso debe salir fallido con su aviso explicativo para evitar que una lista incompleta reemplace a la lista guardada (`todas:RN-18`).
2. **Preservar orden con concurrencia**: Cuando se usa `mapearConConcurrencia`, devolver el arreglo por sección y hacer `flat()` preserva el orden de entrada (el orden de las secciones en el DOM), a diferencia de un `push` compartido que ordenaba por tiempo de respuesta de red.
3. **Saneamiento en git sin pushear**: Rebase autosquash sobre una rama no pusheada permite corregir datos sensibles directamente en el commit de origen sin dejar rastros en los diffs intermedios.
