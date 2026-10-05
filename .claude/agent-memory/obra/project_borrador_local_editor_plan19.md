---
name: Borrador local del editor en lugar del aviso al cerrar (Plan 19)
description: Borrador automático en localStorage con debounce 500ms, banner Restaurar/Descartar ante base coincidente, descarte con toast ante cambios y remoción de beforeunload
metadata:
  type: project
---

# Borrador local del editor en lugar del aviso al cerrar (Plan 19)

Ejecutado el 2026-10-04 en la rama `moodle-linti` (commit `e100c1f`).

## Qué se hizo
- **Remoción de `beforeunload` (D-1)**: eliminado el listener nativo en `backend/adopcion/editor.html` para evitar el cuelgue silencioso de la pestaña en navegadores Chromium.
- **Borrador local en `localStorage` (D-2..D-4, D-7, D-8)**: funciones seguras `claveBorrador()` (por pathname + search), `hashCorto()` (djb2 en hex de 32 bits), `guardarBorrador()` con debounce de 500 ms, `borrarBorrador()` y `leerBorrador()` protegidos en `try/catch`. Enlazado en `marcarCambio()` (guarda si hay cambios, borra si volvió a estado inicial).
- **Detección y banner interactivo (D-5, D-6, D-9)**: comprobación al cargar datos tras fijar `ESTADO_INICIAL_JSON`; si la base difiere se descarta el borrador y se notifica con toast («Se descartó un borrador viejo: los datos cambiaron»); si coincide se muestra banner con timestamp y botones Restaurar (reemplaza cursos, temas, archivos, recalcula choques, marca cambios y re-renderiza) y Descartar.
- **Borrado al guardar con éxito (D-7)**: `borrarBorrador()` y ocultamiento de banner en la rama `data.ok` de `ejecutarGuardar()`.
- **Humo jsdom (P-5)**: 7 suites (`7a` a `7g`) en `backend/adopcion/humo-editor-indice.js` afirmando ausencia de `beforeunload`, debounce de 500 ms, borrado al revertir o guardar, banner interactivo de restauración, descarte por base distinta, y tolerancia a `localStorage` inaccesible.
- **Control negativo comprobado**: comentado temporal de `borrarBorrador()` en descarte provocó fallo neto en afirmación «Descarta» (`errores: 1`, código 1), restaurado a verde inmediatamente (`errores: 0`).

## Aprendizajes / Dónde el plan se quedó corto
- En la prueba 7e de JSDOM para restaurar con base coincidente: el plan sugería reusar `ESTADO_INICIAL_JSON` de la instancia JSDOM anterior, pero en dicha instancia ya se había ejecutado un guardado (`ejecutarGuardar`) con modificaciones previas que el servidor no refleja de forma idéntica en memoria. Para calcular la `baseCorrecta` exacta para un JSDOM nuevo, es necesario consultar `api/datos` con el manejador y computar el hash sobre el JSON exacto que `cargarDatos()` procesará al arrancar.
- Limitación documentada de `destinosPrevios`: la restauración en el editor no repuebla `destinosPrevios` (Map privado en memoria); un tema omitido que se restaura vuelve a `"."` si se des-omite manualmente. Aceptado según el plan.
