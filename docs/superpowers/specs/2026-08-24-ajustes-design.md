# Ajustes de interfaz — diseño

**Fecha:** 2026-08-24
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

Cardio (`cardio.html`) ya tiene su propia pantalla de Ajustes con sonido de aviso, "mantener pantalla encendida" y "números gigantes" — pero es por sesión y solo vive ahí. Casa, Gimnasio, Ejercicio rápido y Correr/Caminar no tienen ningún control de este tipo: en Casa/Gimnasio el beep de aviso siempre suena, en Correr/Rápido la pantalla siempre se mantiene encendida sin poder apagarlo, y no existe pantalla completa en ningún lado. El usuario quiere un solo lugar centralizado donde configurar estas preferencias para toda la app, no una por cada modo.

También existe ya un easter egg oculto en `index.html` (tocar 6 zonas invisibles en la secuencia de colores del arcoíris) que activa un modo de color permanente — hoy solo afecta la pantalla de Inicio. Se pide extenderlo a toda la app y darle visibilidad en Ajustes una vez descubierto.

## Alcance

**Ahora:**
- Archivo nuevo compartido `prefs.js` con 3 preferencias de interfaz, persistidas en `localStorage` (por dispositivo/navegador, no sincronizadas con Supabase — son ajustes de interfaz, no datos de usuario):
  - `soundWarningOn` (default **true**): beep + vibración de aviso antes de que acabe un descanso/intervalo.
  - `keepScreenOn` (default **true**): mantener la pantalla encendida (Wake Lock) durante una sesión activa.
  - `fullscreenPref` (default **false**): pantalla completa del navegador.
- Página nueva `ajustes.html`, enlazada al final de la lista de modos en `index.html` (después de "Estadísticas"). Mismo look visual que la app (toggles estilo iOS, reutilizando el patrón `.toggle-row` que ya existe en `cardio.html`).
- **`plan-engine.js`** (Casa + Gimnasio): el único beep/vibrate que existe hoy (10s antes de terminar el descanso, en `tickRest()`) respeta `soundWarningOn`. Se agrega Wake Lock nuevo (no existía ahí), respetando `keepScreenOn`.
- **`rapido.html`**: gana el mismo beep de aviso 10s antes de terminar el descanso entre ejercicios (hoy no lo tiene). Su Wake Lock, hoy siempre activo sin opción de apagarlo, pasa a respetar `keepScreenOn`.
- **`correr.html`**: su Wake Lock, hoy siempre activo sin opción de apagarlo, pasa a respetar `keepScreenOn`. No tiene concepto de "siguiente ejercicio", así que `soundWarningOn` no le aplica.
- **`cardio.html`**: sus toggles existentes "Mantener pantalla encendida" (`bgMode`) y "Beeps de cambio de bloque" (`soundOn`, que además gobierna el aviso `preWarn`) se migran a leer/escribir las mismas llaves compartidas `keepScreenOn`/`soundWarningOn` en vez de su propio storage — cambiarlo ahí también lo cambia en el resto de la app y viceversa. Sus otros ajustes (números gigantes ⛶, ajuste ± en vivo, "propagar a bloques siguientes", calibración de máximos de la máquina) son específicos del timer HIIT y no se tocan.
- **Pantalla completa**: nueva en todas las páginas. Como los navegadores solo permiten activarla con un toque directo del usuario y se sale sola al navegar a otra página (cada pantalla de la app es un `.html` distinto), cada página, en el primer toque que reciba en cualquier parte, revisa si `fullscreenPref` está activo y si el documento no está ya en pantalla completa — si no, la pide. Invisible para el usuario, sin botón ni aviso.
- **Modo arcoíris**: se extiende para aplicar en las 8 páginas de la app (hoy solo en `index.html`), no solo en Inicio. En Ajustes se muestra su estado: si no se ha descubierto, una nota genérica de que hay un modo de color secreto en Inicio (sin revelar cómo); si ya se descubrió, un toggle propio para prender/apagar el ciclo de color sin tener que repetir la secuencia de 6 toques.

**Después (fuera de alcance, pospuesto explícitamente):**
- Sincronizar estas preferencias entre dispositivos vía Supabase — son ajustes de interfaz por navegador, no datos de la cuenta.
- Cambiar el mecanismo de descubrimiento del modo arcoíris (sigue siendo secreto, tocar las 6 zonas).
- Tocar los ajustes específicos de Cardio que no mapean a preferencias globales (números gigantes, ajuste ± en vivo, propagar, calibración de máximos).
- Un beep separado exactamente en el momento del cambio de ejercicio (distinto del aviso de 10s antes) — evaluado y descartado: es el mismo sonido, un solo interruptor.

## Modelo de datos (`localStorage`)

```
qg_pref_sound       "1" | "0"   (default: tratado como "1" si no existe)
qg_pref_screen      "1" | "0"   (default: tratado como "1" si no existe)
qg_pref_fullscreen  "1" | "0"   (default: tratado como "0" si no existe)
qg_rainbow          "1" | ausente   (ya existe, sin cambios de formato)
```

## Interfaz de `prefs.js`

```js
window.Prefs = {
  getSoundWarningOn() -> boolean,      // default true
  setSoundWarningOn(v) -> void,
  getKeepScreenOn() -> boolean,        // default true
  setKeepScreenOn(v) -> void,
  getFullscreenPref() -> boolean,      // default false
  setFullscreenPref(v) -> void,
  maybeRequestFullscreen() -> void,    // si fullscreenPref && no estás ya en fullscreen, la pide (llamar en el primer toque de la página)
  isRainbowOn() -> boolean,            // lee qg_rainbow (ya existente, sin cambiar su formato)
  applyRainbowIfOn() -> void,          // si isRainbowOn(), arranca el ciclo de --accent en la página actual (llamar al cargar cualquier página)
  setRainbowOn(v) -> void              // prender/apagar el ciclo ya descubierto — no dispara el descubrimiento en sí
};
```

`prefs.js` no depende de ningún otro módulo — mismo nivel que `weight-log.js`/`streak.js`. Cada página que lo use debe cargar `<script src="prefs.js"></script>` antes de su script inline.

**Modo arcoíris — descubrimiento vs. efecto:** el mecanismo de descubrimiento (tocar las 6 zonas invisibles en secuencia) se queda exclusivamente en `index.html`, sin duplicarse — es el único punto de entrada al secreto. El *efecto* (el ciclo de color en sí, y encenderlo/apagarlo una vez descubierto) se mueve a `prefs.js` para que `index.html` y las demás 7 páginas compartan la misma lógica en vez de reimplementarla cada una. `index.html` sigue teniendo sus zonas ocultas y, al completar la secuencia, llama `Prefs.setRainbowOn(true)`; las demás páginas solo llaman `Prefs.applyRainbowIfOn()` al cargar.

## Puntos de enganche

| Página | Sonido de aviso | Pantalla encendida | Pantalla completa |
|---|---|---|---|
| `entrenamientos.html` / `gimnasio.html` (`plan-engine.js`) | gatea el beep/vibrate existente en `tickRest()` | Wake Lock nuevo | primer toque |
| `rapido.html` | gatea beep nuevo antes de terminar el descanso | gatea el Wake Lock existente (hoy incondicional) | primer toque |
| `correr.html` | no aplica | gatea el Wake Lock existente (hoy incondicional) | primer toque |
| `cardio.html` | migra `soundOn`/`preWarn` a la llave compartida | migra `bgMode` a la llave compartida | primer toque |
| `index.html`, `estadisticas.html` | no aplica | no aplica (no son pantallas de entrenamiento activo) | primer toque |

Las 8 páginas HTML de la app (`index.html`, `entrenamientos.html`, `gimnasio.html`, `rapido.html`, `correr.html`, `cardio.html`, `estadisticas.html`, `ajustes.html`) cargan `prefs.js`, llaman `Prefs.applyRainbowIfOn()` al cargar y `Prefs.maybeRequestFullscreen()` en su primer evento de click/touch. El aviso de sonido y mantener pantalla encendida solo aplican en las 5 páginas de entrenamiento activo (tabla arriba) — `index.html`, `estadisticas.html` y `ajustes.html` no tienen sesión que interrumpir.

## UI de `ajustes.html`

Página completa (no modal), mismo estilo visual que el resto (fondo oscuro, `Syne`/`Space Mono`, `--accent`), botón "‹" para volver a Inicio como en Estadísticas.

```
⚙️ Ajustes

SONIDO Y PANTALLA
[toggle] Aviso de siguiente ejercicio
         Beep + vibración 10s antes de que acabe el descanso
[toggle] Mantener pantalla encendida
         Evita que el celular se bloquee mientras entrenas
[toggle] Pantalla completa
         Oculta la barra del navegador — se re-activa sola al tocar

COLOR
🌈 Modo arcoíris: [toggle, solo si ya se descubrió]
🔒 Hay un modo de color secreto por descubrir en Inicio  [si no se ha descubierto]
```

Si el navegador no soporta Wake Lock o Fullscreen API, el toggle correspondiente se deshabilita visualmente (mismo tratamiento que ya usa `cardio.html` con `bgmode-row.disabled`) en vez de fallar en silencio.

## CSP

`prefs.js` es JS puro sin red — cae bajo `script-src 'self'`, ya permitido en las 8 páginas. `ajustes.html` no necesita ningún dominio nuevo. La API de Fullscreen no requiere entrada en CSP (no es un recurso de red).

## Testing

- `node --check` sobre `prefs.js` y sobre las 8 páginas modificadas.
- Assert-based check de la lógica pura de `prefs.js`: default true/false cuando la llave no existe, get/set redondo, `maybeRequestFullscreen` no revienta si `document.fullscreenElement`/`requestFullscreen` no existen en el entorno de prueba (sin DOM real).
- Regresión manual: en cada uno de los 3 toggles, prender/apagar y confirmar el comportamiento real en al menos 2 páginas distintas (ej. apagar sonido en Ajustes, confirmar que no suena ni en Gimnasio ni en Cardio). Confirmar que activar pantalla completa en una página, navegar a otra, y tocar cualquier botón la vuelve a activar sola. Confirmar que el modo arcoíris (si ya estaba desbloqueado de antes) ahora también cambia el color en Correr/Cardio/Gimnasio, no solo en Inicio.
