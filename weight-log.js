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
