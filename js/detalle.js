'use strict';
/* =====================================================================
   DASHBOARD · DETALLE DE INGRESOS / GASTOS Y AÑO EN CURSO
   ---------------------------------------------------------------------
   - Al pulsar "Ingresos" o "Gastos operativos" se abre el resumen por
     categoría y la lista de movimientos del periodo elegido.
   - Tarjetas fijas del año en curso (enero → hoy): ingresos y aumento
     de patrimonio, sea cual sea el periodo elegido.
   Depende de: calculos.js, ui.js, dashboard.js
   ===================================================================== */

/* ---------- Detalle de ingresos / gastos ---------- */
function renderDetalle(el, months) {
  const k = S.dashDet, st = periodStats(months), esG = k === 'gastos';
  const movs = st.movs.filter(m => m.tipo === (esG ? 'gasto' : 'ingreso')).sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  const capDe = m => esG && num(m.importe) < 0 ? capitalDeMovimiento(m) : 0;
  // Resumen por categoría principal
  const grupos = new Map();
  for (const m of movs) {
    const r = rootOf(catById(m.categoria_id)), key = r ? r.id : '_none';
    const g = grupos.get(key) || { nombre: r ? r.nombre : 'Sin categoría', color: (r && r.color) || '#94a3b8', bruto: 0, cap: 0, devol: 0, n: 0 };
    const imp = esG ? -num(m.importe) : num(m.importe);
    if (esG && imp < 0) g.devol += -imp; else g.bruto += imp;
    g.cap += capDe(m); g.n++; grupos.set(key, g);
  }
  const lista = [...grupos.values()].map(g => ({ ...g, neto: round2(g.bruto - g.devol - g.cap) })).sort((a, b) => b.neto - a.neto);
  const total = esG ? st.gastos : st.ingresos, max = Math.max(1, ...lista.map(g => g.neto));
  const nav = S.period.mode === 'custom' ? '' : `<button class="btn sm ghost" data-action="period-shift" data-d="-1" title="Anterior">‹</button><button class="btn sm ghost" data-action="period-shift" data-d="1" title="Siguiente">›</button>`;
  const devolTot = round2(sum(lista, 'devol'));

  el.innerHTML = `
    <div class="card period">
      <button class="btn sm" data-action="det-close">← Dashboard</button>${nav}
      <div class="period-label">${esG ? '💸 Gastos' : '💰 Ingresos'} · ${periodLabel(months)}</div>
      <div class="sp"></div>
      <div class="seg"><button data-action="dash-detalle" data-k="ingresos" class="${!esG ? 'active' : ''}">Ingresos</button><button data-action="dash-detalle" data-k="gastos" class="${esG ? 'active' : ''}">Gastos</button></div>
    </div>
    <div class="kpis">
      ${kpi(esG ? 'Gastos operativos' : 'Ingresos', fmtEUR(total), `${movs.length} movimiento(s)${months.length > 1 ? ` · media ${fmtEUR(total / months.length)}/mes` : ''}`, esG ? 'neg' : 'pos')}
      ${esG ? kpi('Todos los cargos', fmtEUR(st.gastosCaja + devolTot), devolTot ? `− ${fmtEUR(devolTot)} devueltos por amigos (Bizum)` : 'Sin devoluciones', '') : ''}
      ${esG && st.capital > 0 ? kpi('Capital amortizado', fmtEUR(st.capital), 'No es gasto: reduce tu deuda', 'navy') : ''}
    </div>
    ${esG && st.capital > 0 ? desgloseCapital(st) : ''}
    <div class="card"><div class="card-head"><h3>Por categoría</h3><span class="sub">${esG ? 'Gasto neto: cargos − devoluciones − capital de deuda' : 'Por mes de imputación'}</span></div>
      ${lista.length ? `<div class="det-cats">${lista.map(g => {
        const nota = [g.cap > 0 ? `${fmtEUR(g.bruto)} − ${fmtEUR(g.cap)} capital` : '', g.devol > 0 ? `${fmtEUR(g.bruto)} − ${fmtEUR(g.devol)} devuelto` : ''].filter(Boolean).join(' · ');
        return `<div class="det-cat"><span class="cdot" style="background:${esc(g.color)}"></span>
        <div class="det-n"><b>${esc(g.nombre)}</b><small>${g.n} mov.${nota ? ' · ' + nota : ''}</small></div>
        <div class="bar"><span style="width:${Math.max(0, g.neto / max * 100).toFixed(1)}%;background:${esc(g.color)}"></span></div>
        <div class="num det-v"><b>${fmtEUR(g.neto)}</b>${total ? `<small>${fmtPct(g.neto / total, 0)}</small>` : ''}</div></div>`; }).join('')}</div>`
        : `<div class="empty">Sin ${esG ? 'gastos' : 'ingresos'} en el periodo</div>`}
    </div>
    <div class="card"><div class="card-head"><h3>Movimientos</h3><span class="sub">Pulsa uno para verlo o corregirlo</span></div>
      ${movs.length ? `<div class="mov-list">${movs.map(m => {
        const imp = num(m.importe), cap = capDe(m), otroMes = ymOf(m.fecha) !== ymOf(m.mes_imputacion), cu = cuentaById(m.cuenta_id);
        return `<div class="det-mov" data-action="mov-edit" data-id="${m.id}" role="button" tabindex="0">
          <div class="det-f">${fmtDate(m.fecha)}</div>
          <div class="det-c"><b>${esc(m.concepto || '—')}</b><div class="small muted">${esc(cu ? cu.nombre : '')} · ${esc(catName(m.categoria_id) || 'Sin categoría')}${otroMes ? ` · imputado a ${ymLabel(ymOf(m.mes_imputacion), true)}` : ''}${m.reembolso_de ? ' · devolución de un gasto compartido' : ''}</div></div>
          <div class="det-i num ${imp >= 0 ? 'pos' : 'neg'}">${fmtEUR(imp)}${cap > 0 ? `<div class="small muted">${fmtEUR(cap)} capital · ${fmtEUR(-imp - cap)} gasto</div>` : ''}</div></div>`;
      }).join('')}</div>` : '<div class="empty">—</div>'}
    </div>`;
}

/* ---------- Año en curso (independiente del periodo) ---------- */
/** Patrimonio neto a 1 de enero: el que fijes tú › foto automática de diciembre › foto Q4 del año anterior. */
function baseAnio(y) {
  const aj = ((S.ajustesRows || []).find(r => r.clave === 'patrimonio_inicio_anio') || {}).valor || {};
  if (aj[y] !== undefined && aj[y] !== null && aj[y] !== '') return { valor: num(aj[y]), fuente: 'fijado por ti' };
  const dic = S.patrimonio_mensual.find(x => x.anio_mes === `${y - 1}-12`);
  if (dic) return { valor: num(dic.patrimonio_neto), fuente: 'foto automática de diciembre' };
  const q4 = S.snapshots.find(s => s.anio === y - 1 && s.trimestre === 4);
  if (q4) return { valor: num(q4.patrimonio_neto), fuente: `foto Q4 ${y - 1}` };
  return null;
}
function renderAnioEnCurso(P) {
  const hoy = todayISO(), ym = mesActual(), y = +ym.slice(0, 4);
  const ms = Array.from({ length: +ym.slice(5, 7) }, (_, i) => `${y}-${pad(i + 1)}`);
  const st = periodStats(ms), nMes = ms.length;
  const base = baseAnio(y);
  const flujos = round2(st.ahorro + st.capital); // ahorro líquido + capital amortizado
  const aumento = base ? round2(P.neto - base.valor) : null;
  const desglose = base ? `Ahorro líquido ${fmtEUR(st.ahorro, 0)} · capital amortizado ${fmtEUR(st.capital, 0)} · revalorización y otros ${signed(round2(aumento - flujos))}` : '';
  return `<div class="ytd-sep"><span>📅 ${y} · enero → hoy</span></div>
    <div class="ytd">
      <div class="kpi pos clickable" data-action="ytd-detalle" role="button" tabindex="0" title="Ver los ingresos del año">
        <div class="l">Ingresos del año</div><div class="v">${fmtEUR(st.ingresos, 0)}</div><span class="kpi-arrow" aria-hidden="true">›</span></div>
      <div class="kpi navy">
        <div class="l">Aumento de patrimonio <button class="info-btn" data-action="kpi-info" data-k="anio" title="¿De dónde sale este dato?">ⓘ</button> <button class="mini" data-action="ytd-base" title="Indicar el patrimonio neto a 1 de enero">✎</button></div>
        ${base ? `<div class="v ${aumento >= 0 ? 'pos' : 'neg'}">${signed(aumento)}</div>`
        : `<div class="v">≈ ${signed(flujos)}</div><div class="s">Estimado · pulsa ✎ e indica tu patrimonio a 1 de enero</div>`}
      </div>
    </div>`;
}

Object.assign(Actions, {
  'dash-detalle': el => { S.dashDet = el.dataset.k; S.dashCal = false; render(); window.scrollTo(0, 0); },
  'det-close': () => { S.dashDet = null; if (S.periodPrev) { S.period = S.periodPrev; S.periodPrev = null; } render(); },
  'ytd-detalle': () => { const hoy = todayISO(); S.periodPrev = S.periodPrev || { ...S.period }; S.period = { ...S.period, mode: 'custom', from: mesActual().slice(0, 4) + '-01', to: mesActual() }; S.dashDet = 'ingresos'; render(); window.scrollTo(0, 0); },
  'ytd-base': () => {
    const y = +todayISO().slice(0, 4), b = baseAnio(y);
    openForm({ title: `Patrimonio neto a 1 de enero de ${y}`, submitLabel: 'Guardar',
      intro: `<div class="small muted" style="margin-bottom:10px">Lo que tenías menos lo que debías al empezar el año (cuentas + inversiones + inmuebles + vehículos − deudas). Déjalo vacío para usar la foto automática de diciembre o la del Q4, si existen.</div>`,
      fields: [{ name: 'valor', label: 'Patrimonio neto (€)', type: 'number' }],
      values: { valor: b && b.fuente === 'fijado por ti' ? b.valor : null },
      onSubmit: async v => {
        const row = (S.ajustesRows = S.ajustesRows || []).find(r => r.clave === 'patrimonio_inicio_anio');
        const valor = { ...((row && row.valor) || {}) }; if (v.valor === null) delete valor[y]; else valor[y] = v.valor;
        await DB.upsert('ajustes', { clave: 'patrimonio_inicio_anio', valor, updated_at: new Date().toISOString() }, 'clave');
        if (row) row.valor = valor; else S.ajustesRows.push({ clave: 'patrimonio_inicio_anio', valor });
      } });
  }
});

/** Cuota a cuota: de dónde sale el capital amortizado del periodo, para compararlo con los recibos del banco. */
function desgloseCapital(st) {
  const filas = st.movs.filter(m => m.tipo === 'gasto' && num(m.importe) < 0).map(m => ({ m, cap: capitalDeMovimiento(m) })).filter(x => x.cap > 0.004)
    .sort((a, b) => a.m.fecha < b.m.fecha ? -1 : 1);
  if (!filas.length) return '';
  const info = ({ m, cap }) => {
    const abs = Math.abs(num(m.importe));
    if (esCatAmortizacion(m.categoria_id)) return { d: null, como: 'Amortización anticipada: todo es capital', int: 0 };
    const d = deudaDeMovimiento(m), L = d ? ledgerDeuda(d) : null, e = L && L.pagos.find(p => p.ids.includes(m.id));
    const como = e ? `Calculado desde el dato del banco (${fmtDate(d.fecha_capital_pendiente || d.fecha_inicio)}) · TIN ${fmtNum(num(d.interes), 2)} % · ${BASES_INTERES[d.base_interes || '30/360']}`
      : d ? `Estimado (cuota anterior al dato del banco) · TIN ${fmtNum(num(d.interes), 2)} %` : '—';
    return { d, como, int: round2(abs - cap) };
  };
  const tot = sum(filas, 'cap');
  return `<div class="card cap-card"><div class="card-head"><div><h3>De dónde sale el capital amortizado</h3>
      <div class="small muted">Compara cada cuota con su recibo del banco. Si los <b>intereses</b> no coinciden, revisa el TIN y la base de cálculo del préstamo (✎ Editar) o pulsa «Comparar con el banco» en el préstamo.</div></div></div>
    <div class="tbl-wrap tbl-scroll"><table class="tbl tbl-nowrap"><thead><tr><th>Fecha</th><th>Préstamo</th><th class="right">Cuota</th><th class="right">Intereses</th><th class="right">Capital</th></tr></thead><tbody>
    ${filas.map(x => { const I = info(x); return `<tr title="${esc(I.como)}"><td>${fmtDate(x.m.fecha)}</td><td>${esc(I.d ? I.d.nombre : (catName(x.m.categoria_id) || '—'))}<div class="small muted cap-como">${esc(I.como)}</div></td>
      <td class="right num">${fmtEUR(Math.abs(num(x.m.importe)))}</td><td class="right num neg">${fmtEUR(I.int)}</td><td class="right num pos"><b>${fmtEUR(x.cap)}</b></td></tr>`; }).join('')}
    <tr class="tot"><td colspan="4"><b>Total capital amortizado</b></td><td class="right num pos"><b>${fmtEUR(tot)}</b></td></tr></tbody></table></div></div>`;
}
