# 0014 — La identidad de un ítem es (portal, módulo, tipo, título)

**Fecha**: 2026-08-07
**Estado**: Aceptada
**Contexto previo**: [ADR-0010](0010-el-sitio-es-del-item.md) (el sitio es del ítem; introdujo la
identidad `(portal, título)` en el corte D del multi-sitio).
**Diseño de ejecución**: `docs/escaneo-api-anatomy-diseno.md` §El bloqueante.

## Contexto

El corte D del multi-sitio reemplazó todos los `a.titulo === b.titulo` del proyecto por un módulo
compartido, `core/cola/identidadClase.ts`, con la identidad definida como el par
**(portal, título)**. Ese cambio existía porque dos portales pueden tener clases homónimas, y el
modo de fallar era feo y silencioso: **completar la descarga de una saca de la cola a su homónima**,
que nunca se baja y desaparece sin error.

El par llevaba adentro un supuesto tácito: **que dentro de un portal el título es único**.

Ese supuesto se cayó al medir el árbol de clases de Anatomy by Chris (2026-08-07). El portal
agrupa las clases en **dos niveles** —producto → 11 módulos → 114 clases— y hay **7 títulos que
existen en dos módulos a la vez**: `Miologia 1` a `Miologia 6` e `Irrigación`, todos en *Miembro
Superior* **y** en *Miembro Inferior*. Son clases distintas, con distinto video y distinta carpeta
de destino, y para la cola eran **una sola**.

No era un riesgo futuro: **rompía datos ese mismo día**, sin ningún cambio de código. Alcanzaba
con escanear un módulo, encolar `Miologia 1`, escanear el otro y encolar `Miologia 1`.

Horas después apareció un segundo eje por el mismo camino: al entrar los **materiales** (los PDF
adjuntos de una lección) en alcance, un adjunto y el video del que cuelga pasaban a compartir
portal, módulo **y** título.

## Decisión

**La identidad de un ítem es la tupla `(portal, módulo, tipo, título)`**, calculada en el mismo
módulo compartido que ya existía.

Tres reglas la acompañan, y ninguna es un detalle:

1. **El módulo es el ORIGEN de la clase, nunca su carpeta de destino.** La identidad tiene que
   decir *qué clase es*, no *dónde decidiste guardarla*. Si tomara el destino, activar el override
   del input de carpeta le cambiaría la identidad a los 103 ítems de una y ninguno matchearía
   contra la cola.
2. **El `tipo` entra ya, con `"video"` por omisión**, aunque el primer corte sólo traiga videos.
   Agregarlo después obliga a volver a tocar `identidadClase` y sus tests con la cola en uso — que
   es exactamente el error que esta ADR documenta.
3. **Todo mensaje IPC que hable de un ítem lleva los cuatro campos.** Un payload incompleto no
   falla ruidosamente: la clave sale distinta, no matchea nada, y la operación no hace nada en
   silencio (o le pega a otro ítem). Ver `docs/patterns.md` §IPC.

Un portal de un solo nivel no manda módulo ni tipo, así que su clave queda `ramonnet||video|Título`
—semánticamente idéntica a la anterior— y **Ramón Net no cambió una línea**.

## Consecuencias

- **No hay migración de datos.** La clave se calcula, no se persiste. El único lugar donde se
  guardaba es el espejo de progreso (`SW_ESTADOS_PROGRESO`), que vive en `storage.session` y muere
  con la sesión; su migración de lectura pasó a cubrir **dos** formatos viejos (el título pelado
  anterior al multi-sitio, y el `portal|título` del corte D), distinguidos por la cantidad de
  separadores.
- **Los ítems ganan campos**: `modulo?`, `tipo?`, y —sólo en adjuntos— `idArchivo?` y `bytes?`.
  Todos opcionales, por el mismo motivo que `sitioId` lo era: lo ya persistido es de antes.
- **Un ítem con `tipo` distinto ya no es "la misma clase"**, y eso habilita que un PDF y su video
  convivan en la cola.
- Se paga un costo de vigilancia: cada lugar que arma un objeto-identidad a mano tiene que llevar
  los cuatro campos. Construir el corte destapó **cinco** sitios donde faltaban, incluidos el
  propio bucle de descarga y los dos senders de `remover_item_de_cola`.

## Alternativas descartadas

- **Usar la carpeta de destino en vez del módulo.** Se descartó por la regla 1: es el mismo dato
  la mayor parte del tiempo, y deja de serlo justo cuando el usuario usa el override — o sea que
  el bug aparecería sólo en la sesión en que alguien escribe en el input.
- **Un id opaco del portal (el `hash` de la lección) como identidad.** Sería más corto y no
  colisiona nunca. Se descartó porque **la cola persiste entre versiones y portales**: no todos los
  portales tienen un id estable (Ramón Net no lo tiene), y una identidad que un portal no puede
  producir obliga a un camino especial que reintroduce la divergencia que este módulo evita.
- **Dejar el `tipo` para cuando entren los adjuntos.** Descartado por la regla 2: el caso ya
  existía y sabíamos que existía.

## La lección, que es más grande que esta ADR

**Cada eje que este proyecto le agregó a lo que enumera —un portal, un nivel de agrupación, un
tipo de archivo— desbordó la clave de identidad, y cada vez el síntoma fue silencioso**: un ítem
que desaparece cuando otro termina, una clase que se re-descarga para siempre, un progreso pintado
en la fila equivocada.

Antes de agregar cualquier cosa a lo que la extensión lista, la pregunta es: **¿dos de estas
pueden compartir clave, y los mensajes que hablan de ellas llevan con qué distinguirlas?**
