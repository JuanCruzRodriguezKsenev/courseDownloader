// Humo en jsdom para el modo índice del editor de adopción (H-6)
// Ejecuta el HTML y JS real del editor interactuando con el backend real en memoria.

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { crearManejadorEditor } from "./editor.js";
import { guardarVisto, limpiarVistos } from "../destino/vistos.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";

const dirModulo = import.meta.dir || import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const rutaHtml = path.join(dirModulo, "editor.html");
const html = fs.readFileSync(rutaHtml, "utf8");

const errores = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errores.push(String(e.message || e)));
vc.on("error", (e) => errores.push(String(e)));

const dirRaiz = fs.mkdtempSync(path.join(os.tmpdir(), "humo-indice-raiz-"));
const dirSalida = fs.mkdtempSync(path.join(os.tmpdir(), "humo-indice-salida-"));

try {
  limpiarVistos();

  // Estructura de carpetas bajo la raíz
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Fisica 2/Teorias/Palacio"), { recursive: true });
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Quimica/Teorias"), { recursive: true });

  // Índice inicial con un curso asociado
  const indiceInicial = {
    version: 1,
    cursos: {
      "google-classroom:c_asociado": {
        nombre: "Física II",
        materia: "Ingenieria/Fisica 2",
        docente: "Palacio",
        temas: { "Teoría": "Teorias/Palacio" },
      },
    },
    archivos: {},
  };
  fs.writeFileSync(path.join(dirRaiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

  // Vistos: curso asociado y curso nuevo
  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_asociado", nombre: "Física II" },
    items: [{ idArchivo: "f1", original: "guia1.pdf", tema: "Teoría" }],
  });

  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_nuevo", nombre: "Química General" },
    items: [
      { idArchivo: "q1", original: "tabla_periodica.pdf", tema: "Teoría" },
      { idArchivo: "q2", original: "cuestionario.pdf", tema: "Teoría" },
    ],
  });

  const manejar = crearManejadorEditor({ raiz: dirRaiz, salida: dirSalida, puerto: 3002 }, "/adopcion");

  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:3002/adopcion/?modo=indice&curso=google-classroom:c_nuevo",
    runScripts: "dangerously",
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = async (input, init) => {
        const urlStr = String(input);
        const urlObj = new URL(urlStr, "http://127.0.0.1:3002/adopcion/");
        const req = new Request(urlObj.href, init);
        return await manejar(req, urlObj);
      };
      w.alert = (m) => errores.push("alert: " + m);
      w.CSS = w.CSS || {};
      w.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
    },
  });

  // Esperar a que editor.html cargue y renderice
  await new Promise((r) => setTimeout(r, 400));

  const doc = dom.window.document;

  // 1. Verificar encabezado "Asociar curso"
  const h2 = doc.querySelector("#cabecera-curso h2");
  if (!h2 || !h2.textContent.includes("Asociar curso")) {
    errores.push(`Encabezado no dice Asociar curso: ${h2?.textContent}`);
  }

  // 2. Elegir materia y docente
  const selectMateria = doc.querySelector(".tabla-curso-cabecera select");
  if (!selectMateria) {
    errores.push("No se encontró selectMateria");
  } else {
    selectMateria.value = "Ingenieria/Quimica";
    selectMateria.dispatchEvent(new dom.window.Event("change"));
  }

  const inputDocente = doc.querySelector(".tabla-curso-cabecera input[type='text']");
  if (!inputDocente) {
    errores.push("No se encontró inputDocente");
  } else {
    inputDocente.value = "Gomez";
    inputDocente.dispatchEvent(new dom.window.Event("input"));
  }

  // 3. Cambiar nombre de archivo q1
  const inputQ1 = doc.querySelector("[id='inp-nom-google-classroom:q1']");
  if (!inputQ1) {
    errores.push("No se encontró inputNombre para google-classroom:q1");
  } else {
    inputQ1.value = "01_tabla_periodica_personalizada.pdf";
    inputQ1.dispatchEvent(new dom.window.Event("input"));
  }

  // 4. Cambiar acción de archivo q2 a omitir
  const selectQ2 = doc.querySelector("[id='sel-acc-google-classroom:q2']");
  if (!selectQ2) {
    errores.push("No se encontró selectAccion para google-classroom:q2");
  } else {
    selectQ2.value = "omitir";
    selectQ2.dispatchEvent(new dom.window.Event("change"));
  }

  // 5. Guardar
  const btnGuardar = doc.getElementById("btn-guardar");
  if (!btnGuardar) {
    errores.push("No se encontró btn-guardar");
  } else {
    btnGuardar.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  // 6. Afirmar el índice resultante en disco
  const contenidoFinal = fs.readFileSync(path.join(dirRaiz, NOMBRE_INDICE), "utf8");
  const indiceGuardado = JSON.parse(contenidoFinal);

  const cursoNuevo = indiceGuardado.cursos["google-classroom:c_nuevo"];
  if (!cursoNuevo) {
    errores.push("El curso nuevo no se guardó en el índice");
  } else {
    if (cursoNuevo.materia !== "Ingenieria/Quimica") {
      errores.push(`Materia esperada Ingenieria/Quimica, obtenida: ${cursoNuevo.materia}`);
    }
    if (cursoNuevo.docente !== "Gomez") {
      errores.push(`Docente esperado Gomez, obtenido: ${cursoNuevo.docente}`);
    }
    if (cursoNuevo.temas["Teoría"] !== "Teorias/Gomez") {
      errores.push(`Tema Teoría esperado Teorias/Gomez, obtenido: ${cursoNuevo.temas["Teoría"]}`);
    }
    if (!cursoNuevo.nombres || cursoNuevo.nombres["google-classroom:q1"] !== "01_tabla_periodica_personalizada.pdf") {
      errores.push(`Nombre editado no figura en curso.nombres: ${JSON.stringify(cursoNuevo.nombres)}`);
    }
    if (!cursoNuevo.omitidos || !cursoNuevo.omitidos.includes("google-classroom:q2")) {
      errores.push(`q2 no figura en curso.omitidos: ${JSON.stringify(cursoNuevo.omitidos)}`);
    }
  }

  const cursoPrevio = indiceGuardado.cursos["google-classroom:c_asociado"];
  if (!cursoPrevio || cursoPrevio.materia !== "Ingenieria/Fisica 2") {
    errores.push("El curso previamente asociado no se conservó intacto");
  }

} finally {
  limpiarVistos();
  fs.rmSync(dirRaiz, { recursive: true, force: true });
  fs.rmSync(dirSalida, { recursive: true, force: true });
}

console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
