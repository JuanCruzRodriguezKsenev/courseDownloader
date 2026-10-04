import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { validarDestino, finalizarEnDestino } from "./escritura.js";
import { leerIndice } from "./indiceServicio.js";
import { limpiarCacheMd5 } from "./md5.js";

describe("backend/destino/escritura.js", () => {
  let raiz = "";

  beforeEach(async () => {
    limpiarCacheMd5();
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-escritura-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (raiz) {
      await fs.rm(raiz, { recursive: true, force: true }).catch(() => {});
    }
  });

  describe("validarDestino", () => {
    it("materia inexistente -> ok: false, codigo: MATERIA_INEXISTENTE (D-3, RN-1)", async () => {
      const res = await validarDestino({
        raiz,
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "01_clase.pdf",
        materia: "Ingenieria/Fisica 2",
      });

      expect(res.ok).toBe(false);
      expect(res.codigo).toBe("MATERIA_INEXISTENTE");
    });

    it("ruta con .. -> ok: false, codigo: RUTA_INSEGURA (D-2)", async () => {
      await fs.mkdir(path.join(raiz, "Ingenieria", "Fisica 2"), { recursive: true });

      const res = await validarDestino({
        raiz,
        ruta: "Ingenieria/Fisica 2/../Insegura",
        nombre: "01_clase.pdf",
        materia: "Ingenieria/Fisica 2",
      });

      expect(res.ok).toBe(false);
      expect(res.codigo).toBe("RUTA_INSEGURA");
    });

    it("el nombre con + queda guardado como _ en nombreFinal (D-2)", async () => {
      await fs.mkdir(path.join(raiz, "Ingenieria", "Fisica 2"), { recursive: true });

      const res = await validarDestino({
        raiz,
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "Guia+De+Problemas.pdf",
        materia: "Ingenieria/Fisica 2",
      });

      expect(res.ok).toBe(true);
      expect(res.nombreFinal).toBe("Guia_De_Problemas.pdf");
      expect(res.carpetaAbs).toBe(path.resolve(raiz, "Ingenieria/Fisica 2/Teorias"));
      expect(res.archivoAbs).toBe(path.resolve(raiz, "Ingenieria/Fisica 2/Teorias/Guia_De_Problemas.pdf"));
    });
  });

  describe("finalizarEnDestino", () => {
    it("AC-1: archivo nuevo -> se escribe en la carpeta y se anota ruta y md5 en el índice", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Teorias/Palacio";
      const carpetaAbs = path.join(raiz, rutaRel);
      const nombreFinal = "05_capacitores.pdf";
      const archivoAbs = path.join(carpetaAbs, nombreFinal);
      const parcial = path.join(raiz, "tmp.part");

      await fs.writeFile(parcial, "contenido_de_capacitores", "utf8");

      const resultado = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs,
        nombreFinal,
        claveArchivo: "google-classroom:1a2b3c",
        claveCurso: "google-classroom:ODc0",
        original: "Palacio - Clase 5 - Capacitores.pdf",
        rutaRelativa: rutaRel,
      });

      expect(resultado).toBe("escrito");
      expect(fsSync.existsSync(archivoAbs)).toBe(true);
      expect(fsSync.existsSync(parcial)).toBe(false);

      const indice = await leerIndice(raiz);
      const entrada = indice.archivos["google-classroom:1a2b3c"];
      expect(entrada).toBeDefined();
      expect(entrada.curso).toBe("google-classroom:ODc0");
      expect(entrada.nombre).toBe("05_capacitores.pdf");
      expect(entrada.ruta).toBe(rutaRel);
      expect(entrada.original).toBe("Palacio - Clase 5 - Capacitores.pdf");
      expect(entrada.md5).toBeDefined();
    });

    it("AC-2: existe un archivo de igual md5 y otro nombre en la carpeta -> no se escribe nada nuevo, el índice apunta al existente", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Laboratorios";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      const existenteAbs = path.join(carpetaAbs, "F2-G22-Lab_1-Grupos de trabajo.pdf");
      const contenidoComun = "contenido_del_laboratorio_1";
      await fs.writeFile(existenteAbs, contenidoComun, "utf8");

      const nombrePropuesto = "lab_1_grupos.pdf";
      const archivoAbs = path.join(carpetaAbs, nombrePropuesto);
      const parcial = path.join(carpetaAbs, "descarga.part");
      await fs.writeFile(parcial, contenidoComun, "utf8");

      const resultado = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs,
        nombreFinal: nombrePropuesto,
        claveArchivo: "google-classroom:lab1",
        claveCurso: "google-classroom:ODc0",
        original: "Lab 1 Grupos.pdf",
        rutaRelativa: rutaRel,
      });

      expect(resultado).toBe("descartado");
      // No debe existir archivo con el nombre propuesto, solo el existente
      expect(fsSync.existsSync(archivoAbs)).toBe(false);
      expect(fsSync.existsSync(existenteAbs)).toBe(true);
      expect(fsSync.existsSync(parcial)).toBe(false);

      const indice = await leerIndice(raiz);
      const entrada = indice.archivos["google-classroom:lab1"];
      expect(entrada.nombre).toBe("F2-G22-Lab_1-Grupos de trabajo.pdf");
      expect(entrada.ruta).toBe(rutaRel);
    });

    it("AC-3: archivo renombrado por el dueño, mismo md5 -> no se escribe nuevo y se descarta", async () => {
      const rutaRel = "Ingenieria/Fisica 1/Teorias";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      const archivoRenombrado = path.join(carpetaAbs, "mod1_06_trabajo_y_energia.pdf");
      const contenido = "datos_trabajo_y_energia";
      await fs.writeFile(archivoRenombrado, contenido, "utf8");

      const parcial = path.join(carpetaAbs, "nuevo.part");
      await fs.writeFile(parcial, contenido, "utf8");

      const resultado = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "teoria_trabajo_energia.pdf"),
        nombreFinal: "teoria_trabajo_energia.pdf",
        claveArchivo: "google-classroom:f1_t6",
        claveCurso: "google-classroom:f1",
        original: "Teoria Grupo G-Trabajo_energia cinetica y potencia.pdf",
        rutaRelativa: rutaRel,
      });

      expect(resultado).toBe("descartado");
      expect(fsSync.existsSync(parcial)).toBe(false);

      const indice = await leerIndice(raiz);
      expect(indice.archivos["google-classroom:f1_t6"].nombre).toBe("mod1_06_trabajo_y_energia.pdf");
    });

    it("AC-6: id en el índice, archivo ausente -> se escribe con el nombre del índice", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Teorias/Palacio";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      // Preparar índice con un nombre personalizado previo
      const { modificarIndice } = await import("./indiceServicio.js");
      await modificarIndice(raiz, (ind) => {
        ind.archivos["google-classroom:1a2b3c"] = {
          curso: "google-classroom:ODc0",
          nombre: "05_capacitores_editado_por_dueno.pdf",
          ruta: rutaRel,
          md5: "md5_viejo",
          original: "Palacio - Clase 5 - Capacitores.pdf",
        };
      });

      const parcial = path.join(carpetaAbs, "tmp.part");
      await fs.writeFile(parcial, "contenido_recuperado", "utf8");

      // La extensión viene con el nombre por defecto saneado
      const resultado = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "05_capacitores.pdf"),
        nombreFinal: "05_capacitores.pdf",
        claveArchivo: "google-classroom:1a2b3c",
        claveCurso: "google-classroom:ODc0",
        original: "Palacio - Clase 5 - Capacitores.pdf",
        rutaRelativa: rutaRel,
      });

      expect(resultado).toBe("escrito");
      // Debe haberse escrito con el nombre que estaba en el índice
      const esperadoAbs = path.join(carpetaAbs, "05_capacitores_editado_por_dueno.pdf");
      expect(fsSync.existsSync(esperadoAbs)).toBe(true);
      expect(fsSync.existsSync(path.join(carpetaAbs, "05_capacitores.pdf"))).toBe(false);

      const indice = await leerIndice(raiz);
      expect(indice.archivos["google-classroom:1a2b3c"].nombre).toBe("05_capacitores_editado_por_dueno.pdf");
    });

    it("AC-12: dos accesos con el mismo vínculo y títulos distintos -> dos archivos y dos entradas", async () => {
      const rutaRel = "Ingenieria/Fisica 1/Teorias";
      const carpetaAbs = path.join(raiz, rutaRel);

      const parcial1 = path.join(raiz, "acc1.part");
      const parcial2 = path.join(raiz, "acc2.part");
      await fs.writeFile(parcial1, "# Acceso 1", "utf8");
      await fs.writeFile(parcial2, "# Acceso 2", "utf8");

      const res1 = await finalizarEnDestino({
        raiz,
        parcial: parcial1,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "resortes_horizontales.md"),
        nombreFinal: "resortes_horizontales.md",
        claveArchivo: "google-classroom:acceso:http://simulador:Resortes horizontales",
        claveCurso: "google-classroom:f1",
        original: "Resortes horizontales",
        rutaRelativa: rutaRel,
      });

      const res2 = await finalizarEnDestino({
        raiz,
        parcial: parcial2,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "simulador_de_resortes_clase_iii.md"),
        nombreFinal: "simulador_de_resortes_clase_iii.md",
        claveArchivo: "google-classroom:acceso:http://simulador:Simulador de resortes-Clase III",
        claveCurso: "google-classroom:f1",
        original: "Simulador de resortes-Clase III",
        rutaRelativa: rutaRel,
      });

      expect(res1).toBe("escrito");
      expect(res2).toBe("escrito");

      expect(fsSync.existsSync(path.join(carpetaAbs, "resortes_horizontales.md"))).toBe(true);
      expect(fsSync.existsSync(path.join(carpetaAbs, "simulador_de_resortes_clase_iii.md"))).toBe(true);

      const indice = await leerIndice(raiz);
      expect(indice.archivos["google-classroom:acceso:http://simulador:Resortes horizontales"]).toBeDefined();
      expect(indice.archivos["google-classroom:acceso:http://simulador:Simulador de resortes-Clase III"]).toBeDefined();
    });

    it("AC-13: .md existente con notas -> intacto, md5 distinto ignorado, entrada anotada (RN-30)", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Teorias";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      const archivoAbs = path.join(carpetaAbs, "campo_electrico.md");
      const notasDueno = "# Mis notas personalizadas sobre campo eléctrico\nNo borrar!";
      await fs.writeFile(archivoAbs, notasDueno, "utf8");

      const parcial = path.join(raiz, "nuevo.part");
      await fs.writeFile(parcial, "contenido_original_generado_por_extension", "utf8");

      const resultado = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs,
        nombreFinal: "campo_electrico.md",
        claveArchivo: "google-classroom:acceso:campo:Campo electrico",
        claveCurso: "google-classroom:f2",
        original: "Campo eléctrico",
        rutaRelativa: rutaRel,
      });

      expect(resultado).toBe("existente");
      expect(fsSync.existsSync(parcial)).toBe(false);
      // El archivo .md en disco no fue tocado
      expect(await fs.readFile(archivoAbs, "utf8")).toBe(notasDueno);

      const indice = await leerIndice(raiz);
      const entrada = indice.archivos["google-classroom:acceso:campo:Campo electrico"];
      expect(entrada).toBeDefined();
      expect(entrada.nombre).toBe("campo_electrico.md");
    });

    it("D-7: otro contenido en el destino -> DESTINO_OCUPADO, archivo intacto, sin .part (NFR-4)", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Teorias";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      const archivoAbs = path.join(carpetaAbs, "01_clase.pdf");
      const contenidoPrevio = "archivo_previo_ocupante";
      await fs.writeFile(archivoAbs, contenidoPrevio, "utf8");

      const parcial = path.join(raiz, "choque.part");
      await fs.writeFile(parcial, "contenido_totalmente_distinto", "utf8");

      await expect(
        finalizarEnDestino({
          raiz,
          parcial,
          carpetaAbs,
          archivoAbs,
          nombreFinal: "01_clase.pdf",
          claveArchivo: "google-classroom:nueva_clase",
          claveCurso: "google-classroom:f2",
          original: "Clase 1.pdf",
          rutaRelativa: rutaRel,
        })
      ).rejects.toMatchObject({ codigo: "DESTINO_OCUPADO" });

      expect(fsSync.existsSync(parcial)).toBe(false);
      expect(await fs.readFile(archivoAbs, "utf8")).toBe(contenidoPrevio);
    });

    it("D-8: archivos en la carpeta de tamaño distinto no se hashean", async () => {
      const rutaRel = "Ingenieria/Fisica 2/Practicas";
      const carpetaAbs = path.join(raiz, rutaRel);
      await fs.mkdir(carpetaAbs, { recursive: true });

      // Archivo con tamaño diferente (20 bytes)
      await fs.writeFile(path.join(carpetaAbs, "otro_grande.pdf"), "12345678901234567890", "utf8");

      const parcial = path.join(raiz, "parcial.part");
      // Archivo parcial con 5 bytes
      await fs.writeFile(parcial, "12345", "utf8");

      let llamadasHasher = 0;
      const hasherSpy = vi.fn(async () => {
        llamadasHasher++;
        return "md5_falso";
      });

      const res = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "nuevo.pdf"),
        nombreFinal: "nuevo.pdf",
        claveArchivo: "google-classroom:p1",
        claveCurso: "google-classroom:f2",
        original: "Practica 1.pdf",
        rutaRelativa: rutaRel,
        opciones: { hasher: hasherSpy },
      });

      expect(res).toBe("escrito");
      // Solo debió hashearse el .part (1 vez). El archivo 'otro_grande.pdf' fue descartado por tamaño antes del hash
      expect(llamadasHasher).toBe(1);
    });

    it("materia inexistente en disco -> finalizarEnDestino crea la carpeta y escribe el archivo (D-5)", async () => {
      const rutaRel = "Informatica/Algoritmos/Teorias";
      const carpetaAbs = path.join(raiz, rutaRel);
      const parcial = path.join(raiz, "algo.part");
      await fs.writeFile(parcial, "contenido_algoritmos", "utf8");

      const res = await finalizarEnDestino({
        raiz,
        parcial,
        carpetaAbs,
        archivoAbs: path.join(carpetaAbs, "teoria1.pdf"),
        nombreFinal: "teoria1.pdf",
        claveArchivo: "google-classroom:alg1",
        claveCurso: "google-classroom:c_alg",
        original: "Teoria 1.pdf",
        rutaRelativa: rutaRel,
      });

      expect(res).toBe("escrito");
      expect(fsSync.existsSync(path.join(carpetaAbs, "teoria1.pdf"))).toBe(true);
      expect(await fs.readFile(path.join(carpetaAbs, "teoria1.pdf"), "utf8")).toBe("contenido_algoritmos");
    });
  });
});
