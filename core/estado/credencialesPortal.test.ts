import { describe, it, expect } from "vitest";
import { crearCredencialesPortal, CLAVE_CREDENCIALES } from "./credencialesPortal";
import { AlmacenamientoEnMemoria } from "../puertos/almacenamientoEnMemoria";

/**
 * Sin mocks de `chrome.*`: corre contra el adaptador en memoria del puerto, como el resto
 * del núcleo desde la Fase 5b.
 */
describe("credencialesPortal", () => {
  it("devuelve undefined cuando nunca se guardó nada", async () => {
    const creds = crearCredencialesPortal(new AlmacenamientoEnMemoria());
    expect(await creds.para("anatomy-by-chris")).toBeUndefined();
  });

  it("guarda y devuelve las credenciales de un portal", async () => {
    const creds = crearCredencialesPortal(new AlmacenamientoEnMemoria());
    await creds.guardar("anatomy-by-chris", { idToken: "jwt-123", productId: "6083220" });
    expect(await creds.para("anatomy-by-chris")).toEqual({
      idToken: "jwt-123",
      productId: "6083220",
    });
  });

  it("guardar un portal NO pisa las de otro", async () => {
    const creds = crearCredencialesPortal(new AlmacenamientoEnMemoria());
    await creds.guardar("anatomy-by-chris", { idToken: "jwt-A" });
    await creds.guardar("otroportal", { idToken: "jwt-B" });

    expect(await creds.para("anatomy-by-chris")).toEqual({ idToken: "jwt-A" });
    expect(await creds.para("otroportal")).toEqual({ idToken: "jwt-B" });
  });

  it("re-escanear un portal REEMPLAZA sus credenciales, no las mezcla", async () => {
    // El caso real: el id_token se renovó en la pestaña y el escaneo trae el nuevo. Si esto
    // hiciera merge, un campo que el portal dejó de emitir sobreviviría para siempre.
    const creds = crearCredencialesPortal(new AlmacenamientoEnMemoria());
    await creds.guardar("anatomy-by-chris", { idToken: "viejo", extra: "x" });
    await creds.guardar("anatomy-by-chris", { idToken: "nuevo" });

    expect(await creds.para("anatomy-by-chris")).toEqual({ idToken: "nuevo" });
  });

  it("guardar undefined borra las de ese portal y deja las de los demás", async () => {
    const creds = crearCredencialesPortal(new AlmacenamientoEnMemoria());
    await creds.guardar("anatomy-by-chris", { idToken: "jwt-A" });
    await creds.guardar("otroportal", { idToken: "jwt-B" });

    await creds.guardar("anatomy-by-chris", undefined);

    expect(await creds.para("anatomy-by-chris")).toBeUndefined();
    expect(await creds.para("otroportal")).toEqual({ idToken: "jwt-B" });
  });

  it("un objeto vacío se trata como 'no hay', al guardar y al leer", async () => {
    // Devolver `{}` haría que el adaptador saliera a hacer el fetch igual y cobrara un 400
    // que no parece de auth — exactamente lo que costó tiempo midiendo este portal.
    const almacenamiento = new AlmacenamientoEnMemoria();
    const creds = crearCredencialesPortal(almacenamiento);

    await creds.guardar("anatomy-by-chris", {});
    expect(await creds.para("anatomy-by-chris")).toBeUndefined();

    await almacenamiento.guardarLocal({ [CLAVE_CREDENCIALES]: { "anatomy-by-chris": {} } });
    expect(await creds.para("anatomy-by-chris")).toBeUndefined();
  });

  it("sin sitioId no lee ni escribe nada", async () => {
    const almacenamiento = new AlmacenamientoEnMemoria();
    const creds = crearCredencialesPortal(almacenamiento);

    expect(await creds.para(undefined)).toBeUndefined();
    await creds.guardar(undefined, { idToken: "jwt" });

    const datos = await almacenamiento.obtenerLocal([CLAVE_CREDENCIALES]);
    expect(datos[CLAVE_CREDENCIALES]).toBeUndefined();
  });

  it("tolera una clave corrupta en storage sin tirar", async () => {
    const almacenamiento = new AlmacenamientoEnMemoria();
    await almacenamiento.guardarLocal({ [CLAVE_CREDENCIALES]: "no-soy-un-mapa" });
    const creds = crearCredencialesPortal(almacenamiento);

    expect(await creds.para("anatomy-by-chris")).toBeUndefined();
    await creds.guardar("anatomy-by-chris", { idToken: "jwt" });
    expect(await creds.para("anatomy-by-chris")).toEqual({ idToken: "jwt" });
  });
});
