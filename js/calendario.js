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
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dowDe = f => (new Date(f + 'T00:00:00Z').getUTCDay() + 6) % 7; // lunes = 0

/** Fechas del mes de nómina (ampliado si algún gasto se imputó a mano con otra fecha) y los gastos de cada una. */
function diasDelMes(ym, G) {
  const R = rangoCiclo(ym), fs = (G.porMes[ym] || []).slice().sort();
  const ini = fs.length && fs[0] < R.ini ? fs[0] : R.ini, fin = fs.length && fs[fs.length - 1] > R.fin ? fs[fs.length - 1] : R.fin;
  const out = []; for (let f = ini; f <= fin && out.length < 70; f = addDias(f, 1)) { const movs = (G.dias[f] || []).filter(m => mesDe(m) === ym); out.push({ f, movs, tot: totalDia(movs) }); }
  return { R, dias: out };
}

/** Rejilla limpia: cada día es una casilla con su número y el total; el color indica cuánto se gastó. Al tocarla se ve el detalle. */
function mesCalendario(ym, G, maxDia, varios) {
  const hoy = todayISO(), { R, dias } = diasDelMes(ym, G);
  const offset = dias.length ? dowDe(dias[0].f) : 0;
  let celdas = '';
  for (let i = 0; i < offset; i++) celdas += '<div class="cm-cell cm-empty"></div>';
  dias.forEach(({ f, movs, tot }, i) => {
    const d = +f.slice(8, 10), nivel = tot > 0 && maxDia > 0 ? Math.min(4, Math.ceil((tot / maxDia) * 4)) : 0;
    const marcaMes = i === 0 || d === 1 ? `<span class="cm-mes">${MES_CORTO[+f.slice(5, 7) - 1]}</span>` : '';
    celdas += `<button class="cm-cell cm-h${nivel}${f === hoy ? ' cm-today' : ''}${f > hoy ? ' cm-fut' : ''}${dowDe(f) >= 5 ? ' cm-we' : ''}${S.calSel === f ? ' cm-sel' : ''}" data-action="cal-dia" data-f="${f}" ${movs.length ? '' : 'disabled'} title="${fmtDate(f)}${movs.length ? ' · ' + fmtEUR(tot) : ''}">
      <span class="cm-num">${d}${marcaMes}</span>${movs.length ? `<span class="cm-tot">${fmtNum(Math.round(tot), 0)}<span class="cm-eur"> €</span></span>${movs.length > 1 ? `<span class="cm-n">${movs.length} gastos</span>` : ''}` : ''}</button>`;
  });
  const tot = round2(sum(dias, 'tot'));
  return `<div class="card cal-month">
    <div class="card-head"><div><h3>${ymLabel(ym)}</h3>${mesNominaActivo() ? `<div class="small muted">Mes de nómina: del ${fmtDate(R.ini)} al ${fmtDate(R.fin)}</div>` : ''}</div>${varios ? `<b class="cm-mtot">${fmtEUR(tot)}</b>` : ''}</div>
    <div class="cm-grid">${DIAS_SEM.map((d, i) => `<div class="cm-wd${i >= 5 ? ' cm-we' : ''}">${d}</div>`).join('')}${celdas}</div>
    <div class="cm-ley"><span>Menos</span><i class="cm-h1"></i><i class="cm-h2"></i><i class="cm-h3"></i><i class="cm-h4"></i><span>Más gasto</span><span class="sp"></span><span>Toca un día para ver sus gastos</span></div></div>`;
}

/** Lo que dice el periodo: media, días sin gasto, día y semana más caros, día de la semana que más se gasta y en qué. */
function resumenCalendario(months, G) {
  const hoy = todayISO(), D = months.flatMap(ym => diasDelMes(ym, G).dias), pas = D.filter(x => x.f <= hoy);
  const total = round2(sum(D, 'tot')); if (!(total > 0)) return '';
  const con = D.filter(x => x.tot > 0), sin = pas.filter(x => !(x.tot > 0)).length;
  const top = [...con].sort((a, b) => b.tot - a.tot)[0];
  const sem = {}; D.forEach(x => { const l = addDias(x.f, -dowDe(x.f)); sem[l] = (sem[l] || 0) + x.tot; });
  const topSem = Object.entries(sem).sort((a, b) => b[1] - a[1])[0];
  const porDow = Array.from({ length: 7 }, (_, i) => { const xs = pas.filter(x => dowDe(x.f) === i); return xs.length ? sum(xs, 'tot') / xs.length : 0; });
  const dTop = porDow.indexOf(Math.max(...porDow));
  const cats = {}; D.forEach(x => x.movs.forEach(m => { const c = catById(m.categoria_id), r = c ? rootOf(c) : null, k = r ? r.id : '_'; (cats[k] = cats[k] || { n: r ? r.nombre : 'Sin categoría', color: (r && r.color) || '#94a3b8', t: 0 }).t -= num(m.importe); }));
  const tc = Object.values(cats).filter(c => c.t > 0).sort((a, b) => b.t - a.t).slice(0, 4);
  const fila = (l, v, s = '') => `<div class="cr-row"><span class="cr-l">${l}</span><span class="cr-v">${v}${s ? `<small>${s}</small>` : ''}</span></div>`;
  return `<div class="card cr-card"><h3>Lo que dice ${months.length > 1 ? 'el periodo' : 'el mes'}</h3>
    <div class="cr-grid"><div>
      ${fila('Gasto medio por día', fmtEUR(pas.length ? total / pas.length : 0), `${pas.length} días transcurridos`)}
      ${fila('Días sin gastar', `${sin} de ${pas.length}`)}
      ${top ? fila('Día más caro', fmtEUR(top.tot), `${DIAS_LARGO[dowDe(top.f)]} ${fmtDate(top.f)}`) : ''}
      ${topSem ? fila('Semana más cara', fmtEUR(topSem[1]), `del ${fmtDate(topSem[0]).slice(0, 5)} al ${fmtDate(addDias(topSem[0], 6)).slice(0, 5)}`) : ''}
      ${porDow[dTop] > 0 ? fila('Día de la semana que más gastáis', DIAS_LARGO[dTop], `${fmtEUR(porDow[dTop])} de media`) : ''}
    </div><div class="cr-cats"><div class="small muted" style="margin-bottom:6px">En qué se va</div>
      ${tc.map(c => `<div class="cr-cat"><div class="cr-cat-t"><span><i style="background:${c.color}"></i>${esc(c.n)}</span><b>${fmtEUR(c.t)}</b></div><div class="cr-bar"><span style="width:${Math.round(c.t / tc[0].t * 100)}%;background:${c.color}"></span></div></div>`).join('')}
    </div></div></div>`;
}

/** Detalle bajo la rejilla: el día elegido, o todos los días con gasto del periodo. */
function detalleCalendario(months, G) {
  const D = months.flatMap(ym => diasDelMes(ym, G).dias).filter(x => x.movs.length && (!S.calSel || x.f === S.calSel)).reverse();
  if (!D.length) return '';
  return `<div class="card cd-card"><div class="card-head"><h3>${S.calSel ? `Gastos del ${DIAS_LARGO[dowDe(S.calSel)]} ${fmtDate(S.calSel)}` : 'Todos los gastos, día a día'}</h3>${S.calSel ? '<button class="btn sm ghost" data-action="cal-dia" data-f="">Ver todo el mes</button>' : ''}</div>
    ${D.map(x => `<div class="cd-dia"><div class="cd-h"><span>${DIAS_SEM[dowDe(x.f)]} ${+x.f.slice(8, 10)} ${MES_CORTO[+x.f.slice(5, 7) - 1]}</span><b>${fmtEUR(x.tot)}</b></div>${x.movs.map(itemCal).join('')}</div>`).join('')}</div>`;
}

function renderCalendario(el, months) {
  const p = S.period, G = gastosPorDia(months), dias = G.dias;
  const totales = Object.values(dias).map(totalDia).filter(v => v > 0).sort((a, b) => a - b);
  const maxDia = totales.length ? totales[Math.floor(totales.length * 0.9)] || totales[totales.length - 1] : 0; // escala de color robusta a un día atípico
  const total = round2(sum(Object.values(dias), totalDia));
  if (S.calSel && !(dias[S.calSel] || []).length) S.calSel = null;
  const nav = p.mode === 'custom' ? '' : `<button class="btn sm ghost" data-action="period-shift" data-d="-1" title="Anterior">‹</button><button class="btn sm ghost" data-action="period-shift" data-d="1" title="Siguiente">›</button>`;
  el.innerHTML = `
    <div class="card period">
      <button class="btn sm" data-action="cal-close">← Inicio</button>
      ${nav}
      <div class="period-label">📅 ${periodLabel(months)}</div>
      <div class="sp"></div>
      <label class="chk small"><input type="checkbox" id="cal-fijos" ${S.calFijos ? 'checked' : ''}> Incluir gastos fijos</label>
    </div>
    <div class="cm-total"><span>${S.calFijos ? 'Gasto del periodo' : 'Gasto sin fijos'}</span><b>${fmtEUR(total)}</b><span class="muted small">${Object.keys(dias).filter(f => totalDia(dias[f]) > 0).length} días con gasto</span></div>
    ${months.map(ym => mesCalendario(ym, G, maxDia, months.length > 1)).join('')}
    ${detalleCalendario(months, G)}
    ${resumenCalendario(months, G)}
    `;
}

Object.assign(Changes, { 'cal-fijos': el => { S.calFijos = el.checked; render(); } });
Object.assign(Actions, {
  'cal-open': () => { S.dashCal = true; S.dashDet = null; render(); window.scrollTo(0, 0); },
  'cal-close': () => { S.dashCal = false; S.calSel = null; render(); },
  'cal-dia': el => { const f = el.dataset.f || null; S.calSel = S.calSel === f ? null : f; render(); const c = document.querySelector('.cd-card'); if (f && c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
