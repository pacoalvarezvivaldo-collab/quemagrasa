# Personalización de color + descubrimiento del arcoíris Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compartir los 12 temas de color que ya existen en `cardio.html` con toda la app vía `prefs.js`, dar una rueda de colores en `ajustes.html`, mover ahí el descubrimiento del modo arcoíris (tocar los colores en orden rojo→naranja→amarillo→verde→azul→morado) quitando el texto que revela el secreto, y eliminar el viejo truco de las 6 zonas invisibles en `index.html`.

**Architecture:** `prefs.js` gana una copia de los 12 `THEMES` de `cardio.html` más 4 funciones (`getThemeKey`, `setThemeKey`, `applyThemeIfSet`, `getThemeList`) siguiendo el mismo patrón get/set-y-aplica ya usado por `soundWarningOn`/`keepScreenOn`/`rainbow`. Las 7 páginas que no tienen su propio sistema de temas (todas menos Cardio) llaman `Prefs.applyThemeIfSet()` al cargar. Cardio conserva su `applyTheme()` local (autosuficiente, sin tocar `Prefs` para la parte visual) y solo se sincroniza con `Prefs` en los dos bordes: al cargar (migración de una sola vez + lectura) y al elegir un color (escritura).

**Tech Stack:** JS vanilla, `localStorage` — mismo stack que el resto de la app, sin dependencias nuevas.

## Global Constraints

- La preferencia de tema es por dispositivo/navegador — `localStorage` únicamente, nunca Supabase.
- Los 12 temas y sus valores de color son EXACTAMENTE los que ya existen en `cardio.html:506-519` (`THEMES`) — no se inventan colores nuevos ni se modifican los existentes.
- La secuencia secreta es **rojo → naranja → amarillo → verde → azul → morado**, con máximo 4 segundos entre cada toque correcto, y el mismo comportamiento de reinicio que el mecanismo que reemplaza (un toque fuera de secuencia reinicia a 0, salvo que ese toque sea "rojo", que reinicia y cuenta como paso 1).
- `ajustes.html` no debe mostrar ningún texto que insinúe la existencia de un secreto, ni antes ni después de descubrirlo (solo aparece el toggle "🌈 Modo arcoíris" una vez descubierto, sin mensaje previo).
- El descubrimiento del secreto vive únicamente en `ajustes.html` — no se duplica en `cardio.html` ni en ninguna otra página.
- Cada archivo modificado se verifica con `node --check` (para `.js`) o extrayendo su `<script>` inline a un archivo temporal en el scratchpad y corriendo `node --check` sobre él (para `.html`).
- Spec de referencia: `docs/superpowers/specs/2026-08-24-ajustes-color-design.md`.

---

### Task 1: Extender `prefs.js` con los 12 temas compartidos

**Files:**
- Modify: `prefs.js`

**Interfaces:**
- Produces (nuevo, se suma a lo ya existente): `Prefs.getThemeKey()`, `Prefs.setThemeKey(k)`, `Prefs.applyThemeIfSet()`, `Prefs.getThemeList()` — usados por las tareas siguientes.
- Modifica el comportamiento interno de `stopRainbowEffect()` (privada, no exportada) — ver Step 2.

- [ ] **Step 1: Agregar los 12 temas y las 4 funciones nuevas**

En `prefs.js`, ubicar:
```js
const KEY_SOUND = 'qg_pref_sound', KEY_SCREEN = 'qg_pref_screen',
      KEY_FULLSCREEN = 'qg_pref_fullscreen', KEY_RAINBOW = 'qg_rainbow';
```
reemplazar por:
```js
const KEY_SOUND = 'qg_pref_sound', KEY_SCREEN = 'qg_pref_screen',
      KEY_FULLSCREEN = 'qg_pref_fullscreen', KEY_RAINBOW = 'qg_rainbow', KEY_THEME = 'qg_pref_theme';

/* ---------- temas de color: copia exacta de los 12 que ya existían en cardio.html ---------- */
const THEMES = {
  negro:   { sw:"#0d0d0f", v:{bg:"#0d0d0f",s1:"#18181c",s2:"#222228",tx:"#f0efe8",mu:"#777777",bd:"rgba(255,255,255,.08)",ac:"#EF9F27",at:"#000000"} },
  blanco:  { sw:"#ffffff", v:{bg:"#f4f4f2",s1:"#ffffff",s2:"#e9e9e6",tx:"#1a1a1a",mu:"#8a8a8a",bd:"rgba(0,0,0,.10)",ac:"#1a1a1a",at:"#ffffff"} },
  morado:  { sw:"#A879F0", v:{bg:"#0d0a14",s1:"#1a1424",s2:"#241a32",tx:"#f0eef8",mu:"#8b80a0",bd:"rgba(255,255,255,.08)",ac:"#A879F0",at:"#ffffff"} },
  azul:    { sw:"#4A90E2", v:{bg:"#0a0f16",s1:"#141b24",s2:"#1c2632",tx:"#eef3f8",mu:"#7d8a99",bd:"rgba(255,255,255,.08)",ac:"#4A90E2",at:"#ffffff"} },
  verde:   { sw:"#34C77B", v:{bg:"#0a130f",s1:"#142019",s2:"#1c2c23",tx:"#eef8f1",mu:"#7d998a",bd:"rgba(255,255,255,.08)",ac:"#34C77B",at:"#06231a"} },
  rojo:    { sw:"#E2444A", v:{bg:"#140a0b",s1:"#201415",s2:"#2c1c1e",tx:"#f8eeee",mu:"#9a7d7f",bd:"rgba(255,255,255,.08)",ac:"#E2444A",at:"#ffffff"} },
  naranja: { sw:"#FF7A1A", v:{bg:"#140d07",s1:"#20180f",s2:"#2c2116",tx:"#f8f1e8",mu:"#9a8a75",bd:"rgba(255,255,255,.08)",ac:"#FF7A1A",at:"#1a0d00"} },
  rosa:    { sw:"#FF4D8D", v:{bg:"#140a0f",s1:"#201018",s2:"#2c1622",tx:"#f8eef4",mu:"#9a7d8c",bd:"rgba(255,255,255,.08)",ac:"#FF4D8D",at:"#ffffff"} },
  cian:    { sw:"#22C7D6", v:{bg:"#071214",s1:"#101e20",s2:"#16292c",tx:"#eaf7f8",mu:"#789095",bd:"rgba(255,255,255,.08)",ac:"#22C7D6",at:"#00232a"} },
  amarillo:{ sw:"#F2C230", v:{bg:"#12100a",s1:"#1e1b12",s2:"#29251a",tx:"#f8f4e6",mu:"#948d75",bd:"rgba(255,255,255,.08)",ac:"#F2C230",at:"#2a2000"} },
  grafito: { sw:"#8E9AAF", v:{bg:"#101114",s1:"#1a1c21",s2:"#24272e",tx:"#eef0f4",mu:"#828a99",bd:"rgba(255,255,255,.08)",ac:"#8E9AAF",at:"#0e1014"} },
  menta:   { sw:"#6FE3C4", v:{bg:"#08130f",s1:"#0f1f1a",s2:"#152b24",tx:"#eafaf5",mu:"#7a9c92",bd:"rgba(255,255,255,.08)",ac:"#6FE3C4",at:"#04241c"} }
};
```

Luego, ubicar (justo antes de `window.Prefs = {`):
```js
function applyRainbowIfOn(){ if(isRainbowOn()) startRainbowEffect(); }

window.Prefs = {
```
reemplazar por:
```js
function applyRainbowIfOn(){ if(isRainbowOn()) startRainbowEffect(); }

/* ---------- tema de color: get/set-y-aplica, mismo patrón que las demás preferencias ---------- */
function getThemeKey(){
  try{ const v = localStorage.getItem(KEY_THEME); return (v && THEMES[v]) ? v : 'negro'; }catch(e){ return 'negro'; }
}
function applyThemeIfSet(){
  const t = THEMES[getThemeKey()] || THEMES.negro;
  const r = document.documentElement;
  r.style.setProperty('--bg', t.v.bg); r.style.setProperty('--surface', t.v.s1);
  r.style.setProperty('--surface2', t.v.s2); r.style.setProperty('--text', t.v.tx);
  r.style.setProperty('--muted', t.v.mu); r.style.setProperty('--border', t.v.bd);
  r.style.setProperty('--accent', t.v.ac); r.style.setProperty('--accent-text', t.v.at);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', t.v.bg);
}
function setThemeKey(k){
  if(!THEMES[k]) return;
  try{ localStorage.setItem(KEY_THEME, k); }catch(e){}
  applyThemeIfSet();
}
function getThemeList(){ return Object.keys(THEMES).map(k=>({ key:k, swatch:THEMES[k].sw })); }

window.Prefs = {
```

Finalmente, ubicar:
```js
window.Prefs = {
  getSoundWarningOn, setSoundWarningOn,
  getKeepScreenOn, setKeepScreenOn,
  getFullscreenPref, setFullscreenPref,
  maybeRequestFullscreen,
  isRainbowOn, hasRainbowBeenDiscovered, setRainbowOn, applyRainbowIfOn
};
```
reemplazar por:
```js
window.Prefs = {
  getSoundWarningOn, setSoundWarningOn,
  getKeepScreenOn, setKeepScreenOn,
  getFullscreenPref, setFullscreenPref,
  maybeRequestFullscreen,
  isRainbowOn, hasRainbowBeenDiscovered, setRainbowOn, applyRainbowIfOn,
  getThemeKey, setThemeKey, applyThemeIfSet, getThemeList
};
```

- [ ] **Step 2: Corregir `stopRainbowEffect()` para que restaure el tema en vez de quitar el override**

**Por qué:** antes de esta tarea, `stopRainbowEffect()` hacía `document.documentElement.style.removeProperty('--accent')`, lo cual estaba bien porque nada más tocaba `--accent` por `style` inline. Ahora que `applyThemeIfSet()` también fija `--accent` por `style` inline (para poder cambiar de tema), quitar la propiedad al apagar el arcoíris haría que el acento vuelva al valor fijo del CSS de la página en vez de al del tema elegido por el usuario.

En `prefs.js`, ubicar:
```js
function stopRainbowEffect(){
  clearInterval(rainbowInterval);
  rainbowInterval = null;
  document.documentElement.style.removeProperty('--accent');
}
```
reemplazar por:
```js
function stopRainbowEffect(){
  clearInterval(rainbowInterval);
  rainbowInterval = null;
  applyThemeIfSet(); // restaura el acento (y el resto) del tema elegido, en vez de caer al valor fijo del CSS de la página
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check "D:\Empresa\Programas\APP EJERCICIOS\quemagrasa\prefs.js"`
Expected: sin salida.

- [ ] **Step 4: Assert-based check de la lógica pura de la secuencia secreta**

Escribir en el scratchpad (`.../scratchpad/rainbow-sequence-smoke.js`):

```js
const assert = require('assert');
const SEQ = ['rojo','naranja','amarillo','verde','azul','morado'];

function step(idx, key){
  if(key === SEQ[idx]){
    idx++;
    if(idx >= SEQ.length) return { idx:0, unlocked:true };
    return { idx, unlocked:false };
  }
  return { idx: (key===SEQ[0]) ? 1 : 0, unlocked:false };
}

// secuencia completa correcta
let idx=0, r;
['rojo','naranja','amarillo','verde','azul','morado'].forEach(k=>{ r=step(idx,k); idx=r.idx; });
assert.strictEqual(r.unlocked, true);
assert.strictEqual(idx, 0);

// toque fuera de orden reinicia a 0
idx=0;
r=step(idx,'rojo'); idx=r.idx;         // 1
r=step(idx,'amarillo'); idx=r.idx;     // fuera de orden (esperaba 'naranja') -> 0
assert.strictEqual(idx, 0);
assert.strictEqual(r.unlocked, false);

// un error que además es "rojo" reinicia Y cuenta como paso 1
idx=0;
r=step(idx,'rojo'); idx=r.idx;         // 1
r=step(idx,'verde'); idx=r.idx;        // fuera de orden -> 0
r=step(idx,'rojo'); idx=r.idx;         // reinicia y cuenta como paso 1 -> 1
assert.strictEqual(idx, 1);

console.log('rainbow sequence logic OK');
```

Run: `node rainbow-sequence-smoke.js` (desde el scratchpad)
Expected: `rainbow sequence logic OK`

- [ ] **Step 5: Commit**

```bash
git add prefs.js
git commit -m "feat(prefs): add shared color themes, fix rainbow-off to restore theme accent"
```

---

### Task 2: `index.html` — quitar las 6 zonas invisibles, aplicar tema compartido

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.Prefs.applyThemeIfSet()` (de Task 1)

- [ ] **Step 1: Quitar el CSS de `.rainbow-zone`**

Ubicar:
```css
.rainbow-zone { position:fixed; top:0; height:16px; width:16.6667vw; z-index:400; }
```
Eliminar esa línea completa.

- [ ] **Step 2: Quitar los 6 `<div class="rainbow-zone">`**

Ubicar:
```html
<div class="rainbow-zone" data-z="0" style="left:0"></div>
<div class="rainbow-zone" data-z="1" style="left:16.6667vw"></div>
<div class="rainbow-zone" data-z="2" style="left:33.3333vw"></div>
<div class="rainbow-zone" data-z="3" style="left:50vw"></div>
<div class="rainbow-zone" data-z="4" style="left:66.6667vw"></div>
<div class="rainbow-zone" data-z="5" style="left:83.3333vw"></div>

<script src="sync.js"></script>
```
reemplazar por:
```html
<script src="sync.js"></script>
```

- [ ] **Step 3: Quitar el mecanismo de descubrimiento y aplicar el tema compartido**

Ubicar:
```js
/* easter egg oculto: tocar las 6 zonas invisibles en orden (izquierda a derecha) alterna "modo arcoíris".
   El efecto de color (el ciclo en sí) vive en prefs.js, compartido con las demás páginas —
   aquí solo queda el mecanismo secreto de descubrimiento. */
let rainbowExpected = 0, rainbowResetTimer = null;

document.querySelectorAll('.rainbow-zone').forEach(zone=>{
  zone.addEventListener('click', ()=>{
    const z = parseInt(zone.dataset.z, 10);
    clearTimeout(rainbowResetTimer);
    if(z === rainbowExpected){
      rainbowExpected++;
      if(rainbowExpected >= 6){
        rainbowExpected = 0;
        Prefs.setRainbowOn(!Prefs.isRainbowOn());
        return;
      }
      rainbowResetTimer = setTimeout(()=>{ rainbowExpected = 0; }, 4000);
    } else {
      rainbowExpected = (z===0) ? 1 : 0;
      if(rainbowExpected) rainbowResetTimer = setTimeout(()=>{ rainbowExpected = 0; }, 4000);
    }
  });
});

try{ Prefs.applyRainbowIfOn(); }catch(e){}
```
reemplazar por:
```js
/* el descubrimiento del modo arcoíris ahora vive en ajustes.html (tocar los colores en la secuencia
   correcta) — aquí solo queda aplicar el tema elegido y el efecto si ya está activo. */
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
```

- [ ] **Step 4: Quitar la referencia a `.rainbow-zone` del listener de ripple ambient**

Ubicar:
```js
document.addEventListener('click', e=>{
  if(e.target.closest('a, button, input, .progress-card, .progress-goal-link, .rainbow-zone')) return;
```
reemplazar por:
```js
document.addEventListener('click', e=>{
  if(e.target.closest('a, button, input, .progress-card, .progress-goal-link')) return;
```

- [ ] **Step 5: Verificar sintaxis**

Extraer el `<script>` inline de `index.html` a un archivo temporal del scratchpad y correr `node --check`.
Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(color): remove hidden rainbow-zone easter egg, apply shared theme on load"
```

---

### Task 3: `ajustes.html` — rueda de colores + descubrimiento del arcoíris, sin texto de secreto

**Files:**
- Modify: `ajustes.html`

**Interfaces:**
- Consumes: `window.Prefs.getThemeKey/setThemeKey/getThemeList/applyThemeIfSet/isRainbowOn/hasRainbowBeenDiscovered/setRainbowOn/applyRainbowIfOn` (de Task 1)

- [ ] **Step 1: Agregar el CSS de los círculos de color (mismo diseño que Cardio)**

Ubicar:
```css
.rainbow-note { font-size:12.5px; color:var(--muted); background:var(--surface2); border-radius:12px; padding:12px 14px; }
</style>
```
reemplazar por:
```css
.swatches { display:flex; flex-wrap:wrap; gap:10px; }
.swatch { width:38px; height:38px; border-radius:50%; cursor:pointer; border:3px solid transparent;
  transition:border-color .2s,transform .12s; -webkit-tap-highlight-color:transparent; position:relative; }
.swatch:active { transform:scale(.9); }
.swatch.active { border-color:var(--text); }
.swatch.active::after { content:"✓"; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; }
#rainbow-box .toggle-row { margin-top:10px; }
</style>
```

- [ ] **Step 2: Reemplazar el bloque "Color" del HTML**

Ubicar:
```html
  <div class="set-group">
    <div class="set-label">Color</div>
    <div id="rainbow-box"></div>
  </div>
```
reemplazar por:
```html
  <div class="set-group">
    <div class="set-label">Color</div>
    <div class="swatches" id="swatches"></div>
    <div id="rainbow-box"></div>
  </div>
```

- [ ] **Step 3: Reemplazar la lógica de arcoíris por la rueda de colores + detector de secuencia**

Ubicar:
```js
function renderRainbowBox(){
  const box = document.getElementById('rainbow-box');
  if(!Prefs.hasRainbowBeenDiscovered()){
    box.innerHTML = '<div class="rainbow-note">🔒 Hay un modo de color secreto por descubrir en Inicio</div>';
    return;
  }
  box.innerHTML = `<div class="toggle-row on" id="rainbow-row" onclick="toggleRainbowMode()">
    <span class="toggle-txt">🌈 Modo arcoíris</span>
    <span class="toggle-sw"></span>
  </div>`;
  document.getElementById('rainbow-row').classList.toggle('on', Prefs.isRainbowOn());
}
function toggleRainbowMode(){
  Prefs.setRainbowOn(!Prefs.isRainbowOn());
  renderRainbowBox();
}

syncToggleUI();
renderRainbowBox();
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```
reemplazar por:
```js
/* ---------- rueda de colores + descubrimiento oculto del modo arcoíris ---------- */
function renderSwatches(){
  const sw = document.getElementById('swatches');
  sw.innerHTML = '';
  Prefs.getThemeList().forEach(({key, swatch})=>{
    const s = document.createElement('div');
    s.className = 'swatch' + (key===Prefs.getThemeKey() ? ' active' : '');
    s.dataset.key = key;
    s.style.background = swatch;
    if(key==='blanco') s.style.border = '3px solid rgba(0,0,0,.15)';
    s.onclick = ()=>pickColor(key);
    sw.appendChild(s);
  });
}

/* secreto: tocar los colores en el orden del arcoíris — sin ningún indicio visible de que existe */
const RAINBOW_SEQUENCE = ['rojo','naranja','amarillo','verde','azul','morado'];
let secretIdx = 0, secretResetTimer = null;

function pickColor(key){
  Prefs.setThemeKey(key);
  renderSwatches();
  checkSecretSequence(key);
}

function checkSecretSequence(key){
  clearTimeout(secretResetTimer);
  if(key === RAINBOW_SEQUENCE[secretIdx]){
    secretIdx++;
    if(secretIdx >= RAINBOW_SEQUENCE.length){
      secretIdx = 0;
      Prefs.setRainbowOn(!Prefs.isRainbowOn());
      renderRainbowBox();
      return;
    }
    secretResetTimer = setTimeout(()=>{ secretIdx = 0; }, 4000);
  } else {
    secretIdx = (key === RAINBOW_SEQUENCE[0]) ? 1 : 0;
    if(secretIdx) secretResetTimer = setTimeout(()=>{ secretIdx = 0; }, 4000);
  }
}

function renderRainbowBox(){
  const box = document.getElementById('rainbow-box');
  if(!Prefs.hasRainbowBeenDiscovered()){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="toggle-row on" id="rainbow-row" onclick="toggleRainbowMode()">
    <span class="toggle-txt">🌈 Modo arcoíris</span>
    <span class="toggle-sw"></span>
  </div>`;
  document.getElementById('rainbow-row').classList.toggle('on', Prefs.isRainbowOn());
}
function toggleRainbowMode(){
  Prefs.setRainbowOn(!Prefs.isRainbowOn());
  renderRainbowBox();
}

syncToggleUI();
renderSwatches();
renderRainbowBox();
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
document.addEventListener('click', ()=>{ try{ Prefs.maybeRequestFullscreen(); }catch(e){} }, {once:true});
```

**Nota para quien implemente:** ningún texto en este archivo, ni antes ni después de este cambio, debe mencionar "secreto", "descubrir" ni nada similar — solo los 12 círculos de color y, una vez desbloqueado, el toggle "🌈 Modo arcoíris".

- [ ] **Step 4: Verificar sintaxis**

Extraer el `<script>` inline de `ajustes.html` a un archivo temporal del scratchpad y correr `node --check`.
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add ajustes.html
git commit -m "feat(color): color wheel in Ajustes, move rainbow discovery here, remove secret hint text"
```

---

### Task 4: `cardio.html` — migrar su selector de tema a la preferencia compartida

**Files:**
- Modify: `cardio.html`

**Interfaces:**
- Consumes: `window.Prefs.getThemeKey/setThemeKey` (de Task 1)

**Nota:** Cardio conserva su propia función `applyTheme(k)` sin cambios (sigue aplicando las 8 variables CSS localmente, self-contained) — solo se sincroniza con `Prefs` en dos puntos: al cargar (`loadSettings()`, con migración de una sola vez del valor guardado) y al elegir un color (el `onclick` de cada círculo). Sus swatches no participan en la detección de la secuencia secreta — eso vive únicamente en `ajustes.html`.

- [ ] **Step 1: Migración + lectura en `loadSettings()`**

Ubicar:
```js
    if(c && typeof c.bgMode==='boolean' && localStorage.getItem('qg_pref_screen')===null) Prefs.setKeepScreenOn(c.bgMode);
    if(c && typeof c.preWarn==='boolean' && localStorage.getItem('qg_pref_sound')===null) Prefs.setSoundWarningOn(c.preWarn);
    bgMode = Prefs.getKeepScreenOn(); preWarn = Prefs.getSoundWarningOn();
  }
```
reemplazar por:
```js
    if(c && typeof c.bgMode==='boolean' && localStorage.getItem('qg_pref_screen')===null) Prefs.setKeepScreenOn(c.bgMode);
    if(c && typeof c.preWarn==='boolean' && localStorage.getItem('qg_pref_sound')===null) Prefs.setSoundWarningOn(c.preWarn);
    if(c && typeof c.themeKey==='string' && THEMES[c.themeKey] && localStorage.getItem('qg_pref_theme')===null) Prefs.setThemeKey(c.themeKey);
    bgMode = Prefs.getKeepScreenOn(); preWarn = Prefs.getSoundWarningOn(); themeKey = Prefs.getThemeKey();
  }
```

- [ ] **Step 2: Quitar la restauración vieja de `themeKey` desde el blob `qg_config`**

Ubicar:
```js
  if(c.themeKey&&THEMES[c.themeKey]) themeKey=c.themeKey;
```
Eliminar esa línea completa (ya no hace falta — `themeKey` ahora se resuelve arriba desde `Prefs`, igual que `bgMode`/`preWarn`).

- [ ] **Step 3: El `onclick` de cada círculo también escribe a la preferencia compartida**

Ubicar:
```js
    s.onclick=()=>applyTheme(k); sw.appendChild(s);
```
reemplazar por:
```js
    s.onclick=()=>{ applyTheme(k); if(window.Prefs) Prefs.setThemeKey(k); }; sw.appendChild(s);
```

- [ ] **Step 4: Verificar sintaxis**

Extraer el `<script>` inline de `cardio.html` a un archivo temporal del scratchpad y correr `node --check`.
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add cardio.html
git commit -m "feat(color): migrate cardio.html theme selection to shared prefs key"
```

---

### Task 5: Aplicar el tema compartido en las 5 páginas restantes

**Files:**
- Modify: `correr.html`, `gimnasio.html`, `entrenamientos.html`, `rapido.html`, `estadisticas.html`

**Interfaces:**
- Consumes: `window.Prefs.applyThemeIfSet()` (de Task 1)

- [ ] **Step 1: `correr.html`**

Ubicar:
```js
try{ Prefs.applyRainbowIfOn(); }catch(e){}
```
reemplazar por:
```js
try{ Prefs.applyThemeIfSet(); }catch(e){}
try{ Prefs.applyRainbowIfOn(); }catch(e){}
```

- [ ] **Step 2: `gimnasio.html`** — mismo reemplazo exacto que el Step 1.

- [ ] **Step 3: `entrenamientos.html`** — mismo reemplazo exacto que el Step 1.

- [ ] **Step 4: `rapido.html`** — mismo reemplazo exacto que el Step 1.

- [ ] **Step 5: `estadisticas.html`** — mismo reemplazo exacto que el Step 1.

- [ ] **Step 6: Verificar sintaxis de las 5 páginas**

Extraer el `<script>` inline de cada uno de los 5 archivos a un archivo temporal del scratchpad y correr `node --check` sobre cada uno.
Expected: sin salida en los 5.

- [ ] **Step 7: Commit**

```bash
git add correr.html gimnasio.html entrenamientos.html rapido.html estadisticas.html
git commit -m "feat(color): apply shared theme on load across the remaining 5 pages"
```

---

### Task 6: Verificación end-to-end y push

**Files:** ninguno (solo pruebas + push)

- [ ] **Step 1: Verificación estática de las 8 páginas + `prefs.js`**

Correr `node --check` (directo o vía extracción de `<script>` inline) sobre: `prefs.js`, `index.html`, `ajustes.html`, `cardio.html`, `correr.html`, `gimnasio.html`, `entrenamientos.html`, `rapido.html`, `estadisticas.html`.
Expected: sin salida en las 9.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verificación manual (guía para el usuario, con Ctrl+Shift+R en cada pantalla nueva por la caché)**

1. Abrir Ajustes → sección Color debe mostrar 12 círculos, sin ningún texto sobre secretos.
2. Tocar un color (ej. azul) → confirmar que cambia el color de toda la pantalla de Ajustes al instante. Navegar a Correr o Gimnasio → confirmar que también se ve azul ahí.
3. Tocar los colores en orden: rojo → naranja → amarillo → verde → azul → morado (sin tardar más de ~4 segundos entre cada uno) → confirmar que aparece el toggle "🌈 Modo arcoíris" y que el acento empieza a ciclar colores. Repetir la secuencia → confirmar que se apaga y el acento vuelve al tema elegido (no al naranja original de la app).
4. Confirmar que en `index.html` ya no existen las 6 zonas invisibles (no pasa nada al tocar los bordes de la pantalla en el patrón viejo).
5. Abrir el selector de temas dentro de Cardio → confirmar que muestra el mismo color activo que se dejó en Ajustes, y que cambiarlo ahí también se refleja en Ajustes.
