import { primeraFrase, proponerNombre } from "./nombres";

export interface FilaChoque {
  clave: string;
  ruta: string;
  nombre: string;
  md5: string;
}

export interface GrupoChoque {
  ruta: string;
  nombre: string;
  filas: FilaChoque[];
}

export function buscarChoques(filas: FilaChoque[]): GrupoChoque[] {
  const grupos = new Map<string, FilaChoque[]>();

  for (const fila of filas) {
    const r = fila.ruta.replace(/\/+$/, "");
    const claveGrupo = `${r}/${fila.nombre}`.toLowerCase();
    const arr = grupos.get(claveGrupo) || [];
    arr.push(fila);
    grupos.set(claveGrupo, arr);
  }

  const choques: GrupoChoque[] = [];

  for (const grupo of grupos.values()) {
    const md5s = new Set(grupo.map((f) => f.md5.toLowerCase()));
    if (md5s.size > 1 && grupo.length > 0) {
      const primero = grupo[0]!;
      choques.push({
        ruta: primero.ruta,
        nombre: primero.nombre,
        filas: grupo,
      });
    }
  }

  return choques;
}

export interface FilaNovedad extends FilaChoque {
  renombrable: boolean; // accion === "copiar" && tema === "Novedades"
  original: string; // título crudo del ítem (item.titulo)
  anuncio?: string;
  tema?: string;
  docente?: string;
}

/**
 * Resuelve choques de nombres en Novedades usando la primera frase del anuncio (RN-16a).
 * Si persisten choques en el mismo anuncio (p. ej. MC3 con copia (N)), agrega _N.
 */
export function renombrarChoquesNovedades(filas: FilaNovedad[]): Map<string, string> {
  const map = new Map<string, string>();
  const grupos = buscarChoques(filas);

  for (const grupo of grupos) {
    for (const fila of grupo.filas as FilaNovedad[]) {
      if (!fila.renombrable) continue;
      const frase = primeraFrase(fila.anuncio);
      if (!frase) continue;

      const matchExt = fila.nombre.match(/\.[a-z0-9]{1,5}$/i);
      const ext = matchExt ? matchExt[0] : "";
      const nuevo = proponerNombre({
        original: frase + ext,
        tema: fila.tema,
        docente: fila.docente,
      });
      map.set(fila.clave, nuevo);
    }
  }

  // 2. Residuo: armar la lista de filas con el nuevo nombre y volver a buscar choques
  const filasConNuevoNombre: FilaNovedad[] = filas.map((f) => ({
    ...f,
    nombre: map.get(f.clave) ?? f.nombre,
  }));
  const gruposResiduo = buscarChoques(filasConNuevoNombre);

  for (const grupo of gruposResiduo) {
    for (const fila of grupo.filas as FilaNovedad[]) {
      if (!map.has(fila.clave)) continue;
      const matchCopia = fila.original.match(/\((\d+)\)\s*(?:\.[A-Za-z0-9]{1,5})?$/);
      if (matchCopia && matchCopia[1]) {
        const numN = matchCopia[1];
        const actual = map.get(fila.clave)!;
        const matchExt = actual.match(/\.[a-z0-9]{1,5}$/i);
        const ext = matchExt ? matchExt[0] : "";
        const base = matchExt ? actual.slice(0, matchExt.index) : actual;
        map.set(fila.clave, `${base}_${numN}${ext}`);
      }
    }
  }

  return map;
}
