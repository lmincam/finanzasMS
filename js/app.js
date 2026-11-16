'use strict';
/* =====================================================================
   ARRANQUE Y NAVEGACIÓN
   ---------------------------------------------------------------------
   Pinta la pestaña activa, delega los eventos en los registros y arranca la app.
   Se carga el ÚLTIMO.
   Depende de: todos los módulos
   ===================================================================== */

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-action="tab" data-tab="${k}" class="${S.tab === k ? 'active' : ''}">${l}</button>`).join('');
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + S.tab));
}
function render() {
  _deudaCache = new Map();
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
  tab: el => { S.tab = el.dataset.tab; history.replaceState(null, '', '#' + S.tab); render(); window.scrollTo({ top: 0 }); },
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const x = $$('.modal-x').pop(); if (x) x.click(); } });
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.some(t => t[0] === h) && h !== S.tab) { S.tab = h; render(); } });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.tab === 'dashboard') render(); }, 400); });
}

(function boot() {
  const v = $('#app-version'); if (v) v.textContent = 'v' + APP_VERSION;
  const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
  setupChartDefaults();
  bindEvents();
  if (!window.supabase) toast('No se pudo cargar la librería de Supabase. Revisa tu conexión.', 'err', 6000);
  if (!getConn().url) { S.tab = 'ajustes'; setConn('', 'Sin configurar'); render(); return; }
  loadAll();
})();
