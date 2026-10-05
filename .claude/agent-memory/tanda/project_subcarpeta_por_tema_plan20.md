---
name: project-subcarpeta-por-tema-plan20
description: Plan 20 (subcarpeta por tema): ejecutado y verificado M-1..M-8 el 2026-10-04, lista para mergear; decisiones de diseño y cómo se verificó sin tocar la Bóveda
metadata:
  type: project
---

Spec `docs/specs/subcarpeta-por-tema/` y plan `~/Boveda/Proyectos/courseDownloader/Planes/20 - Subcarpeta por tema en la carpeta destino.md`, rama `subcarpeta-tema`. `obra` ejecutó las partes I y II; M-1..M-8 verificados en navegador con el dueño el 2026-10-04 (commit `fde7060`). **Falta sólo decidir el merge a `main`.**

**Why:** el dueño veía cientos de archivos en la raíz de `Teorias/`. Pidió `Teorias/<docente>/Series/…`.

**How to apply:**
- El estado de la subcarpeta se **deriva** de la carpeta guardada en `cursos.<clave>.temas.<tema>` (`invertirCarpeta`), sin campo nuevo en el índice; el descargador no cambia.
- **Verificar el editor sin tocar la Bóveda**: el editor tiene la raíz fija en `RAIZ_FACULTAD` (`backend/adopcion/raiz.js`) e ignora `raices` de `config_usuario.json`. Hay que arrancar el servidor con `HOME=<dir>` donde `<dir>/Boveda/Areas/Facultad` es un enlace a una copia (`~/Descargas/facultad-prueba`). El servidor pierde los vistos al reiniciar: re-escanear desde el popup. No usar `pkill -f "bun run server.js"` dentro de Bash: mata el propio shell.
- Para simular un curso nuevo, sacar el curso **y sus `archivos`** del índice de la copia; "en disco" = la clave está en `indice.archivos`, no que el archivo exista en la carpeta.
- Las pruebas manuales funcionan mejor con nombres exactos de tema y archivo (sacados de `/adopcion/api/datos?modo=indice&curso=…`) y foto antes/después del disco y del índice. El dueño se frustró con las instrucciones vagas.
- Hallazgos del 2026-10-04 ya en `docs/TECHNICAL_DEBT.md` §28-32 (raíz fija, choques con md5 vacío, CSS de la tarjeta, humo por `clave_curso`, `subcarpeta:"si"` en `-`/`.`).
- Se quitó el botón «Ocultar archivos» (duplicaba el chevron) a pedido del dueño.
- `main` se mergeó y pusheó el 2026-10-04 (`c1f8a57`, planes 16, 17, 19). Siguen sin mergear `classroom-videollamadas`, `loader-tarjetas`, `prueba-combinada`, `marca-resaltador`.
