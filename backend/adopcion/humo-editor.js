// Humo del editor de adopción: ejecuta el JS de editor.html en jsdom con /api/datos leído de un JSON
// guardado. Uso: node backend/adopcion/humo-editor.js <editor.html> <datos.json> [<comprobaciones.mjs>]
// Existe porque la verificación por curl nunca ejecutó el JS de la página (así pasó el 🔴 de 69a55e4).
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const datos = fs.readFileSync(process.argv[3], "utf8");
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
