import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { sanitizarNombreArchivo } from "../utils.js";
import { DESTINOS } from "../../core/destino/carpetas.ts";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    raiz: path.join(os.homedir(), "U.N.L.P"),
    salida: path.join(os.homedir(), "Descargas/adopcion-classroom"),
    puerto: 3002,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--raiz" && args[i + 1]) {
      opts.raiz = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--salida" && args[i + 1]) {
      opts.salida = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--puerto" && args[i + 1]) {
      opts.puerto = parseInt(args[++i], 10);
    }
  }

  return opts;
}

export function leerTsvCrudo(rutaArchivo) {
  if (!fs.existsSync(rutaArchivo)) {
    throw new Error(`No se encontró el archivo TSV: ${rutaArchivo}`);
  }
  const contenido = fs.readFileSync(rutaArchivo, "utf8");
  const lineas = contenido.split(/\r?\n/);
  const comentarios = [];
  let cabecera = null;
  const filas = [];

  for (const linea of lineas) {
    if (cabecera === null) {
      if (linea.startsWith("#")) {
        comentarios.push(linea);
      } else if (linea.length > 0) {
        cabecera = linea.split("\t");
      }
    } else if (linea.length > 0) {
      const valores = linea.split("\t");
      const fila = {};
      for (let j = 0; j < cabecera.length; j++) {
        fila[cabecera[j]] = valores[j] !== undefined ? valores[j] : "";
      }
      filas.push(fila);
    }
  }

  return { comentarios, cabecera: cabecera || [], filas };
}

export function escribirTsvCrudo(rutaArchivo, datos) {
  const lineas = [...datos.comentarios, datos.cabecera.join("\t")];
  for (const fila of datos.filas) {
    lineas.push(
      datos.cabecera.map((col) => (fila[col] !== undefined ? fila[col] : "")).join("\t")
    );
  }
  const contenido = lineas.join("\n") + "\n";
  const rutaTmp = `${rutaArchivo}.tmp`;
  fs.writeFileSync(rutaTmp, contenido, "utf8");
  fs.renameSync(rutaTmp, rutaArchivo);
}

function obtenerMaterias(raiz) {
  const materias = [];
  if (!fs.existsSync(raiz)) {
    return materias;
  }
  try {
    const nivel1 = fs.readdirSync(raiz, { withFileTypes: true });
    for (const fac of nivel1) {
      if (!fac.isDirectory() || fac.name.startsWith(".")) continue;
      const dirFac = path.join(raiz, fac.name);
      const nivel2 = fs.readdirSync(dirFac, { withFileTypes: true });
      for (const mat of nivel2) {
        if (!mat.isDirectory() || mat.name.startsWith(".")) continue;
        materias.push(`${fac.name}/${mat.name}`);
      }
    }
  } catch {
    // Si la raíz no es accesible, devolver vacío
  }
  materias.sort();
  return materias;
}

function obtenerDocentes(raiz, materias) {
  const docentes = {};
  for (const m of materias) {
    docentes[m] = [];
    const dirTeorias = path.join(raiz, m, "Teorias");
    if (fs.existsSync(dirTeorias)) {
      try {
        const subs = fs.readdirSync(dirTeorias, { withFileTypes: true });
        for (const sub of subs) {
          if (sub.isDirectory() && !sub.name.startsWith(".")) {
            docentes[m].push(sub.name);
          }
        }
        docentes[m].sort();
      } catch {
        // Ignorar errores al leer subcarpetas
      }
    }
  }
  return docentes;
}

export function iniciarServidor(opts = parseArgs()) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.puerto,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/") {
        const rutaHtml = path.join(import.meta.dir, "editor.html");
        if (!fs.existsSync(rutaHtml)) {
          return new Response("editor.html no encontrado", { status: 404 });
        }
        const html = fs.readFileSync(rutaHtml, "utf8");
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (req.method === "GET" && url.pathname === "/api/datos") {
        try {
          const datosCursos = leerTsvCrudo(path.join(opts.salida, "cursos.tsv"));
          const datosTemas = leerTsvCrudo(path.join(opts.salida, "temas.tsv"));
          const datosArchivos = leerTsvCrudo(path.join(opts.salida, "archivos.tsv"));
          const materias = obtenerMaterias(opts.raiz);
          const docentes = obtenerDocentes(opts.raiz, materias);

          return Response.json({
            cursos: datosCursos.filas,
            temas: datosTemas.filas,
            archivos: datosArchivos.filas,
            destinos: DESTINOS,
            materias,
            docentes,
          });
        } catch (err) {
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/guardar") {
        try {
          const cuerpo = await req.json();
          const { cursos, temas, archivos } = cuerpo;

          const rutaCursos = path.join(opts.salida, "cursos.tsv");
          const rutaTemas = path.join(opts.salida, "temas.tsv");
          const rutaArchivos = path.join(opts.salida, "archivos.tsv");

          const tsvCursos = leerTsvCrudo(rutaCursos);
          const tsvTemas = leerTsvCrudo(rutaTemas);
          const tsvArchivos = leerTsvCrudo(rutaArchivos);

          const errores = [];
          const materias = obtenerMaterias(opts.raiz);
          const setMaterias = new Set(materias);

          // Claves de cursos
          const mapCursosDisco = new Map();
          for (const c of tsvCursos.filas) {
            mapCursosDisco.set(c.clave_curso, c);
          }
          const mapCursosCuerpo = new Map();
          if (Array.isArray(cursos)) {
            for (const c of cursos) {
              mapCursosCuerpo.set(c.clave_curso, c);
            }
          }

          // Claves de temas
          const mapTemasDisco = new Map();
          for (const t of tsvTemas.filas) {
            mapTemasDisco.set(`${t.clave_curso}\t${t.tema}`, t);
          }
          const mapTemasCuerpo = new Map();
          if (Array.isArray(temas)) {
            for (const t of temas) {
              mapTemasCuerpo.set(`${t.clave_curso}\t${t.tema}`, t);
            }
          }

          // Claves de archivos
          const mapArchivosDisco = new Map();
          for (const a of tsvArchivos.filas) {
            mapArchivosDisco.set(a.clave, a);
          }
          const mapArchivosCuerpo = new Map();
          if (Array.isArray(archivos)) {
            for (const a of archivos) {
              mapArchivosCuerpo.set(a.clave, a);
            }
          }

          // Validar estructura de filas (no se agregan ni se quitan)
          if (!Array.isArray(cursos) || cursos.length !== tsvCursos.filas.length || mapCursosCuerpo.size !== mapCursosDisco.size) {
            errores.push("Las filas de cursos no coinciden con las del disco (no se pueden agregar ni quitar filas).");
          }
          if (!Array.isArray(temas) || temas.length !== tsvTemas.filas.length || mapTemasCuerpo.size !== mapTemasDisco.size) {
            errores.push("Las filas de temas no coinciden con las del disco (no se pueden agregar ni quitar filas).");
          }
          if (!Array.isArray(archivos) || archivos.length !== tsvArchivos.filas.length || mapArchivosCuerpo.size !== mapArchivosDisco.size) {
            errores.push("Las filas de archivos no coinciden con las del disco (no se pueden agregar ni quitar filas).");
          }

          if (errores.length > 0) {
            return Response.json({ ok: false, errores });
          }

          // Validar cursos
          for (const cDisco of tsvCursos.filas) {
            const cCuerpo = mapCursosCuerpo.get(cDisco.clave_curso);
            if (!cCuerpo) {
              errores.push(`Falta el curso ${cDisco.clave_curso} en los datos recibidos.`);
              continue;
            }
            const materia = cCuerpo.materia !== undefined ? String(cCuerpo.materia) : "";
            const docente = cCuerpo.docente !== undefined ? String(cCuerpo.docente) : "";

            if (/[\t\r\n]/.test(materia) || /[\t\r\n]/.test(docente)) {
              errores.push(`Curso '${cDisco.nombre}': contiene tabulaciones o saltos de línea.`);
            }
            if (materia !== "" && !setMaterias.has(materia)) {
              errores.push(`Curso '${cDisco.nombre}': materia '${materia}' no existe.`);
            }
            if (docente.includes("/") || docente.includes("\\")) {
              errores.push(`Curso '${cDisco.nombre}': docente contiene barras (/ o \\): '${docente}'.`);
            }
          }

          // Validar temas
          for (const tDisco of tsvTemas.filas) {
            const claveT = `${tDisco.clave_curso}\t${tDisco.tema}`;
            const tCuerpo = mapTemasCuerpo.get(claveT);
            const cDisco = mapCursosDisco.get(tDisco.clave_curso);
            const nombreCurso = cDisco ? cDisco.nombre : tDisco.clave_curso;

            if (!tCuerpo) {
              errores.push(`Falta el tema '${nombreCurso} › ${tDisco.tema}' en los datos recibidos.`);
              continue;
            }

            const destino = tCuerpo.destino !== undefined ? String(tCuerpo.destino) : "";
            if (/[\t\r\n]/.test(destino)) {
              errores.push(`Tema '${nombreCurso} › ${tDisco.tema}': contiene tabulaciones o saltos de línea.`);
            }
            if (destino !== "-" && !DESTINOS.includes(destino)) {
              errores.push(`Tema '${nombreCurso} › ${tDisco.tema}': destino inválido '${destino}'.`);
            }
          }

          // Validar archivos
          for (const aDisco of tsvArchivos.filas) {
            const aCuerpo = mapArchivosCuerpo.get(aDisco.clave);
            if (!aCuerpo) {
              errores.push(`Falta el archivo con clave ${aDisco.clave} en los datos recibidos.`);
              continue;
            }

            const accion = aCuerpo.accion !== undefined ? String(aCuerpo.accion) : "";
            const nombre = aCuerpo.nombre !== undefined ? String(aCuerpo.nombre) : "";

            if (aDisco.accion === "ya-esta" || aDisco.accion === "duplicado") {
              if (accion !== aDisco.accion || nombre !== aDisco.nombre) {
                errores.push(`la fila ${aDisco.clave} es '${aDisco.accion}' y no se edita`);
              }
              continue;
            }

            if (aDisco.accion === "copiar" || aDisco.accion === "omitir") {
              if (/[\t\r\n]/.test(accion) || /[\t\r\n]/.test(nombre)) {
                errores.push(`Archivo '${aDisco.original}': contiene tabulaciones o saltos de línea.`);
              }
              if (accion !== "copiar" && accion !== "omitir") {
                errores.push(`Archivo '${aDisco.original}': acción '${accion}' inválida.`);
              }
              if (!nombre || nombre.trim().length === 0) {
                errores.push(`Archivo '${aDisco.original}': tiene nombre vacío.`);
              } else {
                const sanitizado = sanitizarNombreArchivo(nombre);
                if (nombre.includes("/") || nombre.includes("\\") || sanitizado !== nombre) {
                  errores.push(
                    `Archivo '${aDisco.original}': nombre '${nombre}' no coincide con su sanitizado. Quedaría '${sanitizado}'.`
                  );
                }
              }
            }
          }

          if (errores.length > 0) {
            return Response.json({ ok: false, errores });
          }

          // Aplicar sólo los campos editables
          for (const cDisco of tsvCursos.filas) {
            const cCuerpo = mapCursosCuerpo.get(cDisco.clave_curso);
            cDisco.materia = cCuerpo.materia !== undefined ? String(cCuerpo.materia) : "";
            cDisco.docente = cCuerpo.docente !== undefined ? String(cCuerpo.docente) : "";
          }

          for (const tDisco of tsvTemas.filas) {
            const claveT = `${tDisco.clave_curso}\t${tDisco.tema}`;
            const tCuerpo = mapTemasCuerpo.get(claveT);
            tDisco.destino = tCuerpo.destino !== undefined ? String(tCuerpo.destino) : "";
          }

          for (const aDisco of tsvArchivos.filas) {
            if (aDisco.accion === "copiar" || aDisco.accion === "omitir") {
              const aCuerpo = mapArchivosCuerpo.get(aDisco.clave);
              aDisco.nombre = aCuerpo.nombre !== undefined ? String(aCuerpo.nombre) : "";
              aDisco.accion = aCuerpo.accion !== undefined ? String(aCuerpo.accion) : "";
            }
          }

          // Reescribir los tres TSV
          escribirTsvCrudo(rutaCursos, tsvCursos);
          escribirTsvCrudo(rutaTemas, tsvTemas);
          escribirTsvCrudo(rutaArchivos, tsvArchivos);

          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ ok: false, errores: [String(err)] }, { status: 500 });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/ensayo") {
        try {
          const proc = Bun.spawn(
            [
              process.execPath,
              path.join(import.meta.dir, "aplicar.js"),
              "--raiz",
              opts.raiz,
              "--salida",
              opts.salida,
            ],
            {
              stdout: "pipe",
              stderr: "pipe",
            }
          );

          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          const codigo = await proc.exited;

          return Response.json({ codigo, salida: stdout + stderr });
        } catch (err) {
          return Response.json({ codigo: 1, salida: `Error al ejecutar ensayo: ${err}` }, { status: 500 });
        }
      }

      return new Response("No encontrado", { status: 404 });
    },
  });

  console.log(`Editor de adopción Classroom escuchando en http://127.0.0.1:${server.port}`);
  console.log("No corras generar.js mientras editás: pisa los TSV.");

  return server;
}

if (import.meta.main) {
  iniciarServidor();
}
