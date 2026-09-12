---
name: organizacion-material
description: Cómo el dueño organiza su material de facultad en ~/U.N.L.P — pesa en cualquier decisión de dónde/cómo se guardan descargas
metadata:
  type: user
---

El dueño estudia en la UNLP (Informática e Ingeniería) y guarda el material en `~/U.N.L.P`, un **repo git + vault de
Obsidian** (`.git` de 404 MB al 2026-09-12; `.gitignore` en UTF-16 que NO ignora pdf/mp4/jpg; sin LFS).

Estructura: `<Facultad>/<Materia>/<Teorias|Practicas|Parciales|laboratorios>/[<Docente>|Clase N]/archivo`, nombres
originales, capitalización humana ("Fisica 2"). El mapeo tema→carpeta es suyo: en Física II "Presentaciones teóricas" →
`Teorias/Bianchi/`, "Guía de trabajos prácticos" → `Practicas/`. **Bianchi y Palacio son dos Classroom distintos (docentes y
cuatrimestres) de la misma materia.** Ya había bajado a mano 28 de 71 adjuntos del curso de Bianchi.

**How to apply:** mirar su árbol antes de proponer layouts de disco (cortó una pregunta de nombres para mostrarme la carpeta).
Eligió D9 (destino en su U.N.L.P con mapeo por curso y tema) y D10 (videos no se bajan: acceso .md con link).
Prefiere un click antes que pegar comandos; corta tool calls cuando quiere contestar él en texto.
**No quiere aceptar descargas una por una** (su Chrome pregunta dónde guardar): cualquier herramienta que guarde archivos
tiene que ir por el servidor Bun (`/api/bypass-stream`, bloque 0 de 1), sin interacción — así quedó la sonda v0.0.7. Relacionado: [[google-classroom]].
