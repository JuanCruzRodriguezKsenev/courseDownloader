# Ramas en revisión

**Hogar canónico del estado del trabajo en curso que todavía no está en `main`.**

Este doc existe para que ese estado deje de vivir en las reglas de agente (`AGENTS.md`). Es
información con fecha de vencimiento: cambia con cada merge, y mientras vivió en el banner de
`CLAUDE.md` lo hizo cambiar en 85 de 187 commits.

**Lo que este doc NO es:**

- No es el backlog. Los ítems abiertos viven en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- No es la baseline de la compuerta. Los números viven en `docs/testing.md` §Baseline.
- No es el diseño de nada. Cada corte apunta al doc que explica lo que construye.

---

## Estado al 2026-08-12 (tarde)

Hay **una sola rama**: `integracion-alertas`, que sale de `main` y junta todo lo de abajo.
`main` sigue siendo la referencia **verificada**; esta rama es lo construido y **sin verificar en
navegador**.

**La compuerta está entera en verde**: 610 tests, lint 0/0, `tsc` limpio, build OK, y el build
sigue sin empaquetar `backend/`. Los números y su desglose → `docs/testing.md` §Baseline.

### Qué trae, en el orden en que se construyó

| # | Commit | Qué trae |
|---|---|---|
| 1 | merge | **Frente de alertas** (ex-ramas 3 y 4): la alerta comparte contenedor con las listas, bloqueo real con `disabled`, 4 arreglos de layout |
| 2 | merge | **La selección sigue al filtro** (ex-rama 5) |
| 3 | merge | **Copy genérico** (ex-ramas 1 y 2): la UI deja de hablar como Ramón Net + `instruccionEscaneo` en `PuertoSitio` |
| 4 | `2e2eac8` | **El tope del escaneo sale del descriptor** — ítem 🔴 de la auditoría, el que se veía a diario |
| 5 | `928b436` | **Los otros cuatro loaders**: el que no se ve, la lista atenuada, los dos `fetch` sin techo, el onboarding con el portal legado |

Las cinco ramas viejas **ya no hacen falta**: están todas adentro. `copy-generico-verificacion`
—la sexta, la del banco de pruebas— **quedó obsoleta**: su build no tiene los cortes 4 y 5.

### Los conflictos que hubo, y por qué no eran de lógica

Cuatro, los cuatro de contexto: **tres cabeceras de versión** (`popup.js` ×2,
`serverConnection.js`) y **uno en la tabla de baseline** de `docs/testing.md`. Las ramas se
habían escrito cada una asumiendo que se mergeaba primero, así que las dos saltaban su número de
versión "porque la otra va antes". Resueltos conservando los dos changelogs en orden.

El de la baseline es el que vale contar: una rama decía 587 y la otra 580, y la suma correcta
—591— **no era ninguna de las dos**. Se midió con `npm test` en vez de resolverlo a ojo.

---

## Cómo verificarlo en Chrome

`npm run build` y recargar en `chrome://extensions/`. **El build actual de `.output/chrome-mv3/`
ya es el de esta rama.** Necesitás el backend corriendo (`backend/iniciar.bat`) para todo lo que
toque disco.

Las checklists detalladas ya están escritas y no hay que reconstruirlas:

- `docs/copy-generico-diseno.md` §7 — los 6 puntos del copy, con qué se espera y qué sería un bug.
- `docs/alertas-y-bloqueo-diseno.md` §5 — el frente de alertas y el bloqueo.

Lo que **suma esta tanda**, y no está en ninguna de las dos:

1. **El timeout de Anatomy dejó de saltar.** Escaneá Anatomy y esperá los ~11 s completos. Antes,
   a los 6 s aparecía «⚠️ Timeout de carga del DOM» y después se borraba solo. Ahora **no tiene
   que aparecer nada**: la lista llega y listo.
2. **El loader del escaneo ahora se ve.** Abrí el popup en una pestaña de portal. Tiene que verse
   «Escaneando la pestaña…» — antes era código muerto en pantalla, no se pintaba nunca.
   **Esto es precondición del punto siguiente.**
3. **El cartel del cambio de portal**, que es lo que pedía la checklist del copy y hasta ahora
   había que forzar con «Re-escanear»: ahora se observa abriendo el popup.
4. **El onboarding en Anatomy.** Abrí el tour (❓) **estando en una pestaña de Anatomy** y mirá la
   slide 3: tiene que describir el escaneo de un solo paso, **no** el selector de materia de
   Ramón Net. Abrí el mismo tour fuera de todo portal → cae al legado, que es correcto.
5. **La lista no queda al 50%.** Apagá el backend a mitad de una sincronización y volvé a
   prenderlo. Al reconectar la lista tiene que volver **opaca**, no atenuada.
6. **`backend/iniciar.bat`.** Con el server apagado, el banner y el onboarding tienen que nombrar
   la ruta **con la carpeta**. Decían `iniciar.bat` a secas desde la fusión, y ese archivo ya no
   está en la raíz.

### Si algo falla

Cada corte es un commit propio, así que `git revert` sobre el commit alcanza para aislar. Los
dos primeros son merges de ramas que **todavía existen**; los dos últimos, commits normales.

Si falla algo del frente de alertas o del copy, la rama vieja sigue disponible para mirarla en
aislamiento. Si falla algo de los loaders, es `2e2eac8` o `928b436` y nada más.
