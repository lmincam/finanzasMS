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
  if (S.dashCierre) return renderCierre(el, S.dashCierre);
  if (S.dashDet) return renderDetalle(el, months);
  if (S.dashCal) return renderCalendario(el, months);
  const st = periodStats(months);
  const P = Calc.patrimonio();
  // Tasa de ahorro: lo que de verdad has pasado a cuentas de ahorro (neto), no lo que sobra en la cuenta
  const tasaAh = st.ingresos > 0 ? st.aport.ahorro / st.ingresos : null;
  const tasaInv = st.ingresos > 0 ? st.aport.inversion / st.ingresos : null;
  const nM = months.length;
  const p = S.period;
  const modes = [['mes', 'Mes'], ['2m', '2<span class="lg"> meses</span><span class="sm"> m</span>'], ['3m', '3<span class="lg"> meses</span><span class="sm"> m</span>'], ['6m', '6<span class="lg"> meses</span><span class="sm"> m</span>'], ['anio', 'Año'], ['custom', 'Rango']];
  // Selector de mes: ‹ [noviembre 2026] ›. El texto es un botón; encima va un <input type=month> invisible que abre el selector nativo.
  const mesPick = (id, val, txt) => `<button type="button" class="mpick" data-action="mes-pick" data-id="${id}" data-v="${val}" aria-label="Elegir mes"><span>${txt}</span></button>`;
  const inputs = p.mode === 'custom'
    ? `<div class="pin"><span class="small muted">De</span>${mesPick('p-from', p.from, ymLabel(p.from, true))}<span class="small muted">a</span>${mesPick('p-to', p.to, ymLabel(p.to, true))}</div>`
    : `<div class="pin"><button class="btn sm ghost" data-action="period-shift" data-d="-1" aria-label="Anterior">‹</button>${mesPick('p-ref', p.ref, p.mode === 'anio' ? p.ref.slice(0, 4) : ymLabel(p.ref))}<button class="btn sm ghost" data-action="period-shift" data-d="1" aria-label="Siguiente">›</button></div>`;

  // Datos para gráficos
  const chartMonths = months.length < 3 ? Array.from({ length: 6 }, (_, i) => addMonths(months[months.length - 1], i - 5)) : months;
  const perMonth = chartMonths.map(mm => { const s = periodStats([mm]); return { ing: s.ingresos, gas: s.gastos, cap: s.capital, ah: s.ahorro }; });
  const gastosMov = st.movs.filter(m => m.tipo === 'gasto');
  const byRoot = new Map();
  for (const m of gastosMov) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.id : '_none'; byRoot.set(k, (byRoot.get(k) || 0) - num(m.importe)); }
  let donut = [...byRoot.entries()].map(([k, v]) => ({ k, v, c: catById(k) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  if (donut.length > 9) { const rest = donut.slice(8); donut = donut.slice(0, 8).concat([{ k: '_otros', v: sum(rest, 'v'), c: { nombre: 'Resto', color: '#cbd5e1' } }]); }
  // Lo que no se gasta: a qué cuentas de ahorro / inversión ha ido, lo apartado para anualidades y lo que queda en la cuenta
  const destinos = destinosAhorro(st);
  S._dv = { st, donut, destinos };

  // Sin gastos fijos (hipoteca, recibos…): interesan los gastos en los que puedes decidir
  const _fijo = new Map(), esFijo = c => { if (!c) return false; if (!_fijo.has(c)) _fijo.set(c, esGastoFijo(c, months[months.length - 1])); return _fijo.get(c); };
  // Lo que de verdad habéis pagado: se restan las devoluciones vinculadas (Bizum…) y lo pendiente de cobrar
  const devueltoDe = {};
  for (const m of S.movimientos) if (m.reembolso_de && num(m.importe) > 0) devueltoDe[m.reembolso_de] = (devueltoDe[m.reembolso_de] || 0) + num(m.importe);
  const topGastos = gastosMov.filter(m => num(m.importe) < 0 && !esFijo(m.categoria_id))
    .map(m => { const dev = devueltoDe[m.id] || 0, pend = num(m.a_cobrar) > 0 ? infoCompartido(m).pendiente : 0;
      return { m, bruto: -num(m.importe), dev, pend, neto: round2(-num(m.importe) - dev - pend) }; })
    .filter(x => x.neto > 0.005).sort((a, b) => b.neto - a.neto).slice(0, 8);
  const rows = budgetRows(gastosMov, nM, months);
  const totBud = sum(rows.filter(r => r.lvl === 0 && !r.anual), 'bud'), totSpent = sum(rows.filter(r => r.lvl === 0 && !r.anual), 'spent');

  el.innerHTML = `
    ${snapshotBanner()}
    ${bannerCierre()}
    <div class="per-card">
      <div class="per-top">
        <div class="per-nav">${inputs}</div>
        <div class="per-rng" title="${mesNominaActivo() ? 'Mes de nómina: de un cobro al día antes del siguiente' : 'Meses naturales'}">${p.mode !== 'mes' && p.mode !== 'anio' ? `<b>${periodLabel(months)}</b>` : ''}<span>${fmtDate(rangoCiclo(months[0]).ini).slice(0, 5)} – ${cicloAbierto(months[months.length - 1]) ? 'próxima nómina' : fmtDate(rangoCiclo(months[months.length - 1]).fin).slice(0, 5)}</span></div>
        <button class="per-cal-b" data-action="cal-open" data-noico title="Ver los gastos de cada día"><span class="emo">📅</span><span class="t">Calendario</span></button>
      </div>
      <div class="per-chips" role="tablist">${modes.map(([k, l]) => `<button role="tab" data-action="period-mode" data-mode="${k}" class="${p.mode === k ? 'active' : ''}" aria-selected="${p.mode === k}">${l}</button>`).join('')}</div>
    </div>

    <div class="kpi-grid">
        ${kpiLink('ingresos', 'Ingresos <button class="info-btn" data-action="kpi-info" data-k="ingresos" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(st.ingresos), (() => {
          // De dónde vienen: las 3 categorías principales de ingreso del periodo
          const por = {}; for (const m of st.movs) if (m.tipo === 'ingreso') { const c = catById(m.categoria_id), r = c && c.parent_id ? catById(c.parent_id) : c, k = r ? r.nombre : 'Sin categoría'; por[k] = (por[k] || 0) + num(m.importe); }
          const xs = Object.entries(por).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return xs.length ? `<div class="ki-list">${xs.map(([n, v]) => `<div><span>${esc(n)}</span><b>${sinCent(fmtEUR(v))}</b></div>`).join('')}</div>` : ''; })(), 'pos kpi-ing')}
        <div class="kpi neg clickable kpi-gas" data-action="dash-detalle" data-k="gastos" role="button" tabindex="0" title="Ver el detalle">
          <div class="l">Gastos <button class="info-btn" data-action="kpi-info" data-k="gastos" title="¿De dónde sale este dato?">ⓘ</button></div>
          <div class="v">${sinCent(fmtEUR(st.gastosCaja))}</div>
          <div class="kg-sub">Todo lo que ha salido de las cuentas</div>
          <div class="kg-op"><span>Sin capital amortizado</span><b>${sinCent(fmtEUR(st.gastos))}</b></div>
          ${st.capital > 0 ? `<div class="kg-bar" title="Gasto operativo y capital amortizado"><span style="width:${Math.max(0, Math.min(100, st.gastos / st.gastosCaja * 100)).toFixed(1)}%"></span></div><div class="kg-leg"><span><i class="op"></i>Gasto ${fmtPct(st.gastos / st.gastosCaja, 0)}</span><span><i class="cap"></i>Capital ${sinCent(fmtEUR(st.capital))}</span></div>` : ''}
          <span class="kpi-arrow">›</span></div>
        ${(() => { const pos = st.ahorro >= 0, tit = nM === 1 ? 'Balance mensual' : `Balance · ${nM} meses`;
          return `<div class="kpi kpi-wide ${pos ? 'bal-pos' : 'bal-neg'}">
            <div class="bal-main"><div class="l">${tit} <button class="info-btn" data-action="kpi-info" data-k="ahorro" title="¿De dónde sale este dato?">ⓘ</button></div><div class="v">${pos ? '+' : ''}${fmtEUR(st.ahorro)}</div></div>
            <div class="bal-calc">
              <div><span>Ingresos</span><b>${fmtEUR(st.ingresos)}</b></div>
              <div><span>− Gastos (salido de cuenta)</span><b>${fmtEUR(st.gastosCaja)}</b></div>
              <div class="tot"><span>= Balance</span><b>${pos ? '+' : ''}${fmtEUR(st.ahorro)}</b></div>
            </div></div>`; })()}
        ${kpi('Tasa de ahorro <button class="info-btn" data-action="kpi-info" data-k="tasa-ahorro" title="¿De dónde sale este dato?">ⓘ</button>', fmtPct(tasaAh), '', 'yellow')}
        ${kpi('Tasa de inversión <button class="info-btn" data-action="kpi-info" data-k="inversion" title="¿De dónde sale este dato?">ⓘ</button>', fmtPct(tasaInv), '', 'yellow')}
        ${kpi('Liquidez disponible <button class="info-btn" data-action="kpi-info" data-k="liquidez" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(P.liquidez, 0), '', 'sky')}
        ${kpi('Patrimonio neto <button class="info-btn" data-action="kpi-info" data-k="patrimonio" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(P.neto, 0), (() => { const prev = S.patrimonio_mensual.filter(x => x.anio_mes < ymOf(todayISO())).sort((a, b) => a.anio_mes < b.anio_mes ? 1 : -1)[0];
        return prev ? `<span class="${P.neto - num(prev.patrimonio_neto) >= 0 ? 'pos' : 'neg'}"><b>${signed(P.neto - num(prev.patrimonio_neto))}</b></span> vs ${ymLabel(prev.anio_mes, true)}` : ''; })(), 'sky', true)}
    </div>

    ${renderAnioEnCurso(P)}

    ${renderAlertas(months, st, P, rows)}

    <div class="grid-2 dash-charts">
      <div class="card"><div class="card-head"><h3>Ingresos vs. gastos</h3></div><div class="chart-box"><canvas id="ch-ig"></canvas></div></div>
      <div class="card dv-card"><div class="card-head"><h3>¿Dónde va vuestro dinero?</h3><div class="zoom-h">${st.ingresos > 0 ? `<span class="sub">De ${fmtEUR(st.ingresos, 0)} ingresados</span>` : ''}${donut.length || destinos.length ? '<button class="zoom-btn" data-action="dv-zoom" title="Ampliar" aria-label="Ampliar">⤢</button>' : ''}</div></div>
        ${donut.length || destinos.length ? `<div class="dv-grid">
          <div class="dv-col"><div class="dv-t">Gastos${st.ingresos > 0 ? ` · ${fmtPct(sum(donut, 'v') / st.ingresos, 0)}` : ''}</div>
            ${donut.length ? `<div class="chart-box dv-chart"><canvas id="ch-cat"></canvas></div>
            <ul class="dv-leg">${donut.map((d, i) => `<li><span class="dv-p">${st.ingresos > 0 ? fmtPct(d.v / st.ingresos, 0) : fmtEUR(d.v, 0)}</span><span class="cdot" style="background:${esc(colorDonut(d, i))}"></span><span class="dv-n">${esc(nombreDonut(d))}</span></li>`).join('')}</ul>` : '<div class="empty">Sin gastos</div>'}</div>
          <div class="dv-col dv-r"><div class="dv-t">Ahorro<span class="dv-full"> e inversión</span>${st.ingresos > 0 ? ` · ${fmtPct(sum(destinos.filter(x => !x.resto), 'v') / st.ingresos, 0)}` : ''}</div>
            ${destinos.length ? `<div class="chart-box dv-chart"><canvas id="ch-dest"></canvas></div>
            <ul class="dv-leg">${destinos.map(d => `<li><span class="dv-n">${esc(d.n)}</span><span class="cdot" style="background:${esc(d.c)}"></span><span class="dv-p">${st.ingresos > 0 ? fmtPct(d.v / st.ingresos, 0) : fmtEUR(d.v, 0)}</span></li>`).join('')}</ul>` : '<div class="empty">Nada apartado en el periodo</div>'}</div>
        </div>
        ${st.ingresos > 0 && st.ingresos - st.gastosCaja - sum(destinos.filter(x => !x.resto), 'v') < -1 ? `<div class="small muted dv-nota">Se ha gastado y apartado ${fmtEUR(-(st.ingresos - st.gastosCaja - sum(destinos.filter(x => !x.resto), 'v')), 0)} más de lo ingresado: sale del saldo que ya había.</div>` : ''}`
        : '<div class="empty">Sin movimientos en el periodo</div>'}</div>
    </div>

    ${sankeyCaja(st, donut, destinos)}

    <div class="dash-bottom">
    ${renderBudgetCard(rows, nM, totBud, totSpent)}

    <div class="card top-card"><div class="card-head"><h3>Mayores gastos</h3><span class="sub">Sin gastos fijos</span></div>
      <div class="top-list">${topGastos.length ? topGastos.slice(0, 5).map(({ m, bruto, dev, pend, neto }) => `<div class="it" data-action="mov-edit" data-id="${m.id}" style="cursor:pointer">${iconoMovimiento(m)}<div class="c"><b>${esc(m.concepto || '—')}</b><div class="small muted">${fmtDate(m.fecha)} · ${esc(catName(m.categoria_id) || 'Sin categoría')}</div></div><div class="top-imp"><div class="num neg">${fmtEUR(-neto)}</div>${dev || pend ? `<div class="top-dev" title="Pagaste ${esc(fmtEUR(bruto))}">de ${fmtEUR(bruto, 0)} · ↩ ${fmtEUR(dev + pend, 0)}${pend ? ' (por cobrar)' : ''}</div>` : ''}</div></div>`).join('') : '<div class="empty">—</div>'}</div></div>
    </div>
`;

  mkChart('ch-ig', {
    type: 'bar',
    data: {
      labels: chartMonths.map(m => ymLabel(m, true)),
      datasets: [
        { label: 'Ingresos', data: perMonth.map(x => round2(x.ing)), backgroundColor: '#16a34a', borderRadius: 5, order: 2, stack: 'i' },
        { label: 'Gastos operativos', data: perMonth.map(x => round2(x.gas)), backgroundColor: '#dc2626', borderRadius: 5, order: 2, stack: 'g' },
        ...(perMonth.some(x => x.cap > 0) ? [{ label: 'Capital de deuda amortizado', data: perMonth.map(x => round2(x.cap)), backgroundColor: '#fca5a5', borderRadius: 5, order: 2, stack: 'g' }] : []),
        { type: 'line', label: 'Ahorro líquido', data: perMonth.map(x => round2(x.ah)), borderColor: Tema.oscuro() ? '#ffffff' : '#0f1f3a', backgroundColor: Tema.oscuro() ? '#ffffff' : '#0f1f3a', tension: .3, pointRadius: 3, order: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ...euroAxis, stacked: true }, x: { grid: { display: false }, stacked: true } } }
  });
  const dona = (id, items, col) => mkChart(id, { type: 'doughnut',
    data: { labels: items.map(d => d.n), datasets: [{ data: items.map(d => round2(d.v)), backgroundColor: items.map(col), borderWidth: 2, borderColor: Tema.hueco() }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtEUR(ctx.parsed)}${st.ingresos > 0 ? ` · ${fmtPct(ctx.parsed / st.ingresos, 1)} de los ingresos` : ''}` } } } } });
  if (donut.length) dona('ch-cat', donut.map((d, i) => ({ ...d, n: nombreDonut(d), i })), d => colorDonut(d, d.i));
  if (destinos.length) dona('ch-dest', destinos, d => d.c);
}
function budgetRows(gastosMov, nM, months) {
  const spentBy = {}, hasta = months[months.length - 1], anio = hasta.slice(0, 4);
  const known = new Set(S.categorias.filter(c => c.tipo === 'gasto').map(c => c.id));
  // Lo que te tienen que devolver (gasto compartido, Bizum pendiente) no cuenta como gastado: ya te lo descuentas
  const pendBy = {};
  for (const m of gastosMov) {
    const k = (m.categoria_id && known.has(m.categoria_id)) ? m.categoria_id : '_none';
    const pend = num(m.importe) < 0 && num(m.a_cobrar) > 0 ? infoCompartido(m).pendiente : 0;
    spentBy[k] = (spentBy[k] || 0) - num(m.importe) - pend;
    if (pend) pendBy[k] = (pendBy[k] || 0) + pend;
  }
  const rows = [];
  // Anualidad: se compara lo gastado en el año natural con el presupuesto anual (un seguro de 600 € no "se pasa" el mes que se cobra)
  const filaAnual = (c, lvl, color, ids) => ({ lvl, nombre: c.nombre, color, spent: gastadoEnAnio(ids, hasta), bud: presAnual(c), own: true, catId: c.id, anual: true, anio, ids,
    spentPeriodo: sum(ids, id => spentBy[id] || 0) });
  for (const r of S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).sort(byOrden)) {
    const ch = childrenOf(r.id), color = r.color || '#94a3b8';
    if (presAnual(r)) { const f = filaAnual(r, 0, color, [r.id, ...ch.map(c => c.id)]); if (f.spent || f.bud) rows.push(f); continue; }
    const mens = ch.filter(c => !presAnual(c)), anuales = ch.filter(c => presAnual(c));
    const spent = (spentBy[r.id] || 0) + sum(mens, c => spentBy[c.id] || 0);
    const bud = (num(r.presupuesto_mensual) > 0 ? num(r.presupuesto_mensual) : sum(mens, 'presupuesto_mensual')) * nM;
    const hijos = mens.map(c => ({ lvl: 1, nombre: c.nombre, color: c.color || color, spent: spentBy[c.id] || 0, pend: pendBy[c.id] || 0, bud: num(c.presupuesto_mensual) * nM, own: true, catId: c.id, ids: [c.id], padre: r.nombre, padreOwn: num(r.presupuesto_mensual) > 0 }))
      .filter(x => x.spent || x.bud).concat(anuales.map(c => ({ ...filaAnual(c, 1, c.color || color, [c.id]), padre: r.nombre })).filter(x => x.spent || x.bud));
    if (!spent && !bud && !hijos.length) continue;
    rows.push({ lvl: 0, nombre: r.nombre, color, ids: [r.id, ...mens.map(c => c.id)], spent, pend: (pendBy[r.id] || 0) + sum(mens, c => pendBy[c.id] || 0), bud, own: num(r.presupuesto_mensual) > 0, catId: r.id, directo: spentBy[r.id] || 0, pendDirecto: pendBy[r.id] || 0, conHijos: mens.length > 0 }, ...hijos);
  }
  if (spentBy._none) rows.push({ lvl: 0, nombre: 'Sin categoría', color: '#94a3b8', ids: ['_none'], spent: spentBy._none, pend: pendBy._none || 0, bud: 0 });
  for (const r of rows) r.fijo = !r.anual && !!r.catId && esGastoFijo(r.catId, months[0]);
  return rows;
}

/* ---------- Tabla "Presupuesto vs. gastado real" con orden y gastos fijos aparte ---------- */
const BUD_ORDEN = [['cerca', 'Más cerca del límite'], ['gasto', 'Mayor gasto'], ['arbol', 'Por categorías']];
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

function filaPresupuesto(r, nombre) {
  const pc = r.bud > 0 ? r.spent / r.bud : null; const cls = pc === null ? 'navy' : pc > 1 ? 'red' : pc > 0.85 ? 'amber' : '';
  const dev = r.bud > 0 ? r.bud - r.spent : null;
  const tag = r.anual ? ` <span class="badge blue" title="Presupuesto anual: se compara con lo gastado en ${r.anio}">anual</span>` : r.fijo ? ' <span class="badge" title="Gasto fijo: estar al 100 % es lo normal">fijo</span>' : '';
  const ver = r.ids ? ` data-action="bud-ver" data-ids="${esc(r.ids.join(','))}" data-anual="${r.anual ? r.anio : ''}" data-nombre="${esc(r.padre && r.lvl ? r.padre + ' › ' + r.nombre : r.nombre)}" data-spent="${round2(r.spent)}" tabindex="0" title="Ver sus movimientos"` : '';
  return `<tr class="${r.lvl && !nombre ? 'sub' : 'root'} ${r.fijo ? 'muted-row' : ''} ${ver ? 'bud-click' : ''}"${ver}><td><span class="cdot" style="background:${esc(r.color)}"></span>${nombre || esc(r.nombre)}${tag}</td>
    <td class="right num" data-l="Presupuesto">${r.bud ? fmtEUR(r.bud) + (r.anual ? '<span class="small muted">/año</span>' : '') : '<span class="muted">—</span>'}</td>
    <td class="right num" data-l="Gastado">${fmtEUR(r.spent)}${r.anual ? `<div class="small muted">en ${r.anio}</div>` : ''}${r.pend > 0.01 ? `<div class="bud-pend" title="Gastos compartidos: lo que te deben devolver (Bizum…) ya está descontado">↩ ${fmtEUR(r.pend)} por cobrar</div>` : ''}</td>
    <td class="bud-bar"><div style="display:flex;gap:8px;align-items:center">${pctBar(pc === null ? 0 : pc, cls)}<span class="small num ${pc > 1 ? 'neg' : ''}">${pc === null ? '' : fmtPct(pc, 0)}</span></div></td>
    <td class="right num ${dev === null ? 'muted' : dev >= 0 ? 'pos' : 'neg'}" data-l="${dev !== null && dev < 0 ? 'Te pasas' : 'Queda'}">${dev === null ? '—' : fmtEUR(dev)}</td></tr>`;
}
function renderBudgetCard(rows, nM, totBud, totSpent) {
  const orden = lsGet('pf_bud_orden', 'cerca'), verFijos = lsGet('pf_bud_fijos', '0') === '1';
  const head = `<div class="card-head"><div><h3>Presupuesto vs. gastado real <button class="info-btn" data-action="kpi-info" data-k="presupuesto" title="¿Qué significa?">ⓘ</button></h3>
      <span class="sub">${fmtEUR(totSpent)} de ${fmtEUR(totBud)}</span></div>
    <div class="bud-ctl"><select id="bud-orden" title="Ordenar">${BUD_ORDEN.map(([k, l]) => `<option value="${k}" ${k === orden ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
  if (!rows.length) return `<div class="card">${head}<div class="empty">Sin datos. Asigna presupuestos en 🏷️ Categorías.</div></div>`;
  const thead = '<thead><tr><th>Categoría</th><th class="right">Presupuesto</th><th class="right">Gastado</th><th style="width:28%">Consumo</th><th class="right">Desviación</th></tr></thead>';
  if (orden === 'arbol') return `<div class="card">${head}<div class="tbl-wrap"><table class="tbl bud-tbl">${thead}<tbody>${rows.map(r => filaPresupuesto(r)).join('')}</tbody></table></div></div>`;

  // Lista plana: cada partida con presupuesto propio (o la subcategoría si la principal no tiene), con su ruta "Principal › Sub"
  const items = [];
  const ruta = r => `<span class="muted">${esc(r.padre)} ›</span> ${esc(r.nombre)}`;
  for (const r of rows) {
    if (r.lvl === 0) {
      if (r.own && !r.anual && r.conHijos) {
        // Principal con presupuesto propio (p. ej. Vivienda 900 €) que incluye un fijo (Hipoteca): el fijo sale aparte y se descuenta
        const fijosHijos = rows.filter(x => x.lvl === 1 && x.padre === r.nombre && x.fijo && !x.anual);
        const sp = round2(r.spent - sum(fijosHijos, 'spent')), bu = round2(Math.max(0, r.bud - sum(fijosHijos, x => x.bud || x.spent)));
        fijosHijos.forEach(x => items.push({ ...x, ruta: ruta(x) }));
        if (sp || bu) items.push({ ...r, spent: sp, bud: bu, fijo: fijosHijos.length ? false : r.fijo, ids: r.ids.filter(id => !fijosHijos.some(x => x.catId === id)), ruta: esc(r.nombre) + (fijosHijos.length ? ' <span class="muted small">(sin fijos)</span>' : '') });
      } else if (r.anual || r.own || !r.conHijos) { if (r.spent || r.bud) items.push({ ...r, ruta: esc(r.nombre) }); }
      else if (r.directo > 0) items.push({ ...r, spent: r.directo, pend: r.pendDirecto, bud: 0, ids: [r.id], ruta: `${esc(r.nombre)} <span class="muted">› general</span>` });
    } else if (r.anual || !r.padreOwn) items.push({ ...r, ruta: ruta(r) });
  }
  const rank = orden === 'gasto' ? (a, b) => b.spent - a.spent
    : (a, b) => (b.bud > 0) - (a.bud > 0) || (a.bud > 0 ? b.spent / b.bud - a.spent / a.bud : b.spent - a.spent);
  const varis = items.filter(x => !x.fijo && !x.anual).sort(rank), anuales = items.filter(x => x.anual).sort(rank), fijos = items.filter(x => x.fijo && !x.anual).sort(rank);
  const grupo = (t, xs) => xs.length ? `<tr class="grp"><td colspan="5">${t}</td></tr>${xs.map(x => filaPresupuesto(x, x.ruta)).join('')}` : '';
  return `<div class="card">${head}<div class="tbl-wrap"><table class="tbl bud-tbl">${thead}<tbody>
    ${grupo('Gastos variables', varis)}
    ${grupo(`🗓️ Anualidades <span class="muted">· presupuesto anual frente a lo gastado en ${(anuales[0] || {}).anio || ''}</span>`, anuales)}
    ${fijos.length ? `<tr class="grp"><td colspan="5">📌 Gastos fijos <span class="muted">· ${fijos.length} · ${fmtEUR(sum(fijos, 'spent'))}</span>
      <button class="mini" data-action="bud-fijos">${verFijos ? 'Ocultar' : 'Mostrar'}</button></td></tr>${verFijos ? fijos.map(x => filaPresupuesto(x, x.ruta)).join('') : ''}` : ''}
  </tbody></table></div></div>`;
}

Views.dashboard = renderDashboard;

Object.assign(Actions, {
  'period-mode': el => { S.period.mode = el.dataset.mode; render(); },
  'period-shift': el => { const d = +el.dataset.d; S.period.ref = addMonths(S.period.ref, S.period.mode === 'anio' ? d * 12 : d); render(); },
  'bud-fijos': () => { lsSet('pf_bud_fijos', lsGet('pf_bud_fijos', '0') === '1' ? '0' : '1'); render(); },
  'alert-more': el => { const box = $('#alert-more'); if (box) { box.hidden = !box.hidden; el.textContent = box.hidden ? el.dataset.more : 'Ver menos'; } }
});

Object.assign(Changes, {
  'bud-orden': el => { lsSet('pf_bud_orden', el.value); render(); },
  'p-ref': el => { if (el.value) { S.period.ref = el.value; render(); } },
  'p-from': el => { if (el.value) { S.period.from = el.value; render(); } },
  'p-to': el => { if (el.value) { S.period.to = el.value; render(); } }
});

// El mes se elige pulsando el texto: en ordenador se abre el calendario nativo (en el móvil lo abre el propio input invisible)
Object.assign(Actions, { 'mes-pick': el => selectorMes({ valor: el.dataset.v, titulo: el.dataset.id === 'p-from' ? 'Desde' : el.dataset.id === 'p-to' ? 'Hasta' : 'Elige el mes', onPick: ym => Changes[el.dataset.id]({ value: ym }) }) });

/* ---------- Flujo de caja (diagrama de Sankey, estilo Monarch) ---------- */
/** De dónde entra el dinero (izquierda) y a dónde va (derecha): categorías de gasto, cuentas de ahorro/inversión y lo que queda. */
function sankeyCaja(st, donut, destinos, opt = {}) {
  const izq = new Map();
  for (const m of st.movs) if (m.tipo === 'ingreso' && num(m.importe) > 0) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.nombre : 'Otros ingresos'; izq.set(k, (izq.get(k) || 0) + num(m.importe)); }
  let L = [...izq.entries()].map(([n, v]) => ({ n, v, c: '#16a34a' })).sort((a, b) => b.v - a.v);
  if (L.length > 5) { const r = L.slice(4); L = L.slice(0, 4).concat([{ n: 'Otros ingresos', v: sum(r, 'v'), c: '#16a34a' }]); }
  L.forEach((x, i) => { x.c = ['#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac'][i] || '#16a34a'; });
  let G = donut.map((d, i) => ({ n: nombreDonut(d), v: d.v, c: colorDonut(d, i), k: d.k }));
  if (G.length > 7) { const r = G.slice(6); G = G.slice(0, 6).concat([{ n: 'Resto de gastos', v: sum(r, 'v'), c: '#cbd5e1' }]); }
  const R = G.concat(destinos.filter(x => !x.resto).map(x => ({ n: x.n, v: x.v, c: x.c, ah: true })));
  const tL = sum(L, 'v'), tR = sum(R, 'v');
  if (tL - tR > 0.5) R.push({ n: 'Queda en cuenta', v: tL - tR, c: '#94a3b8', ah: true });
  if (tR - tL > 0.5) L.push({ n: 'Del saldo que había', v: tR - tL, c: '#94a3b8' });
  const tot = Math.max(tL, tR);
  if (!(tot > 0) || !L.length || !R.length) return '';
  const movil = window.innerWidth < 640, z = !!opt.W, W = opt.W || Math.max(320, Math.min(980, (document.querySelector('#view') || document.body).clientWidth - (movil ? 36 : 64)));
  const fs = movil ? (z ? 12 : 11) : (z ? 14 : 12.5), lw = movil ? 92 : (z ? 200 : 170), rw = movil ? 132 : (z ? 260 : 230), bar = 10, x1 = lw, x2 = W - rw - bar, gap = 6;
  const n = Math.max(L.length, R.length), H = opt.H ? Math.max(opt.H, n * (fs * 2 + 8)) : Math.max(200, n * (movil ? 36 : 42)), k = (H - gap * (n - 1)) / tot;
  const pos = arr => { const alto = sum(arr, x => x.v * k) + gap * (arr.length - 1); let y = (H - alto) / 2; return arr.map(x => { const o = { ...x, y, h: Math.max(1.5, x.v * k) }; y += x.v * k + gap; return o; }); };
  const PL = pos(L), PR = pos(R), pct = v => fmtPct(v / tot, 0);
  // Cada ingreso se reparte entre los destinos en la misma proporción
  const offR = PR.map(r => r.y);
  let flujos = '';
  PL.forEach((l, i) => {
    let yl = l.y;
    PR.forEach((r, j) => {
      const h = l.v * r.v / tot * k; if (h < 0.3) return;
      const yr = offR[j]; offR[j] += h;
      const mx = (x1 + bar + x2) / 2;
      flujos += `<path data-l="${i}" data-r="${j}" d="M${x1 + bar},${yl}C${mx},${yl} ${mx},${yr} ${x2},${yr}L${x2},${yr + h}C${mx},${yr + h} ${mx},${yl + h} ${x1 + bar},${yl + h}Z" fill="${esc(r.c)}" fill-opacity=".28"><title>${esc(l.n)} → ${esc(r.n)}: ${fmtEUR(l.v * r.v / tot)}</title></path>`;
      yl += h;
    });
  });
  const etiqueta = (x, y, anchor, n, v) => `<text x="${x}" y="${y - 2}" text-anchor="${anchor}" font-size="${fs}" class="sk-n">${esc(n.length > (movil ? 16 : 28) ? n.slice(0, movil ? 15 : 27) + '…' : n)}</text><text x="${x}" y="${y + fs}" text-anchor="${anchor}" font-size="${fs - 1}" class="sk-v">${fmtEUR(v, 0)} · ${pct(v)}</text>`;
  // Etiquetas sin solaparse: se separan lo justo y se recolocan dentro del alto del gráfico
  const yEtiq = P => { const sep = fs * 2 + 6, ys = P.map(x => x.y + x.h / 2);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + sep);
    const sobra = ys.length ? ys[ys.length - 1] - (H - fs) : 0; if (sobra > 0) { ys[ys.length - 1] -= sobra; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - sep); }
    return ys; };
  const yl = yEtiq(PL), yr = yEtiq(PR);
  const nodosL = PL.map((l, i) => `<g class="sk-node" data-side="l" data-i="${i}"><rect x="${x1}" y="${l.y}" width="${bar}" height="${l.h}" rx="2" fill="${esc(l.c)}"/>${etiqueta(x1 - 6, yl[i], 'end', l.n, l.v)}</g>`).join('');
  const nodosR = PR.map((r, i) => `<g class="sk-node" data-side="r" data-i="${i}"><rect x="${x2}" y="${r.y}" width="${bar}" height="${r.h}" rx="2" fill="${esc(r.c)}"/>${etiqueta(x2 + bar + 6, yr[i], 'start', r.n, r.v)}</g>`).join('');
  const ahorro = sum(R.filter(x => x.ah), 'v');
  const svg = `<svg class="sk-svg" viewBox="0 0 ${W} ${H + 4}" width="100%" role="img" aria-label="Diagrama del flujo de caja">${flujos}${nodosL}${nodosR}</svg>`;
  if (z) return { svg, L: PL, R: PR, tot };
  return `<div class="card sk-card"><div class="card-head"><h3>Flujo de caja</h3><button class="zoom-btn" data-action="sk-zoom" title="Ampliar" aria-label="Ampliar">⤢</button></div>
    <div class="small muted sk-res">${fmtEUR(tL, 0)} entran · ${fmtEUR(tot - ahorro, 0)} en gastos · ${fmtEUR(ahorro, 0)} ahorrado o en cuenta</div>${svg}</div>`;
}

/* ---------- Vistas ampliadas e interactivas (pantalla completa) ---------- */
/** Ids de la categoría raíz y sus subcategorías, para abrir sus movimientos con «bud-ver». */
const idsRaiz = k => k === '_none' ? '_none' : [k, ...childrenOf(k).map(c => c.id)].join(',');
function zoomModal(titulo, cuerpo) {
  const m = modal(`<div class="zoom-tit"><h3>${titulo}</h3><span class="small muted">${periodLabel(periodMonths())}</span></div>${cuerpo}`);
  m.el.classList.add('modal-full'); m.el.parentElement.classList.add('modal-back-full'); return m;
}
const zoomInfo = (n, v, tot, extra = '', ids = '') => `<div class="zi-t"><b>${esc(n)}</b><span>${fmtEUR(v)}${tot > 0 ? ` · ${fmtPct(v / tot, 1)}` : ''}</span></div>${extra}${ids ? `<button class="btn sm" data-action="bud-ver" data-ids="${esc(ids)}">Ver movimientos</button>` : ''}`;

Actions['sk-zoom'] = () => {
  const D = S._dv; if (!D) return;
  const movil = window.innerWidth < 640, W = Math.min(1400, window.innerWidth - (movil ? 32 : 120)), H = Math.max(260, window.innerHeight - (movil ? 260 : 240));
  const sk = sankeyCaja(D.st, D.donut, D.destinos, { W, H }); if (!sk) return;
  const m = zoomModal('Flujo de caja', `<div class="sk-zoom">${sk.svg}</div><div class="zoom-info" id="sk-info"><span class="muted">Toca un ingreso, un destino o una franja para ver el detalle.</span></div>`);
  const svg = m.el.querySelector('svg'), info = m.el.querySelector('#sk-info');
  const marcar = f => { svg.classList.toggle('sk-foco', !!f); svg.querySelectorAll('path').forEach(p => p.classList.toggle('on', !!f && f(p))); };
  svg.addEventListener('click', e => {
    const g = e.target.closest('.sk-node'), p = e.target.closest('path');
    if (g) {
      const i = +g.dataset.i, lado = g.dataset.side, x = (lado === 'l' ? sk.L : sk.R)[i];
      marcar(q => q.dataset[lado] === String(i));
      const otros = (lado === 'l' ? sk.R : sk.L).map(o => ({ n: o.n, v: lado === 'l' ? x.v * o.v / sk.tot : o.v * x.v / sk.tot, c: o.c })).filter(o => o.v >= 0.5).sort((a, b) => b.v - a.v);
      const lista = `<ul class="zi-l">${otros.map(o => `<li><i style="background:${esc(o.c)}"></i><span>${lado === 'l' ? '→ ' : '← '}${esc(o.n)}</span><b>${fmtEUR(o.v)}</b></li>`).join('')}</ul>`;
      info.innerHTML = zoomInfo(x.n, x.v, sk.tot, lado === 'l' ? lista : (otros.length > 1 ? lista : ''), lado === 'r' && x.k ? idsRaiz(x.k) : '');
    } else if (p) {
      const l = sk.L[+p.dataset.l], r = sk.R[+p.dataset.r];
      marcar(q => q === p); info.innerHTML = zoomInfo(`${l.n} → ${r.n}`, l.v * r.v / sk.tot, sk.tot, '', r.k ? idsRaiz(r.k) : '');
    } else { marcar(null); info.innerHTML = '<span class="muted">Toca un ingreso, un destino o una franja para ver el detalle.</span>'; }
  });
};

Actions['dv-zoom'] = () => {
  const D = S._dv; if (!D) return;
  const { st, donut, destinos } = D, ing = st.ingresos;
  const G = donut.map((d, i) => ({ n: nombreDonut(d), v: d.v, c: colorDonut(d, i), ids: d.k === '_otros' ? '' : idsRaiz(d.k) }));
  const A = destinos.map(d => ({ n: d.n, v: d.v, c: d.c }));
  const col = (id, t, xs) => xs.length ? `<div class="dz-col"><div class="dv-t">${t}${ing > 0 ? ` · ${fmtPct(sum(xs.filter(x => !/^Queda/.test(x.n)), 'v') / ing, 0)} de los ingresos` : ''}</div>
      <div class="dz-chart"><canvas id="${id}"></canvas><div class="dz-centro" id="${id}-c"><b>${fmtEUR(sum(xs, 'v'), 0)}</b><span>total</span></div></div>
      <ul class="dz-leg">${xs.map((x, i) => `<li><button data-z="${id}" data-i="${i}"><i style="background:${esc(x.c)}"></i><span>${esc(x.n)}</span><b>${fmtEUR(x.v, 0)}</b><em>${ing > 0 ? fmtPct(x.v / ing, 0) : ''}</em></button></li>`).join('')}</ul></div>` : '';
  const m = zoomModal('¿Dónde va vuestro dinero?', `<div class="dz-grid">${col('z-cat', 'Gastos', G)}${col('z-dest', 'Ahorro e inversión', A)}</div><div class="zoom-info" id="dz-info"><span class="muted">Toca un sector o una línea de la leyenda para ver el detalle.</span></div>`);
  const info = m.el.querySelector('#dz-info'), datos = { 'z-cat': G, 'z-dest': A };
  const elegir = (id, i) => {
    for (const k of Object.keys(datos)) { const ch = Charts[k]; if (!ch || !ch.setActiveElements) continue; const a = k === id ? [{ datasetIndex: 0, index: i }] : []; ch.setActiveElements(a); ch.tooltip.setActiveElements(a, { x: 0, y: 0 }); ch.update(); }
    m.el.querySelectorAll('.dz-leg button').forEach(b => b.classList.toggle('on', b.dataset.z === id && +b.dataset.i === i));
    const x = datos[id][i], c = m.el.querySelector(`#${id}-c`);
    if (c) c.innerHTML = `<b>${fmtEUR(x.v, 0)}</b><span>${esc(x.n.length > 18 ? x.n.slice(0, 17) + '…' : x.n)}</span>`;
    info.innerHTML = zoomInfo(x.n, x.v, ing, ing > 0 ? `<div class="small muted">${fmtPct(x.v / ing, 1)} de lo ingresado · ${fmtPct(x.v / sum(datos[id], 'v'), 1)} de ${id === 'z-cat' ? 'los gastos' : 'lo apartado'}</div>` : '', x.ids || '');
  };
  const dona = (id, xs) => mkChart(id, { type: 'doughnut',
    data: { labels: xs.map(x => x.n), datasets: [{ data: xs.map(x => round2(x.v)), backgroundColor: xs.map(x => x.c), borderWidth: 2, borderColor: Tema.hueco(), hoverOffset: 14 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '58%', layout: { padding: 12 }, onClick: (e, els) => { if (els.length) elegir(id, els[0].index); },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmtEUR(ctx.parsed)}${ing > 0 ? ` · ${fmtPct(ctx.parsed / ing, 1)}` : ''}` } } } } });
  if (G.length) dona('z-cat', G); if (A.length) dona('z-dest', A);
  m.el.querySelectorAll('.dz-leg button').forEach(b => b.addEventListener('click', () => elegir(b.dataset.z, +b.dataset.i)));
};

/* ---------- «¿Dónde va vuestro dinero?» ---------- */
const nombreDonut = d => d.k === '_none' ? 'Sin categoría' : d.c ? d.c.nombre : '—';
const colorDonut = (d, i) => (d.c && d.c.color) || PALETTE[i % PALETTE.length];
const COLORES_DESTINO = ['#7c3aed', '#0ea5e9', '#4f46e5', '#db2777', '#0369a1', '#a855f7', '#1d4ed8', '#c026d3'];
/** Destino del dinero no gastado en el periodo: neto aportado a cada cuenta de ahorro / inversión, anualidades y lo que queda en cuenta. */
function destinosAhorro(st) {
  const ca = cuentaAnualidades(), por = new Map(), esAh = c => c && (c.tipo === 'ahorro' || c.tipo === 'inversion') && !(ca && c.id === ca.id);
  for (const m of st.movs) {
    if (m.tipo !== 'transferencia' || num(m.importe) <= 0) continue;
    const dst = cuentaById(m.cuenta_id), org = cuentaById(m.cuenta_contraria_id), v = num(m.importe);
    if (esAh(dst)) por.set(dst.id, (por.get(dst.id) || 0) + v);
    if (esAh(org)) por.set(org.id, (por.get(org.id) || 0) - v);
  }
  const out = [...por.entries()].map(([id, v]) => ({ c: cuentaById(id), v })).filter(x => x.v > 0.5).sort((a, b) => b.v - a.v)
    .map((x, i) => ({ n: x.c.nombre, v: x.v, c: x.c.color && !/^#(16a34a|22c55e|15803d)$/i.test(x.c.color) ? x.c.color : COLORES_DESTINO[i % COLORES_DESTINO.length] }));
  if (st.aport.anualidades > 0.5) out.push({ n: 'Apartado para anualidades', v: st.aport.anualidades, c: '#f59e0b' });
  const resto = st.ingresos - st.gastosCaja - sum(out, 'v');
  if (resto > 0.5) out.push({ n: 'Queda en cuenta', v: resto, c: '#94a3b8', resto: true });
  return out;
}

/* ---------- Detalle de una partida del presupuesto: sus movimientos, para comprobar la cuenta ---------- */
Actions['bud-ver'] = el => {
  const ids = new Set(String(el.dataset.ids || '').split(',').filter(Boolean)), anio = el.dataset.anual;
  const known = new Set(S.categorias.filter(c => c.tipo === 'gasto').map(c => c.id));
  const enCat = m => ids.has(m.categoria_id) || (ids.has('_none') && !(m.categoria_id && known.has(m.categoria_id)));
  const months = periodMonths(), desde = anio ? anio + '-01' : months[0], hasta = months[months.length - 1];
  const movs = S.movimientos.filter(m => m.tipo === 'gasto' && enCat(m) && mesDe(m) >= desde && mesDe(m) <= hasta)
    .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  let gastado = 0, devuelto = 0, porCobrar = 0;
  const filas = movs.map(m => {
    const imp = num(m.importe), pend = !anio && imp < 0 && num(m.a_cobrar) > 0 ? infoCompartido(m).pendiente : 0;
    if (imp < 0) gastado -= imp; else devuelto += imp; porCobrar += pend;
    const cu = cuentaById(m.cuenta_id), cat = catById(m.categoria_id), orig = m.reembolso_de ? S.movimientos.find(x => x.id === m.reembolso_de) : null;
    const otroMes = mesDe(m) !== ymOf(m.fecha);
    return `<div class="bv-row">${iconoMovimiento(m)}<div class="bv-c"><b>${esc(m.concepto || '—')}</b>
      <div class="small muted">${fmtDate(m.fecha)}${cu ? ' · ' + esc(cu.nombre) : ''}${ids.size > 1 && cat ? ' · ' + esc(cat.nombre) : ''}${otroMes ? ` · cuenta en ${ymLabel(mesDe(m), true)}` : ''}</div>
      ${orig ? `<div class="bv-tag">↩ devolución de «${esc(orig.concepto || 'gasto')}»</div>` : ''}${pend ? `<div class="bv-tag amber">↩ ${fmtEUR(pend)} por cobrar (descontado)</div>` : ''}</div>
      <div class="bv-imp num ${imp > 0 ? 'pos' : ''}">${imp > 0 ? '+' : ''}${fmtEUR(imp)}</div></div>`;
  }).join('');
  const neto = round2(gastado - devuelto - porCobrar);
  const periodo = anio ? `año ${anio}` : months.length === 1 ? ymLabel(months[0]) : `${ymLabel(months[0], true)} – ${ymLabel(hasta, true)}`;
  const md = modal(`<h3 style="margin-bottom:2px">${esc(el.dataset.nombre || 'Partida')}</h3>
    <div class="small muted" style="margin-bottom:12px">${periodo} · ${movs.length} movimiento${movs.length === 1 ? '' : 's'}</div>
    <div class="bv-sum"><div><span>Gastado</span><b>${fmtEUR(gastado)}</b></div>${devuelto ? `<div><span>Devuelto</span><b class="pos">−${fmtEUR(devuelto)}</b></div>` : ''}${porCobrar ? `<div><span>Por cobrar</span><b class="amber-t">−${fmtEUR(porCobrar)}</b></div>` : ''}<div class="tot"><span>Cuenta en el presupuesto</span><b>${fmtEUR(neto)}</b></div></div>
    ${movs.length ? `<div class="bv-list">${filas}</div>` : '<div class="empty">Sin movimientos en este periodo.</div>'}
    <div class="actions"><button class="btn primary" data-close>Cerrar</button></div>`);
  md.el.querySelector('[data-close]').addEventListener('click', () => md.close());
};
