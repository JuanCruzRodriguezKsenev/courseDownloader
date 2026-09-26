---
name: classroom-abrir-todos
description: Apertura paralela de ítems plegados en Classroom durante el escaneo (M5)
metadata:
  type: project
---

# Classroom corte 1: Apertura de todos los ítems plegados de una

## Puntos clave de la ejecución
- **Paso 7 paralelo (`sitio/google-classroom/scraper.js`)**: en lugar de iterar secuencialmente abriendo y esperando hasta 8 s por ítem, ahora se filtran los `li[data-expandable-row-id]` sin `[data-attachment-id]`, se hace `click()` sincrónico en `div[role="button"][aria-expanded="false"]` en el mismo tick, y se espera una única condición global con timeout `tiempos.abrirTodos` (30000 ms).
- **Contraste en tests (`sitio/google-classroom/scraper.test.js`)**: el test 11 verifica que todos los botones plegados reciben click antes de que el primero complete su carga (`Math.max(...clics) < Math.min(...cargas)`). Se comprobó contra el código previo que esta aserción falla.
- **Suite y compuerta**: 43 archivos, 716 tests pasados (715 preexistentes + 1 nuevo), linter 0/0, typecheck limpio, build de extensión exitoso.
