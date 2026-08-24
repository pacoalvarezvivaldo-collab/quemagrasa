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
      KEY_FULLSCREEN = 'qg_pref_fullscreen', KEY_RAINBOW = 'qg_rainbow';

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

/* ---------- modo arcoíris: efecto compartido (el descubrimiento de las
   6 zonas vive solo en index.html, aquí solo el ciclo de color) ---------- */
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
  document.documentElement.style.removeProperty('--accent');
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

window.Prefs = {
  getSoundWarningOn, setSoundWarningOn,
  getKeepScreenOn, setKeepScreenOn,
  getFullscreenPref, setFullscreenPref,
  maybeRequestFullscreen,
  isRainbowOn, hasRainbowBeenDiscovered, setRainbowOn, applyRainbowIfOn
};
})();
