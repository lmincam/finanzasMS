'use strict';
/* =====================================================================
   ARRANQUE Y NAVEGACIÓN
   ---------------------------------------------------------------------
   Pinta la pestaña activa, delega los eventos en los registros y arranca la app.
   Se carga el ÚLTIMO.
   Depende de: todos los módulos
   ===================================================================== */

/** Navegación: 5 secciones (arriba en el ordenador, barra inferior en el móvil) y, dentro de cada una, sus pestañas. */
S.ultimaSub = S.ultimaSub || {};
function renderTabs() {
  const sec = seccionDe(S.tab); S.ultimaSub[sec.k] = S.tab;
  const nombre = k => (TABS.find(t => t[0] === k) || [k, k])[1];
  const btnSec = (x, cls) => `<button class="${cls} ${x.k === sec.k ? 'active' : ''}" data-action="sec" data-sec="${x.k}" aria-label="${x.l}">${icono(x.i)}<span>${x.l}</span></button>`;
  // Ordenador: igual que en el móvil — Ajustes se abre desde el círculo del usuario y el + va en medio de la barra
  const visibles = SECCIONES.filter(x => x.k !== 'ajustes');
  $('#tabs').innerHTML = `<div class="nav-l">${visibles.slice(0, 2).map(x => btnSec(x, 'nav-sec')).join('')}</div>`
    + `<button class="nav-plus" data-action="quick-open" data-tipo="gasto" aria-label="Registrar movimiento" title="Registrar un movimiento">${icono('plus')}</button>`
    + `<div class="nav-r">${visibles.slice(2).map(x => btnSec(x, 'nav-sec')).join('')}</div>`;
  const bn = $('#bottomnav');
  if (bn) bn.innerHTML = SECCIONES.slice(0, 2).map(x => btnSec(x, 'bn-item')).join('')
    + `<button class="bn-plus" data-action="quick-open" data-tipo="gasto" aria-label="Registrar movimiento">${icono('plus')}</button>`
    + SECCIONES.slice(2).filter(x => x.k !== 'ajustes').map(x => btnSec(x, 'bn-item')).join('');
  const uc = $('#user-chip'); if (uc) uc.classList.toggle('active', S.tab === 'ajustes');
  const sub = $('#subtabs');
  if (sub && sec.resumen) {
    // Secciones con resumen: sin pestañas; en cada apartado, una barra para volver al resumen
    sub.hidden = S.tab === sec.resumen;
    sub.innerHTML = S.tab === sec.resumen ? '' : `<div class="subtabs-in sub-back"><button data-action="tab" data-tab="${sec.resumen}">${esc(sec.l)}</button><span class="sb-sep">›</span><span class="sb-cur">${esc(nombre(S.tab))}</span></div>`;
  } else if (sub) { sub.hidden = sec.tabs.length < 2;
    sub.innerHTML = sec.tabs.length < 2 ? '' : `<div class="subtabs-in">${sec.tabs.map(k => `<button class="${k === S.tab ? 'active' : ''}" data-action="tab" data-tab="${k}">${esc(nombre(k))}</button>`).join('')}</div>`;
    const act = sub.querySelector('.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + S.tab));
}
function openMenu() { const d = $('#drawer'); if (!d) return; d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); }
function closeMenu() { const d = $('#drawer'); if (!d || !d.classList.contains('open')) return false; d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); return true; }
function render() {
  _deudaCache = new Map();
  document.body.classList.toggle('clasico', S.tab === 'dashboard' || S.tab === 'cuentas');
  const ob = $('#offline-bar'); if (ob) { ob.hidden = !S.offline; if (S.offline) { const d = new Date(S.offline); ob.innerHTML = `📴 Sin conexión · datos guardados el ${d.toLocaleDateString('es-ES')} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · solo lectura`; } }
  destroyCharts();
  renderTabs();
  const el = $('#tab-' + S.tab);
  if (!S.connected && S.tab !== 'ajustes') {
    el.innerHTML = `<div class="card"><div class="empty">🔌 La aplicación aún no está conectada a Supabase.<br><br>
      <button class="btn primary" data-action="tab" data-tab="ajustes">Ir a ⚙️ Ajustes para configurarla</button></div></div>`;
    return;
  }
  try { (Views[S.tab] || Views.dashboard)(); }
  catch (e) { console.error(e); el.innerHTML = `<div class="banner red">Error al pintar esta pestaña: ${esc(e.message)}</div>`; }
}

Object.assign(Actions, {
  tab: el => { closeMenu(); if (el.dataset.tab !== S.tab) { S.invSim = false; S.invSel = null; } S.tab = el.dataset.tab; history.replaceState(null, '', '#' + S.tab); render(); window.scrollTo({ top: 0 }); },
  sec: el => { const x = SECCIONES.find(s => s.k === el.dataset.sec); if (!x) return;
    const destino = x.resumen || (x.k === seccionDe(S.tab).k ? x.tabs[0] : (S.ultimaSub[x.k] || x.tabs[0]));
    if (x.k === 'inicio') { S.dashCal = false; S.dashDet = null; S.dashCierre = null; }
    S.tab = destino; history.replaceState(null, '', '#' + S.tab); render(); window.scrollTo({ top: 0 }); },
  'menu-open': () => openMenu(),
  'menu-close': () => closeMenu(),
  refresh: () => loadAll()
});

function bindEvents() {
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-action]'); if (!t || t.disabled) return;
    const fn = Actions[t.dataset.action]; if (!fn) return;
    e.preventDefault();
    try { await fn(t, e); } catch (err) { console.error(err); toast(err.message || String(err), 'err'); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    for (const f of ChangeFilters) if (f(t)) return;
    const h = Changes[t.id]; if (h) h(t);
  });
  document.addEventListener('input', debounce(e => { const h = Inputs[e.target.id]; if (h) h(e.target); }, 250));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const x = $$('.modal-x').pop(); if (x) x.click(); else closeMenu(); } });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.some(t => t[0] === h) && h !== S.tab) { S.tab = h; render(); } });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.tab === 'dashboard') render(); }, 400); });
}

(function boot() {
  const v = $('#app-version'); if (v) v.textContent = 'v' + APP_VERSION;
  const dv = $('#drawer-version'); if (dv) dv.textContent = 'v' + APP_VERSION;
  const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
  setupChartDefaults();
  Tema.aplicar();
  bindEvents();
  // La cabecera es fija: el contenido empieza justo debajo de su altura real (cambia en móvil, al rotar o con la barra offline)
  const hdr = $('.sticky');
  if (hdr) { const fit = () => document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px'); fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(hdr); else window.addEventListener('resize', fit); }
  iniciarPWA();
  if (!window.supabase) { toast('No se pudo cargar la librería de Supabase. Revisa tu conexión.', 'err', 6000); return; }
  arrancarAuth();
})();
