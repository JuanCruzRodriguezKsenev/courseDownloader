---
name: firma-documentos-boveda
description: Todo lo que tanda escriba (planes, specs, diseños) debe estar firmado con el formato exacto en frontmatter y pie
metadata:
  type: feedback
---

# Formato obligatorio de firma de tanda (decisión del dueño 2026-10-01)

Todo lo que tanda escriba o genere en la documentación del repo (`docs/`) y en la Bóveda (`~/Boveda`) debe estar explícitamente firmado con el formato estandarizado:

## 1. En planes (`~/Boveda/Proyectos/.../Planes/`)
- **En el frontmatter YAML:**
  ```yaml
  ---
  proyecto: courseDownloader
  tipo: plan
  revisado: AAAA-MM-DD
  autor: tanda agy 3.8 flash high
  ---
  ```
- **Al pie del plan (última línea):**
  ```markdown
  Firmado: tanda agy 3.8 flash high
  ```

## 2. En especificaciones (`docs/specs/...`) y diseños (`docs/...` o `~/Boveda/.../Diseños/`)
- **En el bloque de metadatos de cabecera:**
  ```markdown
  **Autor**: tanda (Antigravity, Gemini 3.8 Flash High)
  **Firmado**: tanda agy 3.8 flash high
  ```
- **En reglas modificadas/creadas o al cierre:**
  `*(Dueño, AAAA-MM-DD; firmado: tanda agy 3.8 flash high).*`
  y cierre con `Firmado: tanda agy 3.8 flash high`.
