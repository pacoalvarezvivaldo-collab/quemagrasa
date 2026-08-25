/* =====================================================================
   prefs.js — preferencias de interfaz por dispositivo: aviso de sonido,
   mantener pantalla encendida, pantalla completa, modo arcoíris.
   Sin conocimiento de Supabase — viven 100% en localStorage, no se
   sincronizan entre dispositivos (son ajustes de interfaz, no datos de
   la cuenta). Compartido por las 8 páginas de la app.
   Ver docs/superpowers/specs/2026-08-24-ajustes-design.md
   ===================================================================== */
(function(){

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

/* ---------- lógica pura (testeable sin DOM) ---------- */
function readBoolPref(raw, defaultValue){
  if(raw === null || raw === undefined) return defaultValue;
  return raw === '1';
}
/* ---------- fin lógica pura ---------- */

function getBool(key, defaultValue){
  try{ return readBoolPref(localStorage.getItem(key), defaultValue); }catch(e){ return defaultValue; }
}
function setBool(key, v){
  try{ localStorage.setItem(key, v ? '1' : '0'); }catch(e){}
}

function getSoundWarningOn(){ return getBool(KEY_SOUND, true); }
function setSoundWarningOn(v){ setBool(KEY_SOUND, v); }
function getKeepScreenOn(){ return getBool(KEY_SCREEN, true); }
function setKeepScreenOn(v){ setBool(KEY_SCREEN, v); }
function getFullscreenPref(){ return getBool(KEY_FULLSCREEN, false); }
function setFullscreenPref(v){ setBool(KEY_FULLSCREEN, v); }

function maybeRequestFullscreen(){
  if(!getFullscreenPref()) return;
  if(document.fullscreenElement) return;
  if(!document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().catch(()=>{});
}

/* ---------- modo arcoíris: solo el ciclo de color, compartido por todas las páginas ---------- */
let rainbowInterval = null, rainbowHue = 0;
function applyRainbowHue(){
  document.documentElement.style.setProperty('--accent', `hsl(${rainbowHue}, 85%, 55%)`);
  rainbowHue = (rainbowHue + 6) % 360;
}
function startRainbowEffect(){
  clearInterval(rainbowInterval);
  applyRainbowHue();
  rainbowInterval = setInterval(applyRainbowHue, 150);
}
function stopRainbowEffect(){
  clearInterval(rainbowInterval);
  rainbowInterval = null;
  applyThemeIfSet(); // restaura el acento (y el resto) del tema elegido, en vez de caer al valor fijo del CSS de la página
}
function isRainbowOn(){ try{ return localStorage.getItem(KEY_RAINBOW)==='1'; }catch(e){ return false; } }
function hasRainbowBeenDiscovered(){ try{ return localStorage.getItem(KEY_RAINBOW) !== null; }catch(e){ return false; } }
function setRainbowOn(v){
  // nunca se borra la llave una vez descubierto (solo '1'/'0') — si no, "descubierto pero apagado"
  // sería indistinguible de "nunca descubierto" la próxima vez que se lea.
  try{ localStorage.setItem(KEY_RAINBOW, v ? '1' : '0'); }catch(e){}
  if(v) startRainbowEffect(); else stopRainbowEffect();
}
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
  getSoundWarningOn, setSoundWarningOn,
  getKeepScreenOn, setKeepScreenOn,
  getFullscreenPref, setFullscreenPref,
  maybeRequestFullscreen,
  isRainbowOn, hasRainbowBeenDiscovered, setRainbowOn, applyRainbowIfOn,
  getThemeKey, setThemeKey, applyThemeIfSet, getThemeList
};
})();
