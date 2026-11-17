'use strict';
/* =====================================================================
   PESTAÑA · AJUSTES
   ---------------------------------------------------------------------
   Sesión, conexión, copias de seguridad, regla de nómina y alertas.
   Depende de: datos.js, ui.js
   ===================================================================== */

function renderAjustes() {
  const el = $('#tab-ajustes'); const c = getConn(); const hard = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  el.innerHTML = `
    <div class="grid-2e">
      ${renderSesionCard()}
      <div class="card"><div class="card-head"><h3>🔌 Conexión con Supabase</h3><span class="badge ${S.connected ? 'green' : 'red'}">${S.connected ? 'Conectado' : 'No conectado'}</span></div>
        ${hard ? '<div class="banner blue">Las claves están fijadas en el código (constantes SUPABASE_URL / SUPABASE_ANON_KEY).</div>' : ''}
        <div class="form-grid">
          <div class="full"><label>Project URL</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxxxxxx.supabase.co" ${hard ? 'disabled' : ''}></div>
          <div class="full"><label>Clave anon / publishable</label><input id="cfg-key" type="password" value="${esc(c.key)}" ${hard ? 'disabled' : ''}>
            <small class="hint">Guardada solo en este navegador. Cambiarla cierra la sesión.</small></div>
          <div class="full actions">${hard ? '' : '<button class="btn ghost" data-action="cfg-clear">Olvidar</button>'}<button class="btn primary" data-action="cfg-save-conn" ${hard ? 'disabled' : ''}>Guardar</button></div>
        </div></div>
    </div>
    ${renderAppCard()}
    ${renderAccesosCard()}
    ${renderHistorialCard()}
    ${renderCopiasCard()}
    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>⏭ Regla de desfase de nómina</h3></div>
        <p class="small muted" style="margin-top:0">Los ingresos recibidos en los <b>últimos N días laborables</b> del mes y de importe ≥ umbral se imputan automáticamente al <b>mes siguiente</b> (al importar y en el registro manual). Puedes cambiarlo en cada movimiento con el botón ⏭.</p>
        <div class="form-grid">
          <div><label>Últimos días laborables (N)</label><input type="number" id="cfg-dias" min="1" max="15" value="${esc(S.ajustes.nomina_dias)}"></div>
          <div><label>Importe mínimo (€)</label><input id="cfg-umbral" inputmode="decimal" value="${esc(numInput(S.ajustes.nomina_umbral))}"></div>
          <div class="full"><label class="chk"><input type="checkbox" id="cfg-mesnom" ${mesNominaActivo() ? 'checked' : ''}> <b>Mes de nómina</b>: cada mes va del día en que cobras al día antes del siguiente cobro (los gastos de después de cobrar cuentan en el mes de esa nómina)</label>
            <small class="hint">${mesNominaActivo() ? `Mes actual: <b>${ymLabel(mesActual())}</b>, del ${fmtDate(rangoCiclo(mesActual()).ini)} al ${fmtDate(rangoCiclo(mesActual()).fin)}${ciclosNomina().inicio[addMonths(mesActual(), 1)] ? '' : ' (fin estimado hasta que llegue la próxima nómina)'}.` : 'Desactivado: se usan meses naturales (del 1 al último día).'}</small></div>
          <div class="full small muted">Ejemplo con N = ${S.ajustes.nomina_dias}: en ${ymLabel(ymOf(todayISO()))} se imputarían al mes siguiente los ingresos desde el ${ejemploVentana()}.</div>
          <div class="full actions"><button class="btn primary" data-action="cfg-save-regla" ${S.connected ? '' : 'disabled'}>Guardar regla</button></div>
        </div></div>
      <div class="card"><div class="card-head"><h3>🔔 Alertas y consejos del Dashboard</h3></div>
        <div class="form-grid">
          <div><label>Gasto extraordinario a partir de (€)</label><input id="cfg-extra" inputmode="decimal" value="${esc(numInput(S.ajustes.extra_umbral))}"><small class="hint">Además debe superar 2,5 veces lo habitual en su categoría</small></div>
          <div><label>Objetivo fondo de emergencia (meses de gastos)</label><input type="number" id="cfg-fondo" min="1" max="24" value="${esc(S.ajustes.fondo_meses)}"></div>
          <div class="full actions"><button class="btn primary" data-action="cfg-save-alertas" ${S.connected ? '' : 'disabled'}>Guardar</button></div>
        </div></div>
    </div>
    <div class="card"><div class="card-head"><h3>ℹ️ Rutina recomendada</h3><span class="badge navy">Versión ${APP_VERSION}</span></div>
      <ol class="small" style="line-height:1.7;padding-left:18px;margin:0">
        <li>Cada domingo: importa el Excel de Unicaja de la semana y contesta lo que la app no sepa categorizar.</li>
        <li>Al momento: gastos en efectivo con el botón verde <b>+</b>.</li>
        <li>Cada mes: revisa el Dashboard y sus alertas.</li>
        <li>Cada trimestre: actualiza el valor de inversiones, el €/m² de los inmuebles y el capital pendiente de la hipoteca, y guarda la foto en 📸 Auditoría.</li>
      </ol></div>`;
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
