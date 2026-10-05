// Humo en jsdom para Plan 24: filtros y orden en editor de adopción
// Verifica los criterios AC-1 a AC-16 según docs/specs/editor-filtros-orden/spec.md

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

const dirRaiz = fs.mkdtempSync(path.join(os.tmpdir(), "humo-filtros-orden-raiz-"));
const dirSalida = fs.mkdtempSync(path.join(os.tmpdir(), "humo-filtros-orden-salida-"));

try {
  limpiarVistos();

  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Curso A/Teorias/Palacio"), { recursive: true });
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Curso A/Clases/10"), { recursive: true });
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Curso A/Clases/02"), { recursive: true });

  const indiceInicial = {
    version: 1,
    cursos: {
      "google-classroom:c_a": {
        nombre: "Curso A",
        materia: "Ingenieria/Curso A",
        docente: "Palacio",
        temas: {
          "Clase 10": "Clases/10",
          "clase 2": "Clases/02",
          "Anuncios": ".",
          "Teoría": "Teorias/Palacio",
          "Tema Omitido": "-",
        },
      },
      "google-classroom:c_b": {
        nombre: "Curso B",
        materia: "Ingenieria/Curso B",
        docente: "",
        temas: {},
      },
      "google-classroom:c_c": {
        nombre: "Curso C",
        materia: "Ingenieria/Curso C",
        docente: "",
        temas: {},
      },
    },
    archivos: {
      "google-classroom:ya_esta_1": {
        md5: "abc12345",
        curso: "google-classroom:c_a",
        archivo: "ya_esta.pdf",
        ruta: "Anuncios",
        nombre: "ya_esta.pdf",
      },
    },
  };
  fs.writeFileSync(path.join(dirRaiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_a", nombre: "Curso A" },
    items: [
      // En «Teoría»: 3 videollamadas + a.pdf + b.PDF + c.docx + sala (sin extensión) + extra.pdf (8 filas)
      { idArchivo: "acceso:https%3A%2F%2Fmeet.google.com%2Faaa:Meet 1", original: "Meet 1", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fus04web.zoom.us%2Fj%2F111:Zoom 1", original: "Zoom 1", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fteams.live.com%2Fmeet%2F222:Teams 1", original: "Teams 1", tema: "Teoría" },
      { idArchivo: "f_apdf", original: "a.pdf", tema: "Teoría" },
      { idArchivo: "f_bpdf", original: "b.PDF", tema: "Teoría" },
      { idArchivo: "f_cdocx", original: "c.docx", tema: "Teoría" },
      { idArchivo: "f_sala", original: "sala", tema: "Teoría" },
      { idArchivo: "f_extra", original: "extra.pdf", tema: "Teoría" },

      // En «Clase 10»: dos filas con choque (mismo nombre apunte.pdf en Clases/10)
      { idArchivo: "ch1", original: "apunte.pdf", tema: "Clase 10" },
      { idArchivo: "ch2", original: "apunte.pdf", tema: "Clase 10" },

      // En «clase 2»: a10.pdf, a2.pdf, A.docx, b.pdf
      { idArchivo: "f_a10", original: "a10.pdf", tema: "clase 2" },
      { idArchivo: "f_a2", original: "a2.pdf", tema: "clase 2" },
      { idArchivo: "f_ad", original: "A.docx", tema: "clase 2" },
      { idArchivo: "f_b", original: "b.pdf", tema: "clase 2" },

      // En «Anuncios»: aviso.txt + ya_esta_1 (ya en disco)
      { idArchivo: "an1", original: "aviso.txt", tema: "Anuncios" },
      { idArchivo: "ya_esta_1", original: "ya_esta.pdf", tema: "Anuncios" },

      // En «Tema Omitido»: omitido.pdf
      { idArchivo: "om1", original: "omitido.pdf", tema: "Tema Omitido" },

      // En «Material de parciales»: parcial1.pdf (sin regla)
      { idArchivo: "parc1", original: "parcial1.pdf", tema: "Material de parciales" },
    ],
  });

  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_b", nombre: "Curso B" },
    items: [
      { idArchivo: "b1", original: "b1.pdf", tema: "Tema B1" },
      { idArchivo: "b2", original: "b2.pdf", tema: "Tema B2" },
    ],
  });

  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_c", nombre: "Curso C" },
    items: [
      { idArchivo: "c1", original: "c1.pdf", tema: "Tema C1" },
    ],
  });

  const manejar = crearManejadorEditor({ raiz: dirRaiz, salida: dirSalida, puerto: 3002 }, "/adopcion");

  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:3002/adopcion/?modo=indice&curso=google-classroom:c_a",
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

  await new Promise((r) => setTimeout(r, 400));
  const doc = dom.window.document;

  const contadoresIniciales = {
    all: doc.getElementById("cntAll").textContent,
    ready: doc.getElementById("cntReady").textContent,
    review: doc.getElementById("cntReview").textContent,
    unassigned: doc.getElementById("cntUnassigned").textContent,
    omitted: doc.getElementById("cntOmitted").textContent,
    clash: doc.getElementById("cntClash").textContent,
  };
  function verificarContadores(etiqueta) {
    for (const [k, v] of Object.entries(contadoresIniciales)) {
      const id = "cnt" + k.charAt(0).toUpperCase() + k.slice(1);
      const actual = doc.getElementById(id).textContent;
      if (actual !== v) {
        errores.push(`[AC-5] Contador ${id} cambió en ${etiqueta}: inicial=${v}, actual=${actual}`);
      }
    }
  }

  // AC-1: videollamadas
  const selMostrar = doc.getElementById("selMostrar");
  selMostrar.value = "videollamadas";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-1 videollamadas");

  const artTeoria = doc.querySelector('article[data-tema="Teoría"]');
  if (!artTeoria) {
    errores.push("[AC-1] No se encontró el tema Teoría");
  } else {
    const drilldown = artTeoria.querySelector(".files-drilldown");
    if (drilldown.hasAttribute("hidden")) {
      errores.push("[AC-1] El tema Teoría no quedó expandido");
    }
    const filas = artTeoria.querySelectorAll("tbody tr");
    if (filas.length !== 3) {
      errores.push(`[AC-1] Teoría debería mostrar 3 videollamadas, muestra ${filas.length}`);
    }
    filas.forEach((f) => {
      if (!f.textContent.includes("📹 Videollamada")) {
        errores.push("[AC-1] Fila mostrada en videollamadas no tiene chip de videollamada");
      }
    });
  }
  const artAnuncios = doc.querySelector('article[data-tema="Anuncios"]');
  if (artAnuncios) {
    errores.push("[AC-1] El tema Anuncios no debería aparecer con filtro videollamadas");
  }

  // AC-2: filtrar por acción
  selMostrar.value = "copiar";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-2 copiar");
  const filasCopiar = doc.querySelectorAll("tbody tr");
  for (const f of filasCopiar) {
    const selAcc = f.querySelector(".sel-acc-sync");
    if (selAcc && selAcc.value !== "copiar") {
      errores.push(`[AC-2] Fila visible no es 'copiar': ${selAcc.value}`);
    }
  }

  selMostrar.value = "omitidas";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-2 omitidas");
  const filaOmitido = doc.querySelector('tr[data-clave="google-classroom:om1"]');
  if (!filaOmitido) {
    errores.push("[AC-2] Fila om1 de tema omitido no aparece en 'Omitidas'");
  }
  for (const f of doc.querySelectorAll("tbody tr")) {
    const isDownloaded = f.classList.contains("row-descargado");
    const isOmitted = f.classList.contains("row-omitted");
    if (!isOmitted || isDownloaded) {
      errores.push("[AC-2] Fila visible en 'Omitidas' no es omitida");
    }
  }

  selMostrar.value = "ya-esta";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-2 ya-esta");
  const filasYaEsta = doc.querySelectorAll("tbody tr");
  if (filasYaEsta.length !== 1 || !filasYaEsta[0].classList.contains("row-descargado")) {
    errores.push(`[AC-2] 'Ya en disco' debería mostrar 1 fila descargada, muestra ${filasYaEsta.length}`);
  }

  // AC-3: filtrar por tipo
  selMostrar.value = "todas";
  selMostrar.dispatchEvent(new dom.window.Event("change"));

  const selTipo = doc.getElementById("selTipo");
  const optsTipo = Array.from(selTipo.options).map((o) => o.textContent);
  if (!optsTipo.includes("Todos") || !optsTipo.includes("docx") || !optsTipo.includes("pdf") || !optsTipo.includes("(sin extensión)")) {
    errores.push(`[AC-3] Opciones de Tipo incorrectas: ${JSON.stringify(optsTipo)}`);
  }
  const idxDocx = optsTipo.indexOf("docx");
  const idxPdf = optsTipo.indexOf("pdf");
  const idxSin = optsTipo.indexOf("(sin extensión)");
  if (idxDocx >= idxPdf || idxPdf >= idxSin) {
    errores.push(`[AC-3] Orden de tipos incorrecto: docx(${idxDocx}), pdf(${idxPdf}), sin(${idxSin})`);
  }

  selTipo.value = "pdf";
  selTipo.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-3 tipo pdf");
  const filasPdfTeoria = doc.querySelectorAll('article[data-tema="Teoría"] tbody tr');
  const nombresOrig = Array.from(filasPdfTeoria).map((f) => f.querySelector(".file-orig")?.textContent);
  if (!nombresOrig.includes("a.pdf") || !nombresOrig.includes("b.PDF")) {
    errores.push(`[AC-3] En Teoría deberían verse a.pdf y b.PDF, se ven: ${JSON.stringify(nombresOrig)}`);
  }
  if (nombresOrig.includes("c.docx") || nombresOrig.includes("sala")) {
    errores.push(`[AC-3] En Teoría se filtró erróneamente c.docx o sala: ${JSON.stringify(nombresOrig)}`);
  }

  // AC-4: combinación acción + tipo + chip
  selMostrar.value = "copiar";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  selTipo.value = "pdf";
  selTipo.dispatchEvent(new dom.window.Event("change"));
  const chipReview = doc.querySelector('.stat-chip[data-filter="review"]');
  chipReview.click();
  verificarContadores("AC-4 combinación");

  const articulosVisibles = doc.querySelectorAll("article.topic-card");
  for (const art of articulosVisibles) {
    const temaNom = art.dataset.tema;
    const esReview = art.classList.contains("has-warning") || art.classList.contains("has-clash");
    if (!esReview) {
      errores.push(`[AC-4] Tema ${temaNom} no califica para review y está visible`);
    }
    const filas = art.querySelectorAll("tbody tr");
    for (const f of filas) {
      const orig = f.querySelector(".file-orig")?.textContent || "";
      const selAcc = f.querySelector(".sel-acc-sync");
      if (!orig.toLowerCase().endsWith(".pdf")) {
        errores.push(`[AC-4] Fila ${orig} no es pdf`);
      }
      if (selAcc && selAcc.value !== "copiar") {
        errores.push(`[AC-4] Fila ${orig} no es copiar`);
      }
    }
  }

  // AC-6: búsqueda por carpeta destino
  const btnLimpiar = doc.getElementById("btnLimpiarVista");
  btnLimpiar.click();

  const inpBusqueda = doc.getElementById("filtro-texto-archivos");
  inpBusqueda.value = "palacio";
  inpBusqueda.dispatchEvent(new dom.window.Event("input"));
  verificarContadores("AC-6 busqueda palacio");

  const artTeoriaPalacio = doc.querySelector('article[data-tema="Teoría"]');
  if (!artTeoriaPalacio) {
    errores.push("[AC-6] Búsqueda por 'palacio' no encontró el tema Teoría");
  }

  // AC-7: orden de temas A→Z, Z→A, Como vienen
  btnLimpiar.click();
  const selOrdenTemas = doc.getElementById("selOrdenTemas");

  selOrdenTemas.value = "az";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-7 az");
  const temasAZ = Array.from(doc.querySelectorAll("article.topic-card")).map((a) => a.dataset.tema);
  if (temasAZ[0] !== "Anuncios" || temasAZ[1] !== "clase 2" || temasAZ[2] !== "Clase 10") {
    errores.push(`[AC-7] Orden A→Z incorrecto: ${JSON.stringify(temasAZ)}`);
  }

  selOrdenTemas.value = "za";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-7 za");
  const temasZA = Array.from(doc.querySelectorAll("article.topic-card")).map((a) => a.dataset.tema);
  if (temasZA[temasZA.length - 1] !== "Anuncios") {
    errores.push(`[AC-7] Orden Z→A incorrecto: ${JSON.stringify(temasZA)}`);
  }

  selOrdenTemas.value = "vienen";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-7 vienen");
  const temasVienen = Array.from(doc.querySelectorAll("article.topic-card")).map((a) => a.dataset.tema);
  if (temasVienen[0] !== "Clase 10" || temasVienen[1] !== "clase 2") {
    errores.push(`[AC-7] Orden Como vienen no restauró orden original: ${JSON.stringify(temasVienen)}`);
  }

  // AC-8: más archivos primero y problemas primero
  btnLimpiar.click();
  selOrdenTemas.value = "mas-archivos";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-8 mas-archivos");
  const primerTemaMasArchivos = doc.querySelector("article.topic-card")?.dataset.tema;
  if (primerTemaMasArchivos !== "Teoría") {
    errores.push(`[AC-8] 'Más archivos primero' debería tener 'Teoría' primero (8 archivos), tiene: '${primerTemaMasArchivos}'`);
  }

  selOrdenTemas.value = "problemas";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-8 problemas");
  const primerosTemas = Array.from(doc.querySelectorAll("article.topic-card")).slice(0, 2).map((a) => a.dataset.tema);
  if (!primerosTemas.includes("Clase 10") || !primerosTemas.includes("Material de parciales")) {
    errores.push(`[AC-8] 'Problemas primero' debería poner Clase 10 y Material de parciales al frente, puso: ${JSON.stringify(primerosTemas)}`);
  }

  // AC-9: orden de archivos por nombre y tipo
  btnLimpiar.click();
  const selOrdenArchivos = doc.getElementById("selOrdenArchivos");

  selOrdenArchivos.value = "nombre";
  selOrdenArchivos.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-9 nombre");
  const filasClase2Nombre = Array.from(doc.querySelectorAll('article[data-tema="clase 2"] tbody tr .file-orig')).map((el) => el.textContent);
  if (filasClase2Nombre[0] !== "A.docx" || filasClase2Nombre[1] !== "a2.pdf" || filasClase2Nombre[2] !== "a10.pdf" || filasClase2Nombre[3] !== "b.pdf") {
    errores.push(`[AC-9] Orden nombre en clase 2 incorrecto: ${JSON.stringify(filasClase2Nombre)}`);
  }

  selOrdenArchivos.value = "tipo";
  selOrdenArchivos.dispatchEvent(new dom.window.Event("change"));
  verificarContadores("AC-9 tipo");
  const filasClase2Tipo = Array.from(doc.querySelectorAll('article[data-tema="clase 2"] tbody tr .file-orig')).map((el) => el.textContent);
  if (filasClase2Tipo[0] !== "A.docx" || filasClase2Tipo[1] !== "a2.pdf" || filasClase2Tipo[2] !== "a10.pdf" || filasClase2Tipo[3] !== "b.pdf") {
    errores.push(`[AC-9] Orden tipo en clase 2 incorrecto: ${JSON.stringify(filasClase2Tipo)}`);
  }

  // AC-14: sólo de vista (sin unsaved) antes de ediciones
  const avisoAntesEdicion = doc.getElementById("aviso-cambios");
  if (avisoAntesEdicion && avisoAntesEdicion.classList.contains("unsaved")) {
    errores.push("[AC-14] aviso-cambios tiene la clase 'unsaved' por usar filtros/orden");
  }
  const hayCambiosAntesEdicion = dom.window.eval("HAY_CAMBIOS");
  if (hayCambiosAntesEdicion) {
    errores.push("[AC-14] HAY_CAMBIOS es true tras usar filtros/orden");
  }

  // AC-10: editar no reordena
  selOrdenArchivos.value = "nombre";
  selOrdenArchivos.dispatchEvent(new dom.window.Event("change"));
  const inputRen = doc.querySelector('article[data-tema="clase 2"] tbody tr:first-child .file-rename-input');
  if (inputRen) {
    const valOriginal = inputRen.value;
    inputRen.value = "ZZZZ_editado.pdf";
    inputRen.dispatchEvent(new dom.window.Event("input"));
    inputRen.dispatchEvent(new dom.window.Event("change"));
    const primeraFilaDespues = doc.querySelector('article[data-tema="clase 2"] tbody tr:first-child .file-orig')?.textContent;
    if (primeraFilaDespues !== "A.docx") {
      errores.push(`[AC-10] Editar nombre movió la fila: primera ahora es '${primeraFilaDespues}'`);
    }
    // Restaurar valor para no dejar estado sucio
    inputRen.value = valOriginal;
    inputRen.dispatchEvent(new dom.window.Event("input"));
    inputRen.dispatchEvent(new dom.window.Event("change"));
    dom.window.eval("setUnsaved(false); HAY_CAMBIOS = false;");
  }

  // AC-11: orden de cursos
  const selOrdenCursos = doc.getElementById("selOrdenCursos");
  selOrdenCursos.value = "revisar";
  selOrdenCursos.dispatchEvent(new dom.window.Event("change"));

  const cursosRevisar = Array.from(doc.querySelectorAll(".course-item")).map((el) => el.dataset.clave);
  const itemCb = doc.querySelector('.course-item[data-clave="google-classroom:c_b"]');
  itemCb?.click();

  if (selOrdenCursos.value !== "revisar") {
    errores.push(`[AC-11] selOrdenCursos no persistió al cambiar de curso: '${selOrdenCursos.value}'`);
  }
  const cursosDespues = Array.from(doc.querySelectorAll(".course-item")).map((el) => el.dataset.clave);
  if (JSON.stringify(cursosRevisar) !== JSON.stringify(cursosDespues)) {
    errores.push("[AC-11] El orden de cursos cambió al seleccionar otro curso");
  }
  doc.querySelector('.course-item[data-clave="google-classroom:c_a"]')?.click();

  // AC-12: Limpiar filtros
  btnLimpiar.click();
  if (!btnLimpiar.hidden) {
    errores.push("[AC-12] btnLimpiarVista debería estar oculto en estado base");
  }

  doc.getElementById("btnOnlyProblems").click();
  inpBusqueda.value = "algo";
  inpBusqueda.dispatchEvent(new dom.window.Event("input"));
  selTipo.value = "pdf";
  selTipo.dispatchEvent(new dom.window.Event("change"));

  if (btnLimpiar.hidden) {
    errores.push("[AC-12] btnLimpiarVista debería ser visible con filtros activos");
  }

  btnLimpiar.click();
  if (!btnLimpiar.hidden) {
    errores.push("[AC-12] btnLimpiarVista no se ocultó tras hacer click en él");
  }

  // AC-13: cambio de curso reinicia vista
  selMostrar.value = "copiar";
  selMostrar.dispatchEvent(new dom.window.Event("change"));
  selTipo.value = "pdf";
  selTipo.dispatchEvent(new dom.window.Event("change"));
  selOrdenTemas.value = "az";
  selOrdenTemas.dispatchEvent(new dom.window.Event("change"));
  selOrdenArchivos.value = "nombre";
  selOrdenArchivos.dispatchEvent(new dom.window.Event("change"));

  doc.querySelector('.course-item[data-clave="google-classroom:c_b"]')?.click();

  const vistaCb = dom.window.eval(`({
    filtroMostrar,
    filtroTipo,
    ordenTemas,
    ordenArchivos,
    searchTerm,
    onlyProblems,
    activeFilter
  })`);
  if (
    vistaCb.filtroMostrar !== "todas" ||
    vistaCb.filtroTipo !== "" ||
    vistaCb.ordenTemas !== "vienen" ||
    vistaCb.ordenArchivos !== "vienen" ||
    vistaCb.searchTerm !== "" ||
    vistaCb.onlyProblems !== false ||
    vistaCb.activeFilter !== "all"
  ) {
    errores.push(`[AC-13] Cambiar de curso no reinició la vista: ${JSON.stringify(vistaCb)}`);
  }
  if (doc.getElementById("selOrdenCursos").value !== "revisar") {
    errores.push("[AC-13] Cambiar de curso reinició erróneamente selOrdenCursos");
  }
  doc.querySelector('.course-item[data-clave="google-classroom:c_a"]')?.click();

  // AC-15: acciones de tema con filas ocultas
  btnLimpiar.click();
  selMostrar.value = "videollamadas";
  selMostrar.dispatchEvent(new dom.window.Event("change"));

  const metaTeoria = doc.querySelector('article[data-tema="Teoría"] .topic-meta');
  if (!metaTeoria || !metaTeoria.textContent.includes("mostrando 3 de 8 archivos")) {
    errores.push(`[AC-15] Topic meta no dice 'mostrando 3 de 8 archivos': '${metaTeoria?.textContent}'`);
  }

  const chkTeoria = doc.querySelector('.topic-check[data-tema="Teoría"]');
  chkTeoria.checked = false;
  chkTeoria.dispatchEvent(new dom.window.Event("change"));

  const archsTeoria = dom.window.eval(`DATOS.archivos.filter(a => a.clave_curso === "google-classroom:c_a" && a.tema === "Teoría")`);
  const noOmitidos = archsTeoria.filter((a) => a.accion !== "omitir");
  if (noOmitidos.length > 0) {
    errores.push(`[AC-15] Destildar tema con filtro no omitió todas las filas: quedan ${noOmitidos.length} no omitidas`);
  }

  // AC-16: sin resultados
  btnLimpiar.click();
  inpBusqueda.value = "texto_imposible_xyz_123";
  inpBusqueda.dispatchEvent(new dom.window.Event("input"));

  const container = doc.getElementById("topicsContainer");
  if (!container.textContent.includes("No hay carpetas ni archivos que coincidan con los filtros.")) {
    errores.push("[AC-16] Mensaje de vacío no mostrado");
  }
  if (btnLimpiar.hidden) {
    errores.push("[AC-16] Botón Limpiar filtros oculto con vista sin resultados");
  }

} finally {
  limpiarVistos();
  fs.rmSync(dirRaiz, { recursive: true, force: true });
  fs.rmSync(dirSalida, { recursive: true, force: true });
}

console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
