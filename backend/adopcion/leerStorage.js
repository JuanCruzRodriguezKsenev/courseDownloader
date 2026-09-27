import fs from "node:fs";
import path from "node:path";

const BLOCK_SIZE = 32768;
const HEADER_SIZE = 7;

/**
 * Lee los registros reensamblados de un archivo .log de LevelDB.
 *
 * Bloques de 32768 bytes con cabecera de 7 bytes:
 * - crc (4 bytes)
 * - largo (u16 LE, 2 bytes)
 * - tipo (1 byte): 1 = FULL, 2 = FIRST, 3 = MIDDLE, 4 = LAST
 */
export function leerRegistros(archivoLog) {
  const buf = fs.readFileSync(archivoLog);
  const registros = [];
  let offset = 0;
  let fragmentos = [];

  while (offset < buf.length) {
    const bytesRestantesEnBloque = BLOCK_SIZE - (offset % BLOCK_SIZE);
    if (bytesRestantesEnBloque < HEADER_SIZE) {
      offset += bytesRestantesEnBloque;
      continue;
    }

    if (offset + HEADER_SIZE > buf.length) {
      break;
    }

    const largo = buf.readUInt16LE(offset + 4);
    const tipo = buf.readUInt8(offset + 6);

    if (tipo === 0) {
      offset += bytesRestantesEnBloque;
      continue;
    }

    if (tipo > 4) {
      break;
    }

    const inicioDatos = offset + HEADER_SIZE;
    const finDatos = inicioDatos + largo;

    if (finDatos > buf.length) {
      break;
    }

    const datos = buf.subarray(inicioDatos, finDatos);
    offset = finDatos;

    if (tipo === 1) {
      registros.push(datos);
      fragmentos = [];
    } else if (tipo === 2) {
      fragmentos = [datos];
    } else if (tipo === 3) {
      fragmentos.push(datos);
    } else if (tipo === 4) {
      fragmentos.push(datos);
      registros.push(Buffer.concat(fragmentos));
      fragmentos = [];
    }
  }

  return registros;
}

/**
 * Busca el primer '[' o '{' a partir de `inicio` y parsea el objeto o array
 * balanceando delimitadores y respetando cadenas de texto JSON.
 */
export function extraerPrimerJson(texto, inicio) {
  const idxBracket = texto.indexOf("[", inicio);
  const idxBrace = texto.indexOf("{", inicio);

  let primerIdx = -1;
  if (idxBracket !== -1 && idxBrace !== -1) {
    primerIdx = Math.min(idxBracket, idxBrace);
  } else if (idxBracket !== -1) {
    primerIdx = idxBracket;
  } else if (idxBrace !== -1) {
    primerIdx = idxBrace;
  }

  if (primerIdx === -1) {
    return null;
  }

  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = primerIdx; i < texto.length; i++) {
    const ch = texto[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}") {
      if (stack.length === 0 || stack[stack.length - 1] !== "{") {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        try {
          return {
            valor: JSON.parse(texto.slice(primerIdx, i + 1)),
            fin: i + 1,
          };
        } catch {
          return null;
        }
      }
    } else if (ch === "]") {
      if (stack.length === 0 || stack[stack.length - 1] !== "[") {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        try {
          return {
            valor: JSON.parse(texto.slice(primerIdx, i + 1)),
            fin: i + 1,
          };
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Lee el último valor JSON asociado a una clave en los logs de LevelDB de un directorio de storage.
 */
export function leerUltimoValor(dirStorage, clave, predicado = null) {
  if (!fs.existsSync(dirStorage)) {
    return null;
  }

  const archivos = fs.readdirSync(dirStorage);
  const logs = archivos.filter((f) => f.endsWith(".log")).sort();

  if (logs.length === 0) {
    return null;
  }

  const archivoLog = path.join(dirStorage, logs[logs.length - 1]);
  let registros;
  try {
    registros = leerRegistros(archivoLog);
  } catch {
    return null;
  }

  let ultimoValor = null;

  for (const regBuf of registros) {
    const texto = regBuf.toString("utf8");
    let pos = 0;

    while (pos < texto.length) {
      const idx = texto.indexOf(clave, pos);
      if (idx === -1) {
        break;
      }

      const res = extraerPrimerJson(texto, idx + clave.length);
      if (res) {
        if (!predicado || predicado(res.valor)) {
          ultimoValor = res.valor;
        }
        pos = res.fin;
      } else {
        pos = idx + clave.length;
      }
    }
  }

  return ultimoValor;
}
