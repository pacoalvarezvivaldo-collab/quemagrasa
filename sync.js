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
