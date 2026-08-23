# Sync completo — diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

Hoy solo Casa (`entrenamientos.html`) y Correr (`correr.html`) sincronizan con Supabase. Gimnasio, "Tu progreso" (peso/IMC/meta) y la Racha son 100% locales por diseño explícito de sus specs anteriores, pospuesto a esta ronda. El usuario quiere que los 3 sincronicen también, para no perder nada al cambiar de dispositivo o borrar caché.

## Alcance

**Ahora:**
- Extender el esquema de Supabase (`user_state` + tabla nueva `weight_log`).
- Extender `sync.js` con las funciones nuevas necesarias (`pushWeightEntry`, `pullAndMergeWeightLog`, y `pullUserState()` devolviendo los campos nuevos).
- Enganchar `gimnasio.html` al mismo patrón de callbacks que ya usa Casa (`plan-engine.js` no se toca, solo su config).
- Enganchar `index.html` (Progreso + Racha) a `sync.js`, con `streak.js` ganando un método nuevo `mergeRemoteLog`.
- Sin botón ☁️ nuevo en Gimnasio ni en Progreso — si ya hay sesión iniciada desde Casa o Correr, sincronizan solos en segundo plano; sin sesión, se quedan 100% locales como hoy.

**Después (fuera de alcance, pospuesto explícitamente):**
- Botón ☁️ visible en Gimnasio/Progreso para iniciar sesión directo desde ahí — evaluado y descartado por el usuario, la sesión ya es global entre páginas del mismo origen.
- Cualquier UI de "conflicto de sync" (qué pasa si editas el mismo día en dos dispositivos offline) — se resuelve con la misma regla simple que ya usa `mergeHistory`: lo local gana si la clave (fecha) ya existe, lo remoto solo rellena huecos.
- Migrar `user_state.weight_kg` (columna legada, la usa hoy `correr.html` para el peso "actual" de una sola fila) — se queda como está, sin relación con la tabla nueva `weight_log`; no se retira ni se fusiona en esta spec.

## Esquema de Supabase (el usuario corre este SQL a mano en su proyecto, mismo procedimiento que la primera vez que se armó sync)

```sql
alter table user_state
  add column gym_level text,
  add column gym_current_day int,
  add column gym_completed_days int[],
  add column height_cm numeric,
  add column goal_weight_kg numeric,
  add column goal_date date,
  add column activity_log text[];

create table weight_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

alter table weight_log enable row level security;

create policy "own rows only" on weight_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`weight_log` sigue el mismo patrón que `run_history` (log completo, RLS por `user_id`). Las columnas nuevas de `user_state` siguen el mismo patrón que las ya existentes (`plan_level`/`plan_current_day`/`plan_completed_days`, ahora renombrados conceptualmente como "de Casa" con sus pares "de Gimnasio").

## `sync.js` — funciones nuevas y extendidas

```
pushWeightEntry(entry: {date, weightKg}) -> void
  — análogo a pushRun: inserta una fila en weight_log si hay sesión.

pullAndMergeWeightLog(localLog: [{date,weightKg}]) -> [{date,weightKg}]
  — análogo a pullAndMergeHistory: trae las filas remotas, mezcla por fecha
    (si la fecha ya existe local, se queda el valor local; si no existe,
    se agrega la del remoto), sube al remoto las entradas locales que
    falten allá, y devuelve el log mezclado.

pushUserState(partial) — sin cambios de firma, ya acepta cualquier objeto
  parcial; ahora también se le pueden mandar gym_level/gym_current_day/
  gym_completed_days/height_cm/goal_weight_kg/goal_date/activity_log.

pullUserState() -> {
  weightKg, level, currentDay, completedDays,           // ya existían (Casa)
  gymLevel, gymCurrentDay, gymCompletedDays,             // nuevo (Gimnasio)
  heightCm, goalWeightKg, goalDate,                      // nuevo (Progreso)
  activityLog                                            // nuevo (Racha)
} | null
```

La lógica pura de merge (`entryKey`/`rowKey`/`mergeHistory`) se generaliza o se duplica para `weight_log` con el mismo criterio (clave = fecha en vez de `date|mode|distanceM`) — decisión de implementación, no cambia el comportamiento observable.

## `gimnasio.html`

Gana los mismos 4 callbacks que `entrenamientos.html` ya pasa a `PlanEngine.init()`:

```js
PlanEngine.init({
  equipmentUrls: [...],   // sin cambios
  keyPrefix: 'gym_',      // sin cambios
  onSaveLevel: level => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_level: level }); },
  onSaveCompleted: days => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_completed_days: days }); },
  onSaveCurrentDay: day => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_current_day: day }); },
  pullRemoteState: async () => (window.QuemaSync && QuemaSync.isSignedIn())
    ? { level: (await QuemaSync.pullUserState())?.gymLevel, ... }  // mapea los campos gym_* a level/currentDay/completedDays
    : null
});
```

`gimnasio.html` **no** carga ningún botón de sync ni llama a `QuemaSync.init()` — solo usa `QuemaSync` si ya existe `window.QuemaSync` con sesión activa (cargada en otra pestaña/página previamente logueada, persistida por el propio cliente de Supabase vía `localStorage` del navegador). Para que esto funcione, `gimnasio.html` debe cargar `sync.js` (aunque no muestre botón), igual que ya carga `streak.js`/`plan-engine.js` sin mostrar UI para todos ellos.

## `index.html` (Progreso + Racha)

`weight-log.js` y `streak.js` se quedan agnósticos de Supabase (constraint ya existente, no se toca). El propio `<script>` inline de `index.html` es quien orquesta:

- **Al cargar**, si `window.QuemaSync && QuemaSync.isSignedIn()`: pull de `QuemaSync.pullUserState()` (para `heightCm`/`goalWeightKg`/`goalDate`/`activityLog`) y de `QuemaSync.pullAndMergeWeightLog(WeightLog.getLog())` (para la bitácora completa), y aplica los resultados vía la API pública ya existente de `WeightLog` (`saveHeightCm`, `saveGoal`) más el `mergeRemoteLog` nuevo de `Streak`.
- **Al guardar** (cualquier `saveHeightEntry`/`saveGoalEntry`/`saveTodayEntry`/`saveFirstEntry` que ya existen en `index.html`, y `recordActivity` de `Streak`): además de la llamada local ya existente, si hay sesión, empuja el cambio correspondiente (`QuemaSync.pushUserState({height_cm})`, `pushUserState({goal_weight_kg, goal_date})`, `pushWeightEntry({date, weightKg})`, `pushUserState({activity_log})`).

`streak.js` gana:
```
mergeRemoteLog(remoteDates: string[]) -> string[]
  — une el log local con las fechas remotas (unión de sets, sin duplicar),
    persiste el resultado en localStorage, y lo devuelve.
```

`index.html` carga `sync.js` (ya lo hace `correr.html`, `entrenamientos.html`; ahora también `index.html` y `gimnasio.html`), sin botón visible ni llamada a `QuemaSync.init()` en ninguna de las dos — solo consumen la sesión si ya existe.

## CSP

`index.html` y `gimnasio.html` necesitan agregar `https://esm.sh` a `script-src` y `https://*.supabase.co` a `connect-src` — mismo cambio de CSP que ya se hizo para `entrenamientos.html`/`correr.html` cuando se armó el sync original.

## Testing

- `node --check` sobre `sync.js`, `gimnasio.html`, `index.html`.
- Assert-based check de la lógica pura de merge de `weight_log` (mismo patrón que `mergeHistory`: fecha ya local gana, fecha solo remota se agrega, sube lo que falte).
- Regresión manual: con una cuenta de prueba, completar un día de Gimnasio en un "dispositivo" (pestaña/perfil), confirmar que aparece en Supabase (tabla `user_state`, columnas `gym_*`), y que otra sesión logueada con la misma cuenta lo ve al cargar `gimnasio.html`. Igual para peso/estatura/meta (tabla `weight_log` + columnas `height_cm`/`goal_*` de `user_state`) y para la racha (`activity_log`).
- Confirmar que sin sesión iniciada, Gimnasio/Progreso/Racha siguen funcionando exactamente igual que hoy (100% local, sin llamadas de red) — mismo criterio de "no llamar a red sin sesión" que ya rige `sync.js` completo.
