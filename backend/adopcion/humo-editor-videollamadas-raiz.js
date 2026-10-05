// Humo en jsdom para Plan 23: videollamadas en bloque y raíz decidida en editor de adopción
// Verifica los criterios AC-1 a AC-13 según docs/specs/editor-ignorar-y-raiz/spec.md

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { crearManejadorEditor } from "./editor.js";
import { guardarVisto, limpiarVistos } from "../destino/vistos.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";
import { esEnlaceVideollamada as esEnlaceVideollamadaCore } from "../../core/destino/videollamada.ts";

const dirModulo = import.meta.dir || import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const rutaHtml = path.join(dirModulo, "editor.html");
const html = fs.readFileSync(rutaHtml, "utf8");

const errores = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errores.push(String(e.message || e)));
vc.on("error", (e) => errores.push(String(e)));

const dirRaiz = fs.mkdtempSync(path.join(os.tmpdir(), "humo-videollamadas-raiz-"));
const dirSalida = fs.mkdtempSync(path.join(os.tmpdir(), "humo-videollamadas-salida-"));

try {
  limpiarVistos();

  // Carpetas en disco para simular raíz
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Fisica 2/Teorias/Palacio"), { recursive: true });
  fs.mkdirSync(path.join(dirRaiz, "Ingenieria/Quimica/Teorias"), { recursive: true });

  // Índice inicial con curso c_v y curso c_sin
  const indiceInicial = {
    version: 1,
    cursos: {
      "google-classroom:c_v": {
        nombre: "Física II",
        materia: "Ingenieria/Fisica 2",
        docente: "Palacio",
        temas: { "Novedades": ".", "Teoría": "Teorias/Palacio" },
      },
      "google-classroom:c_sin": {
        nombre: "Química I",
        materia: "Ingenieria/Quimica",
        docente: "",
        temas: { "Teoría": "Teorias" },
      },
    },
    archivos: {
      "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fyaestaaa:Sala%20vieja": {
        md5: "abc12345",
        curso: "google-classroom:c_v",
        archivo: "sala_vieja.md",
        ruta: "Teorias/Palacio",
        nombre: "sala_vieja.md",
      },
    },
  };
  fs.writeFileSync(path.join(dirRaiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

  // Vistos para curso c_v
  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_v", nombre: "Física II" },
    items: [
      { idArchivo: "acceso:https%3A%2F%2Fmeet.google.com%2Fyaestaaa:Sala%20vieja", original: "Sala vieja", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Meet%20Nuevo", original: "Meet Nuevo", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fus04web.zoom.us%2Fj%2F7301675:Zoom%20Nuevo", original: "Zoom Nuevo", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fteams.live.com%2Fmeet%2F123:Teams%20Nuevo", original: "Teams Nuevo", tema: "Teoría" },
      { idArchivo: "f1", original: "guia1.pdf", tema: "Teoría" },
      { idArchivo: "f2", original: "guia2.pdf", tema: "Teoría" },
      { idArchivo: "acceso:https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dx:Video%20YouTube", original: "Video YouTube", tema: "Teoría" },
      { idArchivo: "nov1", original: "cronograma.pdf", tema: "Novedades" },
      { idArchivo: "a_sin_regla", original: "aviso.pdf", tema: "Anuncios varios" },
    ],
  });

  // Vistos para curso c_sin (sin videollamadas)
  guardarVisto({
    sitio: "google-classroom",
    curso: { id: "c_sin", nombre: "Química I" },
    items: [
      { idArchivo: "q1", original: "apunte.pdf", tema: "Teoría" },
    ],
  });

  const manejar = crearManejadorEditor({ raiz: dirRaiz, salida: dirSalida, puerto: 3002 }, "/adopcion");

  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:3002/adopcion/?modo=indice&curso=google-classroom:c_v",
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

  // AC-6: Paridad entre DOM y Core para esEnlaceVideollamada
  const casosUrl = [
    ["https://meet.google.com/abc-defg-hij", true],
    ["https://us04web.zoom.us/j/7301675", true],
    ["https://teams.live.com/meet/123", true],
    ["https://www.youtube.com/watch?v=x", false],
    ["meet.google.com.falso.com/x", false],
    ["no es una url", false],
  ];
  for (const [url, esperado] of casosUrl) {
    const resDom = dom.window.eval(`esEnlaceVideollamada(${JSON.stringify(url)})`);
    const resCore = esEnlaceVideollamadaCore(url);
    if (resDom !== esperado || resDom !== resCore) {
      errores.push(`[AC-6] Paridad falló para ${url}: DOM=${resDom}, Core=${resCore}, Esperado=${esperado}`);
    }
  }

  const casosClave = [
    ["google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Consulta%20Meet", true],
    ["google-classroom:1gV54mtQL7q", false],
    ["google-classroom:acceso:https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dx:Video", false],
  ];
  for (const [clave, esperado] of casosClave) {
    const resDom = dom.window.eval(`esFilaVideollamada({ clave: ${JSON.stringify(clave)} })`);
    if (resDom !== esperado) {
      errores.push(`[AC-6] Paridad esFilaVideollamada falló para ${clave}: DOM=${resDom}, Esperado=${esperado}`);
    }
  }

  // AC-7: Chip en las filas de videollamada
  const clavesVideo = [
    "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fyaestaaa:Sala%20vieja",
    "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Meet%20Nuevo",
    "google-classroom:acceso:https%3A%2F%2Fus04web.zoom.us%2Fj%2F7301675:Zoom%20Nuevo",
    "google-classroom:acceso:https%3A%2F%2Fteams.live.com%2Fmeet%2F123:Teams%20Nuevo",
  ];
  for (const clave of clavesVideo) {
    const row = doc.querySelector(`tr[data-clave="${clave}"]`);
    if (!row) {
      errores.push(`[AC-7] No se encontró fila para ${clave}`);
      continue;
    }
    const badge = row.querySelector(".badge");
    if (!badge || !badge.textContent.includes("📹")) {
      errores.push(`[AC-7] Fila ${clave} no tiene badge con 📹 (texto: ${badge?.textContent})`);
    }
  }

  // AC-5 / RN-A: Videollamadas nuevas nacen omitidas por defecto
  const archivosIniciales = dom.window.eval("DATOS.archivos");
  const vNuevasIniciales = archivosIniciales.filter((a) =>
    a.clave.includes("Meet%20Nuevo") || a.clave.includes("Zoom%20Nuevo") || a.clave.includes("Teams%20Nuevo")
  );
  for (const a of vNuevasIniciales) {
    if (a.accion !== "omitir") {
      errores.push(`[AC-5/RN-A] Videollamada nueva ${a.clave} no llegó con accion omitir: ${a.accion}`);
    }
  }
  const normalesIniciales = archivosIniciales.filter((a) =>
    a.clave.includes("f1") || a.clave.includes("f2") || a.clave.includes("youtube.com")
  );
  for (const a of normalesIniciales) {
    if (a.accion !== "copiar") {
      errores.push(`[AC-5/RN-A] Archivo normal o YouTube ${a.clave} no llegó con accion copiar: ${a.accion}`);
    }
  }

  // AC-3: Archivo ya-esta conserva su accion
  const archYaEsta = dom.window.eval(
    `DATOS.archivos.find((a) => a.clave === "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fyaestaaa:Sala%20vieja")`
  );
  if (!archYaEsta || archYaEsta.accion !== "ya-esta") {
    errores.push(`[AC-3] Archivo ya-esta no conservó accion ya-esta: ${archYaEsta?.accion}`);
  }

  // AC-4: Con videollamadas omitidas por defecto, se ofrece 'Volver a ofrecerlas'
  const btnReofrecer = doc.querySelector("#btnReofrecerVideollamadas");
  const txtOmitidas = doc.querySelector(".videollamadas-omitidas-txt");
  if (!btnReofrecer || !txtOmitidas?.textContent.includes("3 videollamadas omitidas")) {
    errores.push(`[AC-4] No se encontró botón Volver a ofrecerlas o texto de 3 omitidas: '${txtOmitidas?.textContent}'`);
  } else {
    btnReofrecer.click();
    const archivos = dom.window.eval("DATOS.archivos");
    const vNuevas = archivos.filter((a) =>
      a.clave.includes("Meet%20Nuevo") || a.clave.includes("Zoom%20Nuevo") || a.clave.includes("Teams%20Nuevo")
    );
    for (const a of vNuevas) {
      if (a.accion !== "copiar") {
        errores.push(`[AC-4] Videollamada ${a.clave} no pasó a copiar tras re-ofrecer: ${a.accion}`);
      }
    }

    // AC-1: Ahora que están a copiar, aparece 'Omitir 3 videollamadas'
    const btnOmitir = doc.querySelector("#btnOmitirVideollamadas");
    if (!btnOmitir || btnOmitir.textContent.trim() !== "Omitir 3 videollamadas") {
      errores.push(`[AC-1] Botón omitir no dice 'Omitir 3 videollamadas': '${btnOmitir?.textContent?.trim()}'`);
    } else {
      btnOmitir.click();
      const archivosPostOmitir = dom.window.eval("DATOS.archivos");
      const vNuevasOmitidas = archivosPostOmitir.filter((a) =>
        a.clave.includes("Meet%20Nuevo") || a.clave.includes("Zoom%20Nuevo") || a.clave.includes("Teams%20Nuevo")
      );
      for (const a of vNuevasOmitidas) {
        if (a.accion !== "omitir") {
          errores.push(`[AC-1] Videollamada ${a.clave} no volvió a omitir: ${a.accion}`);
        }
      }
      const btnReofrecerPost = doc.querySelector("#btnReofrecerVideollamadas");
      if (!btnReofrecerPost) {
        errores.push(`[AC-1] No volvió a aparecer botón Volver a ofrecerlas tras omitir`);
      }
    }
  }

  // AC-2: Curso sin videollamadas deja grupoVideollamadas vacío
  dom.window.eval("CURSO_ACTIVO = 'google-classroom:c_sin'; renderAll();");
  const grupoSin = doc.querySelector("#grupoVideollamadas");
  if (grupoSin && grupoSin.textContent.trim() !== "") {
    errores.push(`[AC-2] #grupoVideollamadas no está vacío en curso sin videollamadas: '${grupoSin.textContent.trim()}'`);
  }
  dom.window.eval("CURSO_ACTIVO = 'google-classroom:c_v'; renderAll();");

  // AC-8: Novedades muestra ✓ Asignado · Raíz de la materia y no suma a N a revisar
  const topicNov = doc.querySelector('.topic-card[data-tema="Novedades"]');
  if (!topicNov) {
    errores.push("[AC-8] No se encontró tarjeta del tema Novedades");
  } else {
    const badgeNov = topicNov.querySelector(".topic-title .badge.ready");
    if (!badgeNov || !badgeNov.textContent.includes("✓ Asignado · Raíz de la materia")) {
      errores.push(`[AC-8] Novedades no muestra '✓ Asignado · Raíz de la materia': '${badgeNov?.textContent}'`);
    }
  }
  const courseItemCv = doc.querySelector('.course-item[data-clave="google-classroom:c_v"]');
  const badgeCv = courseItemCv?.querySelector(".badge.warn");
  if (!badgeCv || !badgeCv.textContent.includes("1 a revisar")) {
    errores.push(`[AC-8] Sidebar para c_v no dice '1 a revisar': '${badgeCv?.textContent}'`);
  }

  // AC-9: Tema Anuncios varios muestra Sin destino, opción vacía disabled, y suma a revisar
  const topicAnuncios = doc.querySelector('.topic-card[data-tema="Anuncios varios"]');
  if (!topicAnuncios) {
    errores.push("[AC-9] No se encontró tarjeta para 'Anuncios varios'");
  } else {
    const badgeWarn = topicAnuncios.querySelector(".topic-title .badge.warn");
    if (!badgeWarn || !badgeWarn.textContent.includes("Sin destino")) {
      errores.push(`[AC-9] 'Anuncios varios' no muestra 'Sin destino': '${badgeWarn?.textContent}'`);
    }
    const selectAnuncios = topicAnuncios.querySelector('.topic-dest-select[data-tema="Anuncios varios"]');
    const optVacia = selectAnuncios?.querySelector('option[value=""]');
    if (!optVacia || !optVacia.disabled || !optVacia.selected) {
      errores.push(`[AC-9] Selector de 'Anuncios varios' no tiene option value='' disabled selected`);
    }
  }

  // AC-10: Elegir . dispara change -> Asignado, desaparece opción vacía, curso ya no cuenta tema
  const selectAnuncios = doc.querySelector('.topic-dest-select[data-tema="Anuncios varios"]');
  if (selectAnuncios) {
    if (selectAnuncios.value !== "") {
      errores.push(`[AC-10] Selector de 'Anuncios varios' no arrancó en opción vacía: '${selectAnuncios.value}'`);
    }
    selectAnuncios.value = ".";
    selectAnuncios.dispatchEvent(new dom.window.Event("change"));

    const topicAnunciosPost = doc.querySelector('.topic-card[data-tema="Anuncios varios"]');
    const badgePost = topicAnunciosPost?.querySelector(".topic-title .badge.ready");
    if (!badgePost || !badgePost.textContent.includes("✓ Asignado")) {
      errores.push(`[AC-10] 'Anuncios varios' no pasó a '✓ Asignado': '${badgePost?.textContent}'`);
    }
    const selectAnunciosPost = doc.querySelector('.topic-dest-select[data-tema="Anuncios varios"]');
    const optVaciaPost = selectAnunciosPost?.querySelector('option[value=""]');
    if (optVaciaPost) {
      errores.push(`[AC-10] Opción vacía no desapareció del selector tras change a '.'`);
    }
    const courseItemCvPost = doc.querySelector('.course-item[data-clave="google-classroom:c_v"]');
    const badgeListo = courseItemCvPost?.querySelector(".badge.ready");
    if (!badgeListo || !badgeListo.textContent.includes("✓ Listo")) {
      errores.push(`[AC-10] Sidebar para c_v no dice '✓ Listo' tras decidir Anuncios varios: '${courseItemCvPost?.querySelector(".badge")?.textContent}'`);
    }
  }

  // AC-11: Con Novedades a raíz decidida, Solo problemas no la muestra y #cntUnassigned no suma sus archivos
  dom.window.eval(`
    const t = DATOS.temas.find(x => x.tema === "Anuncios varios");
    if (t) { t.destino = "."; t.regla = "no"; }
    renderAll();
  `);
  const btnOnlyProblems = doc.querySelector("#btnOnlyProblems");
  btnOnlyProblems?.click();

  const novCard = doc.querySelector('.topic-card[data-tema="Novedades"]');
  if (novCard) {
    errores.push("[AC-11] 'Novedades' (a raíz decidida) no debe mostrarse con Solo problemas activo");
  }
  const cntUnassignedEl = doc.querySelector("#cntUnassigned");
  if (cntUnassignedEl && cntUnassignedEl.textContent.trim() !== "1") {
    errores.push(`[AC-11] #cntUnassigned no es 1 con Solo problemas: '${cntUnassignedEl.textContent.trim()}'`);
  }
  btnOnlyProblems?.click(); // restaurar

  // AC-12: Rótulos coherentes
  const todosOptions = Array.from(doc.querySelectorAll("select option"));
  const tieneViejo = todosOptions.some((o) => o.textContent.includes(". (raíz del curso)") || o.textContent === ". (raíz)");
  if (tieneViejo) {
    errores.push("[AC-12] Se encontró un <option> con '. (raíz del curso)' o '. (raíz)'");
  }
  const optsPunto = Array.from(doc.querySelectorAll('.topic-dest-select option[value="."]'));
  for (const opt of optsPunto) {
    if (opt.textContent.trim() !== "Raíz de la materia") {
      errores.push(`[AC-12] Option value='.' en topic-dest-select no dice 'Raíz de la materia': '${opt.textContent}'`);
    }
  }

  // AC-13: btnAutoAll respeta Novedades (.) y asigna carpeta a Anuncios varios
  dom.window.eval(`
    const tNov = DATOS.temas.find(x => x.tema === "Novedades");
    if (tNov) { tNov.destino = "."; tNov.regla = "si"; }
    const tAnun = DATOS.temas.find(x => x.tema === "Anuncios varios");
    if (tAnun) { tAnun.destino = "."; tAnun.regla = "no"; }
    renderAll();
  `);
  const btnAutoAll = doc.querySelector("#btnAutoAll");
  btnAutoAll?.click();

  const temasFinales = dom.window.eval("DATOS.temas");
  const tNovFinal = temasFinales.find((x) => x.tema === "Novedades");
  const tAnunFinal = temasFinales.find((x) => x.tema === "Anuncios varios");

  if (!tNovFinal || tNovFinal.destino !== ".") {
    errores.push(`[AC-13] Novedades no conservó destino '.' tras btnAutoAll: '${tNovFinal?.destino}'`);
  }
  if (!tAnunFinal || tAnunFinal.destino === ".") {
    errores.push(`[AC-13] Anuncios varios no recibió carpeta tras btnAutoAll: '${tAnunFinal?.destino}'`);
  }

} finally {
  limpiarVistos();
  fs.rmSync(dirRaiz, { recursive: true, force: true });
  fs.rmSync(dirSalida, { recursive: true, force: true });
}

console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
