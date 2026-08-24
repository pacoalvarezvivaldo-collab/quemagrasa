/* =====================================================================
   sync.js — sincronización opcional con Supabase (magic link + RLS).
   Compartido por correr.html y entrenamientos.html. Sin sesión activa,
   nunca llama a red — cero comportamiento distinto al 100% local de hoy.
   Ver docs/superpowers/specs/2026-08-21-supabase-sync-design.md
   ===================================================================== */
(function(){

const SUPABASE_URL = 'https://plcamneqwvhpduytoant.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsY2FtbmVxd3ZocGR1eXRvYW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjM4NTgsImV4cCI6MjEwMjkzOTg1OH0.BRjwW6YclXiqExMWQTSamS4RGdx4g7Q2wo1QAyCI0_k';

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

async function getClient(){
  if(client) return client;
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function renderBtn(){
  if(!syncBtn) return;
  syncBtn.style.display = ''; // credenciales configuradas y cliente listo: el botón deja de estar oculto
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
  try{
    const sb = await getClient();
    if(!sb){ syncBtn.style.display = 'none'; return; } // sin credenciales configuradas: el botón no existe
    syncBtn.addEventListener('click', openModal);
    const { data } = await sb.auth.getSession();
    session = data.session;
    renderBtn();
    sb.auth.onAuthStateChange((_event, s)=>{ session = s; renderBtn(); });
  }catch(e){ syncBtn.style.display = 'none'; } // offline/red caída: la página sigue 100% local
}

/* páginas sin botón propio (Gimnasio, Progreso/Racha): heredan la sesión ya
   persistida por el cliente de Supabase en localStorage, sin UI de login. */
async function initSilent(){
  try{
    const sb = await getClient();
    if(!sb) return;
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((_event, s)=>{ session = s; if(syncBtn) renderBtn(); });
  }catch(e){ /* offline/red caída: la página sigue 100% local */ }
}

function isSignedIn(){ return !!session; }

/* ---------- run_history ---------- */
async function pushRun(entry){
  if(!session) return;
  try{
    const sb = await getClient();
    if(!sb) return;
    await sb.from('run_history').insert({
      user_id: session.user.id, date: new Date(entry.date).toISOString(), mode: entry.mode,
      distance_m: entry.distanceM, elapsed_s: entry.elapsedS, steps: entry.steps, kcal: entry.kcal
    });
  }catch(e){ /* offline: el dato ya quedó guardado en local, se reintenta en el próximo push */ }
}

async function pullAndMergeHistory(localHistory){
  if(!session) return localHistory;
  try{
    const sb = await getClient();
    if(!sb) return localHistory;
    const { data, error } = await sb.from('run_history').select('*').eq('user_id', session.user.id);
    if(error || !data) return localHistory;
    const { merged, toUpload } = mergeHistory(localHistory, data);
    await Promise.all(toUpload.map(pushRun));
    return merged;
  }catch(e){ return localHistory; }
}

/* ---------- weight_log ---------- */
async function pushWeightEntry(entry){
  if(!session) return;
  try{
    const sb = await getClient();
    if(!sb) return;
    await sb.from('weight_log').upsert(
      { user_id: session.user.id, date: entry.date, weight_kg: entry.weightKg },
      { onConflict: 'user_id,date' }
    );
  }catch(e){ /* offline: el dato ya quedó guardado en local, se reintenta en el próximo push */ }
}

async function pullAndMergeWeightLog(localLog){
  if(!session) return localLog;
  try{
    const sb = await getClient();
    if(!sb) return localLog;
    const { data, error } = await sb.from('weight_log').select('*').eq('user_id', session.user.id);
    if(error || !data) return localLog;
    const { merged, toUpload } = mergeWeightLog(localLog, data);
    await Promise.all(toUpload.map(pushWeightEntry));
    return merged;
  }catch(e){ return localLog; }
}

/* ---------- user_state ---------- */
async function pushUserState(partial){
  if(!session) return;
  try{
    const sb = await getClient();
    if(!sb) return;
    await sb.from('user_state').upsert({ user_id: session.user.id, updated_at:new Date().toISOString(), ...partial });
  }catch(e){ /* offline: se reintenta en el próximo guardado */ }
}

async function pullUserState(){
  if(!session) return null;
  try{
    const sb = await getClient();
    if(!sb) return null;
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

window.QuemaSync = { init, initSilent, isSignedIn, pushRun, pullAndMergeHistory, pushUserState, pullUserState, pushWeightEntry, pullAndMergeWeightLog };
})();
