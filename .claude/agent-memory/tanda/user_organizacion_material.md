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

Espejo: `ObsidianUNLP_Vault/<misma ruta>/<nombre>.md` = PDF convertido a md (frontmatter `materia: [[00_MOC_X]]`), listado
por wikilink en `00_MOC_<Materia>.md`, e indexado en `ObsidianUNLP_Vault/.neural_memory/`. Renombrar un PDF = PDF + nota + MOC
(+ índice). Los " (N)" de Física 2 vienen así de Classroom: antes de proponer renombres, contrastar con el escaneo.

Relevamiento completo 2026-09-13 (traza en docs/specs/classroom-destino/assumptions.md): sin convención escrita; mayoría =
Teorias/ plana, Practicas/Practica N/(+Adicional), Parciales/Modulo N/<fecha>, cronograma en raíz; nombres de archivo = los de la
cátedra (nunca renombró teorías/prácticas). Pidió que la extensión respete "el formato", incluido el nombre de archivo.

2026-09-13 decidió para formatear: alcance = Ingeniería (F1, F2, MB, MC); vault de Obsidian NO se toca; nombres de
archivo "lo más sencillos posible", ejemplo `01_coulomb` (reemplaza "nombre de la cátedra"); Ingeniería SIN subcarpeta por práctica
(resuelve en cuaderno; `Practica N/` es de Informática, donde resuelve archivo por archivo). Corta AskUserQuestion largas
para aclarar en texto: preguntas de a pocas, con ejemplos concretos.

**How to apply:** mirar su árbol antes de proponer layouts de disco (cortó una pregunta de nombres para mostrarme la carpeta).
Eligió D9 (destino en su U.N.L.P con mapeo por curso y tema) y D10 (videos no se bajan: acceso .md con link).
Prefiere un click antes que pegar comandos; corta tool calls cuando quiere contestar él en texto.
**No quiere aceptar descargas una por una** (su Chrome pregunta dónde guardar): cualquier herramienta que guarde archivos
tiene que ir por el servidor Bun (`/api/bypass-stream`, bloque 0 de 1), sin interacción — así quedó la sonda v0.0.7. Relacionado: [[google-classroom]].
