'use strict';
/* =====================================================================
   PESTAÑA · AJUSTES
   ---------------------------------------------------------------------
   Conexión, regla de nómina, alertas y copia de seguridad.
   Depende de: datos.js, ui.js
   ===================================================================== */

function renderAjustes() {
  const el = $('#tab-ajustes'); const c = getConn(); const hard = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  el.innerHTML = `
    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>🔌 Conexión con Supabase</h3><span class="badge ${S.connected ? 'green' : 'red'}">${S.connected ? 'Conectado' : 'No conectado'}</span></div>
        ${hard ? '<div class="banner blue">Las claves están fijadas en el código (constantes SUPABASE_URL / SUPABASE_ANON_KEY).</div>' : ''}
        <div class="form-grid">
          <div class="full"><label>Project URL</label><input id="cfg-url" value="${esc(c.url)}" placeholder="https://xxxxxxxx.supabase.co" ${hard ? 'disabled' : ''}></div>
          <div class="full"><label>Clave anon / publishable</label><input id="cfg-key" type="password" value="${esc(c.key)}" placeholder="eyJhbGciOi… o sb_publishable_…" ${hard ? 'disabled' : ''}>
            <small class="hint">Se guarda solo en este navegador (localStorage). Hazlo una vez en el ordenador y otra en el móvil.</small></div>
          <div class="full actions">${hard ? '' : '<button class="btn ghost" data-action="cfg-clear">Olvidar</button>'}<button class="btn primary" data-action="cfg-save-conn" ${hard ? 'disabled' : ''}>Guardar y conectar</button></div>
        </div></div>
      <div class="card"><div class="card-head"><h3>⏭ Regla de desfase de nómina</h3></div>
        <p class="small muted" style="margin-top:0">Los ingresos recibidos en los <b>últimos N días laborables</b> del mes y de importe ≥ umbral se imputan automáticamente al <b>mes siguiente</b> (al importar y en el registro manual). Puedes cambiarlo en cada movimiento con el botón ⏭.</p>
        <div class="form-grid">
          <div><label>Últimos días laborables (N)</label><input type="number" id="cfg-dias" min="1" max="15" value="${esc(S.ajustes.nomina_dias)}"></div>
          <div><label>Importe mínimo (€)</label><input id="cfg-umbral" inputmode="decimal" value="${esc(numInput(S.ajustes.nomina_umbral))}"></div>
          <div class="full small muted">Ejemplo con N = ${S.ajustes.nomina_dias}: en ${ymLabel(ymOf(todayISO()))} se imputarían al mes siguiente los ingresos desde el ${ejemploVentana()}.</div>
          <div class="full actions"><button class="btn primary" data-action="cfg-save-regla" ${S.connected ? '' : 'disabled'}>Guardar regla</button></div>
        </div></div>
    </div>
    <div class="card"><div class="card-head"><h3>🔔 Alertas y consejos del Dashboard</h3></div>
      <div class="form-grid">
        <div><label>Gasto extraordinario a partir de (€)</label><input id="cfg-extra" inputmode="decimal" value="${esc(numInput(S.ajustes.extra_umbral))}"><small class="hint">Además debe superar 2,5 veces lo habitual en su categoría</small></div>
        <div><label>Objetivo fondo de emergencia (meses de gastos)</label><input type="number" id="cfg-fondo" min="1" max="24" value="${esc(S.ajustes.fondo_meses)}"></div>
        <div class="full actions"><button class="btn primary" data-action="cfg-save-alertas" ${S.connected ? '' : 'disabled'}>Guardar</button></div>
      </div></div>
    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>💾 Copia de seguridad</h3></div>
        <p class="small muted" style="margin-top:0">Descarga todos tus datos en JSON. Recomendado una vez al trimestre, junto con la foto patrimonial.</p>
        <button class="btn" data-action="cfg-export" ${S.connected ? '' : 'disabled'}>Descargar copia (.json)</button></div>
      <div class="card"><div class="card-head"><h3>ℹ️ Primeros pasos</h3><span class="badge navy">Versión ${APP_VERSION}</span></div>
        <ol class="small" style="line-height:1.7;padding-left:18px;margin:0">
          <li>Ejecuta <code>supabase_schema.sql</code> en el SQL Editor de Supabase.</li>
          <li>Pega aquí la URL y la clave anon y pulsa “Guardar y conectar”.</li>
          <li>En 💳 Cuentas, pulsa “Conciliar saldo” en cada cuenta con su saldo real de hoy.</li>
          <li>Completa hipoteca, inmueble y vehículos con sus datos reales.</li>
          <li>Cada domingo: importa el Excel de Unicaja de la semana.</li>
          <li>Cada fin de trimestre: actualiza valores y guarda la foto en 📸 Auditoría.</li>
        </ol></div>
    </div>`;
}
function ejemploVentana() {
  const ym = ymOf(todayISO()); const [y, m] = ym.split('-').map(Number);
  for (let d = 1; d <= daysInMonth(y, m); d++) { const iso = `${ym}-${pad(d)}`; if (enVentanaNomina(iso)) return fmtDate(iso); }
  return '—';
}
function exportJSON() {
  const data = { exportado: new Date().toISOString(), cuentas: S.cuentas, categorias: S.categorias, movimientos: S.movimientos, inmuebles: S.inmuebles, vehiculos: S.vehiculos, deudas: S.deudas, snapshots: S.snapshots, valoraciones: S.valoraciones, ajustes: S.ajustes };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `patrimonio_backup_${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
    localStorage.setItem('pf_sb_url', url); localStorage.setItem('pf_sb_key', key);
    await loadAll();
    if (S.connected) { toast('Conectado a Supabase ✓', 'ok'); S.tab = 'dashboard'; render(); }
  },
  'cfg-clear': async () => { if (!(await confirmDlg('¿Borrar la URL y la clave guardadas en este dispositivo?', 'Olvidar'))) return; localStorage.removeItem('pf_sb_url'); localStorage.removeItem('pf_sb_key'); S.connected = false; setConn('', 'Sin configurar'); render(); },
  'cfg-save-regla': async el => {
    const dias = parseInt($('#cfg-dias').value, 10) || 5, umbral = num($('#cfg-umbral').value);
    const r = await withSaving(el, () => DB.upsert('ajustes', { clave: 'regla_nomina', valor: { dias, umbral }, updated_at: new Date().toISOString() }, 'clave'), 'Regla guardada ✓');
    if (r !== FAIL) { S.ajustes.nomina_dias = dias; S.ajustes.nomina_umbral = umbral; render(); }
  },
  'cfg-export': () => exportJSON()
});
