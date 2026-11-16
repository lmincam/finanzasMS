'use strict';
/* =====================================================================
   PESTAÑA · DEUDAS Y PASIVOS
   ---------------------------------------------------------------------
   Hipoteca y préstamos: cuadro de amortización, gráfico y simulador.
   Depende de: datos.js, calculos.js, ui.js, graficos.js
   ===================================================================== */

function renderDeudas() {
  const el = $('#tab-deudas');
  const list = S.deudas;
  const tot = sum(list.filter(d => d.activa !== false), d => deudaInfo(d).pendienteHoy);
  const totCuota = sum(list.filter(d => d.activa !== false), d => deudaInfo(d).cuota);
  el.innerHTML = `
    <div class="section-head"><div><h2>🏦 Deudas y pasivos</h2><div class="small muted">Pendiente total ${fmtEUR(tot)} · Cuotas ${fmtEUR(totCuota)}/mes</div></div><button class="btn" data-action="deu-new">+ Préstamo</button></div>
    ${list.map((d, k) => {
      const I = deudaInfo(d);
      const totalCuotas = (I.pagadas || 0) + (I.restantes || 0);
      return `<div class="card">
        <div class="asset-head"><div class="asset-ico">🏦</div><div style="flex:1"><h3>${esc(d.nombre)} ${d.activa === false ? '<span class="badge">Cancelada</span>' : ''}</h3>
          <div class="small muted">${TIPO_DEUDA[d.tipo] || ''}${d.entidad ? ' · ' + esc(d.entidad) : ''} · Interés ${d.tipo_interes || 'fijo'} ${fmtNum(num(d.interes), 2)} %</div></div>
          <button class="btn sm" data-action="deu-pend" data-id="${d.id}">Actualizar pendiente</button>
          <button class="mini" data-action="deu-edit" data-id="${d.id}">✎</button><button class="mini" data-action="deu-del" data-id="${d.id}">🗑</button></div>
        ${!I.viable ? '<div class="banner red">⚠ La cuota no cubre los intereses: revisa cuota e interés.</div>' : ''}
        ${!num(d.capital_inicial) && !num(d.capital_pendiente) ? '<div class="banner blue">Completa los datos del préstamo (✎): capital inicial, fecha de inicio, plazo, interés, cuota y capital pendiente.</div>' : ''}
        <div class="metrics">
          ${metric('Capital inicial', fmtEUR(d.capital_inicial, 0))}
          ${metric(`Capital pendiente ${I.estimado ? '(estimado hoy)' : ''}`, fmtEUR(I.pendienteHoy), 'neg')}
          ${metric('Cuota mensual', fmtEUR(I.cuota))}
          ${metric('Cuotas pagadas', I.pagadas !== null ? fmtNum(I.pagadas, 0) : '—')}
          ${metric('Cuotas restantes', I.restantes !== null ? fmtNum(I.restantes, 0) : '—')}
          ${metric('Fin estimado', I.fin ? ymLabel(I.fin) : '—')}
          ${metric('Intereses pendientes', fmtEUR(I.interesesPendientes, 0), 'warn-t')}
          ${metric('Plazo contractual', d.plazo_meses ? `${fmtNum(d.plazo_meses, 0)} meses` : '—')}
        </div>
        ${I.pctAmort !== null ? `<div style="margin-top:12px"><div class="small muted" style="margin-bottom:5px">Amortizado: <b>${fmtPct(I.pctAmort)}</b> del capital · ${totalCuotas ? `${fmtNum(I.pagadas || 0, 0)} de ~${fmtNum(totalCuotas, 0)} cuotas` : ''}</div>${pctBar(I.pctAmort, 'navy')}</div>` : ''}
        ${I.sched.length ? `<div class="chart-box sm" style="margin-top:14px"><canvas id="ch-deu-${k}"></canvas></div>` : ''}
        ${I.sched.length ? `<div class="sub-title">Simulador de amortización anticipada</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="sim-${d.id}" inputmode="decimal" placeholder="Importe extra (€)" style="max-width:200px"><button class="btn sm" data-action="deu-sim" data-id="${d.id}">Simular</button></div>
          <div id="simres-${d.id}" style="margin-top:10px"></div>
          <details style="margin-top:10px"><summary>Cuadro de amortización anual (proyección)</summary>${schedTable(I.sched)}</details>` : ''}
        ${d.notas ? `<div class="notes">${esc(d.notas)}</div>` : ''}
      </div>`;
    }).join('') || '<div class="card empty">Sin préstamos registrados</div>'}`;
  list.forEach((d, k) => {
    const I = deudaInfo(d); if (!I.sched.length) return;
    const Y = yearly(I.sched);
    mkChart(`ch-deu-${k}`, {
      type: 'bar',
      data: {
        labels: Y.map(y => y.anio),
        datasets: [
          { label: 'Capital amortizado', data: Y.map(y => round2(y.capital)), backgroundColor: '#1e3a8a', stack: 'c', yAxisID: 'y', order: 2 },
          { label: 'Intereses', data: Y.map(y => round2(y.interes)), backgroundColor: '#f59e0b', stack: 'c', yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Capital pendiente', data: Y.map(y => round2(y.pendiente)), borderColor: '#dc2626', backgroundColor: '#dc2626', yAxisID: 'y1', tension: .25, pointRadius: 2, order: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { x: { stacked: true, grid: { display: false } }, y: { ...euroAxis, stacked: true, title: { display: true, text: 'Pagado al año' } }, y1: { ...euroAxis, position: 'right', grid: { display: false }, title: { display: true, text: 'Pendiente' } } } }
    });
  });
}
function yearly(sched) {
  const m = new Map();
  for (const s of sched) { const y = s.ym.slice(0, 4); const o = m.get(y) || { anio: y, cuotas: 0, cuota: 0, interes: 0, capital: 0, pendiente: 0 }; o.cuotas++; o.cuota += s.cuota; o.interes += s.interes; o.capital += s.capital; o.pendiente = s.pendiente; m.set(y, o); }
  return [...m.values()];
}
function schedTable(sched) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Año</th><th class="right">Cuotas</th><th class="right">Pagado</th><th class="right">Intereses</th><th class="right">Capital</th><th class="right">Pendiente fin año</th></tr></thead><tbody>
    ${yearly(sched).map(y => `<tr><td>${y.anio}</td><td class="right">${y.cuotas}</td><td class="right num">${fmtEUR(y.cuota)}</td><td class="right num warn-t">${fmtEUR(y.interes)}</td><td class="right num">${fmtEUR(y.capital)}</td><td class="right num">${fmtEUR(y.pendiente)}</td></tr>`).join('')}</tbody></table></div>`;
}
const FIELDS_DEUDA = [
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPO_DEUDA).map(([v, l]) => ({ v, l })) },
  { name: 'entidad', label: 'Entidad' }, { name: 'inmueble_id', label: 'Inmueble asociado', type: 'select', options: () => [{ v: '', l: '— Ninguno —' }].concat(S.inmuebles.map(i => ({ v: i.id, l: i.nombre }))) },
  { name: 'capital_inicial', label: 'Capital inicial (€)', type: 'number' }, { name: 'fecha_inicio', label: 'Fecha de inicio (1ª cuota)', type: 'date' },
  { name: 'plazo_meses', label: 'Plazo total (meses)', type: 'int' }, { name: 'tipo_interes', label: 'Tipo de interés', type: 'select', options: [{ v: 'fijo', l: 'Fijo' }, { v: 'variable', l: 'Variable' }, { v: 'mixto', l: 'Mixto' }] },
  { name: 'interes', label: 'TIN anual vigente (%)', type: 'number', ph: '2,50' }, { name: 'cuota_mensual', label: 'Cuota mensual (€)', type: 'number', hint: 'Si la dejas vacía se calcula' },
  { name: 'capital_pendiente', label: 'Capital pendiente (€)', type: 'number', hint: 'Del último recibo / app del banco' }, { name: 'fecha_capital_pendiente', label: 'A fecha de', type: 'date' },
  { name: 'activa', label: 'Préstamo activo', type: 'checkbox', def: true }, { name: 'notas', label: 'Notas', type: 'textarea', full: true, ph: 'Revisiones del variable, bonificaciones, seguros vinculados…' }
];
function simular(d) {
  const I = deudaInfo(d), extra = Math.abs(num($('#sim-' + d.id).value)), out = $('#simres-' + d.id);
  if (!extra) { out.innerHTML = ''; return; }
  if (extra >= I.pendienteHoy) { out.innerHTML = `<div class="banner blue">Con ${fmtEUR(extra)} cancelarías el préstamo por completo y te ahorrarías ${fmtEUR(I.interesesPendientes)} en intereses.</div>`; return; }
  const P = I.pendienteHoy - extra, start = addMonths(ymOf(todayISO()), 1);
  const s1 = amortizar(P, I.r, I.cuota, start) || [];
  const ahorroPlazo = I.interesesPendientes - sum(s1, 'interes');
  const nuevaCuota = cuotaFrancesa(P, I.r, I.restantes);
  const s2 = amortizar(P, I.r, nuevaCuota, start) || [];
  const ahorroCuota = I.interesesPendientes - sum(s2, 'interes');
  out.innerHTML = `<div class="grid-2e">
    <div class="metric"><div class="l"><b>Reducir plazo</b> (misma cuota)</div><div class="v pos">−${I.restantes - s1.length} meses</div><div class="small">Ahorro intereses: <b class="pos">${fmtEUR(ahorroPlazo)}</b> · Fin: ${s1.length ? ymLabel(s1[s1.length - 1].ym) : '—'}</div></div>
    <div class="metric"><div class="l"><b>Reducir cuota</b> (mismo plazo)</div><div class="v pos">${fmtEUR(nuevaCuota)}/mes</div><div class="small">−${fmtEUR(I.cuota - nuevaCuota)}/mes · Ahorro intereses: <b class="pos">${fmtEUR(ahorroCuota)}</b></div></div></div>`;
}

Views.deudas = renderDeudas;

Object.assign(Actions, {
  'deu-new': () => openForm({ title: 'Nuevo préstamo', fields: FIELDS_DEUDA, values: { tipo: 'prestamo_personal', tipo_interes: 'fijo', activa: true, fecha_capital_pendiente: todayISO() }, onSubmit: v => saveEntity('deudas', null, { ...v, inmueble_id: v.inmueble_id || null }) }),
  'deu-edit': el => { const d = S.deudas.find(x => x.id === el.dataset.id); openForm({ title: 'Editar préstamo', fields: FIELDS_DEUDA, values: d, onSubmit: v => saveEntity('deudas', d.id, { ...v, inmueble_id: v.inmueble_id || null }) }); },
  'deu-del': async el => { const d = S.deudas.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(d.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('deudas', d.id); await reloadTable('deudas'); }, 'Eliminado'); render(); },
  'deu-pend': el => {
    const d = S.deudas.find(x => x.id === el.dataset.id);
    openForm({ title: `Capital pendiente · ${d.nombre}`, intro: '<p class="small muted">Copia el capital pendiente del último recibo o de la app del banco. Entre actualizaciones, la app lo estima descontando la parte de capital de cada cuota.</p>',
      fields: [{ name: 'capital_pendiente', label: 'Capital pendiente (€)', type: 'number', required: true }, { name: 'fecha_capital_pendiente', label: 'A fecha de', type: 'date' }, { name: 'interes', label: 'TIN vigente (%)', type: 'number' }, { name: 'cuota_mensual', label: 'Cuota mensual (€)', type: 'number' }],
      values: { capital_pendiente: deudaInfo(d).pendienteHoy, fecha_capital_pendiente: todayISO(), interes: d.interes, cuota_mensual: d.cuota_mensual },
      onSubmit: v => saveEntity('deudas', d.id, { ...v, fecha_capital_pendiente: v.fecha_capital_pendiente || todayISO() }) });
  },
  'deu-sim': el => { _deudaCache = new Map(); simular(S.deudas.find(x => x.id === el.dataset.id)); }
});
