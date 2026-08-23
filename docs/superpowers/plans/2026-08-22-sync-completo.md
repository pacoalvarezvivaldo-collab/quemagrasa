# Sync completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar con Supabase lo que hoy es 100% local — progreso de Gimnasio, bitácora/estatura/meta de "Tu progreso", y la racha — reusando el mismo cliente/sesión de `sync.js` que ya usan Casa y Correr, sin agregar ningún botón de inicio de sesión nuevo.

**Architecture:** `sync.js` gana funciones nuevas siguiendo el mismo patrón que ya usa para `run_history`/`user_state` (push individual + pull-y-merge por clave, local gana en conflicto). `weight-log.js` y `streak.js` ganan cada uno un método `mergeRemoteLog` para poder aplicar lo que `sync.js` trae del servidor sin que `sync.js` toque `localStorage` directamente ni que esos dos archivos aprendan nada de Supabase (siguen sin referenciar `QuemaSync`). `gimnasio.html` e `index.html` son quienes orquestan: llaman a `QuemaSync` y a la API pública de `PlanEngine`/`WeightLog`/`Streak`, sin sesión propia ni botón — si ya hay sesión iniciada (desde Casa o Correr, persistida por el cliente de Supabase entre pestañas del mismo origen), sincronizan solas; si no, siguen 100% locales exactamente como hoy.

**Simplificación de diseño respecto a la spec, decidida en este plan:** la racha se sincroniza **solo desde `index.html`** (pull + merge + push del log completo cuando se carga la pantalla de inicio), no en cada llamada a `Streak.recordActivity()` de los 5 modos. Enganchar las 5 páginas de entrenamiento individualmente sería mucho más invasivo (2 de ellas, `rapido.html` y `cardio.html`, ni siquiera cargan `sync.js` hoy) para un beneficio marginal — el usuario de todos modos visita `index.html` regularmente al elegir qué entrenar, que es cuando la sincronización realmente importa (ver otro dispositivo al abrir la app). El resultado observable (la racha se sincroniza entre dispositivos) es el mismo que pedía la spec.

**Tech Stack:** HTML/JS puro (sin build), cliente de Supabase ya cargado vía `esm.sh` en `sync.js`, Node.js solo para verificación (`node --check`, scripts de assert).

## Global Constraints

- `weight-log.js` y `streak.js` no deben referenciar `QuemaSync`/`sync.js` en ningún momento — la orquestación de red vive en las páginas HTML que los consumen, nunca en estos dos archivos (constraint ya existente, reafirmada aquí).
- Sin botón ☁️ nuevo en `gimnasio.html` ni en `index.html` — ninguna de las dos llama a `QuemaSync.init()`. Solo usan `QuemaSync` si ya existe con sesión activa.
- Merge por fecha: si una fecha ya existe localmente (en `qg_weight_log` o `qg_activity_log`), el valor local gana y NO se vuelve a subir esa fecha al servidor aunque el valor remoto sea distinto — mismo criterio exacto que ya usa `mergeHistory` para `run_history` en este mismo archivo.
- `pullUserState()` mantiene retrocompatibilidad total: los campos que ya devolvía (`weightKg`, `level`, `currentDay`, `completedDays`) no cambian de nombre ni de forma — solo se agregan campos nuevos al mismo objeto.
- Sin sincronizar `user_state.weight_kg` (columna legada de `correr.html`) con la tabla nueva `weight_log` — son cosas separadas, no se tocan entre sí en esta ronda (ver spec).
- Spec completo: `docs/superpowers/specs/2026-08-22-sync-completo-design.md`.

---

### Task 1: Extender `sync.js` — bitácora de peso + `user_state` ampliado

**Files:**
- Modify: `sync.js`

**Interfaces:**
- Produce (usado por Task 4): `QuemaSync.pushWeightEntry({date, weightKg}) -> void`, `QuemaSync.pullAndMergeWeightLog(localLog) -> mergedLog`, `QuemaSync.pullUserState()` ahora también devuelve `{gymLevel, gymCurrentDay, gymCompletedDays, heightCm, goalWeightKg, goalDate, activityLog}` junto a los campos que ya tenía.

- [ ] **Step 1: Agregar la lógica pura de merge de `weight_log`**

Ubicar en `sync.js`:
```javascript
function mergeHistory(localHistory, remoteRows){
  const seen = new Set(localHistory.map(entryKey));
  const merged = localHistory.slice();
  remoteRows.forEach(row=>{
    const k = rowKey(row);
    if(!seen.has(k)){ seen.add(k); merged.push(rowToEntry(row)); }
  });
  const remoteKeys = new Set(remoteRows.map(rowKey));
  const toUpload = localHistory.filter(e => !remoteKeys.has(entryKey(e)));
  merged.sort((a,b)=>a.date-b.date);
  return { merged, toUpload };
}
/* ---------- fin lógica pura ---------- */
```
reemplazar por:
```javascript
function mergeHistory(localHistory, remoteRows){
  const seen = new Set(localHistory.map(entryKey));
  const merged = localHistory.slice();
  remoteRows.forEach(row=>{
    const k = rowKey(row);
    if(!seen.has(k)){ seen.add(k); merged.push(rowToEntry(row)); }
  });
  const remoteKeys = new Set(remoteRows.map(rowKey));
  const toUpload = localHistory.filter(e => !remoteKeys.has(entryKey(e)));
  merged.sort((a,b)=>a.date-b.date);
  return { merged, toUpload };
}

function weightEntryKey(e){ return e.date; }
function weightRowKey(row){ return row.date; }
function rowToWeightEntry(row){ return { date: row.date, weightKg: row.weight_kg }; }
function mergeWeightLog(localLog, remoteRows){
  const seen = new Set(localLog.map(weightEntryKey));
  const merged = localLog.slice();
  remoteRows.forEach(row=>{
    const k = weightRowKey(row);
    if(!seen.has(k)){ seen.add(k); merged.push(rowToWeightEntry(row)); }
  });
  const remoteKeys = new Set(remoteRows.map(weightRowKey));
  const toUpload = localLog.filter(e => !remoteKeys.has(weightEntryKey(e)));
  merged.sort((a,b)=> a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));
  return { merged, toUpload };
}
/* ---------- fin lógica pura ---------- */
```

- [ ] **Step 2: Agregar `pushWeightEntry` y `pullAndMergeWeightLog`**

Ubicar:
```javascript
/* ---------- user_state ---------- */
async function pushUserState(partial){
```
reemplazar por:
```javascript
/* ---------- weight_log ---------- */
async function pushWeightEntry(entry){
  if(!session) return;
  const sb = await getClient();
  if(!sb) return;
  try{
    await sb.from('weight_log').insert({ user_id: session.user.id, date: entry.date, weight_kg: entry.weightKg });
  }catch(e){ /* offline: el dato ya quedó guardado en local, se reintenta en el próximo push */ }
}

async function pullAndMergeWeightLog(localLog){
  if(!session) return localLog;
  const sb = await getClient();
  if(!sb) return localLog;
  try{
    const { data, error } = await sb.from('weight_log').select('*').eq('user_id', session.user.id);
    if(error || !data) return localLog;
    const { merged, toUpload } = mergeWeightLog(localLog, data);
    await Promise.all(toUpload.map(pushWeightEntry));
    return merged;
  }catch(e){ return localLog; }
}

/* ---------- user_state ---------- */
async function pushUserState(partial){
```

- [ ] **Step 3: Extender `pullUserState()` con los campos nuevos**

Ubicar:
```javascript
async function pullUserState(){
  if(!session) return null;
  const sb = await getClient();
  if(!sb) return null;
  try{
    const { data, error } = await sb.from('user_state').select('*').eq('user_id', session.user.id).maybeSingle();
    if(error || !data) return null;
    return { weightKg:data.weight_kg, level:data.plan_level, currentDay:data.plan_current_day,
      completedDays:data.plan_completed_days || [] };
  }catch(e){ return null; }
}

window.QuemaSync = { init, isSignedIn, pushRun, pullAndMergeHistory, pushUserState, pullUserState };
```
reemplazar por:
```javascript
async function pullUserState(){
  if(!session) return null;
  const sb = await getClient();
  if(!sb) return null;
  try{
    const { data, error } = await sb.from('user_state').select('*').eq('user_id', session.user.id).maybeSingle();
    if(error || !data) return null;
    return {
      weightKg:data.weight_kg, level:data.plan_level, currentDay:data.plan_current_day,
      completedDays:data.plan_completed_days || [],
      gymLevel:data.gym_level, gymCurrentDay:data.gym_current_day, gymCompletedDays:data.gym_completed_days || [],
      heightCm:data.height_cm, goalWeightKg:data.goal_weight_kg, goalDate:data.goal_date,
      activityLog:data.activity_log || []
    };
  }catch(e){ return null; }
}

window.QuemaSync = { init, isSignedIn, pushRun, pullAndMergeHistory, pushUserState, pullUserState, pushWeightEntry, pullAndMergeWeightLog };
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node --check sync.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 5: Assert-based check de `mergeWeightLog`**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('sync.js','utf8');
const start=src.indexOf('/* ---------- lógica pura');
const end=src.indexOf('/* ---------- fin lógica pura ---------- */');
const pureCode=src.slice(start,end);
const test=pureCode+\`
// vacíos
const r1 = mergeWeightLog([], []);
console.assert(r1.merged.length===0 && r1.toUpload.length===0, 'vacío+vacío debe dar todo vacío');

// solo local: debe subirse
const r2 = mergeWeightLog([{date:'2026-08-20',weightKg:80}], []);
console.assert(r2.merged.length===1 && r2.toUpload.length===1, 'entrada solo local debe quedar en merged y en toUpload');

// solo remoto: se agrega, no hay que subir nada
const r3 = mergeWeightLog([], [{date:'2026-08-21',weight_kg:78}]);
console.assert(r3.merged.length===1 && r3.merged[0].weightKg===78 && r3.toUpload.length===0, 'entrada solo remota debe agregarse sin subir nada, dio '+JSON.stringify(r3));

// misma fecha en ambos con valores distintos: gana lo local, no se re-sube
const r4 = mergeWeightLog([{date:'2026-08-20',weightKg:80}], [{date:'2026-08-20',weight_kg:79}]);
console.assert(r4.merged.length===1 && r4.merged[0].weightKg===80 && r4.toUpload.length===0, 'conflicto de misma fecha debe ganar lo local sin re-subir, dio '+JSON.stringify(r4));

// mezcla ordenada
const r5 = mergeWeightLog(
  [{date:'2026-08-20',weightKg:80}],
  [{date:'2026-08-20',weight_kg:79},{date:'2026-08-21',weight_kg:78}]
);
console.assert(r5.merged.length===2 && r5.merged[0].date==='2026-08-20' && r5.merged[1].date==='2026-08-21', 'debe quedar ordenado por fecha, dio '+JSON.stringify(r5.merged));

console.log('OK sync weight_log pure logic');
\`;
fs.writeFileSync('.sync-check.js', test);
"
node .sync-check.js
rm -f .sync-check.js
```
Expected output: `OK sync weight_log pure logic` y ninguna línea `Assertion failed`.

- [ ] **Step 6: Commit**

```bash
git add sync.js
git commit -m "feat(sync): add weight_log push/pull-merge and extend pullUserState with gym/height/goal/activity fields"
```

---

### Task 2: `weight-log.js` y `streak.js` — método `mergeRemoteLog`

**Files:**
- Modify: `weight-log.js`
- Modify: `streak.js`

**Interfaces:**
- Produce (usado por Task 4): `WeightLog.mergeRemoteLog(entries: [{date,weightKg}]) -> newLog`, `Streak.mergeRemoteLog(remoteDates: string[]) -> newLog`.

- [ ] **Step 1: `WeightLog.mergeRemoteLog` en `weight-log.js`**

Ubicar:
```javascript
function getCurrentStreak(){
```
Este bloque no existe en `weight-log.js` — es de `streak.js`. En `weight-log.js`, ubicar en su lugar:
```javascript
function clearGoal(){ try{ localStorage.removeItem(KEY_GOAL_W); localStorage.removeItem(KEY_GOAL_D); }catch(e){} }

window.WeightLog = {
  todayStr, upsertEntry, latestEntry, bmiValue, bmiBand, daysBetween, theoreticalWeightAt,
  weightChangeSummary, progressStatus,
  getLog, saveTodayWeight, getLatestWeight, getHeightCm, saveHeightCm, getGoal, saveGoal, clearGoal
};
```
reemplazar por:
```javascript
function clearGoal(){ try{ localStorage.removeItem(KEY_GOAL_W); localStorage.removeItem(KEY_GOAL_D); }catch(e){} }

function mergeRemoteLog(remoteEntries){
  let log = getLog();
  remoteEntries.forEach(e => { log = upsertEntry(log, e.date, e.weightKg); });
  saveLog(log);
  return log;
}

window.WeightLog = {
  todayStr, upsertEntry, latestEntry, bmiValue, bmiBand, daysBetween, theoreticalWeightAt,
  weightChangeSummary, progressStatus,
  getLog, saveTodayWeight, getLatestWeight, getHeightCm, saveHeightCm, getGoal, saveGoal, clearGoal,
  mergeRemoteLog
};
```

- [ ] **Step 2: `Streak.mergeRemoteLog` en `streak.js`**

Ubicar:
```javascript
function getCurrentStreak(){
  return computeCurrentStreak(getLog(), todayStr());
}

window.Streak = { todayStr, computeCurrentStreak, recordActivity, getLog, getCurrentStreak };
})();
```
reemplazar por:
```javascript
function getCurrentStreak(){
  return computeCurrentStreak(getLog(), todayStr());
}

function mergeRemoteLog(remoteDates){
  const merged = [...new Set([...getLog(), ...remoteDates])].sort();
  saveLog(merged);
  return merged;
}

window.Streak = { todayStr, computeCurrentStreak, recordActivity, getLog, getCurrentStreak, mergeRemoteLog };
})();
```

- [ ] **Step 3: Verificar sintaxis**

```bash
node --check weight-log.js
node --check streak.js
```
Expected: sin salida en ambos (exit code 0).

- [ ] **Step 4: Prueba rápida de humo (sin red/DOM) de ambos `mergeRemoteLog`**

```bash
node -e "
global.localStorage = (function(){ const store={}; return {
  getItem:k=>store[k]!==undefined?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}
};})();
global.window = {};
require('./weight-log.js');
const wl = window.WeightLog;
wl.saveTodayWeight ? null : null; // noop, solo confirma que cargó
const merged = wl.mergeRemoteLog([{date:'2026-08-01',weightKg:90},{date:'2026-08-02',weightKg:89}]);
console.assert(merged.length===2, 'WeightLog.mergeRemoteLog debe agregar 2 entradas nuevas, dio '+merged.length);
console.log('OK WeightLog.mergeRemoteLog');
"
node -e "
global.localStorage = (function(){ const store={}; return {
  getItem:k=>store[k]!==undefined?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}
};})();
global.window = {};
require('./streak.js');
const merged = window.Streak.mergeRemoteLog(['2026-08-01','2026-08-02','2026-08-01']);
console.assert(merged.length===2, 'Streak.mergeRemoteLog debe deduplicar y dar 2 fechas únicas, dio '+merged.length);
console.log('OK Streak.mergeRemoteLog');
"
```
Expected: `OK WeightLog.mergeRemoteLog` y `OK Streak.mergeRemoteLog`, sin errores. (Nota: `weight-log.js`/`streak.js` no exportan vía `module.exports`, pero como son scripts clásicos que asignan a `window`, `require(...)` los ejecuta igual en Node siempre que `global.window` exista antes — es un chequeo de humo adicional, no reemplaza el `node --check`.)

- [ ] **Step 5: Commit**

```bash
git add weight-log.js streak.js
git commit -m "feat(sync): add mergeRemoteLog to WeightLog and Streak for pull-merge from Supabase"
```

---

### Task 3: Enganchar `gimnasio.html`

**Files:**
- Modify: `gimnasio.html`

**Interfaces:**
- Consumes: `window.QuemaSync.{pushUserState, pullUserState, isSignedIn}` de Task 1.

- [ ] **Step 1: CSP — permitir `esm.sh` y `*.supabase.co`**

Ubicar (línea 11):
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```
reemplazar por:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://esm.sh; img-src 'self' data: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

- [ ] **Step 2: Cargar `sync.js` y agregar los 4 callbacks al `PlanEngine.init()`**

Ubicar:
```html
<script src="streak.js"></script>
<script src="plan-engine.js"></script>
<script>
/* Gimnasio: sin filtro de equipo (todo el pool requiere equipo, ese es el punto),
   sin chairTip, sin sync — progreso 100% local con prefijo gym_. */
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
  keyPrefix: 'gym_'
});
</script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="plan-engine.js"></script>
<script>
/* Gimnasio: sin filtro de equipo (todo el pool requiere equipo, ese es el punto),
   sin chairTip. Progreso local con prefijo gym_, sincronizado si ya hay sesión
   iniciada desde Casa o Correr — sin botón propio de inicio de sesión aquí. */
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
  onSaveLevel: level => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_level: level }); },
  onSaveCompleted: days => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_completed_days: days }); },
  onSaveCurrentDay: day => { if(window.QuemaSync) QuemaSync.pushUserState({ gym_current_day: day }); },
  pullRemoteState: async () => {
    if(!(window.QuemaSync && QuemaSync.isSignedIn())) return null;
    const remote = await QuemaSync.pullUserState();
    if(!remote) return null;
    return { level: remote.gymLevel, currentDay: remote.gymCurrentDay, completedDays: remote.gymCompletedDays };
  }
});
</script>
```

- [ ] **Step 3: Verificar sintaxis**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('gimnasio.html','utf8');
const body=src.slice(src.lastIndexOf('<script>')+8, src.lastIndexOf('</script>'));
fs.writeFileSync('.syntax-check.js', body);
"
node --check .syntax-check.js
rm -f .syntax-check.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add gimnasio.html
git commit -m "feat(sync): wire gimnasio.html to sync.js — no new sign-in button, syncs if already signed in"
```

---

### Task 4: Enganchar `index.html` (Progreso + Racha)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.QuemaSync.{pushWeightEntry, pullAndMergeWeightLog, pushUserState, pullUserState, isSignedIn}` de Task 1; `WeightLog.mergeRemoteLog` y `Streak.mergeRemoteLog` de Task 2.

- [ ] **Step 1: CSP**

Ubicar:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```
reemplazar por:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://esm.sh; img-src 'self' data:; media-src 'self' data:; connect-src https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

- [ ] **Step 2: Cargar `sync.js`**

Ubicar:
```html
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script>
```

- [ ] **Step 3: Push en `saveFirstEntry`**

Ubicar:
```javascript
function saveFirstEntry(){
  const w = parseFloat(document.getElementById('progress-first-weight').value);
  const h = parseFloat(document.getElementById('progress-first-height').value);
  if(isNaN(w) || w<30 || w>300 || isNaN(h) || h<100 || h>250){
    alert('Ingresa un peso (30-300 kg) y estatura (100-250 cm) válidos.');
    return;
  }
  WeightLog.saveTodayWeight(w);
  WeightLog.saveHeightCm(h);
  renderProgress();
}
```
reemplazar por:
```javascript
function saveFirstEntry(){
  const w = parseFloat(document.getElementById('progress-first-weight').value);
  const h = parseFloat(document.getElementById('progress-first-height').value);
  if(isNaN(w) || w<30 || w>300 || isNaN(h) || h<100 || h>250){
    alert('Ingresa un peso (30-300 kg) y estatura (100-250 cm) válidos.');
    return;
  }
  WeightLog.saveTodayWeight(w);
  WeightLog.saveHeightCm(h);
  if(window.QuemaSync){
    QuemaSync.pushWeightEntry({ date: WeightLog.todayStr(), weightKg: w });
    QuemaSync.pushUserState({ height_cm: h });
  }
  renderProgress();
}
```

- [ ] **Step 4: Push en `saveTodayEntry`**

Ubicar:
```javascript
function saveTodayEntry(){
  const w = parseFloat(document.getElementById('progress-today-weight').value);
  if(isNaN(w) || w<30 || w>300){
    alert('Ingresa un peso válido (30-300 kg).');
    return;
  }
  WeightLog.saveTodayWeight(w);
  renderProgress();
}
```
reemplazar por:
```javascript
function saveTodayEntry(){
  const w = parseFloat(document.getElementById('progress-today-weight').value);
  if(isNaN(w) || w<30 || w>300){
    alert('Ingresa un peso válido (30-300 kg).');
    return;
  }
  WeightLog.saveTodayWeight(w);
  if(window.QuemaSync) QuemaSync.pushWeightEntry({ date: WeightLog.todayStr(), weightKg: w });
  renderProgress();
}
```

- [ ] **Step 5: Push en `saveHeightEntry`**

Ubicar:
```javascript
function saveHeightEntry(){
  const h = parseFloat(document.getElementById('progress-height-input').value);
  if(isNaN(h) || h<100 || h>250){
    alert('Ingresa una estatura válida (100-250 cm).');
    return;
  }
  WeightLog.saveHeightCm(h);
  document.getElementById('progress-height-form').style.display = 'none';
  renderProgress();
}
```
reemplazar por:
```javascript
function saveHeightEntry(){
  const h = parseFloat(document.getElementById('progress-height-input').value);
  if(isNaN(h) || h<100 || h>250){
    alert('Ingresa una estatura válida (100-250 cm).');
    return;
  }
  WeightLog.saveHeightCm(h);
  if(window.QuemaSync) QuemaSync.pushUserState({ height_cm: h });
  document.getElementById('progress-height-form').style.display = 'none';
  renderProgress();
}
```

- [ ] **Step 6: Push en `saveGoalEntry` y `removeGoalEntry`**

Ubicar:
```javascript
function saveGoalEntry(){
  const w = parseFloat(document.getElementById('progress-goal-weight').value);
  const d = document.getElementById('progress-goal-date').value;
  if(isNaN(w) || w<30 || w>300 || !d || d <= WeightLog.todayStr()){
    alert('Ingresa un peso meta (30-300 kg) y una fecha futura válidos.');
    return;
  }
  WeightLog.saveGoal(w, d);
  document.getElementById('progress-goal-form').style.display = 'none';
  renderProgress();
}

function removeGoalEntry(){
  WeightLog.clearGoal();
  document.getElementById('progress-goal-form').style.display = 'none';
  renderProgress();
}
```
reemplazar por:
```javascript
function saveGoalEntry(){
  const w = parseFloat(document.getElementById('progress-goal-weight').value);
  const d = document.getElementById('progress-goal-date').value;
  if(isNaN(w) || w<30 || w>300 || !d || d <= WeightLog.todayStr()){
    alert('Ingresa un peso meta (30-300 kg) y una fecha futura válidos.');
    return;
  }
  WeightLog.saveGoal(w, d);
  if(window.QuemaSync) QuemaSync.pushUserState({ goal_weight_kg: w, goal_date: d });
  document.getElementById('progress-goal-form').style.display = 'none';
  renderProgress();
}

function removeGoalEntry(){
  WeightLog.clearGoal();
  if(window.QuemaSync) QuemaSync.pushUserState({ goal_weight_kg: null, goal_date: null });
  document.getElementById('progress-goal-form').style.display = 'none';
  renderProgress();
}
```

- [ ] **Step 7: Agregar `syncPullOnLoad()` y llamarla al final del arranque**

Ubicar:
```javascript
try{ renderStreak(); }catch(e){}

/* easter egg: 7 taps al 🔥 en menos de 3s */
```
reemplazar por:
```javascript
try{ renderStreak(); }catch(e){}

/* al cargar, si ya hay sesión de sync activa (iniciada desde Casa o Correr), trae lo del
   servidor y lo fusiona con lo local — sin sesión, esto no hace ninguna llamada de red. */
async function syncPullOnLoad(){
  if(!(window.QuemaSync && QuemaSync.isSignedIn())) return;
  const remote = await QuemaSync.pullUserState();
  if(remote){
    if(remote.heightCm != null) WeightLog.saveHeightCm(remote.heightCm);
    if(remote.goalWeightKg != null && remote.goalDate) WeightLog.saveGoal(remote.goalWeightKg, remote.goalDate);
    else WeightLog.clearGoal(); // el remoto es la fuente de verdad de la meta: si allá ya no hay meta, se limpia aquí también
    if(remote.activityLog && remote.activityLog.length) Streak.mergeRemoteLog(remote.activityLog);
  }
  const mergedWeightLog = await QuemaSync.pullAndMergeWeightLog(WeightLog.getLog());
  WeightLog.mergeRemoteLog(mergedWeightLog);
  await QuemaSync.pushUserState({ activity_log: Streak.getLog() });
  renderProgress();
  renderStreak();
}
if(window.QuemaSync) syncPullOnLoad().catch(()=>{});

/* easter egg: 7 taps al 🔥 en menos de 3s */
```

- [ ] **Step 8: Verificar sintaxis**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('index.html','utf8');
const body=src.slice(src.lastIndexOf('<script>')+8, src.lastIndexOf('</script>'));
fs.writeFileSync('.syntax-check.js', body);
"
node --check .syntax-check.js
rm -f .syntax-check.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(sync): wire index.html (Progreso + Racha) to sync.js — pull+merge on load, push on every save"
```

---

### Task 5: Esquema de Supabase — el usuario lo corre a mano

**Files:**
- Modify: `supabase-schema.sql` (documentación del esquema completo, se mantiene al día como referencia)

**Nota:** este paso requiere que el usuario entre a su proyecto de Supabase (SQL Editor) y corra el SQL — no es algo que se pueda hacer desde el repo. Es la misma mecánica que ya se siguió la primera vez que se armó `sync.js`.

- [ ] **Step 1: Actualizar `supabase-schema.sql` con las columnas y tabla nuevas**

Ubicar:
```sql
-- Peso corporal + progreso del plan: una sola fila por usuario, se sobreescribe
create table user_state (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  weight_kg numeric,
  plan_level text,
  plan_current_day int,
  plan_completed_days int[],
  updated_at timestamptz not null default now()
);

alter table run_history enable row level security;
alter table user_state enable row level security;

create policy "own rows only" on run_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own row only" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
reemplazar por:
```sql
-- Peso corporal + progreso del plan: una sola fila por usuario, se sobreescribe
create table user_state (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  weight_kg numeric,
  plan_level text,
  plan_current_day int,
  plan_completed_days int[],
  gym_level text,
  gym_current_day int,
  gym_completed_days int[],
  height_cm numeric,
  goal_weight_kg numeric,
  goal_date date,
  activity_log text[],
  updated_at timestamptz not null default now()
);

-- Bitácora de peso completa (una fila por registro/fecha), separada del
-- valor único user_state.weight_kg que ya usa correr.html
create table weight_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

alter table run_history enable row level security;
alter table user_state enable row level security;
alter table weight_log enable row level security;

create policy "own rows only" on run_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own row only" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on weight_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Commit del archivo de referencia**

```bash
git add supabase-schema.sql
git commit -m "docs(sync): update supabase-schema.sql with gym/height/goal/activity columns and weight_log table"
```

- [ ] **Step 3: Correr el SQL nuevo en el proyecto real (acción del usuario, fuera del repo)**

El usuario debe:
1. Entrar al SQL Editor de su proyecto de Supabase (el mismo project URL/anon key ya usados en `sync.js`).
2. Correr únicamente las sentencias `alter table user_state add column ...` y `create table weight_log (...)` con su RLS/policy — **no** correr de nuevo las sentencias `create table user_state`/`create table run_history` originales, esas ya existen.
3. Confirmar que no hay errores (ej. columna ya existente si se corrió dos veces — en ese caso usar `add column if not exists`).

No se puede continuar a la verificación en vivo del Task 6 sin este paso.

---

### Task 6: Verificación end-to-end y push

**Files:** ninguno (solo verificación manual + push).

- [ ] **Step 1: Verificación estática/local sin sesión (no requiere el SQL del Task 5 todavía)**

Sirve el sitio localmente y, sin haber iniciado sesión nunca:
1. Confirma que `gimnasio.html` e `index.html` funcionan exactamente igual que antes de este plan — mismo comportamiento 100% local, sin ningún error de consola relacionado a `QuemaSync`/Supabase (las llamadas deben no-opear silenciosamente porque `isSignedIn()` es `false`).
2. Confirma que ninguna de las dos páginas dispara ninguna petición de red hacia `*.supabase.co` (pestaña Network de devtools) mientras no haya sesión.

- [ ] **Step 2: Verificación en vivo con sesión real (requiere que el Task 5 ya esté corrido en Supabase)**

Con una cuenta de prueba (magic link, iniciada desde `entrenamientos.html` o `correr.html` como ya funciona hoy):
1. En `gimnasio.html`, completa un día del plan — confirma en el dashboard de Supabase (tabla `user_state`) que `gym_level`/`gym_completed_days`/`gym_current_day` se actualizan.
2. Abre `gimnasio.html` en otra sesión logueada con la misma cuenta (otra pestaña/perfil) — confirma que ve el mismo progreso de Gimnasio al cargar.
3. En `index.html`, registra peso+estatura, pon una meta — confirma en Supabase que aparecen filas en `weight_log` y que `user_state.height_cm`/`goal_weight_kg`/`goal_date` se llenan.
4. Recarga `index.html` (o ábrelo en otra sesión con la misma cuenta) — confirma que la bitácora, estatura, meta y racha se ven igual, jaladas del servidor.
5. Confirma que `entrenamientos.html` y `correr.html` (Casa/Correr, ya sincronizaban antes de este plan) siguen funcionando exactamente igual — sin regresión por los cambios a `sync.js`.
6. Confirma que sin sesión iniciada (cierra sesión desde el botón ☁️ de Casa o Correr), Gimnasio/Progreso/Racha vuelven a comportarse 100% local sin llamadas de red.

- [ ] **Step 3: Push y confirmar en vivo**

```bash
git push
```

Espera a que se despliegue GitHub Pages y repite un flujo corto (Task 6 Step 2, puntos 1-2) contra las URLs reales de `https://pacoalvarezvivaldo-collab.github.io/quemagrasa/` para confirmar que el CSP en producción no bloquea nada — mismo tipo de sorpresa que ya pasó antes con `connect-src`/`script-src` en el proyecto original de sync, mejor confirmarlo aquí que asumir.
