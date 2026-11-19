'use strict';
/* =====================================================================
   DASHBOARD · CIERRE DE MES GUIADO
   ---------------------------------------------------------------------
   Al empezar un mes de nómina, el Dashboard propone cerrar el anterior en
   unos minutos: movimientos al día, cuentas conciliadas, todo categorizado,
   traspasos a ahorro y anualidades, hipoteca e inversiones al día, y un
   resumen que queda guardado. Cada paso se comprueba solo cuando se puede;
   si no, se marca a mano.
   Guarda en ajustes 'cierres': { 'AAAA-MM': { pasos: { clave: true }, cerrado: ISO, resumen } }
   Depende de: calculos.js, ui.js, cuentas.js, deudas.js, inversiones.js, compartidos.js
   ===================================================================== */

const cierres = () => (((S.ajustesRows || []).find(r => r.clave === 'cierres') || {}).valor) || {};
async function guardarCierres(valor) {
  await DB.upsert('ajustes', { clave: 'cierres', valor, updated_at: new Date().toISOString() }, 'clave');
  const row = (S.ajustesRows = S.ajustesRows || []).find(r => r.clave === 'cierres');
  if (row) row.valor = valor; else S.ajustesRows.push({ clave: 'cierres', valor });
}
/** Mes que toca cerrar: el mes de nómina anterior al actual, si tiene movimientos y no está cerrado. */
function mesPorCerrar() {
  const ym = addMonths(mesActual(), -1), c = cierres()[ym];
  if (c && c.cerrado) return null;
  return S.movimientos.some(m => (m.tipo === 'gasto' || m.tipo === 'ingreso') && mesDe(m) === ym) ? ym : null;
}

/** Pasos del cierre con su estado: { k, ic, t, ok (auto), info (no bloquea), html } */
function pasosCierre(ym) {
  const R = rangoCiclo(ym), st = periodStats([ym]), hoy = todayISO(), ca = cuentaAnualidades();
  const ops = S.cuentas.filter(c => c.activa !== false && c.tipo !== 'inversion').sort(byOrden);
  const ultimoMov = c => S.movimientos.filter(m => m.cuenta_id === c.id).reduce((a, m) => m.fecha > a ? m.fecha : a, '');
  const P = [];

  // 1) Movimientos al día (hasta el último día del mes)
  const atras = ops.filter(c => c.tipo !== 'efectivo' && S.movimientos.some(m => m.cuenta_id === c.id) && ultimoMov(c) < R.fin);
  P.push({ k: 'import', ic: '📥', t: 'Movimientos al día', ok: !atras.length,
    html: `<p>Importa el Excel del banco hasta el <b>${fmtDate(R.fin)}</b> (fin del mes) y apunta los gastos en efectivo que falten.</p>
      <div class="cz-list">${ops.map(c => { const u = ultimoMov(c); return `<div><span>${esc(c.nombre)}</span><span class="${u && u >= R.fin ? 'pos' : 'muted'}">${u ? 'último: ' + fmtDate(u) : 'sin movimientos'}</span></div>`; }).join('')}</div>
      <div class="btn-row"><button class="btn sm" data-action="tab" data-tab="cuentas">📥 Ir a importar</button><button class="btn sm" data-action="quick-open" data-tipo="gasto">+ Gasto en efectivo</button></div>` });

  // 2) Cuentas conciliadas con el banco
  const conciliada = c => c.fecha_saldo_inicial >= addDias(R.fin, -1);
  P.push({ k: 'conciliar', ic: '🏦', t: 'Saldos cuadrados con el banco', ok: ops.every(conciliada),
    html: `<p>Comprueba que el saldo de cada cuenta en la app coincide con el del banco o la cartera. Si no, concílialo: la app guarda el saldo real.</p>
      <div class="cz-list">${ops.map(c => `<div><span>${esc(c.nombre)} <b class="num">${fmtEUR(Calc.saldo(c))}</b></span>
        ${conciliada(c) ? `<span class="pos">✅ ${fmtDate(c.fecha_saldo_inicial)}</span>` : `<button class="btn sm" data-action="cuenta-conciliar" data-id="${c.id}">Conciliar</button>`}</div>`).join('')}</div>` });

  // 3) Todo categorizado
  const sinCat = S.movimientos.filter(m => (m.tipo === 'gasto' || m.tipo === 'ingreso') && !m.categoria_id && mesDe(m) === ym).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  P.push({ k: 'categorias', ic: '🏷️', t: 'Todo categorizado', ok: !sinCat.length,
    html: sinCat.length ? `<p>Hay <b>${sinCat.length}</b> movimiento(s) sin categoría. Elige una y se guarda al momento.</p>
      <div class="cz-list">${sinCat.slice(0, 30).map(m => `<div><span><b>${esc(m.concepto || '—')}</b> <span class="muted small">${fmtDate(m.fecha)}</span> <b class="num ${num(m.importe) < 0 ? 'neg' : 'pos'}">${fmtEUR(num(m.importe))}</b></span>
        <select class="cz-cat" data-id="${m.id}">${catOpts(m.tipo, '', '— Elegir —')}</select></div>`).join('')}</div>` : '<p class="pos">✅ Todos los movimientos del mes tienen categoría.</p>' });

  // 4) Gastos compartidos pendientes (informativo)
  const abiertos = typeof gastosAbiertos === 'function' ? gastosAbiertos().filter(m => mesDe(m) <= ym) : [];
  const deben = round2(sum(abiertos, m => infoCompartido(m).pendiente));
  P.push({ k: 'compartidos', ic: '👥', t: 'Dinero que te deben', ok: !abiertos.length, info: true,
    html: abiertos.length ? `<p>Tienes <b>${fmtEUR(deben)}</b> pendientes de cobrar de ${abiertos.length} gasto(s) compartido(s). Reclámalos o márcalos como cobrados en Cuentas.</p>
      <div class="cz-list">${abiertos.slice(0, 8).map(m => `<div><span>${esc(m.concepto || '—')} <span class="muted small">${fmtDate(m.fecha)}</span></span><b class="num">${fmtEUR(infoCompartido(m).pendiente)}</b></div>`).join('')}</div>` : '<p class="pos">✅ Nadie te debe nada.</p>' });

  // 5) Traspasos: lo que sobró → ahorro/inversión, y la parte del mes para anualidades
  const ahorroCta = S.cuentas.find(c => c.activa !== false && c.tipo === 'ahorro' && (!ca || c.id !== ca.id));
  const anual = typeof partidasAnuales === 'function' ? round2(sum(partidasAnuales(), 'mensual')) : 0;
  const mesNuevo = mesActual(), stN = periodStats([mesNuevo]), anualPasado = stN.aport.anualidades;
  // Lo que sobra de un mes se suele traspasar al empezar el siguiente: también cuenta lo ya movido en el mes nuevo
  const movido = st.aport.ahorro + st.aport.inversion + st.aport.anualidades, movidoDespues = stN.aport.ahorro + stN.aport.inversion;
  const sobra = round2(st.ahorro - movido - movidoDespues);
  P.push({ k: 'traspasos', ic: '💸', t: 'Traspasos a ahorro y anualidades', ok: sobra <= 20 && (anual <= 0 || anualPasado + 0.01 >= anual),
    html: `<div class="cz-list">
        <div><span>Balance de ${ymLabel(ym)} (lo que sobró)</span><b class="num ${st.ahorro >= 0 ? 'pos' : 'neg'}">${fmtEUR(st.ahorro)}</b></div>
        <div><span>Movido a ahorro, inversión y anualidades durante el mes</span><b class="num">${fmtEUR(movido)}</b></div>
        ${movidoDespues ? `<div><span>Movido a ahorro e inversión desde que empezó ${ymLabel(mesNuevo)}</span><b class="num">${fmtEUR(movidoDespues)}</b></div>` : ''}
        <div><span><b>Sobrante sin mover</b></span><b class="num">${fmtEUR(Math.max(0, sobra))}</b></div></div>
      ${sobra > 20 ? `<p>Si no lo necesitas como colchón para el día a día, pásalo a ahorro o inversión: si se queda en la cuenta corriente, se acaba gastando.</p>
        <div class="btn-row"><button class="btn sm primary" data-action="quick-open" data-tipo="transferencia" ${ahorroCta ? `data-destino="${ahorroCta.id}"` : ''} data-importe="${sobra}" data-concepto="Ahorro sobrante ${ymLabel(ym)}">Pasar ${fmtEUR(sobra)} a ${ahorroCta ? esc(ahorroCta.nombre) : 'ahorro'}</button></div>` : ''}
      ${anual > 0 ? `<div class="cz-list" style="margin-top:10px"><div><span>Anualidades de ${ymLabel(mesNuevo)}${ca ? ` → ${esc(ca.nombre)}` : ''}</span><b class="num">${fmtEUR(anualPasado)} de ${fmtEUR(anual)}</b></div></div>
        ${anualPasado + 0.01 < anual ? `<div class="btn-row"><button class="btn sm" data-action="quick-open" data-tipo="transferencia" ${ca ? `data-destino="${ca.id}"` : ''} data-importe="${round2(anual - anualPasado)}" data-concepto="Anualidades ${ymLabel(mesNuevo)}">Pasar ${fmtEUR(anual - anualPasado)} a anualidades</button></div>` : '<p class="pos small">✅ Anualidades del mes pasadas.</p>'}` : ''}` });

  // 6) Préstamos: capital pendiente comparado con el recibo
  const deudas = S.deudas.filter(d => d.activa !== false && (num(d.interes) > 0 || num(d.cuota_mensual) > 0));
  if (deudas.length) P.push({ k: 'deudas', ic: '🏠', t: 'Capital pendiente de los préstamos', ok: deudas.every(d => d.fecha_capital_pendiente && d.fecha_capital_pendiente >= R.ini), info: true,
    html: `<p>Con el recibo de la última cuota, comprueba que el capital pendiente coincide. Si se desvía, la app se reajusta sola.</p>
      <div class="cz-list">${deudas.map(d => `<div><span>${esc(d.nombre)} <b class="num">${fmtEUR(deudaInfo(d).pendienteHoy)}</b> <span class="muted small">según la app</span></span>
        ${d.fecha_capital_pendiente && d.fecha_capital_pendiente >= R.ini ? `<span class="pos">✅ ${fmtDate(d.fecha_capital_pendiente)}</span>` : `<button class="btn sm" data-action="deu-pend" data-id="${d.id}">Comparar con el banco</button>`}</div>`).join('')}</div>` });

  // 7) Inversiones: valor de mercado actualizado
  const invs = S.cuentas.filter(c => c.activa !== false && c.tipo === 'inversion');
  const valorada = c => c.fecha_valor_mercado && c.fecha_valor_mercado >= addDias(R.fin, -7);
  if (invs.length) P.push({ k: 'inversiones', ic: '📈', t: 'Valor de las inversiones', ok: invs.every(valorada),
    html: `<p>Actualiza el valor de cada cuenta de inversión con lo que marque el broker: así el patrimonio del mes es real.</p>
      <div class="cz-list">${invs.map(c => `<div><span>${esc(c.nombre)} <b class="num">${fmtEUR(Calc.valor(c))}</b></span>
        ${valorada(c) ? `<span class="pos">✅ ${fmtDate(c.fecha_valor_mercado)}</span>` : `<button class="btn sm" data-action="cuenta-valor" data-id="${c.id}">Actualizar valor</button>`}</div>`).join('')}</div>` });
  return P;
}

/** Resumen del mes que queda guardado al cerrarlo. */
function resumenCierre(ym) {
  const st = periodStats([ym]), P = Calc.patrimonio();
  const rows = budgetRows(st.movs.filter(m => m.tipo === 'gasto'), 1, [ym]);
  const pasados = rows.filter(r => r.bud > 0 && r.spent > r.bud && !r.fijo && !r.anual && (r.lvl === 1 || !r.conHijos)).sort((a, b) => (b.spent - b.bud) - (a.spent - a.bud)).slice(0, 5)
    .map(r => ({ nombre: r.nombre, exceso: round2(r.spent - r.bud) }));
  return { ingresos: round2(st.ingresos), gastos: round2(st.gastos), balance: round2(st.ahorro), capital: round2(st.capital),
    ahorro: round2(st.aport.ahorro), inversion: round2(st.aport.inversion), anualidades: round2(st.aport.anualidades),
    tasaAhorro: st.ingresos > 0 ? st.aport.ahorro / st.ingresos : null, tasaInversion: st.ingresos > 0 ? st.aport.inversion / st.ingresos : null,
    patrimonio: round2(P.neto), liquidez: round2(P.liquidez), pasados };
}
function htmlResumen(ym, r) {
  const L = (l, v, cls = '') => `<div><span>${l}</span><b class="num ${cls}">${v}</b></div>`;
  return `<div class="cz-list">${L('Ingresos', fmtEUR(r.ingresos), 'pos')}${L('Gastos operativos', fmtEUR(r.gastos), 'neg')}${r.capital ? L('Capital de deuda amortizado', fmtEUR(r.capital)) : ''}
    ${L('<b>Balance</b>', fmtEUR(r.balance), r.balance >= 0 ? 'pos' : 'neg')}${L('Pasado a ahorro', `${fmtEUR(r.ahorro)} · ${r.tasaAhorro === null ? '—' : fmtPct(r.tasaAhorro)}`)}
    ${L('Invertido', `${fmtEUR(r.inversion)} · ${r.tasaInversion === null ? '—' : fmtPct(r.tasaInversion)}`)}${r.anualidades ? L('Apartado para anualidades', fmtEUR(r.anualidades)) : ''}
    ${L('Patrimonio neto al cerrar', fmtEUR(r.patrimonio, 0))}</div>
    ${r.pasados && r.pasados.length ? `<p class="small" style="margin-top:10px"><b>Presupuestos superados:</b> ${r.pasados.map(p => `${esc(p.nombre)} (+${fmtEUR(p.exceso)})`).join(' · ')}</p>` : '<p class="small pos" style="margin-top:10px">✅ Ningún presupuesto variable superado.</p>'}`;
}

/* ---------- Aviso en el Dashboard ---------- */
function bannerCierre() {
  const ym = mesPorCerrar();
  if (!ym) {
    const prev = addMonths(mesActual(), -1), c = cierres()[prev];
    return c && c.cerrado && diasEntre(c.cerrado.slice(0, 10), todayISO()) <= 7
      ? `<div class="cz-line ok"><span class="cz-dot"></span><span>${ymLabel(prev)} cerrado</span><button class="btn sm ghost" data-action="cierre-open" data-ym="${prev}">Ver resumen</button></div>` : '';
  }
  const P = pasosCierre(ym), hechos = cierres()[ym] && cierres()[ym].pasos || {};
  const n = P.filter(p => p.ok || hechos[p.k]).length;
  return `<div class="cz-line"><span class="cz-dot"></span><span>Cierre de <b>${ymLabel(ym)}</b> pendiente · ${n} de ${P.length} pasos</span>
    <button class="btn sm" data-action="cierre-open" data-ym="${ym}">${n ? 'Continuar' : 'Empezar'} cierre</button></div>`;
}

/* ---------- Vista del cierre ---------- */
function renderCierre(el, ym) {
  const reg = cierres()[ym] || {}, hechos = reg.pasos || {};
  if (reg.cerrado) {
    el.innerHTML = `<div class="card period"><button class="btn sm" data-action="cierre-close">← Dashboard</button><div class="period-label">📋 Cierre de ${ymLabel(ym)}</div></div>
      <div class="card"><div class="card-head"><h3>✅ Mes cerrado el ${fmtDate(reg.cerrado.slice(0, 10))}</h3><button class="btn sm ghost" data-action="cierre-reabrir" data-ym="${ym}">Reabrir</button></div>
      <div class="small muted" style="margin-bottom:8px">Mes de nómina del ${fmtDate(rangoCiclo(ym).ini)} al ${fmtDate(rangoCiclo(ym).fin)}</div>${htmlResumen(ym, reg.resumen || resumenCierre(ym))}</div>`;
    return;
  }
  const P = pasosCierre(ym), done = p => p.ok || !!hechos[p.k];
  const n = P.filter(done).length, pend = P.filter(p => !done(p) && !p.info);
  el.innerHTML = `
    <div class="card period"><button class="btn sm" data-action="cierre-close">← Dashboard</button>
      <div class="period-label">📋 Cierre de ${ymLabel(ym)} <span class="small muted">· del ${fmtDate(rangoCiclo(ym).ini)} al ${fmtDate(rangoCiclo(ym).fin)}</span></div></div>
    <div class="card cz-prog"><div class="cz-prog-t"><b>${n} de ${P.length} pasos</b><span class="small muted">Los que la app puede comprobar se marcan solos; el resto, márcalos al hacerlos.</span></div>${pctBar(n / P.length, n === P.length ? '' : 'amber')}</div>
    ${P.map((p, i) => `<div class="card cz-paso ${done(p) ? 'hecho' : ''}">
      <div class="cz-head"><span class="cz-n">${done(p) ? '✓' : i + 1}</span><h3>${p.ic} ${p.t}${p.info ? ' <span class="badge">opcional</span>' : ''}</h3>
        ${p.ok ? '<span class="badge green">Comprobado</span>' : `<label class="chk cz-chk"><input type="checkbox" data-paso="${p.k}" ${hechos[p.k] ? 'checked' : ''}> Hecho</label>`}</div>
      <div class="cz-body">${p.html}</div></div>`).join('')}
    <div class="card"><div class="card-head"><h3>📊 Resumen de ${ymLabel(ym)}</h3></div>${htmlResumen(ym, resumenCierre(ym))}
      <div class="btn-row" style="margin-top:12px"><button class="btn primary" data-action="cierre-cerrar" data-ym="${ym}">${pend.length ? `Cerrar igualmente (${pend.length} pendiente${pend.length > 1 ? 's' : ''})` : '✅ Cerrar el mes'}</button></div>
      <div class="small muted" style="margin-top:8px">Al cerrar se guarda este resumen. Puedes seguir corrigiendo movimientos después: el mes no se bloquea.</div></div>`;
}

Object.assign(Actions, {
  'cierre-open': el => { S.dashCierre = el.dataset.ym; S.dashCal = false; S.dashDet = null; if (S.tab !== 'dashboard') { S.tab = 'dashboard'; history.replaceState(null, '', '#dashboard'); } render(); window.scrollTo(0, 0); },
  'cierre-close': () => { S.dashCierre = null; render(); },
  'cierre-cerrar': async el => {
    const ym = el.dataset.ym, all = { ...cierres() };
    all[ym] = { ...(all[ym] || {}), cerrado: new Date().toISOString(), resumen: resumenCierre(ym) };
    const r = await withSaving(el, () => guardarCierres(all), `${ymLabel(ym)} cerrado ✓`);
    if (r !== FAIL) render();
  },
  'cierre-reabrir': async el => {
    const ym = el.dataset.ym, all = { ...cierres() }; if (all[ym]) all[ym] = { ...all[ym], cerrado: null };
    const r = await withSaving(el, () => guardarCierres(all)); if (r !== FAIL) render();
  }
});
// Casillas "Hecho" y categorías elegidas desde el cierre
document.addEventListener('change', async e => {
  const chk = e.target.closest('.cz-chk input'), sel = e.target.closest('select.cz-cat');
  if (chk) {
    const ym = S.dashCierre, all = { ...cierres() }; all[ym] = { ...(all[ym] || {}), pasos: { ...((all[ym] || {}).pasos || {}), [chk.dataset.paso]: chk.checked } };
    const r = await withSaving(null, () => guardarCierres(all)); if (r !== FAIL) render();
  } else if (sel && sel.value) {
    const r = await withSaving(null, async () => { await DB.update('movimientos', sel.dataset.id, { categoria_id: sel.value }); const m = S.movimientos.find(x => x.id === sel.dataset.id); if (m) m.categoria_id = sel.value; }, 'Categoría guardada');
    if (r !== FAIL) render();
  }
});
