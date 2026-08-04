/**
 * PROCESADOR DE LA COLA DE DESCARGA (V1.0.0)
 * ==========================================================================
 * Capa 1. Salió de `background.js` en la Fase 6b — es el bloque de lógica más grande que
 * tenía el service worker, y el más sensible del proyecto.
 *
 * QUÉ ES
 * ------
 * El bucle FIFO que toma la primera clase de la cola, la descarga con el motor HLS y decide
 * qué pasa cuando algo falla. Esa segunda parte es el verdadero contenido: **la clasificación
 * de fallos tiene cuatro caminos y cada uno existe por un bug real**.
 *
 *   1. **Cancelación del usuario** (`abortadoPorUsuario`) → no es un fallo. Sale limpio.
 *   2. **`tipoConexion: "sesion"`** → pausa SIN alarma. El daemon ve la red OK y
 *      malclasificaría; además el auto-heal reintentaría en loop contra el login.
 *   3. **`tipoBackend: "rechazo"` (4xx)** → **saltea sólo esa clase** y sigue. Es el fix del
 *      bug 400: el server está vivo, así que `/api/health` daría 200 y el daemon diría
 *      "servidor", generando el loop pausa→autoheal→mismo 400.
 *   4. **Cualquier otro** → fallo real: pausa CON alarma de auto-heal.
 *
 * El orden importa: 1, 2 y 3 se clasifican **antes** de consultar al daemon.
 *
 * ESTADO PROPIO (y por qué vive acá)
 * ----------------------------------
 * `loopActivo` y `controladorGraficoActivo` eran variables de módulo de `background.js`
 * compartidas entre el bucle y los handlers IPC. Ahora son estado privado de esta factory y
 * se tocan por su API (`arrancarSiNoCorre`, `detener`, `abortarRafaga`). Es lo que evita el
 * bug clásico de este bucle: **dos ráfagas corriendo a la vez**, que duplica descargas y
 * pisa el progreso.
 *
 * LO QUE NO ESTÁ ACÁ, A PROPÓSITO
 * -------------------------------
 * La notificación nativa y el camino legacy de volcado a disco (offscreen + `chrome.downloads`)
 * son Capa 3: entran como callbacks (`notificarFallo`, `guardarBlobLegacy`) desde la
 * composición. El historial de fallos sí es del núcleo y entra como colaborador.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";
import type { PuertoMensajeria } from "../puertos/mensajeria";
import type { PuertoProgramador } from "../puertos/programador";
import type { EstadoSesionAPI } from "./estadoSesion";
import type { MetadataHls, ContextoRafaga, CallbacksRafaga } from "../hls/hlsEngine";

/** Nombre y período de la tarea de auto-sanación. 0.2 min = 12 s. */
export const ALARMA_AUTOHEAL = "alarma_autoheal";
export const PERIODO_AUTOHEAL_MIN = 0.2;

/** Copy por tipo de pausa; viaja al historial y a la notificación. */
const MOTIVOS_PAUSA: Record<string, string> = {
  sesion: "no hay sesión activa en Ramón Net",
  servidor: "se perdió la conexión con el servidor local",
  internet: "se perdió la conexión a internet",
};

export interface ItemCola {
  titulo: string;
  urlInterna: string;
  carpeta?: string;
  fechaEncolado?: number;
}

export interface ClasePersistida {
  titulo: string;
  estado?: string;
  [k: string]: unknown;
}

export interface DependenciasCola {
  almacenamiento: PuertoAlmacenamiento;
  sesion: EstadoSesionAPI;
  mensajeria: PuertoMensajeria;
  programador: PuertoProgramador;
  /** Fuente única del estado de conexión. Se usa para clasificar el fallo. */
  conexion: {
    verificarAhora(): Promise<unknown>;
    get(): { servidor: boolean; internet: boolean; tipoFalla: string | null };
  };
  motor: {
    descargarYAnalizarIndexM3u8(url: string, signal: AbortSignal): Promise<MetadataHls>;
    compilarTranscodificacionStream(
      meta: MetadataHls,
      signal: AbortSignal,
      subcarpeta: string,
      contexto: ContextoRafaga,
      callbacks?: CallbacksRafaga
    ): Promise<Blob | null>;
  };
  /** Del adaptador de sitio: página de la clase → URL del manifiesto. */
  sitio: { resolverManifiesto(urlClase: string, signal: AbortSignal): Promise<string> };
  historial: { registrar(tipo: string, titulo: string, motivo: string): Promise<unknown> };
  /** Capa 3: notificación nativa del SO. Best-effort, no puede propagar. */
  notificarFallo(tipo: string, titulo: string, motivo: string): void;
  /** Métricas de progreso ya formateadas. */
  calcularMetricas(
    bytes: number,
    hechos: number,
    total: number,
    inicio: number
  ): { porcentaje: number; telemetry: { velocidadTexto: string } };
  /**
   * Empuja el progreso a la **consola gráfica del backend Bun** — la barra que se ve en la
   * ventana del servidor. Es la única forma que tiene el usuario de seguir una descarga con
   * el popup cerrado, así que no es decorativa. Best-effort: no puede frenar la ráfaga.
   */
  actualizarConsolaBackend(datos: {
    titulo: string;
    porcentaje: number;
    terminados: number;
    totales: number;
    velocidad: number;
  }): void;
  /** Capa 3, camino legacy no-Turbo: volcar el blob a disco. */
  guardarBlobLegacy(blob: Blob, subRuta: string): Promise<void>;
  /** Espejo liviano de progreso que lee el popup. */
  persistirEstados(estados: Record<string, string>): Promise<void>;
  recuperarEstados(): Promise<Record<string, string>>;
}

export function crearProcesadorCola(deps: DependenciasCola) {
  const {
    almacenamiento,
    sesion,
    mensajeria,
    programador,
    conexion,
    motor,
    sitio,
    historial,
    notificarFallo,
    calcularMetricas,
    actualizarConsolaBackend,
    guardarBlobLegacy,
    persistirEstados,
    recuperarEstados,
  } = deps;

  // Estado volátil del service worker. Privado: se toca sólo por la API de abajo.
  let controladorGraficoActivo: AbortController | null = null;
  let loopActivo = false;

  /**
   * Choke point de aviso de fallos: historial + notificación nativa.
   *
   * **A prueba de balas a propósito**: ni el historial ni la notificación pueden propagar. El
   * aviso es un efecto secundario best-effort y la salud de la cola nunca debe depender de que
   * funcione — fue una regresión real (un `chrome.notifications` ausente frenaba la cola).
   */
  async function registrarFallo(tipo: string, titulo: string, motivo: string): Promise<void> {
    try {
      await historial.registrar(tipo, titulo, motivo);
    } catch (e) {
      console.warn("[SW] No se pudo registrar el fallo en el historial:", e);
    }
    try {
      notificarFallo(tipo, titulo, motivo);
    } catch (e) {
      console.warn("[SW] No se pudo disparar la notificación de fallo:", e);
    }
  }

  async function notificarFrenoSuaveExitoso(): Promise<void> {
    await sesion.set({ rafagaCorriendo: false, frenadoSuaveSolicitado: false, videoActualTitulo: "" });
    loopActivo = false;
    await persistirEstados({});
    mensajeria.notificar({ action: "cola_completamente_vacia", suaveFrenado: true });
  }

  async function pausarPorError(tipoError: string, titulo: string): Promise<void> {
    await sesion.set({
      colaPausadaPorError: true,
      tipoDeErrorConexion: tipoError,
      rafagaCorriendo: false,
    });
    loopActivo = false;

    // El aviso va DESPUÉS de persistir la pausa: que quede el estado es lo crítico.
    void registrarFallo(tipoError, titulo, MOTIVOS_PAUSA[tipoError] || "error de conexión");

    // Auto-heal sólo para fallas que el daemon PUEDE detectar recuperadas. El caso "sesion"
    // no: el daemon ve la red OK, así que la alarma reintentaría en loop contra el login.
    if (tipoError !== "sesion") {
      programador.programar(ALARMA_AUTOHEAL, { periodoMin: PERIODO_AUTOHEAL_MIN });
    }

    mensajeria.notificar({ action: "cola_pausada_por_error", errorType: tipoError, titulo });
  }

  async function reanudar(): Promise<void> {
    programador.cancelar(ALARMA_AUTOHEAL);
    await sesion.set({ colaPausadaPorError: false, tipoDeErrorConexion: "", rafagaCorriendo: true });
    arrancarSiNoCorre();
  }

  /** Entrada del bucle. Se re-encola a sí misma con un respiro de 60ms entre clases. */
  async function procesarSiguiente(): Promise<void> {
    const state = await sesion.get();

    if (state.frenadoSuaveSolicitado) {
      await notificarFrenoSuaveExitoso();
      return;
    }
    if (!state.rafagaCorriendo) {
      loopActivo = false;
      return;
    }

    try {
      const data = await almacenamiento.obtenerLocal<{
        listaPersistente: ClasePersistida[];
        colaDescargas: ItemCola[];
      }>(["listaPersistente", "colaDescargas"]);
      const listaCompleta = data.listaPersistente || [];
      const colaDescargas = data.colaDescargas || [];

      // FIFO estricto por fecha de encolado, no por el orden del array: la cola se puede
      // haber reordenado en storage entre dos vueltas del bucle.
      colaDescargas.sort((a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0));

      if (colaDescargas.length === 0) {
        await sesion.set({ rafagaCorriendo: false });
        loopActivo = false;
        await persistirEstados({});
        mensajeria.notificar({ action: "cola_completamente_vacia" });
        return;
      }

      const elementoActual = colaDescargas[0]!;
      const tituloInmutableVideo = elementoActual.titulo;
      const sessionId = Date.now().toString();

      await sesion.set({
        videoActualTitulo: tituloInmutableVideo,
        videoActualSessionId: sessionId,
        bytesProcesadosEnVideoActual: 0,
        fragmentosTerminadosEnVideoActual: 0,
        totalFragmentosEnVideoActual: 0,
        tiempoInicioVideoActual: performance.now(),
        velocidadMbsActual: 0,
        abortadoPorUsuario: false,
      });

      const estados = await recuperarEstados();
      estados[tituloInmutableVideo] = "process";
      await persistirEstados(estados);

      controladorGraficoActivo = new AbortController();
      const controlador = controladorGraficoActivo;

      try {
        // La resolución del .m3u8 es específica del portal (iframe, CDN): vive en el
        // adaptador de sitio, no en el motor, que es genérico.
        const urlM3u8Descubierta = await sitio.resolverManifiesto(
          elementoActual.urlInterna,
          controlador.signal
        );

        const currentState = await sesion.get();
        if (!currentState.rafagaCorriendo) return;

        const listaFragmentos = await motor.descargarYAnalizarIndexM3u8(
          urlM3u8Descubierta,
          controlador.signal
        );
        await sesion.set({ totalFragmentosEnVideoActual: listaFragmentos.urls.length });

        const subcarpetaFinal = elementoActual.carpeta
          ? elementoActual.carpeta.trim().toLowerCase()
          : "biologia";

        const resultadoBloquesBlob = await motor.compilarTranscodificacionStream(
          listaFragmentos,
          controlador.signal,
          subcarpetaFinal,
          {
            modoTurbo: currentState.modoTurboBunActivo,
            titulo: tituloInmutableVideo,
            sessionId,
            // El motor sabe CUÁNDO frenar la ráfaga; el dueño del controlador es este bucle.
            abortarHermanos: () => controlador.abort(),
          },
          {
            onFragmentoCompletado: async (_peso, totalUrls, bytesAcumulados, fragmentosTerminados) => {
              const current = await sesion.get();
              if (!current.rafagaCorriendo) return;

              const progreso = calcularMetricas(
                bytesAcumulados,
                fragmentosTerminados,
                totalUrls,
                current.tiempoInicioVideoActual
              );
              const velocidadMbs = parseFloat(progreso.telemetry.velocidadTexto) || 0;

              await sesion.set({
                bytesProcesadosEnVideoActual: bytesAcumulados,
                fragmentosTerminadosEnVideoActual: fragmentosTerminados,
                velocidadMbsActual: velocidadMbs,
              });

              // Barra de progreso de la consola del backend. Sólo en turbo: en el camino
              // legacy los fragmentos no pasan por el servidor, así que no hay nada que
              // mostrar allá.
              if (current.modoTurboBunActivo) {
                actualizarConsolaBackend({
                  titulo: tituloInmutableVideo,
                  porcentaje: progreso.porcentaje,
                  terminados: fragmentosTerminados,
                  totales: totalUrls,
                  velocidad: velocidadMbs,
                });
              }

              mensajeria.notificar({
                action: "update_progress_bar",
                percentage: progreso.porcentaje,
                titulo: tituloInmutableVideo,
                compiling: false,
                telemetry: {
                  bytesProcesados: bytesAcumulados,
                  fragsTerminados: fragmentosTerminados,
                  totalFrags: totalUrls,
                  velocidadMbs,
                },
              });
            },
          }
        );

        const postDownloadState = await sesion.get();
        if (!postDownloadState.rafagaCorriendo) return;

        if (!postDownloadState.modoTurboBunActivo) {
          // Camino legacy no-Turbo: el blob se arma en memoria y se vuelca a disco. Hoy
          // inalcanzable (turbo está forzado), pero se conserva el flujo intacto.
          mensajeria.notificar({
            action: "update_progress_bar",
            percentage: 100,
            titulo: tituloInmutableVideo,
            compiling: true,
          });
          await guardarBlobLegacy(
            resultadoBloquesBlob as Blob,
            `${subcarpetaFinal}/${tituloInmutableVideo}.mp4`
          );
        } else {
          console.log(`✨ [SW-ENGINE] Modo Turbo Bun completado con éxito para: "${tituloInmutableVideo}"`);
        }

        const postWriteState = await sesion.get();
        if (!postWriteState.rafagaCorriendo) return;

        // Cola fresca: pudo cambiar mientras se descargaba.
        const dataUpdate = await almacenamiento.obtenerLocal<{ colaDescargas: ItemCola[] }>([
          "colaDescargas",
        ]);
        const colaActual = (dataUpdate.colaDescargas || []).filter(
          (c) => c.titulo !== tituloInmutableVideo
        );

        const objPersistente = listaCompleta.find((c) => c.titulo === tituloInmutableVideo);
        if (objPersistente) objPersistente.estado = "downloaded";

        const estadosUpdate = await recuperarEstados();
        delete estadosUpdate[tituloInmutableVideo];

        // Escritura ATÓMICA: las tres claves describen el estado de la misma clase
        // (descargada → fuera de la cola, marcada 'downloaded', sin entrada de progreso).
        // En un solo `set` para que una suspensión del SW no las desincronice.
        await almacenamiento.guardarLocal({
          listaPersistente: listaCompleta,
          colaDescargas: colaActual,
          SW_ESTADOS_PROGRESO: estadosUpdate,
        });

        mensajeria.notificar({
          action: "clase_guardada_ok",
          titulo: tituloInmutableVideo,
          suaveFrenado: postWriteState.frenadoSuaveSolicitado,
        });

        setTimeout(procesarSiguiente, 60);
      } catch (errDescarga) {
        const err = errDescarga as { name?: string; message?: string; tipoConexion?: string; tipoBackend?: string; httpStatus?: number };
        const estadoTrasFallo = await sesion.get();

        // (1) SÓLO el flag explícito marca cancelación del usuario. NO usar `signal.aborted`
        // ni `name === 'AbortError'`: el motor aborta ese controlador A PROPÓSITO para frenar
        // a los workers hermanos cuando UN fragmento falla, así que los hermanos rechazan con
        // AbortError. Confiar en eso hacía que una caída de conexión se confundiera con
        // cancelación → la cola no se pausaba y el popup nunca recibía el banner.
        if (estadoTrasFallo.abortadoPorUsuario) {
          console.log(`🛑 [SW] Descarga de "${tituloInmutableVideo}" abortada por el usuario de forma limpia.`);
          return;
        }

        // (2) Sesión no iniciada: la página de la clase redirigió al login. No es red ni
        // crash, es accionable por el usuario. Se clasifica ANTES del daemon, que vería
        // internet=true y diría "internet".
        if (err?.tipoConexion === "sesion") {
          console.warn(`🔑 [SW] Descarga de "${tituloInmutableVideo}" pausada: no hay sesión activa en Ramón Net.`);
          await pausarPorError("sesion", tituloInmutableVideo);
          return;
        }

        // (3) Rechazo aplicativo 4xx del backend, tras el reintento del motor. El server está
        // VIVO: /api/health daría 200 y el daemon diría "servidor" → loop pausa→autoheal→400.
        // Un 4xx es determinístico: se saltea SOLO esta clase y la cola sigue. La clase
        // vuelve a 'pending' (no a un 'error' que el resto del popup no reconoce): se ve como
        // pendiente normal y es re-encolable.
        if (err?.tipoBackend === "rechazo") {
          console.warn(`⛔ [SW] El backend rechazó fragmentos de "${tituloInmutableVideo}" (HTTP ${err.httpStatus}). Se salta la clase y la cola continúa.`);
          const dataUpdate = await almacenamiento.obtenerLocal<{ colaDescargas: ItemCola[] }>([
            "colaDescargas",
          ]);
          const colaFiltrada = (dataUpdate.colaDescargas || []).filter(
            (c) => c.titulo !== tituloInmutableVideo
          );
          const objPersistente = listaCompleta.find((c) => c.titulo === tituloInmutableVideo);
          if (objPersistente) objPersistente.estado = "pending";
          const estadosUpdate = await recuperarEstados();
          delete estadosUpdate[tituloInmutableVideo];
          // Misma escritura atómica de 3 claves que el path de éxito.
          await almacenamiento.guardarLocal({
            listaPersistente: listaCompleta,
            colaDescargas: colaFiltrada,
            SW_ESTADOS_PROGRESO: estadosUpdate,
          });
          const motivoRechazo = `el backend rechazó sus fragmentos (HTTP ${err.httpStatus})`;
          mensajeria.notificar({
            action: "clase_con_error",
            titulo: tituloInmutableVideo,
            motivo: motivoRechazo,
          });
          setTimeout(procesarSiguiente, 60); // seguir con la próxima
          // Aviso DESPUÉS de garantizar la continuación de la cola.
          void registrarFallo("rechazo", tituloInmutableVideo, motivoRechazo);
          return;
        }

        // (4) Fallo REAL. Recién acá se loguea como error.
        console.error(`⚠️ [BUCLE-ERROR] Falló la descarga de "${tituloInmutableVideo}":`, errDescarga);

        // Clasificar con el daemon (fuente única). Si la conectividad está OK —el fallo no
        // fue de red— se cae a la heurística por mensaje para no clasificar mal.
        await conexion.verificarAhora();
        let tipoError = conexion.get().tipoFalla;
        if (!tipoError) {
          const msg = err?.message || "";
          tipoError =
            msg.includes("Bun") ||
            msg.includes("localhost") ||
            msg.includes("127.0.0.1") ||
            msg.includes("backend")
              ? "servidor"
              : "internet";
        }
        await pausarPorError(tipoError, tituloInmutableVideo);
      }
    } catch (errStorage) {
      console.error("❌ [CRÍTICO-STORAGE] No se pudo leer el storage local de la cola:", errStorage);
      await sesion.set({ rafagaCorriendo: false });
      loopActivo = false;
    }
  }

  /**
   * Arranca el bucle si no está corriendo. La guarda es lo que impide **dos ráfagas
   * simultáneas**, que duplicaría descargas y pisaría el progreso.
   */
  function arrancarSiNoCorre(): void {
    if (loopActivo) return;
    loopActivo = true;
    void procesarSiguiente();
  }

  return {
    procesarSiguiente,
    arrancarSiNoCorre,
    pausarPorError,
    reanudar,
    estaActivo: () => loopActivo,
    /** Marca el bucle como detenido sin tocar el controlador (fin de ráfaga ordenado). */
    detener(): void {
      loopActivo = false;
    },
    /** Cancelación dura: frena el bucle y aborta la descarga en vuelo. */
    abortarRafaga(): void {
      loopActivo = false;
      if (!controladorGraficoActivo) return;
      try {
        controladorGraficoActivo.abort();
      } catch (e) {
        console.warn("⚠️ Falló el abort del controlador de gráfico activo (limpieza de fin de ráfaga):", (e as Error)?.message);
      }
      controladorGraficoActivo = null;
    },
    /**
     * Handler del disparo de auto-sanación. Devuelve si reanudó, para que el caller pueda
     * afirmar sobre ello sin espiar el estado.
     */
    async alDispararAutoheal(): Promise<boolean> {
      const state = await sesion.get();
      if (!state.colaPausadaPorError) {
        programador.cancelar(ALARMA_AUTOHEAL);
        return false;
      }
      // Guarda defensiva: "sesion" no se auto-reanuda (el daemon no detecta el login). No se
      // le crea alarma, pero si quedó una de un estado previo, se limpia acá.
      if (state.tipoDeErrorConexion === "sesion") {
        programador.cancelar(ALARMA_AUTOHEAL);
        return false;
      }
      try {
        // Un solo chequeo vía el daemon. `verificarAhora()` además espeja el estado en la
        // sesión, así que el popup (si está abierto) lo ve.
        await conexion.verificarAhora();
        const est = conexion.get();
        const recuperado = state.tipoDeErrorConexion === "servidor" ? est.servidor : est.internet;
        if (recuperado) {
          console.log(`✅ [ALARM-AUTOHEAL] Conexión (${state.tipoDeErrorConexion}) recuperada. Reanudando...`);
          await reanudar();
          return true;
        }
      } catch {
        // Sigue sin conexión/servidor.
      }
      return false;
    },
  };
}

export type ProcesadorCola = ReturnType<typeof crearProcesadorCola>;
