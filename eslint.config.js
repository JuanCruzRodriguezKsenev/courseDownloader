// Config plana de ESLint 9 para la extensión (sin bundler; ver docs/adr/0001).
// Objetivo: red mínima (no-undef / no-unused-vars / eqeqeq) que respete los
// múltiples contextos de ejecución y los globals cross-archivo que la extensión
// comparte vía importScripts (SW) y <script> (popup), sin bundler.
// Ver docs/ROADMAP.md Fase 4.
const globals = require("globals");
const tseslint = require("typescript-eslint");

// Objetos que un archivo expone en window/self y otro consume como global
// (patrón dual-export del proyecto — docs/coding-standards.md).
const globalesDelProyecto = {
  Utils: "readonly",
  BunClient: "readonly",
  Conexion: "readonly",
  HistorialFallos: "readonly",
  // Puerto de mensajería (Fase 5c): lo publica plataforma/composicion.ts y popup.js se lo
  // pasa por ctx a las features. Ver core/puertos/mensajeria.ts.
  Mensajeria: "readonly",
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
  {
    files: ["background.js", "background/**/*.js", "shared/**/*.js", "sitio/**/*.js", "popup.js", "popup/**/*.js", "renderers.js", "entrypoints/**/*.js"],
    languageOptions: {
      globals: { ...globalesDelProyecto, importScripts: "readonly" },
    },
  },

  // SW: hlsEngine.js se carga por importScripts DENTRO del scope de background.js,
  // así que ve sus top-level (SessionState, controladorGraficoActivo).
  {
    files: ["background.js", "background/**/*.js"],
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
