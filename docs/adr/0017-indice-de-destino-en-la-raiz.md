# 0017 — Índice de destino en la raíz del árbol

**Fecha**: 2026-09-27
**Estado**: Aceptada
**Contexto previo**: [ADR-0007](0007-dry-docs-canonical-homes.md) (documentación DRY), [ADR-0014](0014-identidad-compuesta-de-clase.md) (identidad de ítem).
**Diseño de ejecución**: `docs/specs/classroom-destino/spec.md`, `docs/plan-classroom-destino-2a-adopcion.md`.

## Contexto

El corte 1 de Classroom descargaba archivos directamente en `raíz/google-classroom/<curso>/` con nombres crudos. Para que los archivos se ubiquen en el árbol organizado del estudiante (`~/U.N.L.P/Ingenieria/...`), se requiere mapear cursos y temas a carpetas (`Teorias/`, `Practicas/`, etc.), proponer y recordar renombres amigables y saber qué archivos ya fueron descargados, incluso si fueron movidos o renombrados a mano.

El diseño del portal (`docs/portal-google-classroom-diseno.md` §3, decisión D9) establecía que el contrato de disco cambiaba y requería formalizar la persistencia y control de identidad en un ADR.

## Decisión

1. **El índice vive en la raíz del árbol y no en el storage de la extensión.**
   El archivo único `.course-downloader.json` reside en la raíz configurada (`~/U.N.L.P`) y es la **fuente de verdad** de las asociaciones de cursos, temas y archivos descargados. El storage de la extensión no almacena esta información.
2. **No se versiona en git.**
   Dado que el repositorio del árbol puede ser público, el índice se excluye agregándolo a `.gitignore` en la raíz.
3. **Claves compuestas `<portal>:<id>`.**
   Las entradas de cursos y archivos se indizan por `<portal>:<id>` (ej. `google-classroom:ODc0ODk1NDcwNTMw` y `google-classroom:1a2b3c4d5e6f` o `google-classroom:acceso:<url>:<titulo>`). El prefijo habilita compatibilidad futura con otros portales de la institución (como Moodle) compartiendo el mismo índice institucional.
4. **"Ya descargado" se determina por md5 y nunca por nombre.**
   Los renombres del usuario y los saneamientos de caracteres hacen que el nombre de archivo no represente identidad. El contenido manda.
5. **Nunca se sobrescribe en disco.**
   La adopción y descargas usan copia exclusiva (`COPYFILE_EXCL`), protegiendo notas y archivos preexistentes (especialmente archivos `.md` de Obsidian).

### Formato de datos

Siguiendo ADR-0007 (documentación DRY), el esquema exacto y estructura JSON no se duplican acá: su hogar canónico es [`docs/specs/classroom-destino/spec.md` §Datos](../specs/classroom-destino/spec.md#datos).

### Contraste con ADR-0014

**No la reemplaza: el índice usa el id de Drive porque es estable, y la identidad de la cola sigue siendo la de ADR-0014.**
ADR-0014 define la identidad en memoria y pipeline de descargas como `(portal, módulo, tipo, título)` para resolver el ciclo de vida de la cola efímera e inter-portal. El índice de disco utiliza el identificador remoto de archivo provisto por Classroom/Drive porque persiste entre re-escaneos y cambios de título locales.

## Consecuencias

- **A favor**: Independencia total del storage del navegador; tolerancia a reinstalaciones de la extensión o limpiezas de perfil; el usuario puede mover archivos dentro de la materia y el índice se autocorrige por md5 sin duplicar descargas; soporte multi-portal en una misma raíz de archivos.
- **En contra**: El backend y las herramientas de adopción deben acceder y manipular el archivo `.course-downloader.json` en disco validando su integridad atómicamente.
