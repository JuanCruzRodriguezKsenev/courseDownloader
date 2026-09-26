"""Selector nativo de carpeta en Linux vía xdg-desktop-portal (FileChooser).

Lo lanza `handleSeleccionarCarpeta` (backend/handlers.js). Contrato de salida:
  0 → imprime la ruta elegida en stdout
  1 → el usuario canceló o cerró el diálogo
  3 → error (sin PyGObject, sin portal, D-Bus caído); el detalle va a stderr
"""
import os
import sys
from urllib.parse import unquote, urlparse

try:
    import gi

    gi.require_version("Gio", "2.0")
    from gi.repository import Gio, GLib

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    remitente = bus.get_unique_name()[1:].replace(".", "_")
    token = "coursedownloader%d" % os.getpid()
    ruta_request = f"/org/freedesktop/portal/desktop/request/{remitente}/{token}"
    loop = GLib.MainLoop()
    resultado = {"code": 2, "uris": []}

    def al_responder(_conn, _snd, _obj, _iface, _sig, params, *_):
        code, resultados = params.unpack()
        resultado["code"] = code
        resultado["uris"] = resultados.get("uris", [])
        loop.quit()

    # Suscribirse ANTES de llamar: la respuesta puede llegar apenas vuelve OpenFile.
    bus.signal_subscribe(
        "org.freedesktop.portal.Desktop",
        "org.freedesktop.portal.Request",
        "Response",
        ruta_request,
        None,
        Gio.DBusSignalFlags.NONE,
        al_responder,
    )
    opciones = {
        "handle_token": GLib.Variant("s", token),
        "directory": GLib.Variant("b", True),
        "modal": GLib.Variant("b", True),
    }
    bus.call_sync(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.FileChooser",
        "OpenFile",
        GLib.Variant("(ssa{sv})", ("", "Elegí la carpeta raíz de descargas", opciones)),
        GLib.VariantType("(o)"),
        Gio.DBusCallFlags.NONE,
        -1,
        None,
    )
    loop.run()
except Exception as e:  # noqa: BLE001 — cualquier falla es "no hay selector"
    print(f"{type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(3)

if resultado["code"] == 0 and resultado["uris"]:
    print(unquote(urlparse(resultado["uris"][0]).path))
    sys.exit(0)
sys.exit(1)
