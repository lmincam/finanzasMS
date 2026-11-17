'use strict';
/* =====================================================================
   DASHBOARD · CALENDARIO DE GASTOS
   ---------------------------------------------------------------------
   Vista mensual con los gastos de cada día (por fecha de operación) y el
   total diario. Usa el mes o periodo elegido en el Dashboard.
   Se abre con el botón "📅 Calendario" y se vuelve con "← Dashboard".
   Depende de: calculos.js, ui.js, dashboard.js (periodLabel), cuentas.js (mov-edit)
   ===================================================================== */

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Gastos del calendario: gastos por fecha de operación (sin amortizaciones de deuda, que son ahorro). Los reembolsos restan. */
function gastosPorDia(months) {
  const set = new Set(months), dias = {};
  for (const m of S.movimientos) {
    if (m.tipo !== 'gasto' || !set.has(ymOf(m.fecha)) || esCatAmortizacion(m.categoria_id)) continue;
    (dias[m.fecha] = dias[m.fecha] || []).push(m);
  }
  for (const k in dias) dias[k].sort((a, b) => num(a.importe) - num(b.importe));
  return dias;
}
const totalDia = movs => round2(-sum(movs, 'importe'));

function itemCal(m) {
  const c = catById(m.categoria_id), r = c ? rootOf(c) : null, color = (c && c.color) || (r && r.color) || '#94a3b8';
  const imp = -num(m.importe), reemb = imp < 0;
  return `<button class="cal-item" data-action="mov-edit" data-id="${m.id}" title="${esc(m.concepto || '')} · ${esc(catName(m.categoria_id) || 'Sin categoría')}${m.notas ? ' · ' + esc(m.notas) : ''}">
    <span class="cal-dot" style="background:${color}"></span><span class="cal-con">${esc(m.concepto || catName(m.categoria_id) || '—')}</span>
    <span class="cal-imp ${reemb ? 'pos' : ''}">${reemb ? '−' : ''}${fmtEUR(Math.abs(imp))}</span></button>`;
}

function mesCalendario(ym, dias, maxDia) {
  const [y, mo] = ym.split('-').map(Number), n = daysInMonth(y, mo), hoy = todayISO();
  const offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const totMes = round2(sum(Object.entries(dias).filter(([f]) => ymOf(f) === ym), ([, v]) => totalDia(v)));
  const conGasto = Object.keys(dias).filter(f => ymOf(f) === ym && totalDia(dias[f]) > 0).length;
  const transcurridos = ym < ymOf(hoy) ? n : ym === ymOf(hoy) ? +hoy.slice(8, 10) : 0;
  let celdas = '';
  for (let i = 0; i < offset; i++) celdas += '<div class="cal-cell cal-empty"></div>';
  for (let d = 1; d <= n; d++) {
    const f = `${ym}-${pad(d)}`, movs = dias[f] || [], tot = totalDia(movs);
    const nivel = tot > 0 && maxDia > 0 ? Math.min(4, Math.ceil((tot / maxDia) * 4)) : 0;
    const dow = (offset + d - 1) % 7;
    celdas += `<div class="cal-cell ${movs.length ? 'cal-has' : 'cal-none'} cal-h${nivel} ${f === hoy ? 'cal-today' : ''} ${dow >= 5 ? 'cal-we' : ''}">
      <div class="cal-head"><span class="cal-num"><span class="cal-dow">${DIAS_SEM[dow]}</span> ${d}</span>${movs.length ? `<b class="cal-tot">${fmtEUR(tot)}</b>` : ''}</div>
      ${movs.length ? `<div class="cal-list">${movs.map(itemCal).join('')}</div>${movs.length > 1 ? `<div class="cal-foot">Gasto total del día: <b>${fmtEUR(tot)}</b></div>` : ''}` : ''}
    </div>`;
  }
  return `<div class="card cal-month">
    <div class="card-head"><h3>${ymLabel(ym)}</h3><span class="sub">Total: <b>${fmtEUR(totMes)}</b> · ${conGasto} día(s) con gasto${transcurridos ? ` · media ${fmtEUR(totMes / transcurridos)}/día` : ''}</span></div>
    <div class="cal-grid">${DIAS_SEM.map((d, i) => `<div class="cal-wd ${i >= 5 ? 'cal-we' : ''}">${d}</div>`).join('')}${celdas}</div></div>`;
}

function renderCalendario(el, months) {
  const p = S.period, dias = gastosPorDia(months);
  const totales = Object.values(dias).map(totalDia).filter(v => v > 0).sort((a, b) => a - b);
  const maxDia = totales.length ? totales[Math.floor(totales.length * 0.9)] || totales[totales.length - 1] : 0; // escala de color robusta a un día atípico
  const top = Object.entries(dias).map(([f, v]) => ({ f, t: totalDia(v) })).sort((a, b) => b.t - a.t)[0];
  const total = round2(sum(Object.values(dias), totalDia));
  const nav = p.mode === 'custom' ? '' : `<button class="btn sm ghost" data-action="period-shift" data-d="-1" title="Anterior">‹</button><button class="btn sm ghost" data-action="period-shift" data-d="1" title="Siguiente">›</button>`;
  el.innerHTML = `
    <div class="card period">
      <button class="btn sm" data-action="cal-close">← Dashboard</button>
      ${nav}
      <div class="period-label">📅 ${periodLabel(months)}</div>
      <div class="sp"></div>
      <span class="small muted">Gastos por <b>fecha de operación</b>. Pulsa un gasto para verlo o corregirlo.</span>
    </div>
    <div class="kpis">
      ${kpi('Gasto del periodo', fmtEUR(total), `${Object.keys(dias).length} día(s) con gastos`, 'neg')}
      ${kpi('Día de más gasto', top ? fmtEUR(top.t) : '—', top ? fmtDate(top.f) : 'Sin gastos', '')}
    </div>
    ${months.map(ym => mesCalendario(ym, dias, maxDia)).join('')}
    <div class="small muted" style="margin:4px 2px 14px">No incluye transferencias internas ni amortizaciones de deuda. Las devoluciones (Bizum de un gasto compartido) aparecen en verde y restan del día.
      El total del calendario puede diferir de “Gastos operativos” del Dashboard, que va por <b>mes de imputación</b>.</div>`;
}

Object.assign(Actions, {
  'cal-open': () => { S.dashCal = true; S.dashDet = null; render(); window.scrollTo(0, 0); },
  'cal-close': () => { S.dashCal = false; render(); }
});
