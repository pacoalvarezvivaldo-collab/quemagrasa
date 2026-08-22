# Sync entre dispositivos con Supabase — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sincronización opcional entre dispositivos (login por magic link, tablas `run_history`/`user_state` con RLS) para el historial de carreras/caminatas, el peso corporal y el progreso del plan de 30 días — sin romper el uso 100% local y offline que la app ya tiene hoy.

**Architecture:** Un archivo nuevo `sync.js` (script clásico, sin build step) compartido por `correr.html` y `entrenamientos.html`, que carga `@supabase/supabase-js` por import dinámico desde `esm.sh` solo cuando hace falta. Sin sesión iniciada, `sync.js` no dispara ninguna llamada de red. Con sesión, cada guardado local también empuja a Supabase, y cada apertura de la app jala el estado remoto más reciente ("último cambio gana").

**Tech Stack:** HTML/CSS/JS puro (sin build), `@supabase/supabase-js@2` vía CDN `esm.sh`, Postgres + RLS en Supabase, Node.js solo como herramienta de verificación (`node --check`, scripts de assert).

## Global Constraints

- Sin build step nuevo: `sync.js` es un `<script src="sync.js">` clásico (no `type="module"`), consistente con el resto de la app.
- Login opcional: sin sesión activa, `sync.js` no debe hacer ninguna llamada de red a Supabase.
- Sin cifrado a nivel de campo (decidido en el spec: TLS + cifrado en reposo + RLS es suficiente para este dato).
- CSP de `correr.html` y `entrenamientos.html`: agregar `https://esm.sh` a `script-src` y `https://*.supabase.co` a `connect-src`; no tocar ninguna otra directiva existente.
- RLS obligatorio en `run_history` y `user_state`, policy `auth.uid() = user_id` para todas las operaciones.
- Spec completo: `docs/superpowers/specs/2026-08-21-supabase-sync-design.md`.

---

### Task 1: Ampliar el CSP de ambas páginas para permitir Supabase

**Files:**
- Modify: `correr.html:11`
- Modify: `entrenamientos.html:11`

**Interfaces:** N/A — cambio de configuración (meta tag), no expone funciones.

- [ ] **Step 1: Editar el CSP de `correr.html`**

Reemplazar la línea 11 completa:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

por:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://unpkg.com https://esm.sh; img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.org; connect-src https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

Cambios: `script-src` gana ` https://esm.sh`; `connect-src` pasa de `'none'` a `https://*.supabase.co`. Nada más cambia.

- [ ] **Step 2: Editar el CSP de `entrenamientos.html`**

Reemplazar la línea 11 completa:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

por:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://esm.sh; img-src 'self' data: https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
```

Cambios: `script-src` gana ` https://esm.sh`; `connect-src` gana ` https://*.supabase.co` (conserva `https://cdn.jsdelivr.net`, lo usa el fetch de ejercicios existente). Nada más cambia.

- [ ] **Step 3: Verificar que ninguna otra directiva cambió**

```bash
git diff correr.html entrenamientos.html
```

Expected: en cada archivo, un solo `-`/`+` en la línea 11, y el único texto distinto entre esas dos líneas es la adición de ` https://esm.sh` en `script-src` y el cambio de `connect-src`. Todas las demás directivas (`default-src`, `style-src`, `font-src`, `img-src`, `frame-ancestors`, `base-uri`, `form-action`) deben verse idénticas en ambos lados del diff.

- [ ] **Step 4: Commit**

```bash
git add correr.html entrenamientos.html
git commit -m "chore(csp): allow esm.sh (script-src) and *.supabase.co (connect-src) for the upcoming sync feature"
```

---

### Task 2: Crear `sync.js` (módulo compartido de sincronización)

**Files:**
- Create: `sync.js`

**Interfaces:**
- Produces (usado por Task 3 y Task 4): `window.QuemaSync = { init(buttonEl), isSignedIn(), pushRun(entry), pullAndMergeHistory(localHistoryArray), pushUserState(partialRow), pullUserState() }`.
  - `entry` = `{ date:number(ms), mode:'correr'|'caminar', distanceM:number, elapsedS:number, steps:number, kcal:number }` (mismo shape que ya usa `correr.html`).
  - `pullAndMergeHistory(localHistoryArray)` → `Promise<Array<entry>>` (el arreglo local si no hay sesión, o el arreglo fusionado con lo remoto).
  - `partialRow` = subconjunto de `{ weight_kg, plan_level, plan_current_day, plan_completed_days }` — **solo** las columnas que el caller quiere tocar (columnas ausentes no se pisan, ver Task 3/4).
  - `pullUserState()` → `Promise<{weightKg, level, currentDay, completedDays}|null>`.

- [ ] **Step 1: Escribir `sync.js` completo**

```javascript
/* =====================================================================
   sync.js — sincronización opcional con Supabase (magic link + RLS).
   Compartido por correr.html y entrenamientos.html. Sin sesión activa,
   nunca llama a red — cero comportamiento distinto al 100% local de hoy.
   Ver docs/superpowers/specs/2026-08-21-supabase-sync-design.md
   ===================================================================== */
(function(){

const SUPABASE_URL = '';      // <- pega aquí la Project URL de supabase.com
const SUPABASE_ANON_KEY = ''; // <- pega aquí la anon public key

let client = null, session = null, syncBtn = null;

/* ---------- lógica pura (testeable sin red/DOM) ---------- */
function entryKey(e){ return `${e.date}|${e.mode}|${e.distanceM}`; }
function rowKey(row){ return `${new Date(row.date).getTime()}|${row.mode}|${row.distance_m}`; }
function rowToEntry(row){
  return { date:new Date(row.date).getTime(), mode:row.mode, distanceM:row.distance_m,
    elapsedS:row.elapsed_s, steps:row.steps, kcal:row.kcal };
}
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

async function getClient(){
  if(client) return client;
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function renderBtn(){
  if(!syncBtn) return;
  syncBtn.textContent = session ? '☁️✓' : '☁️';
  syncBtn.title = session ? `Sesión: ${session.user.email} (toca para salir)` : 'Sincronizar entre dispositivos';
}

async function signOut(){
  const sb = await getClient();
  if(sb) await sb.auth.signOut();
  session = null;
  renderBtn();
}

async function sendMagicLink(email){
  const sb = await getClient();
  if(!sb) return;
  const redirectTo = location.origin + location.pathname;
  const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo:redirectTo } });
  alert(error ? ('No se pudo enviar el link: '+error.message) : 'Listo — revisa tu correo y toca el link para entrar.');
}

function openModal(){
  if(session){
    if(confirm('¿Cerrar sesión de sincronización?')) signOut();
    return;
  }
  const email = prompt('Correo para recibir el link de acceso:');
  if(email) sendMagicLink(email);
}

async function init(buttonEl){
  syncBtn = buttonEl;
  if(!syncBtn) return;
  const sb = await getClient();
  if(!sb){ syncBtn.style.display = 'none'; return; } // sin credenciales configuradas: el botón no existe
  syncBtn.addEventListener('click', openModal);
  const { data } = await sb.auth.getSession();
  session = data.session;
  renderBtn();
  sb.auth.onAuthStateChange((_event, s)=>{ session = s; renderBtn(); });
}

function isSignedIn(){ return !!session; }

/* ---------- run_history ---------- */
async function pushRun(entry){
  if(!session) return;
  const sb = await getClient();
  if(!sb) return;
  try{
    await sb.from('run_history').insert({
      user_id: session.user.id, date: new Date(entry.date).toISOString(), mode: entry.mode,
      distance_m: entry.distanceM, elapsed_s: entry.elapsedS, steps: entry.steps, kcal: entry.kcal
    });
  }catch(e){ /* offline: el dato ya quedó guardado en local, se reintenta en el próximo push */ }
}

async function pullAndMergeHistory(localHistory){
  if(!session) return localHistory;
  const sb = await getClient();
  if(!sb) return localHistory;
  try{
    const { data, error } = await sb.from('run_history').select('*').eq('user_id', session.user.id);
    if(error || !data) return localHistory;
    const { merged, toUpload } = mergeHistory(localHistory, data);
    await Promise.all(toUpload.map(pushRun));
    return merged;
  }catch(e){ return localHistory; }
}

/* ---------- user_state ---------- */
async function pushUserState(partial){
  if(!session) return;
  const sb = await getClient();
  if(!sb) return;
  try{
    await sb.from('user_state').upsert({ user_id: session.user.id, updated_at:new Date().toISOString(), ...partial });
  }catch(e){ /* offline: se reintenta en el próximo guardado */ }
}

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
})();
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check sync.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 3: Assert-based check de `mergeHistory` (lógica pura)**

`mergeHistory` vive dentro de la IIFE, no es accesible desde fuera. Se extrae el bloque marcado como "lógica pura" a un archivo temporal, se le agrega el test, se corre con node — mismo patrón usado en `docs/superpowers/plans/2026-08-20-modo-casa.md`.

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('sync.js','utf8');
const start=src.indexOf('/* ---------- lógica pura');
const end=src.indexOf('/* ---------- fin lógica pura ---------- */');
const pureCode=src.slice(start,end);
const test=pureCode+\`
const local = [
  {date:1000, mode:'correr', distanceM:500, elapsedS:120, steps:600, kcal:40},
  {date:2000, mode:'caminar', distanceM:300, elapsedS:200, steps:400, kcal:20}
];
const remote = [
  {date:new Date(1000).toISOString(), mode:'correr', distance_m:500, elapsed_s:120, steps:600, kcal:40},
  {date:new Date(3000).toISOString(), mode:'correr', distance_m:900, elapsed_s:300, steps:900, kcal:70}
];
const { merged, toUpload } = mergeHistory(local, remote);
console.assert(merged.length===3, 'merged debe tener 3 entradas, tiene '+merged.length);
console.assert(merged.some(e=>e.date===3000 && e.kcal===70), 'debe incluir la entrada solo-remota');
console.assert(toUpload.length===1 && toUpload[0].date===2000, 'toUpload debe traer solo la entrada 2000 (el remoto no la tenía)');
console.assert(merged[0].date<=merged[1].date && merged[1].date<=merged[2].date, 'merged debe quedar ordenado por fecha');
console.log('OK mergeHistory');
\`;
fs.writeFileSync('.sync-check.js', test);
"
node .sync-check.js
rm -f .sync-check.js
```
Expected output: `OK mergeHistory` y ninguna línea `Assertion failed`.

- [ ] **Step 4: Commit**

```bash
git add sync.js
git commit -m "feat(sync): add sync.js — Supabase client, magic-link auth, history merge + user_state push/pull"
```

---

### Task 3: Conectar `correr.html` a `sync.js`

**Files:**
- Modify: `correr.html`

**Interfaces:**
- Consumes: `window.QuemaSync` de Task 2 (`init`, `isSignedIn`, `pushRun`, `pullAndMergeHistory`, `pushUserState`, `pullUserState`).

- [ ] **Step 1: Cargar `sync.js` antes del script inline**

Ubicar (línea 200 antes de este cambio):

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
```

reemplazar por:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script src="sync.js"></script>
<script>
```

- [ ] **Step 2: Agregar el botón de sync en el topbar**

Ubicar:

```html
<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">🏃 Correr / Caminar</span>
  <span style="width:34px"></span>
</div>
```

reemplazar por:

```html
<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">🏃 Correr / Caminar</span>
  <button class="gear-btn" id="sync-btn" style="display:none" title="Sincronizar entre dispositivos">☁️</button>
</div>
```

(`style="display:none"` es el estado inicial hasta que `QuemaSync.init` decide si mostrarlo — si no hay credenciales configuradas en `sync.js`, se queda oculto para siempre.)

- [ ] **Step 3: Empujar cada carrera nueva a Supabase**

Ubicar en `stopTracking()`:

```javascript
  const elapsedS = currentElapsedS();
  const steps = stepsFor(distanceM);
  const kcal = kcalFor(elapsedS);
  lastResult = { mode, distanceM, elapsedS, steps, kcal };
  saveHistoryEntry({ date: Date.now(), mode, distanceM, elapsedS, steps, kcal });
```

reemplazar por:

```javascript
  const elapsedS = currentElapsedS();
  const steps = stepsFor(distanceM);
  const kcal = kcalFor(elapsedS);
  lastResult = { mode, distanceM, elapsedS, steps, kcal };
  const entry = { date: Date.now(), mode, distanceM, elapsedS, steps, kcal };
  saveHistoryEntry(entry);
  if(window.QuemaSync) QuemaSync.pushRun(entry);
```

- [ ] **Step 4: Empujar el peso a Supabase (solo la columna `weight_kg`, sin tocar las del plan)**

Ubicar:

```javascript
function saveWeight(v){
  const n = parseFloat(v);
  if(!isNaN(n) && n>=30 && n<=250){ userWeight = n; try{ localStorage.setItem(KEY_WEIGHT, String(n)); }catch(e){} }
}
```

reemplazar por:

```javascript
function saveWeight(v){
  const n = parseFloat(v);
  if(!isNaN(n) && n>=30 && n<=250){
    userWeight = n;
    try{ localStorage.setItem(KEY_WEIGHT, String(n)); }catch(e){}
    if(window.QuemaSync) QuemaSync.pushUserState({ weight_kg: n });
  }
}
```

`pushUserState({ weight_kg: n })` manda solo esa columna — Supabase (`upsert` de PostgREST) solo pisa las columnas presentes en el payload, así que `plan_level`/`plan_current_day`/`plan_completed_days` (que esta página ni conoce) quedan intactas.

- [ ] **Step 5: Inicializar sync y jalar estado remoto al abrir la página**

Ubicar:

```javascript
/* ---------- init ---------- */
(function init(){
  userWeight = loadWeight();
  document.getElementById('weight-input').value = userWeight;
  const savedMode = loadModePref();
  if(savedMode==='caminar') setMode('caminar');
  renderHistory();
})();
```

reemplazar por:

```javascript
/* ---------- init ---------- */
(async function init(){
  userWeight = loadWeight();
  document.getElementById('weight-input').value = userWeight;
  const savedMode = loadModePref();
  if(savedMode==='caminar') setMode('caminar');
  renderHistory();

  if(!window.QuemaSync) return;
  await QuemaSync.init(document.getElementById('sync-btn'));
  if(!QuemaSync.isSignedIn()) return;

  const merged = await QuemaSync.pullAndMergeHistory(loadHistory());
  try{ localStorage.setItem(KEY_HISTORY, JSON.stringify(merged.slice(-50))); }catch(e){}
  renderHistory();

  const remote = await QuemaSync.pullUserState();
  if(remote && remote.weightKg != null){
    userWeight = remote.weightKg;
    try{ localStorage.setItem(KEY_WEIGHT, String(remote.weightKg)); }catch(e){}
    document.getElementById('weight-input').value = remote.weightKg;
  }
})();
```

- [ ] **Step 6: Verificar sintaxis**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('correr.html','utf8');
const body=src.slice(src.lastIndexOf('<script>')+8, src.lastIndexOf('</script>'));
fs.writeFileSync('.syntax-check.js', body);
"
node --check .syntax-check.js
rm -f .syntax-check.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 7: Commit**

```bash
git add correr.html
git commit -m "feat(correr): wire sync.js — push runs/weight, pull+merge on load, sync button in topbar"
```

---

### Task 4: Conectar `entrenamientos.html` a `sync.js`

**Files:**
- Modify: `entrenamientos.html`

**Interfaces:**
- Consumes: `window.QuemaSync` de Task 2 (`init`, `isSignedIn`, `pushUserState`, `pullUserState`).

- [ ] **Step 1: Cargar `sync.js` antes del script inline**

Ubicar (línea 181 antes de este cambio):

```html
<script>
```

(el primer y único `<script>` sin `src` del archivo) — anteponerle:

```html
<script src="sync.js"></script>
<script>
```

- [ ] **Step 2: Agregar el botón de sync en el topbar**

Ubicar:

```html
<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">🏋️ Plan 30 días</span>
  <button class="gear-btn" id="level-gear-btn" onclick="openLevelPicker()">⚙</button>
</div>
```

reemplazar por:

```html
<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">🏋️ Plan 30 días</span>
  <div style="display:flex;gap:8px;">
    <button class="gear-btn" id="sync-btn" style="display:none" title="Sincronizar entre dispositivos">☁️</button>
    <button class="gear-btn" id="level-gear-btn" onclick="openLevelPicker()">⚙</button>
  </div>
</div>
```

- [ ] **Step 3: Empujar cada cambio de nivel/día/completado a Supabase (una columna por función, igual patrón que Task 3 Step 4)**

Ubicar:

```javascript
function saveLevel(){ try{ localStorage.setItem(KEY_LEVEL, LEVEL_KEY); }catch(e){} }
function loadLevel(){ try{ return localStorage.getItem(KEY_LEVEL); }catch(e){ return null; } }
function saveCompleted(){ try{ localStorage.setItem(KEY_DONE, JSON.stringify([...COMPLETED])); }catch(e){} }
function loadCompleted(){
  try{ const v=localStorage.getItem(KEY_DONE); return v ? new Set(JSON.parse(v)) : new Set(); }
  catch(e){ return new Set(); }
}
function saveCurrentDay(day){ try{ localStorage.setItem(KEY_CURRENT, String(day)); }catch(e){} }
function loadCurrentDay(){
  try{ const v=localStorage.getItem(KEY_CURRENT); return v ? parseInt(v,10) : null; }
  catch(e){ return null; }
}
```

reemplazar por:

```javascript
function saveLevel(){
  try{ localStorage.setItem(KEY_LEVEL, LEVEL_KEY); }catch(e){}
  if(window.QuemaSync) QuemaSync.pushUserState({ plan_level: LEVEL_KEY });
}
function loadLevel(){ try{ return localStorage.getItem(KEY_LEVEL); }catch(e){ return null; } }
function saveCompleted(){
  try{ localStorage.setItem(KEY_DONE, JSON.stringify([...COMPLETED])); }catch(e){}
  if(window.QuemaSync) QuemaSync.pushUserState({ plan_completed_days: [...COMPLETED] });
}
function loadCompleted(){
  try{ const v=localStorage.getItem(KEY_DONE); return v ? new Set(JSON.parse(v)) : new Set(); }
  catch(e){ return new Set(); }
}
function saveCurrentDay(day){
  try{ localStorage.setItem(KEY_CURRENT, String(day)); }catch(e){}
  if(window.QuemaSync) QuemaSync.pushUserState({ plan_current_day: day });
}
function loadCurrentDay(){
  try{ const v=localStorage.getItem(KEY_CURRENT); return v ? parseInt(v,10) : null; }
  catch(e){ return null; }
}
```

- [ ] **Step 4: Inicializar sync y jalar estado remoto al abrir la página**

Ubicar:

```javascript
/* ---------- init ---------- */
(function init(){
  LEVEL_KEY = loadLevel();
  COMPLETED = loadCompleted();
  CURRENT_DAY_SAVED = loadCurrentDay();
  if(LEVEL_KEY && LEVELS[LEVEL_KEY]){
    renderCalendar();
    showScreen('calendar');
  } else {
    LEVEL_KEY = null;
    showScreen('level');
  }
  ensurePool();
})();
```

reemplazar por:

```javascript
/* ---------- init ---------- */
(async function init(){
  LEVEL_KEY = loadLevel();
  COMPLETED = loadCompleted();
  CURRENT_DAY_SAVED = loadCurrentDay();

  if(window.QuemaSync){
    await QuemaSync.init(document.getElementById('sync-btn'));
    if(QuemaSync.isSignedIn()){
      const remote = await QuemaSync.pullUserState();
      if(remote){
        if(remote.level){ LEVEL_KEY = remote.level; try{ localStorage.setItem(KEY_LEVEL, LEVEL_KEY); }catch(e){} }
        if(remote.currentDay != null){ CURRENT_DAY_SAVED = remote.currentDay; try{ localStorage.setItem(KEY_CURRENT, String(remote.currentDay)); }catch(e){} }
        if(remote.completedDays && remote.completedDays.length){
          COMPLETED = new Set(remote.completedDays);
          try{ localStorage.setItem(KEY_DONE, JSON.stringify([...COMPLETED])); }catch(e){}
        }
      }
    }
  }

  if(LEVEL_KEY && LEVELS[LEVEL_KEY]){
    renderCalendar();
    showScreen('calendar');
  } else {
    LEVEL_KEY = null;
    showScreen('level');
  }
  ensurePool();
})();
```

- [ ] **Step 5: Verificar sintaxis**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('entrenamientos.html','utf8');
const body=src.slice(src.lastIndexOf('<script>')+8, src.lastIndexOf('</script>'));
fs.writeFileSync('.syntax-check.js', body);
"
node --check .syntax-check.js
rm -f .syntax-check.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 6: Commit**

```bash
git add entrenamientos.html
git commit -m "feat(entrenamientos): wire sync.js — push level/day/completed, pull+merge on load, sync button in topbar"
```

---

### Task 5: Schema SQL, setup en Supabase, y verificación end-to-end

Esta tarea requiere que **el usuario** cree el proyecto en supabase.com — ningún paso anterior puede probarse en vivo sin eso. El agente que ejecute esta tarea debe pausar en el Step 2 y pedirle al usuario los 3 datos (Project URL, anon key, confirmación de que corrió el SQL) antes de continuar.

**Files:**
- Create: `supabase-schema.sql`
- Modify: `sync.js` (solo las 2 constantes vacías)

**Interfaces:** N/A — configuración y verificación, no código nuevo reusado por otros archivos.

- [ ] **Step 1: Crear `supabase-schema.sql`**

```sql
-- Historial de carreras/caminatas: log completo, un registro por sesión
create table run_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date timestamptz not null,
  mode text not null,          -- 'correr' | 'caminar'
  distance_m numeric not null,
  elapsed_s numeric not null,
  steps int,
  kcal numeric,
  created_at timestamptz not null default now()
);

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

- [ ] **Step 2: Pausar y pedir al usuario el setup manual**

Pedirle al usuario, en este orden:
1. Crear un proyecto en https://supabase.com (gratis).
2. Abrir el SQL Editor del proyecto, pegar el contenido de `supabase-schema.sql` y correrlo.
3. En **Authentication → URL Configuration**, poner como Redirect URL la URL de GitHub Pages de la app (ej. `https://<usuario>.github.io/quemagrasa/`).
4. En **Project Settings → API**, copiar la **Project URL** y la **anon public key**.

No continuar al Step 3 sin tener esos 2 valores.

- [ ] **Step 3: Pegar las credenciales en `sync.js`**

Ubicar:

```javascript
const SUPABASE_URL = '';      // <- pega aquí la Project URL de supabase.com
const SUPABASE_ANON_KEY = ''; // <- pega aquí la anon public key
```

Reemplazar las cadenas vacías con los valores reales que dio el usuario (Project URL y anon key), dejando el resto de la línea igual.

- [ ] **Step 4: Verificación manual en navegador — comportamiento sin sesión**

Abrir `correr.html` en el navegador (servido, no `file://`, para que el CSP aplique igual que en producción) sin haber iniciado sesión. Con las herramientas de red del navegador abiertas, confirmar: cero requests hacia `*.supabase.co`. El botón "☁️" debe verse y funcionar para abrir el flujo de login, pero ninguna otra parte de la app debe haber llamado a Supabase todavía.

- [ ] **Step 5: Verificación manual en navegador — sync end-to-end**

Simular dos "dispositivos" con dos perfiles/pestañas de incógnito distintos del mismo navegador:

1. Dispositivo A: iniciar sesión con el link mágico, guardar un peso, completar una carrera de prueba.
2. Dispositivo B: iniciar sesión con el **mismo correo**, confirmar que el peso y la carrera de A aparecen ahí (pull al abrir).
3. Dispositivo B: cambiar el peso.
4. Volver a Dispositivo A, recargar la página: confirmar que ahora muestra el peso que puso B (pull en cada apertura, no solo la primera vez).
5. En `entrenamientos.html`: elegir un nivel y completar un día en A, recargar en B, confirmar que aparece el mismo nivel/día completado.
6. En el dashboard de Supabase (Table Editor), confirmar que `run_history` tiene la carrera de prueba y `user_state` tiene una sola fila por usuario con los valores esperados.

- [ ] **Step 6: Verificar RLS**

En el SQL Editor de Supabase, correr como usuario anónimo (o revisando la policy directamente) que una consulta a `run_history`/`user_state` sin `auth.uid()` coincidente no devuelve filas de otro usuario. Confirmar visualmente en **Authentication → Policies** que ambas tablas muestran las policies `own rows only` / `own row only` activas.

- [ ] **Step 7: Commit y push**

```bash
git add supabase-schema.sql sync.js
git commit -m "feat(sync): add Supabase schema SQL, wire real project credentials"
git push
```
