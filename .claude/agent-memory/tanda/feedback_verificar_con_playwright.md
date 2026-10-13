---
name: verificar-con-playwright
description: El dueño no mide a mano; yo mido portales con playwright-cli antes del código, el checklist de un diff es de verificador/revisor-ux; receta probada
metadata:
  type: feedback
---

**Roles (dueño, 2026-10-13: «vos no tenés que testear nada, para eso hay otros agentes»):** el checklist en Chrome de un diff
lo corren `verificador`/`revisor-ux`, no yo. Yo sólo **mido el portal** antes de que haya código (cerrar `M-n` de una spec).
Una medición que exige la extensión armada (p. ej. cookie desde el SW) va como **Paso 1 del plan con condición de parada**,
y no la construyo yo. Pasajes de abajo que dicen «lo corro yo» quedan viejos en ese punto.

Las comprobaciones de tiempo y similares van **por script y quedan en logs**; el dueño no las hace a mano
(2026-10-10, verificando el plan 31: «no voy a andar haciendo eso yo»). Él propuso que yo maneje la extensión con playwright-cli.

**Why:** pedirle cronometrar o mirar 60 s una pestaña es trabajo mecánico que un script hace mejor y deja registro.

**How to apply:** en los checklists de planes, las casillas medibles se escriben como script con salida pegable, no como tarea del dueño.
Al dueño sólo le queda lo que exige su sesión o su criterio (iniciar sesión, decidir).

Receta probada (2026-10-10, playwright-cli 0.1.22):
- Config `{"browser":{"browserName":"chromium","userDataDir":<perfil>,"launchOptions":{"channel":"chromium","args":["--disable-extensions-except=<ext>","--load-extension=<ext>"]}}}`
  con `<ext>` = `.output/chrome-mv3`. Chromium de Playwright, no Chrome de marca (que ignora `--load-extension` desde la v137).
- El SW aparece en `page.context().serviceWorkers()[0]`; su host es el id de la extensión.
- El popup consulta `tabs.query({active, currentWindow})` (`popup.js:647` y otros): abrirlo desde el SW con
  `chrome.tabs.create({url: popup.html, active: false})` para que la pestaña activa siga siendo la del portal.
- La sesión del portal: el dueño inicia sesión una vez, en modo headed, en un perfil persistente. Yo no tipeo contraseñas.
- El recorrido ya mide `duracionMs` por curso (`sitio/moodle-ingenieria/scraper.js:468-522`): M-1 se lee de ahí.
Esto reemplaza la vieja restricción de que yo no usara Chrome: aquella era sobre el Chrome real del dueño, y esto es un navegador aparte.

**Trampa (2026-10-13):** `MoodleSession` es cookie de sesión (`expires=-1`): muere al cerrarse el navegador `-s=verif`,
aunque el perfil sea persistente. Si `playwright-cli list` dice «no browsers», el login se perdió en los tres Moodle.
El paso [USUARIO] tiene que decir «logueate en esta ventana y **no la cierres**»; yo la abro con
`cd ~/.local/share/courseDownloader && playwright-cli -s=verif open --config=pw.json <url>` y no la cierro hasta terminar las V.
**El dueño (2026-10-13):** el perfil guarda usuario y contraseña autocompletados; si el login aparece ya relleno,
lo envío yo (Enter / clic en «Acceder») sin pedírselo. Sólo le pido el login si los campos están vacíos.

**Trampas medidas (2026-10-13):** `page.request.get` falla por certificado en los hosts UNLP: usar `page.evaluate(fetch)`.
Para correr en el SW: `page.context().serviceWorkers().find(w => w.url().startsWith('chrome-extension://')).evaluate(...)`.
La salida de `run-code` viene envuelta en `### Result\n<json>\n### `; el plan 35 trae un `escribir.py` probado que la parsea.
