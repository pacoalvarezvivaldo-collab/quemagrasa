# Modo Gimnasio — diseño

**Fecha:** 2026-08-21
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

`entrenamientos.html` ("Modo Casa") ofrece un plan de 30 días con ejercicios de peso corporal, sacados del CDN `JahelCuadrado/ExerciseGymGifsDB` filtrado por `equipment/bodyweight.json`. El usuario quiere una contraparte para cuando sí tiene acceso a equipo de gimnasio (cable, máquinas, mancuernas, barra, banco, etc.) — un plan de 30 días equivalente pero con ejercicios que usan ese equipo, sacados de las demás categorías del mismo CDN.

## Alcance

**Ahora:**
- Extraer el motor genérico del plan de 30 días de `entrenamientos.html` a un archivo nuevo compartido, `plan-engine.js`.
- Refactorizar `entrenamientos.html` para que sea un shell delgado sobre `plan-engine.js`, sin cambiar su comportamiento observable (Casa sigue funcionando exactamente igual).
- Página nueva `gimnasio.html`, mismo shell/look que `entrenamientos.html`, usando `plan-engine.js` con los ejercicios del CDN combinando las 11 categorías de equipo que no son bodyweight.
- Tarjeta nueva "🏢 Gimnasio" en `index.html`.
- Progreso de Gimnasio independiente del de Casa (llaves de `localStorage` con prefijo distinto).

**Después (fuera de alcance, explícitamente pospuesto):**
- Sincronizar el progreso de Gimnasio con Supabase (`sync.js`) — Casa tampoco sincroniza su progreso de plan hoy salvo lo ya cableado en la Tarea 4 del proyecto de sync; extender esto a Gimnasio es una extensión simple sobre `user_state` pero no se hace en esta spec.
- Selector de "qué equipo tienes tú" — Gimnasio usa el pool completo de las 11 categorías sin filtrar por equipo disponible del usuario.
- Rutina tipo Push/Pull/Legs — se evaluó y se descartó; Gimnasio usa el mismo ciclo de 5 grupos musculares que Casa.
- Limpieza/denylist de ejercicios mal etiquetados dentro de las categorías de equipo (mismo tipo de issue que se fue encontrando y corrigiendo en Casa) — se corrige reactivamente si aparece, no hay pasada preventiva ahora.

## Arquitectura

**`plan-engine.js`** (nuevo, compartido) — motor genérico del plan de 30 días: fetch + agrupación de ejercicios por `bodyPart`, calendario de 30 días, selector de nivel (Fácil/Medio/Difícil/Espartano), pantalla de ejercicio dedicada, temporizador de descanso, easter egg espartano (días 21–30), y persistencia en `localStorage`. Se inicializa con un objeto de configuración:

```js
PlanEngine.init({
  equipmentUrls: [ /* 1 o más URLs del CDN de equipo */ ],
  keyPrefix: 'ent_' /* o 'gym_' */,
  title: 'Plan 30 días' /* o 'Gimnasio' */,
  icon: '🏋️' /* o '🏢' */
});
```

**`entrenamientos.html`** se refactoriza (no se reescribe desde cero): su HTML/CSS se mantiene, el bloque de JS que hoy contiene el motor se mueve a `plan-engine.js`, y la página pasa a llamar:

```js
PlanEngine.init({ equipmentUrls:['bodyweight.json'], keyPrefix:'ent_', title:'Plan 30 días', icon:'🏋️' });
```

Este refactor no debe cambiar ningún comportamiento observable de Casa — mismo calendario, mismos niveles, misma tabla de repeticiones, mismo easter egg, mismas llaves de `localStorage` (`ent_level`/`ent_completed`/`ent_current`, sin cambiar el prefijo existente para no perder el progreso ya guardado de usuarios actuales).

**`gimnasio.html`** (nuevo) — mismo shell que `entrenamientos.html`, mismo `plan-engine.js`, inicializado así:

```js
PlanEngine.init({
  equipmentUrls: [
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/band.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/barbell.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/cable.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/dumbbell.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/ez-bar.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/kettlebell.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/lever.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/machine.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/other.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/sled.json',
    'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/smith.json'
  ],
  keyPrefix: 'gym_',
  title: 'Gimnasio',
  icon: '🏢'
});
```

## Datos

Verificado contra el CDN en vivo: las 11 categorías de equipo usan la misma taxonomía de `bodyPart` que `bodyweight.json` (`legs`, `core`, `arms`, `shoulders`, `back`, `chest`, `cardio`) — el ciclo de 5 grupos de Casa (Piernas→Core→Brazos→Espalda→Pecho, `cardio` fuera del ciclo igual que en Casa) aplica sin adaptar nada. Población combinada por grupo: legs 170, core 52, arms 278, shoulders 137, back 119, chest 104. El grupo "Brazos" de Casa combina `arms`+`shoulders` (278+137=415); el más chico de los 5 grupos del ciclo es core con 52 — de sobra para sesiones de hasta 8 ejercicios.

`PlanEngine` hace `fetch` en paralelo de todas las URLs de `equipmentUrls` (`Promise.all`), junta los `exercises` de todas las respuestas en un solo arreglo, y de ahí agrupa por `bodyPart` — mismo patrón que hoy usa `ensurePool()` en Casa, generalizado a N URLs en vez de 1. Para Gimnasio esto son ~780 KB en 11 requests la primera vez que se usa esa página en la sesión; se cachea en memoria (no se vuelve a pedir hasta recargar la página) y el navegador cachea cada archivo del CDN por separado entre visitas.

## UI / Home screen

`index.html` gana una 6ª tarjeta "🏢 Gimnasio", mismo estilo que las 5 existentes (Casa, Elíptica, Caminadora, Escaladora, Ejercicio rápido), enlazando a `gimnasio.html`.

## Persistencia

Llaves de `localStorage` con prefijo `gym_` (`gym_level`, `gym_completed`, `gym_current`) — completamente independientes de las de Casa (`ent_level`/`ent_completed`/`ent_current`). El usuario puede tener progreso simultáneo y por separado en los dos planes.

## CSP

`gimnasio.html` usa las mismas directivas que `entrenamientos.html` hoy (`script-src 'self' 'unsafe-inline'`, `img-src`/`connect-src` abiertos a `https://cdn.jsdelivr.net`) — no se necesita ningún dominio nuevo, ya está permitido ese CDN.

## Testing

El refactor de `entrenamientos.html` es la parte de más riesgo por tocar código ya en producción:
- `node --check` sobre `plan-engine.js`, `entrenamientos.html` y `gimnasio.html`.
- Adaptar los checks de lógica pura ya existentes (rotación día→grupo, reparto de repeticiones por nivel/tercio del plan) para que corran contra la lógica ya extraída en `plan-engine.js`.
- Regresión manual completa de Casa después del refactor: nivel → calendario → ejercicio → descanso → easter egg espartano → sesión completa → recargar y confirmar que el progreso persiste — mismo comportamiento exacto que antes del refactor.
- Prueba manual de Gimnasio: mismo flujo completo end-to-end, confirmar que los GIFs de ejercicios con equipo cargan y que su progreso (`gym_*`) es independiente del de Casa (`ent_*`).
