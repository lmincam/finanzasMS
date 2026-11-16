'use strict';
/* =====================================================================
   PESTAÑA · DASHBOARD
   ---------------------------------------------------------------------
   Selector de periodo, KPIs, gráficos, presupuesto vs. real y movimientos internos.
   Depende de: calculos.js, ui.js, graficos.js, alertas.js
   ===================================================================== */

function periodLabel(months) {
  if (months.length === 1) return ymLabel(months[0]);
  return `${ymLabel(months[0], true)} – ${ymLabel(months[months.length - 1], true)} · ${months.length} meses`;
}
function snapshotBanner() {
  const t = todayISO(), y = +t.slice(0, 4), q = quarterOf(t);
  const has = (yy, qq) => S.snapshots.some(s => s.anio === yy && s.trimestre === qq);
  const qEndMonth = q * 3, [, m, d] = t.split('-').map(Number);
  if (m === qEndMonth && daysInMonth(y, m) - d <= 10 && !has(y, q))
    return `<div class="banner amber">📸 Se acerca el cierre del Q${q} ${y}. Recuerda guardar la foto patrimonial. <button class="btn sm" data-action="tab" data-tab="auditoria">Ir a Auditoría</button></div>`;
  const pq = q === 1 ? 4 : q - 1, py = q === 1 ? y - 1 : y;
  if (m === (q - 1) * 3 + 1 && d <= 20 && !has(py, pq) && S.snapshots.length)
    return `<div class="banner amber">📸 Falta la foto patrimonial del Q${pq} ${py}. <button class="btn sm" data-action="tab" data-tab="auditoria">Guardarla ahora</button></div>`;
  return '';
}
function renderDashboard() {
  const el = $('#tab-dashboard');
  const months = periodMonths();
  const st = periodStats(months);
  const P = Calc.patrimonio();
  const tasaAh = st.ingresos > 0 ? st.ahorro / st.ingresos : null;
  const tasaInv = st.ingresos > 0 ? st.aport.inversion / st.ingresos : null;
  const nM = months.length;
  const p = S.period;
  const modes = [['mes', 'Mes'], ['2m', '2 meses'], ['3m', '3 meses'], ['6m', '6 meses'], ['anio', 'Año'], ['custom', 'Personalizado']];
  const inputs = p.mode === 'custom'
    ? `<div class="pin"><span class="small muted">De</span><input type="month" id="p-from" value="${p.from}"><span class="small muted">a</span><input type="month" id="p-to" value="${p.to}"></div>`
    : `<div class="pin"><button class="btn sm ghost" data-action="period-shift" data-d="-1">‹</button><input type="month" id="p-ref" value="${p.ref}" title="${p.mode === 'anio' ? 'Cualquier mes del año a analizar' : 'Mes final del periodo'}"><button class="btn sm ghost" data-action="period-shift" data-d="1">›</button></div>`;

  // Datos para gráficos
  const chartMonths = months.length < 3 ? Array.from({ length: 6 }, (_, i) => addMonths(months[months.length - 1], i - 5)) : months;
  const perMonth = chartMonths.map(mm => { const s = periodStats([mm]); return { ing: s.ingresos, gas: s.gastos, cap: s.capital, ah: s.ahorro }; });
  const gastosMov = st.movs.filter(m => m.tipo === 'gasto');
  const byRoot = new Map();
  for (const m of gastosMov) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.id : '_none'; byRoot.set(k, (byRoot.get(k) || 0) - num(m.importe)); }
  let donut = [...byRoot.entries()].map(([k, v]) => ({ k, v, c: catById(k) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  if (donut.length > 9) { const rest = donut.slice(8); donut = donut.slice(0, 8).concat([{ k: '_otros', v: sum(rest, 'v'), c: { nombre: 'Resto', color: '#cbd5e1' } }]); }

  const topGastos = [...gastosMov].sort((a, b) => num(a.importe) - num(b.importe)).slice(0, 8);
  const rows = budgetRows(gastosMov, nM);
  const totBud = sum(rows.filter(r => r.lvl === 0), 'bud'), totSpent = sum(rows.filter(r => r.lvl === 0), 'spent');

  el.innerHTML = `
    ${snapshotBanner()}
    <div class="card period">
      <div class="seg">${modes.map(([k, l]) => `<button data-action="period-mode" data-mode="${k}" class="${p.mode === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      ${inputs}
      <div class="period-label">${periodLabel(months)}</div>
      <div class="sp"></div>
      <span class="small muted">Ingresos según <b>mes de imputación</b> (regla de nómina)</span>
    </div>

    <div class="kpis">
      ${kpi('Ingresos imputados', fmtEUR(st.ingresos), nM > 1 ? `Media ${fmtEUR(st.ingresos / nM)}/mes` : 'Del periodo', 'pos')}
      ${kpi('Gastos operativos', fmtEUR(st.gastos), (nM > 1 ? `Media ${fmtEUR(st.gastos / nM)}/mes · ` : '') + (st.capital > 0 ? `sin transferencias ni <b>${fmtEUR(st.capital)}</b> de capital de deuda` : 'sin transferencias internas'), 'neg')}
      ${kpi('Capacidad de ahorro', `<span class="${st.ahorro >= 0 ? 'pos' : 'neg'}">${fmtEUR(st.ahorro)}</span>`, `Tasa de ahorro: <b>${fmtPct(tasaAh)}</b>${st.capital > 0 ? ` · incluye ${fmtEUR(st.capital, 0)} amortizados` : ''}`, st.ahorro >= 0 ? 'pos' : 'warn')}
      ${kpi('Tasa de inversión', fmtPct(tasaInv), `Invertido: ${fmtEUR(st.aport.inversion)} · A reserva: ${fmtEUR(st.aport.ahorro)}`, '')}
      ${kpi('Patrimonio neto total', fmtEUR(P.neto, 0), (() => { const prev = S.patrimonio_mensual.filter(x => x.anio_mes < ymOf(todayISO())).sort((a, b) => a.anio_mes < b.anio_mes ? 1 : -1)[0];
        return prev ? `<span class="${P.neto - num(prev.patrimonio_neto) >= 0 ? 'pos' : 'neg'}"><b>${signed(P.neto - num(prev.patrimonio_neto))}</b></span> vs ${ymLabel(prev.anio_mes, true)}` : `Activos ${fmtEUR(P.activos, 0)} · Deudas ${fmtEUR(P.deudas, 0)}`; })(), 'navy')}
      ${kpi('Liquidez disponible', fmtEUR(P.liquidez), `Operativa ${fmtEUR(P.operativa, 0)} · Fondo emerg. ${fmtEUR(P.reserva, 0)}`, '')}
    </div>

    ${renderAlertas(months, st, P, rows)}

    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Ingresos vs. gastos</h3><span class="sub">${months.length < 3 ? 'Contexto: últimos 6 meses' : 'Por mes del periodo'}</span></div><div class="chart-box"><canvas id="ch-ig"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>¿Dónde se ha gastado?</h3><span class="sub">Por categoría</span></div>
        ${donut.length ? '<div class="chart-box"><canvas id="ch-cat"></canvas></div>' : '<div class="empty">Sin gastos en el periodo</div>'}</div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Presupuesto vs. gastado real</h3><span class="sub">Presupuesto mensual × ${nM} ${nM === 1 ? 'mes' : 'meses'} · Total: ${fmtEUR(totSpent)} de ${fmtEUR(totBud)}</span></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Categoría</th><th class="right">Presupuesto</th><th class="right">Gastado</th><th style="width:28%">Consumo</th><th class="right">Desviación</th></tr></thead><tbody>
        ${rows.map(r => {
          const pc = r.bud > 0 ? r.spent / r.bud : null; const cls = pc === null ? 'navy' : pc > 1 ? 'red' : pc > 0.85 ? 'amber' : '';
          const dev = r.bud > 0 ? r.bud - r.spent : null;
          return `<tr class="${r.lvl ? 'sub' : 'root'}"><td><span class="cdot" style="background:${esc(r.color)}"></span>${esc(r.nombre)}</td>
            <td class="right num">${r.bud ? fmtEUR(r.bud) : '<span class="muted">—</span>'}</td><td class="right num">${fmtEUR(r.spent)}</td>
            <td><div style="display:flex;gap:8px;align-items:center">${pctBar(pc === null ? 0 : pc, cls)}<span class="small num ${pc > 1 ? 'neg' : ''}">${pc === null ? '' : fmtPct(pc, 0)}</span></div></td>
            <td class="right num ${dev === null ? 'muted' : dev >= 0 ? 'pos' : 'neg'}">${dev === null ? '—' : (dev >= 0 ? '' : '') + fmtEUR(dev)}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<div class="empty">Sin datos. Asigna presupuestos en 🏷️ Categorías.</div>'}
    </div>

    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>Mayores gastos del periodo</h3></div>
        <div class="top-list">${topGastos.length ? topGastos.map(m => `<div class="it"><div class="c"><b>${esc(m.concepto || '—')}</b><div class="small muted">${fmtDate(m.fecha)} · ${esc(catName(m.categoria_id) || 'Sin categoría')}</div></div><div class="num neg">${fmtEUR(num(m.importe))}</div></div>`).join('') : '<div class="empty">—</div>'}</div></div>
      <div class="card"><div class="card-head"><h3>Movimientos internos</h3><span class="sub">No computan como gasto</span></div>
        <div class="metrics" style="margin-bottom:14px">
          ${metric('Reajustes de liquidez', fmtEUR(st.aport.liquidez))}
          ${metric('Aportación a ahorro (neta)', fmtEUR(st.aport.ahorro), st.aport.ahorro >= 0 ? 'pos' : 'neg')}
          ${metric('Aportación a inversión (neta)', fmtEUR(st.aport.inversion), st.aport.inversion >= 0 ? 'pos' : 'neg')}
        </div>
        <div class="sub-title">Composición del patrimonio (hoy)</div>
        <div class="brk">${[['Liquidez', P.liquidez, '#0891b2'], ['Inversiones', P.inversiones, '#7c3aed'], ['Inmuebles', P.inmuebles, '#1e3a8a'], ['Vehículos', P.vehiculos, '#ca8a04'], ['Deudas', -P.deudas, '#dc2626']]
          .map(([l, v, c]) => `<div class="r"><span>${l}</span><div class="bar"><span style="width:${P.activos ? Math.min(100, Math.abs(v) / P.activos * 100).toFixed(1) : 0}%;background:${c}"></span></div><span class="right num">${fmtEUR(v, 0)}</span></div>`).join('')}</div>
      </div>
    </div>`;

  mkChart('ch-ig', {
    type: 'bar',
    data: {
      labels: chartMonths.map(m => ymLabel(m, true)),
      datasets: [
        { label: 'Ingresos', data: perMonth.map(x => round2(x.ing)), backgroundColor: '#16a34a', borderRadius: 5, order: 2, stack: 'i' },
        { label: 'Gastos operativos', data: perMonth.map(x => round2(x.gas)), backgroundColor: '#dc2626', borderRadius: 5, order: 2, stack: 'g' },
        ...(perMonth.some(x => x.cap > 0) ? [{ label: 'Capital de deuda amortizado', data: perMonth.map(x => round2(x.cap)), backgroundColor: '#fca5a5', borderRadius: 5, order: 2, stack: 'g' }] : []),
        { type: 'line', label: 'Ahorro', data: perMonth.map(x => round2(x.ah)), borderColor: '#0f1f3a', backgroundColor: '#0f1f3a', tension: .3, pointRadius: 3, order: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ...euroAxis, stacked: true }, x: { grid: { display: false }, stacked: true } } }
  });
  if (donut.length) mkChart('ch-cat', {
    type: 'doughnut',
    data: { labels: donut.map(d => d.k === '_none' ? 'Sin categoría' : d.c ? d.c.nombre : '—'), datasets: [{ data: donut.map(d => round2(d.v)), backgroundColor: donut.map((d, i) => (d.c && d.c.color) || PALETTE[i % PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: window.innerWidth < 700 ? 'bottom' : 'right' } } }
  });
}
function budgetRows(gastosMov, nM) {
  const spentBy = {};
  const known = new Set(S.categorias.filter(c => c.tipo === 'gasto').map(c => c.id));
  for (const m of gastosMov) { const k = (m.categoria_id && known.has(m.categoria_id)) ? m.categoria_id : '_none'; spentBy[k] = (spentBy[k] || 0) - num(m.importe); }
  const rows = [];
  for (const r of S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).sort(byOrden)) {
    const ch = childrenOf(r.id);
    const spent = (spentBy[r.id] || 0) + sum(ch, c => spentBy[c.id] || 0);
    const bud = budgetOf(r) * nM;
    if (!spent && !bud) continue;
    rows.push({ lvl: 0, nombre: r.nombre, color: r.color || '#94a3b8', spent, bud, own: num(r.presupuesto_mensual) > 0, catId: r.id });
    for (const c of ch) { const s = spentBy[c.id] || 0, b = num(c.presupuesto_mensual) * nM; if (s || b) rows.push({ lvl: 1, nombre: c.nombre, color: c.color || r.color || '#cbd5e1', spent: s, bud: b, own: true, catId: c.id }); }
  }
  if (spentBy._none) rows.push({ lvl: 0, nombre: 'Sin categoría', color: '#94a3b8', spent: spentBy._none, bud: 0 });
  return rows;
}

Views.dashboard = renderDashboard;

Object.assign(Actions, {
  'period-mode': el => { S.period.mode = el.dataset.mode; render(); },
  'period-shift': el => { const d = +el.dataset.d; S.period.ref = addMonths(S.period.ref, S.period.mode === 'anio' ? d * 12 : d); render(); },
  'alert-more': el => { const box = $('#alert-more'); if (box) { box.hidden = !box.hidden; el.textContent = box.hidden ? el.dataset.more : 'Ver menos'; } }
});

Object.assign(Changes, {
  'p-ref': el => { if (el.value) { S.period.ref = el.value; render(); } },
  'p-from': el => { if (el.value) { S.period.from = el.value; render(); } },
  'p-to': el => { if (el.value) { S.period.to = el.value; render(); } }
});
