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
  const modes = [['mes', 'Mes'], ['2m', '2 meses'], ['3m', '3 meses'], ['6m', '6 meses'], ['anio', 'Año'], ['custom', 'Personalizado']];
  // Selector de mes: ‹ [noviembre 2026] ›. El texto es un botón; encima va un <input type=month> invisible que abre el selector nativo.
  const mesPick = (id, val, txt) => `<label class="mpick"><span>${txt}</span><input type="month" class="mp-input" id="${id}" value="${val}" aria-label="Elegir mes"></label>`;
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

  const topGastos = [...gastosMov].sort((a, b) => num(a.importe) - num(b.importe)).slice(0, 8);
  const rows = budgetRows(gastosMov, nM, months);
  const totBud = sum(rows.filter(r => r.lvl === 0 && !r.anual), 'bud'), totSpent = sum(rows.filter(r => r.lvl === 0 && !r.anual), 'spent');

  el.innerHTML = `
    ${snapshotBanner()}
    ${bannerCierre()}
    <div class="per-bar">
      <div class="seg per-modes">${modes.map(([k, l]) => `<button data-action="period-mode" data-mode="${k}" class="${p.mode === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="per-sel">
        ${inputs}
        <div class="per-info">${p.mode !== 'mes' ? `<span class="period-label">${periodLabel(months)}</span><br>` : ''}<span class="small muted" title="${mesNominaActivo() ? 'Mes de nómina: de un cobro al día antes del siguiente' : 'Meses naturales'}">${fmtDate(rangoCiclo(months[0]).ini)} – ${fmtDate(rangoCiclo(months[months.length - 1]).fin)}</span></div>
      </div>
      <button class="btn primary per-cal" data-action="cal-open" data-noico title="Ver los gastos de cada día"><span class="emo">📅</span> Calendario</button>
    </div>

    <div class="dz">
      <section class="card dz-mes">
        <div class="dz-row3">
          ${kpiLink('ingresos', 'Ingresos <button class="info-btn" data-action="kpi-info" data-k="ingresos" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(st.ingresos, 0), '', 'pos dz-t')}
          ${kpiLink('gastos', 'Gastos operativos <button class="info-btn" data-action="kpi-info" data-k="gastos" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(st.gastos, 0), '', 'neg dz-t')}
          ${(() => { const pos = st.ahorro >= 0, tit = nM === 1 ? 'Balance mensual' : `Balance del periodo · ${nM} meses`;
            return `<div class="kpi kpi-wide dz-t dz-bal ${pos ? 'bal-pos' : 'bal-neg'}">
              <div class="bal-main"><div class="l">${tit} <button class="info-btn" data-action="kpi-info" data-k="ahorro" title="¿De dónde sale este dato?">ⓘ</button></div><div class="v">${pos ? '+' : ''}${fmtEUR(st.ahorro, 0)}</div>
                <div class="dz-tasas">
                  <span>Ahorro <b>${fmtPct(tasaAh)}</b> <button class="info-btn" data-action="kpi-info" data-k="tasa-ahorro" title="Tasa de ahorro">ⓘ</button></span>
                  <span>Inversión <b>${fmtPct(tasaInv)}</b> <button class="info-btn" data-action="kpi-info" data-k="inversion" title="Tasa de inversión">ⓘ</button></span>
                </div></div>
              <div class="bal-calc">
                <div><span>Ingresos</span><b>${fmtEUR(st.ingresos, 0)}</b></div>
                <div><span>− Gastos operativos</span><b>${fmtEUR(st.gastos, 0)}</b></div>
                ${st.capital > 0 ? `<div><span>− Capital de deuda</span><b>${fmtEUR(st.capital, 0)}</b></div>` : ''}
                <div class="tot"><span>= Balance</span><b>${pos ? '+' : ''}${fmtEUR(st.ahorro, 0)}</b></div>
              </div></div>`; })()}
        </div>
      </section>
      <section class="card dz-sit">
        <div class="dz-row4">
          ${kpi('Liquidez <button class="info-btn" data-action="kpi-info" data-k="liquidez" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(P.liquidez, 0), '', 'dz-t')}
          ${kpi('Patrimonio neto <button class="info-btn" data-action="kpi-info" data-k="patrimonio" title="¿De dónde sale este dato?">ⓘ</button>', fmtEUR(P.neto, 0), (() => { const prev = S.patrimonio_mensual.filter(x => x.anio_mes < ymOf(todayISO())).sort((a, b) => a.anio_mes < b.anio_mes ? 1 : -1)[0];
            return prev ? `<span class="${P.neto - num(prev.patrimonio_neto) >= 0 ? 'pos' : 'neg'}"><b>${signed(P.neto - num(prev.patrimonio_neto), 0)}</b></span> vs ${ymLabel(prev.anio_mes, true)}` : ''; })(), 'dz-t', true)}
          ${renderAnioEnCurso(P)}
        </div>
      </section>
    </div>

    ${renderAlertas(months, st, P, rows)}

    <div class="grid-2 dash-charts">
      <div class="card"><div class="card-head"><h3>Ingresos vs. gastos</h3></div><div class="chart-box"><canvas id="ch-ig"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>¿Dónde se ha gastado?</h3></div>
        ${donut.length ? '<div class="chart-box"><canvas id="ch-cat"></canvas></div>' : '<div class="empty">Sin gastos en el periodo</div>'}</div>
    </div>

    <div class="dash-bottom">
    ${renderBudgetCard(rows, nM, totBud, totSpent)}

    <div class="card top-card"><div class="card-head"><h3>Mayores gastos</h3></div>
      <div class="top-list">${topGastos.length ? topGastos.slice(0, 5).map(m => `<div class="it" data-action="mov-edit" data-id="${m.id}" style="cursor:pointer">${iconoMovimiento(m)}<div class="c"><b>${esc(m.concepto || '—')}</b><div class="small muted">${fmtDate(m.fecha)} · ${esc(catName(m.categoria_id) || 'Sin categoría')}</div></div><div class="num neg">${fmtEUR(num(m.importe))}</div></div>`).join('') : '<div class="empty">—</div>'}</div></div>
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
  if (donut.length) mkChart('ch-cat', {
    type: 'doughnut',
    data: { labels: donut.map(d => d.k === '_none' ? 'Sin categoría' : d.c ? d.c.nombre : '—'), datasets: [{ data: donut.map(d => round2(d.v)), backgroundColor: donut.map((d, i) => (d.c && d.c.color) || PALETTE[i % PALETTE.length]), borderWidth: 2, borderColor: Tema.hueco() }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: window.innerWidth < 700 ? 'bottom' : 'right' } } }
  });
}
function budgetRows(gastosMov, nM, months) {
  const spentBy = {}, hasta = months[months.length - 1], anio = hasta.slice(0, 4);
  const known = new Set(S.categorias.filter(c => c.tipo === 'gasto').map(c => c.id));
  for (const m of gastosMov) { const k = (m.categoria_id && known.has(m.categoria_id)) ? m.categoria_id : '_none'; spentBy[k] = (spentBy[k] || 0) - num(m.importe); }
  const rows = [];
  // Anualidad: se compara lo gastado en el año natural con el presupuesto anual (un seguro de 600 € no "se pasa" el mes que se cobra)
  const filaAnual = (c, lvl, color, ids) => ({ lvl, nombre: c.nombre, color, spent: gastadoEnAnio(ids, hasta), bud: presAnual(c), own: true, catId: c.id, anual: true, anio,
    spentPeriodo: sum(ids, id => spentBy[id] || 0) });
  for (const r of S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).sort(byOrden)) {
    const ch = childrenOf(r.id), color = r.color || '#94a3b8';
    if (presAnual(r)) { const f = filaAnual(r, 0, color, [r.id, ...ch.map(c => c.id)]); if (f.spent || f.bud) rows.push(f); continue; }
    const mens = ch.filter(c => !presAnual(c)), anuales = ch.filter(c => presAnual(c));
    const spent = (spentBy[r.id] || 0) + sum(mens, c => spentBy[c.id] || 0);
    const bud = (num(r.presupuesto_mensual) > 0 ? num(r.presupuesto_mensual) : sum(mens, 'presupuesto_mensual')) * nM;
    const hijos = mens.map(c => ({ lvl: 1, nombre: c.nombre, color: c.color || color, spent: spentBy[c.id] || 0, bud: num(c.presupuesto_mensual) * nM, own: true, catId: c.id, padre: r.nombre, padreOwn: num(r.presupuesto_mensual) > 0 }))
      .filter(x => x.spent || x.bud).concat(anuales.map(c => ({ ...filaAnual(c, 1, c.color || color, [c.id]), padre: r.nombre })).filter(x => x.spent || x.bud));
    if (!spent && !bud && !hijos.length) continue;
    rows.push({ lvl: 0, nombre: r.nombre, color, spent, bud, own: num(r.presupuesto_mensual) > 0, catId: r.id, directo: spentBy[r.id] || 0, conHijos: mens.length > 0 }, ...hijos);
  }
  if (spentBy._none) rows.push({ lvl: 0, nombre: 'Sin categoría', color: '#94a3b8', spent: spentBy._none, bud: 0 });
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
  return `<tr class="${r.lvl && !nombre ? 'sub' : 'root'} ${r.fijo ? 'muted-row' : ''}"><td><span class="cdot" style="background:${esc(r.color)}"></span>${nombre || esc(r.nombre)}${tag}</td>
    <td class="right num" data-l="Presupuesto">${r.bud ? fmtEUR(r.bud) + (r.anual ? '<span class="small muted">/año</span>' : '') : '<span class="muted">—</span>'}</td>
    <td class="right num" data-l="Gastado">${fmtEUR(r.spent)}${r.anual ? `<div class="small muted">en ${r.anio}</div>` : ''}</td>
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
        if (sp || bu) items.push({ ...r, spent: sp, bud: bu, fijo: fijosHijos.length ? false : r.fijo, ruta: esc(r.nombre) + (fijosHijos.length ? ' <span class="muted small">(sin fijos)</span>' : '') });
      } else if (r.anual || r.own || !r.conHijos) { if (r.spent || r.bud) items.push({ ...r, ruta: esc(r.nombre) }); }
      else if (r.directo > 0) items.push({ ...r, spent: r.directo, bud: 0, ruta: `${esc(r.nombre)} <span class="muted">› general</span>` });
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
document.addEventListener('click', e => { const i = e.target.closest('.mp-input'); if (i && i.showPicker) { try { i.showPicker(); } catch (err) { /* sin soporte */ } } });
