// Config plana de ESLint 9 para la extensión.
// Objetivo: red mínima (no-undef / no-unused-vars / eqeqeq) que respete los
// múltiples contextos de ejecución y los globals cross-archivo que la extensión
// comparte publicándose en globalThis al evaluarse.
//
// Nació "sin bundler" (ADR-0001) y esa premisa ya no vale: desde la Fase 3 hay WXT + Vite y
// los globals no viajan por <script>/importScripts sino por el orden de import de los dos
// entrypoints (ADR-0008 supersede a la 0001). Lo que NO cambió es por qué esta lista existe:
// el bundler arma el grafo, pero un módulo que consume `Conexion` sin importarlo sigue
// necesitando que `no-undef` sepa que ese nombre es legítimo.
const globals = require("globals");
const tseslint = require("typescript-eslint");

// Objetos que un archivo expone en window/self y otro consume como global
// (patrón dual-export del proyecto — docs/coding-standards.md).
const globalesDelProyecto = {
  Utils: "readonly",
  BunClient: "readonly",
  Conexion: "readonly",
  HistorialFallos: "readonly",
  // Puertos (Fases 5b/5c): los publica plataforma/composicion.ts. Almacenamiento y
  // Programador los consume background.js; Mensajeria, popup.js (que se lo pasa por ctx a
  // las features).
  Almacenamiento: "readonly",
  Mensajeria: "readonly",
  Programador: "readonly",
  SessionState: "readonly",
  EstadosProgreso: "readonly",
  Cola: "readonly",
  HlsEngine: "readonly",
  AppState: "readonly",
  Renderers: "readonly",
  Scraper: "readonly",
  ServerConnectionFeature: "readonly",
  QueueFeature: "readonly",
  FilterFeature: "readonly",
  FacetaFeature: "readonly",
  // Adaptador de sitio (Capa 2 — ADR-0008): sitio/<portal>/config.js.
  SitioRamonNet: "readonly",
  SitioActivo: "readonly",
  ResolverManifiesto: "readonly",
  ParserTitulos: "readonly",
  BannerConexion: "readonly",
  ListaClases: "readonly",
  OnboardingFeature: "readonly",
  RutaDisco: "readonly",
};

module.exports = [
  // No lintear dependencias, el PoC descartable, el vendor de Preact ni las salidas
  // del bundler.
  { ignores: ["node_modules/**", "prototype/**", "popup/vendor/**", ".output/**", ".wxt/**"] },

  // TypeScript (núcleo migrado + config del bundler). Mismas reglas que el JS: la red
  // es mínima a propósito. `no-undef` se apaga porque en TS lo cubre el compilador y
  // acá daría falsos positivos con los tipos globales del DOM/chrome.
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    rules: {
      "no-undef": "off",
      eqeqeq: ["warn", "smart"],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },

  // Base común a todo el JS de la extensión.
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      // Desde la Fase 3 (WXT) TODO el código de la extensión son módulos ES: cada
      // archivo exporta su objeto y el bundler arma el grafo. Los globals siguen
      // existiendo como side-effect (globalThis.X = X) para no tocar los consumidores.
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: "readonly",
      },
    },
    rules: {
      // "smart" permite el idiom `x == null` (null + undefined) y typeof, pero
      // sigue marcando el resto de comparaciones laxas.
      eqeqeq: ["warn", "smart"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
    },
  },

  // Contextos que consumen los globals cross-archivo publicados por los módulos
  // (globalThis.X = X). importScripts sólo existe en el SW clásico pero declararlo
  // acá es inocuo para el popup (no lo usa).
  //
  // Los patrones son los archivos .js que QUEDAN (Fase 8 va a borrarlos): el vanilla de la
  // raíz, las features del popup y el adaptador de sitio. `shared/**` y `background/**`
  // estuvieron acá hasta el 2026-08-04 sin matchear nada — la primera desapareció en la 6a,
  // la segunda nunca existió. Un patrón muerto no da error, pero miente sobre el alcance.
  {
    files: ["background.js", "sitio/**/*.js", "popup.js", "popup/**/*.js", "renderers.js", "entrypoints/**/*.js"],
    languageOptions: {
      globals: { ...globalesDelProyecto, importScripts: "readonly" },
    },
  },

  // SW: el motor HLS veía los top-level de background.js cuando se cargaba por
  // importScripts. Desde la Fase 6 vive en core/hls/hlsEngine.ts y los recibe por
  // parámetro (`contexto`, `abortarHermanos`), así que esto ya sólo cubre a
  // background.js consumiendo sus propios globals del SW.
  {
    files: ["background.js"],
    languageOptions: {
      globals: { SessionState: "readonly", controladorGraficoActivo: "readonly" },
    },
  },

  // El propio config de ESLint corre en Node (CommonJS).
  {
    files: ["eslint.config.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },

  // Tests: módulos ES (import desde 'vitest') sobre Node.
  {
    files: ["**/*.test.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
