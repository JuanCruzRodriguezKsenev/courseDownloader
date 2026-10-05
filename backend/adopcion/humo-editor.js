// Humo del editor de adopción: ejecuta el JS de editor.html en jsdom con /api/datos leído de un JSON
// guardado. Uso: node backend/adopcion/humo-editor.js <editor.html> <datos.json> [<comprobaciones.mjs>]
// Existe porque la verificación por curl nunca ejecutó el JS de la página (así pasó el 🔴 de 69a55e4).
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const dirModulo = import.meta.dir || import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const rutaHtml = process.argv[2] || path.join(dirModulo, "editor.html");
const html = fs.readFileSync(rutaHtml, "utf8");

let datos;
if (process.argv[3]) {
  datos = fs.readFileSync(process.argv[3], "utf8");
} else {
  datos = JSON.stringify({
    cursos: [{ clave_curso: "c1", nombre: "Fisica II", carpeta: "Fisica II", materia: "Ingenieria/Fisica 2", docente: "Palacio", items: "1" }],
    temas: [{ clave_curso: "c1", tema: "Teoria", destino: "Teorias", regla: "si", items: "1" }],
    archivos: [{ clave: "c1:a1", clave_curso: "c1", tema: "Teoria", accion: "copiar", carpeta: "Teorias/Palacio", nombre: "clase1.pdf", original: "clase1.pdf", origen: "", md5: "" }],
    destinos: [".", "Teorias", "Practicas", "Laboratorios", "Parciales", "Finales", "Bibliografia", "Notas"],
    materias: ["Ingenieria/Fisica 2"],
    docentes: { "Ingenieria/Fisica 2": ["Palacio"] },
  });
}
const errores = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errores.push(String(e.message || e)));
vc.on("error", (e) => errores.push(String(e)));
const dom = new JSDOM(html, {
  url: "http://127.0.0.1:3002/", runScripts: "dangerously", virtualConsole: vc,
  beforeParse(w) {
    w.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(datos) });
    w.alert = (m) => errores.push("alert: " + m);
    w.CSS = w.CSS || {};
    w.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  },
});
await new Promise((r) => setTimeout(r, 300));
if (process.argv[4]) (await import(process.argv[4])).default(dom.window, errores);
console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
