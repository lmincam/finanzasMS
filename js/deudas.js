'use strict';
/* =====================================================================
   PESTAÑA · DEUDAS Y PASIVOS
   ---------------------------------------------------------------------
   Vista general de deudas y detalle de cada préstamo: cuadro de amortización
   (mensual/anual), simulador reducir plazo vs. cuota vs. invertir,
   amortizaciones realizadas (ahorro conseguido) y plan periódico.
   Depende de: datos.js, calculos.js, ui.js, graficos.js
   ===================================================================== */


const FIELDS_DEUDA = [
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPO_DEUDA).map(([v, l]) => ({ v, l })) },
  { name: 'entidad', label: 'Entidad' }, { name: 'inmueble_id', label: 'Inmueble asociado', type: 'select', options: () => [{ v: '', l: '— Ninguno —' }].concat(S.inmuebles.map(i => ({ v: i.id, l: i.nombre }))) },
  { name: 'capital_inicial', label: 'Capital inicial (€)', type: 'number' }, { name: 'fecha_inicio', label: 'Fecha de inicio (1ª cuota)', type: 'date' },
  { name: 'plazo_meses', label: 'Plazo total (meses)', type: 'int' }, { name: 'tipo_interes', label: 'Tipo de interés', type: 'select', options: [{ v: 'fijo', l: 'Fijo' }, { v: 'variable', l: 'Variable' }, { v: 'mixto', l: 'Mixto' }] },
  { name: 'interes', label: 'TIN anual vigente (%)', type: 'number', ph: '2,50' }, { name: 'cuota_mensual', label: 'Cuota mensual (€)', type: 'number', hint: 'Si la dejas vacía se calcula' },
  { name: 'capital_pendiente', label: 'Capital pendiente (€)', type: 'number', hint: 'Del último recibo / app del banco' }, { name: 'fecha_capital_pendiente', label: 'A fecha de', type: 'date' },
  { name: 'comision_amortizacion', label: 'Comisión amortización anticipada (%)', type: 'number', ph: '0,00', hint: 'Mira tu escritura: suele ser 0 – 2 %', cls: 'v4' },
  { name: 'activa', label: 'Préstamo activo', type: 'checkbox', def: true }, { name: 'notas', label: 'Notas', type: 'textarea', full: true, ph: 'Revisiones del variable, bonificaciones, seguros vinculados…' }
];
/** Quita los campos que dependen de la migración v4 si aún no se ha ejecutado. */
const camposV4 = fields => S.v4 ? fields : fields.filter(f => !(f.cls || '').includes('v4'));
const bannerV4 = () => S.v4 ? '' : '<div class="banner amber">Para usar esta función ejecuta <code>sql/03_migracion_v4.sql</code> en Supabase (solo añade tablas y campos, no toca tus datos).</div>';
const FRECUENCIAS = [{ v: 0, l: 'Una sola vez' }, { v: 1, l: 'Cada mes' }, { v: 3, l: 'Cada trimestre' }, { v: 6, l: 'Cada semestre' }, { v: 12, l: 'Cada año' }];
const frecLabel = n => (FRECUENCIAS.find(f => f.v === num(n)) || { l: `Cada ${n} meses` }).l;
const MODO_AMORT = { plazo: 'Reducir plazo (misma cuota)', cuota: 'Reducir cuota (mismo plazo)' };
S.deudaSim = S.deudaSim || {};

/* =====================================================================
   VISTA GENERAL
   ===================================================================== */
function renderDeudas() {
  const d = S.deudaSel && S.deudas.find(x => x.id === S.deudaSel);
  if (d) return renderDeudaDetalle(d);
  S.deudaSel = null;
  const el = $('#tab-deudas');
  const act = S.deudas.filter(x => x.activa !== false);
  const infos = S.deudas.map(x => ({ d: x, I: deudaInfo(x) }));
  const A = infos.filter(o => o.d.activa !== false);
  const tot = sum(A, o => o.I.pendienteHoy), cuotas = sum(A, o => o.I.cuota), intPend = sum(A, o => o.I.interesesPendientes);
  const amos = S.amortizaciones.filter(a => S.deudas.some(x => x.id === a.deuda_id));
  const ahorroPrev = sum(amos, a => num(a.ahorro_intereses) - num(a.comision));
  const ahorroYa = sum(amos, a => ahorroDevengado(a, S.deudas.find(x => x.id === a.deuda_id)));
  const fin = A.map(o => o.I.fin).filter(Boolean).sort().pop();

  el.innerHTML = `
    <div class="section-head"><div><h2>🏦 Deudas y pasivos</h2><div class="small muted">Vista general de todo lo que debes. Pulsa en un préstamo para ver su cuadro de amortización y simular amortizaciones.</div></div>
      <button class="btn" data-action="deu-new">+ Préstamo</button></div>
    ${bannerV4()}
    <div class="kpis">
      ${kpi('Deuda pendiente total', fmtEUR(tot), `${act.length} préstamo(s) activo(s)`, 'neg')}
      ${kpi('Cuotas mensuales', fmtEUR(cuotas), `${fmtEUR(cuotas * 12, 0)} al año`)}
      ${kpi('Intereses pendientes', fmtEUR(intPend, 0), 'Si no amortizas nada más', 'warn')}
      ${kpi('Ahorro por amortizaciones', fmtEUR(ahorroPrev, 0), `Ya conseguido hasta hoy: <b>${fmtEUR(ahorroYa, 0)}</b>`, 'pos')}
      ${kpi('Libre de deudas', fin ? ymLabel(fin) : '—', fin ? `Dentro de ${fmtNum(monthsDiff(todayISO(), fin + '-01') / 12, 1)} años` : '')}
    </div>
    ${A.length ? `<div class="card"><div class="card-head"><h3>Evolución prevista de la deuda</h3><span class="sub">Capital pendiente a final de cada año</span></div><div class="chart-box sm"><canvas id="ch-deu-global"></canvas></div></div>` : ''}
    <div class="grid-2e">${infos.map(({ d: x, I }) => `
      <div class="card" style="margin-bottom:0;cursor:pointer" data-action="deu-open" data-id="${x.id}">
        <div class="asset-head"><div class="asset-ico">🏦</div><div style="flex:1"><h3>${esc(x.nombre)} ${x.activa === false ? '<span class="badge">Cancelada</span>' : ''}</h3>
          <div class="small muted">${TIPO_DEUDA[x.tipo] || ''}${x.entidad ? ' · ' + esc(x.entidad) : ''} · ${x.tipo_interes || 'fijo'} ${fmtNum(num(x.interes), 2)} %</div></div>
          <span class="btn sm">Ver detalle →</span></div>
        <div class="metrics">
          ${metric('Pendiente', fmtEUR(I.pendienteHoy, 0), 'neg')}${metric('Cuota', fmtEUR(I.cuota))}
          ${metric('Cuotas restantes', I.restantes !== null ? fmtNum(I.restantes, 0) : '—')}${metric('Fin', I.fin ? ymLabel(I.fin, true) : '—')}
        </div>
        ${I.pctAmort !== null ? `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:4px">Amortizado ${fmtPct(I.pctAmort)}</div>${pctBar(I.pctAmort, 'navy')}</div>` : ''}
      </div>`).join('') || '<div class="card empty">Sin préstamos registrados</div>'}</div>`;

  if (A.length) {
    const years = new Set(); const porDeuda = A.map(o => { const Y = yearly(o.I.sched); Y.forEach(y => years.add(y.anio)); return { d: o.d, Y }; });
    const labels = [...years].sort();
    mkChart('ch-deu-global', { type: 'bar', data: { labels, datasets: porDeuda.map((o, i) => ({ label: o.d.nombre, stack: 's', backgroundColor: PALETTE[i % PALETTE.length], borderRadius: 3,
      data: labels.map(y => { const r = o.Y.find(z => z.anio === y); return r ? round2(r.pendiente) : 0; }) })) },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true, grid: { display: false } }, y: { ...euroAxis, stacked: true } } } });
  }
}

/* =====================================================================
   DETALLE DE UN PRÉSTAMO
   ===================================================================== */
function simDefault(d) {
  return S.deudaSim[d.id] || { importe: null, cada: 0, desde: addMonths(ymOf(todayISO()), 1), hasta: '', comision: num(d.comision_amortizacion), rent: 4, tax: 21 };
}
function extrasSim(sim, modo) { return extrasPauta({ importe: sim.importe, cada: num(sim.cada), desdeYm: sim.desde, hastaYm: sim.hasta || null, modo }); }

function renderDeudaDetalle(d) {
  const el = $('#tab-deudas');
  const I = deudaInfo(d), sim = simDefault(d), V = S.deudaVista;
  const amos = S.amortizaciones.filter(a => a.deuda_id === d.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const planes = S.amortizaciones_plan.filter(p => p.deuda_id === d.id);
  const ahorroPrev = sum(amos, a => num(a.ahorro_intereses) - num(a.comision)), ahorroYa = sum(amos, a => ahorroDevengado(a, d));
  const planMap = extrasDelPlan(d.id);
  const cmpPlan = planMap.size ? compararAmortizacion(d, planMap) : null;
  // Recordatorio: el plan toca este mes y no hay amortización registrada este mes
  const ymHoy = ymOf(todayISO());
  const tocaHoy = planes.filter(p => p.activo !== false).some(p => { let ym = ymOf(p.desde); const cada = Math.max(1, num(p.cada_meses)); while (ym < ymHoy) ym = addMonths(ym, cada); return ym === ymHoy && (!p.hasta || ymOf(p.hasta) >= ymHoy); })
    && !amos.some(a => ymOf(a.fecha) === ymHoy);

  // Escenario del cuadro
  let escenario = 'base', extras = null, titulo = 'Sin amortizaciones extra';
  if (V.esc === 'plan' && planMap.size) { escenario = 'plan'; extras = planMap; titulo = 'Con tu plan de amortizaciones'; }
  else if (V.esc === 'sim' && num(sim.importe) > 0) { escenario = 'sim'; extras = extrasSim(sim, V.modo); titulo = `Con la simulación · ${MODO_AMORT[V.modo]}`; }
  const cuadro = extras ? (amortizarConExtras(I.pendienteHoy, I.r, I.cuota, addMonths(ymHoy, 1), I.restantes, extras, V.modo) || []) : I.sched.map((x, i) => ({ ...x, n: i + 1, extra: 0, cuotaVigente: I.cuota }));

  el.innerHTML = `
    <div class="section-head"><div style="display:flex;gap:10px;align-items:center"><button class="btn sm ghost" data-action="deu-back">← Todas las deudas</button>
      <div><h2>${esc(d.nombre)}</h2><div class="small muted">${TIPO_DEUDA[d.tipo] || ''}${d.entidad ? ' · ' + esc(d.entidad) : ''} · Interés ${d.tipo_interes || 'fijo'} ${fmtNum(num(d.interes), 2)} %${num(d.comision_amortizacion) ? ` · Comisión amortización ${fmtNum(num(d.comision_amortizacion), 2)} %` : ''}</div></div></div>
      <div class="btn-row"><button class="btn sm" data-action="deu-pend" data-id="${d.id}">Actualizar pendiente</button><button class="btn sm" data-action="deu-edit" data-id="${d.id}">✎ Editar</button><button class="btn sm ghost" data-action="deu-del" data-id="${d.id}">🗑</button></div></div>
    ${bannerV4()}
    ${!I.viable ? '<div class="banner red">⚠ La cuota no cubre los intereses: revisa cuota e interés (✎ Editar).</div>' : ''}
    ${!num(d.capital_inicial) && !num(d.capital_pendiente) ? '<div class="banner blue">Completa los datos del préstamo (✎ Editar): capital inicial, fecha de inicio, plazo, interés, cuota y capital pendiente.</div>' : ''}
    ${tocaHoy ? `<div class="banner amber">📅 Según tu plan, este mes toca una amortización anticipada. Cuando la hagas, regístrala para actualizar el préstamo y tu ahorro. <button class="btn sm" data-action="amo-new" data-id="${d.id}">Registrar amortización</button></div>` : ''}
    ${d.tipo_interes && d.tipo_interes !== 'fijo' ? '<div class="banner blue">Interés variable/mixto: los cálculos suponen que el TIN actual se mantiene. Actualízalo en cada revisión.</div>' : ''}

    <div class="kpis">
      ${kpi(`Capital pendiente${I.estimado ? ' (estimado hoy)' : ''}`, fmtEUR(I.pendienteHoy), `Inicial ${fmtEUR(d.capital_inicial, 0)}`, 'neg')}
      ${kpi('Cuota mensual', fmtEUR(I.cuota), `${fmtNum(I.pagadas || 0, 0)} pagadas · ${I.restantes !== null ? fmtNum(I.restantes, 0) : '—'} restantes`)}
      ${kpi('Fin previsto', I.fin ? ymLabel(I.fin) : '—', d.plazo_meses ? `Plazo contractual ${fmtNum(d.plazo_meses, 0)} meses` : '')}
      ${kpi('Intereses pendientes', fmtEUR(I.interesesPendientes), 'Sin amortizar nada más', 'warn')}
      ${kpi('Ahorro por amortizaciones', fmtEUR(ahorroPrev), `Ya conseguido hasta hoy: <b>${fmtEUR(ahorroYa)}</b>`, 'pos')}
    </div>
    ${I.pctAmort !== null ? `<div class="card" style="padding:14px 18px"><div class="small muted" style="margin-bottom:6px">Amortizado <b>${fmtPct(I.pctAmort)}</b> del capital inicial</div>${pctBar(I.pctAmort, 'navy')}</div>` : ''}

    ${I.sched.length ? renderSimulador(d, I, sim) : ''}

    ${I.sched.length ? `<div class="card"><div class="card-head"><h3>📋 Cuadro de amortización</h3><span class="sub">${titulo}</span></div>
      <div class="btn-row" style="margin-bottom:12px;align-items:center">
        <div class="seg">
          <button data-action="dv-esc" data-v="base" class="${escenario === 'base' ? 'active' : ''}">Sin extras</button>
          <button data-action="dv-esc" data-v="plan" class="${escenario === 'plan' ? 'active' : ''}" ${planMap.size ? '' : 'disabled title="No tienes plan guardado"'}>Con mi plan</button>
          <button data-action="dv-esc" data-v="sim" class="${escenario === 'sim' ? 'active' : ''}" ${num(sim.importe) > 0 ? '' : 'disabled title="Haz primero una simulación"'}>Con la simulación</button>
        </div>
        ${escenario === 'sim' ? `<div class="seg"><button data-action="dv-modo" data-v="plazo" class="${V.modo === 'plazo' ? 'active' : ''}">Reducir plazo</button><button data-action="dv-modo" data-v="cuota" class="${V.modo === 'cuota' ? 'active' : ''}">Reducir cuota</button></div>` : ''}
        <div class="seg"><button data-action="dv-anual" data-v="0" class="${!V.anual ? 'active' : ''}">Mensual</button><button data-action="dv-anual" data-v="1" class="${V.anual ? 'active' : ''}">Anual</button></div>
      </div>
      <div class="chart-box sm" style="margin-bottom:12px"><canvas id="ch-deu-det"></canvas></div>
      ${tablaCuadro(cuadro, V.anual)}
    </div>` : ''}

    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>✅ Amortizaciones realizadas</h3>${S.v4 ? `<button class="btn sm" data-action="amo-new" data-id="${d.id}">+ Registrar</button>` : ''}</div>
        ${amos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th class="right">Importe</th><th>Modo</th><th class="right">Ahorro previsto</th><th class="right">Ya ahorrado</th><th></th></tr></thead><tbody>
          ${amos.map(a => `<tr><td class="small">${fmtDate(a.fecha)}</td><td class="right num">${fmtEUR(a.importe)}</td>
            <td class="small">${a.modo === 'cuota' ? `Cuota ${fmtEUR(a.cuota_antes)} → ${fmtEUR(a.cuota_despues)}` : `Plazo −${num(a.meses_ahorrados)} meses`}${num(a.comision) ? `<br><span class="muted">Comisión ${fmtEUR(a.comision)}</span>` : ''}</td>
            <td class="right num pos">${fmtEUR(num(a.ahorro_intereses) - num(a.comision))}</td><td class="right num pos">${fmtEUR(ahorroDevengado(a, d))}</td>
            <td><button class="mini" data-action="amo-del" data-id="${a.id}">🗑</button></td></tr>`).join('')}
          <tr class="root"><td>Total</td><td class="right num">${fmtEUR(sum(amos, 'importe'))}</td><td></td><td class="right num pos">${fmtEUR(ahorroPrev)}</td><td class="right num pos">${fmtEUR(ahorroYa)}</td><td></td></tr>
          </tbody></table></div><p class="small muted">“Ahorro previsto”: intereses que dejas de pagar en toda la vida del préstamo, menos la comisión. “Ya ahorrado”: intereses que ya no has pagado desde la amortización hasta hoy.</p>`
        : '<div class="empty">Aún no has registrado amortizaciones anticipadas.</div>'}</div>
      <div class="card"><div class="card-head"><h3>🗓️ Plan de amortizaciones periódicas</h3>${S.v4 ? `<button class="btn sm" data-action="plan-new" data-id="${d.id}">+ Añadir</button>` : ''}</div>
        ${planes.length ? planes.map(p => `<div class="cat-row"><span class="cname"><b>${fmtEUR(p.importe)}</b> · ${frecLabel(p.cada_meses)} · desde ${ymLabel(ymOf(p.desde), true)}${p.hasta ? ' hasta ' + ymLabel(ymOf(p.hasta), true) : ''}<br><span class="small muted">${MODO_AMORT[p.modo] || ''}${p.activo === false ? ' · pausado' : ''}</span></span>
          <button class="mini" data-action="plan-edit" data-id="${p.id}">✎</button><button class="mini" data-action="plan-del" data-id="${p.id}">🗑</button></div>`).join('')
          + (cmpPlan ? `<div class="metrics" style="margin-top:12px">${metric('Aportarás en total', fmtEUR(cmpPlan.totalExtra, 0))}${metric('Ahorro neto en intereses', fmtEUR(cmpPlan.neto, 0), 'pos')}${metric('Terminarías en', cmpPlan.finCon ? ymLabel(cmpPlan.finCon, true) : '—')}${metric('Cuota final', fmtEUR(cmpPlan.cuotaFinal))}</div>` : '')
        : '<div class="empty">Sin plan. Simula arriba una amortización periódica y pulsa “Guardar como plan”.</div>'}</div>
    </div>
    ${d.notas ? `<div class="notes">${esc(d.notas)}</div>` : ''}`;

  if (I.sched.length) {
    const Yb = yearly(I.sched), Ye = yearly(cuadro);
    const labels = [...new Set(Yb.map(y => y.anio))];
    const ds = [{ label: 'Pendiente sin extras', data: labels.map(y => { const r = Yb.find(z => z.anio === y); return r ? round2(r.pendiente) : 0; }), borderColor: '#94a3b8', borderDash: [6, 4], tension: .25, pointRadius: 0 }];
    if (escenario !== 'base') ds.push({ label: 'Pendiente ' + (escenario === 'plan' ? 'con plan' : 'con simulación'), data: labels.map(y => { const r = Ye.find(z => z.anio === y); return r ? round2(r.pendiente) : 0; }), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)', fill: true, tension: .25, pointRadius: 2 });
    ds.push({ type: 'bar', label: 'Intereses del año', data: labels.map(y => { const r = Ye.find(z => z.anio === y); return r ? round2(r.interes) : 0; }), backgroundColor: '#f59e0b', yAxisID: 'y1' });
    mkChart('ch-deu-det', { type: 'line', data: { labels, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { y: euroAxis, y1: { ...euroAxis, position: 'right', grid: { display: false }, title: { display: true, text: 'Intereses/año' } }, x: { grid: { display: false } } } } });
  }
}

/* ---------- Simulador: compara sin amortizar / reducir plazo / reducir cuota / invertir ---------- */
function renderSimulador(d, I, sim) {
  let res = '';
  if (num(sim.importe) > 0) {
    const dd = { ...d, comision_amortizacion: sim.comision };
    const P = compararAmortizacion(dd, extrasSim(sim, 'plazo'), 'plazo');
    const C = compararAmortizacion(dd, extrasSim(sim, 'cuota'), 'cuota');
    const inv = valorInvertir(extrasSim(sim, 'plazo'), num(sim.rent), P.finBase);
    const invNeta = inv.ganancia * (1 - num(sim.tax) / 100);
    const mejorAmort = P.neto >= C.neto ? P : C, mejorNombre = P.neto >= C.neto ? 'reducir plazo' : 'reducir cuota';
    const unaVez = !num(sim.cada);
    const row = (l, a, b, c, cls = '') => `<tr><td>${l}</td><td class="right num">${a}</td><td class="right num ${cls}">${b}</td><td class="right num ${cls}">${c}</td></tr>`;
    res = `
      <div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th></th><th class="right">Sin amortizar</th><th class="right">Reducir plazo</th><th class="right">Reducir cuota</th></tr></thead><tbody>
        ${row('Importe amortizado', '—', fmtEUR(P.totalExtra), fmtEUR(C.totalExtra))}
        ${row('Cuotas restantes', fmtNum(P.base.length, 0), `${fmtNum(P.con.length, 0)} <span class="small pos">(−${P.mesesAhorro})</span>`, fmtNum(C.con.length, 0))}
        ${row('Fecha de fin', P.finBase ? ymLabel(P.finBase, true) : '—', P.finCon ? ymLabel(P.finCon, true) : '—', C.finCon ? ymLabel(C.finCon, true) : '—')}
        ${row('Cuota mensual', fmtEUR(I.cuota), fmtEUR(P.cuotaFinal), `${fmtEUR(C.cuotaFinal)} <span class="small pos">(−${fmtEUR(I.cuota - C.cuotaFinal)})</span>`)}
        ${row('Intereses que pagarás', fmtEUR(P.intBase), fmtEUR(P.intCon), fmtEUR(C.intCon))}
        ${row('Total que pagarás (cuotas + amortizaciones)', fmtEUR(P.pagadoBase), fmtEUR(P.pagadoCon), fmtEUR(C.pagadoCon))}
        ${row(`Comisión (${fmtNum(num(sim.comision), 2)} %)`, '—', fmtEUR(P.comision), fmtEUR(C.comision))}
        ${row('<b>Ahorro en intereses</b>', '—', `<b>${fmtEUR(P.ahorro)}</b>`, `<b>${fmtEUR(C.ahorro)}</b>`, 'pos')}
        ${row('<b>Ahorro neto (− comisión)</b>', '—', `<b>${fmtEUR(P.neto)}</b>`, `<b>${fmtEUR(C.neto)}</b>`, 'pos')}
        ${row('Ahorro por cada 1.000 € amortizados', '—', P.totalExtra ? fmtEUR(P.neto / P.totalExtra * 1000) : '—', C.totalExtra ? fmtEUR(C.neto / C.totalExtra * 1000) : '—')}
      </tbody></table></div>
      <div class="alerts" style="margin-top:12px">
        <div class="alert green"><div class="ic">✅</div><div><b class="t">Mejor opción de amortización: ${mejorNombre}</b>
          Te ahorras <b>${fmtEUR(mejorAmort.neto)}</b> netos en intereses${mejorNombre === 'reducir plazo' ? ` y terminas ${P.mesesAhorro} meses antes` : ` y tu cuota baja ${fmtEUR(I.cuota - C.cuotaFinal)}/mes`}.
          Amortizar equivale a una rentabilidad <b>segura del ${fmtNum(num(d.interes), 2)} % anual</b> sin riesgo ni impuestos. Reducir plazo siempre ahorra más intereses; reducir cuota da más margen mensual.</div></div>
        <div class="alert ${invNeta > mejorAmort.neto ? 'amber' : 'blue'}"><div class="ic">📈</div><div><b class="t">¿Y si lo invirtieras al ${fmtNum(num(sim.rent), 1)} % anual?</b>
          Hasta ${P.finBase ? ymLabel(P.finBase, true) : 'el fin del préstamo'} ganarías unos <b>${fmtEUR(inv.ganancia, 0)}</b> brutos, <b>${fmtEUR(invNeta, 0)}</b> tras impuestos (${fmtNum(num(sim.tax), 0)} %), frente a ${fmtEUR(mejorAmort.neto, 0)} de ahorro seguro amortizando.
          ${invNeta > mejorAmort.neto ? 'Sobre el papel compensa más invertir, pero esa rentabilidad no está garantizada y amortizar no tiene riesgo.' : 'Amortizar sale mejor que invertir a esa rentabilidad, y además sin riesgo.'}
          <span class="muted">Comparación orientativa: supone rentabilidad constante y no considera tu fondo de emergencia, desgravaciones ni seguros vinculados.</span></div></div>
      </div>
      <div class="btn-row" style="margin-top:12px">
        ${S.v4 && !unaVez ? `<button class="btn sm primary" data-action="sim-plan" data-id="${d.id}">Guardar como plan periódico</button>` : ''}
        ${S.v4 && unaVez ? `<button class="btn sm primary" data-action="amo-new" data-id="${d.id}" data-imp="${sim.importe}">Ya la he hecho: registrar amortización</button>` : ''}
        <button class="btn sm ghost" data-action="dv-esc" data-v="sim">Ver en el cuadro de amortización ↓</button>
      </div>`;
  }
  return `<div class="card"><div class="card-head"><h3>🧮 Simulador: ¿amortizo o no?</h3><span class="sub">Cálculo exacto mes a mes con tus datos</span></div>
    <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div><label>Importe (€)</label><input id="sim-imp" inputmode="decimal" placeholder="Ej: 3.000" value="${esc(numInput(sim.importe))}"></div>
      <div><label>Frecuencia</label><select id="sim-cada">${FRECUENCIAS.map(f => `<option value="${f.v}" ${num(sim.cada) === f.v ? 'selected' : ''}>${f.l}</option>`).join('')}</select></div>
      <div><label>Desde (mes)</label><input type="month" id="sim-desde" value="${esc(sim.desde)}"></div>
      <div><label>Hasta (opcional)</label><input type="month" id="sim-hasta" value="${esc(sim.hasta || '')}"></div>
      <div><label>Comisión (%)</label><input id="sim-com" inputmode="decimal" value="${esc(numInput(sim.comision))}"></div>
      <div><label>Rentab. alternativa (%)</label><input id="sim-rent" inputmode="decimal" value="${esc(numInput(sim.rent))}"></div>
      <div><label>Impuestos ganancias (%)</label><input id="sim-tax" inputmode="decimal" value="${esc(numInput(sim.tax))}"></div>
      <div style="display:flex;align-items:flex-end"><button class="btn primary" data-action="deu-sim" data-id="${d.id}" style="width:100%">Calcular</button></div>
    </div>${res}</div>`;
}

function tablaCuadro(rows, anual) {
  if (!rows.length) return '<div class="empty">Sin cuotas pendientes.</div>';
  const tot = { cuota: sum(rows, 'cuota'), interes: sum(rows, 'interes'), capital: sum(rows, 'capital'), extra: sum(rows, 'extra') };
  let body;
  if (anual) {
    const m = new Map();
    for (const r of rows) { const y = r.ym.slice(0, 4); const o = m.get(y) || { y, n: 0, cuota: 0, interes: 0, capital: 0, extra: 0, pendiente: 0 }; o.n++; o.cuota += r.cuota; o.interes += r.interes; o.capital += r.capital; o.extra += r.extra || 0; o.pendiente = r.pendiente; m.set(y, o); }
    body = [...m.values()].map(o => `<tr><td>${o.y}</td><td class="right">${o.n}</td><td class="right num">${fmtEUR(o.cuota)}</td><td class="right num warn-t">${fmtEUR(o.interes)}</td><td class="right num">${fmtEUR(o.capital)}</td><td class="right num pos">${o.extra ? fmtEUR(o.extra) : '—'}</td><td class="right num">${fmtEUR(o.pendiente)}</td></tr>`).join('');
    return `<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>Año</th><th class="right">Cuotas</th><th class="right">Pagado en cuotas</th><th class="right">Intereses</th><th class="right">Capital</th><th class="right">Amort. extra</th><th class="right">Pendiente fin año</th></tr></thead><tbody>${body}
      <tr class="root"><td>Total</td><td class="right">${rows.length}</td><td class="right num">${fmtEUR(tot.cuota)}</td><td class="right num warn-t">${fmtEUR(tot.interes)}</td><td class="right num">${fmtEUR(tot.capital)}</td><td class="right num pos">${fmtEUR(tot.extra)}</td><td></td></tr></tbody></table></div>`;
  }
  body = rows.map(r => `<tr${r.extra ? ' style="background:#f0fdf4"' : ''}><td class="right">${r.n}</td><td>${ymLabel(r.ym, true)}</td><td class="right num">${fmtEUR(r.cuota)}</td><td class="right num warn-t">${fmtEUR(r.interes)}</td><td class="right num">${fmtEUR(r.capital)}</td><td class="right num pos">${r.extra ? fmtEUR(r.extra) : ''}</td><td class="right num">${fmtEUR(r.pendiente)}</td></tr>`).join('');
  return `<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th class="right">Nº</th><th>Mes</th><th class="right">Cuota</th><th class="right">Intereses</th><th class="right">Capital</th><th class="right">Amort. extra</th><th class="right">Pendiente</th></tr></thead><tbody>${body}
    <tr class="root"><td></td><td>Total</td><td class="right num">${fmtEUR(tot.cuota)}</td><td class="right num warn-t">${fmtEUR(tot.interes)}</td><td class="right num">${fmtEUR(tot.capital)}</td><td class="right num pos">${fmtEUR(tot.extra)}</td><td></td></tr></tbody></table></div>`;
}
function yearly(sched) {
  const m = new Map();
  for (const s of sched) { const y = s.ym.slice(0, 4); const o = m.get(y) || { anio: y, cuotas: 0, cuota: 0, interes: 0, capital: 0, pendiente: 0 }; o.cuotas++; o.cuota += s.cuota; o.interes += s.interes; o.capital += s.capital; o.pendiente = s.pendiente; m.set(y, o); }
  return [...m.values()];
}

/* ---------- Formularios ---------- */
const FIELDS_PLAN = [
  { name: 'importe', label: 'Importe de cada amortización (€)', type: 'number', required: true },
  { name: 'cada_meses', label: 'Frecuencia', type: 'select', options: FRECUENCIAS.filter(f => f.v > 0).map(f => ({ v: f.v, l: f.l })) },
  { name: 'desde', label: 'Primera amortización', type: 'date', required: true }, { name: 'hasta', label: 'Última (opcional)', type: 'date' },
  { name: 'modo', label: 'Modalidad', type: 'select', options: Object.entries(MODO_AMORT).map(([v, l]) => ({ v, l })) },
  { name: 'activo', label: 'Plan activo', type: 'checkbox', def: true }, { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
function openAmortizacion(d, importe) {
  const fields = [
    { name: 'fecha', label: 'Fecha', type: 'date', required: true }, { name: 'importe', label: 'Importe amortizado (€)', type: 'number', required: true },
    { name: 'modo', label: 'Modalidad', type: 'select', options: Object.entries(MODO_AMORT).map(([v, l]) => ({ v, l })) },
    { name: 'comision', label: 'Comisión cobrada (€)', type: 'number', hint: `Vacío = ${fmtNum(num(d.comision_amortizacion), 2)} % del importe` },
    { name: 'actualizar', label: 'Actualizar el capital pendiente (y la cuota) del préstamo', type: 'checkbox', def: true, full: true },
    { name: 'notas', label: 'Notas', type: 'textarea', full: true }
  ];
  openForm({ title: `Registrar amortización · ${d.nombre}`, fields, values: { fecha: todayISO(), importe: importe || null, modo: 'plazo', actualizar: true },
    intro: `<p class="small muted">Capital pendiente estimado hoy: <b>${fmtEUR(deudaInfo(d).pendienteHoy)}</b>. Se guardará el ahorro previsto en intereses calculado con tus datos actuales.</p>`,
    onSubmit: async v => {
      _deudaCache = new Map();
      const I = deudaInfo(d);
      if (v.importe <= 0 || v.importe > I.pendienteHoy + 0.01) throw new Error('El importe debe ser mayor que 0 y no superar el capital pendiente');
      const ef = efectoAmortizacion(d, v.importe, v.modo);
      const comision = v.comision !== null ? v.comision : round2(v.importe * num(d.comision_amortizacion) / 100);
      await DB.insert('amortizaciones', [{ deuda_id: d.id, fecha: v.fecha, importe: v.importe, modo: v.modo, comision, pendiente_antes: ef.antes, cuota_antes: ef.cuotaAntes, cuota_despues: ef.cuotaDespues, meses_ahorrados: ef.meses, ahorro_intereses: ef.ahorro, notas: v.notas }]);
      if (v.actualizar) await DB.update('deudas', d.id, { capital_pendiente: ef.despues, fecha_capital_pendiente: v.fecha, cuota_mensual: ef.cuotaDespues });
      await reloadTables('amortizaciones', 'deudas');
      toast(`Amortización registrada · ahorro previsto ${fmtEUR(ef.ahorro - comision)}`, 'ok', 4500);
    } });
}

Views.deudas = renderDeudas;

Object.assign(Actions, {
  'deu-open': el => { S.deudaSel = el.dataset.id; render(); window.scrollTo({ top: 0 }); },
  'deu-back': () => { S.deudaSel = null; render(); },
  'deu-new': () => openForm({ title: 'Nuevo préstamo', fields: camposV4(FIELDS_DEUDA), values: { tipo: 'prestamo_personal', tipo_interes: 'fijo', activa: true, fecha_capital_pendiente: todayISO() }, onSubmit: v => saveEntity('deudas', null, { ...v, inmueble_id: v.inmueble_id || null }) }),
  'deu-edit': el => { const d = S.deudas.find(x => x.id === el.dataset.id); openForm({ title: 'Editar préstamo', fields: camposV4(FIELDS_DEUDA), values: d, onSubmit: v => saveEntity('deudas', d.id, { ...v, inmueble_id: v.inmueble_id || null }) }); },
  'deu-del': async el => { const d = S.deudas.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(d.nombre)}</b> con sus amortizaciones y plan?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('deudas', d.id); await reloadTables('deudas', ...(S.v4 ? ['amortizaciones', 'amortizaciones_plan'] : [])); }, 'Eliminado'); S.deudaSel = null; render(); },
  'deu-pend': el => {
    const d = S.deudas.find(x => x.id === el.dataset.id);
    openForm({ title: `Capital pendiente · ${d.nombre}`, intro: '<p class="small muted">Copia el capital pendiente del último recibo o de la app del banco. Entre actualizaciones, la app lo estima descontando la parte de capital de cada cuota.</p>',
      fields: [{ name: 'capital_pendiente', label: 'Capital pendiente (€)', type: 'number', required: true }, { name: 'fecha_capital_pendiente', label: 'A fecha de', type: 'date' }, { name: 'interes', label: 'TIN vigente (%)', type: 'number' }, { name: 'cuota_mensual', label: 'Cuota mensual (€)', type: 'number' }],
      values: { capital_pendiente: deudaInfo(d).pendienteHoy, fecha_capital_pendiente: todayISO(), interes: d.interes, cuota_mensual: d.cuota_mensual },
      onSubmit: v => saveEntity('deudas', d.id, { ...v, fecha_capital_pendiente: v.fecha_capital_pendiente || todayISO() }) });
  },
  'deu-sim': el => {
    const d = S.deudas.find(x => x.id === el.dataset.id);
    const imp = parseNum($('#sim-imp').value);
    if (!imp || isNaN(imp) || imp <= 0) { toast('Introduce el importe a amortizar', 'warn'); return; }
    S.deudaSim[d.id] = { importe: Math.abs(imp), cada: +$('#sim-cada').value, desde: $('#sim-desde').value || addMonths(ymOf(todayISO()), 1), hasta: $('#sim-hasta').value || '',
      comision: num($('#sim-com').value), rent: num($('#sim-rent').value), tax: num($('#sim-tax').value) };
    render();
  },
  'sim-plan': el => {
    const d = S.deudas.find(x => x.id === el.dataset.id), sim = S.deudaSim[d.id];
    openForm({ title: 'Guardar plan de amortizaciones', fields: FIELDS_PLAN, values: { importe: sim.importe, cada_meses: sim.cada, desde: sim.desde + '-01', hasta: sim.hasta ? sim.hasta + '-28' : null, modo: S.deudaVista.modo, activo: true },
      onSubmit: async v => { await DB.insert('amortizaciones_plan', [{ ...v, cada_meses: +v.cada_meses, deuda_id: d.id }]); await reloadTable('amortizaciones_plan'); } });
  },
  'amo-new': el => openAmortizacion(S.deudas.find(x => x.id === el.dataset.id), el.dataset.imp ? num(el.dataset.imp) : null),
  'amo-del': async el => {
    const a = S.amortizaciones.find(x => x.id === el.dataset.id);
    if (!(await confirmDlg(`¿Eliminar la amortización del ${fmtDate(a.fecha)} (${fmtEUR(a.importe)}) del historial?<br><span class="small">No revierte el capital pendiente del préstamo: si hace falta, corrígelo con “Actualizar pendiente”.</span>`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('amortizaciones', a.id); await reloadTable('amortizaciones'); }, 'Eliminada'); render();
  },
  'plan-new': el => openForm({ title: 'Nuevo plan de amortización', fields: FIELDS_PLAN, values: { cada_meses: 12, desde: todayISO(), modo: 'plazo', activo: true },
    onSubmit: async v => { await DB.insert('amortizaciones_plan', [{ ...v, cada_meses: +v.cada_meses, deuda_id: el.dataset.id }]); await reloadTable('amortizaciones_plan'); } }),
  'plan-edit': el => { const p = S.amortizaciones_plan.find(x => x.id === el.dataset.id); openForm({ title: 'Editar plan', fields: FIELDS_PLAN, values: p, onSubmit: async v => { await DB.update('amortizaciones_plan', p.id, { ...v, cada_meses: +v.cada_meses }); await reloadTable('amortizaciones_plan'); } }); },
  'plan-del': async el => { if (!(await confirmDlg('¿Eliminar este plan?', 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('amortizaciones_plan', el.dataset.id); await reloadTable('amortizaciones_plan'); }, 'Plan eliminado'); render(); },
  'dv-esc': el => { S.deudaVista.esc = el.dataset.v; render(); },
  'dv-modo': el => { S.deudaVista.modo = el.dataset.v; render(); },
  'dv-anual': el => { S.deudaVista.anual = el.dataset.v === '1'; render(); }
});
