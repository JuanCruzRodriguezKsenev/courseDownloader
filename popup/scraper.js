/**
 * CLON DOWNLOADHELPER - MÓDULO EXTRACCIÓN (SCRAPER) (V1.0.0)
 * ENCAPSULA LAS TAREAS DE INSPECCIÓN DE DOM E INYECCIÓN DE SCRIPTS EN LA PLATAFORMA
 * ==========================================================================
 */

const Scraper = {
  /**
   * Esta función se ejecuta dentro de la pestaña activa (Isolated World)
   * por medio de la API de chrome.scripting. Debe ser autocontenida y serializable.
   */
  escanearAulaVirtual: function() {
    // 1. Extraer primero los enlaces de los videos que están visibles en la grilla
    const enlaces = Array.from(document.querySelectorAll('.video-list-panel a, a[href*="/clases-grabadas/ver/"]'))
                       .filter(el => {
                         // Filtrar solo elementos visibles en el DOM (evita acumular videos de clases ocultas)
                         return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                       })
                       .map(l => ({ texto: l.innerText || "", href: l.href }));

    let materiaDetectada = "";

    // 2. Intentar deducir la materia directamente desde los títulos de los videos visibles (la fuente más confiable)
    const titulosValidos = enlaces.map(l => l.texto).filter(Boolean);
    if (titulosValidos.length > 0) {
      const muestra = titulosValidos.slice(0, 5);
      const frecuenciaPalabras = {};
      const palabrasIgnorar = new Set([
        "sem", "semana", "clase", "clases", "grabacion", "grabaciones", "tema", 
        "modulo", "unidad", "de", "la", "el", "y", "en", "para", "con", "del", "ver"
      ]);
      
      muestra.forEach(titulo => {
        const palabras = titulo
          .toLowerCase()
          .replace(/[\(\[\{\)\]\}]/g, " ")
          .split(/[\s\-_\/]+/)
          .map(w => w.trim())
          .filter(w => {
            return w.length > 2 && 
                   !palabrasIgnorar.has(w) && 
                   !/^\d+$/.test(w) && 
                   !/\d{2}[\/\-]\d{2}/.test(w); // Filtrar fechas
          });
          
        palabras.forEach(pal => {
          frecuenciaPalabras[pal] = (frecuenciaPalabras[pal] || 0) + 1;
        });
      });
      
      let palabraGanadora = "";
      let maxFrecuencia = 0;
      for (const [pal, frec] of Object.entries(frecuenciaPalabras)) {
        if (frec > maxFrecuencia) {
          maxFrecuencia = frec;
          palabraGanadora = pal;
        }
      }
      
      if (palabraGanadora) {
        materiaDetectada = palabraGanadora;
        const mapaEquivalencias = {
          "anato": "anatomia",
          "bio": "biologia",
          "biol": "biologia",
          "cel": "biologia",
          "celular": "biologia",
          "quim": "quimica",
          "fisio": "fisiologia",
          "histo": "histologia",
          "embrio": "embriologia"
        };
        if (mapaEquivalencias[materiaDetectada]) {
          materiaDetectada = mapaEquivalencias[materiaDetectada];
        }
        console.log("🔍 [SCRAPER] Materia deducida de títulos de videos visibles:", materiaDetectada);
      }
    }

    // 3. Fallbacks para deducir la materia si no se pudo obtener de los títulos de los videos
    if (!materiaDetectada) {
      const courseSelect = document.getElementById('courseSelect') || document.querySelector('select[name*="course"], select[id*="course"], select[class*="course"]');
      let selectText = "";
      let esPlaceholder = false;

      if (courseSelect && courseSelect.selectedIndex >= 0) {
        selectText = courseSelect.options[courseSelect.selectedIndex]?.text || "";
        esPlaceholder = /^(selecciona|seleccione|elegir|elija|seleccionar|selecciona_un)\b/i.test(selectText.trim());
      }

      // Solo intentar deducir si el selector de cursos no está en un estado placeholder (vacío)
      if (!esPlaceholder) {
        // Fallback 1: Buscar en el selector de cursos (#courseSelect)
        if (selectText) {
          let cleanText = selectText
            .replace(/^\d{4}\s*-\s*/, "")
            .replace(/\b(curso|anual|intensivo|semestral|materia|grupo|comision|turno|online|presencial|distancia)\b/ig, "")
            .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, "")
            .trim();
            
          if (cleanText.length > 2) {
            materiaDetectada = cleanText;
            console.log("🔍 [SCRAPER] Materia deducida de courseSelect:", materiaDetectada);
          }
        }

        // Fallback 2: Buscar en encabezados de la página
        if (!materiaDetectada) {
          const h1 = document.querySelector('h1')?.innerText || "";
          const h2 = document.querySelector('h2')?.innerText || "";
          const pageTitle = document.querySelector('.page-title, .materia-title, .course-header')?.innerText || "";
          
          const candidatos = [pageTitle, h1, h2].map(t => t.trim()).filter(Boolean);
          const regexFrase = /(?:clases\s+grabadas\s+de|clases\s+de|aula\s+virtual\s+de|curso\s+de)\s+([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s0-9]+)/i;

          for (const texto of candidatos) {
            const match = texto.match(regexFrase);
            if (match && match[1]) {
              materiaDetectada = match[1].trim();
              break;
            }
          }
          
          if (!materiaDetectada && candidatos.length > 0) {
            let candidato = candidatos[0]
              .replace(/clases\s+grabadas/i, "")
              .replace(/clases/i, "")
              .replace(/aula\s+virtual/i, "")
              .trim();
            if (candidato.length > 2 && !candidato.toLowerCase().includes("galerica") && !candidato.toLowerCase().includes("galeria")) {
              materiaDetectada = candidato;
            }
          }
        }
      }
    }

    // 5. Normalizar el string obtenido para convertirlo en un nombre de directorio limpio
    if (materiaDetectada) {
      materiaDetectada = materiaDetectada
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^a-z0-9]/g, "_")      // Cambiar caracteres especiales a guiones bajos
        .replace(/_+/g, "_")             // Colapsar guiones múltiples
        .replace(/^_+|_+$/g, "");        // Eliminar guiones de los bordes
    }

    // Fallback absoluto si nada funcionó
    if (!materiaDetectada || materiaDetectada.length < 2) {
      materiaDetectada = "biologia";
    }

    console.log("🎯 [SCRAPER] Materia final autodetectada:", materiaDetectada);
    
    return { materia: materiaDetectada, enlaces: enlaces };
  }
};

window.Scraper = Scraper;
