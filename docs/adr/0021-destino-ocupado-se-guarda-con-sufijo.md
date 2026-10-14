# 0021 — Destino ocupado por otro contenido: se guarda con sufijo `_N`

**Fecha**: 2026-10-14
**Estado**: Aceptada
**Supera a**: [ADR-0019](0019-raiz-por-portal-y-backend-decide-lo-descargado.md), sólo en el punto 4 que dice «se protege intacto el archivo del dueño rechazando con 409 `DESTINO_OCUPADO`». El resto de ADR-0019 sigue vigente.
**Contexto previo**: [ADR-0019](0019-raiz-por-portal-y-backend-decide-lo-descargado.md) (el backend decide lo descargado).
**Diseño de ejecución**: plan 40, `~/Boveda/Proyectos/courseDownloader/Planes/40 - Choques de nombre sin rebote (sufijo N).md`; spec `~/Boveda/Proyectos/courseDownloader/Specs/classroom-destino/spec.md` (RN-16b, RN-16c, AC-15, AC-16).

## Contexto

ADR-0019 decidió que, si el archivo destino ya existe con otro contenido y no es `.md`, el backend borra el `.part` y rechaza con 409 `DESTINO_OCUPADO`. En la descarga completa del plan 39, Moodle Ingeniería rebotó unos 49 archivos por ese camino, por dos causas:

1. **El sufijo de RN-16 se repite.** El sufijo es la publicación; dos `Clase 4 (1).pdf` publicados en materiales que también se llaman «Clase 4 (1)» quedan con el mismo nombre sufijado, y el segundo rebota.
2. **El choque contra el disco no se resuelve en la propuesta.** `buscarChoques` sólo agrupa los ítems de un mismo pedido. Un archivo que ya ocupa el nombre en disco (otro curso que va a la misma carpeta, otro escaneo o el dueño) hace rechazar la descarga, y al reintentar cada pasada coloca a lo sumo uno más por grupo: del tercero en adelante rebota para siempre.

El dueño decidió guardar los dos y revisar los duplicados después. Si el contenido es idéntico ya se descarta (RN-20, fila 5) y no rebota.

## Decisión

1. **En la propuesta (RN-16b, `core/destino/propuesta.ts`)**: lo que sigue chocando después del sufijo de RN-16 se numera con `_N` (`N ≥ 2`), en el orden del escaneo. Las filas fijas en el índice conservan su nombre; si no hay ninguna, la primera fila nueva lo conserva.
2. **En la tabla de decisión (RN-16c, `core/destino/decidir.ts`)**: destino ocupado con otro contenido devuelve `"renombrar"` en vez de `"rechazar"`. El orden no cambia: `descartar` sigue antes.
3. **Al escribir (RN-16c, `backend/destino/escritura.js`)**: `"renombrar"` sigue el camino de la fila 6, y dentro del lock del índice elige el primer `<base>_<n><ext>` libre en la carpeta (`n` de 2 a 999). También lo hace si el nombre quedó ocupado entre el cálculo y el lock. Deja un aviso `WARN` en el log que nombra el archivo y el nombre con que se guardó.
4. **El 409 `DESTINO_OCUPADO` queda sólo** si no hay `_N` libre hasta 999. En ese caso se borra el `.part`, como antes.

**NFR-4 no cambia**: el archivo que ya estaba nunca se mueve, se renombra ni se pisa. Sólo cambia el nombre del que llega.

## Consecuencias

- **A favor**: ninguna descarga rebota por un choque de nombre; el log dice qué archivo se guardó con `_N`; el reintento deja de ser un bucle que coloca uno por pasada.
- **En contra**: pueden quedar dos archivos de contenido distinto con nombres casi iguales (`x.pdf` y `x_2.pdf`) que el dueño tiene que revisar a mano. Es lo que pidió.
