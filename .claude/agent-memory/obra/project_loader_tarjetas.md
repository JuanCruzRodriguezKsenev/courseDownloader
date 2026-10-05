---
name: loader-tarjetas
description: Detalles de implementación del loader con detalle en tarjetas e íconos (maqueta del dueño)
metadata:
  type: project
---

# Loader con detalle en tarjetas (maqueta del dueño)

## Puntos clave de la ejecución
- **Tokens de acento azul (`styles/variables.css`)**:
  - `--accent-blue` (#0060DF en claro, #4F8EF7 en oscuro) y sus canales `--accent-blue-rgb` (0, 96, 223 / 79, 142, 247).
  - Ambos canales se redefinen en el bloque `@media (prefers-color-scheme: dark)` para que los fondos translúcidos de la fila actual acompañen el contraste en cada tema.
- **Vista estructurada en núcleo (`core/estado/progresoEscaneo.ts`)**:
  - Reemplazo del arreglo crudo `lineas: string[]` por `TarjetaActualLoader` (`posicion`, `nombre`, `detalle`), `ContadoresLoader` (`listos`, `vacios`, `fallidos`) y `restante: string | null`.
  - Desacoplamiento limpio: el núcleo provee la semántica y los datos limpios; la isla decide cómo ordenarlos en tarjetas.
- **Isla Preact en tarjetas (`popup/features/loaderDetalle.preact.js`)**:
  - Iconos SVG en línea (`ICONOS` con `viewBox="0 0 24 24"`) para lista, documento, reloj y estados (`listo`, `vacio`, `fallido`, `actual`, `pendiente`).
  - Las marcas usan `currentColor` exterior y `.loader-icono-trazo` con stroke hacia el fondo de la tarjeta (`var(--bg-surface)`).
  - Normalización defensiva con `vacio()` inicial y en `limpiar()` / `__resetStore()`.
  - Invocación desde `popup.js:1588` simplificada a `LoaderDetalle.mostrar({ desde: desdeEscaneoActual })`.
- **Estilos CSS (`styles/components/loader.css`)**:
  - `&:has(.loader-detalle)` oculta el spinner superior (`> .spinner { display: none; }`) y añade el birrete azul vía `mask` en `> .loader-text::before`.
  - Disposición en tarjetas `.loader-tarjeta` con borde y fondo superficial (`--bg-surface`).
  - Lista de cursos con scroll propio (`max-height: 150px`) y resalte azul del curso actual.
  - Cero colores literales en la hoja (verificación c limpia).
- **Verificación y control negativo**:
  - Control negativo en test 3 (mutar `'✓': 'vacio'`) falló con precisión en aserción de `.loader-marca-listo`; restaurado a verde inmediatamente.
  - Compuerta final: 46 archivos, 802 tests (+1 en contadores), lint sin warnings, tsc limpio y bundle generado en 280.39 kB.
