---
name: Videollamadas omitidas por defecto y popup al día con el editor (Plan 25)
description: Omisión por defecto de videollamadas (RN-A) en extensión y editor, persistencia de videollamadasPermitidas al guardar (RN-B), y refresco automático del popup tras volver del editor sin re-escanear
metadata:
  type: project
---

# Videollamadas omitidas por defecto y popup al día con el editor (Plan 25)

- **Modelo e índice (`core/destino/indice.ts` y `.test.ts`)**:
  - `CursoIndice.videollamadasPermitidas?: string[]` para registrar de forma persistente qué videollamadas decidió bajar el dueño.
  - Test en `indice.test.ts` verificando que la serialización y parseo preservan el campo.
- **Regla RN-A (`core/destino/propuesta.ts` y `.test.ts`)**:
  - En rama `!curso`: videollamada sin descargar (`!archivos[clave]`) devuelve `omitido: true`, `nombre: null`, `carpeta: null`.
  - En rama con curso: videollamada sin descargar y no presente en `curso.videollamadasPermitidas` devuelve `omitido: true`.
  - Omisión explícita (`omitidos`, tema `-`) sigue teniendo prioridad.
  - 6 tests unitarios en `propuesta.test.ts` (casos a-f de RN-A).
  - Control negativo obligatorio verificado (romper temporalmente RN-A hace fallar casos a y e).
- **Escritura RN-B (`core/destino/vistas.ts` y `.test.ts`)**:
  - En `filasEditorAIndice`: para cada fila de videollamada, `copiar` la agrega a `videollamadasPermitidas` y la saca de `omitidos`; `omitir` la saca de permitidas y la deja en `omitidos`; `ya-esta` no se toca.
  - Si `videollamadasPermitidas` queda vacío, se borra el campo con `delete`.
  - AC-5 / RN-A actualizado en `vistas.test.ts` (nuevas videollamadas llegan como `omitir`).
  - 4 tests unitarios de persistencia en `vistas.test.ts`.
- **Backend y Popup (`backend/destino/`, `popup/features/destino.js`)**:
  - Test en `backend/destino/estado.test.js`: ítem de videollamada vuelve con `omitido: true`.
  - Test en `popup/features/destino.test.js`: ítem con `omitido: true` queda con `bloqueo: "omitido"` y sin seleccionar.
- **Refresco tras editor (`popup/features/refrescoEditor.js`, `.test.js` y `popup.js`)**:
  - Módulo puro `crearControlRefrescoEditor`: gestiona bandera `editorAbierto`, la consume en el primer evento, evita doble disparo y valida que haya lista y no esté offline antes de invocar la sincronización.
  - 4 tests unitarios en `refrescoEditor.test.js`.
  - Cableado en `popup.js`: al abrir el editor se activa la bandera; listeners en `visibilitychange` (con `visibilityState === 'visible'`) y `window.focus` refrescan vía `ejecutarPaso2SincronizarDiscoVeloz()`.
- **Humo jsdom (`backend/adopcion/humo-editor-videollamadas-raiz.js`)**:
  - Adaptado a RN-A: videollamadas nuevas llegan inicialmente omitidas por defecto (botón inicial `Volver a ofrecerlas`).
  - Los 4 humos reportan `errores: 0`.
- **Baseline de compuerta**:
  - 81 archivos / 1220 tests (+17 tests, +1 archivo).
