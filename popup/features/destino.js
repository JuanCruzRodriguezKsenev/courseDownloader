/**
 * POPUP — FEATURE: DESTINO POR ÍNDICE (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [DESTINO CORTE 2b-4] Módulo desacoplado para consultar al backend el estado
 *   de las clases contra el índice de destino (.course-downloader.json) (RN-2, D-2, D-3).
 * - Agrupa clases por curso y pide POST /api/destino/estado en paralelo (D-6).
 * - Asigna estado, destino resuelto, marca sinAsignar y bloqueos (D-5).
 * - Expone `bloquearSeleccion` (embudo de selección, D-4) y `puedeBajar` (cola, D-4).
 * ==========================================================================
 */

/**
 * Consulta al backend el estado de las clases del portal con destino por índice
 * y actualiza en memoria cada clase con su estado, destino resuelto y bloqueos.
 *
 * @param {object} params
 * @param {object} params.backend - Cliente del backend Bun (BunClient)
 * @param {object} params.sitio - Descriptor del portal
 * @param {Array<object>} params.clases - Listado de clases en memoria
 * @returns {Promise<{ ok?: boolean, indiceIlegible?: string }>}
 */
export async function aplicarEstadoDestino({ backend, sitio, clases }) {
  if (!sitio || !sitio.destinoPorIndice) {
    return { ok: true };
  }

  const clasesPortal = (clases || []).filter((c) => c.sitioId === sitio.id);
  if (clasesPortal.length === 0) {
    return { ok: true };
  }

  // Clases huérfanas de cursoId (ej. escaneo anterior): se bloquean como "sin-asociar"
  const clasesConCurso = [];
  for (const c of clasesPortal) {
    if (!c.cursoId) {
      c.bloqueo = "sin-asociar";
      c.destino = undefined;
      c.sinAsignar = false;
      c.seleccionado = false;
    } else {
      clasesConCurso.push(c);
    }
  }

  if (clasesConCurso.length === 0) {
    return { ok: true };
  }

  // Agrupar clases por cursoId (D-6)
  const porCurso = new Map();
  for (const c of clasesConCurso) {
    let grupo = porCurso.get(c.cursoId);
    if (!grupo) {
      grupo = [];
      porCurso.set(c.cursoId, grupo);
    }
    grupo.push(c);
  }

  // Pedir estado de cada curso en paralelo (D-6). Los errores de red se lanzan.
  const pedidos = Array.from(porCurso.entries()).map(async ([idCurso, clasesCurso]) => {
    const payload = {
      sitio: sitio.id,
      curso: { id: idCurso, nombre: clasesCurso[0].cursoNombre || "" },
      items: clasesCurso.map((c) => ({
        idArchivo: c.idArchivo,
        original: c.titulo,
        tema: c.tema,
        publicacion: c.publicacion,
        anuncio: c.anuncio,
        tipo: c.tipo,
      })),
    };
    const res = await backend.estadoDestino(payload);
    return { idCurso, clasesCurso, res };
  });

  const resultados = await Promise.all(pedidos);

  // Si algún curso reportó que el índice está ilegible, se bloquean TODAS las clases del portal
  // y se devuelve { indiceIlegible: error } sin alterar los estados previos de descarga (AC-7).
  const falloIndice = resultados.find((r) => r.res && r.res.indiceIlegible);
  if (falloIndice) {
    for (const c of clasesPortal) {
      c.bloqueo = "indice-ilegible";
      c.seleccionado = false;
    }
    return { indiceIlegible: falloIndice.res.error };
  }

  // Aplicar resultados curso por curso
  for (const { idCurso, clasesCurso, res } of resultados) {
    const asociado = Boolean(res && res.curso && res.curso.asociado);

    if (!asociado) {
      for (const c of clasesCurso) {
        c.bloqueo = "sin-asociar";
        c.destino = undefined;
        c.sinAsignar = false;
        c.seleccionado = false;
        if (c.estado !== "process") {
          c.estado = "pending";
        }
      }
      continue;
    }

    const itemsPorId = new Map(
      (res.items || []).map((it) => [it.idArchivo, it])
    );

    for (const c of clasesCurso) {
      const itRes = itemsPorId.get(c.idArchivo);

      if (itRes && itRes.omitido) {
        c.bloqueo = "omitido";
        c.destino = undefined;
        c.sinAsignar = false;
        c.seleccionado = false;
        if (c.estado !== "process") {
          c.estado = "pending";
        }
        continue;
      }

      c.bloqueo = undefined;
      c.sinAsignar = Boolean(itRes && itRes.sinAsignar);
      c.destino = {
        ruta: itRes ? itRes.rutaDestino : null,
        nombre: itRes ? itRes.nombre : null,
        claveCurso: `${sitio.id}:${idCurso}`,
        original: c.titulo,
      };

      if (c.estado !== "process") {
        const descargado = itRes && itRes.estado === "descargado";
        c.estado = descargado ? "downloaded" : "pending";
        if (descargado) {
          c.seleccionado = false;
        }
      } else {
        c.seleccionado = false;
      }
    }
  }

  return { ok: true };
}

/**
 * Pone seleccionado = false en toda clase con bloqueo (D-4).
 *
 * @param {Array<object>} clases
 */
export function bloquearSeleccion(clases) {
  if (!Array.isArray(clases)) return;
  for (const c of clases) {
    if (c.bloqueo) {
      c.seleccionado = false;
    }
  }
}

/**
 * Predicado de descarga: indica si una clase no está bloqueada (D-4).
 *
 * @param {object} clase
 * @returns {boolean}
 */
export function puedeBajar(clase) {
  return !clase?.bloqueo;
}

export default {
  aplicarEstadoDestino,
  bloquearSeleccion,
  puedeBajar,
};
