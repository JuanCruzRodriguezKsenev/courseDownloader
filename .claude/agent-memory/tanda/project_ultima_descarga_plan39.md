---
name: ultima-descarga-plan39
description: Plan 39 (2026-10-14) aprobado: descarga completa de 6 portales a Areas/Facultad/_Ultima descarga para que bibliotecario concilie por md5
metadata:
  type: project
---

Plan `Planes/39 - Ultima descarga completa para conciliar con la Boveda.md`, **aprobado** 2026-10-14. Docentes: F1 Grupo H = Mendoza, F2 G26 = Dirani; Bianchi «Notas de evaluaciones» → Notas (difiere del índice real a propósito); omitidos SIU/administrativas se bajan.
Decidido por Juan: fuente de verdad = `~/Boveda/Areas/Facultad` (U.N.L.P es viejo, también se concilia); carpeta gitignorada; sin Ramón/Anatomy;
bajar también cursos viejos sin materia (Química, Mate A, Mate para Ing → materia nueva); quiere ver el mapeo antes.
Medido en vivo: 21 cursos (Classroom 7, LINTI 3, Asig 1, Ing 8 —el 31 midió 9—, IDEAS 1, matec 1).
**Why:** config_usuario.json sólo lista google-classroom → los otros 5 portales caen a RAIZ_FACULTAD (Bóveda real). Por eso §5 lista los 6.
**How to apply:** Juan quiere ver el mapeo como árbol tipo `tree`, no como lista. Tras la descarga, encargo a bibliotecario y restaurar config.

**2026-10-14, §6:** el editor de `:3001/adopcion` lee siempre el índice REAL (`editor.js:12-15`), no `raices`: con LINTI marcó «3 a revisar» falsos (el 1371 no está en el real; en `_Ultima descarga` están en Practicas). Levantarlo aparte con `--raiz` NO sirve: los cursos escaneados viven en la memoria del proceso del backend (`backend/destino/vistos.js`), y el editor suelto responde «No hay cursos escaneados en memoria». Deuda: `Deuda/…editor ignora las raíces por portal`.

**Respaldo de la config movido** (2026-10-14, para dejar limpio el árbol antes del plan 40): `~/.local/share/courseDownloader/config_usuario.antes-plan39.json`. Restaurar desde ahí en §6.3.

**Plan 40** (choques de nombre, sufijo `_N`) nació en este §6: Ingeniería rebotó ~49 con `DESTINO_OCUPADO`. Física 1 se resolvió a mano en el índice de `_Ultima descarga` (`Teorias/Mendoza/2023` y `/2024`, confirmado por Juan); Mate para Ing (3104) espera el plan 40. Mate A, Química y Mate C quedaron con 0 archivos: sin confirmar si se escanearon.

**Plan 40 ejecutado** (2026-10-14, rama `choques-sufijo-n`, `a28ee24`+`563c730`). H-1 del informe corregido por tanda: el backend renombra con `_N` sólo si el destino REAL (tras RN-14) está ocupado, no por `accion === "renombrar"`. Falta §7 [USUARIO]: merge, build, reiniciar backend, rebajar Ingeniería (3104) y ver los `*_2.*`; después sigue el §6 del 39.
