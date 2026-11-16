'use strict';
/* =====================================================================
   PESTAÑA · INVERSIONES
   ---------------------------------------------------------------------
   Cartera, valoraciones, aportaciones y evolución.
   Depende de: datos.js, calculos.js, ui.js, graficos.js, cuentas.js
   ===================================================================== */

function renderInversiones() {
  const el = $('#tab-inversiones');
  const inv = S.cuentas.filter(c => c.tipo === 'inversion').sort(byOrden);
  const act = inv.filter(c => c.activa !== false);
  const infos = inv.map(c => ({ c, x: invInfo(c) }));
  const A = infos.filter(o => o.c.activa !== false);
  const totVal = sum(A, o => o.x.valor), totAp = sum(A, o => o.x.aportado), totPlus = totVal - totAp;
  const anio = todayISO().slice(0, 4);
  const apAnio = sum(S.movimientos.filter(m => m.tipo === 'transferencia' && act.some(c => c.id === m.cuenta_id) && m.fecha.startsWith(anio)), 'importe');
  const ap12 = sum(A, o => o.x.ap12);
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(ymOf(todayISO()), i - 11));
  const ultimos = S.movimientos.filter(m => m.tipo === 'transferencia' && inv.some(c => c.id === m.cuenta_id)).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 12);
  const histVals = [...S.valoraciones].sort((a, b) => a.fecha < b.fecha ? 1 : -1);

  el.innerHTML = `
    <div class="kpis">
      ${kpi('Valor de la cartera', fmtEUR(totVal), `${act.length} cuenta(s) de inversión`, 'navy')}
      ${kpi('Capital aportado neto', fmtEUR(totAp), 'Aportaciones − retiradas')}
      ${kpi('Plusvalía latente', `<span class="${totPlus >= 0 ? 'pos' : 'neg'}">${signed(totPlus)}</span>`, `Rentabilidad acumulada: <b>${totAp > 0 ? fmtPct(totPlus / totAp) : '—'}</b>`, totPlus >= 0 ? 'pos' : 'neg')}
      ${kpi(`Aportado en ${anio}`, fmtEUR(apAnio), `Últimos 12 meses: ${fmtEUR(ap12)} · media ${fmtEUR(ap12 / 12)}/mes`)}
    </div>
    ${!S.tablaValoraciones ? '<div class="banner amber">Para guardar el <b>histórico de valoraciones</b> y ver la evolución de la cartera, ejecuta <code>migracion_v2.sql</code> en Supabase (solo añade una tabla, no toca tus datos).</div>' : ''}
    <div class="section-head"><h2>📈 Cuentas de inversión</h2><div class="btn-row"><button class="btn" data-action="inv-new">+ Cuenta de inversión</button></div></div>
    <div class="grid-2e">${infos.map(({ c, x }) => `<div class="card inv-card ${c.activa === false ? 'off' : ''}" style="--acc:${esc(c.color || '#7c3aed')};margin-bottom:0">
      <div class="asset-head"><div class="asset-ico">📈</div><div style="flex:1"><h3>${esc(c.nombre)} ${c.activa === false ? '<span class="badge">Inactiva</span>' : ''}</h3>
        <div class="small muted">${esc(c.entidad || '')}${x.tieneVM ? ` · Valorada a ${fmtDate(c.fecha_valor_mercado)}` : ' · Sin valoración de mercado'}</div></div>
        <button class="mini" data-action="cuenta-edit" data-id="${c.id}" title="Editar">✎</button><button class="mini" data-action="cuenta-del" data-id="${c.id}" title="Eliminar">🗑</button></div>
      ${x.diasVal !== null && x.diasVal > 90 ? `<div class="banner amber" style="margin-bottom:10px">La última valoración tiene ${x.diasVal} días. Actualízala para que el patrimonio sea fiel.</div>` : ''}
      <div class="metrics">
        ${metric('Valor actual', fmtEUR(x.valor))}${metric('Aportado neto', fmtEUR(x.aportado))}
        ${metric('Plusvalía', x.tieneVM ? signed(x.plus) : '—', x.plus >= 0 ? 'pos' : 'neg')}${metric('Rentabilidad', fmtPct(x.rent, 2), x.plus >= 0 ? 'pos' : 'neg')}
        ${metric('Peso en cartera', totVal ? fmtPct(x.valor / totVal, 0) : '—')}${metric('Aportado 12 meses', fmtEUR(x.ap12))}
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn sm primary" data-action="cuenta-valor" data-id="${c.id}">Actualizar valor</button>
        <button class="btn sm" data-action="quick-open" data-tipo="transferencia" data-destino="${c.id}">+ Registrar aportación</button>
        <button class="btn sm ghost" data-action="inv-aportado" data-id="${c.id}">Ajustar capital aportado</button>
      </div></div>`).join('') || '<div class="card empty">No tienes cuentas de inversión. Pulsa “+ Cuenta de inversión”.</div>'}</div>

    <div class="grid-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>Evolución: valor vs. aportado</h3><span class="sub">Según tus valoraciones guardadas</span></div>
        ${S.valoraciones.length >= 1 ? '<div class="chart-box"><canvas id="ch-inv-evo"></canvas></div>' : '<div class="empty">Cada vez que pulses “Actualizar valor” se guardará un punto del histórico. Con dos o más verás la evolución.</div>'}</div>
      <div class="card"><div class="card-head"><h3>Distribución</h3></div>
        ${totVal > 0 ? '<div class="chart-box"><canvas id="ch-inv-dist"></canvas></div>' : '<div class="empty">—</div>'}</div>
    </div>
    <div class="card"><div class="card-head"><h3>Aportaciones netas por mes</h3><span class="sub">Últimos 12 meses · retiradas en negativo</span></div><div class="chart-box sm"><canvas id="ch-inv-ap"></canvas></div></div>
    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>Últimas aportaciones y retiradas</h3></div>
        <div class="top-list">${ultimos.length ? ultimos.map(m => { const c = cuentaById(m.cuenta_id), o = cuentaById(m.cuenta_contraria_id); return `<div class="it"><div class="c"><b>${esc(c ? c.nombre : '?')}</b><div class="small muted">${fmtDate(m.fecha)} · ${num(m.importe) >= 0 ? 'desde' : 'hacia'} ${esc(o ? o.nombre : '?')} · ${esc(m.concepto || '')}</div></div><div class="num ${num(m.importe) >= 0 ? 'pos' : 'neg'}">${signed(num(m.importe))}</div></div>`; }).join('') : '<div class="empty">Aún no hay aportaciones registradas. Se registran como transferencias internas (importadas o manuales).</div>'}</div></div>
      <div class="card"><div class="card-head"><h3>Histórico de valoraciones</h3></div>
        ${histVals.length ? `<div class="tbl-wrap" style="max-height:360px;overflow:auto"><table class="tbl"><thead><tr><th>Fecha</th><th>Cuenta</th><th class="right">Valor</th><th class="right">Aportado</th><th class="right">Plusvalía</th><th></th></tr></thead><tbody>
          ${histVals.map(v => { const c = cuentaById(v.cuenta_id); const ap = apVal(v), pl = num(v.valor) - ap; return `<tr><td class="small">${fmtDate(v.fecha)}</td><td>${esc(c ? c.nombre : '?')}</td><td class="right num">${fmtEUR(v.valor)}</td><td class="right num">${fmtEUR(ap)}</td><td class="right num ${pl >= 0 ? 'pos' : 'neg'}">${signed(pl)}</td><td><button class="mini" data-action="val-del" data-id="${v.id}">🗑</button></td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="empty">Sin valoraciones guardadas todavía.</div>'}</div>
    </div>`;

  // Gráfico de evolución (arrastra el último valor conocido de cada cuenta)
  if (S.valoraciones.length) {
    const fechas = [...new Set(S.valoraciones.map(v => v.fecha))].sort();
    const series = inv.map((c, i) => {
      const vs = S.valoraciones.filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
      let lastV = null, lastA = null; const val = [], ap = [];
      for (const f of fechas) { const hit = vs.filter(v => v.fecha === f).pop(); if (hit) { lastV = num(hit.valor); lastA = apVal(hit); } val.push(lastV); ap.push(lastA); }
      return { c, val, ap, color: c.color || PALETTE[i % PALETTE.length] };
    }).filter(s => s.val.some(v => v !== null));
    const tot = fechas.map((_, k) => sum(series, s => s.val[k] || 0)), totA = fechas.map((_, k) => sum(series, s => s.ap[k] || 0));
    mkChart('ch-inv-evo', { type: 'line', data: { labels: fechas.map(fmtDate), datasets: [
      { label: 'Valor total', data: tot.map(round2), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.12)', fill: true, borderWidth: 3, tension: .25 },
      { label: 'Aportado total', data: totA.map(round2), borderColor: '#0f1f3a', borderDash: [6, 4], borderWidth: 2, pointRadius: 2, tension: .25 },
      ...series.map(s => ({ label: s.c.nombre, data: s.val, borderColor: s.color, backgroundColor: s.color, borderWidth: 1.5, pointRadius: 2, tension: .25, spanGaps: true }))
    ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: euroAxis, x: { grid: { display: false } } } } });
  }
  if (totVal > 0) mkChart('ch-inv-dist', { type: 'doughnut', data: { labels: A.map(o => o.c.nombre), datasets: [{ data: A.map(o => round2(Math.max(0, o.x.valor))), backgroundColor: A.map((o, i) => o.c.color || PALETTE[i % PALETTE.length]), borderColor: '#fff', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } } });
  mkChart('ch-inv-ap', { type: 'bar', data: { labels: meses.map(m => ymLabel(m, true)),
    datasets: act.map((c, i) => ({ label: c.nombre, backgroundColor: c.color || PALETTE[i % PALETTE.length], borderRadius: 4, stack: 'a',
      data: meses.map(m => round2(sum(S.movimientos.filter(x => x.cuenta_id === c.id && x.tipo === 'transferencia' && ymOf(x.fecha) === m), 'importe'))) })) },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true, grid: { display: false } }, y: { ...euroAxis, stacked: true } } } });
}

Views.inversiones = renderInversiones;

Object.assign(Actions, {
  'cuenta-valor': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Valor de mercado · ${c.nombre}`, intro: `<p class="small muted">Introduce el valor total actual de la cartera (lo que muestra ${esc(c.entidad || 'el bróker')}). Las aportaciones posteriores a esta fecha se sumarán automáticamente.</p>`,
      fields: [{ name: 'valor', label: 'Valor actual (€)', type: 'number', required: true }, { name: 'fecha', label: 'Fecha', type: 'date' }], values: { valor: Calc.valor(c), fecha: todayISO() },
      onSubmit: async v => {
        const fecha = v.fecha || todayISO();
        await saveEntity('cuentas', c.id, { valor_mercado: v.valor, fecha_valor_mercado: fecha });
        if (S.tablaValoraciones) { await DB.insert('valoraciones', [{ cuenta_id: c.id, fecha, valor: v.valor, aportado_neto: Calc.aportadoA(c, fecha) }]); await reloadTable('valoraciones'); }
      } });
  },
  'inv-new': () => openForm({ title: 'Nueva cuenta de inversión', fields: FIELDS_CUENTA, values: { tipo: 'inversion', fecha_saldo_inicial: todayISO(), orden: S.cuentas.length + 1, activa: true, color: PALETTE[S.cuentas.length % PALETTE.length] },
    onSubmit: v => saveEntity('cuentas', null, zeroNulls({ ...v, fecha_saldo_inicial: v.fecha_saldo_inicial || todayISO() }, ['saldo_inicial', 'orden'])) }),
  'inv-aportado': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Capital aportado · ${c.nombre}`, intro: '<p class="small muted">Total que has aportado de tu bolsillo a esta cuenta (aportaciones − retiradas) hasta la fecha indicada. Las aportaciones que registres después como transferencias se sumarán solas.</p>',
      fields: [{ name: 'saldo', label: 'Capital aportado neto (€)', type: 'number', required: true }, { name: 'fecha', label: 'Hasta el día', type: 'date' }], values: { saldo: Calc.saldo(c), fecha: todayISO() },
      onSubmit: v => saveEntity('cuentas', c.id, { saldo_inicial: v.saldo, fecha_saldo_inicial: v.fecha || todayISO() }) });
  },
  'val-del': async el => {
    const v = S.valoraciones.find(x => x.id === el.dataset.id); if (!v) return;
    if (!(await confirmDlg(`¿Eliminar la valoración del ${fmtDate(v.fecha)} (${fmtEUR(v.valor)}) del histórico?`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('valoraciones', v.id); await reloadTable('valoraciones'); }, 'Valoración eliminada'); render();
  }
});
