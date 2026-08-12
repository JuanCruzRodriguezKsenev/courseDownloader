# Fusionar el backend y la extensión en un solo repo — diseño de ejecución

**Estado (2026-08-12): ✅ TERMINADO, VERIFICADO EN NAVEGADOR Y MERGEADO A `main`.**

Las 4 fases se ejecutaron el 2026-08-12. Automáticas: compuerta en el baseline de `docs/testing.md`
y el build emitiendo **exactamente** los mismos 13 archivos y 222.51 kB que antes de la fusión
(chequeo de R1). En navegador, con el backend levantado desde `backend/`: **la raíz de descargas
quedó en la correcta** (R3 despejado), bajó **un video** de Ramón Net y **un PDF** de Anatomy
—`Testimonios anatobychris.pdf`, con su nombre bien, sin `.pdf.mp4`—, que es el que prueba el
contrato `x-file-name` y por lo tanto el motivo entero de esta fusión.
La decisión quedó en **ADR-0015**. El nombre elegido fue **Course Downloader** / `backend/`.

Plan para que `ramonnet-bun-backend` deje de ser un repo aparte y pase a vivir en `backend/`,
dentro de este mismo repo, **conservando su historia**. Incluye el rename de los dos proyectos,
porque toca los mismos archivos y hacerlo por separado significa editar los mismos 7 docs dos
veces.

Este doc es el *cómo*; el *qué y por qué* quedó en **ADR-0015**, nacido en el mismo cambio porque
unificar repos es una decisión de arquitectura y `contributing.md` la pide documentada.

---

## 1. Por qué, y por qué ahora

**El motivo no es prolijidad: es un modo de fallar que este proyecto ya pagó.**

La extensión y el backend comparten un contrato HTTP (`docs/deployment.md` §Contrato de endpoints)
y **hoy nada obliga a que se muevan juntos**. El caso concreto, del 2026-08-07:

- El contrato `x-file-name` se cambió con **dos commits en dos repos, sin ningún vínculo entre
  ellos**: `a91ffe7` acá, y `8797ec6` + `79726a9` allá.
- Si corrés una extensión nueva contra un backend viejo, **no falla**: el PDF se guarda como
  `Atlas.pdf.mp4`. Silencioso, que es la peor clase de error en este proyecto.
- Lo único que hoy te protege es una **advertencia en prosa** —el banner de `CLAUDE.md` y un aviso
  en el `README`— que una sesión futura tiene que acordarse de leer.

En un repo, ese cambio es **un commit atómico** y la advertencia se puede borrar. Esa es la
ganancia entera: la regla deja de depender de la memoria y pasa a ser estructural.

Dos razones secundarias, ambas reales:

- **El backend no tiene remoto.** `git remote -v` sale vacío: sus 4 commits existen sólo en el
  disco de una PC. Fusionar resuelve eso de una, en vez de crear y mantener un segundo repo.
- **Una sola clonada** para levantar todo en otra máquina, que es el problema que disparó esto.

## 2. Fricción medida

Nada de esto es bloqueante; se lista porque **cada punto es un paso del plan**.

| Punto | Estado hoy | Costo |
|---|---|---|
| **ESLint** | `npm run lint` corre `eslint .`, y el `ignores` de `eslint.config.js:54` no contempla el backend. Sus `.js` entrarían con las reglas y globals de la extensión | Un bloque de config, ~5 líneas |
| **ESM vs CommonJS** | El `package.json` raíz **no declara `"type"`** (default de Node: CommonJS) y el backend es ESM (`server.js:7`). Hoy no choca porque no tiene ningún `package.json` por encima; al moverlo, el de la raíz pasa a ser el más cercano | `backend/package.json` de 3 líneas |
| **WXT** | `srcDir: '.'` — **la raíz del repo ES el directorio de fuentes**. WXT sólo escanea `entrypoints/` y copia `public/`, así que `backend/` no debería empaquetarse | Cero, pero **hay que verificarlo** en la salida del build |
| **`tsc`** | El `include` de `tsconfig.json` es explícito (`core`, `plataforma`, `sitio`, …) | Cero |
| **Vitest** | Corre sobre defaults y toma `**/*.test.*`; el backend no tiene tests | Cero hoy |
| **`.gitignore`** | El backend trae el suyo (`node_modules/`, `config_usuario.json`) y **git respeta los `.gitignore` anidados** | Cero, pero se confirma |
| **Docs** | 7 archivos nombran `ramonnet-bun-backend`; `deployment.md:17` y `:25` afirman explícitamente la separación | El grueso del trabajo |

## 3. El layout: `backend/` hermano, y NO mover la extensión

```
courseDownloader/
├── core/  sitio/  popup/  plataforma/  styles/  docs/  …   ← todo queda donde está
└── backend/                                                 ← los 8 archivos del backend
```

**Descartado: meter la extensión en `extension/`.** Obligaría a tocar `srcDir`, el `tsconfig`, el
`eslint.config.js` y **todas** las rutas de todos los docs más el mapa de archivos de `CLAUDE.md`,
sin ninguna ganancia sobre la alternativa barata. La raíz ya es "ruidosa" por diseño desde la
Fase 3 (`srcDir: '.'`), así que un hermano más no cambia nada conceptualmente.

## 4. Plan — una rama, cuatro commits

**No es troceable en ramas independientes**: los docs describen el layout nuevo, así que a mitad
de camino mienten. Rama: `fusion-monorepo`.

### Fase 0 — Red de seguridad

```bash
git push origin main                                  # punto de restauración remoto
npm test && npm run lint && npx tsc --noEmit && npm run build    # baseline verde
git -C ../ramonnet-bun-backend status --short         # tiene que estar limpio
cp ../ramonnet-bun-backend/config_usuario.json ~/config_usuario.backup.json
git checkout -b fusion-monorepo
```

⚠️ **El `cp` es el paso que más fácil se saltea y el más caro de olvidar** — ver R3.
**La carpeta vieja del backend no se borra** hasta que pase la Fase 5.

### Fase 1 — La fusión, con historia (commit 1)

```bash
git subtree add --prefix=backend ../ramonnet-bun-backend master
git log --oneline --graph -6                # los 4 commits, como rama mergeada
git check-ignore backend/config_usuario.json
```

⚠️ **Corrección de este mismo plan, encontrada al ejecutarlo**: la verificación decía
`git log --oneline -- backend`, y **eso no muestra nada** — los commits originales tienen rutas
*sin* el prefijo `backend/`, así que el filtro por ruta no los matchea y parece que la historia se
perdió. Se ve con `--graph` (o `git log <sha-original>`), que los muestra como rama mergeada al
commit `Add 'backend/' from commit …`.

**`subtree`, no copiar la carpeta**: dos de esos 4 commits son el contrato de los PDF, y **su
mensaje es la única documentación de por qué existe** el header `x-file-name`.

### Fase 2 — Aislamiento: la compuerta vuelve a verde (commit 2)

| Archivo | Cambio |
|---|---|
| `backend/package.json` *(nuevo)* | `{ "name": "backend", "private": true, "type": "module" }` |
| `eslint.config.js` | bloque para `backend/**` con `sourceType: "module"` + globals de Bun/Node |

Compuerta completa acá mismo. Debe volver **al mismo baseline de `docs/testing.md`**. Si el conteo
de tests cambió, algo del backend entró a la suite: hay que mirarlo, no aceptarlo.

### Fase 3 — Rename (commit 3)

Cuatro líneas del lado de la extensión:

- `package.json:2`
- `wxt.config.ts:20` (lo que se lee en `chrome://extensions`)
- `entrypoints/popup/index.html:5` (`<title>`) y `:26` (el `<h4>` de la cabecera)

Más el rename del repo **en GitHub por la web** (deja redirect automático de la URL vieja).

**Por qué el nombre viejo ya no sirve**, y es el mismo error dos veces: `videoDownloader` nombra
**la mitad** del dominio — `core/cola/identidadClase.ts:60` define
`TipoContenido = "video" | "adjunto"`, y el tipo es parte de la clave de identidad. Es exactamente
la forma del problema que tiene `ramonnet` con los portales: **un nombre que describía lo que era
verdad cuando había uno solo**. Esto se cruza con `docs/copy-generico-diseno.md` §5.2 (el corte de
marca), que pide que los tres strings de nombre se muevan juntos o queden discordantes.

### Fase 4 — Docs + ADR (commit 4)

- **ADR-0015** *(nuevo)*: unificar los repos, con el caso `x-file-name` como evidencia.
- `docs/deployment.md:17` y `:25` — las dos afirmaciones de separación (*"Repositorio separado, no
  incluido en este monorepo"*, *"vive en su propio repo"*) pasan a ser **falsas**.
- Los otros 6 que nombran la carpeta: `README.md`, `CLAUDE.md`, `docs/architecture.md`,
  `docs/tech-stack.md`, `docs/contributing.md`, `docs/escaneo-api-anatomy-diseno.md`.
- **El premio, y conviene no olvidarlo**: el ⚠️ del banner de `CLAUDE.md` sobre *"el otro repo que
  va con éste"* y el aviso equivalente del `README` **se borran**. Dejan de hacer falta — ése era
  el punto de todo esto (§1).

## 5. Verificación

**Automática:**

- La compuerta de 4 comandos (baseline → `docs/testing.md`).
- `npm run build` y **leer la lista de archivos emitidos**: nada de `backend/` puede aparecer. Es
  el chequeo de R1, y la salida los lista uno por uno.

**En navegador — obligatoria, nada de esto lo ve un test:**

1. Levantar el backend **desde `backend/`** con `iniciar.bat`.
2. **Confirmar en la consola del server que la raíz sea tu carpeta de siempre**, no
   `Downloads/RamonNet_Turbo`. Si salió el default, restaurar el backup de la Fase 0.
3. Golden path: bajar **un video** y **un PDF** de Anatomy. El PDF es el que prueba que el contrato
   `x-file-name` sigue vivo — si sale `.pdf.mp4`, el backend que está corriendo no es el que creés.
4. Recargar desde `.output/chrome-mv3/` y confirmar el nombre nuevo en `chrome://extensions/`.

## 6. Riesgos

| # | Riesgo | Por qué es silencioso | Mitigación |
|---|---|---|---|
| **R3** | **Se pierde la ruta de descargas y bajás a otra carpeta sin enterarte** | La ruta vive **sólo** del lado del backend (`config_usuario.json`, escrito en `handlers.js:334`); la extensión la **lee**, no la manda (`bunClient.ts:228`). Está gitignoreada, así que no viaja. El backend cae al default y, de yapa, el "ya descargado" escanea la raíz nueva y da **todo el curso por no bajado** | El `cp` de la Fase 0 + el chequeo 2 de la Fase 5 |
| R1 | WXT empaqueta `backend/` | `srcDir: '.'`: la raíz es el dir de fuentes | Leer la salida de `npm run build` |
| R2 | Los `.js` del backend caen en scope CommonJS | Bun tolera ESM igual; el síntoma aparecería recién si algo lo corre con Node | `backend/package.json` |
| R4 | Se pierde la historia del backend | Un `cp -r` en vez de `subtree` no da error | `git log -- backend` en la Fase 1 |

## 7. Lo que NO se toca

- **El id `"ramonnet"` del portal** (`sitio/ramonnet/config.ts:81`): es el nombre de la carpeta en
  disco y la mitad de la identidad de cada clase. Renombrarlo obliga a migrar storage y mover
  archivos.
- **`SITIO_LEGADO`** (`core/estado/appState.ts:164`, `core/cola/estadosProgreso.ts:35`): es dato.
- **La carpeta `sitio/ramonnet/`**: es el portal, no el proyecto.
- **`EXTENSION_ID_ORIGEN`** del backend (`config.js`, con su `TU_EXTENSION_ID_AQUI`): **parece un
  pendiente de setup y no lo es.** `server.js:45` refleja el `origin` que le llega y sólo cae al
  placeholder si no viene ninguno. No hay que configurarlo, ni acá ni al clonar en otra PC.

Renombrar los *proyectos* es cosmético y reversible; renombrar el *portal* rompe datos. Comparten
la palabra y no son lo mismo.

## 8. Rollback

Todo vive en una rama: `git checkout main && git branch -D fusion-monorepo` y no queda rastro.
La carpeta vieja del backend sigue en `Dev/` intacta — **conviene dejarla archivada una semana**
después de la verificación, y recién ahí borrarla.

## 9. La decisión del nombre — ✅ cerrada el 2026-08-12

**Salió la primera fila**: `courseDownloader` como nombre de proyecto (`package.json`), **Course
Downloader** como nombre de producto, y el backend quedó como carpeta `backend/` en vez de
`courseAssembler`, por la nota del final. Se conserva la deliberación porque los dos criterios de
abajo valen para el próximo nombre que este proyecto tenga que elegir.

**El nombre de producto.** Lo discutido, en el estilo inglés camelCase que ya usa la carpeta local:

| Extensión | Backend | Nota |
|---|---|---|
| `courseDownloader` | `courseAssembler` | El backend *literalmente* ensambla fragmentos en un archivo. Los dos dicen su rol y aparean solos |
| `courseDownloader` | `courseBackend` | Más literal |
| `classDownloader` | `classAssembler` | Si se prefiere la unidad (clase) al contenedor (curso) |

Criterios que ya se acordaron y conviene no perder: **el nombre no puede llevar la jerga de un
portal** (nada de "aula", "cátedra", "clases grabadas" — mismo error que arregla
`copy-generico-diseno.md`), y **los dos nombres tienen que aparear**: `videoDownloader` +
`bunBackend` fallaban en eso, porque uno nombra el dominio y el otro el stack.

Nota: **fusionado el repo, el nombre del backend importa mucho menos** — pasa a ser una carpeta
(`backend/`), no un proyecto que alguien tenga que reconocer en una lista.
