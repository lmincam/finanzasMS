'use strict';
/* =====================================================================
   PESTAÑA · AUDITORÍA TRIMESTRAL
   ---------------------------------------------------------------------
   Fotos patrimoniales por trimestre y evolución histórica.
   Depende de: datos.js, calculos.js, ui.js, graficos.js
   ===================================================================== */

function renderAuditoria() {
  const el = $('#tab-auditoria');
  const P = Calc.patrimonio(), t = todayISO(), y = +t.slice(0, 4), q = quarterOf(t);
  const snaps = [...S.snapshots].sort((a, b) => (a.anio - b.anio) || (a.trimestre - b.trimestre));
  const find = (yy, qq) => snaps.find(s => s.anio === yy && s.trimestre === qq);
  const anios = [...new Set(snaps.map(s => s.anio))];
  el.innerHTML = `
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>📸 Foto patrimonial actual</h3><span class="sub">${fmtDate(t)}</span></div>
        <div class="metrics">
          ${metric('Liquidez', fmtEUR(P.liquidez, 0))}${metric('Inversiones', fmtEUR(P.inversiones, 0))}${metric('Inmuebles', fmtEUR(P.inmuebles, 0))}
          ${metric('Vehículos', fmtEUR(P.vehiculos, 0))}${metric('Deudas', '−' + fmtEUR(P.deudas, 0), 'neg')}${metric('PATRIMONIO NETO', fmtEUR(P.neto, 0), 'pos')}
        </div>
        <div class="form-grid" style="margin-top:14px">
          <div><label>Año</label><input type="number" id="snap-anio" value="${y}"></div>
          <div><label>Trimestre</label><select id="snap-q">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === q ? 'selected' : ''}>Q${n} (${['ene–mar', 'abr–jun', 'jul–sep', 'oct–dic'][n - 1]})</option>`).join('')}</select></div>
          <div class="full"><label>Notas del trimestre</label><input id="snap-notas" placeholder="Ej: revalorización piso, aportación extra…"></div>
          <div class="full actions"><button class="btn success" data-action="snap-save">Guardar foto del trimestre</button></div>
        </div>
        <p class="small muted" style="margin-bottom:0">Antes de guardar, actualiza el valor de las inversiones, inmuebles, vehículos y el capital pendiente de la hipoteca para que la foto sea fiel.</p>
      </div>
      <div class="card"><div class="card-head"><h3>Evolución anual</h3><span class="sub">Último snapshot de cada año</span></div>
        ${anios.length ? `<table class="tbl"><thead><tr><th>Año</th><th class="right">Neto cierre</th><th class="right">Δ vs año anterior</th></tr></thead><tbody>
          ${anios.map((a, i) => { const last = snaps.filter(s => s.anio === a).pop(); const prev = i ? snaps.filter(s => s.anio === anios[i - 1]).pop() : null; const dlt = prev ? num(last.patrimonio_neto) - num(prev.patrimonio_neto) : null;
            return `<tr><td>${a} <span class="small muted">(Q${last.trimestre})</span></td><td class="right num"><b>${fmtEUR(last.patrimonio_neto, 0)}</b></td><td class="right num ${dlt === null ? 'muted' : dlt >= 0 ? 'pos' : 'neg'}">${dlt === null ? '—' : signed(dlt) + (num(prev.patrimonio_neto) ? ` (${fmtPct(dlt / Math.abs(num(prev.patrimonio_neto)))})` : '')}</td></tr>`; }).join('')}</tbody></table>`
        : '<div class="empty">Aún no hay snapshots guardados.</div>'}
      </div>
    </div>
    ${renderMensualCard()}
    <div class="card"><div class="card-head"><h3>Evolución trimestral del patrimonio</h3></div>
      ${snaps.length ? '<div class="chart-box"><canvas id="ch-snap"></canvas></div>' : '<div class="empty">Guarda tu primera foto trimestral para ver la evolución.</div>'}</div>
    ${snaps.length ? `<div class="card"><div class="card-head"><h3>Histórico de snapshots</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>Periodo</th><th>Fecha</th><th class="right">Liquidez</th><th class="right">Inversiones</th><th class="right">Inmuebles</th><th class="right">Vehículos</th><th class="right">Deudas</th><th class="right">Neto</th><th class="right">Δ trimestral</th><th class="right">Δ interanual</th><th></th></tr></thead><tbody>
      ${snaps.slice().reverse().map(s => {
        const idx = snaps.indexOf(s), prev = idx > 0 ? snaps[idx - 1] : null, yoy = find(s.anio - 1, s.trimestre);
        const dq = prev ? num(s.patrimonio_neto) - num(prev.patrimonio_neto) : null, dy = yoy ? num(s.patrimonio_neto) - num(yoy.patrimonio_neto) : null;
        return `<tr><td><b>Q${s.trimestre} ${s.anio}</b>${s.notas ? `<div class="small muted">${esc(s.notas)}</div>` : ''}</td><td class="small">${fmtDate(s.fecha)}</td>
          <td class="right num">${fmtEUR(s.liquidez, 0)}</td><td class="right num">${fmtEUR(s.inversiones, 0)}</td><td class="right num">${fmtEUR(s.inmuebles, 0)}</td><td class="right num">${fmtEUR(s.vehiculos, 0)}</td>
          <td class="right num neg">−${fmtEUR(s.deudas, 0)}</td><td class="right num"><b>${fmtEUR(s.patrimonio_neto, 0)}</b></td>
          <td class="right num ${dq === null ? 'muted' : dq >= 0 ? 'pos' : 'neg'}">${dq === null ? '—' : signed(dq)}</td><td class="right num ${dy === null ? 'muted' : dy >= 0 ? 'pos' : 'neg'}">${dy === null ? '—' : signed(dy)}</td>
          <td><button class="mini" data-action="snap-del" data-id="${s.id}">🗑</button></td></tr>`;
      }).join('')}</tbody></table></div></div>` : ''}`;
  if (snaps.length) mkChart('ch-snap', {
    type: 'bar',
    data: {
      labels: snaps.map(s => `Q${s.trimestre} ${s.anio}`),
      datasets: [
        { label: 'Liquidez', data: snaps.map(s => num(s.liquidez)), backgroundColor: '#0891b2', stack: 's', order: 2 },
        { label: 'Inversiones', data: snaps.map(s => num(s.inversiones)), backgroundColor: '#7c3aed', stack: 's', order: 2 },
        { label: 'Inmuebles', data: snaps.map(s => num(s.inmuebles)), backgroundColor: '#1e3a8a', stack: 's', order: 2 },
        { label: 'Vehículos', data: snaps.map(s => num(s.vehiculos)), backgroundColor: '#ca8a04', stack: 's', order: 2 },
        { label: 'Deudas', data: snaps.map(s => -num(s.deudas)), backgroundColor: '#fca5a5', stack: 's', order: 2 },
        { type: 'line', label: 'Patrimonio neto', data: snaps.map(s => num(s.patrimonio_neto)), borderColor: '#16a34a', backgroundColor: '#16a34a', borderWidth: 3, tension: .25, order: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true, grid: { display: false } }, y: { ...euroAxis, stacked: true } } }
  });
  chartMensual();
}
async function snapSave(btn) {
  const anio = parseInt($('#snap-anio').value, 10), trimestre = parseInt($('#snap-q').value, 10);
  if (!anio || !trimestre) { toast('Indica año y trimestre', 'warn'); return; }
  const prev = S.snapshots.find(s => s.anio === anio && s.trimestre === trimestre);
  if (prev && !(await confirmDlg(`Ya existe una foto de <b>Q${trimestre} ${anio}</b> (${fmtEUR(prev.patrimonio_neto, 0)}). ¿Sobrescribirla con los valores actuales?`, 'Sobrescribir', false))) return;
  const P = Calc.patrimonio();
  const row = {
    anio, trimestre, fecha: todayISO(), liquidez: round2(P.liquidez), inversiones: round2(P.inversiones), inmuebles: round2(P.inmuebles),
    vehiculos: round2(P.vehiculos), deudas: round2(P.deudas), patrimonio_neto: round2(P.neto), notas: $('#snap-notas').value.trim() || (prev ? prev.notas : null),
    detalle: {
      cuentas: P.det.map(d => ({ ...d, valor: round2(d.valor) })),
      inmuebles: S.inmuebles.map(i => ({ nombre: i.nombre, valor: num(i.valor_mercado) })),
      vehiculos: S.vehiculos.map(v => ({ nombre: v.nombre, valor: num(v.valor_actual) })),
      deudas: S.deudas.map(d => ({ nombre: d.nombre, pendiente: deudaInfo(d).pendienteHoy }))
    }
  };
  const r = await withSaving(btn, async () => { if (prev) await DB.update('snapshots', prev.id, row); else await DB.insert('snapshots', [row]); await reloadTable('snapshots'); }, `Foto Q${trimestre} ${anio} guardada ✓`);
  if (r !== FAIL) render();
}

/* ---------- Evolución mensual automática ---------- */
/** Guarda (o actualiza) la foto del patrimonio del mes actual. Se ejecuta cada vez que se abre la app. */
async function fotoMensual() {
  if (!S.v5) return;
  const P = Calc.patrimonio(), ym = ymOf(todayISO());
  const row = { anio_mes: ym, fecha: todayISO(), liquidez: round2(P.liquidez), inversiones: round2(P.inversiones), inmuebles: round2(P.inmuebles),
    vehiculos: round2(P.vehiculos), deudas: round2(P.deudas), patrimonio_neto: round2(P.neto), detalle: { cuentas: P.det.map(d => ({ ...d, valor: round2(d.valor) })) }, updated_at: new Date().toISOString() };
  const prev = S.patrimonio_mensual.find(x => x.anio_mes === ym);
  if (prev && prev.fecha === row.fecha && num(prev.patrimonio_neto) === row.patrimonio_neto) return;
  await DB.upsert('patrimonio_mensual', row, 'anio_mes');
  await reloadTable('patrimonio_mensual');
}
AfterLoad.push(fotoMensual);
function renderMensualCard() {
  if (!S.v5) return '<div class="card"><div class="card-head"><h3>Evolución mensual del patrimonio</h3></div><div class="banner amber">Ejecuta <code>sql/esquema_completo.sql</code> para guardar automáticamente la evolución mensual.</div></div>';
  const ms = [...S.patrimonio_mensual].sort((a, b) => a.anio_mes < b.anio_mes ? -1 : 1);
  if (!ms.length) return '';
  const ult = ms.slice(-13);
  const rows = ult.map((m, i) => { const p = i ? ult[i - 1] : null; return { m, d: p ? num(m.patrimonio_neto) - num(p.patrimonio_neto) : null }; }).reverse();
  const anio = ms.filter(m => m.anio_mes.startsWith(todayISO().slice(0, 4))), primero = anio[0], ultimo = ms[ms.length - 1];
  const prevDic = ms.filter(m => m.anio_mes < todayISO().slice(0, 4)).pop();
  const ytd = prevDic ? num(ultimo.patrimonio_neto) - num(prevDic.patrimonio_neto) : (primero ? num(ultimo.patrimonio_neto) - num(primero.patrimonio_neto) : null);
  return `<div class="card"><div class="card-head"><h3>📅 Evolución mensual del patrimonio</h3><span class="sub">Automática: se actualiza cada vez que abres la app · ${ms.length} mes(es)</span></div>
    <div class="metrics" style="margin-bottom:12px">
      ${metric('Patrimonio neto actual', fmtEUR(ultimo.patrimonio_neto, 0))}
      ${metric('Variación último mes', rows[0] && rows[0].d !== null ? signed(rows[0].d) : '—', rows[0] && rows[0].d >= 0 ? 'pos' : 'neg')}
      ${metric(`En lo que va de ${todayISO().slice(0, 4)}`, ytd !== null ? signed(ytd) : '—', ytd >= 0 ? 'pos' : 'neg')}
      ${metric('Media mensual', ms.length > 1 ? signed((num(ultimo.patrimonio_neto) - num(ms[0].patrimonio_neto)) / (ms.length - 1)) : '—')}
    </div>
    ${ms.length > 1 ? '<div class="chart-box sm"><canvas id="ch-mensual"></canvas></div>' : '<p class="small muted">El mes que viene empezarás a ver la evolución.</p>'}
    <details style="margin-top:8px"><summary>Detalle por mes</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mes</th><th class="right">Liquidez</th><th class="right">Inversiones</th><th class="right">Inmuebles</th><th class="right">Vehículos</th><th class="right">Deudas</th><th class="right">Neto</th><th class="right">Δ mes</th></tr></thead><tbody>
      ${rows.map(({ m, d }) => `<tr><td>${ymLabel(m.anio_mes, true)}</td><td class="right num">${fmtEUR(m.liquidez, 0)}</td><td class="right num">${fmtEUR(m.inversiones, 0)}</td><td class="right num">${fmtEUR(m.inmuebles, 0)}</td><td class="right num">${fmtEUR(m.vehiculos, 0)}</td>
        <td class="right num neg">−${fmtEUR(m.deudas, 0)}</td><td class="right num"><b>${fmtEUR(m.patrimonio_neto, 0)}</b></td><td class="right num ${d === null ? 'muted' : d >= 0 ? 'pos' : 'neg'}">${d === null ? '—' : signed(d)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
}
function chartMensual() {
  const ms = [...S.patrimonio_mensual].sort((a, b) => a.anio_mes < b.anio_mes ? -1 : 1);
  if (ms.length < 2) return;
  mkChart('ch-mensual', { type: 'bar', data: { labels: ms.map(m => ymLabel(m.anio_mes, true)), datasets: [
    { type: 'line', label: 'Patrimonio neto', data: ms.map(m => num(m.patrimonio_neto)), borderColor: '#16a34a', backgroundColor: '#16a34a', borderWidth: 3, tension: .25, yAxisID: 'y', order: 1 },
    { label: 'Variación mensual', data: ms.map((m, i) => i ? round2(num(m.patrimonio_neto) - num(ms[i - 1].patrimonio_neto)) : 0), backgroundColor: ms.map((m, i) => i && num(m.patrimonio_neto) < num(ms[i - 1].patrimonio_neto) ? '#fca5a5' : '#bbf7d0'), yAxisID: 'y1', order: 2 }
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    scales: { y: euroAxis, y1: { ...euroAxis, position: 'right', grid: { display: false } }, x: { grid: { display: false } } } } });
}

Views.auditoria = renderAuditoria;

Object.assign(Actions, {
  'snap-save': el => snapSave(el),
  'snap-del': async el => { const s = S.snapshots.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar la foto de <b>Q${s.trimestre} ${s.anio}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('snapshots', s.id); await reloadTable('snapshots'); }, 'Eliminada'); render(); }
});
