# Traza de supuestos — «lo que está en disco manda»

Estado de la spec: **aprobada** (2026-10-04). Los supuestos de esta tabla son los que la spec recoge, con la corrección del 2 (CLI) y las mediciones M-1 y M-2 cerradas.
La carpeta se llamó `descarga-en-bruto` en la primera versión de la idea; desde que se escribió la spec es `disco-manda`.

**Historia (dueño, 2026-10-04, versión final):** olvidarse de «aprender», de la carpeta bruta y de la verificación nueva. Antes de proponer nombres, la extensión mira si esos archivos se movieron o renombraron. Si es así, no «piensa» el nombre: pone el que está escrito en disco, y su ruta. «Es algo que ya casi se aplica.»

## Contexto verificado en el repo (no son supuestos)

- **Ya se aplica** para archivos con id en el índice, en `calcularEstado` (`backend/destino/estado.js`, llamado desde `backend/handlers.js:544`): si el archivo no está en la ruta anotada, busca su md5 en toda la raíz y, si lo encuentra, devuelve el **nombre y la ruta del disco** y corrige el índice (fila 2 de la tabla de decisión, RN-19; `estado.js:149-170`, escritura en `:190-203`). Si está en la ruta anotada, devuelve lo del índice (filas 0b y 1). El nombre que calcularía `proponerNombre` no interviene en esos dos casos.
- **La búsqueda por md5** (`backend/destino/recorrido.js:48`, `buscarPorMd5`) calcula el md5 de **cada** archivo de la raíz hasta dar con el que busca. Ignora `Wiki`, `Mis notas` y `Clases` (`recorrido.js:5`). El resultado de cada hash se cachea en memoria por `ruta|tamaño|mtime` (`backend/destino/md5.js`), así que sólo el primer escaneo después de levantar el servidor es caro. **Medido el 2026-10-04 en `~/Boveda/Areas/Facultad`** (1651 archivos, 1,0 GB sin `Wiki`, `Mis notas` ni `Clases`): recorrer el árbol 34 ms; hashear todo la primera vez 4955 ms; con la caché en memoria 42 ms. Los archivos pudieron estar ya en la caché del disco del sistema operativo: un arranque en frío real puede tardar más.
- **No aplica** en estos casos (medido leyendo el código):
  1. El **editor de adopción** (`indiceAFilasEditor`, `core/destino/vistas.ts:288-293`) arma las filas «ya está» con `indice.archivos[clave]`, sin mirar el disco: muestra lo anotado, no lo que hay.
  2. Un curso **sin asociar** va directo a `proponerParaCurso` (`estado.js:31-37`), sin mirar el disco.
  3. Un archivo **sin id en el índice** que el dueño ya puso en el árbol: su md5 se desconoce hasta bajarlo. RN-20 sólo lo reconoce si hay uno idéntico en la **carpeta destino**, no en toda la raíz.
  4. ~~El CLI `generar` arma su propuesta por separado~~ **Corregido:** `generar` sí mira el disco por md5 (`generar.js:153-172`), sólo dentro de las materias de su semilla y con código propio.
- Mover un archivo a `Wiki/`, `Mis notas/` o `Clases/` lo vuelve «no encontrado» y se baja de nuevo (RN-19, RN-22, por diseño).

## Supuestos

| # | Grupo | Supuesto | Estado |
| :-- | :-- | :-- | :-- |
| 1 | Alcance | La spec extiende la regla que ya existe: para todo archivo con id en el índice, nombre y ruta salen del disco, nunca de `proponerNombre`. | asumido |
| 2 | Alcance | Rige en las superficies que hoy proponen desde un escaneo: lista del popup, editor de adopción y descarga. **Corregido al escribir la spec:** el CLI `generar` ya compara por md5 dentro de las materias de su semilla y se deja fuera (PA-2). | asumido, corregido |
| 3 | Alcance | No incluye aprendizaje, carpeta bruta ni verificación nueva. | asumido |
| 4 | Reglas | Con el id en el índice y el md5 en la raíz, se usa nombre y ruta del disco y se corrige el índice (como hoy, fila 2). | asumido |
| 5 | Reglas | Si el md5 aparece en varias rutas, gana la ruta anotada si es una de ellas; si no, la copia modificada más recientemente. | asumido |
| 6 | Reglas | Un archivo sin id en el índice se baja igual (su md5 no se conoce antes); si su md5 ya existe **en cualquier lugar de la raíz**, se descarta sin escribir y se anota con la ruta y el nombre del disco. Esto amplía RN-20, que hoy sólo mira la carpeta destino. | asumido |
| 7 | Reglas | El nombre del disco se usa tal cual, sin saneo ni normalización: con espacios, tildes y mayúsculas. | asumido |
| 8 | Reglas | Un nombre que viene del disco no pasa por RN-16 ni RN-16a: si el dueño lo eligió, es suyo. | asumido |
| 9 | Reglas | Un archivo renombrado dentro de su misma carpeta se trata igual que uno movido. | asumido |
| 10 | Reglas | Lo que no se encuentra sigue como hoy: se baja con el nombre del índice (RN-22), y lo movido a `Wiki`, `Mis notas` o `Clases` cuenta como no encontrado. | asumido |
| 11 | Reglas | Un curso sin asociar mira el disco igual que uno asociado, aunque no pueda proponer carpeta. | asumido |
| 12 | Datos | No hay campos nuevos en el índice: se reusan `archivos.<clave>.nombre` y `.ruta`. | asumido |
| 13 | Datos | El editor llama a la misma función que el popup para mirar el disco, no a una copia. | asumido |
| 14 | UX | El archivo reubicado se muestra «ya está» con nombre y ruta del disco, y una marca visible «movido». | asumido |
| 15 | UX | En el editor, la fila de un archivo reubicado es inmutable, como las descargadas (plan 08h). | asumido |
| 16 | Errores | Si la raíz no está accesible, no se corrige nada y se avisa; nunca se asume que los archivos se borraron. | asumido |
| 17 | Errores | Dos ids distintos con el mismo md5 resuelven al mismo archivo del disco y se muestran con la misma ruta. | asumido |
| 18 | No funcionales | La primera búsqueda por md5 después de levantar el servidor puede tardar unos 5 segundos en la Bóveda real (medido); las siguientes, milisegundos. No se agrega índice de disco persistente. | asumido |
