# Rediseño SPORTIUUM: marca, navegación inferior y anillo en Rápido — diseño

**Fecha:** 2026-09-02
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

El usuario aprobó un mockup hecho con Claude Design (proyecto "Sportiuum fitness app", `fd0f2763-9d5f-43da-829e-4cbff8b04065`, archivo `SPORTIUUM Rediseño.dc.html`) como dirección visual para la app. El mockup define: un sistema de marca (tipografía Syne/Space Mono, logomark de 3 barras sesgadas, iconos SVG geométricos sólidos reemplazando emoji), una pantalla de inicio con nav inferior fija de 5 tabs, un timer de anillo circular para el modo de entrenamiento, y un layout de escritorio con sidebar.

De las 4 pantallas del mockup se aprobó implementar ahora: el sistema de marca, la nav inferior (adaptada a la arquitectura real de páginas separadas de la app, no la SPA del mockup), y el anillo de `rapido.html`. El layout de escritorio con sidebar queda fuera de alcance — la app se usa principalmente desde el celular. Un manifest.json/service worker para PWA instalable también queda fuera de alcance, como trabajo independiente posterior.

La paleta de 12 temas del mockup es idéntica, valor por valor, a la que ya existe en `prefs.js` — no hay paleta nueva que definir, solo reutilizar `Prefs.getThemeList()`/`Prefs.applyThemeIfSet()` ya existentes.

## Alcance

**Ahora:**

- **`nav.js`** (módulo nuevo, mismo patrón que `prefs.js`/`streak.js`: sin build, se incluye con `<script src="nav.js">`, sin conocimiento de Supabase). Expone `Nav.render(activeKey)`, que inyecta al final del `<body>` la barra inferior fija de 5 tabs — Inicio / Entrenar / Cardio / Progreso / Ajustes — con los 5 iconos SVG geométricos exactos del mockup (casa, mancuerna, círculo con hueco, barras, engrane) y resalta la tab `activeKey`. Cada página llama `Nav.render('<suKey>')` al cargar.
- **`entrenar.html`** (página nueva) — chooser con 3 tarjetas: Casa → `entrenamientos.html`, Gimnasio → `gimnasio.html`, Rápido → `rapido.html`. Mismo componente visual `.mode-row` que ya existe hoy en `index.html` — las 3 tarjetas se mueven de ahí para acá, sin rediseñarlas.
- **`cardio.html`** — se agrega una tarjeta más en el `machine-grid` existente (junto a elíptica/caminadora/caminadora en casa/escaladora): "Correr / Caminar", que navega a `correr.html`.
- **`rapido.html`, pantalla `play-screen`** — el timer actual se reemplaza por el anillo circular (`conic-gradient`) del mockup 1c: aro de progreso, reloj grande en Space Mono, etiqueta de fase (Trabajo/Descanso) en Syne, nombre del ejercicio actual y tarjeta "Sigue: {siguiente}". Se alimenta de las variables ya existentes (`phase`, `WORK_SECONDS`, `REST_SECONDS`, el tiempo restante del `tick()`) — no se toca la lógica de conteo, solo el render. `intro-screen` y `complete-screen` no cambian de contenido, pero si la nav se agrega a `rapido.html` (ver tabla de puntos de enganche), debe aparecer solo en esas dos, nunca en `play-screen`.
- **`index.html`** — se quitan las tarjetas Casa/Gimnasio/Rápido y la lista de 5 modos de cardio (elíptica/caminadora/caminadora en casa/escaladora/correr) — todo eso ahora se alcanza vía las tabs Entrenar/Cardio. Se agrega un botón grande de acceso directo a "Ejercicio rápido" (estilo acento, como en el mockup) por ser el modo más usado — el resto de `index.html` (hero, tarjeta "Tu progreso", racha, onboarding, easter eggs de la llama y de los botones que caen) se queda igual.
- **Tipografía** — añadir el mismo `<link>` de Google Fonts (Space Mono + Syne, ya presente en `index.html`) a `entrenar.html`, `entrenamientos.html`, `gimnasio.html`, `cardio.html`, `correr.html`, `estadisticas.html`, `ajustes.html`. Usar Space Mono para números/tiempos (relojes, kg, distancias) y Syne para nombres/etiquetas en las superficies tocadas por este trabajo (nav, anillo de `rapido.html`); no se reescribe la tipografía del resto de cada página.
- **Iconos** — el set SVG geométrico (copiado tal cual del `.dc.html`, mismo `viewBox` y trazo) se usa únicamente en los 5 iconos de `nav.js` y en la pantalla de anillo de `rapido.html`. El resto de la app conserva sus emoji actuales (🏠🏢⚡🌀🏃📊⚙️ etc.) — no se migran en esta ronda.
- **Logomark** (3 barras sesgadas) — se usa como marca en el header de `index.html` (reemplaza el 🔥 solo como marca de cabecera; el 🔥 de la racha y su easter egg de 7 toques se quedan igual, son cosas distintas) y queda disponible para un ícono PWA real cuando se aborde esa ronda aparte.

**Después (fuera de alcance, pospuesto explícitamente):**

- Layout de escritorio con sidebar (mockup 1d).
- `manifest.json`, ícono PWA en tamaños reales, service worker.
- Migrar el resto de los emoji de la app (index.html restante, entrenamientos.html, gimnasio.html, cardio.html, estadisticas.html) al set SVG geométrico.
- Cualquier cambio a los 12 temas de color existentes — se reutilizan tal cual.
- Rediseño de `estadisticas.html`, `entrenamientos.html`, `gimnasio.html`, `ajustes.html`, `correr.html`, `cardio.html` más allá de lo descrito arriba (nav + fuente + tarjeta de Correr).

## Dónde vive la nav inferior (por página)

| Página | Nav visible | `activeKey` |
|---|---|---|
| `index.html` | sí | `inicio` |
| `entrenar.html` | sí | `entrenar` |
| `entrenamientos.html` | sí | `entrenar` |
| `gimnasio.html` | sí | `entrenar` |
| `rapido.html` — `intro-screen`, `complete-screen` | sí | `entrenar` |
| `rapido.html` — `play-screen` | **no** (pantalla enfocada, ya tiene "✕ Salir") | — |
| `cardio.html` — selección de máquina | sí | `cardio` |
| `cardio.html` — timer activo | **no** (pantalla enfocada) | — |
| `correr.html` — pantalla de inicio de ruta | sí | `cardio` |
| `correr.html` — ruta activa | **no** (pantalla enfocada) | — |
| `estadisticas.html` | sí | `progreso` |
| `ajustes.html` | sí | `ajustes` |

`nav.js` decide "visible o no" por `activeKey`: si la página llama `Nav.render(key)` únicamente en sus pantallas de selección (y no en la de sesión activa, igual que ya hace cada página hoy con su propio manejo de pantallas), no necesita lógica adicional de mostrar/ocultar — el control lo tiene cada página al decidir cuándo llamar `Nav.render()`.

## Interfaz de `nav.js`

```js
window.Nav = {
  render(activeKey) -> void   // activeKey: 'inicio' | 'entrenar' | 'cardio' | 'progreso' | 'ajustes'
                               // inyecta la barra fija al final de document.body; usa var(--bg/--surface/--border/--accent/--muted)
                               // ya presentes en :root de cada página — ningún color nuevo que definir
};
```

Función pura incluida para pruebas: `activeKeyForPath(pathname)` — mapea el nombre de archivo actual a su `activeKey` esperado según la tabla de arriba (usada solo en el `demo()`/assert de prueba, no la usa `Nav.render` en producción, ya que cada página pasa su `activeKey` explícitamente).

## Anillo de `rapido.html`

Sustituye el markup/CSS del timer actual dentro de `#play-screen` por:

- Aro `conic-gradient(var(--accent) {progreso%}, var(--surface2) 0)` donde `{progreso%}` = `(1 - restante/dur) * 100`, recalculado en cada `tick()`.
- Centro del aro: reloj en Space Mono (mm:ss restante), etiqueta de fase arriba (Trabajo/Descanso) en Syne, color de acento si es fase de trabajo o `var(--muted)` si es descanso.
- Debajo del aro: nombre del ejercicio actual (Syne 800) + su descripción corta.
- Tarjeta "Sigue: {siguiente ejercicio o Descanso}".
- Los controles existentes (pausar/seguir, saltar, salir) se mantienen, solo se reposicionan alrededor del aro nuevo.

No cambia: `WORK_SECONDS`, `REST_SECONDS`, el arreglo de ejercicios de la sesión, `tick()`, `showScreen()`, wake lock, ni el guardado de racha/historial al completar.

## Puntos de enganche

| Página | Cambios |
|---|---|
| `nav.js` | nuevo |
| `entrenar.html` | nuevo |
| `index.html` | quita tarjetas Casa/Gimnasio/Rápido/modos de cardio; agrega botón grande "Ejercicio rápido"; agrega logomark en header; agrega `Nav.render('inicio')` |
| `entrenamientos.html` | agrega fuentes + `Nav.render('entrenar')` |
| `gimnasio.html` | agrega fuentes + `Nav.render('entrenar')` |
| `rapido.html` | agrega fuentes; `Nav.render('entrenar')` en intro/complete; anillo circular en play-screen |
| `cardio.html` | agrega fuentes; tarjeta "Correr / Caminar" en `machine-grid`; `Nav.render('cardio')` en selección de máquina |
| `correr.html` | agrega fuentes + `Nav.render('cardio')` en pantalla de inicio de ruta |
| `estadisticas.html` | agrega fuentes + `Nav.render('progreso')` |
| `ajustes.html` | agrega fuentes + `Nav.render('ajustes')` |

## CSP

Ningún dominio nuevo. Las fuentes ya están permitidas (`style-src ... https://fonts.googleapis.com; font-src https://fonts.gstatic.com`, ya usado en `index.html`) — solo se replica el mismo `<link>` en las 7 páginas restantes. Los iconos SVG son inline, no assets externos.

## Testing

- `node --check` sobre `nav.js` y las páginas modificadas (extracción de `<script>` inline donde aplique).
- Assert-based check de `activeKeyForPath(pathname)` contra la tabla de puntos de enganche.
- Assert-based check del cálculo de progreso del aro (`(1 - restante/dur) * 100`) contra casos límite: inicio de fase (0%), último segundo (~100%), cambio de fase (reinicia a 0%).
- Regresión manual: navegar las 8 páginas + `entrenar.html`, confirmar tab correcta resaltada en cada una y ausencia de nav durante sesión activa de rápido/cardio/correr. Completar una sesión de "Ejercicio rápido" y confirmar que el aro avanza en sincronía con el reloj y cambia de fase correctamente. Confirmar que "Correr / Caminar" aparece en el grid de `cardio.html` y navega a `correr.html`.
