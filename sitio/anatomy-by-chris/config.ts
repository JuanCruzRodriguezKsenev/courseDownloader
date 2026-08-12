/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS (HOTMART CLUB): CONFIGURACIÓN (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [COPY GENÉRICA — corte 2] Declara `instruccionEscaneo`. Es el portal por el que existe
 *   el miembro: acá no hay selector de materia ni botón de mostrar, y el onboarding venía
 *   describiéndole al usuario una UI que en este club no existe.
 *
 * CHANGELOG v1.0.0:
 * - [CORTE 7] El segundo portal real. Es lo único que le faltaba al frente multiportal, y
 *   la prueba de que ADR-0009/0010 sirvieron: **este archivo y sus tres hermanos son todo lo
 *   que hay que escribir por portal**; no se tocó la UI ni `plataforma/`.
 * ==========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * Los VALORES de este portal. La forma —qué tiene que traer un adaptador y qué significa cada
 * miembro— vive en `core/puertos/sitio.ts`, que es su hogar canónico. El detalle de la
 * medición (selectores, contrato de la API, las cuatro trampas del DOM) está en
 * `docs/portal-anatomy-by-chris-diseno.md`.
 *
 * DOS COSAS QUE ESTE PORTAL HACE DISTINTO DE RAMÓN NET
 * -----------------------------------------------------
 * 1. **`esPaginaDelSitio` matchea el SLUG DEL CURSO, no el host.** Ramón Net puede mirar sólo
 *    el host porque es dueño de todo su dominio; `hotmart.com` hospeda miles de cursos ajenos.
 *    Un match por host haría que este adaptador reclame la pestaña de cualquier otro producto
 *    de Hotmart y, como `registro.ts` recorre la lista en orden, gana el primero que dice que
 *    sí: el bug silencioso de escanear con el adaptador equivocado que ADR-0010 previene.
 * 2. **Su `resolverManifiesto` necesita credenciales** (el `id_token` de la API del club, que
 *    sólo existe dentro de la pestaña). Las cosecha `escanearListado` y viajan por
 *    `ResultadoEscaneo.credenciales` → `core/estado/credencialesPortal.ts` → el SW.
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
  OpcionesParseo,
} from "../../core/puertos/sitio";

/**
 * Módulos hermanos. Son `.js` y se consumen como globals: con `allowJs: false` este `.ts` no
 * podría importarlos aunque quisiera.
 *
 * ⚠️ Los tres nombres llevan el sufijo del portal. Los de Ramón Net se publican SIN calificar
 * (`Scraper`, `ParserTitulos`, `ResolverManifiesto`), así que compartirlos haría que el último
 * entrypoint evaluado le pise los tres al otro portal — y el síntoma sería un portal
 * escaneando o parseando con el adaptador ajeno, en silencio.
 */
declare const ResolverManifiestoAnatomy: {
  resolver(
    urlClase: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>,
    alturaMaxima?: number
  ): Promise<string>;
};
declare const ScraperAnatomy: {
  // `async` desde el corte 1 del escaneo por API: le pide el árbol a `/v1/navigation` en vez de
  // leer el DOM. `executeScript` espera la promesa y el puerto admite las dos formas.
  escanearListadoDelModulo: () => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoAnatomy: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>,
    productId?: string
  ): Promise<string>;
};
declare const ParserTitulosAnatomy: {
  formatearTitulo(crudo: string, materiaBase?: string, opciones?: OpcionesParseo): string;
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

/** Lo de este portal que NO es del puerto: sólo lo lee esta misma carpeta. */
interface SitioAnatomyDescriptor extends PuertoSitio {
  /** Slug del curso dentro del club. Es lo que distingue este producto de los otros. */
  slugCurso: string;
  /** Id numérico del producto, el que la URL lleva en `/products/<id>`. */
  productId: string;
  /**
   * [CORTE 4] Tope de calidad, en altura de línea. La escalera del CDN, medida el 2026-08-07:
   * 240 / 360 / 540 / **720** / 1080 — no hay 480.
   *
   * No entra al puerto porque **no lo lee nadie fuera de esta carpeta**: se lo pasa el descriptor
   * a su propio `resolverManifiesto`. La regla que lo consume es por RANGO, nunca por igualdad
   * (ver `resolverManifiesto.js` §elegirVariante), así que este número puede no existir en la
   * escalera y el algoritmo elige vecino igual.
   */
  alturaMaxima: number;
}

const SitioAnatomyByChris: SitioAnatomyDescriptor = {
  // El `id` es un DATO, no una etiqueta: es el nombre de la carpeta en disco
  // (`raíz/anatomy-by-chris/<materia>/`) y la mitad de la identidad de cada clase
  // (`anatomy-by-chris|<titulo>`). Se eligió el CURSO y no la plataforma (`hotmart`) para que
  // otro curso de Hotmart no comparta carpeta ni pueda colisionar por módulos homónimos.
  // Cambiarlo después obliga a migrar storage y a mover archivos.
  id: "anatomy-by-chris",
  nombre: "Anatomy by Chris",
  // Violeta: bien separado del azul de Ramón Net incluso en una fila de 28 px, que es donde se
  // mira. Los dos se eligieron mirando la Cola con las dos colas mezcladas.
  color: "#8E44FF",

  slugCurso: "anatomy-by-chris",
  productId: "6083220",

  // 720p ≈ 119 MB/hora. La referencia real: los 29 videos ya bajados de Ramón Net dan 243 MB/h
  // a 480p, o sea que Hotmart comprime tanto que su 1080p (173 MB/h) YA pesa menos que el 480p
  // que se viene bajando todos los días. Elegido con esa tabla a la vista: la mitad que su
  // normal de Ramón Net, y con más definición que él.
  alturaMaxima: 720,

  // Sonda de "hay internet" del daemon de conexión: el sitio objetivo, no un genérico.
  urlSondeoInternet: "https://hotmart.com",

  // Por SLUG, no por host. Ver el bloque de arriba: es la diferencia que evita reclamar la
  // pestaña de cualquier otro curso de Hotmart.
  esPaginaDelSitio(url) {
    return (
      typeof url === "string" &&
      url.includes("hotmart.com/") &&
      url.includes(`/club/${this.slugCurso}`)
    );
  },

  // El `/*/` del medio es el segmento de idioma (`/es/`), que el portal siempre pone.
  get patronPestañas() {
    return `https://hotmart.com/*/club/${this.slugCurso}/*`;
  },

  // La home del producto, a donde el onboarding manda al usuario.
  get urlListado() {
    return `https://hotmart.com/es/club/${this.slugCurso}/products/${this.productId}`;
  },

  // Acá no hay selector de materia ni botón de mostrar: el escaneo le pide el árbol entero
  // a la API del club y trae todos los módulos con sus clases de una. Ver
  // docs/escaneo-api-anatomy-diseno.md. Texto plano: lo escapa la isla del onboarding.
  instruccionEscaneo:
    "Un solo escaneo trae todos los módulos del curso con sus clases y sus PDF: no hay que elegir materia ni apretar nada más.",

  // --- Puertas al resto del adaptador -------------------------------------------------
  // Se referencian perezosamente (arrow / getter) para no depender del orden de evaluación
  // de los imports del entrypoint.

  // El tope de calidad viaja como cuarto parámetro: el VALOR es del portal (vive acá) y el
  // ALGORITMO que lo aplica es del resolvedor. No se importa al revés porque el `.js` no puede
  // leer este `.ts` con `allowJs: false`.
  resolverManifiesto(urlClase, signal, credenciales) {
    return ResolverManifiestoAnatomy.resolver(urlClase, signal, credenciales, this.alturaMaxima);
  },

  // [CORTE 5] Los adjuntos. Se resuelve al BAJAR, no al escanear: la firma vive 1 hora.
  // El `productId` viaja como cuarto parámetro por lo mismo que el tope de calidad: el valor es
  // del portal y el `.js` no puede leer este `.ts`.
  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoAnatomy.resolver(idArchivo, signal, credenciales, this.productId);
  },

  // Getter y no arrow: hay que entregar la función CRUDA, porque `executeScript` serializa su
  // código fuente y lo corre en la página. Envolverla rompería la inyección.
  get escanearListado() {
    return ScraperAnatomy.escanearListadoDelModulo;
  },

  parsearTitulo: (crudo, materiaBase, options) =>
    ParserTitulosAnatomy.formatearTitulo(crudo, materiaBase, options),

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosAnatomy.clasificarCarpeta(crudo, materiaBase),

  /**
   * FACETA INERTE — verificado leyendo el consumidor, no supuesto.
   *
   * Hotmart no tiene un eje de clasificación tipo cátedra/comisión. El puerto la exige igual,
   * y alcanza con que `leer`/`leerDeCola` devuelvan siempre `valorComun`: en
   * `popup/features/faceta.js`, `valoresPresentes()` filtra fuera todo lo igual a `valorComun`
   * y devuelve `[]`, con lo cual el modal y el badge (que piden `> 1` detectados) no aparecen
   * y `perteneceASeleccion()` no filtra nada.
   *
   * Lo de abajo existe porque el compilador lo pide y **no se ejecuta nunca**. Su contenido lo
   * dice, en vez de inventar copy verosímil que alguien pueda tomar por vivo.
   */
  faceta: {
    id: "ninguna",
    etiqueta: "Sin clasificación",
    icono: "📚",

    valorComun: "COMUN",
    valorTodas: "TODAS",

    leer: () => "COMUN",
    leerDeCola: () => "COMUN",

    etiquetar: () => "Todas las clases",
    etiquetarCorto: () => "Todas",

    ordenar: () => 0,

    modal: {
      titulo: "(faceta inerte: este modal no se muestra)",
      descripcion:
        "Este portal no tiene eje de clasificación. El descriptor existe porque PuertoSitio lo exige; la UI nunca lo muestra.",
    },
  },
};

// Exportación dual (ver docs/coding-standards.md). Global con nombre PROPIO del portal.
(globalThis as Record<string, unknown>).SitioAnatomyByChris = SitioAnatomyByChris;
export { SitioAnatomyByChris };
export type { SitioAnatomyDescriptor };
export default SitioAnatomyByChris;
