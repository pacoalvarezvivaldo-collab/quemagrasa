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
