---
name: sitios-pendientes-antes-de-planificar
description: Estado al 2026-10-05 (noche): 4 specs de multicurso/portal listas (Ing, Info, LINTI, IDEAS), sin planes; leer al retomar
metadata:
  type: project
---

## Reglas del dueño (2026-10-05)
- "Faltan más sitios": **medir todos los sitios que quiera sumar antes de planificar**. No escribir planes de portales hasta entonces
  (las specs sí). Cada sitio por separado; luego se decide si el recorrido Moodle va genérico o por portal.
- **Multicurso en TODOS los portales**, aunque hoy tengan 1 solo curso (van a ir apareciendo).
- El dueño corre los scripts en su Chrome y pega la salida; **no me dejó usar las tools de Chrome** (rechazó una llamada) → pedirle
  los scripts de `docs/medicion-de-portales.md` (A estructura, B red, C/D/E sólo Moodle). Ver [[scripts-medicion-portales]].
- Rama del portal nuevo: desde `main`, no desde `marca-resaltador`. Árbol sucio (specs y memoria sin commitear): commitearlo yo al cerrar.

## Estado por sitio (2026-10-05, cierre)
Los 4 sitios que el dueño quiere (+ Classroom, ya resuelto) tienen **spec draft**; **ningún plan**:
1. Moodle Ingeniería `docs/specs/moodle-ingenieria/` ([[moodle-ingenieria-spec]]); M-1..M-3 abiertas.
2. Moodle Informática multicurso `docs/specs/moodle-asignaturas-multicurso/` ([[moodle-asignaturas-multicurso-spec]]).
3. **LINTI multicurso** `docs/specs/moodle-linti-multicurso/` (nueva): 3 cursos medidos (1331, 1352, 1371), 16 supuestos aprobados "ninguno".
   `esPaginaDelSitio` de `moodle-linti` sólo reclamaba `course/view.php` → hay que sumar `/my/`.
4. **IDEAS** `docs/specs/ideas-info/` (nueva): portal entero nuevo `ideas-info` + multicurso desde `/home`. Decisiones del dueño:
   Notas SE bajan (contra mi recomendación, filo de privacidad), nombre = header al escanear, secciones de texto → `.md`, Medioteca incluida.
   M-1..M-5 abiertas (cookie HttpOnly en SW, tiempo, texto de sección, zip, /home con varios cursos).

## Decisión del dueño sobre el plan
Plan **genérico del recorrido Moodle (3 portales) primero**; IDEAS con **plan aparte después**. Recomendé genérico; falta que el
dueño confirme "escribí el plan" (no lo pidió aún). Rama desde `main`, no desde `marca-resaltador`.

## Estado del árbol
Specs y memoria **sin commitear** en `marca-resaltador` (no commitear ahí: la rama es de la marca). Commitear al crear la rama del plan.

## Reglas del dueño (2026-10-05)
- Medir todos los sitios antes de planificar (cumplido para los 4). Multicurso en TODOS los portales. El dueño corre los scripts
  (no deja usar Chrome) → [[scripts-medicion-portales]]. Firma «tanda claude sonnet 5.5».
