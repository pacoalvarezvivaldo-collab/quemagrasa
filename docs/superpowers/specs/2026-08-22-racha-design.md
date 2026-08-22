# Racha de entrenamiento — diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

La app tiene 5 modos donde se puede "entrenar" (Casa, Gimnasio, Ejercicio rápido, los 3 timers de cardio, Correr/Caminar), pero ninguno registra en qué fecha calendario se completó una sesión, ni existe ningún indicador de constancia entre días. El usuario quiere un contador de racha tipo Duolingo: días consecutivos con al menos un entrenamiento, visible en la pantalla de inicio.

## Alcance

**Ahora:**
- Archivo nuevo compartido `streak.js`: registra "hoy hubo actividad" (una vez por día, sin duplicar) y calcula la racha actual (días consecutivos terminando hoy o ayer).
- Se engancha en el momento de "sesión completada" de los 5 modos de entrenamiento: Casa y Gimnasio (vía `plan-engine.js`), Ejercicio rápido (`rapido.html`), los 3 timers de cardio (`cardio.html`), y Correr/Caminar (`correr.html`).
- **Registrar peso en "Tu progreso" NO cuenta** para la racha — es una decisión explícita del usuario (la racha es de entrenar, no de pesarse).
- Contador visible en `index.html`, junto al título/hero: `🔥 N días seguidos` (oculto o en 0 si no hay racha activa — sin mensaje motivacional extra, solo el número).
- Regla estricta: un día calendario completo sin ninguna de las 5 actividades rompe la racha a 0. Sin días de gracia, sin "streak freeze".

**Después (fuera de alcance, pospuesto explícitamente):**
- Sincronización con Supabase — la racha queda 100% local (`localStorage`), igual que Gimnasio y Progreso hoy. Ya hay 3 modos sin sync (Gimnasio, Progreso, y ahora Racha); extenderlo es trabajo aparte, cubierto por el proyecto de "sync completo" que se hará después.
- Historial/racha más larga alguna vez alcanzada (solo se guarda/muestra la racha actual, no un "récord personal").
- Notificaciones o recordatorios para no perder la racha.
- Contar "registrar peso" como actividad — evaluado y descartado explícitamente por el usuario.

## Modelo de datos (`localStorage`, prefijo `qg_` como el resto de datos compartidos de `index.html`)

- `qg_activity_log`: array de fechas `"YYYY-MM-DD"` (strings), una entrada por día con actividad, ordenado ascendente — mismo patrón de "un registro por día, sobreescribe/no duplica" que `qg_weight_log` de `weight-log.js`, pero aquí no hay valor asociado, solo la fecha misma (upsert = "si ya existe, no hacer nada").

## Interfaz de `streak.js`

```js
window.Streak = {
  todayStr(d?) -> "YYYY-MM-DD",           // reutiliza la misma lógica que WeightLog.todayStr
  recordActivity() -> void,               // agrega la fecha de hoy al log si no está ya
  getLog() -> string[],                   // array de fechas registradas
  getCurrentStreak(logOptional?, todayStrOptional?) -> number  // lógica pura, testeable sin localStorage
};
```

`getCurrentStreak` es pura: recibe opcionalmente el log y la fecha de "hoy" (para poder testear sin depender de `Date.now()` ni de `localStorage`), cuenta hacia atrás desde hoy cuántos días consecutivos tienen una fecha en el log. Si hoy no hay actividad pero ayer sí, la racha sigue contando desde ayer hacia atrás (para no romperla a medias del día antes de que el usuario tenga chance de entrenar hoy). Si ni hoy ni ayer tienen actividad, la racha es 0.

`streak.js` no depende de `weight-log.js` ni de `sync.js` — es un archivo independiente, mismo nivel que `weight-log.js` y `plan-engine.js`.

## Puntos de enganche (`Streak.recordActivity()`)

- **`plan-engine.js`**, dentro de `completeSession()` (cubre Casa `entrenamientos.html` y Gimnasio `gimnasio.html` de una sola vez, ya que ambos comparten este motor).
- **`rapido.html`**, dentro de `finishSession()`.
- **`cardio.html`**, dentro de `recordSession()` (la función que ya se llama al terminar un timer, junto a `_finishWorkout()`).
- **`correr.html`**, en el punto donde ya se guarda la sesión terminada en el historial local (junto a `saveHistoryEntry()`).

Cada uno de estos 5 archivos/páginas debe cargar `<script src="streak.js"></script>` antes de su script inline (mismo patrón que `weight-log.js` en `correr.html`/`index.html`).

## UI

En `index.html`, junto al `<div class="hero-title">` existente (que ya tiene el emoji 🔥 con su propio easter egg de 7 taps — el contador de racha es un elemento de texto aparte, no interfiere con ese emoji ni con su listener de clicks): un renglón nuevo `🔥 N días seguidos`, debajo del `hero-sub` actual. Si la racha es 0, no se muestra nada (sin mensaje de "racha en 0" ni invitación a empezar — silencioso hasta que haya al menos 1 día).

## CSP

Ningún archivo de los 5 modificados necesita un dominio nuevo — `streak.js` es JS puro sin red, mismo trato que `weight-log.js`/`plan-engine.js`. `<script src="streak.js">` cae bajo `script-src 'self'`, ya permitido en los 5.

## Testing

- `node --check` sobre `streak.js` y sobre cada uno de los 5 archivos modificados.
- Assert-based check de la lógica pura de `getCurrentStreak`: racha de 1 día (solo hoy), racha de varios días consecutivos, racha rota por un hueco de 2+ días, racha que sigue contando si falta hoy pero no ayer, log vacío → 0.
- Regresión manual: completar una sesión en cada uno de los 5 modos y confirmar que el contador de `index.html` sube; saltarse un día (simulable en devtools escribiendo directo en `qg_activity_log`) y confirmar que se rompe a 0 la próxima vez que se calcula.
