# Plan — Al terminar la descarga, la lista de todos los cursos se conserva

**Rama**: `classroom-escanear-todas`. **Fecha**: 2026-09-27. Árbol limpio al empezar.
**Origen**: reporte del dueño en Brave (2026-09-27): *"al terminar de descargar con todos los cursos
quiere hacer un scaneo rápido y no puede y dice que no hay nada; debería usar la memoria y aparecer
el botón de reescanear, ya que el escaneo es muy largo"*.
**Spec**: `docs/specs/classroom-escanear-todas/spec.md`. RN-18 (se guarda una sola lista) y la
§Tabla de decisión, fila 2 (portada + lista de todos → se muestra esa lista con su resumen). Ninguna
regla dice que terminar la descarga la borre: el defecto es que se borra.

## Diagnóstico (leído en el código y en el storage de Brave)

Storage del dueño tras la corrida: `origenListado = {sitioId: "google-classroom", clave: "todos"}`,
`recorridoTodos.estado = "terminado"`, `materializado: true`. Es decir, la lista de los 7 cursos estaba
guardada y era la que había que mostrar.

Lo que pasa cuando la cola se vacía con el popup abierto:

1. El SW manda `cola_completamente_vacia` → `popup.js:2620` llama
   `restaurarPanelPorInterrupcion("🏁 ¡Procesamiento terminado!", true)`.
2. Con `limpiarCola = true`, `popup.js:2644` llama `appState.limpiarSesionLocal()`
   (`core/estado/appState.ts:467-481`). Hoy eso **vacía `listadoClasesGlobal` y `origenListado` en
   memoria** y **borra del storage** las cinco `CLAVES_DE_SESION` (`appState.ts:174-180`):
   `listaPersistente`, `origenListado`, `colaDescargas`, `faseDiscoOk` y **`recorridoTodos`**.
3. Después `popup.js:2681` llama **directo** a `ejecutarPaso1EscaneoRamonAutomatico()`, sin pasar
   por `escanearOUsarGuardada()`. Es el escaneo de **un** curso, y la pestaña está en la portada
   (`/h`, adonde el recorrido la devuelve al terminar, RN-20..22 de `loader-con-progreso`), así que
   no encuentra material: "no hay nada".
4. Si el dueño reabre el popup, la lista y el recorrido ya no están en storage: la tabla de decisión
   cae en la fila 3 ("Escanear todos los cursos"), y el recorrido de ~2 min se perdió.

Con el popup **cerrado** al terminar la cola, el mensaje no llega a nadie y la lista sobrevive: por eso
el defecto sólo aparece si el dueño mira terminar la descarga.

**Decisión (mía, por lo que dijo el dueño: "el escaneo es muy largo")**: el cambio aplica sólo cuando
la lista guardada salió de un recorrido (`origenListado.clave === "todos"`). El escaneo de un curso
y los otros portales quedan como en `main` (RN-19 de la spec: el escaneo de un curso no cambia):
re-escanear un curso tarda ~20 s y es lo que refresca sus estados. La comparación con `"todos"` ya
tiene dos precedentes en el popup (`popup.js:2266` agrupa por curso y `:2375` pinta el resumen), así
que no agrega vocabulario de portal nuevo.

## Paso 1 — `core/estado/appState.ts`: `limpiarColaConservandoLista()`

Al lado de `limpiarSesionLocal()` (`:467`), un método nuevo:

```ts
    /**
     * Fin de una cola que salió de un recorrido: se va la cola, la lista y su origen quedan.
     * Re-escanear todos los cursos cuesta minutos, así que la lista no se tira al terminar de
     * bajar (reporte del dueño, 2026-09-27). `recorridoTodos` también queda: el resumen del
     * recorrido lo pinta el popup desde ahí (`popup.js:2375`).
     */
    limpiarColaConservandoLista(): void {
      app.colaDescargas = [];
      app.ráfagaEnCurso = false;
      app.banderaFrenadoSolicitado = false;
      app.sincronizacionDiscoCompletada = false;
      app.videoActualEnTransmisiónSW = "";
      app.modoTurboBun = true;
      void almacenamiento.borrarLocal(["colaDescargas", "faseDiscoOk"]).catch((e: unknown) => {
        console.warn("[AppState] Error al limpiar la cola:", e);
      });
    },
```

- **No toca** `listadoClasesGlobal`, `origenListado`, `listaPersistente` ni `recorridoTodos`.
- **No modificar** `limpiarSesionLocal()` ni `CLAVES_DE_SESION`: los usan el resto de los portales y
  el escaneo de un curso.
- Header del archivo: pasar a `V6.5.0` con un bullet de CHANGELOG
  `[CLASSROOM ESCANEAR TODAS] limpiarColaConservandoLista(): el fin de cola de un recorrido no tira la lista.`

## Paso 2 — `popup.js`: `restaurarPanelPorInterrupcion`

`restaurarPanelPorInterrupcion(txt, limpiarCola = false)` (`:2630`):

1. **Antes** del `if (limpiarCola)` de `:2643`, calcular:

   ```js
   // [CLASSROOM ESCANEAR TODAS] La lista de un recorrido no se tira al terminar la cola: volver
   // a escanear todos los cursos cuesta minutos. Se muestra la guardada y se sincroniza el disco.
   const conservarLista = limpiarCola && appState.origenListado?.clave === "todos";
   ```

   Tiene que calcularse **antes** de limpiar: después `origenListado` ya sería `null`.

2. En `:2643-2644`: si `conservarLista`, llamar `appState.limpiarColaConservandoLista()`; si no,
   `appState.limpiarSesionLocal()` como hoy. La rama `else` (`limpiarCola = false`) no cambia.

3. En el `if (!limpiarCola) { … } else { … }` de `:2671`, rama `else` (la de `limpiarCola`): en vez de
   `ejecutarPaso1EscaneoRamonAutomatico()` a secas,

   ```js
   if (conservarLista) {
     mostrarListaGuardada();
   } else {
     ejecutarPaso1EscaneoRamonAutomatico();
   }
   ```

   `mostrarListaGuardada()` (`:1337-1350`) hoy: pone `sincronizacionDiscoCompletada = false`,
   re-renderiza la lista, oculta el loader y llama `ejecutarPaso2SincronizarDiscoVeloz()`, que marca
   como descargado lo que ya está en disco. Es exactamente lo que hace la fila "usar-guardada" al
   abrir el popup (`:1541-1544`), así que el popup queda igual que si lo cerraras y lo abrieras.

4. Header de `popup.js`: bullet de CHANGELOG en el bloque de `[CLASSROOM ESCANEAR TODAS]` que ya
   existe (`:28` aprox.), con el mismo texto que el Paso 1.

**Qué ve el dueño después**: la lista agrupada de los 7 cursos con su resumen, lo bajado marcado como
descargado, el botón principal en "Seleccioná clases" y el **🔄 de la cabecera** visible en
Disponibles (`popup.js:1246`). 🔄 en la portada relanza el recorrido (`reescanearSegunPestaña`,
`:1466-1475`, RN-20).

## Paso 3 — Tests en `core/estado/appState.test.ts`

Un `describe("AppState.limpiarColaConservandoLista")` después del de `limpiarSesionLocal` (`:258`),
copiando su forma (`guardarLocal` inicial, `inicializarSincronizacionStorage`, llamada,
`dejarCorrer()`, `_volcar().local`):

- Storage inicial: `listaPersistente: [{ titulo: "A", sitioId: "google-classroom" }]`,
  `origenListado: { sitioId: "google-classroom", clave: "todos" }`, `colaDescargas: [{ id: 1 }]`,
  `faseDiscoOk: true`, `recorridoTodos: { estado: "terminado" }` y una clave que no es de sesión
  (la misma que usa el test de `limpiarSesionLocal`).
- Espera **en memoria**: `colaDescargas` vacío, `ráfagaEnCurso` y `sincronizacionDiscoCompletada`
  en `false`, `listadoClasesGlobal` con 1 elemento y `origenListado` igual al inicial.
- Espera **en storage**: `colaDescargas` y `faseDiscoOk` ausentes; `listaPersistente`,
  `origenListado`, `recorridoTodos` y la clave ajena presentes.

**Control negativo obligatorio, con la salida pegada**: cambiar temporalmente el cuerpo del método
nuevo por `app.limpiarSesionLocal()` y correr el archivo: el test tiene que **fallar** en
`listadoClasesGlobal` o en `listaPersistente`. Revertir. Si pasa igual, no detecta nada: reportarlo.

## Radio de impacto

- `limpiarSesionLocal()`: sin cambios. Sus otros llamadores siguen igual (`git grep -n limpiarSesionLocal`
  tiene que mostrar el mismo `popup.js:2644`, ahora dentro de la rama `else`, y los tests).
- `restaurarPanelPorInterrupcion` con `limpiarCola = false` (frenado suave, `:2618`, y los demás
  llamadores): no entra en ninguna rama nueva, porque `conservarLista` exige `limpiarCola`.
- Ramón Net, Anatomy y un curso de Classroom: `origenListado.clave` no es `"todos"` → camino de hoy.
- `recorridoTodos` en storage: sobrevive al fin de cola. Al abrir de nuevo el popup,
  `decidirAlAbrir` (`core/estado/origenListado.ts`) ve `materializado: true` → no re-materializa, y la
  fila `usar-guardada` aplica en la portada. En un curso, la fila 5 escanea ese curso y reemplaza,
  como dice RN-18.
- SW, scraper y backend: no se tocan. No hace falta reiniciar Bun.

## Verificación A (pegar la salida)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
git grep -n "limpiarColaConservandoLista\|conservarLista" -- core/estado/appState.ts popup.js core/estado/appState.test.ts
```

Baseline actual: 46 archivos / 798 tests → **46 / 799** (o los que sume el `describe`, anotados en
`docs/testing.md`). Más la salida del control negativo del Paso 3.

## Verificación B (dueño, en Brave)

`pnpm run build`, recargar la extensión, pestaña de Classroom **al frente** en la portada.

- **L-10**: con la lista de todos los cursos en pantalla, elegir 2-3 archivos y bajarlos **con el
  popup abierto** hasta que termine la cola. Tiene que quedar la lista de los 7 cursos, con el
  resumen, lo bajado marcado como descargado y el 🔄 de la cabecera visible. **No** tiene que aparecer
  el loader "Escaneando la pestaña..." ni un "no hay nada".
- Cerrar y reabrir el popup en la portada: la misma lista, sin escanear.
- 🔄 en la portada: relanza el recorrido de todos los cursos (no hace falta dejarlo terminar).
- Control de que el resto no cambió: en un curso suelto, escanear, bajar 1 archivo con el popup
  abierto → al terminar re-escanea ese curso, como hoy.

## Doc

- `docs/ramas-en-revision.md`: el 🔴 "Al terminar la cola se tira la lista de todos los cursos"
  pasa a ✅ con una línea (qué hace `limpiarColaConservandoLista`, dónde se llama, número de tests), y
  el ítem **L-10** de arriba se agrega al checklist después del L-9.
- `docs/data-model.md`, tabla de claves: las filas de `origenListado` (`:14`) y `recorridoTodos`
  (`:15`) dicen hoy "Se borra con `limpiarSesionLocal`". Agregarles: "…salvo al terminar la cola de
  un recorrido (`origenListado.clave === "todos"`), que usa `limpiarColaConservandoLista` y las
  conserva". Lo mismo en la fila de `listaPersistente` (`:11`), que hoy no dice cuándo se borra.
- `docs/testing.md`: el baseline nuevo.
