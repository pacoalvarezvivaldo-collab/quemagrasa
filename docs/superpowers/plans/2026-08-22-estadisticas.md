# Estadísticas globales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página nueva `estadisticas.html` que muestra totales/conteos de los 5 modos de entrenamiento, leyendo directamente de las llaves de `localStorage` que cada uno ya escribe hoy — sin agregar tracking nuevo a ningún modo existente.

**Architecture:** `estadisticas.html` es una página de solo lectura, sin JS compartido nuevo (salvo cargar `streak.js` ya existente para la racha actual). Su propio `<script>` inline calcula sumas/conteos a partir de los arrays que ya guardan `correr.html` y `cardio.html`, y de los sets de días completados que guardan `entrenamientos.html`/`gimnasio.html` (vía `plan-engine.js`). No escribe nada a `localStorage`, no engancha nada en los 5 modos.

**Tech Stack:** HTML/CSS/JS puro (sin build), Node.js solo para verificación (`node --check`, scripts de assert).

## Global Constraints

- Sin inventar un "total kcal" unificado falso — cada bloque muestra solo lo que su modo realmente guarda hoy (decisión explícita del usuario, ver spec).
- Fuentes de datos (todas ya existentes, ninguna se crea aquí):
  - `qg_activity_log` (de `streak.js`) → días únicos entrenados + racha actual (`Streak.getCurrentStreak()`).
  - `correr_history` → sesiones, km totales (suma `distanceM`/1000), kcal totales (suma `kcal`).
  - `qg_history` (cardio, comparte llave entre Elíptica/Caminadora/Escaladora) → sesiones, kcal totales, sprints totales (suma `spr`).
  - `ent_level` / `ent_completed` → nivel actual de Casa + días completados de 30.
  - `gym_level` / `gym_completed` → igual para Gimnasio.
  - Ejercicio rápido no persiste nada — su bloque siempre muestra "Sin datos guardados aún".
- Con `localStorage` vacío o llaves faltantes, cada bloque debe degradarse con gracia (0 sesiones, 0 km, etc.) sin lanzar errores.
- Sin dominios nuevos en el CSP — solo lectura de `localStorage`, sin red.
- Spec completo: `docs/superpowers/specs/2026-08-22-estadisticas-design.md`.

---

### Task 1: Crear `estadisticas.html`

**Files:**
- Create: `estadisticas.html`

- [ ] **Step 1: Escribir `estadisticas.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Estadísticas">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0d0d0f">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
<title>Estadísticas · Quemagrasa</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0d0d0f; --surface:#18181c; --surface2:#222228;
  --border:rgba(255,255,255,0.08); --text:#f0efe8; --muted:#777;
  --accent:#EF9F27; --accent-text:#000;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bot: env(safe-area-inset-bottom, 0px);
}
html, body { height:100%; background:var(--bg); overscroll-behavior:none; }
body { color:var(--text); font-family:'Syne',sans-serif; padding-top:var(--safe-top);
  -webkit-user-select:none; user-select:none; touch-action:manipulation; }

.topbar { display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px 9px 18px; border-bottom:1px solid var(--border); }
.topbar-title { font-size:13px; font-weight:800; letter-spacing:.03em; }
.gear-btn { background:var(--surface2); border:1px solid var(--border); color:var(--text);
  width:34px; height:34px; border-radius:10px; font-size:15px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; text-decoration:none;
  -webkit-tap-highlight-color:transparent; }

.wrap { max-width:480px; margin:0 auto; padding:20px calc(20px + env(safe-area-inset-right,0px)) calc(24px + var(--safe-bot)); }

.stat-card { background:var(--surface); border:1.5px solid var(--border); border-radius:14px;
  padding:16px; margin-bottom:10px; }
.stat-card-title { font-weight:800; font-size:14px; display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.stat-row { display:flex; justify-content:space-between; align-items:baseline; padding:4px 0; font-size:13px; }
.stat-row .stat-label { color:var(--muted); }
.stat-row .stat-value { font-family:'Space Mono',monospace; font-weight:700; }
.stat-line { color:var(--muted); font-size:13px; padding:4px 0; }
.stat-empty { color:var(--muted); font-size:12.5px; }
</style>
</head>
<body>

<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">📈 Estadísticas</span>
  <span style="width:34px"></span>
</div>

<div class="wrap">
  <div class="stat-card">
    <div class="stat-card-title">📊 Resumen general</div>
    <div class="stat-line" id="stat-total-days"></div>
    <div class="stat-line" id="stat-current-streak"></div>
  </div>

  <div class="stat-card">
    <div class="stat-card-title">🏃‍♂️ Correr / Caminar</div>
    <div class="stat-row"><span class="stat-label">Sesiones</span><span class="stat-value" id="correr-sesiones"></span></div>
    <div class="stat-row"><span class="stat-label">Distancia total</span><span class="stat-value" id="correr-km"></span></div>
    <div class="stat-row"><span class="stat-label">Kcal quemadas</span><span class="stat-value" id="correr-kcal"></span></div>
  </div>

  <div class="stat-card">
    <div class="stat-card-title">🌀 Cardio (Elíptica · Caminadora · Escaladora)</div>
    <div class="stat-row"><span class="stat-label">Sesiones</span><span class="stat-value" id="cardio-sesiones"></span></div>
    <div class="stat-row"><span class="stat-label">Kcal quemadas</span><span class="stat-value" id="cardio-kcal"></span></div>
    <div class="stat-row"><span class="stat-label">Sprints totales</span><span class="stat-value" id="cardio-sprints"></span></div>
  </div>

  <div class="stat-card">
    <div class="stat-card-title">🏠 Casa</div>
    <div class="stat-row"><span class="stat-label">Nivel</span><span class="stat-value" id="casa-level"></span></div>
    <div class="stat-line" id="casa-days"></div>
  </div>

  <div class="stat-card">
    <div class="stat-card-title">🏢 Gimnasio</div>
    <div class="stat-row"><span class="stat-label">Nivel</span><span class="stat-value" id="gimnasio-level"></span></div>
    <div class="stat-line" id="gimnasio-days"></div>
  </div>

  <div class="stat-card">
    <div class="stat-card-title">⚡ Ejercicio rápido</div>
    <div class="stat-empty">Sin datos guardados aún</div>
  </div>
</div>

<script src="streak.js"></script>
<script>
/* =====================================================================
   estadisticas.html — vista de solo lectura: junta totales de los 5
   modos de entrenamiento leyendo directo de las llaves de localStorage
   que cada uno ya escribe. No engancha nada nuevo, no escribe nada.
   Ver docs/superpowers/specs/2026-08-22-estadisticas-design.md
   ===================================================================== */

/* ---------- lógica pura (testeable sin red/DOM) ---------- */
function uniqueDayCount(activityLog){
  return new Set(activityLog).size;
}

function sumCorrer(history){
  return history.reduce((acc, e) => {
    acc.sesiones++;
    acc.km += (e.distanceM || 0) / 1000;
    acc.kcal += (e.kcal || 0);
    return acc;
  }, { sesiones: 0, km: 0, kcal: 0 });
}

function sumCardio(sessions){
  return sessions.reduce((acc, s) => {
    acc.sesiones++;
    acc.kcal += (s.kcal || 0);
    acc.sprints += (s.spr || 0);
    return acc;
  }, { sesiones: 0, kcal: 0, sprints: 0 });
}
/* ---------- fin lógica pura ---------- */

const LEVEL_LABELS = {
  facil:     { label:'Fácil',     icon:'🌱' },
  medio:     { label:'Medio',     icon:'🔥' },
  dificil:   { label:'Difícil',   icon:'💥' },
  espartano: { label:'Espartano', icon:'⚔️' }
};

function readJSON(key){
  try{ return JSON.parse(localStorage.getItem(key)) || []; }catch(e){ return []; }
}

function renderSummary(){
  const log = readJSON('qg_activity_log');
  const days = uniqueDayCount(log);
  document.getElementById('stat-total-days').textContent = `${days} día${days===1?'':'s'} entrenados en total`;
  const streak = window.Streak ? Streak.getCurrentStreak() : 0;
  document.getElementById('stat-current-streak').textContent =
    streak > 0 ? `🔥 ${streak} día${streak===1?'':'s'} seguido${streak===1?'':'s'}` : 'Sin racha activa';
}

function renderCorrer(){
  const s = sumCorrer(readJSON('correr_history'));
  document.getElementById('correr-sesiones').textContent = s.sesiones;
  document.getElementById('correr-km').textContent = s.km.toFixed(1) + ' km';
  document.getElementById('correr-kcal').textContent = Math.round(s.kcal) + ' kcal';
}

function renderCardio(){
  const s = sumCardio(readJSON('qg_history'));
  document.getElementById('cardio-sesiones').textContent = s.sesiones;
  document.getElementById('cardio-kcal').textContent = Math.round(s.kcal) + ' kcal';
  document.getElementById('cardio-sprints').textContent = s.sprints;
}

function renderPlan(prefix, levelElId, daysElId){
  let level = null;
  try{ level = localStorage.getItem(prefix + 'level'); }catch(e){}
  const completed = readJSON(prefix + 'completed');
  const info = LEVEL_LABELS[level];
  document.getElementById(levelElId).textContent = info ? `${info.icon} ${info.label}` : 'Sin nivel elegido';
  document.getElementById(daysElId).textContent = `${completed.length}/30 días completados`;
}

renderSummary();
renderCorrer();
renderCardio();
renderPlan('ent_', 'casa-level', 'casa-days');
renderPlan('gym_', 'gimnasio-level', 'gimnasio-days');
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('estadisticas.html','utf8');
const body=src.slice(src.lastIndexOf('<script>')+8, src.lastIndexOf('</script>'));
fs.writeFileSync('.syntax-check.js', body);
"
node --check .syntax-check.js
rm -f .syntax-check.js
```
Expected: sin salida (exit code 0).

- [ ] **Step 3: Assert-based check de la lógica pura**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('estadisticas.html','utf8');
const scriptStart = src.lastIndexOf('<script>')+8;
const scriptEnd = src.lastIndexOf('</script>');
const scriptBody = src.slice(scriptStart, scriptEnd);
const start = scriptBody.indexOf('/* ---------- lógica pura');
const end = scriptBody.indexOf('/* ---------- fin lógica pura ---------- */');
const pureCode = scriptBody.slice(start, end);
const test = pureCode+\`
console.assert(uniqueDayCount([])===0, 'sin fechas debe dar 0');
console.assert(uniqueDayCount(['2026-08-20','2026-08-21'])===2, 'dos fechas distintas debe dar 2');
console.assert(uniqueDayCount(['2026-08-20','2026-08-20'])===1, 'fechas duplicadas no deben inflar el conteo');

const emptyCorrer = sumCorrer([]);
console.assert(emptyCorrer.sesiones===0 && emptyCorrer.km===0 && emptyCorrer.kcal===0, 'historial vacío de correr debe dar todo en 0');

const correrData = sumCorrer([
  {distanceM:5000, kcal:300},
  {distanceM:3000, kcal:180}
]);
console.assert(correrData.sesiones===2, 'debe contar 2 sesiones, dio '+correrData.sesiones);
console.assert(correrData.km===8, 'debe sumar 8 km (5000+3000 metros), dio '+correrData.km);
console.assert(correrData.kcal===480, 'debe sumar 480 kcal, dio '+correrData.kcal);

const emptyCardio = sumCardio([]);
console.assert(emptyCardio.sesiones===0 && emptyCardio.kcal===0 && emptyCardio.sprints===0, 'historial vacío de cardio debe dar todo en 0');

const cardioData = sumCardio([
  {kcal:120, spr:4},
  {kcal:150, spr:6}
]);
console.assert(cardioData.sesiones===2, 'debe contar 2 sesiones, dio '+cardioData.sesiones);
console.assert(cardioData.kcal===270, 'debe sumar 270 kcal, dio '+cardioData.kcal);
console.assert(cardioData.sprints===10, 'debe sumar 10 sprints, dio '+cardioData.sprints);

console.log('OK estadisticas pure logic');
\`;
fs.writeFileSync('.stats-check.js', test);
"
node .stats-check.js
rm -f .stats-check.js
```
Expected output: `OK estadisticas pure logic` y ninguna línea `Assertion failed`.

- [ ] **Step 4: Commit**

```bash
git add estadisticas.html
git commit -m "feat(estadisticas): add estadisticas.html — read-only totals across the 5 training modes"
```

---

### Task 2: Enlazar tarjeta desde `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Agregar la tarjeta**

Ubicar:
```html
    <a class="mode-row" href="correr.html">
      <span class="mode-icon">🏃‍♂️</span>
      <span class="mode-text"><span class="mode-name">Correr / Caminar</span><span class="mode-sub">GPS · ruta · pasos</span></span>
      <span class="mode-chevron">›</span>
    </a>
  </div>
</div>
```
reemplazar por:
```html
    <a class="mode-row" href="correr.html">
      <span class="mode-icon">🏃‍♂️</span>
      <span class="mode-text"><span class="mode-name">Correr / Caminar</span><span class="mode-sub">GPS · ruta · pasos</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="estadisticas.html">
      <span class="mode-icon">📈</span>
      <span class="mode-text"><span class="mode-name">Estadísticas</span><span class="mode-sub">Totales de los 5 modos</span></span>
      <span class="mode-chevron">›</span>
    </a>
  </div>
</div>
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

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(estadisticas): link Estadísticas card from the home screen"
```

---

### Task 3: Verificación end-to-end y push

**Files:** ninguno (solo verificación manual + push).

- [ ] **Step 1: Prueba con datos vacíos**

Sirve el sitio localmente y, con `localStorage.clear()`, abre `estadisticas.html`:
1. Confirma que cada tarjeta se degrada con gracia: "0 días entrenados en total", "Sin racha activa", 0 sesiones / 0.0 km / 0 kcal en Correr, 0 sesiones / 0 kcal / 0 sprints en Cardio, "Sin nivel elegido" + "0/30 días completados" en Casa y Gimnasio, "Sin datos guardados aún" en Ejercicio rápido.
2. Confirma 0 errores de consola.

- [ ] **Step 2: Prueba con datos reales/simulados**

Simula datos desde devtools (o genera datos reales usando la app) y confirma que cada tarjeta refleja los números correctos:
```js
localStorage.setItem('qg_activity_log', JSON.stringify(['2026-08-20','2026-08-21','2026-08-22']));
localStorage.setItem('correr_history', JSON.stringify([
  {date:Date.now(), mode:'correr', distanceM:5000, elapsedS:1800, steps:6500, kcal:320}
]));
localStorage.setItem('qg_history', JSON.stringify([
  {d:'2026-08-20', min:20, lvl:'medio', mac:'eliptica', kcal:180, spr:5}
]));
localStorage.setItem('ent_level', 'medio');
localStorage.setItem('ent_completed', JSON.stringify([1,2,3]));
```
Recarga `estadisticas.html` y confirma: 3 días entrenados, racha acorde a esas fechas, Correr con 1 sesión/5.0 km/320 kcal, Cardio con 1 sesión/180 kcal/5 sprints, Casa con 🔥 Medio y 3/30 días completados, Gimnasio con "Sin nivel elegido" y "0/30 días completados" (sin datos `gym_*` en este ejemplo).

- [ ] **Step 3: Confirmar la tarjeta de enlace en `index.html`**

Confirma que la tarjeta "📈 Estadísticas" aparece al final de la lista de modos y navega correctamente a `estadisticas.html`, y que el botón "←" de `estadisticas.html` regresa a `index.html`.

- [ ] **Step 4: Push y confirmar en vivo**

```bash
git push
```

Espera a que se despliegue GitHub Pages y repite una prueba corta contra `https://pacoalvarezvivaldo-collab.github.io/quemagrasa/estadisticas.html` para confirmar que no hay sorpresas de CSP en producción (esta feature no agrega dominios nuevos, pero se confirma igual siguiendo la práctica ya establecida en este proyecto).
