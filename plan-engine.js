/* =====================================================================
   plan-engine.js — motor genérico del plan de 30 días (calendario,
   niveles, pantalla de ejercicio, descanso, easter egg espartano).
   Sin conocimiento de Supabase ni de reglas de filtrado de equipo —
   todo eso entra vía PlanEngine.init(config). Compartido por
   entrenamientos.html (Casa) y gimnasio.html (Gimnasio).
   Ver docs/superpowers/specs/2026-08-21-gimnasio-design.md
   ===================================================================== */

/* ---------- lógica pura (testeable sin red/DOM) ---------- */
const LEVELS = {
  facil:     { label:"Fácil",     icon:"🌱", count:4, reps:[8,10,12] },
  medio:     { label:"Medio",     icon:"🔥", count:6, reps:[10,12,15] },
  dificil:   { label:"Difícil",   icon:"💥", count:8, reps:[15,18,20] },
  espartano: { label:"Espartano", icon:"⚔️", count:8, reps:[20,20,20] }
};

const MUSCLE_CYCLE = [
  { key:'legs',  label:'Piernas', icon:'🦵', bodyParts:['legs'] },
  { key:'core',  label:'Core',    icon:'🧘', bodyParts:['core'] },
  { key:'arms',  label:'Brazos',  icon:'💪', bodyParts:['arms','shoulders'] },
  { key:'back',  label:'Espalda', icon:'🏋️', bodyParts:['back'] },
  { key:'chest', label:'Pecho',   icon:'🫁', bodyParts:['chest'] }
];

let POOL = { status:'idle', byGroup:{} };
let LEVEL_KEY = null;

function groupForDay(day){ return MUSCLE_CYCLE[(day-1)%5]; }

function exercisesForDay(day){
  const g = groupForDay(day);
  const pool = POOL.byGroup[g.key] || [];
  if(!pool.length) return [];
  const L = LEVELS[LEVEL_KEY];
  const n = Math.min(L.count, pool.length);
  const cycleIndex = Math.floor((day-1)/5);
  const offset = (cycleIndex*L.count) % pool.length;
  const out = [];
  for(let i=0;i<n;i++) out.push(pool[(offset+i)%pool.length]);
  return out;
}

function repsForDay(day){
  const L = LEVELS[LEVEL_KEY];
  const block = Math.min(2, Math.floor((day-1)/10));
  return L.reps[block];
}
/* ---------- fin lógica pura ---------- */

let CONFIG = null;
let poolPromise = null;
let COMPLETED = new Set();
let CURRENT_DAY_SAVED = null;
let currentDay = null, currentSession = [], currentIdx = 0;
let paused = false, pausedAt = 0, restLeft = 0, restEndAt = 0, restWarned = false, restTimerId = null;
let navEpoch = 0;

/* ---------- persistencia ---------- */
function saveLevel(){
  try{ localStorage.setItem(CONFIG.keyPrefix+'level', LEVEL_KEY); }catch(e){}
  if(CONFIG.onSaveLevel) CONFIG.onSaveLevel(LEVEL_KEY);
}
function loadLevel(){ try{ return localStorage.getItem(CONFIG.keyPrefix+'level'); }catch(e){ return null; } }
function saveCompleted(){
  try{ localStorage.setItem(CONFIG.keyPrefix+'completed', JSON.stringify([...COMPLETED])); }catch(e){}
  if(CONFIG.onSaveCompleted) CONFIG.onSaveCompleted([...COMPLETED]);
}
function loadCompleted(){
  try{ const v=localStorage.getItem(CONFIG.keyPrefix+'completed'); return v ? new Set(JSON.parse(v)) : new Set(); }
  catch(e){ return new Set(); }
}
function saveCurrentDay(day){
  try{ localStorage.setItem(CONFIG.keyPrefix+'current', String(day)); }catch(e){}
  if(CONFIG.onSaveCurrentDay) CONFIG.onSaveCurrentDay(day);
}
function loadCurrentDay(){
  try{ const v=localStorage.getItem(CONFIG.keyPrefix+'current'); return v ? parseInt(v,10) : null; }
  catch(e){ return null; }
}

/* ---------- audio/vibración ---------- */
let actx=null;
function initAudio(){
  if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(actx && actx.state==='suspended') actx.resume();
}
function beep(freq,dur,vol){
  if(!actx) return;
  try{
    const o=actx.createOscillator(), g=actx.createGain();
    o.type='sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(vol||0.25, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime+dur);
  }catch(e){}
}
function vibrate(p){ if(navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} }
document.body.addEventListener('touchstart', initAudio, {once:true});
document.body.addEventListener('click', initAudio, {once:true});

/* ---------- datos ---------- */
async function ensurePool(){
  if(POOL.status==='ready') return true;
  if(poolPromise) return poolPromise;
  POOL = { status:'loading', byGroup:{} };
  poolPromise = (async()=>{
    try{
      const responses = await Promise.all(CONFIG.equipmentUrls.map(u=>fetch(u)));
      responses.forEach(res=>{ if(!res.ok) throw new Error('HTTP '+res.status); });
      const datas = await Promise.all(responses.map(r=>r.json()));
      const byGroup = {};
      MUSCLE_CYCLE.forEach(g=>{ byGroup[g.key]=[]; });
      datas.forEach(data=>{
        data.exercises.forEach(e=>{
          if(CONFIG.excludeExercise && CONFIG.excludeExercise(e)) return;
          if(CONFIG.chairTip) e.chairTip = CONFIG.chairTip(e);
          const g = MUSCLE_CYCLE.find(g=>g.bodyParts.includes(e.bodyPart));
          if(g) byGroup[g.key].push(e);
        });
      });
      MUSCLE_CYCLE.forEach(g=>{ byGroup[g.key].sort((a,b)=>a.slug.localeCompare(b.slug)); });
      POOL = { status:'ready', byGroup };
      return true;
    }catch(e){
      POOL = { status:'error', byGroup:{} };
      return false;
    }finally{
      poolPromise = null;
    }
  })();
  return poolPromise;
}

/* ---------- pantallas ---------- */
function showScreen(name){
  navEpoch++;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  document.getElementById(name+'-screen').classList.add('show');
}

function openLevelPicker(){
  stopRestTimer();
  document.getElementById('level-cancel-wrap').style.display = LEVEL_KEY ? '' : 'none';
  showScreen('level');
}

function pickLevel(k){
  LEVEL_KEY = k; saveLevel();
  renderCalendar();
  showScreen('calendar');
}

/* ---------- calendario ---------- */
function renderCalendar(){
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  for(let d=1; d<=30; d++){
    const g = groupForDay(d);
    let cls = 'cal-day';
    if(COMPLETED.has(d)) cls += ' done';
    if(d===CURRENT_DAY_SAVED) cls += ' current';
    const btn = document.createElement('button');
    btn.className = cls;
    btn.innerHTML = `<span class="cal-num">${d}</span><span class="cal-icon">${g.icon}</span>`;
    btn.onclick = ()=>openDayFlow(d);
    grid.appendChild(btn);
  }
  document.getElementById('cal-progress').textContent = `${COMPLETED.size}/30 completados`;
  document.getElementById('cal-level').textContent = `${LEVELS[LEVEL_KEY].icon} ${LEVELS[LEVEL_KEY].label}`;
}

function backToCalendar(){
  stopRestTimer();
  renderCalendar();
  showScreen('calendar');
}

/* ---------- abrir un día ---------- */
async function openDayFlow(d){
  if(POOL.status!=='ready'){
    showScreen('player');
    const myEpoch = navEpoch;
    document.getElementById('player-head').textContent = 'Cargando ejercicios…';
    document.getElementById('ex-img').style.display = 'none';
    document.getElementById('ex-name').textContent = '';
    document.getElementById('ex-reps').textContent = '';
    document.getElementById('player-controls').style.display = 'none';
    document.getElementById('rest-box').classList.remove('show');
    document.getElementById('upcoming-wrap').style.display = 'none';
    const ok = await ensurePool();
    if(myEpoch !== navEpoch) return; // el usuario ya navegó a otra pantalla mientras esperábamos
    if(!ok){
      document.getElementById('player-head').textContent = 'No se pudo cargar (revisa tu internet).';
      return;
    }
  }
  openDay(d);
}

function openDay(day){
  stopRestTimer();
  currentDay = day;
  currentSession = exercisesForDay(day);
  currentIdx = 0;
  CURRENT_DAY_SAVED = day;
  saveCurrentDay(day);
  document.getElementById('upcoming-wrap').style.display = '';
  document.getElementById('player-controls').style.display = 'flex';
  showScreen('player');
  maybeShowEgg(day, renderExercise);
}

/* ---------- easter egg espartano ---------- */
function maybeShowEgg(day, cb){
  if(LEVEL_KEY==='espartano' && day>=21 && day<=30){
    const el = document.getElementById('egg-overlay');
    const txt = document.getElementById('egg-text');
    el.classList.add('show');
    txt.textContent = 'Esparta, mi Esparta famosa por sus hombres, es mi patria.';
    setTimeout(()=>{
      txt.textContent = 'LISTO ESPARTANO';
      setTimeout(()=>{ el.classList.remove('show'); cb(); }, 4000);
    }, 2000);
  } else cb();
}

/* ---------- pantalla de ejercicio ---------- */
function renderExercise(){
  paused = false;
  document.getElementById('rest-box').classList.remove('show');
  document.getElementById('player-controls').style.display = 'flex';
  document.getElementById('upcoming-wrap').style.display = '';

  const g = groupForDay(currentDay);
  document.getElementById('player-head').textContent =
    `Día ${currentDay} · ${g.icon} ${g.label} · ${currentIdx+1}/${currentSession.length}`;

  const ex = currentSession[currentIdx];
  const img = document.getElementById('ex-img');
  const tip = document.getElementById('ex-tip');
  if(ex){
    img.removeAttribute('src');
    img.src = ex.gifUrl; img.alt = ex.name; img.style.display = '';
    document.getElementById('ex-name').textContent = ex.name;
    document.getElementById('ex-reps').textContent = `x ${repsForDay(currentDay)}`;
    if(ex.chairTip){ tip.textContent = '💡 ¿No tienes banco? Usa una silla.'; tip.classList.add('show'); }
    else tip.classList.remove('show');
  } else {
    img.removeAttribute('src'); img.style.display = 'none';
    document.getElementById('ex-name').textContent = 'Sin ejercicios disponibles.';
    document.getElementById('ex-reps').textContent = '';
    tip.classList.remove('show');
  }
  syncPauseUI();
  renderUpcoming();
}

function renderUpcoming(){
  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';
  const rest = currentSession.slice(currentIdx+1);
  rest.forEach(ex=>{
    const row = document.createElement('div');
    row.className = 'up-row';
    row.textContent = ex.name;
    list.appendChild(row);
  });
  document.getElementById('upcoming-wrap').style.display = rest.length ? '' : 'none';
}

function prevExercise(){
  if(paused || currentIdx<=0) return;
  currentIdx--;
  renderExercise();
}

function togglePause(){
  paused = !paused;
  if(paused){ pausedAt = Date.now(); }
  else if(pausedAt){ restEndAt += (Date.now()-pausedAt); pausedAt = 0; }
  syncPauseUI();
}

function syncPauseUI(){
  const label = paused ? '▶' : '⏸';
  const btnEx = document.getElementById('btn-pause'); if(btnEx) btnEx.textContent = label;
  const btnRest = document.getElementById('rest-pause-btn'); if(btnRest) btnRest.textContent = label;
  document.getElementById('btn-done').disabled = paused || !currentSession.length;
  document.getElementById('btn-prev').disabled = paused || currentIdx===0;
}

/* ---------- marcar hecho / descanso ---------- */
function markDone(){
  initAudio();
  if(paused || !currentSession.length) return;
  if(currentIdx >= currentSession.length-1){
    completeSession();
    return;
  }
  startRest();
}

function stopRestTimer(){
  clearInterval(restTimerId);
  restTimerId = null;
  paused = false;
  pausedAt = 0;
}

function startRest(){
  stopRestTimer();
  restEndAt = Date.now() + 30000;
  restWarned = false;
  document.getElementById('player-controls').style.display = 'none';
  const box = document.getElementById('rest-box');
  box.classList.add('show');
  restLeft = 30;
  updateRestUI();
  restTimerId = setInterval(tickRest, 250);
}

function tickRest(){
  if(paused) return;
  restLeft = Math.max(0, Math.ceil((restEndAt-Date.now())/1000));
  if(!restWarned && restLeft<=10 && restLeft>0){
    restWarned = true; vibrate([90,70,90]); beep(1320,0.1,0.28);
  }
  if(restLeft<=0){
    stopRestTimer();
    currentIdx++;
    renderExercise();
    return;
  }
  updateRestUI();
}

function updateRestUI(){
  document.getElementById('rest-timer').textContent = restLeft;
  const next = currentSession[currentIdx+1];
  document.getElementById('rest-next').textContent = next ? `Siguiente: ${next.name}` : 'Último ejercicio';
  syncPauseUI();
}

function completeSession(){
  COMPLETED.add(currentDay);
  saveCompleted();
  document.getElementById('complete-day').textContent = currentDay;
  showScreen('complete');
}

/* ---------- init ---------- */
async function init(config){
  CONFIG = Object.assign({
    keyPrefix:'', equipmentUrls:[], excludeExercise:null, chairTip:null,
    onSaveLevel:null, onSaveCompleted:null, onSaveCurrentDay:null, pullRemoteState:null
  }, config);

  LEVEL_KEY = loadLevel();
  COMPLETED = loadCompleted();
  CURRENT_DAY_SAVED = loadCurrentDay();

  if(CONFIG.pullRemoteState){
    const remote = await CONFIG.pullRemoteState();
    if(remote){
      if(remote.level){ LEVEL_KEY = remote.level; try{ localStorage.setItem(CONFIG.keyPrefix+'level', LEVEL_KEY); }catch(e){} }
      if(remote.currentDay != null){ CURRENT_DAY_SAVED = remote.currentDay; try{ localStorage.setItem(CONFIG.keyPrefix+'current', String(remote.currentDay)); }catch(e){} }
      if(remote.completedDays && remote.completedDays.length){
        COMPLETED = new Set(remote.completedDays);
        try{ localStorage.setItem(CONFIG.keyPrefix+'completed', JSON.stringify([...COMPLETED])); }catch(e){}
      }
    }
  }

  if(LEVEL_KEY && LEVELS[LEVEL_KEY]){
    renderCalendar();
    showScreen('calendar');
  } else {
    LEVEL_KEY = null;
    showScreen('level');
  }
  ensurePool();
}

window.PlanEngine = { init };
