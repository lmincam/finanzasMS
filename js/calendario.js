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

/** Gastos del calendario: los gastos de esos meses (de nómina), colocados en su fecha de operación. Sin amortizaciones de deuda; las devoluciones restan.
 *  Devuelve { dias: { fecha: [movs] }, porMes: { ym: [fechas] } }. */
function gastosPorDia(months) {
  const set = new Set(months), dias = {}, porMes = {}, fijo = {};
  // Los gastos fijos (hipoteca, alquiler, cuotas…) no se muestran salvo que se pida: siempre harían del día del cargo el "día de más gasto"
  const esFijoCat = id => id && (fijo[id] ??= esGastoFijo(id, mesActual()) || S.deudas.some(d => d.activa !== false && categoriaCuota(d) === id));
  for (const m of S.movimientos) {
    if (m.tipo !== 'gasto' || esCatAmortizacion(m.categoria_id)) continue;
    if (!S.calFijos && esFijoCat(m.categoria_id)) continue;
    const ym = mesDe(m); if (!set.has(ym)) continue;
    (dias[m.fecha] = dias[m.fecha] || []).push(m); (porMes[ym] = porMes[ym] || []).push(m.fecha);
  }
  for (const k in dias) dias[k].sort((a, b) => num(a.importe) - num(b.importe));
  return { dias, porMes };
}
const totalDia = movs => round2(-sum(movs, 'importe'));

function itemCal(m) {
  const c = catById(m.categoria_id), r = c ? rootOf(c) : null, color = (c && c.color) || (r && r.color) || '#94a3b8';
  const imp = -num(m.importe), reemb = imp < 0;
  return `<button class="cal-item" data-action="mov-edit" data-id="${m.id}" title="${esc(m.concepto || '')} · ${esc(catName(m.categoria_id) || 'Sin categoría')}${m.notas ? ' · ' + esc(m.notas) : ''}">
    <span class="cal-dot" style="background:${color}"></span><span class="cal-con">${esc(m.concepto || catName(m.categoria_id) || '—')}</span>
    <span class="cal-imp ${reemb ? 'pos' : ''}">${reemb ? '−' : ''}${fmtEUR(Math.abs(imp))}</span></button>`;
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function mesCalendario(ym, G, maxDia) {
  const hoy = todayISO(), R = rangoCiclo(ym), fs = (G.porMes[ym] || []).sort();
  // Del inicio al fin del mes de nómina (ampliado si algún gasto se imputó a mano a este mes con otra fecha)
  const ini = fs.length && fs[0] < R.ini ? fs[0] : R.ini, fin = fs.length && fs[fs.length - 1] > R.fin ? fs[fs.length - 1] : R.fin;
  const fechas = []; for (let f = ini; f <= fin && fechas.length < 70; f = addDias(f, 1)) fechas.push(f);
  const enMes = f => (G.dias[f] || []).filter(m => mesDe(m) === ym);
  const totMes = round2(sum(fechas, f => totalDia(enMes(f))));
  const conGasto = fechas.filter(f => totalDia(enMes(f)) > 0).length;
  const transcurridos = fechas.filter(f => f <= hoy).length;
  const offset = (new Date(ini + 'T00:00:00Z').getUTCDay() + 6) % 7; // lunes = 0
  let celdas = '';
  for (let i = 0; i < offset; i++) celdas += '<div class="cal-cell cal-empty"></div>';
  fechas.forEach((f, i) => {
    const movs = enMes(f), tot = totalDia(movs), d = +f.slice(8, 10);
    const nivel = tot > 0 && maxDia > 0 ? Math.min(4, Math.ceil((tot / maxDia) * 4)) : 0;
    const dow = (offset + i) % 7, conMes = i === 0 || d === 1;
    celdas += `<div class="cal-cell ${movs.length ? 'cal-has' : 'cal-none'} cal-h${nivel} ${f === hoy ? 'cal-today' : ''} ${dow >= 5 ? 'cal-we' : ''} ${f > hoy ? 'cal-fut' : ''}">
      <div class="cal-head"><span class="cal-num"><span class="cal-dow">${DIAS_SEM[dow]}</span> ${d}${conMes ? ` <span class="cal-mes">${MES_CORTO[+f.slice(5, 7) - 1]}</span>` : ''}</span>${movs.length ? `<b class="cal-tot">${fmtEUR(tot)}</b>` : ''}</div>
      ${movs.length ? `<div class="cal-list">${movs.map(itemCal).join('')}</div>${movs.length > 1 ? `<div class="cal-foot">Gasto total del día: <b>${fmtEUR(tot)}</b></div>` : ''}` : ''}
    </div>`;
  });
  return `<div class="card cal-month">
    <div class="card-head"><div><h3>${ymLabel(ym)}</h3>${mesNominaActivo() ? `<div class="small muted">Mes de nómina: del ${fmtDate(R.ini)} al ${fmtDate(R.fin)}</div>` : ''}</div><span class="sub">Total: <b>${fmtEUR(totMes)}</b> · ${conGasto} día(s) con gasto${transcurridos ? ` · media ${fmtEUR(totMes / transcurridos)}/día` : ''}</span></div>
    <div class="cal-grid">${DIAS_SEM.map((d, i) => `<div class="cal-wd ${i >= 5 ? 'cal-we' : ''}">${d}</div>`).join('')}${celdas}</div></div>`;
}

function renderCalendario(el, months) {
  const p = S.period, G = gastosPorDia(months), dias = G.dias;
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
      <label class="chk small"><input type="checkbox" id="cal-fijos" ${S.calFijos ? 'checked' : ''}> Incluir gastos fijos</label>
    </div>
    <div class="kpis">
      ${kpi(S.calFijos ? 'Gasto del periodo' : 'Gasto sin fijos', fmtEUR(total), `${Object.keys(dias).length} día(s) con gastos`, 'neg')}
      ${kpi('Día de más gasto', top ? fmtEUR(top.t) : '—', top ? fmtDate(top.f) : 'Sin gastos', '')}
    </div>
    ${months.map(ym => mesCalendario(ym, G, maxDia)).join('')}
    `;
}

Object.assign(Changes, { 'cal-fijos': el => { S.calFijos = el.checked; render(); } });
Object.assign(Actions, {
  'cal-open': () => { S.dashCal = true; S.dashDet = null; render(); window.scrollTo(0, 0); },
  'cal-close': () => { S.dashCal = false; render(); }
});
