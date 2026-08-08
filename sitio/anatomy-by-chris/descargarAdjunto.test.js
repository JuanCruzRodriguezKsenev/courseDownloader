/**
 * Tests de la firma de un adjunto de Anatomy by Chris (corte 5).
 *
 * Lo que se fija acá es sobre todo **el tipado de los errores**, que no es cosmético: el bucle
 * hace tres cosas MUY distintas según cómo venga tipado (pausar sin auto-heal, saltear la clase,
 * pausar con auto-heal), y elegir mal deja al usuario con un cartel que no le dice qué hacer o
 * con una cola que se vacía sola.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DescargarAdjuntoAnatomy from './descargarAdjunto.js';

const ID = '641db8a0-b918-4460-b007-a001b9f79bb5';
const CREDS = { idToken: 'ID_TOKEN_FALSO' };
const FIRMADA =
  'https://hotmart-club-files.cb.hotmart.com/membership_area/x/y.pdf?Expires=1&Signature=s';

function responder(cuerpo, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => responder({ url: FIRMADA }));
afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe('DescargarAdjuntoAnatomy.resolver — el camino feliz', () => {
  it('pega al host de la API de adjuntos con el Bearer', async () => {
    const fetchMock = responder({ url: FIRMADA });
    await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS);

    const [url, opciones] = fetchMock.mock.calls[0];
    // OJO: es OTRO host que el de las lecciones (`hot-club-api`, no el gateway). Ese descuido es
    // la mitad del 403 que dio el primer PDF: el host no estaba en `host_permissions`.
    expect(url).toBe(
      `https://api-club-hot-club-api.cb.hotmart.com/rest/v3/attachment/${ID}/download`
    );
    expect(opciones.headers.Authorization).toBe('Bearer ID_TOKEN_FALSO');
  });

  it('manda x-product-id cuando el descriptor se lo pasa', async () => {
    // La otra mitad del 403. El club identifica al producto por header en todas sus llamadas, y
    // la primera versión de este módulo no lo mandaba.
    const fetchMock = responder({ url: FIRMADA });
    await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS, '6083220');

    expect(fetchMock.mock.calls[0][1].headers['x-product-id']).toBe('6083220');
  });

  it('sin productId no manda el header vacío: lo omite', async () => {
    // Un `x-product-id: ""` es peor que no mandarlo — una API que valida el header lo rechaza
    // con 400, y eso se lee como otra cosa.
    const fetchMock = responder({ url: FIRMADA });
    await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS);

    expect('x-product-id' in fetchMock.mock.calls[0][1].headers).toBe(false);
  });

  it('devuelve la URL firmada', async () => {
    expect(await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).toBe(FIRMADA);
  });

  it('acepta la URL como string pelado, no sólo envuelta en JSON', async () => {
    // La medición observó el resultado final de la cadena, no la envoltura exacta de este paso.
    // Aceptar las dos formas es preferible a adivinar una — y si no aparece, se dice qué llegó.
    responder(FIRMADA);
    expect(await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).toBe(FIRMADA);
  });

  it('acepta las envolturas habituales (downloadUrl / signedUrl / link)', async () => {
    for (const clave of ['downloadUrl', 'signedUrl', 'link']) {
      responder({ [clave]: FIRMADA });
      expect(await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).toBe(FIRMADA);
    }
  });
});

describe('DescargarAdjuntoAnatomy.resolver — los fallos, y con qué tipo', () => {
  it('sin id_token pide RE-ESCANEAR (tipoConexion "sesion"), no reintentar', async () => {
    // La diferencia con "bloqueo" no es cosmética: los dos pausan sin auto-heal, pero éste le
    // dice al usuario QUÉ hacer.
    await expect(DescargarAdjuntoAnatomy.resolver(ID, undefined, undefined)).rejects.toMatchObject({
      tipoConexion: 'sesion',
    });
  });

  it('sin idArchivo saltea SÓLO este ítem', async () => {
    await expect(DescargarAdjuntoAnatomy.resolver('', undefined, CREDS)).rejects.toMatchObject({
      tipoPortal: 'rechazo',
    });
  });

  it('un 401 es el token vencido ⇒ "sesion"', async () => {
    responder('', { ok: false, status: 401 });
    await expect(DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).rejects.toMatchObject({
      tipoConexion: 'sesion',
    });
  });

  it('un 403 es sistémico ⇒ "bloqueo": le va a pasar a los 15 adjuntos', async () => {
    responder('', { ok: false, status: 403 });
    await expect(DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).rejects.toMatchObject({
      tipoPortal: 'bloqueo',
      httpStatus: 403,
    });
  });

  it('un 404 es de ESTE archivo ⇒ "rechazo": la cola sigue', async () => {
    responder('', { ok: false, status: 404 });
    await expect(DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS)).rejects.toMatchObject({
      tipoPortal: 'rechazo',
      httpStatus: 404,
    });
  });

  it('un 500 queda SIN tipar: es transitorio y ahí el auto-heal sirve', async () => {
    responder('', { ok: false, status: 500 });
    const err = await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS).catch((e) => e);
    expect(err.tipoPortal).toBeUndefined();
    expect(err.tipoConexion).toBeUndefined();
  });

  it('una respuesta sin URL reconocible es sistémica y dice qué llegó', async () => {
    responder({ otraCosa: 1 });
    const err = await DescargarAdjuntoAnatomy.resolver(ID, undefined, CREDS).catch((e) => e);
    expect(err.tipoPortal).toBe('bloqueo');
    expect(err.message).toContain('otraCosa');
  });
});
