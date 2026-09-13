---
name: classroom-lista-guardada-y-explorar
description: Detalles de implementación del corte 1 de Classroom para lista guardada, 🔄 y selector Linux vía portal
metadata:
  type: project
---

# Classroom corte 1: Lista guardada, botón 🔄 y selector de carpetas en Linux

## Puntos clave de la ejecución
- **Compuerta `escanearOUsarGuardada()` en `popup.js`**: reemplazó exactamente a los 4 disparadores automáticos (`onReescanearAula`, `tabs.onUpdated`, `tabs.onActivated`, `conectarYArrancar`).
- **Disparadores manuales**: footer "Re-escanear", fin de cola (`restaurarPanelPorInterrupcion`) y el click en `nodos.btnRescan` llaman directo a `ejecutarPaso1EscaneoRamonAutomatico()`.
- **Botón 🔄**: reusa clase `.btn-sort` (`#ui-btn-rescan`), se añade a `bloquearToolbar`, se conmuta con la pestaña Disponibles/Cola (`display: ''` vs `'none'`) y se re-habilita sin condición en `desbanearFiltros`.
- **Selector nativo Linux (`backend/elegirCarpetaLinux.py`)**: implementado usando Python + PyGObject (`Gio`/`GLib`) sobre `org.freedesktop.portal.FileChooser` vía D-Bus. No requiere `zenity` ni `kdialog`.
- **Cuidado en tests TypeScript**: `eslint` tiene activa `@typescript-eslint/no-explicit-any`. Evitar `as any`; usar siempre `as unknown as Type`.
- **`__pycache__`**: `python3 -m py_compile` genera carpetas `__pycache__` en `backend/` que no están en `.gitignore`; deben limpiarse antes de commitear si no se añaden a `.gitignore`.
- **Compuerta final**: 43 archivos, 715 tests pasados sin warnings de linter ni errores de typecheck.
