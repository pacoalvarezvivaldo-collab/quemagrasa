# Estadísticas globales — diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

Cada modo de la app guarda su propio progreso, pero no hay una vista que junte todo. El usuario quiere una pantalla de estadísticas globales — total de sesiones, km, kcal quemadas — combinando los 5 modos de entrenamiento.

Al investigar qué datos existen realmente, aparece una limitación real: solo Correr/Caminar y los timers de cardio guardan kcal por sesión. Casa y Gimnasio solo guardan qué días del plan de 30 se completaron (sin fecha ni kcal). Ejercicio rápido no persiste absolutamente nada — ni siquiera un contador de sesiones. Decisión explícita del usuario: la página muestra lo que cada modo realmente tiene, sin inventar un "total kcal" unificado falso donde no hay dato real. Sin agregar estimación de kcal a los modos que no la tienen (evaluado y descartado — trabajo mucho mayor, tocaría los 5 archivos existentes).

## Alcance

**Ahora:**
- Página nueva `estadisticas.html`, enlazada con una tarjeta nueva "📈 Estadísticas" en `index.html`.
- Sin JS compartido nuevo — la página lee directamente las llaves de `localStorage` que cada modo ya escribe hoy, y calcula sumas/conteos al cargar. Es una vista de solo lectura; no engancha nada nuevo en los 5 modos existentes, no escribe nada.
- 6 bloques de contenido (ver "Contenido" abajo).
- Ejercicio rápido, que no guarda nada, muestra su tarjeta igual que los demás pero con el mensaje "Sin datos guardados aún" en vez de números.

**Después (fuera de alcance, pospuesto explícitamente):**
- Estimar kcal para Casa/Gimnasio/Ejercicio rápido (ejercicios de peso corporal) — evaluado y descartado por el usuario para esta ronda; permitiría después un "total kcal" verdaderamente unificado de los 5 modos.
- Agregar contador de sesiones a Ejercicio rápido — necesitaría tocar `rapido.html` para empezar a persistir algo, fuera de esta spec (que es de solo lectura sobre datos existentes).
- Gráficas o tendencias a lo largo del tiempo — esta spec es solo totales/conteos actuales, sin series de tiempo.
- Sincronización con Supabase — la página lee `localStorage` local, igual que el resto de datos no sincronizados hoy (Gimnasio, Progreso, Racha).

## Fuentes de datos (todas ya existentes, ninguna se crea en esta spec)

| Bloque | Llave(s) de `localStorage` | Campos usados |
|---|---|---|
| Resumen general | `qg_activity_log` (de `streak.js`) | fechas únicas → total de días entrenados; `Streak.getCurrentStreak()` → racha actual |
| Correr/Caminar | `correr_history` | array de `{date, mode, distanceM, elapsedS, steps, kcal}` → cuenta, suma `distanceM`, suma `kcal` |
| Cardio (Elíptica+Caminadora+Escaladora) | `qg_history` | array de `{d, min, lvl, mac, kcal, spr}` → cuenta, suma `kcal`, suma `spr`. Las 3 máquinas comparten esta misma llave/historial, así que el bloque las combina, no las separa por máquina |
| Casa | `ent_level`, `ent_completed` | nivel actual (label desde el mismo mapa `LEVELS` de `plan-engine.js`) + `ent_completed.length`/30 |
| Gimnasio | `gym_level`, `gym_completed` | igual que Casa, con prefijo `gym_` |
| Ejercicio rápido | (ninguna — no persiste nada) | mensaje fijo "Sin datos guardados aún" |

## UI

`index.html`: nueva tarjeta `<a class="mode-row">` "📈 Estadísticas" en `.mode-list`, mismo estilo que las demás, enlazando a `estadisticas.html`.

`estadisticas.html`: mismo shell visual que el resto de páginas (topbar con botón "volver" a `index.html`, mismas variables de tema). Contenido: 6 tarjetas apiladas en orden (Resumen general, Correr, Cardio, Casa, Gimnasio, Ejercicio rápido), cada una con su título e íconos coherentes con los ya usados en `index.html` (🏠 Casa, 🏢 Gimnasio, ⚡ Rápido, 🏃 Correr, mezcla de íconos de cardio). Solo lectura — sin formularios, sin botones de acción salvo el de volver.

## CSP

`estadisticas.html` no necesita ningún dominio nuevo — solo lee `localStorage` local, sin red. Mismo `script-src 'self'` que el resto de páginas de la app.

## Testing

- `node --check` sobre `estadisticas.html`.
- Assert-based check de la lógica pura de agregación (sumas de km/kcal/sesiones a partir de arrays de ejemplo), extraída con el mismo patrón de marcadores `/* ---------- lógica pura ---------- */` usado en `weight-log.js`/`streak.js`.
- Regresión manual: con datos reales en cada modo (o simulados desde devtools escribiendo en las llaves de la tabla de arriba), confirmar que cada tarjeta de `estadisticas.html` muestra los números correctos; con `localStorage` vacío, confirmar que cada tarjeta se degrada con gracia (0 sesiones, 0 km, etc., sin errores de consola) y que Ejercicio rápido siempre muestra su mensaje fijo.
