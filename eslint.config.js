// Config plana de ESLint 9 para la extensión (sin bundler; ver docs/adr/0001).
// Objetivo: red mínima (no-undef / no-unused-vars / eqeqeq) que respete los
// múltiples contextos de ejecución y los globals cross-archivo que la extensión
// comparte vía importScripts (SW) y <script> (popup), sin bundler.
// Ver docs/ROADMAP.md Fase 4.
const globals = require("globals");

// Objetos que un archivo expone en window/self y otro consume como global
// (patrón dual-export del proyecto — docs/coding-standards.md).
const globalesDelProyecto = {
  Utils: "readonly",
  BunClient: "readonly",
  Conexion: "readonly",
  HistorialFallos: "readonly",
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
  // del bundler. Los .ts (hoy sólo wxt.config.ts) quedan fuera hasta que la migración
  // a TypeScript traiga su parser — ver docs/rearquitectura-diseno.md.
  { ignores: ["node_modules/**", "prototype/**", "popup/vendor/**", ".output/**", ".wxt/**", "**/*.ts"] },

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
