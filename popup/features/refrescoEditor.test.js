import { describe, it, expect, vi } from "vitest";
import { crearControlRefrescoEditor } from "./refrescoEditor.js";

describe("popup/features/refrescoEditor.js", () => {
  it("no refresca si la bandera editorAbierto no está activa", () => {
    const sincronizar = vi.fn();
    const marcarIncompleta = vi.fn();
    const control = crearControlRefrescoEditor({
      hayLista: () => true,
      estaOffline: () => false,
      sincronizar,
      marcarSincronizacionIncompleta: marcarIncompleta,
    });

    const res = control.refrescarTrasEditor();
    expect(res).toBe(false);
    expect(sincronizar).not.toHaveBeenCalled();
    expect(marcarIncompleta).not.toHaveBeenCalled();
  });

  it("refresca con bandera activa, la consume y evita doble disparo", () => {
    const sincronizar = vi.fn();
    const marcarIncompleta = vi.fn();
    const control = crearControlRefrescoEditor({
      hayLista: () => true,
      estaOffline: () => false,
      sincronizar,
      marcarSincronizacionIncompleta: marcarIncompleta,
    });

    control.marcarEditorAbierto();
    expect(control.estaEditorAbierto()).toBe(true);

    // Primer disparo (ej. visibilitychange)
    const primerRes = control.refrescarTrasEditor();
    expect(primerRes).toBe(true);
    expect(control.estaEditorAbierto()).toBe(false);
    expect(marcarIncompleta).toHaveBeenCalledTimes(1);
    expect(sincronizar).toHaveBeenCalledTimes(1);

    // Segundo disparo inmediato (ej. window focus)
    const segundoRes = control.refrescarTrasEditor();
    expect(segundoRes).toBe(false);
    expect(marcarIncompleta).toHaveBeenCalledTimes(1);
    expect(sincronizar).toHaveBeenCalledTimes(1);
  });

  it("no refresca si no hay lista cargada aunque la bandera esté activa", () => {
    const sincronizar = vi.fn();
    const marcarIncompleta = vi.fn();
    const control = crearControlRefrescoEditor({
      hayLista: () => false,
      estaOffline: () => false,
      sincronizar,
      marcarSincronizacionIncompleta: marcarIncompleta,
    });

    control.marcarEditorAbierto();
    const res = control.refrescarTrasEditor();
    expect(res).toBe(false);
    expect(control.estaEditorAbierto()).toBe(false); // la bandera se consume igual
    expect(sincronizar).not.toHaveBeenCalled();
    expect(marcarIncompleta).not.toHaveBeenCalled();
  });

  it("no refresca si está offline aunque la bandera esté activa", () => {
    const sincronizar = vi.fn();
    const marcarIncompleta = vi.fn();
    const control = crearControlRefrescoEditor({
      hayLista: () => true,
      estaOffline: () => true,
      sincronizar,
      marcarSincronizacionIncompleta: marcarIncompleta,
    });

    control.marcarEditorAbierto();
    const res = control.refrescarTrasEditor();
    expect(res).toBe(false);
    expect(control.estaEditorAbierto()).toBe(false); // la bandera se consume igual
    expect(sincronizar).not.toHaveBeenCalled();
    expect(marcarIncompleta).not.toHaveBeenCalled();
  });
});
