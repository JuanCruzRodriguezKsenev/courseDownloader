/**
 * CLON DOWNLOADHELPER - MÓDULO RENDERIZADOR Y AUXILIARES DE VISTA (V5.1.0)
 * ENCAPSULA EL DIBUJO DINÁMICO DEL DOM NATIVO ACOPLADO A APPSTATE
 * ARCHIVO COMPLETO — BLINDAJE TOTAL DE CHECKBOXES EN ESTADO DE COLA/DESCARGA ACTIVA
 * ==========================================================================
 * CHANGELOG v5.1.0:
 * - [FIX UX CRÍTICO] Se eliminan los checkboxes en la pestaña "Disponibles" si la
 * clase tiene `clase.estado === 'process'`. Evita mutaciones inválidas de cola en caliente.
 * - [REFACTOR] Agrupación homogénea de placeholders de grilla para mantener simetría visual.
 */

const Renderers = {
  /**
   * Pinta el panel de telemetría.
   * Firma unificada: recibe el objeto `nodos` completo del popup.
   * Reemplaza tanto a `pintarTelemetria` como a `renderizarMétricasTelemetria`.
   *
   * @param {object} tel    - Objeto de telemetría del SW { bytesProcesados, fragsTerminados, totalFrags, velocidadMbs }
   * @param {object} nodos  - Mapa de nodos del popup (usa: panelTel, bytes, speed, frags)
   */
  pintarTelemetria(tel, nodos) {
    if (!tel || tel.totalFrags === 0) return;

    nodos.panelTel.style.display = 'flex';

    const mbProcesados = Utils.formatearMB(tel.bytesProcesados);
    const mbTotales    = Utils.calcularProyeccionMB(tel.bytesProcesados, tel.fragsTerminados, tel.totalFrags);

    nodos.bytes.innerText = `${mbProcesados} MB / ${isNaN(mbTotales) ? '0.0' : mbTotales} MB`;

    // Guardia ante velocidadMbs null/undefined para evitar TypeError en .toFixed()
    nodos.speed.innerText = `${(tel.velocidadMbs ?? 0).toFixed(1)} MB/s`;

    nodos.frags.innerText = `Frags: ${tel.fragsTerminados}/${tel.totalFrags}`;
  },

  /**
   * Fábrica atómica de filas de clases adaptativas con blindaje anti-duplicación.
   *
   * @param {object} clase    - Objeto de clase del listado global
   * @param {object} contexto - { pestaña, sincronizado, enCurso, videoActivo, onCheckChange, onRemoverClick }
   * @returns {HTMLElement}
   */
  construirFilaClaseDOM(clase, contexto) {
    const itemDiv = document.createElement('div');
    itemDiv.className = `video-item ${clase.seleccionado ? 'selected' : ''}`;

    // Establecer tooltip nativo para leer el nombre completo al pasar el mouse (hover)
    itemDiv.title = clase.titulo;

    if (contexto.pestaña === "disponibles") {

      let checkbox = null;

      // ⚡ [BLINDAJE DE SEGURIDAD UX]: Si no está sincronizado, si ya se descargó,
      // O si está en cola de procesamiento ('process'), NO DEBE tener checkbox bajo ningún concepto.
      if (!contexto.sincronizado || clase.estado === 'downloaded' || clase.estado === 'process') {
        // Placeholder visual para mantener la alineación milimétrica de la columna
        const placeholder = document.createElement('div');
        placeholder.className = "checkbox-placeholder";
        itemDiv.appendChild(placeholder);
      } else {
        checkbox = document.createElement('input');
        checkbox.type    = "checkbox";
        checkbox.checked = clase.seleccionado;
        checkbox.id      = `chk-${clase.id}`;
        
        checkbox.addEventListener('change', (e) => contexto.onCheckChange(clase, e.target.checked, itemDiv));
        itemDiv.appendChild(checkbox);
      }

      const label = document.createElement('span');
      label.className = "video-label";
      label.innerText = clase.titulo;
      itemDiv.appendChild(label);

      // Toda la fila es clickeable para alternar la selección del video
      if (checkbox) {
        itemDiv.addEventListener('click', (e) => {
          if (e.target === checkbox) return;
          const listWrapper = itemDiv.closest('.list-wrapper');
          if (listWrapper && !listWrapper.classList.contains('selection-mode')) {
            return;
          }
          checkbox.checked = !checkbox.checked;
          contexto.onCheckChange(clase, checkbox.checked, itemDiv);
        });
      }

      const spanBadge = document.createElement('span');
      if (!contexto.sincronizado) {
        spanBadge.className = "badge pending";
        spanBadge.innerText = "Sin verificar";
      } else {
        spanBadge.className = `badge ${clase.estado}`;
        spanBadge.innerText = clase.estado === 'downloaded'
          ? "Descargado"
          : (clase.estado === 'process' ? "En Fila" : "Pendiente");
      }
      itemDiv.appendChild(spanBadge);

    } else {
      // --- Vista Pestaña Cola ---
      let checkbox = null;
      const esActivo = clase.titulo === contexto.videoActivo && contexto.enCurso;

      if (esActivo) {
        const placeholder = document.createElement('div');
        placeholder.className = "checkbox-placeholder";
        itemDiv.appendChild(placeholder);
      } else {
        checkbox = document.createElement('input');
        checkbox.type    = "checkbox";
        checkbox.checked = clase.seleccionado || false;
        checkbox.id      = `chk-cola-${clase.id}`;
        
        checkbox.addEventListener('change', (e) => contexto.onCheckChange(clase, e.target.checked, itemDiv));
        itemDiv.appendChild(checkbox);
      }

      const labelFila = document.createElement('span');
      labelFila.className    = "video-label";
      labelFila.style.cursor = checkbox ? "pointer" : "default";
      labelFila.innerText    = clase.titulo;
      itemDiv.appendChild(labelFila);

      if (checkbox) {
        itemDiv.addEventListener('click', (e) => {
          if (e.target === checkbox) return;
          const listWrapper = itemDiv.closest('.list-wrapper');
          if (listWrapper && !listWrapper.classList.contains('selection-mode')) {
            return;
          }
          checkbox.checked = !checkbox.checked;
          contexto.onCheckChange(clase, checkbox.checked, itemDiv);
        });
      }

      if (esActivo) {
        // Video bajo descarga activa o compilación dura: solo badge, sin acción de borrado volátil
        const spanBadgeProg = document.createElement('span');
        spanBadgeProg.className = "badge process";
        spanBadgeProg.innerText = "Bajando";
        itemDiv.appendChild(spanBadgeProg);
      } else {
        const btnRemoverFila = document.createElement('button');
        btnRemoverFila.className = "btn-row-action remove-action";
        btnRemoverFila.innerText = "Remover ❌";
        btnRemoverFila.addEventListener('click', (e) => {
          e.stopPropagation(); // Evitar alternar el checkbox
          contexto.onRemoverClick(clase, itemDiv);
        });
        itemDiv.appendChild(btnRemoverFila);
      }
    }

    return itemDiv;
  },

  /**
   * Renderiza una tarjeta de estado/información dentro del listado
   */
  renderizarTarjetaEstado(listaNode, { tipo, titulo, descripcion, icono }) {
    listaNode.innerHTML = "";
    const card = document.createElement("div");
    card.className = `info-card ${tipo}`;
    card.innerHTML = `
      <div class="info-card-icon">${icono}</div>
      <h5>${titulo}</h5>
      <p>${descripcion}</p>
    `;
    listaNode.appendChild(card);
  }
};

window.Renderers = Renderers;