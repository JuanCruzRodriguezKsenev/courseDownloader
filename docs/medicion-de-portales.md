# Medir un portal nuevo: scripts de consola

**Hogar canónico de los scripts con los que se mide un portal antes de escribir su spec.** El *cómo se escribe*
el adaptador está en [`multisitio-diseno.md`](./multisitio-diseno.md) §«Cómo escribir un portal nuevo».
**Firmado**: tanda claude sonnet 5.5 · 2026-10-05

## Cómo se usan

- Se pegan en la consola de DevTools (F12 → Console) de la pestaña del portal, **con la sesión iniciada**.
- Sólo leen. No escriben ni navegan. Los valores de los query strings se descartan (sin tokens ni `sesskey`).
- `copy()` **no existe después de un `await`**: los scripts asíncronos (C, D, E) usan `navigator.clipboard` y, si
  falla por falta de foco, hay que hacer click en la página y repetir, o copiar a mano el JSON impreso.
- Lo que sale de acá es una **medición desde una pestaña**, y eso miente sobre el service worker (`AGENTS.md`,
  patrón 2): el navegador manda `Origin`, `Referer` y cookies solo, y el SW no manda ninguno. Todo lo que dependa
  de eso queda como `M-n` de la spec, no como dato.

## Qué correr y qué decide

| Script | Dónde | Qué mide | Decide |
|---|---|---|---|
| **A** | Lista de cursos, y otra vez dentro de un curso con material abierto | Framework, enlaces por ruta y extensión, `video`/`iframe`, `.m3u8` y `.pdf` en el HTML, cookies, candidatos a lista | Si es SPA o HTML del servidor; si hay video; qué selector usar |
| **B** | Misma pestaña, **después** de reproducir un video o abrir un recurso | Llamadas `fetch`/XHR, medios (`m3u8`, `mpd`, `mp4`, `pdf`, `key`), dominios externos | Si hay API de contenido; de dónde sale el video |
| **C** | Dentro de un curso Moodle | Actividades por tipo, ids únicos (duplicados), secciones, y cómo responde `mod/resource/view.php` | Si hay que desduplicar; si el recurso redirige o se incrusta |
| **D** | En `/my/` de un Moodle | Pide cada curso con `fetch` y cuenta actividades, tipos y tiempos | Si el HTML trae las actividades (multicurso sin pestañas) y cuánto tarda |
| **E** | Dentro de un curso Moodle que tenga un `folder` | Cómo se lista un `folder` y qué URL tienen sus archivos | Cómo resolver un `folder` |

Si en la página no abre un PDF en la misma pestaña: Moodle los abre navegando a `pluginfile.php` y la consola
pierde el contexto. Abrilo con click derecho → «Abrir en pestaña nueva» y corré B en la pestaña del curso.

Si `media` de B sale vacío, para listar los recursos de la página sin abrirlos:

```js
copy([...document.querySelectorAll('a[href*="pluginfile"],a[href*="/mod/resource"]')].slice(0,10).map(a=>a.href.replace(/\?.*/,'')).join('\n'))
```

---

## A — Estructura de la página

```js
(() => {
  const san = u => { try { const x = new URL(u, location.href); return x.origin + x.pathname + (x.search ? '?' + [...x.searchParams.keys()].join('&') : ''); } catch { return String(u).slice(0, 120); } };
  const top = (arr, n = 12) => Object.entries(arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, n);
  const links = [...document.querySelectorAll('a[href]')];
  const ext = links.map(a => (new URL(a.href, location.href).pathname.match(/\.(\w{2,5})$/) || [])[1]).filter(Boolean);
  const html = document.documentElement.outerHTML;
  const r = {
    url: san(location.href),
    title: document.title,
    framework: {
      next: !!document.getElementById('__NEXT_DATA__'), nuxt: !!window.__NUXT__, react: !!document.querySelector('[data-reactroot],#root,#__next'),
      angular: !!document.querySelector('[ng-version]'), vue: !!document.querySelector('[data-v-app],#app'),
      generator: document.querySelector('meta[name=generator]')?.content || null,
      iframes: document.querySelectorAll('iframe').length, shadow: [...document.querySelectorAll('*')].filter(e => e.shadowRoot).length
    },
    headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 15).map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 60)),
    linksPorExtension: top(ext),
    linksPorRuta: top(links.map(a => { try { return new URL(a.href).pathname.split('/').slice(0, 3).join('/'); } catch { return '?'; } }), 15),
    clasesDeEnlaces: top(links.flatMap(a => [...a.classList]), 15),
    videos: [...document.querySelectorAll('video,source,iframe')].slice(0, 15).map(e => e.tagName + ' ' + san(e.currentSrc || e.src || '')),
    m3u8EnHtml: [...new Set(html.match(/https?:[^"'\s\\]+\.m3u8[^"'\s\\]*/g) || [])].slice(0, 10).map(san),
    pdfEnHtml: [...new Set(html.match(/https?:[^"'\s\\]+\.pdf/g) || [])].slice(0, 10).map(san),
    scriptsJson: [...document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')].map(s => ({ id: s.id, bytes: s.textContent.length, claves: (() => { try { return Object.keys(JSON.parse(s.textContent)).slice(0, 10); } catch { return 'no-json'; } })() })),
    candidatosDeLista: top([...document.querySelectorAll('li,tr,[class*=card],[class*=item],[class*=lesson],[class*=module]')].map(e => e.tagName + '.' + [...e.classList].slice(0, 3).join('.')), 10),
    cookiesNombres: document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean),
    localStorageClaves: Object.keys(localStorage).slice(0, 20)
  };
  const out = JSON.stringify(r, null, 1);
  copy(out); console.log(out); console.log('✔ copiado al portapapeles');
})();
```

## B — Llamadas de red

```js
(() => {
  const san = u => { try { const x = new URL(u); return x.origin + x.pathname + (x.search ? '?' + [...x.searchParams.keys()].join('&') : ''); } catch { return u.slice(0, 120); } };
  const es = performance.getEntriesByType('resource');
  const api = es.filter(e => ['fetch', 'xmlhttprequest'].includes(e.initiatorType));
  const media = es.filter(e => /\.(m3u8|mpd|ts|mp4|pdf|key)(\?|$)/i.test(e.name));
  const r = {
    pagina: san(location.href),
    api: [...new Set(api.map(e => san(e.name)))].slice(0, 40),
    media: [...new Set(media.map(e => san(e.name)))].slice(0, 25),
    dominiosExternos: [...new Set(es.map(e => new URL(e.name).origin).filter(o => o !== location.origin))].slice(0, 20)
  };
  const out = JSON.stringify(r, null, 1);
  copy(out); console.log(out); console.log('✔ copiado');
})();
```

## C — Un curso Moodle: tipos, duplicados y recursos

```js
(async () => {
  const san = u => { try { const x = new URL(u, location.href); return x.origin + x.pathname + (x.search ? '?' + [...x.searchParams.keys()].join('&') : ''); } catch { return String(u).slice(0, 120); } };
  const acts = [...document.querySelectorAll('li.activity')];
  const ids = acts.map(a => a.id);
  const porTipo = {};
  acts.forEach(a => { const t = [...a.classList].find(c => c.startsWith('modtype_')); porTipo[t] = (porTipo[t] || 0) + 1; });
  const res = acts.filter(a => a.classList.contains('modtype_resource')).slice(0, 3);
  const pruebas = [];
  for (const a of res) {
    const href = a.querySelector('a[href*="/mod/resource/"]')?.href;
    if (!href) continue;
    try {
      const r = await fetch(href, { credentials: 'include' });
      const ct = r.headers.get('content-type');
      pruebas.push({ view: san(href), status: r.status, redirigido: r.redirected, final: san(r.url), contentType: ct, tienePluginfileEnHtml: /html/.test(ct || '') ? /pluginfile\.php/.test(await r.text()) : null });
    } catch (e) { pruebas.push({ view: san(href), error: String(e) }); }
  }
  const r = {
    curso: san(location.href),
    actividadesTotales: acts.length,
    idsUnicos: new Set(ids).size,
    porTipo,
    secciones: document.querySelectorAll('li.section.main').length,
    formato: [...document.body.classList].filter(c => /format-/.test(c)),
    sectionsVisibles: [...document.querySelectorAll('li.section.main')].slice(0, 5).map(s => ({ id: s.id, titulo: (s.querySelector('.sectionname,h3')?.textContent || '').trim().slice(0, 50), actividades: s.querySelectorAll('li.activity').length })),
    muestraUrl: [...document.querySelectorAll('li.modtype_url a[href*="/mod/url/"]')].slice(0, 3).map(a => san(a.href)),
    pruebasResource: pruebas
  };
  const out = JSON.stringify(r, null, 1);
  console.log(out);
  try { await navigator.clipboard.writeText(out); console.log('✔ copiado'); }
  catch (e) { console.log('no pude copiar: seleccioná el JSON de arriba a mano'); }
})();
```

## D — `/my/` de un Moodle: todos los cursos

Los títulos salen cortados a 50 caracteres: no sirven para identificar un curso, usá el `id`.

```js
(async () => {
  const links = [...document.querySelectorAll('a[href*="/course/view.php?id="]')];
  const ids = [...new Set(links.map(a => new URL(a.href).searchParams.get('id')))];
  const filas = [];
  for (const id of ids) {
    const t0 = performance.now();
    try {
      const r = await fetch('/course/view.php?id=' + id, { credentials: 'include' });
      const html = await r.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const acts = [...doc.querySelectorAll('li.activity')];
      const tipos = {};
      acts.forEach(a => { const t = [...a.classList].find(c => c.startsWith('modtype_')); tipos[t] = (tipos[t] || 0) + 1; });
      filas.push({ id, status: r.status, final: new URL(r.url).pathname, titulo: (doc.querySelector('h1')?.textContent || '').trim().slice(0, 50), actividades: acts.length, unicas: new Set(acts.map(a => a.id)).size, tipos, ms: Math.round(performance.now() - t0) });
    } catch (e) { filas.push({ id, error: String(e) }); }
  }
  const out = JSON.stringify({ cursosEnPagina: ids.length, filas }, null, 1);
  console.log(out);
  try { await navigator.clipboard.writeText(out); console.log('✔ copiado'); } catch (e) { console.log('no pude copiar: seleccioná el JSON a mano'); }
})();
```

## E — Un `folder` de Moodle

Correrlo en un curso que tenga una actividad `folder`; si no la tiene, el script lo avisa.

```js
(async () => {
  const san = u => { try { const x = new URL(u, location.href); return x.origin + x.pathname + (x.search ? '?' + [...x.searchParams.keys()].join('&') : ''); } catch { return String(u).slice(0, 120); } };
  const f = document.querySelector('li.activity.modtype_folder');
  if (!f) { console.log('este curso no tiene folder: probá en otro'); return; }
  const a = f.querySelector('a[href*="/mod/folder/"]');
  const r = await fetch(a.href, { credentials: 'include' });
  const html = await r.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const archivos = [...doc.querySelectorAll('a[href*="pluginfile.php"]')].map(x => san(x.href));
  const out = JSON.stringify({
    folder: { titulo: a.textContent.trim().slice(0, 60), view: san(a.href), status: r.status, final: san(r.url), contentType: r.headers.get('content-type') },
    enLaPaginaDelCurso: { enlacesPluginfile: f.querySelectorAll('a[href*="pluginfile.php"]').length },
    enLaPaginaDelFolder: { archivos: archivos.length, ejemplos: archivos.slice(0, 5), subcarpetas: doc.querySelectorAll('.fp-filename-icon .fp-icon, .filemanager .fp-folder, .fp-subfolder').length, tieneBotonZip: !!doc.querySelector('form[action*="downloadfolder"], a[href*="download_folder"]') }
  }, null, 1);
  console.log(out);
  try { await navigator.clipboard.writeText(out); console.log('✔ copiado'); } catch (e) { console.log('no pude copiar: seleccioná el JSON a mano'); }
})();
```

**Limitación conocida de E:** el contador `subcarpetas` mezcla íconos de archivo con carpetas (dio 3 con dos archivos
planos). Para saber si hay subcarpetas, mirá la ruta de `ejemplos`: `content/0/<nombre>` es raíz; una subcarpeta
agrega un segmento antes del nombre.

Firmado: tanda claude sonnet 5.5
