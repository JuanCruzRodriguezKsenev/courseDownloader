/**
 * POPUP — FEATURE: DESTINO POR ÍNDICE (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [DESTINO CORTE 2c-3] Comparador `compararPrioridadDestino` para ordenar sinAsignar primero (D-2).
 * - [DESTINO CORTE 2c-2] Funciones `armarVistos` (D-3) y `cursoParaEditor` (D-2).
 *
 * CHANGELOG v1.0.0:
 * - [DESTINO CORTE 2b-4] Módulo desacoplado para consultar al backend el estado
 *   de las clases contra el índice de destino (.course-downloader.json) (RN-2, D-2, D-3).
 * - Agrupa clases por curso y pide POST /api/destino/estado en paralelo (D-6).
 * - Asigna estado, destino resuelto, marca sinAsignar y bloqueos (D-5).
 * - Expone `bloquearSeleccion` (embudo de selección, D-4) y `puedeBajar` (cola, D-4).
 * ==========================================================================
 */

/**
 * Comparador de prioridad para temas sin asignar (D-2).
 * Coloca los ítems con `sinAsignar === true` antes que los demás dentro de un mismo grupo.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compararPrioridadDestino(a, b) {
  return (b && b.sinAsignar ? 1 : 0) - (a && a.sinAsignar ? 1 : 0);
}

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

  const resConRaiz = resultados.find((r) => r.res && r.res.raiz);
  const raiz = resConRaiz?.res?.raiz;

  // Si algún curso reportó que el índice está ilegible, se bloquean TODAS las clases del portal
  // y se devuelve { indiceIlegible: error, raiz } sin alterar los estados previos de descarga (AC-7).
  const falloIndice = resultados.find((r) => r.res && r.res.indiceIlegible);
  if (falloIndice) {
    for (const c of clasesPortal) {
      c.bloqueo = "indice-ilegible";
      c.seleccionado = false;
    }
    return { indiceIlegible: falloIndice.res.error, raiz };
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

  return { ok: true, raiz };
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

/**
 * Compone la nota informativa sobre cursos sin asociar y temas sin asignar (D-4).
 *
 * @param {Array<object>} clases
 * @returns {string} Texto de la nota o cadena vacía si no aplica
 */
export function notasDeDestino(clases) {
  if (!Array.isArray(clases) || clases.length === 0) return '';

  const notas = [];

  // Cursos sin asociar (D-4, RN-2)
  const cursosSinAsociarSet = new Set();
  for (const c of clases) {
    if (c.bloqueo === 'sin-asociar') {
      const nombre = c.cursoNombre || c.cursoId;
      if (nombre) cursosSinAsociarSet.add(nombre);
    }
  }

  const cursos = Array.from(cursosSinAsociarSet);
  if (cursos.length > 0) {
    const nombres = cursos.join(', ');
    if (cursos.length === 1) {
      notas.push(`1 curso sin asociar: ${nombres}. Abrí 🗂️ para asociarlo.`);
    } else {
      notas.push(`${cursos.length} cursos sin asociar: ${nombres}. Abrí 🗂️ para asociarlos.`);
    }
  }

  // Temas sin asignar (D-4, RN-9, AC-9)
  const countSinAsignar = clases.filter((c) => c.sinAsignar).length;
  if (countSinAsignar > 0) {
    if (countSinAsignar === 1) {
      notas.push('1 archivo en temas sin asignar va a la raíz de la materia. Abrí 🗂️ para asignarle carpeta.');
    } else {
      notas.push(`${countSinAsignar} archivos en temas sin asignar van a la raíz de la materia. Abrí 🗂️ para asignarles carpeta.`);
    }
  }

  return notas.join(' · ');
}

/**
 * Genera el view-model de la card de error por índice ilegible (D-5, U-4).
 * Escapa el mensaje recibido del backend/disco para inserción HTML segura.
 *
 * @param {string} mensajeError
 * @returns {object} Descriptor de la tarjeta para ListaClases
 */
export function cardIndiceIlegible(mensajeError) {
  const texto = String(mensajeError || 'Error al leer el archivo');
  const escapado = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');

  return {
    tipo: 'error',
    icono: '⛔',
    titulo: 'No se pudo leer .course-downloader.json',
    descripcion: `${escapado}<br><br>No se va a bajar nada hasta que se arregle. El archivo no se tocó.`,
  };
}

/**
 * Agrupa los cursos de la lista por cursoId con sus ítems para enviarlos al backend (D-3).
 * Omite clases sin cursoId y las cuenta en `sinCurso`.
 * Si el portal no usa destino por índice, devuelve null (D-1).
 *
 * @param {Array<object>} clases
 * @param {object} sitio
 * @returns {{ cursos: Array<{ id: string, nombre: string, items: Array<object> }>, sinCurso: number } | null}
 */
export function armarVistos(clases, sitio) {
  if (!sitio || !sitio.destinoPorIndice) {
    return null;
  }
  if (!Array.isArray(clases)) {
    return { cursos: [], sinCurso: 0 };
  }

  const sitioId = sitio.id;
  const clasesPortal = clases.filter((c) => c && (!c.sitioId || c.sitioId === sitioId));
  const porCurso = new Map();
  let sinCurso = 0;

  for (const c of clasesPortal) {
    if (!c.cursoId) {
      sinCurso++;
      continue;
    }
    let grupo = porCurso.get(c.cursoId);
    if (!grupo) {
      grupo = {
        id: c.cursoId,
        nombre: c.cursoNombre || '',
        items: [],
      };
      porCurso.set(c.cursoId, grupo);
    }
    grupo.items.push({
      idArchivo: c.idArchivo,
      original: c.titulo,
      tema: c.tema,
      publicacion: c.publicacion,
      anuncio: c.anuncio,
      bytes: c.bytes,
      tipo: c.tipo,
    });
  }

  return {
    cursos: Array.from(porCurso.values()),
    sinCurso,
  };
}

/**
 * Determina qué curso abrir en el editor web (D-2).
 * - Si viene de un solo curso (claveListado != 'todos'), ése.
 * - Si viene de «todos», el primer curso sin asociar; si no hay ninguno, el primero de la lista.
 * Devuelve la clave completa (`sitio:id`) o null si no aplica.
 *
 * @param {object} params
 * @param {Array<object>} params.clases
 * @param {string} [params.claveListado]
 * @param {object} params.sitio
 * @returns {string | null}
 */
export function cursoParaEditor({ clases, claveListado, sitio }) {
  if (!sitio || !sitio.destinoPorIndice) {
    return null;
  }

  const sitioId = sitio.id || 'google-classroom';
  const formatearClave = (id) => (id && id.includes(':') ? id : `${sitioId}:${id}`);

  // Si viene de un solo curso (claveDeListado distinto de "todos"), ése (D-2).
  if (claveListado && claveListado !== 'todos') {
    return formatearClave(claveListado);
  }

  if (!Array.isArray(clases) || clases.length === 0) {
    return null;
  }

  const clasesPortal = clases.filter((c) => c && (!c.sitioId || c.sitioId === sitioId));

  // Si viene de "todos", el primer curso sin asociar (D-2).
  const sinAsociar = clasesPortal.find((c) => c.cursoId && c.bloqueo === 'sin-asociar');
  if (sinAsociar) {
    return formatearClave(sinAsociar.cursoId);
  }

  // Si no hay ninguno sin asociar, el primero de la lista (D-2).
  const primerCurso = clasesPortal.find((c) => c.cursoId);
  if (primerCurso) {
    return formatearClave(primerCurso.cursoId);
  }

  return null;
}

export default {
  aplicarEstadoDestino,
  bloquearSeleccion,
  puedeBajar,
  notasDeDestino,
  cardIndiceIlegible,
  armarVistos,
  cursoParaEditor,
};



