# Rediseño SPORTIUUM (marca, nav inferior, anillo en Rápido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una barra de navegación inferior compartida (`nav.js`, 5 tabs), una página nueva `entrenar.html` que agrupa Casa/Gimnasio/Rápido, un anillo circular de progreso en la pantalla de entrenamiento de `rapido.html`, y el logomark de marca en `index.html` — sin tocar la lógica de negocio existente (WeightLog, Streak, Prefs, `tick()` de Rápido, etc.).

**Architecture:** `nav.js` es un módulo nuevo sin build, mismo patrón que `prefs.js`/`streak.js` (IIFE, `window.Nav`, sin conocimiento de Supabase). Expone `Nav.render(activeKey)` (crea la barra la primera vez, la muestra, resalta la tab activa) y `Nav.hide()` (la oculta durante una sesión de entrenamiento activa). Cada página llama `Nav.render()`/`Nav.hide()` en los mismos puntos donde ya controla sus propias pantallas — en `rapido.html` y `correr.html`, dentro de su función `showScreen()` ya existente; en `cardio.html`, dentro de `openGym()`/`closeGym()`; en el resto, una sola vez al cargar.

**Tech Stack:** JS vanilla, sin build, mismo stack que el resto de la app.

## Global Constraints

- Las 8 páginas HTML **ya cargan** Space Mono + Syne (`<link href="https://fonts.googleapis.com/css2?family=Space+Mono...">`, verificado en las 8) — la spec mencionaba agregarlas a 7 páginas, pero es innecesario: no hay ningún cambio de tipografía que hacer en este plan.
- **Corrección de alcance frente a la spec, documentada aquí:** además de las tarjetas Casa/Gimnasio/Rápido y los modos de cardio, `index.html` también quita las filas "Estadísticas" y "Ajustes" de su lista — quedan cubiertas por los tabs Progreso/Ajustes de `nav.js`, la misma razón por la que se quitan las demás filas. La spec no las mencionó explícitamente; se incluyen aquí por consistencia con el resto del cambio.
- Los 5 iconos SVG de `nav.js` son una copia literal (mismo `viewBox="0 0 22 22"`, mismos `<polygon>`/`<rect>`/`<circle>`) de los del mockup `SPORTIUUM Rediseño.dc.html` — no se dibuja nada nuevo.
- `nav.js` nunca lee ni escribe `localStorage` — no tiene preferencia propia que persistir, es puro DOM.
- Cada archivo modificado se verifica con `node --check` (para `.js`) o extrayendo su `<script>` inline a un archivo temporal en el scratchpad y corriendo `node --check` sobre él (para `.html`) — mismo patrón que el resto de los planes de este repo.
- Spec de referencia: `docs/superpowers/specs/2026-09-02-rediseno-sportiuum-design.md`.

---

### Task 1: Crear `nav.js`

**Files:**
- Create: `nav.js`

**Interfaces:**
- Produces: `window.Nav.render(activeKey)`, `window.Nav.hide()`, `window.Nav.activeKeyForPath(pathname)` — usados por todas las tareas siguientes.

- [ ] **Step 1: Crear el archivo**

Crear `nav.js` en la raíz del repo (junto a `prefs.js`) con este contenido:

```js
/* =====================================================================
   nav.js — barra de navegación inferior compartida: Inicio / Entrenar /
   Cardio / Progreso / Ajustes. Mismo patrón que prefs.js/streak.js: sin
   build, sin conocimiento de Supabase ni de localStorage — puro DOM.
   Cada página llama Nav.render('<key>') en sus pantallas de selección y
   Nav.hide() en su pantalla de sesión activa (ver
   docs/superpowers/specs/2026-09-02-rediseno-sportiuum-design.md).
   ===================================================================== */
(function(){

const TABS = [
  { key:'inicio', label:'Inicio', href:'index.html',
    icon:'<polygon points="11,2 21,10 17,10 17,20 5,20 5,10 1,10"></polygon>' },
  { key:'entrenar', label:'Entrenar', href:'entrenar.html',
    icon:'<rect x="1" y="7" width="4" height="8" rx="1.2"></rect><rect x="17" y="7" width="4" height="8" rx="1.2"></rect><rect x="5" y="9" width="12" height="4"></rect>' },
  { key:'cardio', label:'Cardio', href:'cardio.html',
    icon:'<circle cx="11" cy="11" r="9"></circle><circle cx="11" cy="11" r="3.6" fill="var(--bg)"></circle>' },
  { key:'progreso', label:'Progreso', href:'estadisticas.html',
    icon:'<rect x="2" y="12" width="4" height="8"></rect><rect x="9" y="7" width="4" height="13"></rect><rect x="16" y="2" width="4" height="18"></rect>' },
  { key:'ajustes', label:'Ajustes', href:'ajustes.html',
    icon:'<circle cx="11" cy="11" r="8"></circle><circle cx="11" cy="11" r="3" fill="var(--bg)"></circle><rect x="9.5" y="0" width="3" height="4"></rect><rect x="9.5" y="18" width="3" height="4"></rect><rect x="0" y="9.5" width="4" height="3"></rect><rect x="18" y="9.5" width="4" height="3"></rect>' }
];

const STYLE = `
#sp-nav{ position:fixed; left:0; right:0; bottom:0; display:flex; z-index:80;
  background:var(--bg); border-top:1px solid var(--border);
  padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px)); }
#sp-nav a{ flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
  padding:5px 0 3px; text-decoration:none; -webkit-tap-highlight-color:transparent; }
#sp-nav svg{ display:block; }
#sp-nav .sp-nav-label{ font-family:'Syne',sans-serif; font-size:9.5px; font-weight:700; letter-spacing:.02em; }
#sp-nav .sp-nav-dot{ width:14px; height:2px; border-radius:2px; margin-top:2px; background:var(--accent); }
`;

const NAV_PADDING = 'calc(64px + env(safe-area-inset-bottom, 0px))';

function ensureBar(){
  if(document.getElementById('sp-nav')) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const bar = document.createElement('nav');
  bar.id = 'sp-nav';
  bar.innerHTML = TABS.map(t => `
    <a href="${t.href}" data-key="${t.key}">
      <svg width="21" height="21" viewBox="0 0 22 22" fill="var(--muted)">${t.icon}</svg>
      <span class="sp-nav-label" style="color:var(--muted)">${t.label}</span>
      <span class="sp-nav-dot" style="opacity:0"></span>
    </a>`).join('');
  document.body.appendChild(bar);
}

function setActive(activeKey){
  document.querySelectorAll('#sp-nav a').forEach(a=>{
    const on = a.dataset.key === activeKey;
    a.querySelector('svg').setAttribute('fill', on ? 'var(--accent)' : 'var(--muted)');
    a.querySelector('.sp-nav-label').style.color = on ? 'var(--accent)' : 'var(--muted)';
    a.querySelector('.sp-nav-dot').style.opacity = on ? '1' : '0';
  });
}

function render(activeKey){
  ensureBar();
  document.getElementById('sp-nav').style.display = 'flex';
  document.body.style.paddingBottom = NAV_PADDING;
  setActive(activeKey);
}

function hide(){
  const bar = document.getElementById('sp-nav');
  if(bar) bar.style.display = 'none';
  document.body.style.paddingBottom = '';
}

/* ---------- lógica pura (testeable sin DOM) ---------- */
function activeKeyForPath(pathname){
  const file = (pathname.split('/').pop()) || 'index.html';
  const MAP = {
    'index.html':'inicio',
    'entrenar.html':'entrenar', 'entrenamientos.html':'entrenar', 'gimnasio.html':'entrenar', 'rapido.html':'entrenar',
    'cardio.html':'cardio', 'correr.html':'cardio',
    'estadisticas.html':'progreso',
    'ajustes.html':'ajustes'
  };
  return MAP[file] || null;
}
/* ---------- fin lógica pura ---------- */

window.Nav = { render, hide, activeKeyForPath };
})();
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check "D:\Empresa\Programas\APP EJERCICIOS\quemagrasa\nav.js"`
Expected: sin salida.

- [ ] **Step 3: Assert-based check de `activeKeyForPath`**

Escribir en el scratchpad (`.../scratchpad/nav-active-key-smoke.js`):

```js
const assert = require('assert');

function activeKeyForPath(pathname){
  const file = (pathname.split('/').pop()) || 'index.html';
  const MAP = {
    'index.html':'inicio',
    'entrenar.html':'entrenar', 'entrenamientos.html':'entrenar', 'gimnasio.html':'entrenar', 'rapido.html':'entrenar',
    'cardio.html':'cardio', 'correr.html':'cardio',
    'estadisticas.html':'progreso',
    'ajustes.html':'ajustes'
  };
  return MAP[file] || null;
}

assert.strictEqual(activeKeyForPath('/app/index.html'), 'inicio');
assert.strictEqual(activeKeyForPath('/app/entrenar.html'), 'entrenar');
assert.strictEqual(activeKeyForPath('/app/entrenamientos.html'), 'entrenar');
assert.strictEqual(activeKeyForPath('/app/gimnasio.html'), 'entrenar');
assert.strictEqual(activeKeyForPath('/app/rapido.html'), 'entrenar');
assert.strictEqual(activeKeyForPath('/app/cardio.html'), 'cardio');
assert.strictEqual(activeKeyForPath('/app/correr.html'), 'cardio');
assert.strictEqual(activeKeyForPath('/app/estadisticas.html'), 'progreso');
assert.strictEqual(activeKeyForPath('/app/ajustes.html'), 'ajustes');
assert.strictEqual(activeKeyForPath('/app/nope.html'), null);

console.log('nav activeKeyForPath logic OK');
```

Run: `node nav-active-key-smoke.js` (desde el scratchpad)
Expected: `nav activeKeyForPath logic OK`

- [ ] **Step 4: Commit**

```bash
git add nav.js
git commit -m "feat(nav): add shared bottom nav module"
```

---

### Task 2: Crear `entrenar.html`

**Files:**
- Create: `entrenar.html`

**Interfaces:**
- Consumes: `Prefs.applyThemeIfSet()`, `Prefs.applyRainbowIfOn()`, `Prefs.maybeRequestFullscreen()` (de `prefs.js`), `Nav.render('entrenar')` (de `nav.js`, Task 1).

- [ ] **Step 1: Crear el archivo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Entrenar">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0d0d0f">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';">
<title>Entrenar · SPORTIUUM</title>
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

.mode-list { display:flex; flex-direction:column; gap:8px; }
.mode-row { display:flex; align-items:center; gap:14px; width:100%; background:var(--surface);
  border:1.5px solid var(--border); border-radius:14px; padding:14px 16px; text-align:left;
  cursor:pointer; color:var(--text); text-decoration:none; font-family:'Syne',sans-serif;
  -webkit-tap-highlight-color:transparent; transition:border-color .15s; }
.mode-row:active { border-color:var(--accent); }
.mode-row .mode-icon { font-size:23px; flex-shrink:0; width:30px; text-align:center; }
.mode-row .mode-text { flex:1; min-width:0; }
.mode-row .mode-name { font-weight:800; font-size:15px; display:block; }
.mode-row .mode-sub { font-size:11px; color:var(--muted); margin-top:2px; display:block; }
.mode-row .mode-chevron { color:var(--muted); font-size:15px; flex-shrink:0; }
.mode-row.accent { border-color:var(--accent); background:var(--surface2); }
.mode-row.accent .mode-sub { color:var(--accent); }
</style>
</head>
<body>

<div class="topbar">
  <a class="gear-btn" href="index.html" title="Volver al inicio">←</a>
  <span class="topbar-title">🏋️ Entrenar</span>
  <span style="width:34px"></span>
</div>

<div class="wrap">
  <div class="mode-list">
    <a class="mode-row" href="entrenamientos.html">
      <span class="mode-icon">🏠</span>
      <span class="mode-text"><span class="mode-name">Casa</span><span class="mode-sub">Plan de 30 días</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="gimnasio.html">
      <span class="mode-icon">🏢</span>
      <span class="mode-text"><span class="mode-name">Gimnasio</span><span class="mode-sub">Plan de 30 días · con equipo</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row accent" href="rapido.html">
      <span class="mode-icon">⚡</span>
      <span class="mode-text"><span class="mode-name">Ejercicio rápido</span><span class="mode-sub">10 min · 8 ejercicios al azar</span></span>
      <span class="mode-chevron">›</span>
    </a>
  </div>
</div>

<script src="prefs.js"></script>
<script src="nav.js"></script>
<script>
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('entrenar');
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar sintaxis del `<script>` inline**

Extraer el `<script>` inline (todo lo que está entre `<script>` y `</script>`, sin las dos líneas `<script src=...>`) a `.../scratchpad/entrenar-inline.js` y correr:

Run: `node --check ".../scratchpad/entrenar-inline.js"`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add entrenar.html
git commit -m "feat(entrenar): add training mode chooser page (Casa/Gimnasio/Rápido)"
```

---

### Task 3: `index.html` — recortar la lista, agregar logomark y nav

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `Nav.render('inicio')` (Task 1).

- [ ] **Step 1: Agregar CSS del logomark**

En `index.html`, ubicar:
```css
.hero { text-align:center; margin-bottom:26px; }
```
reemplazar por:
```css
.hero-mark { width:40px; height:40px; border-radius:12px; background:var(--accent); position:relative;
  margin:0 auto 10px; overflow:hidden; }
.hero-mark i { position:absolute; left:8px; width:24px; height:6px; background:var(--accent-text); transform:skewX(-24deg); }
.hero-mark i:nth-child(1) { top:9px; }
.hero-mark i:nth-child(2) { top:17px; width:8px; }
.hero-mark i:nth-child(3) { top:17px; left:24px; width:8px; }
.hero-mark i:nth-child(4) { top:25px; }
.hero { text-align:center; margin-bottom:26px; }
```

- [ ] **Step 2: Agregar el logomark al header**

Ubicar:
```html
  <div class="hero">
    <div class="hero-title"><span class="flame" id="flame">🔥</span> SPORTIUUM</div>
```
reemplazar por:
```html
  <div class="hero">
    <div class="hero-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="hero-title"><span class="flame" id="flame">🔥</span> SPORTIUUM</div>
```

- [ ] **Step 3: Quitar Casa/Gimnasio/modos de cardio/Estadísticas/Ajustes de la lista**

Ubicar (bloque completo, desde la tarjeta "Casa" hasta la tarjeta "Ajustes"):
```html
    <a class="mode-row" href="entrenamientos.html">
      <span class="mode-icon">🏠</span>
      <span class="mode-text"><span class="mode-name">Casa</span><span class="mode-sub">Plan de 30 días</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="gimnasio.html">
      <span class="mode-icon">🏢</span>
      <span class="mode-text"><span class="mode-name">Gimnasio</span><span class="mode-sub">Plan de 30 días · con equipo</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row accent" href="rapido.html">
      <span class="mode-icon">⚡</span>
      <span class="mode-text"><span class="mode-name">Ejercicio rápido</span><span class="mode-sub">10 min · 8 ejercicios al azar</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <div class="section-label">Cardio</div>
    <a class="mode-row" href="cardio.html?m=eliptica">
      <span class="mode-icon">🌀</span>
      <span class="mode-text"><span class="mode-name">Elíptica</span><span class="mode-sub">Timer HIIT</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="cardio.html?m=caminadora">
      <span class="mode-icon">🏃</span>
      <span class="mode-text"><span class="mode-name">Caminadora</span><span class="mode-sub">Timer HIIT · de gimnasio</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="cardio.html?m=caminadora_casa">
      <span class="mode-icon">🏠</span>
      <span class="mode-text"><span class="mode-name">Caminadora en Casa</span><span class="mode-sub">Timer HIIT · para la de casa, no de gimnasio</span></span>
      <span class="mode-chevron">›</span>
    </a>
    <a class="mode-row" href="cardio.html?m=escaladora">
      <span class="mode-icon">🪜</span>
      <span class="mode-text"><span class="mode-name">Escaladora</span><span class="mode-sub">Timer HIIT</span></span>
      <span class="mode-chevron">›</span>
    </a>
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
    <a class="mode-row" href="ajustes.html">
      <span class="mode-icon">⚙️</span>
      <span class="mode-text"><span class="mode-name">Ajustes</span><span class="mode-sub">Sonido, pantalla, color</span></span>
      <span class="mode-chevron">›</span>
    </a>
```
reemplazar por:
```html
    <a class="mode-row accent" href="rapido.html">
      <span class="mode-icon">⚡</span>
      <span class="mode-text"><span class="mode-name">Ejercicio rápido</span><span class="mode-sub">10 min · 8 ejercicios al azar</span></span>
      <span class="mode-chevron">›</span>
    </a>
```

- [ ] **Step 4: Incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 5: Renderizar la nav al cargar**

Ubicar:
```js
/* aplica el tema elegido y el ciclo de color si el modo arcoíris ya está activo. */
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}

document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
/* aplica el tema elegido y el ciclo de color si el modo arcoíris ya está activo. */
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
Nav.render('inicio');

document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```

- [ ] **Step 6: Verificar sintaxis**

Extraer el `<script>` inline de `index.html` a `.../scratchpad/index-inline.js` y correr:

Run: `node --check ".../scratchpad/index-inline.js"`
Expected: sin salida.

- [ ] **Step 7: Regresión manual**

Abrir `index.html` en el navegador (o servirlo con cualquier servidor estático local): confirmar que se ve el logomark sobre el título, que solo queda la tarjeta "Ejercicio rápido" en la lista (además de "Tu progreso"), y que la barra inferior aparece con "Inicio" resaltado.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(index): trim mode list to quick-start, add logomark and bottom nav"
```

---

### Task 4: `entrenamientos.html` y `gimnasio.html` — agregar nav

**Files:**
- Modify: `entrenamientos.html`
- Modify: `gimnasio.html`

**Interfaces:**
- Consumes: `Nav.render('entrenar')` (Task 1).

- [ ] **Step 1: `entrenamientos.html` — incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="plan-engine.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
<script src="plan-engine.js"></script>
```

- [ ] **Step 2: `entrenamientos.html` — renderizar la nav al cargar**

Ubicar:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('entrenar');
```

- [ ] **Step 3: `gimnasio.html` — incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="plan-engine.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
<script src="plan-engine.js"></script>
```

- [ ] **Step 4: `gimnasio.html` — renderizar la nav al cargar**

Ubicar:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('entrenar');
```

- [ ] **Step 5: Verificar sintaxis**

Extraer el `<script>` inline de cada archivo y correr `node --check` sobre cada uno.

- [ ] **Step 6: Commit**

```bash
git add entrenamientos.html gimnasio.html
git commit -m "feat(nav): render bottom nav on entrenamientos.html and gimnasio.html"
```

---

### Task 5: `cardio.html` — nav, ocultar durante el timer, tarjeta de Correr

**Files:**
- Modify: `cardio.html`

**Interfaces:**
- Consumes: `Nav.render('cardio')`, `Nav.hide()` (Task 1).

- [ ] **Step 1: Incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
```
(la aparición dentro de `cardio.html`)
reemplazar por:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 2: Agregar la tarjeta "Correr / Caminar" al grid de máquinas**

Ubicar:
```js
  const mg=document.getElementById('machine-grid');
  Object.keys(MACHINES).forEach(k=>{
    const m=MACHINES[k], b=document.createElement('div');
    b.className='opt-btn'+(k===machineKey?' active':''); b.dataset.key=k;
    b.innerHTML=`<span class="o-icon">${m.icon}</span><span class="o-name">${m.label}</span>`;
    b.onclick=()=>selectMachine(k); mg.appendChild(b);
  });
```
reemplazar por:
```js
  const mg=document.getElementById('machine-grid');
  Object.keys(MACHINES).forEach(k=>{
    const m=MACHINES[k], b=document.createElement('div');
    b.className='opt-btn'+(k===machineKey?' active':''); b.dataset.key=k;
    b.innerHTML=`<span class="o-icon">${m.icon}</span><span class="o-name">${m.label}</span>`;
    b.onclick=()=>selectMachine(k); mg.appendChild(b);
  });
  const runTile=document.createElement('div');
  runTile.className='opt-btn';
  runTile.innerHTML=`<span class="o-icon">🏃‍♂️</span><span class="o-name">Correr / Caminar</span>`;
  runTile.onclick=()=>{ location.href='correr.html'; };
  mg.appendChild(runTile);
```

- [ ] **Step 3: Ocultar/mostrar la nav junto con el modo gimnasio (timer activo)**

Ubicar:
```js
function openGym(){ if(!gymEnabled) return; gymOpen=true;
  document.getElementById('gym-overlay').classList.add('show'); initAudio(); updateUI(); }
function closeGym(){ gymOpen=false; document.getElementById('gym-overlay').classList.remove('show'); }
```
reemplazar por:
```js
function openGym(){ if(!gymEnabled) return; gymOpen=true;
  document.getElementById('gym-overlay').classList.add('show'); initAudio(); updateUI(); Nav.hide(); }
function closeGym(){ gymOpen=false; document.getElementById('gym-overlay').classList.remove('show'); Nav.render('cardio'); }
```

- [ ] **Step 4: Renderizar la nav al cargar**

Ubicar:
```js
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
(la aparición dentro de `cardio.html`)
reemplazar por:
```js
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('cardio');
```

- [ ] **Step 5: Verificar sintaxis**

Extraer el `<script>` inline de `cardio.html` y correr `node --check`.

- [ ] **Step 6: Regresión manual**

Abrir `cardio.html`: confirmar que aparece la tarjeta "Correr / Caminar" en el grid y que navega a `correr.html`. Iniciar el modo gimnasio y confirmar que la nav desaparece; salir y confirmar que reaparece con "Cardio" resaltado.

- [ ] **Step 7: Commit**

```bash
git add cardio.html
git commit -m "feat(cardio): add bottom nav, hide during active timer, add Correr tile"
```

---

### Task 6: `correr.html` — nav, ocultar durante la ruta activa

**Files:**
- Modify: `correr.html`

**Interfaces:**
- Consumes: `Nav.render('cardio')`, `Nav.hide()` (Task 1).

- [ ] **Step 1: Incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="weight-log.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 2: Ocultar/mostrar la nav según la pantalla**

Ubicar:
```js
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  document.getElementById(name+'-screen').classList.add('show');
}
```
reemplazar por:
```js
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  document.getElementById(name+'-screen').classList.add('show');
  if(name==='active') Nav.hide(); else Nav.render('cardio');
}
```

- [ ] **Step 3: Renderizar la nav al cargar**

`setup-screen` ya viene visible por markup (`class="screen show"`), sin pasar por `showScreen()` — hay que renderizar la nav una vez al cargar también. Ubicar:
```js
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
(la aparición dentro de `correr.html`)
reemplazar por:
```js
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('cardio');
```

- [ ] **Step 4: Verificar sintaxis**

Extraer el `<script>` inline de `correr.html` y correr `node --check`.

- [ ] **Step 5: Regresión manual**

Abrir `correr.html`: confirmar nav visible con "Cardio" resaltado en la pantalla de inicio de ruta. Iniciar una ruta (o simular permisos denegados) y confirmar que la nav desaparece durante `active-screen`; terminar la ruta y confirmar que reaparece en `summary-screen`.

- [ ] **Step 6: Commit**

```bash
git add correr.html
git commit -m "feat(correr): add bottom nav, hide during active route"
```

---

### Task 7: `rapido.html` — integrar la nav

**Files:**
- Modify: `rapido.html`

**Interfaces:**
- Consumes: `Nav.render('entrenar')`, `Nav.hide()` (Task 1).

- [ ] **Step 1: Incluir `nav.js`**

Ubicar:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 2: Ocultar/mostrar la nav según la pantalla**

Ubicar:
```js
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  document.getElementById(name+'-screen').classList.add('show');
}
```
reemplazar por:
```js
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  document.getElementById(name+'-screen').classList.add('show');
  if(name==='play') Nav.hide(); else Nav.render('entrenar');
}
```

- [ ] **Step 3: Renderizar la nav al cargar**

`intro-screen` ya viene visible por markup, sin pasar por `showScreen()`. Ubicar:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
(la aparición dentro de `rapido.html`)
reemplazar por:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('entrenar');
```

- [ ] **Step 4: Verificar sintaxis**

Extraer el `<script>` inline de `rapido.html` y correr `node --check`.

- [ ] **Step 5: Commit**

```bash
git add rapido.html
git commit -m "feat(rapido): add bottom nav, hide during active workout"
```

---

### Task 8: `rapido.html` — anillo circular en `play-screen`

**Files:**
- Modify: `rapido.html`

**Interfaces:**
- Produces: `ringPercent(left, dur)` (función pura local, sin export — solo se usa dentro de este archivo).
- No cambia: `WORK_SECONDS`, `REST_SECONDS`, `phase`, `tick()`, `startPhase()`, `advancePhase()`, `render()`.

- [ ] **Step 1: Agregar la función pura de progreso del aro**

Ubicar:
```js
let paused = false, pausedAt = 0;
```
reemplazar por:
```js
let paused = false, pausedAt = 0;

/* ---------- lógica pura (testeable sin DOM) ---------- */
function ringPercent(left, dur){
  return Math.max(0, Math.min(100, (1 - left/dur) * 100));
}
/* ---------- fin lógica pura ---------- */
```

- [ ] **Step 2: CSS del aro**

Ubicar:
```css
.phase-label { display:inline-block; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  padding:5px 16px; border-radius:20px; margin-bottom:10px; }
.phase-label.work { background:rgba(239,159,39,.16); color:var(--accent); }
.phase-label.rest { background:rgba(93,202,165,.16); color:var(--rest); }
.play-progress { font-size:11px; color:var(--muted); margin-bottom:16px; font-family:'Space Mono',monospace; }
.play-timer { font-family:'Space Mono',monospace; font-size:64px; font-weight:700; line-height:1; }
.play-timer.work { color:var(--accent); }
.play-timer.rest { color:var(--rest); }
```
reemplazar por:
```css
.play-progress { font-size:11px; color:var(--muted); margin-bottom:14px; font-family:'Space Mono',monospace; }
.ring { width:236px; height:236px; border-radius:50%; margin:0 auto; display:grid; place-items:center;
  background:conic-gradient(var(--accent) var(--pct,0%), var(--surface2) 0); }
.ring.rest { background:conic-gradient(var(--rest) var(--pct,0%), var(--surface2) 0); }
.ring-inner { width:198px; height:198px; border-radius:50%; background:var(--bg);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
.phase-label { font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
.phase-label.work { color:var(--accent); }
.phase-label.rest { color:var(--rest); }
.play-timer { font-family:'Space Mono',monospace; font-size:52px; font-weight:700; line-height:1; }
.play-timer.work { color:var(--accent); }
.play-timer.rest { color:var(--rest); }
```

- [ ] **Step 3: Markup del aro**

Ubicar:
```html
<div class="screen" id="play-screen">
  <div class="phase-label" id="phase-label">Trabajo</div>
  <div class="play-progress" id="play-progress"></div>
  <div class="play-timer" id="play-timer">45</div>
  <img class="play-gif" id="play-gif" alt="">
```
reemplazar por:
```html
<div class="screen" id="play-screen">
  <div class="play-progress" id="play-progress"></div>
  <div class="ring" id="play-ring">
    <div class="ring-inner">
      <div class="phase-label" id="phase-label">Trabajo</div>
      <div class="play-timer" id="play-timer">45</div>
    </div>
  </div>
  <img class="play-gif" id="play-gif" alt="">
```

- [ ] **Step 4: Alimentar el aro desde `updateTimer`**

Ubicar:
```js
function updateTimer(left){
  document.getElementById('play-timer').textContent = left;
}
```
reemplazar por:
```js
function updateTimer(left){
  document.getElementById('play-timer').textContent = left;
  const dur = phase==='work' ? WORK_SECONDS : REST_SECONDS;
  const ring = document.getElementById('play-ring');
  ring.className = 'ring ' + phase;
  ring.style.setProperty('--pct', ringPercent(left, dur).toFixed(1) + '%');
}
```

- [ ] **Step 5: Verificar sintaxis**

Extraer el `<script>` inline de `rapido.html` y correr `node --check`.

- [ ] **Step 6: Assert-based check de `ringPercent`**

Escribir en el scratchpad (`.../scratchpad/ring-percent-smoke.js`):

```js
const assert = require('assert');

function ringPercent(left, dur){
  return Math.max(0, Math.min(100, (1 - left/dur) * 100));
}

assert.strictEqual(ringPercent(45, 45), 0);          // justo al empezar la fase
assert.strictEqual(ringPercent(0, 45), 100);          // último instante
assert.strictEqual(Math.round(ringPercent(30, 45)), 33); // a mitad de camino, redondeado
assert.strictEqual(ringPercent(-5, 45), 100);         // clamp: nunca pasa de 100
assert.strictEqual(ringPercent(50, 45), 0);           // clamp: nunca baja de 0 (left > dur)

console.log('ring percent logic OK');
```

Run: `node ring-percent-smoke.js` (desde el scratchpad)
Expected: `ring percent logic OK`

- [ ] **Step 7: Regresión manual**

Iniciar "Ejercicio rápido": confirmar que el aro se llena en sentido horario a medida que corre el reloj, cambia de color naranja (trabajo) a verde-menta (descanso, `--rest`) al cambiar de fase, y se reinicia a 0% al empezar cada fase nueva.

- [ ] **Step 8: Commit**

```bash
git add rapido.html
git commit -m "feat(rapido): replace flat timer with circular progress ring"
```

---

### Task 9: `estadisticas.html` y `ajustes.html` — agregar nav

**Files:**
- Modify: `estadisticas.html`
- Modify: `ajustes.html`

**Interfaces:**
- Consumes: `Nav.render('progreso')`, `Nav.render('ajustes')` (Task 1).

- [ ] **Step 1: `estadisticas.html` — incluir `nav.js`**

Ubicar:
```html
<script src="streak.js"></script>
<script src="prefs.js"></script>
```
reemplazar por:
```html
<script src="streak.js"></script>
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 2: `estadisticas.html` — renderizar la nav al cargar**

Ubicar:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('progreso');
```

- [ ] **Step 3: `ajustes.html` — incluir `nav.js`**

Ubicar:
```html
<script src="prefs.js"></script>
```
reemplazar por:
```html
<script src="prefs.js"></script>
<script src="nav.js"></script>
```

- [ ] **Step 4: `ajustes.html` — renderizar la nav al cargar**

`ajustes.html` no usa `try/catch` alrededor de estas llamadas (decisión ya tomada y documentada en `docs/PENDIENTES.md`: no había fallo real que atrapar). Ubicar:
```js
Prefs.applyThemeIfSet();
Prefs.applyRainbowIfOn();
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
Prefs.applyThemeIfSet();
Prefs.applyRainbowIfOn();
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
Nav.render('ajustes');
```

- [ ] **Step 5: Verificar sintaxis**

Extraer el `<script>` inline de cada archivo y correr `node --check` sobre cada uno.

- [ ] **Step 6: Commit**

```bash
git add estadisticas.html ajustes.html
git commit -m "feat(nav): render bottom nav on estadisticas.html and ajustes.html"
```

---

### Task 10: Regresión final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: `node --check` sobre todo lo tocado**

Run (uno por uno, o extrayendo el `<script>` inline donde aplique):
```
node --check "D:\Empresa\Programas\APP EJERCICIOS\quemagrasa\nav.js"
```
y lo mismo para el `<script>` extraído de: `entrenar.html`, `index.html`, `entrenamientos.html`, `gimnasio.html`, `cardio.html`, `correr.html`, `rapido.html`, `estadisticas.html`, `ajustes.html`.
Expected: sin salida en ningún caso.

- [ ] **Step 2: Recorrido manual completo (checklist de la spec, sección 8)**

- [ ] Navegar las 9 páginas (8 + `entrenar.html`) y confirmar que la tab correcta queda resaltada en cada una, según la tabla de la spec (sección 03 del artifact / "Dónde vive la nav inferior" de la spec).
- [ ] Confirmar que la nav **no** aparece durante: sesión activa de "Ejercicio rápido" (`play-screen`), timer activo de `cardio.html` (modo gimnasio), ruta activa de `correr.html`.
- [ ] Completar una sesión de "Ejercicio rápido" de principio a fin: el aro avanza en sincronía con el reloj, cambia de color al pasar de Trabajo a Descanso, y se reinicia a 0% en cada fase nueva.
- [ ] Confirmar que "Correr / Caminar" aparece como tarjeta en el grid de `cardio.html` y navega a `correr.html`.
- [ ] Confirmar que `index.html` muestra el logomark en el header y que la lista de modos solo tiene "Tu progreso" y "Ejercicio rápido".
- [ ] Cambiar de tema en Ajustes y confirmar que la nav (icono/texto activo, fondo, borde) sigue el tema elegido en al menos 2 páginas distintas.

- [ ] **Step 3: Actualizar `docs/PENDIENTES.md` si el recorrido manual encuentra pulido pendiente**

Si algo queda para después (no bloqueante), agregarlo a `docs/PENDIENTES.md` con el mismo formato que las entradas existentes, en vez de dejarlo suelto en la conversación.
