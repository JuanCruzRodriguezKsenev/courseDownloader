# RamonNet Video Downloader (Turbo Edition) 🚀

Extensión de Chrome/Brave de alto rendimiento diseñada para descargar clases grabadas de forma masiva, organizada y veloz directamente a tu PC, superando las limitaciones habituales del navegador.

**Una sola extensión, dos portales** (desde el 2026-08-07):

| Portal | Dónde vive | Qué baja |
|---|---|---|
| **Ramón Net** | `plataforma.ramonnet.com.ar` | videos 480p, clasificados por cátedra |
| **Anatomy by Chris** | `hotmart.com/es/club/anatomy-by-chris` | videos hasta 720p **y los PDF adjuntos** |

Cada portal tiene su color en la lista, su propia carpeta en disco y su propio modo de escaneo. La cola es **una sola** y puede mezclar clases de los dos: el service worker las baja en orden sin que te importe de dónde salieron.

---

## ⚡ Características Principales

* **Descarga Multi-Worker Segmentada**: Utiliza un motor de red concurrente personalizado con 6 workers paralelos para acelerar la descarga de fragmentos HLS, mejorando el rendimiento entre un 15% y 30%.
* **Escritura Progresiva (Anti-Crash)**: Los videos se transmiten y ensamblan directamente en disco mediante un búfer físico de ventana deslizable (`.part`), manteniendo el consumo de memoria RAM inferior a 15 MB para cualquier tamaño de archivo.
* **Auto-Heal (Auto-sanación)**: Recuperación automática ante micro-cortes de internet o caídas temporales de red, pausando la cola de forma segura y reanudando la descarga en el fragmento exacto donde se interrumpió una vez restablecida la conexión.
* **Avisos de Fallos (Notificación + Campanita)**: Ante un fallo terminal de la cola (una clase saltada por rechazo del servidor, o la cola pausada por caída de sesión/servidor/internet), la extensión emite una **notificación nativa del sistema** —aunque el popup esté cerrado— y guarda el fallo en una **campanita** persistente en la cabecera, con un panel de historial (últimos 50) que se puede marcar como leído o limpiar.
* **Sesiones Únicas de Descarga**: Vinculación de tokens de red únicos (`session-id`) entre el navegador y el backend local, evitando fragmentos huérfanos en disco y colisiones por cancelaciones abruptas.
* **Organización Inteligente**: La extensión deduce y estandariza los nombres de las clases (Semanas, Materias, Cátedras) de forma automática. Crea la estructura de directorios en tu PC sin necesidad de intervención manual: `raíz/<portal>/<materia o módulo>/`. Si querés mandar un lote a otra carpeta, escribí el nombre en el campo **📚 Materia** antes de encolar y la fila te muestra el destino con un chip `→`.
* **Adjuntos (PDF)**: En Anatomy by Chris el escaneo trae también el material descargable de cada lección, no sólo los videos. Cada adjunto entra a la cola como una fila propia, con su ícono y su peso, y podés filtrarlos con el filtro por **tipo**.
* **Filtros y orden**: La lista se filtra por estado, por materia/cátedra y por tipo (video / adjunto), y se ordena por criterio (llegada, nombre, faceta, portal) con su propio sentido ↑↓. En la **Fila de Descarga** el orden que ves es el orden en que se baja.
* **Cola de Descarga Desacoplada**: La lista de descargas en cola se mantiene intacta en el storage local de la extensión, permitiendo cambiar de materia, re-escanear aulas o cerrar pestañas mientras el Service Worker gestiona las descargas de fondo.
* **Onboarding Interactivo (Welcome Tour)**: Guía paso a paso integrada de 6 slides que enseña a usar la extensión, configurar el servidor local y seleccionar directorios. Se puede volver a consultar en cualquier momento presionando el botón `❓` en la cabecera.

---

## 🛠️ Requisitos del Sistema

Para realizar las descargas físicas en tu disco, la extensión se conecta con un backend local ultraliviano programado en **Bun**.
* Tener la carpeta del backend local (`ramonnet-bun-backend`) en tu PC.
* Tener instalado [Bun](https://bun.sh/) (o utilizar el ejecutable empaquetado).

> ⚠️ **El backend y la extensión se actualizan juntos.** Si actualizás la extensión pero dejás un backend viejo, todo *parece* andar y los PDF se guardan con el nombre equivocado (`Atlas.pdf.mp4`): el nombre del archivo lo manda la extensión y el backend tiene que respetarlo. Asegurate de tener también al día la carpeta del backend.

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

El circuito es el mismo en los dos portales — **escanear → seleccionar → encolar → descargar**; lo único que cambia es el paso 1, porque cada portal muestra sus clases de forma distinta.

### En Ramón Net

1. Entrá al listado de clases grabadas de tu materia: [plataforma.ramonnet.com.ar/usuario/clases-grabadas](https://plataforma.ramonnet.com.ar/usuario/clases-grabadas).
2. Hacé clic en el botón de la materia que deseas descargar y presioná **👁️ mostrar** (ojo) al lado de las clases que quieras revelar. *La extensión lee lo que está visible en la página, así que lo que no revelaste no aparece.*

### En Anatomy by Chris

1. Entrá a la home del curso: [hotmart.com/es/club/anatomy-by-chris](https://hotmart.com/es/club/anatomy-by-chris/products/6083220).
2. Listo, no hay paso 2. **Un solo escaneo trae el curso entero** —los 11 módulos y sus 114 clases, videos y adjuntos— sin necesidad de abrir cada módulo ni de entrar a una clase, porque acá la extensión le pregunta directamente al portal en vez de leer la pantalla.

### Y a partir de ahí, igual en los dos

3. Abrí el popup de la extensión. Las clases detectadas aparecen en la pestaña **"Clases Disponibles"**, cada una con su ícono de tipo, su portal y la materia a la que va.
4. Seleccioná las clases deseadas y presioná **"Agregar a la fila"**.
5. Cambiá a la pestaña **"Fila de Descarga"**, acomodá el orden si querés, y presioná **"Iniciar descarga masiva 🚀"**.
6. Podés cerrar el popup, cambiar de materia o incluso irte al otro portal; la descarga continúa de fondo, en el orden que dejaste en la fila.

---

## 📁 Estructura del Repositorio

> Los fuentes viven en la **raíz** del repo (`srcDir: '.'`); lo que la extensión carga es
> `.output/chrome-mv3/`, generado por `npm run build`. Detalle técnico completo en
> `docs/architecture.md`.

* **`wxt.config.ts`**: Configuración del empaquetado y **origen del `manifest.json`** (permisos, hosts, dNR, iconos). El manifest ya no se escribe a mano: se genera desde acá.
* **`entrypoints/`**: Los puntos de entrada que detecta WXT — `entrypoints/popup/index.html` (plantilla visual del popup), `entrypoints/popup/main.js` y `entrypoints/background.js`. Estos dos últimos **arman e inyectan** las dependencias de cada contexto; lo único cuyo orden de import sigue importando son los adaptadores de sitio, que se leen perezosamente desde globals.
* **`popup.js`**: Orquestador principal de eventos, máquina de estados de UI y pasarela de mensajes IPC.
* **`popup/features/`**: Módulos autocontenidos de la UI del popup (conexión, cola, filtros, faceta, orden) e islas Preact (header, banner, ruta, onboarding, lista de clases y campanita de fallos).
* **`renderers.js`**: Renderizador de la telemetría de descarga (el render de la lista se mudó a la isla Preact `listaClases`).
* **`background.js`**: Service Worker de segundo plano. Hoy es sobre todo cableado: los handlers IPC y los listeners de `chrome.*`; la cola y el motor viven en `core/`.
* **`core/`**: Núcleo genérico en TypeScript, sin nada del navegador ni del portal. Los puertos (`puertos/`), la cola de descarga con su bucle y máquina de estados (`cola/`), el motor HLS de 6 workers (`hls/`), el daemon de conexión (`conexion/`), el estado del popup (`estado/`), el cliente del backend Bun (`backend/`), el historial de fallos (`historial/`) y las utilidades puras (`util/`).
* **`plataforma/`**: La única capa que toca la API del navegador — adaptadores de `chrome.*` (`chrome/`) y la raíz de composición (`composicion.ts`), donde se arman e inyectan todas las instancias.
* **`sitio/`**: Un adaptador por portal — `ramonnet/` y `anatomy-by-chris/`, cada uno con su escaneo, su parser de títulos, su resolución del `.m3u8` y su descriptor (`config.ts`); más `registro.ts`, que decide qué portal está activo. Agregar un portal nuevo se hace acá y **no toca el núcleo ni la UI** (paso a paso en `docs/multisitio-diseno.md`).
* **`public/`**: Archivos que se copian tal cual al build (iconos, el documento *offscreen* del camino legacy y **un ruleset `declarativeNetRequest` por portal**).
* **`styles/`**: Sistema de tokens de diseño visual (Colores OLED, radios, espaciados, tipografías y pulso ECG animado) más un archivo por componente en `components/`.
* **`docs/`**: Documentación técnica mantenida como código — arranca por `docs/architecture.md`.
