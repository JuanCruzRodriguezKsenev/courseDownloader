import { describe, it, expect, vi } from "vitest";
import {
  aplicarEstadoDestino,
  bloquearSeleccion,
  compararPrioridadDestino,
  puedeBajar,
  notasDeDestino,
  cardIndiceIlegible,
  armarVistos,
  cursoParaEditor,
} from "./destino.js";

describe("popup/features/destino.js", () => {
  const sitioClassroom = {
    id: "google-classroom",
    nombre: "Google Classroom",
    destinoPorIndice: true,
  };

  const sitioRamonNet = {
    id: "ramonnet",
    nombre: "Ramón Net",
    destinoPorIndice: false,
  };

  describe("aplicarEstadoDestino()", () => {
    it("portal sin destinoPorIndice no realiza ningún pedido al backend (D-2)", async () => {
      const backend = {
        estadoDestino: vi.fn(),
      };
      const clases = [
        { id: 1, sitioId: "ramonnet", titulo: "Clase 1", cursoId: "c1" },
      ];

      const res = await aplicarEstadoDestino({
        backend,
        sitio: sitioRamonNet,
        clases,
      });

      expect(res).toEqual({ ok: true });
      expect(backend.estadoDestino).not.toHaveBeenCalled();
    });

    it("curso asociado con ítems descargados y pendientes asigna estado, destino y selección", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true, materia: "Fisica I" },
          items: [
            {
              idArchivo: "att-1",
              estado: "descargado",
              rutaDestino: "Fisica I/Teoria",
              nombre: "Teoria 1.pdf",
              sinAsignar: false,
              omitido: false,
            },
            {
              idArchivo: "att-2",
              estado: "pendiente",
              rutaDestino: "Fisica I/Practica",
              nombre: "Guia 1.pdf",
              sinAsignar: false,
              omitido: false,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c100",
          cursoNombre: "Física I",
          tema: "Teoría",
          idArchivo: "att-1",
          titulo: "Teoria 1.pdf",
          estado: "pending",
          seleccionado: true,
        },
        {
          id: 2,
          sitioId: "google-classroom",
          cursoId: "c100",
          cursoNombre: "Física I",
          tema: "Práctica",
          idArchivo: "att-2",
          titulo: "Guia 1.pdf",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(backend.estadoDestino).toHaveBeenCalledTimes(1);
      expect(backend.estadoDestino).toHaveBeenCalledWith({
        sitio: "google-classroom",
        curso: { id: "c100", nombre: "Física I" },
        items: [
          {
            idArchivo: "att-1",
            original: "Teoria 1.pdf",
            tema: "Teoría",
            publicacion: undefined,
            anuncio: undefined,
            tipo: undefined,
          },
          {
            idArchivo: "att-2",
            original: "Guia 1.pdf",
            tema: "Práctica",
            publicacion: undefined,
            anuncio: undefined,
            tipo: undefined,
          },
        ],
      });

      // Ítem 1: descargado -> estado 'downloaded', seleccionado false
      expect(clases[0].estado).toBe("downloaded");
      expect(clases[0].seleccionado).toBe(false);
      expect(clases[0].bloqueo).toBeUndefined();
      expect(clases[0].sinAsignar).toBe(false);
      expect(clases[0].destino).toEqual({
        ruta: "Fisica I/Teoria",
        nombre: "Teoria 1.pdf",
        claveCurso: "google-classroom:c100",
        original: "Teoria 1.pdf",
      });

      // Ítem 2: pendiente -> estado 'pending', conserva seleccionado true
      expect(clases[1].estado).toBe("pending");
      expect(clases[1].seleccionado).toBe(true);
      expect(clases[1].bloqueo).toBeUndefined();
      expect(clases[1].sinAsignar).toBe(false);
      expect(clases[1].destino).toEqual({
        ruta: "Fisica I/Practica",
        nombre: "Guia 1.pdf",
        claveCurso: "google-classroom:c100",
        original: "Guia 1.pdf",
      });
    });

    it("curso sin asociar -> bloqueo 'sin-asociar', sin destino y deseleccionada (RN-2)", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: false },
          items: [],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c_nuevo",
          cursoNombre: "Curso Sin Asociar",
          tema: "General",
          idArchivo: "att-x",
          titulo: "Doc.pdf",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].bloqueo).toBe("sin-asociar");
      expect(clases[0].destino).toBeUndefined();
      expect(clases[0].sinAsignar).toBe(false);
      expect(clases[0].seleccionado).toBe(false);
      expect(clases[0].estado).toBe("pending");
    });

    it("ítem omitido -> bloqueo 'omitido', sin destino y deseleccionada", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true },
          items: [
            {
              idArchivo: "att-omit",
              estado: "pendiente",
              rutaDestino: null,
              nombre: null,
              sinAsignar: false,
              omitido: true,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-omit",
          titulo: "Formulario.md",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].bloqueo).toBe("omitido");
      expect(clases[0].destino).toBeUndefined();
      expect(clases[0].sinAsignar).toBe(false);
      expect(clases[0].seleccionado).toBe(false);
    });

    it("asigna c.movido = true cuando itRes.movido es true, y false en cualquier otro caso (AC-1, RN-10)", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true, materia: "Fisica I" },
          items: [
            {
              idArchivo: "att-1",
              estado: "descargado",
              rutaDestino: "Fisica I/Practicas",
              nombre: "Capacitores.pdf",
              sinAsignar: false,
              omitido: false,
              movido: true,
            },
            {
              idArchivo: "att-2",
              estado: "descargado",
              rutaDestino: "Fisica I/Teorias",
              nombre: "Teoria.pdf",
              sinAsignar: false,
              omitido: false,
              movido: false,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c100",
          cursoNombre: "Física I",
          idArchivo: "att-1",
          titulo: "05_capacitores.pdf",
        },
        {
          id: 2,
          sitioId: "google-classroom",
          cursoId: "c100",
          cursoNombre: "Física I",
          idArchivo: "att-2",
          titulo: "Teoria.pdf",
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].movido).toBe(true);
      expect(clases[1].movido).toBe(false);
    });

    it("ítem de videollamada vuelve con omitido: true -> bloqueo 'omitido', sin destino y deseleccionada (RN-A)", async () => {
      const meetId = "acceso:" + encodeURIComponent("https://meet.google.com/abc-defg-hij") + ":Clase%20Meet";
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true },
          items: [
            {
              idArchivo: meetId,
              estado: "pendiente",
              rutaDestino: null,
              nombre: null,
              sinAsignar: false,
              omitido: true,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: meetId,
          titulo: "Clase Meet",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].bloqueo).toBe("omitido");
      expect(clases[0].destino).toBeUndefined();
      expect(clases[0].sinAsignar).toBe(false);
      expect(clases[0].seleccionado).toBe(false);
    });

    it("tema nuevo -> sinAsignar: true (AC-9)", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true },
          items: [
            {
              idArchivo: "att-nuevo-tema",
              estado: "pendiente",
              rutaDestino: "Fisica I/Tema Desconocido",
              nombre: "Archivo.pdf",
              sinAsignar: true,
              omitido: false,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-nuevo-tema",
          titulo: "Archivo.pdf",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].sinAsignar).toBe(true);
      expect(clases[0].bloqueo).toBeUndefined();
      expect(clases[0].destino).toBeDefined();
    });

    it("índice ilegible -> bloqueo total de clases del portal y estado intacto (AC-7)", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: false,
          indiceIlegible: true,
          error: "Sintaxis JSON inválida en .course-downloader.json",
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-1",
          titulo: "Clase 1.pdf",
          estado: "downloaded",
          seleccionado: false,
        },
        {
          id: 2,
          sitioId: "google-classroom",
          cursoId: "c2",
          idArchivo: "att-2",
          titulo: "Clase 2.pdf",
          estado: "pending",
          seleccionado: true,
        },
      ];

      const res = await aplicarEstadoDestino({
        backend,
        sitio: sitioClassroom,
        clases,
      });

      expect(res).toEqual({
        indiceIlegible: "Sintaxis JSON inválida en .course-downloader.json",
      });
      // Ambas clases quedan con bloqueo "indice-ilegible" y sin selección
      expect(clases[0].bloqueo).toBe("indice-ilegible");
      expect(clases[0].seleccionado).toBe(false);
      expect(clases[0].estado).toBe("downloaded"); // Estado intacto!

      expect(clases[1].bloqueo).toBe("indice-ilegible");
      expect(clases[1].seleccionado).toBe(false);
      expect(clases[1].estado).toBe("pending"); // Estado intacto!
    });

    it("una clase en 'process' no se pisa su estado", async () => {
      const backend = {
        estadoDestino: vi.fn().mockResolvedValue({
          ok: true,
          curso: { asociado: true },
          items: [
            {
              idArchivo: "att-1",
              estado: "descargado",
              rutaDestino: "Fisica/Teoria",
              nombre: "Teoria.pdf",
              sinAsignar: false,
              omitido: false,
            },
          ],
        }),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-1",
          titulo: "Teoria.pdf",
          estado: "process",
          seleccionado: false,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].estado).toBe("process");
      expect(clases[0].destino).toBeDefined();
    });

    it("una clase sin cursoId queda con bloqueo 'sin-asociar' y deseleccionada", async () => {
      const backend = {
        estadoDestino: vi.fn(),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          // sin cursoId
          idArchivo: "att-viejo",
          titulo: "Viejo.pdf",
          estado: "pending",
          seleccionado: true,
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(clases[0].bloqueo).toBe("sin-asociar");
      expect(clases[0].destino).toBeUndefined();
      expect(clases[0].seleccionado).toBe(false);
      expect(backend.estadoDestino).not.toHaveBeenCalled();
    });

    it("red caída lanza error hacia afuera para que el llamador active offline", async () => {
      const backend = {
        estadoDestino: vi
          .fn()
          .mockRejectedValue(new TypeError("Failed to fetch")),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-1",
          titulo: "Clase 1.pdf",
        },
      ];

      await expect(
        aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases })
      ).rejects.toThrow("Failed to fetch");
    });

    it("dos cursos realizan dos pedidos en paralelo (D-6)", async () => {
      const backend = {
        estadoDestino: vi.fn().mockImplementation(async (payload) => ({
          ok: true,
          curso: { asociado: true },
          items: [
            {
              idArchivo: payload.items[0]?.idArchivo,
              estado: "pendiente",
              rutaDestino: "Ruta",
              nombre: "Nom.pdf",
              sinAsignar: false,
              omitido: false,
            },
          ],
        })),
      };

      const clases = [
        {
          id: 1,
          sitioId: "google-classroom",
          cursoId: "c1",
          idArchivo: "att-1",
          titulo: "Clase C1.pdf",
        },
        {
          id: 2,
          sitioId: "google-classroom",
          cursoId: "c2",
          idArchivo: "att-2",
          titulo: "Clase C2.pdf",
        },
      ];

      await aplicarEstadoDestino({ backend, sitio: sitioClassroom, clases });

      expect(backend.estadoDestino).toHaveBeenCalledTimes(2);
      expect(backend.estadoDestino).toHaveBeenCalledWith(
        expect.objectContaining({ curso: expect.objectContaining({ id: "c1" }) })
      );
      expect(backend.estadoDestino).toHaveBeenCalledWith(
        expect.objectContaining({ curso: expect.objectContaining({ id: "c2" }) })
      );
    });
  });

  describe("bloquearSeleccion()", () => {
    it("pone seleccionado = false en clases que tienen bloqueo y respeta las demás (D-4)", () => {
      const clases = [
        { id: 1, bloqueo: "sin-asociar", seleccionado: true },
        { id: 2, bloqueo: "indice-ilegible", seleccionado: true },
        { id: 3, bloqueo: "omitido", seleccionado: true },
        { id: 4, bloqueo: undefined, seleccionado: true },
        { id: 5, seleccionado: true },
      ];

      bloquearSeleccion(clases);

      expect(clases[0].seleccionado).toBe(false);
      expect(clases[1].seleccionado).toBe(false);
      expect(clases[2].seleccionado).toBe(false);
      expect(clases[3].seleccionado).toBe(true);
      expect(clases[4].seleccionado).toBe(true);
    });
  });

  describe("puedeBajar()", () => {
    it("devuelve false si tiene bloqueo y true si no lo tiene", () => {
      expect(puedeBajar({ bloqueo: "sin-asociar" })).toBe(false);
      expect(puedeBajar({ bloqueo: "indice-ilegible" })).toBe(false);
      expect(puedeBajar({ bloqueo: "omitido" })).toBe(false);
      expect(puedeBajar({ bloqueo: undefined })).toBe(true);
      expect(puedeBajar({})).toBe(true);
      expect(puedeBajar(null)).toBe(true);
    });
  });

  describe("notasDeDestino()", () => {
    it("sin cursos sin asociar y sin temas sin asignar devuelve cadena vacía (D-4)", () => {
      expect(notasDeDestino([])).toBe("");
      expect(notasDeDestino(null)).toBe("");
      expect(notasDeDestino([
        { id: 1, bloqueo: undefined, sinAsignar: false },
        { id: 2, bloqueo: "omitido", sinAsignar: false },
      ])).toBe("");
    });

    it("uno de cada: une las dos frases en una sola línea con ' · ' (D-4)", () => {
      const clases = [
        { id: 1, bloqueo: "sin-asociar", cursoNombre: "Física II" },
        { id: 2, bloqueo: undefined, sinAsignar: true },
      ];

      const nota = notasDeDestino(clases);
      expect(nota).toBe(
        "1 curso sin asociar: Física II. Abrí 🗂️ para asociarlo. · 1 archivo en temas sin asignar va a la raíz de la materia. Abrí 🗂️ para asignarle carpeta."
      );
    });

    it("maneja singular y plural correctamente para cursos y temas sin asignar", () => {
      // 1 curso sin asociar (singular)
      expect(notasDeDestino([
        { id: 1, bloqueo: "sin-asociar", cursoNombre: "Álgebra" },
        { id: 2, bloqueo: "sin-asociar", cursoNombre: "Álgebra" }, // mismo curso, no duplica
      ])).toBe("1 curso sin asociar: Álgebra. Abrí 🗂️ para asociarlo.");

      // N cursos sin asociar (plural)
      expect(notasDeDestino([
        { id: 1, bloqueo: "sin-asociar", cursoNombre: "Álgebra" },
        { id: 2, bloqueo: "sin-asociar", cursoNombre: "Análisis II" },
      ])).toBe("2 cursos sin asociar: Álgebra, Análisis II. Abrí 🗂️ para asociarlos.");

      // 1 archivo en tema sin asignar (singular)
      expect(notasDeDestino([
        { id: 1, sinAsignar: true },
      ])).toBe("1 archivo en temas sin asignar va a la raíz de la materia. Abrí 🗂️ para asignarle carpeta.");

      // M archivos en temas sin asignar (plural)
      expect(notasDeDestino([
        { id: 1, sinAsignar: true },
        { id: 2, sinAsignar: true },
        { id: 3, sinAsignar: true },
      ])).toBe("3 archivos en temas sin asignar van a la raíz de la materia. Abrí 🗂️ para asignarles carpeta.");
    });

    it("un nombre de curso con <b> queda como texto literal", () => {
      const clases = [
        { id: 1, bloqueo: "sin-asociar", cursoNombre: "<b>Curso Inyectado</b>" },
      ];

      const nota = notasDeDestino(clases);
      expect(nota).toBe(
        "1 curso sin asociar: <b>Curso Inyectado</b>. Abrí 🗂️ para asociarlo."
      );
    });
  });

  describe("cardIndiceIlegible()", () => {
    it("genera la card de error con icono, título y texto «El archivo no se tocó» (D-5)", () => {
      const card = cardIndiceIlegible("Línea 47: falta una coma.");
      expect(card.tipo).toBe("error");
      expect(card.icono).toBe("⛔");
      expect(card.titulo).toBe("No se pudo leer .course-downloader.json");
      expect(card.descripcion).toContain("Línea 47: falta una coma.");
      expect(card.descripcion).toContain("El archivo no se tocó.");
      expect(card.descripcion).toContain("No se va a bajar nada hasta que se arregle.");
    });

    it("la descripción escapa <script> y & preservando la seguridad ante contenido de disco (D-5, U-4)", () => {
      const mensajeMalicioso = '<script>alert("xss")</script> & syntax error en "clave"';
      const card = cardIndiceIlegible(mensajeMalicioso);

      expect(card.descripcion).not.toContain("<script>");
      expect(card.descripcion).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(card.descripcion).toContain("&amp; syntax error");
      expect(card.descripcion).toContain("El archivo no se tocó.");
    });

    it("convierte saltos de línea en <br>", () => {
      const card = cardIndiceIlegible("Error línea 1\nError línea 2");
      expect(card.descripcion).toContain("Error línea 1<br>Error línea 2");
    });
  });

  describe("armarVistos()", () => {
    it("un portal sin destinoPorIndice no arma nada y devuelve null (D-1)", () => {
      expect(armarVistos([{ cursoId: "c1" }], sitioRamonNet)).toBeNull();
      expect(armarVistos([{ cursoId: "c1" }], null)).toBeNull();
    });

    it("agrupa clases por cursoId y omite clases sin cursoId contándolas en sinCurso (D-3)", () => {
      const clases = [
        {
          sitioId: "google-classroom",
          cursoId: "c1",
          cursoNombre: "Física II",
          idArchivo: "a1",
          titulo: "Guía 1",
          tema: "TP 1",
          publicacion: "Pub 1",
          anuncio: "Anuncio 1",
          bytes: 1024,
          tipo: "adjunto",
        },
        {
          sitioId: "google-classroom",
          cursoId: "c1",
          cursoNombre: "Física II",
          idArchivo: "a2",
          titulo: "Guía 2",
          tema: "TP 1",
        },
        {
          sitioId: "google-classroom",
          cursoId: "c2",
          cursoNombre: "Química",
          idArchivo: "a3",
          titulo: "Teoría 1",
        },
        {
          sitioId: "google-classroom",
          cursoId: null,
          idArchivo: "a4",
          titulo: "Huérfana",
        },
      ];

      const res = armarVistos(clases, sitioClassroom);
      expect(res.sinCurso).toBe(1);
      expect(res.cursos).toHaveLength(2);
      expect(res.cursos[0].id).toBe("c1");
      expect(res.cursos[0].nombre).toBe("Física II");
      expect(res.cursos[0].items).toHaveLength(2);
      expect(res.cursos[0].items[0]).toEqual({
        idArchivo: "a1",
        original: "Guía 1",
        tema: "TP 1",
        publicacion: "Pub 1",
        anuncio: "Anuncio 1",
        bytes: 1024,
        tipo: "adjunto",
      });
      expect(res.cursos[1].id).toBe("c2");
      expect(res.cursos[1].nombre).toBe("Química");
      expect(res.cursos[1].items).toHaveLength(1);
    });

    it("sin clases devuelve cursos vacío y sinCurso 0", () => {
      expect(armarVistos([], sitioClassroom)).toEqual({ cursos: [], sinCurso: 0 });
      expect(armarVistos(null, sitioClassroom)).toEqual({ cursos: [], sinCurso: 0 });
    });
  });

  describe("cursoParaEditor()", () => {
    it("un portal sin destinoPorIndice no arma nada y devuelve null (D-1)", () => {
      expect(cursoParaEditor({ clases: [{ cursoId: "c1" }], claveListado: "todos", sitio: sitioRamonNet })).toBeNull();
      expect(cursoParaEditor({ clases: [{ cursoId: "c1" }], claveListado: "c1", sitio: null })).toBeNull();
    });

    it("un solo curso: abre ese curso directamente (D-2)", () => {
      expect(cursoParaEditor({ clases: [{ cursoId: "c1" }], claveListado: "c1", sitio: sitioClassroom })).toBe("google-classroom:c1");
      expect(cursoParaEditor({ clases: [{ cursoId: "c1" }], claveListado: "google-classroom:c1", sitio: sitioClassroom })).toBe("google-classroom:c1");
    });

    it("lista de «todos» con uno sin asociar y otro asociado: abre el sin asociar (D-2)", () => {
      const clases = [
        { sitioId: "google-classroom", cursoId: "c1", bloqueo: undefined },
        { sitioId: "google-classroom", cursoId: "c2", bloqueo: "sin-asociar" },
      ];
      expect(cursoParaEditor({ clases, claveListado: "todos", sitio: sitioClassroom })).toBe("google-classroom:c2");
    });

    it("lista de «todos» con todos asociados: abre el primero (D-2)", () => {
      const clases = [
        { sitioId: "google-classroom", cursoId: "c1", bloqueo: undefined },
        { sitioId: "google-classroom", cursoId: "c2", bloqueo: undefined },
      ];
      expect(cursoParaEditor({ clases, claveListado: "todos", sitio: sitioClassroom })).toBe("google-classroom:c1");
    });

    it("clases sin cursoId se ignoran y no fallan", () => {
      const clases = [
        { sitioId: "google-classroom", cursoId: null, bloqueo: "sin-asociar" },
        { sitioId: "google-classroom", cursoId: "c3", bloqueo: "sin-asociar" },
      ];
      expect(cursoParaEditor({ clases, claveListado: "todos", sitio: sitioClassroom })).toBe("google-classroom:c3");
    });

    it("sin clases con cursoId devuelve null", () => {
      expect(cursoParaEditor({ clases: [], claveListado: "todos", sitio: sitioClassroom })).toBeNull();
      expect(cursoParaEditor({ clases: [{ cursoId: null }], claveListado: "todos", sitio: sitioClassroom })).toBeNull();
    });
  });

  describe("compararPrioridadDestino()", () => {
    it("antepone ítems con sinAsignar: true frente a normales (D-2)", () => {
      const normal = { id: 1, sinAsignar: false, titulo: "Clase A" };
      const sinAsignar = { id: 2, sinAsignar: true, titulo: "Clase B" };

      expect(compararPrioridadDestino(normal, sinAsignar)).toBeGreaterThan(0);
      expect(compararPrioridadDestino(sinAsignar, normal)).toBeLessThan(0);
      expect(compararPrioridadDestino(sinAsignar, sinAsignar)).toBe(0);
      expect(compararPrioridadDestino(normal, normal)).toBe(0);
    });

    it("ordena un array colocando primero los ítems con sinAsignar (D-2)", () => {
      const lista = [
        { id: 1, titulo: "Normal 1", sinAsignar: false },
        { id: 2, titulo: "Sin asignar 1", sinAsignar: true },
        { id: 3, titulo: "Normal 2", sinAsignar: false },
        { id: 4, titulo: "Sin asignar 2", sinAsignar: true },
      ];

      lista.sort(compararPrioridadDestino);

      expect(lista.map((x) => x.id)).toEqual([2, 4, 1, 3]);
    });

    it("desempata dentro de un curso manteniendo el orden de los ítems con sinAsignar arriba", () => {
      const lista = [
        { id: 1, curso: "Fisica 2", titulo: "TP 1", sinAsignar: false },
        { id: 2, curso: "Fisica 2", titulo: "SIU Examen", sinAsignar: true },
        { id: 3, curso: "Fisica 2", titulo: "TP 2", sinAsignar: false },
      ];

      lista.sort((a, b) => {
        const diffSin = compararPrioridadDestino(a, b);
        if (diffSin !== 0) return diffSin;
        return a.titulo.localeCompare(b.titulo);
      });

      expect(lista.map((x) => x.id)).toEqual([2, 1, 3]);
    });

    it("antepone ítems con esVideollamada frente a sinAsignar y normales (D-4, RN-32)", () => {
      const normal = { id: 1, sinAsignar: false, esVideollamada: false, titulo: "Clase Normal" };
      const sinAsignar = { id: 2, sinAsignar: true, esVideollamada: false, titulo: "Tema Suelto" };
      const videollamada = { id: 3, sinAsignar: false, esVideollamada: true, titulo: "Consulta Meet" };

      expect(compararPrioridadDestino(sinAsignar, videollamada)).toBeGreaterThan(0);
      expect(compararPrioridadDestino(videollamada, sinAsignar)).toBeLessThan(0);
      expect(compararPrioridadDestino(normal, videollamada)).toBeGreaterThan(0);
      expect(compararPrioridadDestino(videollamada, normal)).toBeLessThan(0);
      expect(compararPrioridadDestino(videollamada, videollamada)).toBe(0);
    });

    it("con ítems normales, sin asignar y videollamada del mismo curso el orden es videollamada → sin asignar → resto (D-4)", () => {
      const lista = [
        { id: 1, titulo: "Normal A", sinAsignar: false, esVideollamada: false },
        { id: 2, titulo: "Sin asignar A", sinAsignar: true, esVideollamada: false },
        { id: 3, titulo: "Videollamada A", sinAsignar: false, esVideollamada: true },
        { id: 4, titulo: "Normal B", sinAsignar: false, esVideollamada: false },
        { id: 5, titulo: "Videollamada B", sinAsignar: false, esVideollamada: true },
        { id: 6, titulo: "Sin asignar B", sinAsignar: true, esVideollamada: false },
      ];

      lista.sort(compararPrioridadDestino);

      expect(lista.map((x) => x.id)).toEqual([3, 5, 2, 6, 1, 4]);
    });

    it("entre cursos distintos el comparador respeta la partición de cursos de popup.js", () => {
      const curso1 = "Álgebra";
      const curso2 = "Física";
      const indiceCurso = new Map([[curso1, 0], [curso2, 1]]);

      const lista = [
        { id: 1, curso: curso2, titulo: "Física Video", esVideollamada: true },
        { id: 2, curso: curso1, titulo: "Álgebra Normal", esVideollamada: false },
        { id: 3, curso: curso1, titulo: "Álgebra Video", esVideollamada: true },
        { id: 4, curso: curso2, titulo: "Física SinAsignar", sinAsignar: true },
      ];

      lista.sort((a, b) => {
        const idxA = indiceCurso.get(a.curso) ?? 999999;
        const idxB = indiceCurso.get(b.curso) ?? 999999;
        if (idxA !== idxB) return idxA - idxB;
        const diffSin = compararPrioridadDestino(a, b);
        if (diffSin !== 0) return diffSin;
        return a.titulo.localeCompare(b.titulo);
      });

      expect(lista.map((x) => x.id)).toEqual([3, 2, 1, 4]);
    });
  });
});
