import fs from "node:fs/promises";
import path from "node:path";
import { claveCurso, claveArchivo } from "../../core/destino/indice.ts";
import { decidirAntes } from "../../core/destino/decidir.ts";
import { proponerParaCurso } from "../../core/destino/propuesta.ts";
import { leerIndice, modificarIndice, ErrorIndiceIlegible } from "./indiceServicio.js";
import { buscarPorMd5 } from "./recorrido.js";
import { md5Archivo } from "./md5.js";

export { ErrorIndiceIlegible };

async function resolverContraDisco({ raiz, archivoEnIndice, esAcceso, opciones = {} }) {
  let estaEnRutaAnotada = false;
  if (archivoEnIndice) {
    const rutaAnotadaAbs = path.join(raiz, archivoEnIndice.ruta, archivoEnIndice.nombre);
    try {
      const st = await fs.stat(rutaAnotadaAbs);
      if (st.isFile()) estaEnRutaAnotada = true;
    } catch {}
  }

  let md5EncontradoEnRaiz = null;
  if (!esAcceso && !estaEnRutaAnotada && archivoEnIndice && archivoEnIndice.md5) {
    md5EncontradoEnRaiz = await buscarPorMd5(raiz, archivoEnIndice.md5, opciones);
  }

  const decision = decidirAntes({
    enIndice: true,
    esAcceso,
    estaEnRutaAnotada,
    md5EncontradoEnRaiz: Boolean(md5EncontradoEnRaiz),
    destinoMdExiste: false,
  });

  let estado = "pendiente";
  let rutaDestino = archivoEnIndice ? archivoEnIndice.ruta : "";
  let nombre = archivoEnIndice ? archivoEnIndice.nombre : "";
  let correccion = null;

  if (decision.fila === "0b" || decision.fila === "1") {
    estado = "descargado";
    if (archivoEnIndice) {
      rutaDestino = archivoEnIndice.ruta;
      nombre = archivoEnIndice.nombre;
    }
  } else if (decision.fila === "2") {
    estado = "descargado";
    if (md5EncontradoEnRaiz) {
      const nuevaCarpeta = path.dirname(md5EncontradoEnRaiz);
      const nuevoNombre = path.basename(md5EncontradoEnRaiz);
      rutaDestino = nuevaCarpeta === "." ? "" : nuevaCarpeta;
      nombre = nuevoNombre;

      if (archivoEnIndice && (archivoEnIndice.ruta !== rutaDestino || archivoEnIndice.nombre !== nombre)) {
        correccion = {
          ruta: rutaDestino,
          nombre,
        };
      }
    }
  } else if (decision.fila === "3") {
    estado = "pendiente";
    if (archivoEnIndice) {
      rutaDestino = archivoEnIndice.ruta;
      nombre = archivoEnIndice.nombre;
    }
  }

  return {
    estado,
    fila: decision.fila,
    rutaDestino,
    nombre,
    correccion,
  };
}

/**
 * Calcula el estado de los ítems de un curso contra el índice y el disco (B-8).
 * Pure Node.js, recibe la raíz por parámetro (D-3).
 */
export async function calcularEstado({ raiz, sitio = "google-classroom", curso, items = [], opciones = {} }) {
  try {
    const stRaiz = await fs.stat(raiz);
    if (!stRaiz.isDirectory()) {
      return {
        ok: false,
        indiceIlegible: true,
        raizInaccesible: true,
        error: `La carpeta raíz no está accesible: ${raiz}`,
      };
    }
  } catch {
    return {
      ok: false,
      indiceIlegible: true,
      raizInaccesible: true,
      error: `La carpeta raíz no está accesible: ${raiz}`,
    };
  }

  let indice;
  try {
    indice = await leerIndice(raiz);
  } catch (err) {
    if (err instanceof ErrorIndiceIlegible) {
      return { ok: false, indiceIlegible: true, error: err.mensaje };
    }
    throw err;
  }

  const claveC = curso ? claveCurso(sitio, curso.id) : "";
  const cursoAsociado = indice.cursos[claveC];

  if (!cursoAsociado) {
    const propuestas = proponerParaCurso({
      curso: null,
      items,
      archivos: indice.archivos,
      sitioId: sitio,
    });

    const itemsRes = [];
    const correccionesRuta = [];

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const claveA = claveArchivo(sitio, it.idArchivo);
      const archivoEnIndice = indice.archivos[claveA];

      if (archivoEnIndice) {
        const esAcceso = it.idArchivo.startsWith("acceso:") || claveA.startsWith(`${sitio}:acceso:`);
        const res = await resolverContraDisco({ raiz, archivoEnIndice, esAcceso, opciones });
        if (res.correccion) {
          correccionesRuta.push({
            clave: claveA,
            ...res.correccion,
          });
        }
        itemsRes.push({
          idArchivo: it.idArchivo,
          estado: res.estado,
          fila: res.fila,
          rutaDestino: res.rutaDestino,
          nombre: res.nombre,
          sinAsignar: false,
          omitido: false,
          movido: res.fila === "2" && Boolean(res.correccion),
        });
      } else {
        const prop = propuestas[idx];
        itemsRes.push({
          idArchivo: it.idArchivo,
          estado: "pendiente",
          fila: "4",
          rutaDestino: null,
          nombre: prop ? prop.nombre : null,
          sinAsignar: false,
          omitido: false,
          movido: false,
        });
      }
    }

    if (correccionesRuta.length > 0) {
      await modificarIndice(raiz, (ind) => {
        for (const c of correccionesRuta) {
          const a = ind.archivos[c.clave];
          if (a) {
            a.ruta = c.ruta;
            a.nombre = c.nombre;
          }
        }
      });
    }

    return {
      ok: true,
      raiz,
      curso: { asociado: false },
      items: itemsRes,
    };
  }

  const propuestas = proponerParaCurso({
    curso: cursoAsociado,
    items,
    archivos: indice.archivos,
    sitioId: sitio,
  });

  const itemsRes = [];
  const correccionesRuta = [];
  const anotacionesMd = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const prop = propuestas[i];
    if (!it || !prop) continue;

    const claveA = claveArchivo(sitio, it.idArchivo);
    const archivoEnIndice = indice.archivos[claveA];
    const enIndice = Boolean(archivoEnIndice);
    const esAcceso = it.idArchivo.startsWith("acceso:") || claveA.startsWith(`${sitio}:acceso:`);

    if (prop.omitido) {
      itemsRes.push({
        idArchivo: it.idArchivo,
        estado: "pendiente",
        fila: "4",
        rutaDestino: null,
        nombre: null,
        sinAsignar: false,
        omitido: true,
        movido: false,
      });
      continue;
    }

    let rutaDestinoCarpeta = cursoAsociado.materia;
    if (prop.carpeta && prop.carpeta !== ".") {
      rutaDestinoCarpeta = `${cursoAsociado.materia}/${prop.carpeta}`;
    }

    const nombrePropuesto = prop.nombre || it.original;
    const destinoEsMd = nombrePropuesto.endsWith(".md");

    let destinoMdExiste = false;
    if (destinoEsMd) {
      const rutaArchivoDestinoAbs = path.join(raiz, rutaDestinoCarpeta, nombrePropuesto);
      try {
        const st = await fs.stat(rutaArchivoDestinoAbs);
        if (st.isFile()) destinoMdExiste = true;
      } catch {}
    }

    if (destinoMdExiste) {
      if (!enIndice) {
        const md5Md = await md5Archivo(path.join(raiz, rutaDestinoCarpeta, nombrePropuesto), opciones);
        anotacionesMd.push({
          clave: claveA,
          archivo: {
            curso: claveC,
            nombre: nombrePropuesto,
            ruta: rutaDestinoCarpeta,
            md5: md5Md,
            original: it.original,
          },
        });
      }
      itemsRes.push({
        idArchivo: it.idArchivo,
        estado: "descargado",
        fila: "0",
        rutaDestino: rutaDestinoCarpeta,
        nombre: nombrePropuesto,
        sinAsignar: prop.sinAsignar,
        omitido: false,
        movido: false,
      });
      continue;
    }

    if (enIndice) {
      const res = await resolverContraDisco({ raiz, archivoEnIndice, esAcceso, opciones });
      if (res.correccion) {
        correccionesRuta.push({
          clave: claveA,
          ...res.correccion,
        });
      }
      itemsRes.push({
        idArchivo: it.idArchivo,
        estado: res.estado,
        fila: res.fila,
        rutaDestino: res.rutaDestino,
        nombre: res.nombre,
        sinAsignar: prop.sinAsignar,
        omitido: false,
        movido: res.fila === "2" && Boolean(res.correccion),
      });
    } else {
      itemsRes.push({
        idArchivo: it.idArchivo,
        estado: "pendiente",
        fila: "4",
        rutaDestino: rutaDestinoCarpeta,
        nombre: nombrePropuesto,
        sinAsignar: prop.sinAsignar,
        omitido: false,
        movido: false,
      });
    }
  }

  if (correccionesRuta.length > 0 || anotacionesMd.length > 0) {
    await modificarIndice(raiz, (ind) => {
      for (const c of correccionesRuta) {
        const a = ind.archivos[c.clave];
        if (a) {
          a.ruta = c.ruta;
          a.nombre = c.nombre;
        }
      }
      for (const a of anotacionesMd) {
        if (!ind.archivos[a.clave]) {
          ind.archivos[a.clave] = a.archivo;
        }
      }
    });
  }

  return {
    ok: true,
    raiz,
    curso: {
      asociado: true,
      materia: cursoAsociado.materia,
      docente: cursoAsociado.docente,
    },
    items: itemsRes,
  };
}
