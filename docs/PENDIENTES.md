# Pendientes — Quemagrasa

Lista viva de mejoras identificadas pero no aplicadas (encontradas en reviews, no bloquean nada, quedaron fuera de alcance a propósito). Actualizar aquí cuando se abra o cierre un pendiente.

## Estado general

- **Ajustes (sonido/pantalla/fullscreen/arcoíris):** cerrado, mergeado, sin pendientes. (`docs/superpowers/plans/2026-08-24-ajustes.md`)
- **Personalización de color + descubrimiento del arcoíris vía Ajustes:** cerrado, mergeado (`4b59fd8`), sin bloqueantes. Pendientes de pulido abajo. (`docs/superpowers/plans/2026-08-24-ajustes-color.md`)

## Pendientes de pulido (no bloquean, encontrados en el review final del color)

- [ ] **Colores hardcodeados que no siguen el tema elegido** — encontrados en el review final, marcados "cosmético, vale la pena un pase aparte":
  - `index.html` — `.mode-row.accent .mode-sub { color:#c98a2e }`
  - `correr.html` — color de la ruta/marcador del mapa (`#EF9F27`, 3 lugares)
  - `rapido.html` — `--rest:#5DCAA5` (variable que ningún tema define)
- [ ] **`cardio.html` y `prefs.js` mantienen dos copias de la misma tabla de 12 temas** (`THEMES`), con dos funciones `applyTheme` casi idénticas. Funciona hoy porque están sincronizadas a mano, pero es un riesgo de divergencia. Solución sugerida por el reviewer: que `cardio.html` delegue completamente a `Prefs.setThemeKey()`/`Prefs.applyThemeIfSet()` y solo mantenga su tabla local para dibujar los círculos (colores de muestra).
- [ ] **`cardio.html` ya no tiene reserva si `prefs.js` falla en cargar** — antes caía al tema guardado en `qg_config`, ahora cae directo a `'negro'`. Riesgo bajo (script del mismo origen), pero es una pérdida de comportamiento real, no documentada como decisión explícita.
- [ ] **`cardio.html`'s `currentConfig()` sigue escribiendo `themeKey` en el blob `qg_config`** — ya es dato muerto (solo se lee para la migración de una sola vez). Inofensivo, pero confunde a quien lea el código después.
- [ ] **Flash de tema residual para usuarios viejos de Cardio** — quien ya tenía un tema elegido en Cardio *antes* de esta feature ve un parpadeo del tema por defecto la primera vez que carga tras la actualización (se autocorrige y no vuelve a pasar). Corregirlo de raíz requeriría leer `qg_config` de forma síncrona, que la API `Store` actual no soporta.
- [ ] **`ajustes.html` mezcla llamadas con y sin `try/catch` en el arranque** (`syncToggleUI()`/`renderSwatches()`/`renderRainbowBox()` sin guardar, las 2 últimas líneas sí) — puramente estilístico, sin bug real.

## Ideas mencionadas por el usuario, no pedidas todavía como tarea formal

(ninguna pendiente en este momento — todo lo pedido hasta ahora ya se implementó)
