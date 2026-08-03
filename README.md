# RamonNet Video Downloader (Turbo Edition) 🚀

Extensión de Chrome/Brave de alto rendimiento diseñada para descargar clases grabadas de forma masiva, organizada y veloz desde la plataforma de Ramón Net directamente a tu PC, superando las limitaciones habituales del navegador.

---

## ⚡ Características Principales

* **Descarga Multi-Worker Segmentada**: Utiliza un motor de red concurrente personalizado con 6 workers paralelos para acelerar la descarga de fragmentos HLS, mejorando el rendimiento entre un 15% y 30%.
* **Escritura Progresiva (Anti-Crash)**: Los videos se transmiten y ensamblan directamente en disco mediante un búfer físico de ventana deslizable (`.part`), manteniendo el consumo de memoria RAM inferior a 15 MB para cualquier tamaño de archivo.
* **Auto-Heal (Auto-sanación)**: Recuperación automática ante micro-cortes de internet o caídas temporales de red, pausando la cola de forma segura y reanudando la descarga en el fragmento exacto donde se interrumpió una vez restablecida la conexión.
* **Avisos de Fallos (Notificación + Campanita)**: Ante un fallo terminal de la cola (una clase saltada por rechazo del servidor, o la cola pausada por caída de sesión/servidor/internet), la extensión emite una **notificación nativa del sistema** —aunque el popup esté cerrado— y guarda el fallo en una **campanita** persistente en la cabecera, con un panel de historial (últimos 50) que se puede marcar como leído o limpiar.
* **Sesiones Únicas de Descarga**: Vinculación de tokens de red únicos (`session-id`) entre el navegador y el backend local, evitando fragmentos huérfanos en disco y colisiones por cancelaciones abruptas.
* **Organización Inteligente**: La extensión deduce y estandariza los nombres de las clases (Semanas, Materias, Cátedras) de forma automática. Crea la estructura de directorios en tu PC sin necesidad de intervención manual.
* **Cola de Descarga Desacoplada**: La lista de descargas en cola se mantiene intacta en el storage local de la extensión, permitiendo cambiar de materia, re-escanear aulas o cerrar pestañas mientras el Service Worker gestiona las descargas de fondo.
* **Onboarding Interactivo (Welcome Tour)**: Guía paso a paso integrada de 6 slides que enseña a usar la extensión, configurar el servidor local y seleccionar directorios. Se puede volver a consultar en cualquier momento presionando el botón `❓` en la cabecera.

---

## 🛠️ Requisitos del Sistema

Para realizar las descargas físicas en tu disco, la extensión se conecta con un backend local ultraliviano programado en **Bun**.
* Tener la carpeta del backend local (`ramonnet-bun-backend`) en tu PC.
* Tener instalado [Bun](https://bun.sh/) (o utilizar el ejecutable empaquetado).

---

## 🚀 Instalación y Puesta en Marcha

### 1. Levantar el Servidor Local
1. Dirigite a la carpeta del backend en tu PC.
2. Ejecutá el archivo **`iniciar.bat`**.
3. Verás una ventana de consola esperando conexiones en el puerto `3001`. *Podés minimizar la consola y dejarla corriendo en segundo plano*.

### 2. Compilar e Instalar la Extensión en el Navegador
> La extensión ahora se **compila** (antes se cargaba el repo tal cual). Hace falta [Node.js](https://nodejs.org/).

1. En la carpeta del repo: `npm install` (sólo la primera vez) y después `npm run build`.
   Eso genera la carpeta **`.output/chrome-mv3/`**.
2. Abrí Chrome o Brave y navegá a `chrome://extensions/`.
3. Activá el **Modo de desarrollador** (esquina superior derecha).
4. Hacé clic en **Cargar descomprimida** (Load unpacked) y seleccioná **`.output/chrome-mv3/`**
   (NO la raíz del repositorio).
5. Fijá el ícono de la extensión en tu barra de herramientas.

Tras cambiar código: `npm run build` y recargar la extensión desde su tarjeta.

### 3. Configuración Inicial (Primer Uso)
1. Hacé clic en el ícono de la extensión. Se desplegará el **Welcome Tour**.
2. Seguí las diapositivas explicativas.
3. En la **Slide 5**, presioná **`📂 Seleccionar Carpeta`** para elegir el directorio raíz de tu PC donde se guardarán todos tus videos (ej: `Downloads/Clases RamonNet`).
4. Al hacer clic en **Comenzar** o **Saltar**, la extensión quedará lista para usar.

---

## 📖 Modo de Uso Diario

1. Entrá al listado de clases grabadas de tu materia en Ramón Net: [plataforma.ramonnet.com.ar/usuario/clases-grabadas](https://plataforma.ramonnet.com.ar/usuario/clases-grabadas).
2. Hacé clic en el botón de la materia que deseas descargar y presioná **👁️ mostrar** (ojo) al lado de las clases que quieras revelar.
3. Abrí el popup de la extensión. Notarás que las clases detectadas aparecen en la pestaña **"Clases Disponibles"**.
4. Seleccioná las clases deseadas y presioná **"Agregar a la fila"**.
5. Cambiá a la pestaña **"Fila de Descarga"** y presioná **"Iniciar descarga masiva 🚀"**.
6. Podés cerrar el popup o cambiar de materia; la descarga continuará procesándose de fondo en orden FIFO secuencial.

---

## 📁 Estructura del Repositorio

> Los fuentes viven en la **raíz** del repo (`srcDir: '.'`); lo que la extensión carga es
> `.output/chrome-mv3/`, generado por `npm run build`. Detalle técnico completo en
> `docs/architecture.md`.

* **`wxt.config.ts`**: Configuración del empaquetado y **origen del `manifest.json`** (permisos, hosts, dNR, iconos). El manifest ya no se escribe a mano: se genera desde acá.
* **`entrypoints/`**: Los puntos de entrada que detecta WXT — `popup/index.html` (plantilla visual del popup), `popup/main.js` y `background.js`. Estos dos últimos son sólo listas de imports, y **su orden importa**: cada módulo se publica como global al evaluarse y los siguientes lo consumen.
* **`popup.js`**: Orquestador principal de eventos, máquina de estados de UI y pasarela de mensajes IPC.
* **`popup/features/`**: Módulos autocontenidos de la UI del popup (conexión, cola, filtros, faceta) e islas Preact (header, banner, ruta, onboarding, lista de clases y campanita de fallos).
* **`renderers.js`**: Renderizador de la telemetría de descarga (el render de la lista se mudó a la isla Preact `listaClases`).
* **`background.js`**: Service Worker de segundo plano que gestiona la cola de descargas persistente y responde a las alarmas de auto-sanación.
* **`background/hlsEngine.js`**: Motor de red concurrente de descarga y descifrado de fragmentos de video `.ts` (6 workers en paralelo).
* **`core/`**: Núcleo genérico en TypeScript, sin nada del navegador ni del portal — los puertos (`puertos/`), el cliente del backend Bun (`backend/bunClient.ts`) y el historial de fallos (`historial/`).
* **`plataforma/`**: La única capa que toca la API del navegador — adaptadores de `chrome.*` (`chrome/`) y la raíz de composición (`composicion.ts`), donde se arman e inyectan las instancias.
* **`sitio/ramonnet/`**: Adaptador del portal — scraper del DOM, parser de títulos, resolución del `.m3u8` y constantes del sitio.
* **`shared/`**: Código compartido entre contextos — `state.ts` (`AppState`, estado del popup con persistencia), `conexion.ts` (daemon de conexión servidor + internet, fuente única para popup y Service Worker) y `utils.js` (sanitización, descifrado AES, reintentos y telemetría).
* **`public/`**: Archivos que se copian tal cual al build (iconos, el documento *offscreen* del camino legacy y el ruleset `declarativeNetRequest` del sitio).
* **`styles/`**: Sistema de tokens de diseño visual (Colores OLED, radios, espaciados, tipografías y pulso ECG animado) más un archivo por componente en `components/`.
* **`docs/`**: Documentación técnica mantenida como código — arranca por `docs/architecture.md`.
