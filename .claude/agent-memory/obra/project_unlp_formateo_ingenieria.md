---
name: unlp-formateo-ingenieria
description: Formateo de carpetas y nombres en ~/U.N.L.P/Ingenieria previo al corte 2 de Classroom
metadata:
  type: project
---

# Formateo de U.N.L.P/Ingenieria (pre-corte 2)

## Puntos clave de la ejecución
- **`core.ignorecase = true` en `~/U.N.L.P`**: Al renombrar archivos que sólo cambian de mayúscula a minúscula en el mismo directorio (ej. `01_Coulomb.pdf` -> `01_coulomb.pdf`), `git add -A` los marcó como borrados y dejó los nuevos sin agregar (`??`). Se resolvió agregándolos con ruta explícita (`git add "..."`).
- **Comillas en `git show --name-only` y `git status`**: En Linux con `core.quotepath` por defecto, las rutas con espacios o caracteres no ASCII se imprimen entre comillas (`"Ingenieria/..."`). Los filtros regex deben contemplar `^["]?` o usar `-c core.quotepath=false`.
- **Precondiciones y verificación**: 121 archivos iniciales -> 2 borrados (`mod 1.zip` y cronograma `.xls`) -> 119 archivos finales distribuidos en las 23 carpetas esperadas, con hash diff exacto de 2 líneas eliminadas.
- **Aislamiento**: Informática (513 cambios) y ObsidianUNLP_Vault quedaron intactos; commits limitados estrictamente a `Ingenieria/`.
