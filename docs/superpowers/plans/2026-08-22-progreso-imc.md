# Progreso de peso + IMC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una bitácora diaria de peso con gráfica, proyección teórica hacia una meta opcional, e indicador de IMC con semáforo de color, todo dentro de una tarjeta expandible en `index.html`.

**Architecture:** `weight-log.js` es un script clásico nuevo (sin build, sin módulos) que expone `window.WeightLog` con la lógica pura (upsert de registros, cálculo de IMC, banda OMS, proyección teórica lineal, resumen de cambio) y la persistencia en `localStorage`. Es compartido por `index.html` (toda la UI nueva) y `correr.html` (que deja de tener su propio peso aislado y pasa a leer/escribir la misma bitácora). Toda la UI (panel expandible, formularios, gráfica SVG, badge de IMC) vive en el `<script>` inline de `index.html`, sin tocar `correr.html` más que en la fuente del peso.

**Tech Stack:** HTML/CSS/JS puro (sin build), SVG generado a mano para la gráfica (sin librerías), Node.js solo para verificación (`node --check`, scripts de assert).

## Global Constraints

- `weight-log.js` no debe tocar el DOM ni referenciar `QuemaSync` — solo lógica pura + `localStorage`. Ver spec: `docs/superpowers/specs/2026-08-22-progreso-imc-design.md`.
- Llaves de `localStorage`: `qg_weight_log` (array de `{date:"YYYY-MM-DD", weightKg}`), `qg_height_cm`, `qg_goal_weight_kg`, `qg_goal_date` — prefijo `qg_` igual que el resto de easter eggs de `index.html`.
- Un solo registro por día en `qg_weight_log`: si ya existe uno con la fecha de hoy, se sobreescribe en vez de duplicarse.
- Bandas OMS de IMC: 🔵 <18.5 bajo peso · 🟢 18.5–24.9 normal · 🟠 25–29.9 sobrepeso · 🔴 ≥30 obesidad.
- La teórica es una recta simple entre `(fecha primer registro, peso inicial)` y `(fecha meta, peso meta)` — sin meta, no hay teórica.
- Sin sincronización con Supabase en esta ronda — todo 100% local (`localStorage`), igual que Gimnasio.
- `correr.html` deja de tener `KEY_WEIGHT`/`loadWeight`/`saveWeight` propios; su input de peso pasa a leer/escribir `qg_weight_log` vía `WeightLog`.

---

### Task 1: Crear `weight-log.js`

**Files:**
- Create: `weight-log.js`

**Interfaces:**
- Produce (usado por Task 2 y Tasks 3–7): `window.WeightLog` con:
  ```
  WeightLog = {
    todayStr(d?) -> "YYYY-MM-DD",
    upsertEntry(log, dateStr, weightKg) -> newLog,
    latestEntry(log) -> {date, weightKg} | null,
    bmiValue(weightKg, heightCm) -> number (1 decimal),
    bmiBand(bmi) -> { key, label, color },
    daysBetween(dateStrA, dateStrB) -> number,
    theoreticalWeightAt(dateStr, startDateStr, startWeight, goalDateStr, goalWeight) -> number,
    weightChangeSummary(log) -> { startDate, startWeight, currentDate, currentWeight, deltaKg } | null,
    progressStatus(todayDateStr, startDateStr, startWeight, goalDateStr, goalWeight, currentWeight)
      -> { phase:'done', met, diffKg } | { phase:'ontrack'|'ahead'|'behind', diffKg },
    getLog() -> array,
    saveTodayWeight(weightKg) -> newLog (persiste y devuelve el log actualizado),
    getLatestWeight() -> number | null,
    getHeightCm() -> number | null,
    saveHeightCm(cm) -> void,
    getGoal() -> { weightKg, date } | null,
    saveGoal(weightKg, dateStr) -> void,
    clearGoal() -> void
  }
  ```

- [ ] **Step 1: Escribir `weight-log.js`**

```javascript
/* =====================================================================
   weight-log.js — bitácora de peso compartida (index.html y correr.html):
   registro diario, estatura, meta opcional, IMC y proyección teórica.
   Sin conocimiento de DOM ni de Supabase — todo local en localStorage.
   Ver docs/superpowers/specs/2026-08-22-progreso-imc-design.md
   ===================================================================== */

/* ---------- lógica pura (testeable sin red/DOM) ---------- */
function todayStr(d){
  d = d || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function upsertEntry(log, dateStr, weightKg){
  const next = log.filter(e => e.date !== dateStr);
  next.push({ date: dateStr, weightKg });
  next.sort((a,b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));
  return next;
}

function latestEntry(log){
  return log.length ? log[log.length-1] : null;
}

function bmiValue(weightKg, heightCm){
  const h = heightCm/100;
  return Math.round((weightKg/(h*h))*10)/10;
}

function bmiBand(bmi){
  if(bmi < 18.5) return { key:'bajo', label:'Bajo peso', color:'#3E8FE0' };
  if(bmi < 25)   return { key:'normal', label:'Normal', color:'#3EB86B' };
  if(bmi < 30)   return { key:'sobrepeso', label:'Sobrepeso', color:'#EF9F27' };
  return { key:'obesidad', label:'Obesidad', color:'#E24B4A' };
}

function daysBetween(dateStrA, dateStrB){
  return (new Date(dateStrB+'T00:00:00') - new Date(dateStrA+'T00:00:00')) / 86400000;
}

function theoreticalWeightAt(dateStr, startDateStr, startWeight, goalDateStr, goalWeight){
  const totalDays = daysBetween(startDateStr, goalDateStr);
  if(totalDays <= 0) return goalWeight;
  const elapsedDays = daysBetween(startDateStr, dateStr);
  const t = Math.max(0, Math.min(1, elapsedDays/totalDays));
  return startWeight + (goalWeight - startWeight) * t;
}

function weightChangeSummary(log){
  if(!log.length) return null;
  const first = log[0], last = latestEntry(log);
  return {
    startDate: first.date, startWeight: first.weightKg,
    currentDate: last.date, currentWeight: last.weightKg,
    deltaKg: Math.round((first.weightKg - last.weightKg)*10)/10
  };
}

function progressStatus(todayDateStr, startDateStr, startWeight, goalDateStr, goalWeight, currentWeight){
  if(todayDateStr >= goalDateStr){
    const met = currentWeight <= goalWeight;
    return { phase:'done', met, diffKg: Math.round((currentWeight-goalWeight)*10)/10 };
  }
  const theoretical = theoreticalWeightAt(todayDateStr, startDateStr, startWeight, goalDateStr, goalWeight);
  const diff = Math.round((currentWeight - theoretical)*10)/10;
  if(Math.abs(diff) <= 0.3) return { phase:'ontrack', diffKg:diff };
  return { phase: diff < 0 ? 'ahead' : 'behind', diffKg: Math.abs(diff) };
}
/* ---------- fin lógica pura ---------- */

const KEY_LOG = 'qg_weight_log', KEY_HEIGHT = 'qg_height_cm', KEY_GOAL_W = 'qg_goal_weight_kg', KEY_GOAL_D = 'qg_goal_date';

function getLog(){ try{ return JSON.parse(localStorage.getItem(KEY_LOG))||[]; }catch(e){ return []; } }
function saveLog(log){ try{ localStorage.setItem(KEY_LOG, JSON.stringify(log)); }catch(e){} }
function saveTodayWeight(weightKg){
  const log = upsertEntry(getLog(), todayStr(), weightKg);
  saveLog(log);
  return log;
}
function getLatestWeight(){ const e = latestEntry(getLog()); return e ? e.weightKg : null; }

function getHeightCm(){ try{ const v = parseFloat(localStorage.getItem(KEY_HEIGHT)); return isNaN(v)?null:v; }catch(e){ return null; } }
function saveHeightCm(cm){ try{ localStorage.setItem(KEY_HEIGHT, String(cm)); }catch(e){} }

function getGoal(){
  try{
    const w = parseFloat(localStorage.getItem(KEY_GOAL_W));
    const d = localStorage.getItem(KEY_GOAL_D);
    if(isNaN(w) || !d) return null;
    return { weightKg:w, date:d };
  }catch(e){ return null; }
}
function saveGoal(weightKg, dateStr){
  try{ localStorage.setItem(KEY_GOAL_W, String(weightKg)); localStorage.setItem(KEY_GOAL_D, dateStr); }catch(e){}
}
function clearGoal(){ try{ localStorage.removeItem(KEY_GOAL_W); localStorage.removeItem(KEY_GOAL_D); }catch(e){} }

window.WeightLog = {
  todayStr, upsertEntry, latestEntry, bmiValue, bmiBand, daysBetween, theoreticalWeightAt,
  weightChangeSummary, progressStatus,
  getLog, saveTodayWeight, getLatestWeight, getHeightCm, saveHeightCm, getGoal, saveGoal, clearGoal
};
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check weight-log.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 3: Assert-based check de la lógica pura**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('weight-log.js','utf8');
const start=src.indexOf('/* ---------- lógica pura');
const end=src.indexOf('/* ---------- fin lógica pura ---------- */');
const pureCode=src.slice(start,end);
const test=pureCode+\`
// todayStr
console.assert(todayStr(new Date(2026,0,5))==='2026-01-05', 'todayStr debe formatear con ceros');

// upsertEntry: crea, sobreescribe el mismo día, mantiene orden al insertar en medio
let log = upsertEntry([], '2026-01-01', 80);
console.assert(log.length===1 && log[0].weightKg===80, 'primer registro');
log = upsertEntry(log, '2026-01-01', 79);
console.assert(log.length===1 && log[0].weightKg===79, 'mismo día debe sobreescribir, no duplicar');
log = upsertEntry(log, '2026-01-03', 78);
log = upsertEntry(log, '2026-01-02', 78.5);
console.assert(log.map(e=>e.date).join(',')==='2026-01-01,2026-01-02,2026-01-03', 'debe quedar ordenado por fecha, dio '+log.map(e=>e.date).join(','));

// bmiValue / bmiBand — bandas OMS
console.assert(bmiValue(70,175)===22.9, 'bmiValue(70,175) debe ser 22.9, dio '+bmiValue(70,175));
console.assert(bmiBand(17.9).key==='bajo', 'bajo peso');
console.assert(bmiBand(18.5).key==='normal', 'normal en el borde bajo');
console.assert(bmiBand(24.9).key==='normal', 'normal en el borde alto');
console.assert(bmiBand(25).key==='sobrepeso', 'sobrepeso en el borde bajo');
console.assert(bmiBand(29.9).key==='sobrepeso', 'sobrepeso en el borde alto');
console.assert(bmiBand(30).key==='obesidad', 'obesidad en el borde');

// daysBetween / theoreticalWeightAt
console.assert(daysBetween('2026-01-01','2026-01-11')===10, 'daysBetween debe ser 10');
console.assert(theoreticalWeightAt('2026-01-06','2026-01-01',90,'2026-01-11',80)===85, 'punto medio debe ser 85, dio '+theoreticalWeightAt('2026-01-06','2026-01-01',90,'2026-01-11',80));
console.assert(theoreticalWeightAt('2026-01-15','2026-01-01',90,'2026-01-11',80)===80, 'después de la meta debe quedar clampeado en el peso meta');

// weightChangeSummary
const sumLog = [{date:'2026-01-01',weightKg:90},{date:'2026-01-06',weightKg:87}];
const s = weightChangeSummary(sumLog);
console.assert(s.deltaKg===3, 'debe haber bajado 3kg, dio '+s.deltaKg);

// progressStatus: a tiempo / adelantado / atrasado / meta cumplida / meta no cumplida
console.assert(progressStatus('2026-01-06','2026-01-01',90,'2026-01-11',80,85).phase==='ontrack', 'debe ir a tiempo');
console.assert(progressStatus('2026-01-06','2026-01-01',90,'2026-01-11',80,83).phase==='ahead', 'debe ir adelantado');
console.assert(progressStatus('2026-01-06','2026-01-01',90,'2026-01-11',80,88).phase==='behind', 'debe ir atrasado');
const done1 = progressStatus('2026-01-12','2026-01-01',90,'2026-01-11',80,79);
console.assert(done1.phase==='done' && done1.met===true, 'meta cumplida');
const done2 = progressStatus('2026-01-12','2026-01-01',90,'2026-01-11',80,83);
console.assert(done2.phase==='done' && done2.met===false && done2.diffKg===3, 'meta no cumplida, se quedó a 3kg');

console.log('OK weight-log pure logic');
\`;
fs.writeFileSync('.weight-log-check.js', test);
"
node .weight-log-check.js
rm -f .weight-log-check.js
```
Expected output: `OK weight-log pure logic` y ninguna línea `Assertion failed`.

- [ ] **Step 4: Commit**

```bash
git add weight-log.js
git commit -m "feat(progreso): add weight-log.js — shared weight log, BMI and theoretical projection logic"
```

---

### Task 2: Wire `correr.html` a `weight-log.js`

**Files:**
- Modify: `correr.html`

**Interfaces:**
- Consumes: `window.WeightLog.getLatestWeight()`, `window.WeightLog.saveTodayWeight(weightKg)` de Task 1.

- [ ] **Step 1: Cargar `weight-log.js` antes del script inline**

Ubicar (línea 202):
```html
<script src="sync.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
```

- [ ] **Step 2: Quitar `KEY_WEIGHT`/`loadWeight`/`saveWeight` propios, usar `WeightLog`**

Ubicar (líneas 217, 237–245):
```javascript
const KEY_HISTORY = 'correr_history', KEY_WEIGHT = 'correr_weight', KEY_MODE = 'correr_mode';
```
reemplazar por:
```javascript
const KEY_HISTORY = 'correr_history', KEY_MODE = 'correr_mode';
```

Ubicar:
```javascript
function saveWeight(v){
  const n = parseFloat(v);
  if(!isNaN(n) && n>=30 && n<=250){
    userWeight = n;
    try{ localStorage.setItem(KEY_WEIGHT, String(n)); }catch(e){}
    if(window.QuemaSync) QuemaSync.pushUserState({ weight_kg: n });
  }
}
function loadWeight(){ try{ const v=parseFloat(localStorage.getItem(KEY_WEIGHT)); return (v>=30 && v<=250)?v:70; }catch(e){ return 70; } }
```
reemplazar por:
```javascript
function saveWeight(v){
  const n = parseFloat(v);
  if(!isNaN(n) && n>=30 && n<=250){
    userWeight = n;
    WeightLog.saveTodayWeight(n);
    if(window.QuemaSync) QuemaSync.pushUserState({ weight_kg: n });
  }
}
function loadWeight(){ const v = WeightLog.getLatestWeight(); return (v>=30 && v<=250)?v:70; }
```

- [ ] **Step 3: Ajustar el pull remoto para no depender de `KEY_WEIGHT`**

Ubicar (líneas 551–556):
```javascript
  const remote = await QuemaSync.pullUserState();
  if(remote && remote.weightKg != null){
    userWeight = remote.weightKg;
    try{ localStorage.setItem(KEY_WEIGHT, String(remote.weightKg)); }catch(e){}
    document.getElementById('weight-input').value = remote.weightKg;
  }
```
reemplazar por:
```javascript
  const remote = await QuemaSync.pullUserState();
  if(remote && remote.weightKg != null){
    userWeight = remote.weightKg;
    document.getElementById('weight-input').value = remote.weightKg;
  }
```

(El valor remoto ya no se persiste en la bitácora local — es un solo número histórico de `user_state`, no tiene fecha propia; solo se usa para mostrar/calcular kcal en esta sesión. La bitácora local (`qg_weight_log`) sigue siendo la fuente de verdad de "el peso de hoy".)

- [ ] **Step 4: Verificar sintaxis**

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

- [ ] **Step 5: Regresión manual**

Sirve el sitio localmente (`npx serve .` — no `file://`, el CSP lo bloquea) y en `correr.html`:
1. Si ya tenías un peso guardado en `correr_weight` de antes, la primera carga usará el valor por defecto (70) porque la llave vieja ya no se lee — es esperado, es una migración de una sola vez.
2. Cambia el peso en el campo, confirma que se guarda (recarga la página, debe persistir).
3. Abre `index.html` en otra pestaña — el peso que acabas de guardar en `correr.html` debe aparecer ahí una vez implementada la Task 3 (por ahora solo confirma que no truena nada).
4. Confirma que el cálculo de kcal al final de una sesión sigue funcionando igual que antes.

- [ ] **Step 6: Commit**

```bash
git add correr.html
git commit -m "refactor(correr): read/write weight through weight-log.js instead of its own key"
```

---

### Task 3: Tarjeta "Tu progreso" en `index.html` — captura de peso y estatura

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.WeightLog` de Task 1 (`getLog`, `saveTodayWeight`, `saveHeightCm`).
- Produce (usado por Tasks 4–7): `renderProgress()` — punto de entrada que Tasks 4–7 extienden agregando una línea de llamada cada una al final de la función, justo antes de su `}` de cierre.

- [ ] **Step 1: Agregar el CSS completo del panel de progreso**

Ubicar (final del `<style>`, después de la regla `.rainbow-zone`):
```css
.rainbow-zone { position:fixed; top:0; height:16px; width:16.6667vw; z-index:400; }

.tap-ripple { position:fixed; width:14px; height:14px; border-radius:50%; background:var(--accent);
  opacity:.45; transform:translate(-50%,-50%) scale(0); pointer-events:none; z-index:250;
  animation:tap-ripple-anim .55s ease-out forwards; }
@keyframes tap-ripple-anim { to { transform:translate(-50%,-50%) scale(16); opacity:0; } }
```
reemplazar por:
```css
.rainbow-zone { position:fixed; top:0; height:16px; width:16.6667vw; z-index:400; }

.tap-ripple { position:fixed; width:14px; height:14px; border-radius:50%; background:var(--accent);
  opacity:.45; transform:translate(-50%,-50%) scale(0); pointer-events:none; z-index:250;
  animation:tap-ripple-anim .55s ease-out forwards; }
@keyframes tap-ripple-anim { to { transform:translate(-50%,-50%) scale(16); opacity:0; } }

/* ---- Tu progreso ---- */
.progress-card.open { border-radius:14px 14px 0 0; border-color:var(--accent); }
#progress-chevron { transition:transform .15s; }
.progress-card.open #progress-chevron { transform:rotate(90deg); }

.progress-panel { display:none; background:var(--surface); border:1.5px solid var(--border); border-top:none;
  border-radius:0 0 14px 14px; padding:14px 16px 16px; margin-top:-8px; margin-bottom:8px; }
.progress-panel.show { display:block; }

.field-label { font-size:12.5px; font-weight:700; display:block; margin-bottom:6px; }
.field-input { background:var(--surface2); border:1px solid var(--border); color:var(--text);
  border-radius:10px; padding:9px 10px; font-family:'Space Mono',monospace; font-size:14px;
  width:100%; -webkit-appearance:none; margin-bottom:12px; }
.progress-btn { width:100%; background:var(--accent); color:var(--accent-text); border:none;
  border-radius:12px; padding:12px; font-weight:700; font-family:'Syne',sans-serif; font-size:13px;
  cursor:pointer; -webkit-tap-highlight-color:transparent; }
.progress-btn-secondary { width:100%; background:var(--surface2); color:var(--text); border:1px solid var(--border);
  border-radius:12px; padding:12px; font-weight:700; font-family:'Syne',sans-serif; font-size:13px;
  cursor:pointer; -webkit-tap-highlight-color:transparent; margin-top:8px; }

.progress-today-row { display:flex; gap:8px; align-items:flex-start; }
.progress-today-row .field-input { margin-bottom:12px; }
.progress-today-row .progress-btn { width:auto; padding:9px 16px; white-space:nowrap; }

.progress-goal-link { font-size:12px; color:var(--muted); margin-bottom:12px; cursor:pointer;
  -webkit-tap-highlight-color:transparent; }
.progress-goal-form { background:var(--surface2); border:1px solid var(--border); border-radius:12px;
  padding:12px; margin-bottom:14px; }

.progress-summary { font-size:13px; line-height:1.6; margin-bottom:14px; }
.progress-summary .status-line { color:var(--muted); font-size:12px; margin-top:2px; }

.progress-chart-wrap { margin-bottom:14px; }
.progress-chart-wrap svg { width:100%; height:auto; display:block; }

.progress-bmi { display:none; align-items:center; gap:8px; font-family:'Space Mono',monospace;
  font-size:13px; background:var(--surface2); border-radius:10px; padding:9px 12px; }
.progress-bmi .bmi-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
```

- [ ] **Step 2: Agregar la tarjeta y el panel al HTML**

Ubicar (inicio de `.mode-list`):
```html
  <div class="mode-list">
    <a class="mode-row" href="entrenamientos.html">
```
reemplazar por:
```html
  <div class="mode-list">
    <div class="mode-row progress-card" id="progress-card" onclick="toggleProgressPanel()">
      <span class="mode-icon">📊</span>
      <span class="mode-text"><span class="mode-name">Tu progreso</span><span class="mode-sub" id="progress-sub">Registra tu peso</span></span>
      <span class="mode-chevron" id="progress-chevron">›</span>
    </div>
    <div class="progress-panel" id="progress-panel">
      <div id="progress-first-form">
        <label class="field-label">Peso (kg)</label>
        <input class="field-input" id="progress-first-weight" type="number" inputmode="decimal" min="30" max="300" step="0.1" placeholder="70.0">
        <label class="field-label">Estatura (cm)</label>
        <input class="field-input" id="progress-first-height" type="number" inputmode="numeric" min="100" max="250" placeholder="170">
        <button class="progress-btn" onclick="saveFirstEntry()">Guardar</button>
      </div>
      <div id="progress-data" style="display:none;">
        <div class="progress-today-row">
          <input class="field-input" id="progress-today-weight" type="number" inputmode="decimal" min="30" max="300" step="0.1">
          <button class="progress-btn" onclick="saveTodayEntry()">Guardar</button>
        </div>
        <div class="progress-goal-link" id="progress-goal-link" onclick="toggleGoalForm()"></div>
        <div class="progress-goal-form" id="progress-goal-form" style="display:none;">
          <label class="field-label">Peso meta (kg)</label>
          <input class="field-input" id="progress-goal-weight" type="number" inputmode="decimal" min="30" max="300" step="0.1">
          <label class="field-label">Fecha meta</label>
          <input class="field-input" id="progress-goal-date" type="date">
          <button class="progress-btn" onclick="saveGoalEntry()">Guardar meta</button>
          <button class="progress-btn-secondary" id="progress-goal-remove" onclick="removeGoalEntry()" style="display:none;">Quitar meta</button>
        </div>
        <div class="progress-summary" id="progress-summary"></div>
        <div class="progress-chart-wrap" id="progress-chart-wrap"></div>
        <div class="progress-bmi" id="progress-bmi"></div>
      </div>
    </div>
    <a class="mode-row" href="entrenamientos.html">
```

- [ ] **Step 3: Cargar `weight-log.js` y agregar la lógica de captura**

Ubicar (línea 116):
```html
<script>
/* easter egg: 7 taps al 🔥 en menos de 3s */
```
reemplazar por:
```html
<script src="weight-log.js"></script>
<script>
/* ---------- Tu progreso: peso, estatura, meta, IMC ---------- */
let progressOpen = false;

function toggleProgressPanel(){
  progressOpen = !progressOpen;
  document.getElementById('progress-card').classList.toggle('open', progressOpen);
  document.getElementById('progress-panel').classList.toggle('show', progressOpen);
}

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

function saveTodayEntry(){
  const w = parseFloat(document.getElementById('progress-today-weight').value);
  if(isNaN(w) || w<30 || w>300){
    alert('Ingresa un peso válido (30-300 kg).');
    return;
  }
  WeightLog.saveTodayWeight(w);
  renderProgress();
}

function renderProgress(){
  const log = WeightLog.getLog();
  const sub = document.getElementById('progress-sub');
  const firstForm = document.getElementById('progress-first-form');
  const data = document.getElementById('progress-data');

  if(!log.length){
    sub.textContent = 'Registra tu peso';
    firstForm.style.display = '';
    data.style.display = 'none';
    return;
  }

  firstForm.style.display = 'none';
  data.style.display = '';
  const last = log[log.length-1];
  sub.textContent = `Último registro: ${last.weightKg} kg`;
  document.getElementById('progress-today-weight').value = last.weightKg;
}

renderProgress();

/* easter egg: 7 taps al 🔥 en menos de 3s */
```

- [ ] **Step 4: Verificar sintaxis**

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

- [ ] **Step 5: Prueba manual**

Sirve el sitio localmente y en `index.html`:
1. Toca "📊 Tu progreso" — el panel se expande mostrando el formulario de peso+estatura.
2. Guarda un peso y estatura válidos — el panel cambia a la vista de "peso de hoy" y el subtítulo de la tarjeta muestra el peso guardado.
3. Cambia el peso de hoy y guarda de nuevo — confirma que no se duplica el registro (revisa `localStorage.qg_weight_log` en devtools: debe seguir teniendo 1 solo elemento con la fecha de hoy).
4. Recarga la página — el panel debe abrir directo en la vista de datos (no en el formulario inicial) con el peso guardado.
5. Abre `correr.html` — su campo de peso debe mostrar el mismo valor guardado desde `index.html`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(progreso): add weight+height capture card to index.html"
```

---

### Task 4: Resumen de texto — cuánto ha bajado

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `WeightLog.weightChangeSummary`, `WeightLog.getGoal`, `WeightLog.progressStatus`, `WeightLog.todayStr` de Task 1.
- Produce (usado por Task 5): `fmtDate(dateStr)`.

- [ ] **Step 1: Agregar `renderSummary()` y engancharla en `renderProgress()`**

Ubicar (cierre de `renderProgress()` agregado en Task 3):
```javascript
  document.getElementById('progress-today-weight').value = last.weightKg;
}

renderProgress();
```
reemplazar por:
```javascript
  document.getElementById('progress-today-weight').value = last.weightKg;

  renderSummary(log);
}

function fmtDate(dateStr){
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}`;
}

function renderSummary(log){
  const s = WeightLog.weightChangeSummary(log);
  const el = document.getElementById('progress-summary');
  if(!s){ el.innerHTML = ''; return; }
  const verb = s.deltaKg >= 0 ? 'bajado' : 'subido';
  const abs = Math.abs(s.deltaKg);
  let html = `Has ${verb} ${abs.toFixed(1)} kg desde el ${fmtDate(s.startDate)} `+
    `(inicio: ${s.startWeight} kg → hoy: ${s.currentWeight} kg)`;

  const goal = WeightLog.getGoal();
  if(goal){
    const status = WeightLog.progressStatus(WeightLog.todayStr(), s.startDate, s.startWeight, goal.date, goal.weightKg, s.currentWeight);
    let line;
    if(status.phase === 'done'){
      line = status.met ? 'Meta cumplida 🎉' : `No se alcanzó la meta — te quedaste a ${status.diffKg.toFixed(1)} kg`;
    } else if(status.phase === 'ontrack'){
      line = 'Vas a tiempo';
    } else if(status.phase === 'ahead'){
      line = `Vas ${status.diffKg.toFixed(1)} kg adelantado`;
    } else {
      line = `Vas ${status.diffKg.toFixed(1)} kg atrasado respecto al plan`;
    }
    html += `<div class="status-line">${line}</div>`;
  }
  el.innerHTML = html;
}

renderProgress();
```

- [ ] **Step 2: Verificar sintaxis**

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

- [ ] **Step 3: Prueba manual**

En `index.html`, con al menos un registro de peso guardado (Task 3):
1. Abre el panel — debe verse `"Has bajado/subido X.X kg desde el DD/MM (inicio: Y kg → hoy: Z kg)"`.
2. Como todavía no hay UI para poner meta (llega en Task 5), simula una desde devtools: `WeightLog.saveGoal(WeightLog.getLatestWeight()-5, '2026-09-01')` y recarga — debe aparecer una segunda línea con "Vas a tiempo/adelantado/atrasado".
3. Quita la meta simulada: `WeightLog.clearGoal()` y recarga — la segunda línea debe desaparecer.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(progreso): show weight-change summary and goal status text"
```

---

### Task 5: Meta — poner, editar, quitar

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `WeightLog.getGoal`, `WeightLog.saveGoal`, `WeightLog.clearGoal` de Task 1; `fmtDate` de Task 4.

- [ ] **Step 1: Agregar `renderGoalLink()` y los manejadores de meta, engancharla en `renderProgress()`**

Ubicar (cierre de `renderProgress()` tras Task 4):
```javascript
  renderSummary(log);
}
```
reemplazar por:
```javascript
  renderSummary(log);
  renderGoalLink();
}

function renderGoalLink(){
  const link = document.getElementById('progress-goal-link');
  const goal = WeightLog.getGoal();
  const removeBtn = document.getElementById('progress-goal-remove');
  if(goal){
    link.textContent = `🎯 ${goal.weightKg}kg para ${fmtDate(goal.date)} · editar`;
    document.getElementById('progress-goal-weight').value = goal.weightKg;
    document.getElementById('progress-goal-date').value = goal.date;
    removeBtn.style.display = '';
  } else {
    link.textContent = '🎯 poner meta';
    removeBtn.style.display = 'none';
  }
}

function toggleGoalForm(){
  const form = document.getElementById('progress-goal-form');
  form.style.display = form.style.display === 'none' ? '' : 'none';
}

function saveGoalEntry(){
  const w = parseFloat(document.getElementById('progress-goal-weight').value);
  const d = document.getElementById('progress-goal-date').value;
  if(isNaN(w) || w<30 || w>300 || !d){
    alert('Ingresa un peso meta (30-300 kg) y una fecha válidos.');
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

- [ ] **Step 2: Verificar sintaxis**

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

- [ ] **Step 3: Prueba manual**

En `index.html`:
1. Con el panel abierto, toca "🎯 poner meta" — se abre el mini-formulario de peso meta + fecha.
2. Guarda una meta válida — el link cambia a "🎯 {peso}kg para {fecha} · editar" y aparece la línea de estatus en el resumen (Task 4).
3. Toca de nuevo el link — el formulario se abre con los valores ya cargados; cámbialos y guarda — confirma que se actualiza.
4. Toca "Quitar meta" — el link vuelve a "🎯 poner meta" y la línea de estatus desaparece del resumen.
5. Recarga la página con una meta puesta — confirma que persiste (link y línea de estatus siguen ahí).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(progreso): add goal set/edit/remove UI"
```

---

### Task 6: Gráfica SVG (real + teórica)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `WeightLog.todayStr`, `WeightLog.daysBetween`, `WeightLog.getGoal` de Task 1.

- [ ] **Step 1: Agregar `renderChart()` + `buildChartSvg()`, engancharla en `renderProgress()`**

Ubicar (cierre de `renderProgress()` tras Task 5):
```javascript
  renderSummary(log);
  renderGoalLink();
}
```
reemplazar por:
```javascript
  renderSummary(log);
  renderGoalLink();
  renderChart(log);
}

function renderChart(log){
  const wrap = document.getElementById('progress-chart-wrap');
  if(log.length < 2){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = buildChartSvg(log, WeightLog.getGoal());
}

function buildChartSvg(log, goal){
  const W = 280, H = 140, PAD = 8;
  const today = WeightLog.todayStr();
  const firstDate = log[0].date;
  let lastDate = log[log.length-1].date;
  if(goal && goal.date > lastDate) lastDate = goal.date;
  if(today > lastDate) lastDate = today;

  const weights = log.map(e=>e.weightKg);
  if(goal) weights.push(goal.weightKg);
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const span = Math.max(0.5, maxW - minW);
  const yMin = minW - span*0.1, yMax = maxW + span*0.1;
  const totalDays = Math.max(1, WeightLog.daysBetween(firstDate, lastDate));

  const xScale = dateStr => PAD + (WeightLog.daysBetween(firstDate, dateStr)/totalDays) * (W - PAD*2);
  const yScale = w => H - PAD - ((w - yMin)/(yMax - yMin)) * (H - PAD*2);

  const realPts = log.map(e => `${xScale(e.date).toFixed(1)},${yScale(e.weightKg).toFixed(1)}`).join(' ');
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<polyline points="${realPts}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  if(goal){
    const gx1 = xScale(firstDate).toFixed(1), gy1 = yScale(log[0].weightKg).toFixed(1);
    const gx2 = xScale(goal.date).toFixed(1), gy2 = yScale(goal.weightKg).toFixed(1);
    svg += `<line x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  svg += `<text x="${PAD}" y="10" font-size="8" fill="var(--muted)">${yMax.toFixed(1)} kg</text>`;
  svg += `<text x="${PAD}" y="${H-2}" font-size="8" fill="var(--muted)">${yMin.toFixed(1)} kg</text>`;
  svg += `</svg>`;
  return svg;
}
```

- [ ] **Step 2: Verificar sintaxis**

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

- [ ] **Step 3: Prueba manual**

En `index.html`, con solo 1 registro de peso, la gráfica no debe aparecer (menos de 2 puntos). Para probar la gráfica con varios puntos, simula historial desde devtools:
```js
localStorage.setItem('qg_weight_log', JSON.stringify([
  {date:'2026-08-01',weightKg:90},{date:'2026-08-08',weightKg:88.5},
  {date:'2026-08-15',weightKg:87},{date:'2026-08-22',weightKg:85.5}
]));
WeightLog.saveGoal(80, '2026-10-01');
```
Recarga y abre el panel:
1. Debe aparecer la gráfica con la línea real (sólida, color acento) bajando de 90 a 85.5 kg.
2. Debe aparecer la línea teórica punteada desde el primer punto hasta el punto meta.
3. Prueba también sin meta (`WeightLog.clearGoal()` y recarga) — solo debe verse la línea real, sin la punteada.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(progreso): add SVG chart with real and theoretical weight lines"
```

---

### Task 7: Badge de IMC

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `WeightLog.getHeightCm`, `WeightLog.bmiValue`, `WeightLog.bmiBand` de Task 1.

- [ ] **Step 1: Agregar `renderBmi()`, engancharla en `renderProgress()`**

Ubicar (cierre de `renderProgress()` tras Task 6):
```javascript
  renderSummary(log);
  renderGoalLink();
  renderChart(log);
}
```
reemplazar por:
```javascript
  renderSummary(log);
  renderGoalLink();
  renderChart(log);
  renderBmi(last.weightKg);
}

function renderBmi(weightKg){
  const el = document.getElementById('progress-bmi');
  const heightCm = WeightLog.getHeightCm();
  if(!heightCm){ el.style.display = 'none'; return; }
  const bmi = WeightLog.bmiValue(weightKg, heightCm);
  const band = WeightLog.bmiBand(bmi);
  el.style.display = 'flex';
  el.innerHTML = `<span class="bmi-dot" style="background:${band.color}"></span> IMC ${bmi} · ${band.label}`;
}
```

- [ ] **Step 2: Verificar sintaxis**

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

- [ ] **Step 3: Prueba manual**

En `index.html`, si registraste peso+estatura en el flujo normal (Task 3), el badge de IMC debe aparecer automáticamente con el color y etiqueta correctos para tu IMC actual. Prueba las 4 bandas simulando estatura/peso desde devtools, ej.:
```js
WeightLog.saveHeightCm(170); WeightLog.saveTodayWeight(50);  // 🔵 Bajo peso
WeightLog.saveHeightCm(170); WeightLog.saveTodayWeight(65);  // 🟢 Normal
WeightLog.saveHeightCm(170); WeightLog.saveTodayWeight(78);  // 🟠 Sobrepeso
WeightLog.saveHeightCm(170); WeightLog.saveTodayWeight(95);  // 🔴 Obesidad
```
(recarga tras cada cambio) y confirma color+etiqueta correctos en cada caso. Sin estatura guardada (`WeightLog.saveHeightCm` nunca llamado en un perfil nuevo), el badge no debe mostrarse.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(progreso): add BMI badge with WHO color bands"
```

---

### Task 8: Verificación end-to-end y push

**Files:** ninguno (solo verificación manual + push).

- [ ] **Step 1: Flujo completo en `index.html`**

Sirve el sitio localmente y, empezando desde cero (`localStorage.clear()`):
1. Abre "📊 Tu progreso", registra peso+estatura — panel cambia a vista de datos, badge de IMC aparece.
2. Registra un par de días más (cambiando la fecha del sistema no es viable en navegador normal — usa el truco de devtools de la Task 6 para simular varios días con pesos decrecientes).
3. Pon una meta con fecha futura — confirma recta teórica en la gráfica y línea de estatus en el resumen.
4. Recarga la página — todo debe persistir igual (peso, estatura, meta, gráfica, badge).

- [ ] **Step 2: Confirmar que no se rompió nada existente**

1. En `correr.html`: confirma que el peso mostrado coincide con el de `index.html`, que se puede editar, y que el cálculo de kcal al terminar una sesión sigue funcionando.
2. En `index.html`: confirma que el ripple de zonas vacías (feature previa) y los easter eggs del 🔥 y del modo arcoíris siguen funcionando sin interferencia de la tarjeta nueva.

- [ ] **Step 3: Push y confirmar en vivo**

```bash
git push
```

Espera ~1 minuto y repite la prueba del Step 1 contra `https://pacoalvarezvivaldo-collab.github.io/quemagrasa/index.html` para confirmar que el CSP en producción no bloquea nada (esta feature no agrega dominios nuevos al CSP, así que no debería haber sorpresas, pero se confirma igual siguiendo la práctica ya establecida en este proyecto).
