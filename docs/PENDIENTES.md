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
- **Qué falta:** el revisor final de rama completa (dispatch con modelo opus, rango `c22acec..016d0cc`) está corriendo — falta leer su veredicto. Si aprueba sin hallazgos Críticos/Importantes → usar `superpowers:finishing-a-development-branch` para mergear a `main` y hacer push. Si encuentra hallazgos, corregirlos (un solo subagente con la lista completa) y volver a pedir revisión antes de mergear.
- **Verificado manualmente en navegador** (servidor estático local, ya cerrado): nav inferior correcta en las 9 páginas, se oculta durante sesión activa de Rápido/Cardio/Correr, tarjeta "Correr / Caminar" funciona desde `cardio.html`, anillo circular de `rapido.html` se llena en sincronía con el reloj.
- Commits del worktree: `4fef64a`(nav.js) → `3fc5897`(entrenar.html) → `79574bc`(index.html) → `d31cb3a`(entrenamientos+gimnasio) → `71f89e5`(cardio) → `01f9fa7`(correr) → `fc085f0`(rapido nav) → `1ceb4cb`(rapido anillo) → `016d0cc`(estadisticas+ajustes).

## Pendientes de pulido (no bloquean, encontrados en el review final del color)

- [x] ~~Colores hardcodeados que no seguían el tema elegido~~ — resuelto (`a7f9301`): `index.html` usa `var(--accent)`; `correr.html` lee el acento vigente en runtime (`accentColor()`) para la ruta/marcador del mapa. `rapido.html`'s `--rest` se dejó fijo a propósito (color de estado "descanso", documentado con comentario — no es parte de los 12 temas).
- [x] ~~`cardio.html` y `prefs.js` mantienen dos copias de la misma tabla de 12 temas~~ — resuelto: `cardio.html` ya no tiene tabla `THEMES` propia ni pinta variables CSS; `applyTheme(k)` valida contra `Prefs.getThemeList()` y delega en `Prefs.setThemeKey()` (que a su vez llama `applyThemeIfSet()`), solo conserva el sincronizado de la clase `.active` en los swatches. Los swatches se dibujan desde `Prefs.getThemeList()`.
- [x] ~~`cardio.html` ya no tiene reserva si `prefs.js` falla en cargar~~ — decisión explícita, no requiere código: el `:root` de `cardio.html` ya define exactamente los valores del tema negro como default CSS, así que sin `prefs.js` la página no se rompe (solo ignora un tema distinto de negro que el usuario haya elegido). Agregar una tabla de 12 colores de respaldo solo para ese caso reintroduciría la duplicación que se acaba de eliminar arriba, a cambio de cubrir un riesgo casi nulo (`prefs.js` es archivo local del mismo origen, no de red). Se acepta el riesgo tal cual.
- [x] ~~`cardio.html`'s `currentConfig()` sigue escribiendo `themeKey` en el blob `qg_config`~~ — resuelto: `currentConfig()` ya no incluye `themeKey` en lo que guarda. La lectura de `c.themeKey` en `loadSettings()` se deja intacta a propósito — sigue siendo necesaria para migrar el valor de usuarios con un `qg_config` guardado antes de esta limpieza.
- [ ] **Flash de tema residual para usuarios viejos de Cardio** — quien ya tenía un tema elegido en Cardio *antes* de esta feature ve un parpadeo del tema por defecto la primera vez que carga tras la actualización (se autocorrige y no vuelve a pasar). Corregirlo de raíz requeriría leer `qg_config` de forma síncrona, que la API `Store` actual no soporta.
- [x] ~~`ajustes.html` mezcla llamadas con y sin `try/catch` en el arranque~~ — resuelto: se quitó el `try/catch` de `Prefs.applyThemeIfSet()`/`Prefs.applyRainbowIfOn()` en el arranque (prefs.js ya guarda sus propias llamadas a `localStorage` internamente, no había fallo real que atrapar), quedando las 5 llamadas de arranque al mismo nivel. El `try/catch` de `Prefs.maybeRequestFullscreen()` se deja intacto — vive en un listener de click, no en el arranque, y envuelve una llamada distinta (requestFullscreen) con más motivo real para fallar.

## Ideas mencionadas por el usuario, no pedidas todavía como tarea formal

(ninguna pendiente en este momento — todo lo pedido hasta ahora ya se implementó)
