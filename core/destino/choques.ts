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
