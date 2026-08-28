/**
 * ISLA PREACT #1 — el puntito de estado del header (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [COPY] Tooltip "internet": "Sin conexión a internet" → "No se pudo contactar el sitio".
 *   El daemon sondea el HOST DEL PORTAL, no un endpoint genérico de internet — mismo cambio
 *   en `bannerConexion.preact.js` y `notificaciones.ts`.
 *
 * Primera "isla" de la migración incremental del popup a Preact (ver
 * docs/adr/0006-adopt-preact-islands-in-popup.md). Preact convive con el resto
 * vanilla: esta isla es DUEÑA exclusiva del indicador de conexión (#preact-status-dot)
 * y lo deriva del daemon Conexion (core/conexion/conexion.ts). Ya nadie lo pinta a mano.
 *
 * Antes, el statusDot se pintaba imperativamente desde 6 lugares (popup.js x2,
 * serverConnection.js x4). Con esto es un derivado puro del estado: cambia la
 * conexión → el puntito se re-deriva solo. Imposible desincronizar.
 *
 * Desde la Fase 7c el daemon entra INYECTADO: la monta `entrypoints/popup/main.js`
 * pasándole `conexion`, en vez de que el módulo se auto-montara y lo buscara en
 * `window.Conexion`. El daemon lo arranca popup.js (iniciarDetectorEstado); esta isla sólo
 * se SUSCRIBE y renderiza.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

// Hook puente: re-renderiza cuando el daemon Conexion notifica un cambio.
// (El equivalente de useSyncExternalStore para nuestra fuente de verdad.)
// FASE 7C: el daemon entra por parámetro. Lo comparte la isla `onboarding`, que también lo
// recibe por prop y se lo pasa acá — por eso el hook lo toma como argumento en vez de
// resolverlo por su cuenta.
export function useConexion(conexion) {
  const [, forzar] = useState(0);
  useEffect(() => conexion.suscribir(() => forzar(n => n + 1)), []);
  return conexion.get();
}

export function StatusDot({ conexion }) {
  const c = useConexion(conexion);
  const ok = c.completa;
  return html`<div
    class="status-dot ${ok ? 'online' : 'offline'}"
    title=${ok ? 'Conectado' : (!c.servidor ? 'Servidor desconectado' : 'No se pudo contactar el sitio')}
  ></div>`;
}

// FASE 7C: la monta el entrypoint del popup, no este módulo al evaluarse. El auto-montaje
// era lo que ataba la isla al orden de imports y a que el global ya existiera.
export function montar(root, { conexion }) {
  if (root && conexion) {
    render(html`<${StatusDot} conexion=${conexion} />`, root);
  }
}
