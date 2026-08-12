import { DEBUG_MODE } from "./config.js";

export function log(nivel, seccion, mensaje, datos = null) {
  if (!DEBUG_MODE) {
    if (nivel !== "ERROR" && nivel !== "WARN") {
      return;
    }
  }

  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const prefijos = { INFO: "ℹ️ ", WARN: "⚠️ ", ERROR: "❌", OK: "✅", DEBUG: "🔍", CHUNK: "📦", FLUSH: "💾", IPC: "📡" };
  const prefijo = prefijos[nivel] || "  ";
  const extra = datos ? `\n         ${JSON.stringify(datos)}` : "";
  
  // Agregar salto de línea antes del log para que no ensucie la barra de progreso
  console.log(`\n[${ts}] ${prefijo} [${seccion}] ${mensaje}${extra}`);
}
