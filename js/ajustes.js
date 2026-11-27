'use strict';
/* =====================================================================
   PESTAÑA · AJUSTES
   ---------------------------------------------------------------------
   Sesión, conexión, copias de seguridad, regla de nómina y alertas.
   Depende de: datos.js, ui.js
   ===================================================================== */

function renderAjustes() {
  const el = $('#tab-ajustes'); const c = getConn(); const hard = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const rc = rangoCiclo(mesActual());
  el.innerHTML = `
    <div class="aj-grid">
      ${renderSesionCard()}
      ${renderAppCard()}
    </div>

    <div class="card ch-card"><div><h3>🩺 Revisar mis datos</h3><div class="small muted">Busca duplicados, transferencias sin pareja, devoluciones huérfanas, saldos imposibles y préstamos que no cuadran.</div></div>
      <button class="btn primary" data-action="chequeo-datos">Revisar ahora</button></div>
    <div class="aj-grid">
      <div class="card"><div class="card-head"><h3>⏭ Mes de nómina</h3></div>
        <label class="chk-line"><input type="checkbox" id="cfg-mesnom" ${mesNominaActivo() ? 'checked' : ''}>
          <span><b>Contar los meses de cobro a cobro</b><small>${mesNominaActivo() ? `Ahora: ${fmtDate(rc.ini)} – ${fmtDate(rc.fin)}` : 'Desactivado: meses naturales'}</small></span></label>
        <div class="form-grid" style="margin-top:12px">
          <div><label>La nómina llega en los últimos (días laborables)</label><input type="number" id="cfg-dias" min="1" max="15" value="${esc(S.ajustes.nomina_dias)}"></div>
          <div><label>Importe mínimo de la nómina (€)</label><input id="cfg-umbral" inputmode="decimal" value="${esc(numInput(S.ajustes.nomina_umbral))}"></div>
          <div class="full actions"><button class="btn ghost" data-action="mov-regla" title="Imputa al mes siguiente los ingresos de los últimos días laborables del mes">Aplicar a los movimientos</button><button class="btn primary" data-action="cfg-save-regla" ${S.connected ? '' : 'disabled'}>Guardar</button></div>
        </div></div>
      <div class="card"><div class="card-head"><h3>🔔 Alertas</h3></div>
        <div class="form-grid">
          <div><label>Gasto extraordinario desde (€)</label><input id="cfg-extra" inputmode="decimal" value="${esc(numInput(S.ajustes.extra_umbral))}"></div>
          <div><label>Fondo de emergencia (meses de gastos)</label><input type="number" id="cfg-fondo" min="1" max="24" value="${esc(S.ajustes.fondo_meses)}"></div>
          <div class="full actions"><button class="btn primary" data-action="cfg-save-alertas" ${S.connected ? '' : 'disabled'}>Guardar</button></div>
        </div></div>
    </div>

    ${renderExportarCard()}
    ${renderCopiasCard()}
    ${renderAccesosCard()}
    ${renderHistorialCard()}

    <details class="card aj-conn" ${S.connected ? '' : 'open'}>
      <summary><h3>🔌 Conexión con Supabase</h3><span class="badge ${S.connected ? 'green' : 'red'}">${S.connected ? 'Conectado' : 'No conectado'}</span></summary>
      <div class="form-grid" style="margin-top:12px">
        <div class="full"><label>Project URL</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxxxxxx.supabase.co" ${hard ? 'disabled' : ''}></div>
        <div class="full"><label>Clave publishable</label><input id="cfg-key" type="password" value="${esc(c.key)}" ${hard ? 'disabled' : ''}>
          <small class="hint">Se guarda solo en este dispositivo. Cambiarla cierra la sesión.</small></div>
        <div class="full actions">${hard ? '' : '<button class="btn ghost" data-action="cfg-clear">Olvidar</button>'}<button class="btn primary" data-action="cfg-save-conn" ${hard ? 'disabled' : ''}>Guardar</button></div>
      </div></details>`;
  cargarListaCopias();
}
function ejemploVentana() {
  const ym = ymOf(todayISO()); const [y, m] = ym.split('-').map(Number);
  for (let d = 1; d <= daysInMonth(y, m); d++) { const iso = `${ym}-${pad(d)}`; if (enVentanaNomina(iso)) return fmtDate(iso); }
  return '—';
}

Views.ajustes = renderAjustes;

Object.assign(Actions, {
  'cfg-save-alertas': async el => {
    const extra_umbral = num($('#cfg-extra').value) || 300, fondo_meses = num($('#cfg-fondo').value) || 6;
    const r = await withSaving(el, () => DB.upsert('ajustes', { clave: 'alertas', valor: { extra_umbral, fondo_meses }, updated_at: new Date().toISOString() }, 'clave'), 'Ajustes de alertas guardados ✓');
    if (r !== FAIL) { S.ajustes.extra_umbral = extra_umbral; S.ajustes.fondo_meses = fondo_meses; render(); }
  },
  'cfg-save-conn': async () => {
    const url = $('#cfg-url').value.trim().replace(/\/+$/, ''), key = $('#cfg-key').value.trim();
    if (!/^https:\/\/.+/.test(url) || !key) { toast('Introduce una URL https válida y la clave', 'warn'); return; }
    if (!(await confirmDlg('Cambiar la conexión cerrará la sesión y recargará la app. ¿Continuar?', 'Continuar', false))) return;
    try { await DB.client.auth.signOut(); } catch (e) { /* noop */ }
    localStorage.setItem('pf_sb_url', url); localStorage.setItem('pf_sb_key', key);
    location.reload();
  },
  'cfg-clear': async () => { if (!(await confirmDlg('¿Borrar la URL y la clave guardadas en este dispositivo?', 'Olvidar'))) return; try { await DB.client.auth.signOut(); } catch (e) { /* noop */ } localStorage.removeItem('pf_sb_url'); localStorage.removeItem('pf_sb_key'); location.reload(); },
  'cfg-save-regla': async el => {
    const dias = parseInt($('#cfg-dias').value, 10) || 5, umbral = num($('#cfg-umbral').value);
    const r = await withSaving(el, () => DB.upsert('ajustes', { clave: 'regla_nomina', valor: { dias, umbral, mes_nomina: $('#cfg-mesnom').checked }, updated_at: new Date().toISOString() }, 'clave'), 'Regla guardada ✓');
    if (r !== FAIL) { S.ajustes.nomina_dias = dias; S.ajustes.nomina_umbral = umbral; S.ajustes.mes_nomina = $('#cfg-mesnom').checked; _ciclos = null; const mA = mesActual(); S.period.ref = mA; S.period.to = mA; render(); }
  }
});
