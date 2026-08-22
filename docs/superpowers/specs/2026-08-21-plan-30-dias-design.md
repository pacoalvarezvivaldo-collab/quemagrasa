# Plan de 30 días — Entrenamientos en casa — diseño

## Contexto y motivo del redisign

La primera versión de "modo Casa" (integrada como una máquina más en `index.html`, junto a elíptica/caminadora/escaladora) se construyó, revisó, probó y desplegó — pero no era lo que el usuario quería: mezclaba un modo de peso corporal dentro del selector de máquinas de cardio, y no tenía la estructura de programa (calendario de 30 días, ejercicios con repeticiones, pantalla dedicada por ejercicio) que el usuario pedía desde el inicio, según referencias visuales de apps de entrenamiento (asesoramiento por video, catálogo de entrenamientos, plan de 30 días, "sin equipamiento en casa"). Esta spec reemplaza ese enfoque por una página nueva y separada.

**Lo que se mantiene de la v1** (no se reescribe): el timer de intervalos para elíptica/caminadora/escaladora en `index.html` sigue exactamente igual. Solo se le quita la entrada "Casa" del selector de "Equipo" — vuelve a ser Elíptica/Caminadora/Escaladora únicamente — y se le agrega un botón/link hacia la nueva página.

## Alcance

**Ahora:**
- Página nueva `entrenamientos.html`, mismo repo, mismo look (fondo oscuro, Syne/Space Mono, mismo acento), enlazada desde `index.html` y viceversa.
- Plan de 30 días con calendario (Día 1...Día 30, marcados ✓ al completarse).
- 4 niveles: Fácil, Medio, Difícil, Espartano — se elige una vez al empezar el plan (editable después).
- Pantalla de ejercicio dedicada: GIF, nombre, repeticiones, controles, lista de próximos ejercicios de la sesión.
- Descanso cronometrado entre ejercicios con aviso a los 10 segundos, anunciando el siguiente ejercicio.
- Easter egg oculto para nivel Espartano en los últimos 10 días del plan.

**Después (fuera de alcance, explícitamente pospuesto):**
- Sección de "correr" (running) — pedida por el usuario, se aborda en un ciclo aparte.
- Otros equipos propios del usuario (mancuernas, ligas, etc.) para el timer de `index.html`.
- Filtro de ejercicios "bodyweight" que en realidad piden equipo (ej. bicicleta estática) — issue de datos conocido, ver memoria del proyecto.

## Estructura de archivo y navegación

- `entrenamientos.html`: página nueva, independiente de `index.html` (JS/CSS propios, sin compartir estado en memoria — sólo pueden compartir el mismo `localStorage` del origin si se decide más adelante, pero por ahora usa sus propias llaves, ver más abajo).
- `index.html`: se elimina la entrada `casa` de `MACHINES` (revirtiendo a las 3 máquinas originales) y todo el código de modo Casa agregado en la v1 (data layer `CASA_*`, branches `m.bodyweight`, DOM oculto de GIF, CSP para jsDelivr si ya no se usa ahí). Se agrega un botón/enlace visible (ej. en la topbar) hacia `entrenamientos.html`.
- `entrenamientos.html` agrega su propio botón/enlace de regreso a `index.html`.

## Datos

Mismo endpoint CDN que la v1, pinneado a la misma versión:
```
https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/bodyweight.json
```
Se agrupa por `bodyPart` (valores observados: `legs`, `core`, `arms`, `cardio`, `shoulders`, `back`, `chest`) en vez de por `category`, para poder rotar grupo muscular día a día. CSP de `entrenamientos.html` abre `connect-src`/`img-src` a `https://cdn.jsdelivr.net`, igual que se hizo en `index.html` para la v1.

## Plan de 30 días

- Rotación de grupo muscular en ciclo fijo de 5 días, que se repite 6 veces a lo largo de los 30 días: **Piernas (`legs`) → Core (`core`) → Brazos (`arms`+`shoulders`) → Espalda (`back`) → Pecho (`chest`)**, y vuelve a Piernas. Los ejercicios etiquetados `bodyPart:cardio` no se usan como tema de día (no hay "día de cardio" en este plan — quedan disponibles para uso futuro, ej. calentamiento).
- Cada día = una sesión con N ejercicios del grupo muscular de ese día, N según el nivel elegido:

| Nivel | Ejercicios por sesión |
| --- | --- |
| Fácil | 2–4 |
| Medio | 4–6 |
| Difícil | 6–8 |
| Espartano | 6–8 (mismo conteo que Difícil, mayor intensidad vía repeticiones) |

- Repeticiones por ejercicio, según nivel y en qué tercio del plan está el día (bloques de 10 días):

| Nivel | Días 1–10 | Días 11–20 | Días 21–30 |
| --- | --- | --- | --- |
| Fácil | 8 | 10 | 12 |
| Medio | 10 | 12 | 15 |
| Difícil | 15 | 18 | 20 |
| Espartano | 20 | 30 | 40 |

- Calendario: lista de 30 días, cada uno marcado como completado/pendiente. Tocar un día abierto (no bloqueado — ver "fuera de alcance de esta duda": por ahora todos los días están siempre accesibles, no hay bloqueo secuencial salvo que el usuario pida lo contrario más adelante) lleva a la pantalla de ejercicio con la sesión de ese día.

## Pantalla de ejercicio

Por cada ejercicio de la sesión del día:
- GIF grande arriba (misma fuente CDN que v1).
- Nombre del ejercicio.
- Número de repeticiones objetivo ("x 12"), según la tabla de arriba.
- Controles: botón ✓ (marcar hecho → arranca el descanso y avanza), botón ⏮ (regresar al ejercicio anterior de la sesión), botón ⏸ (pausa).
- Debajo: lista de los ejercicios que siguen en la sesión de ese día (mismo patrón que el "Programa" del timer actual, pero sin badges numéricos — solo nombre y GIF miniatura opcional).

**Ritmo:** cada ejercicio es a ritmo propio del usuario (sin cronómetro de trabajo) — el usuario hace sus repeticiones y toca ✓ cuando termina.

**Descanso entre ejercicios:** al tocar ✓, arranca una cuenta regresiva de descanso de **30 segundos fijos** (mismo valor para los 4 niveles — la intensidad del plan ya varía por repeticiones, no hace falta variar también el descanso). Se recicla la lógica de aviso ya existente en `index.html` (aviso a los 10s antes de que termine el descanso, con beep/vibración) — pero en vez de anunciar "sprint", anuncia el nombre del siguiente ejercicio. Si el ✓ es del último ejercicio de la sesión, no hay descanso — se muestra la pantalla de "sesión completa" (marca el día ✓ en el calendario) directamente.

## Easter egg — nivel Espartano

Condición: `nivel === 'espartano'` **y** el día actual está en el rango 21–30.

Cada uno de esos días, antes de empezar la sesión (o al entrar a la pantalla de ejercicio del día), se muestra brevemente, en secuencia, sin botón ni indicación visible en el resto de la UI (easter egg real, no documentado para el usuario dentro de la app):
1. "Esparta, mi Esparta famosa por sus hombres, es mi patria." — 2 segundos.
2. "LISTO ESPARTANO" — 4 segundos.

Después continúa el flujo normal (pantalla del primer ejercicio del día).

## Persistencia

`localStorage`, llaves propias de `entrenamientos.html` (no comparte namespace con `qg_config`/`qg_history` del timer):
- Nivel elegido para el plan.
- Días completados (para el check ✓ del calendario y cálculo de racha, mismo espíritu que el timer actual).
- Día actual / último visto (para retomar donde se quedó).

## Fuera de alcance de esta spec

- Sección de "correr"
- Otros equipos propios para el timer de `index.html`.
- Bloqueo secuencial de días (obligar a completar el día N antes de abrir el N+1) — todos los días están accesibles desde el inicio, salvo que se pida lo contrario.
- Edición fina del pool de ejercicios (denylist de los que en realidad piden equipo) — issue conocido, no bloqueante.
