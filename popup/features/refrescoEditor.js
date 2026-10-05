/**
 * REFRESCO DEL POPUP TRAS VOLVER DEL EDITOR WEB (V1.0.0)
 * =======================================================
 * Cuando el usuario vuelve del editor web (pestaña aparte), el popup
 * refresca el estado del disco e índice sin re-escanear el portal,
 * sólo si la bandera editorAbierto está encendida.
 *
 * Plan 25, Decisión 3.
 */

export function crearControlRefrescoEditor({
  estaOffline = () => false,
  hayLista = () => false,
  sincronizar = () => {},
  marcarSincronizacionIncompleta = () => {},
} = {}) {
  let editorAbierto = false;

  function marcarEditorAbierto() {
    editorAbierto = true;
  }

  function estaEditorAbierto() {
    return editorAbierto;
  }

  function refrescarTrasEditor() {
    if (!editorAbierto) return false;
    editorAbierto = false;

    if (!hayLista() || estaOffline()) {
      return false;
    }

    marcarSincronizacionIncompleta();
    sincronizar();
    return true;
  }

  return {
    marcarEditorAbierto,
    estaEditorAbierto,
    refrescarTrasEditor,
  };
}

export default {
  crearControlRefrescoEditor,
};
