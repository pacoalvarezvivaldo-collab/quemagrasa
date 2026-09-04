# Pendientes — Quemagrasa

Lista viva de mejoras identificadas pero no aplicadas (encontradas en reviews, no bloquean nada, quedaron fuera de alcance a propósito). Actualizar aquí cuando se abra o cierre un pendiente.

## Estado general

- **Ajustes (sonido/pantalla/fullscreen/arcoíris):** cerrado, mergeado, sin pendientes. (`docs/superpowers/plans/2026-08-24-ajustes.md`)
- **Personalización de color + descubrimiento del arcoíris vía Ajustes:** cerrado, mergeado (`4b59fd8`), sin bloqueantes. Pendientes de pulido abajo. (`docs/superpowers/plans/2026-08-24-ajustes-color.md`)
- **Rediseño SPORTIUUM (marca, nav inferior, anillo en Rápido):** EN CURSO, sin mergear todavía. Ver "Retomar rediseño" abajo para dónde quedó exactamente.

## Retomar rediseño SPORTIUUM (si se corta la sesión)

- **Worktree:** `.claude/worktrees/rediseno-sportiuum` (rama `worktree-rediseno-sportiuum`), creado desde `origin/main` + cherry-pick de los commits de spec y plan que ya estaban en `main` local.
- **Spec:** `docs/superpowers/specs/2026-09-02-rediseno-sportiuum-design.md` (aprobada por el usuario).
- **Plan:** `docs/superpowers/plans/2026-09-02-rediseno-sportiuum.md` — 10 tareas, todas implementadas y con su revisión de tarea aprobada (ledger en `.superpowers/sdd/progress.md` dentro del worktree).
- **Qué falta:** los 2 hallazgos bloqueantes del review final ya se corrigieron (ver abajo) — falta una segunda revisión de esos 2 commits antes de mergear con `superpowers:finishing-a-development-branch`.
- **Hallazgos bloqueantes del review final — corregidos:**
  - [x] ~~`plan-engine.js` — `showScreen()` nunca llama `Nav.hide()`/`Nav.render()` al entrar/salir de la pantalla de sesión activa ("player") usada por `entrenamientos.html`/`gimnasio.html`~~ — resuelto (`1a002cf`): `showScreen()` ahora llama `Nav.hide()` al entrar a `'player'` y `Nav.render('entrenar')` en cualquier otra pantalla, mismo patrón que `rapido.html`.
  - [x] ~~`cardio.html` — el "follow-pill" queda tapado detrás del nav bar nuevo durante cardio en modo normal~~ — resuelto (`6732fe9`): `bottom` del pill ajustado a `calc(18px + 64px + var(--safe-bot))`, sumando la altura real del nav bar (`nav.js`'s `NAV_PADDING`, 64px).
- **Verificado manualmente en navegador** (servidor estático local, ya cerrado): nav inferior correcta en las 9 páginas, se oculta durante sesión activa de Rápido/Cardio/Correr, tarjeta "Correr / Caminar" funciona desde `cardio.html`, anillo circular de `rapido.html` se llena en sincronía con el reloj. (Antes de encontrarse los 2 bugs de arriba — no cubrió Casa/Gimnasio ni cardio en modo normal con el pill visible.)
- Commits del worktree: `4fef64a`(nav.js) → `3fc5897`(entrenar.html) → `79574bc`(index.html) → `d31cb3a`(entrenamientos+gimnasio) → `71f89e5`(cardio) → `01f9fa7`(correr) → `fc085f0`(rapido nav) → `1ceb4cb`(rapido anillo) → `016d0cc`(estadisticas+ajustes) → `8b878f5`(docs).

## Pendientes de pulido del rediseño SPORTIUUM (no bloquean, encontrados en el review final de la rama)

- [ ] **`activeKeyForPath(pathname)` en `nav.js` sin usar** — el mapeo archivo→tab vive duplicado a mano en cada una de las 9 páginas (`Nav.render('<key>')` literal); la función pura que ya existe para esto no la llama nadie. Un rename o página nueva que actualice un lado y no el otro deja una tab sin resaltar, en silencio.
- [ ] **Boilerplate de init repetido en 9 archivos** — `applyThemeIfSet()`, `applyRainbowIfOn()`, listener de fullscreen y `Nav.render(key)` se repiten verbatim en las 9 páginas (y `index.html` los ordena distinto a las demás). Cualquier fix a esta secuencia hoy requiere tocar 9 archivos.
- [ ] **Fórmula de progreso del anillo duplicada** — `rapido.html` (`ringPercent`) y `cardio.html` calculan `1 - left/dur` cada uno por su lado en vez de compartir una implementación; pueden desincronizarse con un fix futuro (p. ej. guardar contra `left > dur`).
- [ ] **CSS `.ring`/`.ring.rest` duplicado en `rapido.html`** — ambas reglas repiten el mismo `conic-gradient` completo, solo cambia el color inicial (`--accent` vs `--rest`); podría ser una sola regla parametrizada por variable CSS.
- [ ] **`updateTimer(left)` en `rapido.html` reescribe `className` en cada tick** — corre ~2400 veces en una sesión de 10 min (cada ~250ms), siempre reasigna el `className` completo del aro aunque la fase/porcentaje redondeado no haya cambiado (~75% de los ticks). Cachear el elemento y solo tocar `classList` cuando la fase cambia de verdad evitaría repaint innecesario.

## Pendientes de pulido (no bloquean, encontrados en el review final del color)

- [x] ~~Colores hardcodeados que no seguían el tema elegido~~ — resuelto (`a7f9301`): `index.html` usa `var(--accent)`; `correr.html` lee el acento vigente en runtime (`accentColor()`) para la ruta/marcador del mapa. `rapido.html`'s `--rest` se dejó fijo a propósito (color de estado "descanso", documentado con comentario — no es parte de los 12 temas).
- [x] ~~`cardio.html` y `prefs.js` mantienen dos copias de la misma tabla de 12 temas~~ — resuelto: `cardio.html` ya no tiene tabla `THEMES` propia ni pinta variables CSS; `applyTheme(k)` valida contra `Prefs.getThemeList()` y delega en `Prefs.setThemeKey()` (que a su vez llama `applyThemeIfSet()`), solo conserva el sincronizado de la clase `.active` en los swatches. Los swatches se dibujan desde `Prefs.getThemeList()`.
- [x] ~~`cardio.html` ya no tiene reserva si `prefs.js` falla en cargar~~ — decisión explícita, no requiere código: el `:root` de `cardio.html` ya define exactamente los valores del tema negro como default CSS, así que sin `prefs.js` la página no se rompe (solo ignora un tema distinto de negro que el usuario haya elegido). Agregar una tabla de 12 colores de respaldo solo para ese caso reintroduciría la duplicación que se acaba de eliminar arriba, a cambio de cubrir un riesgo casi nulo (`prefs.js` es archivo local del mismo origen, no de red). Se acepta el riesgo tal cual.
- [x] ~~`cardio.html`'s `currentConfig()` sigue escribiendo `themeKey` en el blob `qg_config`~~ — resuelto: `currentConfig()` ya no incluye `themeKey` en lo que guarda. La lectura de `c.themeKey` en `loadSettings()` se deja intacta a propósito — sigue siendo necesaria para migrar el valor de usuarios con un `qg_config` guardado antes de esta limpieza.
- [ ] **Flash de tema residual para usuarios viejos de Cardio** — quien ya tenía un tema elegido en Cardio *antes* de esta feature ve un parpadeo del tema por defecto la primera vez que carga tras la actualización (se autocorrige y no vuelve a pasar). Corregirlo de raíz requeriría leer `qg_config` de forma síncrona, que la API `Store` actual no soporta.
- [x] ~~`ajustes.html` mezcla llamadas con y sin `try/catch` en el arranque~~ — resuelto: se quitó el `try/catch` de `Prefs.applyThemeIfSet()`/`Prefs.applyRainbowIfOn()` en el arranque (prefs.js ya guarda sus propias llamadas a `localStorage` internamente, no había fallo real que atrapar), quedando las 5 llamadas de arranque al mismo nivel. El `try/catch` de `Prefs.maybeRequestFullscreen()` se deja intacto — vive en un listener de click, no en el arranque, y envuelve una llamada distinta (requestFullscreen) con más motivo real para fallar.

## Ideas mencionadas por el usuario, no pedidas todavía como tarea formal

(ninguna pendiente en este momento — todo lo pedido hasta ahora ya se implementó)
