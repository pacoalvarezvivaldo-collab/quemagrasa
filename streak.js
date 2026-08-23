/* =====================================================================
   streak.js — racha de entrenamiento compartida: registro de "hoy hubo
   actividad" y cálculo de días consecutivos. Sin conocimiento de DOM ni
   de Supabase — todo local en localStorage. Compartido por
   entrenamientos.html/gimnasio.html (vía plan-engine.js), rapido.html,
   cardio.html y correr.html.
   Ver docs/superpowers/specs/2026-08-22-racha-design.md
   ===================================================================== */

(function(){

/* ---------- lógica pura (testeable sin red/DOM) ---------- */
function todayStr(d){
  d = d || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function daysBetween(dateStrA, dateStrB){
  return (new Date(dateStrB+'T00:00:00Z') - new Date(dateStrA+'T00:00:00Z')) / 86400000;
}

function computeCurrentStreak(log, todayDateStr){
  if(!log.length) return 0;
  const days = [...new Set(log)].sort().reverse();
  const gap = daysBetween(days[0], todayDateStr);
  if(gap > 1) return 0;
  let streak = 1;
  for(let i=1; i<days.length; i++){
    if(daysBetween(days[i], days[i-1]) === 1) streak++;
    else break;
  }
  return streak;
}
/* ---------- fin lógica pura ---------- */

const KEY_LOG = 'qg_activity_log';

function getLog(){ try{ const v = JSON.parse(localStorage.getItem(KEY_LOG)); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function saveLog(log){ try{ localStorage.setItem(KEY_LOG, JSON.stringify(log)); }catch(e){} }

function recordActivity(){
  const today = todayStr();
  const log = getLog();
  if(!log.includes(today)){
    log.push(today);
    saveLog(log);
  }
}

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
