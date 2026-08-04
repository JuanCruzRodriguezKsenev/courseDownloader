/**
 * Tests del adaptador en memoria del puerto de programación.
 *
 * Vale la misma advertencia que para `AlmacenamientoEnMemoria`: si el doble miente (si
 * reprogramar acumulara disparos, o si cancelar no desprogramara), los tests que lo usen
 * pasarían verificando algo que en el navegador no pasa. Por eso el doble tiene tests propios.
 */
import { describe, it, expect, vi } from "vitest";
import { ProgramadorEnMemoria } from "./programadorEnMemoria";

describe("ProgramadorEnMemoria", () => {
  it("programar registra el nombre con su período", () => {
    const prog = new ProgramadorEnMemoria();
    prog.programar("autoheal", { periodoMin: 0.2 });

    expect(prog.estaProgramada("autoheal")).toBe(true);
    expect(prog.periodoDe("autoheal")).toBe(0.2);
  });

  it("reprogramar el mismo nombre REEMPLAZA, no acumula (idempotencia por nombre)", () => {
    const prog = new ProgramadorEnMemoria();
    prog.programar("autoheal", { periodoMin: 0.2 });
    prog.programar("autoheal", { periodoMin: 1 });

    expect(prog.nombresProgramados()).toEqual(["autoheal"]);
    expect(prog.periodoDe("autoheal")).toBe(1);
  });

  it("un disparo llega a todos los oyentes con el nombre", () => {
    const prog = new ProgramadorEnMemoria();
    const a = vi.fn();
    const b = vi.fn();
    prog.onDisparo(a);
    prog.onDisparo(b);
    prog.programar("autoheal", { periodoMin: 0.2 });

    expect(prog.dispararAhora("autoheal")).toBe(true);
    expect(a).toHaveBeenCalledWith("autoheal");
    expect(b).toHaveBeenCalledWith("autoheal");
  });

  it("cancelar desprograma: el disparo ya no notifica a nadie", () => {
    const prog = new ProgramadorEnMemoria();
    const cb = vi.fn();
    prog.onDisparo(cb);
    prog.programar("autoheal", { periodoMin: 0.2 });
    prog.cancelar("autoheal");

    expect(prog.dispararAhora("autoheal")).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("cancelar algo que no existe no falla", () => {
    const prog = new ProgramadorEnMemoria();
    expect(() => prog.cancelar("no-existe")).not.toThrow();
  });

  it("la función devuelta por onDisparo desregistra", () => {
    const prog = new ProgramadorEnMemoria();
    const cb = vi.fn();
    const off = prog.onDisparo(cb);
    prog.programar("autoheal", { periodoMin: 0.2 });
    off();

    prog.dispararAhora("autoheal");
    expect(cb).not.toHaveBeenCalled();
  });

  it("dispararAhora sobre un nombre nunca programado devuelve false", () => {
    const prog = new ProgramadorEnMemoria();
    prog.onDisparo(vi.fn());
    expect(prog.dispararAhora("fantasma")).toBe(false);
  });
});
