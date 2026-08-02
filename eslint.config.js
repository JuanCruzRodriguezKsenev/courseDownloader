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
  CatedraFeature: "readonly",
  BannerConexion: "readonly",
  ListaClases: "readonly",
  OnboardingFeature: "readonly",
  RutaDisco: "readonly",
};

module.exports = [
  // No lintear dependencias, el PoC descartable, ni el vendor de Preact.
  { ignores: ["node_modules/**", "prototype/**", "popup/vendor/**"] },

  // Base común a todo el JS de la extensión.
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
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

  // Contextos que consumen los globals cross-archivo (SW por importScripts,
  // popup por <script>). importScripts sólo existe en el SW pero declararlo
  // acá es inocuo para el popup (no lo usa).
  {
    files: ["background.js", "background/**/*.js", "shared/**/*.js", "popup.js", "popup/**/*.js", "renderers.js"],
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

  // Dual-export (browser/SW + import en Vitest): el footer referencia `module`
  // (CommonJS/Node). Aplica a shared/*.js, las features vanilla, y hlsEngine.js
  // (que sumó la rama module.exports para testear sus funciones puras).
  {
    files: ["shared/**/*.js", "popup/features/serverConnection.js", "popup/features/queue.js", "popup/features/filters.js", "popup/features/catedra.js", "background/hlsEngine.js"],
    languageOptions: { globals: { ...globals.node } },
  },

  // El propio config de ESLint corre en Node (CommonJS).
  {
    files: ["eslint.config.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },

  // Islas Preact: módulos ES reales (import desde el vendor).
  {
    files: ["popup/features/*.preact.js"],
    languageOptions: { sourceType: "module" },
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
