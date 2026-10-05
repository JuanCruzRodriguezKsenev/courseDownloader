// Humo en jsdom para el modo índice del editor de adopción (H-6)
// Ejecuta el HTML y JS real del editor interactuando con el backend real en memoria.

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { crearManejadorEditor } from "./editor.js";
import { guardarVisto, limpiarVistos } from "../destino/vistos.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";
import { resolverCarpeta as resolverCarpetaCore, nombreSubcarpetaTema as nombreSubcarpetaTemaCore } from "../../core/destino/carpetas.ts";


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
    archivos: {
      "google-classroom:q5_ya": {
        md5: "abc12345",
        curso: "google-classroom:c_nuevo",
        archivo: "ya_descargado.pdf",
        ruta: "Teorias",
        nombre: "ya_descargado.pdf",
      },
    },
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
      { idArchivo: "q3_h1", original: "apunte1.pdf", tema: "Teoría" },
      { idArchivo: "q4_h2", original: "apunte2.pdf", tema: "Teoría" },
      { idArchivo: "q5_ya", original: "ya_descargado.pdf", tema: "Teoría" },
      { idArchivo: "q6_om", original: "otro_omitido.pdf", tema: "Teoría" },
      { idArchivo: "q7_nov", original: "cronograma.pdf", tema: "Novedades" },
      { idArchivo: "q8_clash", original: "cuestionario.pdf", tema: "Laboratorio", publicacion: "Laboratorio 1" },
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

  // 1b. Comprobación C-6 (D-6): desmarcar y volver a marcar .topic-check no altera DATOS.temas ni agrega claves con _
  const temasInicialJson = dom.window.eval("JSON.stringify(DATOS.temas)");
  const topicCheck = doc.querySelector(".topic-check");
  if (!topicCheck) {
    errores.push("No se encontró .topic-check para probar alternancia");
  } else {
    topicCheck.checked = false;
    topicCheck.dispatchEvent(new dom.window.Event("change"));
    topicCheck.checked = true;
    topicCheck.dispatchEvent(new dom.window.Event("change"));

    const temasFinalJson = dom.window.eval("JSON.stringify(DATOS.temas)");
    if (temasFinalJson !== temasInicialJson) {
      errores.push(`DATOS.temas cambió tras desmarcar y marcar: inicial ${temasInicialJson} vs final ${temasFinalJson}`);
    }

    const temasActuales = dom.window.eval("DATOS.temas");
    for (const tema of temasActuales) {
      const clavesGuionBajo = Object.keys(tema).filter((k) => k.startsWith("_"));
      if (clavesGuionBajo.length > 0) {
        errores.push(`tema contiene claves que empiezan con _: ${clavesGuionBajo.join(", ")}`);
      }
    }
  }

  // 1c. Comprobación Plan 17 (D-1..D-5): Botón '↺ Que hereden' y regla del dueño contra cascadear
  // Marcar q6_om como omitir
  const selectQ6 = doc.querySelector("[id='sel-acc-google-classroom:q6_om']");
  if (selectQ6) {
    selectQ6.value = "omitir";
    selectQ6.dispatchEvent(new dom.window.Event("change"));
  }

  // Asignar override "." a q3_h1 y q4_h2
  const selectDestQ3 = doc.querySelector(".file-dest-select[data-clave='google-classroom:q3_h1']");
  if (selectDestQ3) {
    selectDestQ3.value = ".";
    selectDestQ3.dispatchEvent(new dom.window.Event("change"));
  }
  const selectDestQ4 = doc.querySelector(".file-dest-select[data-clave='google-classroom:q4_h2']");
  if (selectDestQ4) {
    selectDestQ4.value = ".";
    selectDestQ4.dispatchEvent(new dom.window.Event("change"));
  }

  // Afirmar antes del clic que los dos tienen destinoPropio === "."
  const archQ3Pre = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q3_h1')");
  const archQ4Pre = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q4_h2')");
  const archQ5Pre = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q5_ya')");
  const archQ6Pre = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q6_om')");

  if (archQ3Pre?.destinoPropio !== "." || archQ4Pre?.destinoPropio !== ".") {
    errores.push(`Esperado destinoPropio === "." antes del clic, obtenido: q3=${archQ3Pre?.destinoPropio}, q4=${archQ4Pre?.destinoPropio}`);
  }
  if (archQ5Pre?.accion !== "ya-esta") {
    errores.push(`Esperada accion === "ya-esta" para q5_ya, obtenida: ${archQ5Pre?.accion}`);
  }
  if (archQ6Pre?.accion !== "omitir") {
    errores.push(`Esperada accion === "omitir" para q6_om, obtenida: ${archQ6Pre?.accion}`);
  }

  // Tocar .btn-heredar-carpeta
  const btnHeredar = doc.querySelector(".btn-heredar-carpeta[data-tema='Teoría']");
  if (!btnHeredar) {
    errores.push("No se encontró .btn-heredar-carpeta para el tema Teoría");
  } else {
    btnHeredar.click();
  }

  // Tras el clic: los dos tienen destinoPropio === "" y carpeta resuelta a Teorias; el ya-esta y el omitido no cambian; el botón queda deshabilitado
  const archQ3Post = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q3_h1')");
  const archQ4Post = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q4_h2')");
  const archQ5Post = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q5_ya')");
  const archQ6Post = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q6_om')");

  if (archQ3Post?.destinoPropio !== "" || archQ3Post?.carpeta !== "Teorias/Teoria") {
    errores.push(`q3_h1 tras heredar: esperado destinoPropio="" y carpeta="Teorias/Teoria", obtenido destinoPropio="${archQ3Post?.destinoPropio}", carpeta="${archQ3Post?.carpeta}"`);
  }
  if (archQ4Post?.destinoPropio !== "" || archQ4Post?.carpeta !== "Teorias/Teoria") {
    errores.push(`q4_h2 tras heredar: esperado destinoPropio="" y carpeta="Teorias/Teoria", obtenido destinoPropio="${archQ4Post?.destinoPropio}", carpeta="${archQ4Post?.carpeta}"`);
  }

  if (archQ5Post?.accion !== "ya-esta") {
    errores.push(`q5_ya alterado tras heredar: accion="${archQ5Post?.accion}"`);
  }
  if (archQ6Post?.accion !== "omitir") {
    errores.push(`q6_om alterado tras heredar: accion="${archQ6Post?.accion}"`);
  }

  const btnHeredarPost = doc.querySelector(".btn-heredar-carpeta[data-tema='Teoría']");
  if (!btnHeredarPost || !btnHeredarPost.disabled) {
    errores.push("El botón .btn-heredar-carpeta debería quedar deshabilitado cuando ningún archivo tiene override");
  }

  // Regla del dueño: cambiar .topic-dest-select a otra carpeta NO altera el destinoPropio de ningún archivo
  const selDestQ3Override = doc.querySelector(".file-dest-select[data-clave='google-classroom:q3_h1']");
  if (selDestQ3Override) {
    selDestQ3Override.value = ".";
    selDestQ3Override.dispatchEvent(new dom.window.Event("change"));
  }
  const topicDestSelect = doc.querySelector(".topic-dest-select[data-tema='Teoría']");
  if (topicDestSelect) {
    topicDestSelect.value = "Practicas";
    topicDestSelect.dispatchEvent(new dom.window.Event("change"));
  }
  const archQ3TrasCambioTema = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q3_h1')");
  if (archQ3TrasCambioTema?.destinoPropio !== ".") {
    errores.push(`Regla del dueño violada: cambiar carpeta del tema alteró destinoPropio de q3_h1 a "${archQ3TrasCambioTema?.destinoPropio}"`);
  }
  // Restaurar q3_h1 para que vuelva a heredar y volver el tema a Teorias
  const btnHeredarRestaurar = doc.querySelector(".btn-heredar-carpeta[data-tema='Teoría']");
  if (btnHeredarRestaurar) {
    btnHeredarRestaurar.click();
  }
  if (topicDestSelect) {
    topicDestSelect.value = "Teorias";
    topicDestSelect.dispatchEvent(new dom.window.Event("change"));
  }

  // 1d. Comprobación Plan 20: Subcarpeta por tema (AC-8, AC-11..15)
  // AC-8: Casilla encendida por defecto y ruta en vivo con /Teoria/
  const subCheckTeoria = doc.querySelector(".topic-subfolder-check[data-tema='Teoría']");
  if (!subCheckTeoria) {
    errores.push("No se encontró .topic-subfolder-check para Teoría");
  } else {
    if (!subCheckTeoria.checked || subCheckTeoria.disabled) {
      errores.push(`AC-8: casilla subcarpeta de Teoría debería estar encendida y habilitada, obtenido checked=${subCheckTeoria.checked}, disabled=${subCheckTeoria.disabled}`);
    }
    const rutaInicialQ1 = dom.window.eval("computeLivePath(getActiveCurso(), DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Teoría'), DATOS.archivos.find(a => a.clave === 'google-classroom:q1'))");
    if (!rutaInicialQ1.includes("/Teoria/")) {
      errores.push(`AC-8: ruta en vivo inicial debería incluir /Teoria/, obtenido "${rutaInicialQ1}"`);
    }

    // Apagar la casilla
    subCheckTeoria.checked = false;
    subCheckTeoria.dispatchEvent(new dom.window.Event("change"));
    const rutaSinSubQ1 = dom.window.eval("computeLivePath(getActiveCurso(), DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Teoría'), DATOS.archivos.find(a => a.clave === 'google-classroom:q1'))");
    if (rutaSinSubQ1.includes("/Teoria/")) {
      errores.push(`AC-8: ruta en vivo con casilla apagada no debería incluir /Teoria/, obtenido "${rutaSinSubQ1}"`);
    }

    // Reencender la casilla
    const subCheckTeoriaRe = doc.querySelector(".topic-subfolder-check[data-tema='Teoría']");
    if (subCheckTeoriaRe) {
      subCheckTeoriaRe.checked = true;
      subCheckTeoriaRe.dispatchEvent(new dom.window.Event("change"));
    }
    const rutaConSubQ1 = dom.window.eval("computeLivePath(getActiveCurso(), DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Teoría'), DATOS.archivos.find(a => a.clave === 'google-classroom:q1'))");
    if (!rutaConSubQ1.includes("/Teoria/")) {
      errores.push(`AC-8: ruta en vivo tras reencender debería incluir /Teoria/, obtenido "${rutaConSubQ1}"`);
    }
  }

  // AC-12: Interruptor del curso
  const subCheckNov = doc.querySelector(".topic-subfolder-check[data-tema='Novedades']");
  if (!subCheckNov || !subCheckNov.disabled) {
    errores.push("AC-12: casilla de Novedades con destino '.' debería estar deshabilitada");
  }
  const btnToggleSub = doc.getElementById("btnToggleSubcarpetasCurso");
  if (!btnToggleSub) {
    errores.push("AC-12: no se encontró #btnToggleSubcarpetasCurso");
  } else {
    // Todos los elegibles están encendidos -> clic los apaga a todos
    btnToggleSub.click();
    const temaTeoriaOff = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Teoría')");
    const temaLabOff = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Laboratorio')");
    if (temaTeoriaOff?.subcarpeta !== "no" || temaLabOff?.subcarpeta !== "no") {
      errores.push(`AC-12: interruptor debería haber apagado los temas elegibles, obtenidos Teoria=${temaTeoriaOff?.subcarpeta}, Lab=${temaLabOff?.subcarpeta}`);
    }
    const subCheckNovTrasOff = doc.querySelector(".topic-subfolder-check[data-tema='Novedades']");
    if (!subCheckNovTrasOff || !subCheckNovTrasOff.disabled) {
      errores.push("AC-12: casilla de Novedades sigue debiendo estar deshabilitada tras toggle");
    }

    // Clic de nuevo -> los enciende
    btnToggleSub.click();
    const temaTeoriaOn = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Teoría')");
    const temaLabOn = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Laboratorio')");
    if (temaTeoriaOn?.subcarpeta !== "si" || temaLabOn?.subcarpeta !== "si") {
      errores.push(`AC-12: interruptor debería haber reencendido los temas elegibles, obtenidos Teoria=${temaTeoriaOn?.subcarpeta}, Lab=${temaLabOn?.subcarpeta}`);
    }
  }

  // AC-13: Omitir y des-omitir
  const chkLab = doc.querySelector(".topic-check[data-tema='Laboratorio']");
  if (!chkLab) {
    errores.push("AC-13: no se encontró .topic-check para Laboratorio");
  } else {
    // Omitir tema
    chkLab.checked = false;
    chkLab.dispatchEvent(new dom.window.Event("change"));
    const temaLabOmitido = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Laboratorio')");
    if (temaLabOmitido?.destino !== "-") {
      errores.push(`AC-13: esperado destino='-' al omitir tema, obtenido '${temaLabOmitido?.destino}'`);
    }
    const subCheckLabOmitido = doc.querySelector(".topic-subfolder-check[data-tema='Laboratorio']");
    if (!subCheckLabOmitido?.disabled) {
      errores.push("AC-13: casilla de subcarpeta debería estar deshabilitada con tema omitido");
    }

    // Des-omitir tema
    chkLab.checked = true;
    chkLab.dispatchEvent(new dom.window.Event("change"));
    const temaLabActivo = dom.window.eval("DATOS.temas.find(t => t.clave_curso === 'google-classroom:c_nuevo' && t.tema === 'Laboratorio')");
    if (temaLabActivo?.destino !== "Laboratorios" || temaLabActivo?.subcarpeta !== "si") {
      errores.push(`AC-13: tema debería recuperar destino='Laboratorios' y subcarpeta='si', obtenido destino='${temaLabActivo?.destino}', subcarpeta='${temaLabActivo?.subcarpeta}'`);
    }
  }


  // AC-15: Choques con ruta completa (q2 en Teoría vs q8_clash en Laboratorio, mismo nombre 'cuestionario.pdf')
  dom.window.eval("recalcularChoques()");
  const choqueQ2 = dom.window.eval("FILAS_CON_CHOQUE.has('google-classroom:q2')");
  const choqueQ8 = dom.window.eval("FILAS_CON_CHOQUE.has('google-classroom:q8_clash')");
  if (choqueQ2 || choqueQ8) {
    errores.push(`AC-15: q2 y q8_clash no deberían chocar porque sus subcarpetas difieren (Teoria vs Laboratorio), obtenido q2=${choqueQ2}, q8=${choqueQ8}`);
  }

  // AC-14: Paridad editor vs core
  const casosParidad = [
    { dest: "Teorias", doc: "Gomez", tema: "Series" },
    { dest: "Teorias", doc: "", tema: "Series" },
    { dest: "Teorias", doc: null, tema: "Series" },
    { dest: "Practicas", doc: null, tema: "Guía 1" },
    { dest: ".", doc: null, tema: "Series" },
    { dest: "-", doc: null, tema: "Series" },
    { dest: "Teorias", doc: null, tema: "Novedades" },
    { dest: "Teorias", doc: null, tema: "Sin tema" },
    { dest: "Teorias", doc: null, tema: "???" },
    { dest: "Teorias", doc: "Rey Grange", tema: "Clases teóricas - Módulo I" },
    { dest: "Practicas", doc: null, tema: "TP 1: Límites / Derivadas" },
    { dest: "Teorias", doc: null, tema: ".." },
  ];
  for (const c of casosParidad) {
    const resCore = resolverCarpetaCore(c.dest, c.doc, c.tema);
    const resEditor = dom.window.eval(`resolverCarpeta(${JSON.stringify(c.dest)}, ${JSON.stringify(c.doc)}, ${JSON.stringify(c.tema)})`);
    if (resEditor !== resCore) {
      errores.push(`AC-14 fallo de paridad resolverCarpeta: dest=${c.dest}, doc=${c.doc}, tema=${c.tema} -> editor="${resEditor}" vs core="${resCore}"`);
    }
  }

  const temasParidad = [
    "series",
    "Clases teóricas - Módulo I",
    "TP 1: Límites / Derivadas",
    "..",
    "Novedades",
    "Sin tema",
    "???",
  ];
  for (const t of temasParidad) {
    const subCore = nombreSubcarpetaTemaCore(t);
    const subEditor = dom.window.eval(`nombreSubcarpetaTema(${JSON.stringify(t)})`);
    if (subEditor !== subCore) {
      errores.push(`AC-14 fallo de paridad nombreSubcarpetaTema: "${t}" -> editor="${subEditor}" vs core="${subCore}"`);
    }
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

  // 3b. Asignar nueva carpeta personalizada a q1
  dom.window.prompt = () => "Talleres";
  const selectDestQ1 = doc.querySelector(".file-dest-select[data-clave='google-classroom:q1']");
  if (!selectDestQ1) {
    errores.push("No se encontró file-dest-select para google-classroom:q1");
  } else {
    selectDestQ1.value = "__nueva__";
    selectDestQ1.dispatchEvent(new dom.window.Event("change"));
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
    if (cursoNuevo.temas["Teoría"] !== "Teorias/Gomez/Teoria") {
      errores.push(`Tema Teoría esperado Teorias/Gomez/Teoria, obtenido: ${cursoNuevo.temas["Teoría"]}`);
    }

    if (!cursoNuevo.nombres || cursoNuevo.nombres["google-classroom:q1"] !== "01_tabla_periodica_personalizada.pdf") {
      errores.push(`Nombre editado no figura en curso.nombres: ${JSON.stringify(cursoNuevo.nombres)}`);
    }
    if (!cursoNuevo.carpetas || cursoNuevo.carpetas["google-classroom:q1"] !== "Talleres") {
      errores.push(`q1 no figura con carpeta Talleres en curso.carpetas: ${JSON.stringify(cursoNuevo.carpetas)}`);
    }
    if (cursoNuevo.carpetas && ("google-classroom:q3_h1" in cursoNuevo.carpetas || "google-classroom:q4_h2" in cursoNuevo.carpetas)) {
      errores.push(`Archivos que heredan figuran indebidamente en curso.carpetas: ${JSON.stringify(cursoNuevo.carpetas)}`);
    }
    if (!cursoNuevo.omitidos || !cursoNuevo.omitidos.includes("google-classroom:q2")) {
      errores.push(`q2 no figura en curso.omitidos: ${JSON.stringify(cursoNuevo.omitidos)}`);
    }
  }

  const cursoPrevio = indiceGuardado.cursos["google-classroom:c_asociado"];
  if (!cursoPrevio || cursoPrevio.materia !== "Ingenieria/Fisica 2") {
    errores.push("El curso previamente asociado no se conservó intacto");
  }

  // 7. Pruebas del Plan 19: Borrador local y remoción de beforeunload (P-5)
  // 7a. Sin beforeunload (D-1)
  const tipoBeforeUnload = dom.window.eval("typeof window.onbeforeunload");
  if (tipoBeforeUnload !== "object") {
    errores.push(`window.onbeforeunload esperado 'object', obtenido '${tipoBeforeUnload}'`);
  }
  const eventoBU = new dom.window.Event("beforeunload", { cancelable: true });
  dom.window.dispatchEvent(eventoBU);
  if (eventoBU.defaultPrevented) {
    errores.push("beforeunload fue prevenido a pesar de haberse quitado el listener (D-1)");
  }

  // 7b. Guarda con debounce de 500 ms (D-2)
  const clave = dom.window.eval("claveBorrador()");
  const valorOriginal = dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q1').nombre");
  dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q1').nombre = 'nombre_borrador_test.pdf'; marcarCambio();");
  if (dom.window.localStorage.getItem(clave) !== null) {
    errores.push("El borrador se guardó de inmediato sin respetar el debounce de 500ms");
  }
  await new Promise((r) => setTimeout(r, 600));
  const rawBorrador = dom.window.localStorage.getItem(clave);
  if (!rawBorrador) {
    errores.push("El borrador no se guardó en localStorage tras 600ms de debounce");
  } else {
    const parsed = JSON.parse(rawBorrador);
    const archGuardado = parsed.datos?.archivos?.find((a) => a.clave === "google-classroom:q1");
    if (archGuardado?.nombre !== "nombre_borrador_test.pdf") {
      errores.push(`Borrador guardado no refleja el cambio: ${archGuardado?.nombre}`);
    }
  }

  // 7c. Borra al volver al estado inicial (D-7)
  dom.window.eval(`DATOS.archivos.find(a => a.clave === 'google-classroom:q1').nombre = ${JSON.stringify(valorOriginal)}; marcarCambio();`);
  if (dom.window.eval("HAY_CAMBIOS") !== false) {
    errores.push("HAY_CAMBIOS no volvió a false al restaurar valor original");
  }
  if (dom.window.localStorage.getItem(clave) !== null) {
    errores.push("El borrador no se borró de localStorage al volver al estado inicial");
  }

  // 7d. Borra al guardar (D-7)
  dom.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q1').nombre = 'otro_cambio_a_guardar.pdf'; marcarCambio();");
  await new Promise((r) => setTimeout(r, 600));
  if (!dom.window.localStorage.getItem(clave)) {
    errores.push("No se guardó el borrador previo a ejecutarGuardar");
  }
  await dom.window.eval("ejecutarGuardar()");
  if (dom.window.localStorage.getItem(clave) !== null) {
    errores.push("El borrador no se borró tras ejecutarGuardar() con éxito");
  }

  // 7e. Restaura (base igual, D-5)
  // Obtener el estado inicial exacto que devolverá el servidor para domRestaura
  const resDatosServidor = await manejar(
    new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice&curso=google-classroom:c_nuevo"),
    new URL("http://127.0.0.1:3002/adopcion/api/datos?modo=indice&curso=google-classroom:c_nuevo")
  );
  const datosServidor = await resDatosServidor.json();
  for (const c of datosServidor.cursos) {
    c._inicialmenteNuevo = (!c.materia || c.materia.trim().length === 0);
  }
  const jsonBaseServidor = JSON.stringify({
    cursos: datosServidor.cursos,
    temas: datosServidor.temas,
    archivos: datosServidor.archivos,
  });

  function calcularHashCorto(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(16);
  }

  const baseCorrecta = calcularHashCorto(jsonBaseServidor);
  const datosConCambio = JSON.parse(jsonBaseServidor);
  const archCNuevo = datosConCambio.archivos.find((a) => a.clave === "google-classroom:q1");
  if (archCNuevo) archCNuevo.nombre = "restaurado_desde_borrador.pdf";

  const borradorValido = {
    base: baseCorrecta,
    datos: datosConCambio,
    ts: Date.now() - 60000,
  };

  const domRestaura = new JSDOM(html, {
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
      w.localStorage.setItem("adopcion-borrador:/adopcion/?modo=indice&curso=google-classroom:c_nuevo", JSON.stringify(borradorValido));
    },
  });
  await new Promise((r) => setTimeout(r, 400));

  const bannerRestaura = domRestaura.window.document.getElementById("banner-borrador");
  if (!bannerRestaura || !bannerRestaura.classList.contains("visible")) {
    errores.push("El banner de borrador no es visible al cargar con base coincidente");
  }
  const btnRestaurar = domRestaura.window.document.getElementById("btn-restaurar-borrador");
  if (!btnRestaurar) {
    errores.push("No se encontró btn-restaurar-borrador");
  } else {
    btnRestaurar.click();
    const hayCambiosTrasRestaurar = domRestaura.window.eval("HAY_CAMBIOS");
    if (!hayCambiosTrasRestaurar) {
      errores.push("HAY_CAMBIOS no quedó en true tras restaurar borrador");
    }
    const nombreEnDatos = domRestaura.window.eval("DATOS.archivos.find(a => a.clave === 'google-classroom:q1')?.nombre");
    if (nombreEnDatos !== "restaurado_desde_borrador.pdf") {
      errores.push(`El cambio no se reflejó en DATOS tras restaurar: ${nombreEnDatos}`);
    }
    if (bannerRestaura.classList.contains("visible")) {
      errores.push("El banner de borrador no se ocultó tras restaurar");
    }
  }

  // 7f. Descarta (base distinta, D-6)
  const borradorBaseDistinta = {
    base: "base_invalida_1234",
    datos: datosConCambio,
    ts: Date.now() - 120000,
  };
  const domDescarta = new JSDOM(html, {
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
      w.localStorage.setItem("adopcion-borrador:/adopcion/?modo=indice&curso=google-classroom:c_nuevo", JSON.stringify(borradorBaseDistinta));
    },
  });
  await new Promise((r) => setTimeout(r, 400));

  const bannerDescarta = domDescarta.window.document.getElementById("banner-borrador");
  if (bannerDescarta && bannerDescarta.classList.contains("visible")) {
    errores.push("El banner de borrador se mostró a pesar de tener base distinta");
  }
  const claveDescarta = domDescarta.window.eval("claveBorrador()");
  if (domDescarta.window.localStorage.getItem(claveDescarta) !== null) {
    errores.push("La clave de borrador no fue borrada al detectar base distinta");
  }
  const toastEl = domDescarta.window.document.getElementById("toast");
  if (!toastEl || !toastEl.textContent.includes("Se descartó un borrador viejo")) {
    errores.push(`El toast no anunció el descarte de borrador viejo: ${toastEl?.textContent}`);
  }

  // 7g. Sin localStorage (D-8)
  const domSinStorage = new JSDOM(html, {
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
      Object.defineProperty(w, "localStorage", {
        get() { throw new Error("localStorage no disponible"); },
      });
    },
  });
  await new Promise((r) => setTimeout(r, 400));
  try {
    domSinStorage.window.eval("marcarCambio()");
  } catch (err) {
    errores.push(`marcarCambio lanzó sin localStorage: ${err.message}`);
  }

} finally {
  limpiarVistos();
  fs.rmSync(dirRaiz, { recursive: true, force: true });
  fs.rmSync(dirSalida, { recursive: true, force: true });
}

console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
