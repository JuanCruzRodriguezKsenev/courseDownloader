---
name: project-disco-manda-plan22
description: Spec disco-manda aprobada y plan 22 escrito (2026-10-04): lo que está en disco manda sobre nombres y rutas; qué ya existía, trampas medidas y orden de ejecución
metadata:
  type: project
---

Spec `docs/specs/disco-manda/spec.md` (aprobada 2026-10-04, en `main`) y plan `~/Boveda/Proyectos/courseDownloader/Planes/22 - Lo que esta en disco manda.md`. Rama `disco-manda`: **no existe todavía**; la crea tanda desde `main` **después** de mergear el plan 21.

**Why:** el dueño quiere que la extensión, antes de proponer un nombre, mire si el archivo ya está movido o renombrado en el árbol y use lo que hay en disco. Pidió olvidarse de «aprender», de la carpeta bruta y de la verificación nueva.

**How to apply:**
- **Ya existía** (no re-explicar como idea nueva): para ids del índice, `estado.js` ya busca el md5 en toda la raíz, devuelve nombre y ruta del disco y corrige el índice (fila 2, RN-19). Faltaba en el editor, en cursos sin asociar y para ids desconocidos fuera de la carpeta destino (RN-20 sólo mira la carpeta destino).
- Mediciones (2026-10-04, Bóveda real, 1651 archivos, 1,0 GB): hashear todo 4,9 s en frío y 40 ms con caché; 1 de 354 entradas del índice tiene una copia repetida; el scraper de Classroom **no trae md5 ni bytes**.
- Trampas del plan: el `.part` está dentro de la raíz (excluirlo al buscar); `rechazar` va antes que `descartar` en `decidirDespues`; las búsquedas concurrentes en frío no comparten el hash en curso.
- El CLI `generar` quedó **fuera** (ya compara por md5 dentro de las materias de su semilla); la marca «movido» no se guarda (decisión del dueño de no tocar el esquema).
- Errores míos en esta ronda, ya corregidos: dije que `generar` no miraba el disco, y que convertir a `.md` rompía el emparejamiento (el original queda). Leer el código antes de afirmar.
- Orden: obra ejecuta plan 21 → merge → tanda crea `disco-manda` → obra ejecuta plan 22 → pruebas manuales M-1..M-5 del plan con `HOME` falso.
