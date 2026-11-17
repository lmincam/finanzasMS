'use strict';
/* =====================================================================
   PESTAÑA · PROYECCIÓN E INDEPENDENCIA FINANCIERA
   ---------------------------------------------------------------------
   • Proyección del patrimonio neto a 10-40 años en tres escenarios
     (prudente / medio / optimista), con revalorización de la vivienda,
     depreciación de vehículos, calendario real de las deudas y,
     opcionalmente, invirtiendo la cuota de la hipoteca cuando termine.
   • Valores nominales o en "euros de hoy" (descontando la inflación).
   • Independencia financiera: capital necesario para vivir de rentas
     (regla del % de retiro), progreso, años y edad estimados, efecto de
     la pensión pública y sensibilidad a aportar más o rentar más.
   Supuestos editables, guardados en ajustes ('proyeccion').
   Depende de: calculos.js, ui.js, graficos.js, alertas.js (mediaHistorica)
   ===================================================================== */

const PROY_DEF = { anios: 25, aportMes: null, rentP: 3, rentM: 5, rentO: 7, revVivienda: 2, depVeh: 12, inflacion: 2.5, crecAport: 2.5,
  invertirCuota: true, gastoAnual: null, tasaRetiro: 4, nacimiento: null, pension: null, edadPension: 67 };
const supuestos = () => ({ ...PROY_DEF, ...((((S.ajustesRows || []).find(r => r.clave === 'proyeccion') || {}).valor) || {}) });
S.proyReal = S.proyReal !== undefined ? S.proyReal : true;

/** Aportación mensual a inversión por defecto: las periódicas activas o, si no hay, la media de los últimos 12 meses. */
function aportacionAuto() {
  const per = aportacionMensual();
  if (per > 0) return per;
  const inv = new Set(S.cuentas.filter(c => c.tipo === 'inversion').map(c => c.id)), desde = addMonths(ymOf(todayISO()), -12) + '-01';
  return Math.max(0, sum(S.movimientos.filter(m => inv.has(m.cuenta_id) && m.tipo === 'transferencia' && m.fecha >= desde), 'importe') / 12);
}
/** Gasto anual de referencia: gastos operativos medios de los últimos 6 meses × 12 (sin capital de deuda). */
function gastoAnualAuto() { const h = mediaHistorica(mesActual(), 6); return h ? h.gastos * 12 : 0; }

/** Deuda pendiente total al final de un año, según el calendario de cada préstamo. */
function deudaFinAnio(anio) {
  return sum(S.deudas.filter(d => d.activa !== false), d => { const I = deudaInfo(d); if (!I.sched.length) return 0;
    const fin = `${anio}-12`, r = I.sched.filter(x => x.ym <= fin).pop(); return r ? r.pendiente : (I.sched[0].ym > fin ? I.pendienteHoy : 0); });
}
/** Cuota total que queda libre (préstamos ya terminados) en un mes. */
function cuotaLiberada(ym) { return sum(S.deudas.filter(d => d.activa !== false), d => { const I = deudaInfo(d); return I.fin && ym > I.fin ? I.cuota : 0; }); }

/** Proyecta año a año. rent = rentabilidad anual de las inversiones (%). */
function proyectar(rent, sup = supuestos()) {
  const P = Calc.patrimonio(), y0 = +todayISO().slice(0, 4), ym0 = ymOf(todayISO());
  const rm = Math.pow(1 + rent / 100, 1 / 12) - 1, inf = sup.inflacion / 100;
  let inv = P.inversiones, inm = P.inmuebles, veh = P.vehiculos;
  const aport0 = sup.aportMes !== null && sup.aportMes !== undefined && sup.aportMes !== '' ? num(sup.aportMes) : aportacionAuto();
  const out = [{ t: 0, anio: y0, liquidez: P.liquidez, inversiones: inv, inmuebles: inm, vehiculos: veh, deudas: P.deudas, neto: P.neto, real: P.neto, aportMes: aport0 }];
  let ym = ym0;
  for (let t = 1; t <= sup.anios; t++) {
    let aportAnio = 0;
    for (let k = 0; k < 12; k++) {
      ym = addMonths(ym, 1);
      const a = aport0 * Math.pow(1 + sup.crecAport / 100, t - 1) + (sup.invertirCuota ? cuotaLiberada(ym) : 0);
      inv = inv * (1 + rm) + a; aportAnio += a;
    }
    inm *= 1 + sup.revVivienda / 100; veh *= 1 - sup.depVeh / 100;
    const deu = deudaFinAnio(y0 + t), neto = P.liquidez + inv + inm + veh - deu;
    out.push({ t, anio: y0 + t, liquidez: P.liquidez, inversiones: inv, inmuebles: inm, vehiculos: veh, deudas: deu, neto, real: neto / Math.pow(1 + inf, t), aportMes: aportAnio / 12 });
  }
  return out;
}

/** Independencia financiera en euros de hoy (rentabilidad real = nominal − inflación). */
function calcularFIRE(sup = supuestos()) {
  const P = Calc.patrimonio(), y0 = +todayISO().slice(0, 4);
  const gasto = sup.gastoAnual ? num(sup.gastoAnual) : gastoAnualAuto();
  const objetivo = gasto > 0 ? gasto / (sup.tasaRetiro / 100) : 0;
  const pensionAnual = num(sup.pension) * 14; // las pensiones públicas se cobran en 14 pagas
  const objetivoPension = gasto > 0 ? Math.max(0, gasto - pensionAnual) / (sup.tasaRetiro / 100) : 0;
  const capital = P.inversiones + P.reserva; // lo que puede generar rentas (sin vivienda habitual ni vehículos)
  const aport0 = sup.aportMes !== null && sup.aportMes !== undefined && sup.aportMes !== '' ? num(sup.aportMes) : aportacionAuto();
  const edadHoy = sup.nacimiento ? y0 - num(sup.nacimiento) : null;
  const anios = (rentNominal, aport = aport0, meta = objetivo) => {
    if (!meta) return null; if (capital >= meta) return 0;
    const rr = (1 + rentNominal / 100) / (1 + sup.inflacion / 100) - 1, rm = Math.pow(1 + rr, 1 / 12) - 1;
    let c = capital, ym = ymOf(todayISO());
    const cuotaReal = m => sup.invertirCuota ? cuotaLiberada(m) / Math.pow(1 + sup.inflacion / 100, monthsDiff(todayISO(), m + '-01') / 12) : 0;
    for (let k = 1; k <= 720; k++) { ym = addMonths(ym, 1); c = c * (1 + rm) + aport + cuotaReal(ym); if (c >= meta) return k / 12; }
    return null;
  };
  const esc = { P: anios(sup.rentP), M: anios(sup.rentM), O: anios(sup.rentO) };
  return { gasto, objetivo, objetivoPension, pensionAnual, capital, aport0, edadHoy, esc, progreso: objetivo ? capital / objetivo : 0,
    mas100: anios(sup.rentM, aport0 + 100), mas1: anios(sup.rentM + 1), menos1: anios(sup.rentM - 1),
    conPension: pensionAnual ? anios(sup.rentM, aport0, objetivoPension) : null };
}

/* =====================================================================
   VISTA
   ===================================================================== */
function renderFuturo() {
  const el = $('#tab-futuro'), sup = supuestos(), real = S.proyReal;
  const PR = proyectar(sup.rentP, sup), ME = proyectar(sup.rentM, sup), OP = proyectar(sup.rentO, sup), F = calcularFIRE(sup);
  const v = r => real ? r.real : r.neto, ult = ME[ME.length - 1];
  const edad = t => F.edadHoy !== null ? ` · ${F.edadHoy + Math.ceil(t)} años` : '';
  const anioTxt = a => a === null ? 'más de 60 años' : a === 0 ? '¡ya!' : `${fmtNum(a, 1)} años (${+todayISO().slice(0, 4) + Math.ceil(a)}${edad(a)})`;
  const hitos = [];
  const finDeuda = S.deudas.filter(d => d.activa !== false).map(d => deudaInfo(d).fin).filter(Boolean).sort().pop();
  if (finDeuda) hitos.push(['🏦', 'Sin deudas', ymLabel(finDeuda)]);
  for (const [meta, txt] of [[100000, '100.000 € invertidos'], [250000, '250.000 € invertidos'], [500000, '500.000 € invertidos']]) { const r = ME.find(x => x.inversiones >= meta); if (r && r.t > 0 && Calc.patrimonio().inversiones < meta) hitos.push(['📈', txt, `${r.anio}${edad(r.t)}`]); }
  for (const [meta, txt] of [[500000, 'Patrimonio neto de 500.000 €'], [1000000, 'Patrimonio neto de 1 millón']]) { const r = ME.find(x => v(x) >= meta); if (r && r.t > 0) hitos.push(['🏆', txt + (real ? ' (euros de hoy)' : ''), `${r.anio}${edad(r.t)}`]); }
  const tabla = ME.filter(r => r.t % 5 === 0 || r.t === ME.length - 1);

  el.innerHTML = `
    <div class="section-head"><div><h2>Proyección</h2></div>
      <div class="btn-row"><div class="seg"><button data-action="proy-real" data-v="1" class="${real ? 'active' : ''}">Euros de hoy</button><button data-action="proy-real" data-v="0" class="${!real ? 'active' : ''}">Nominal</button></div>
        <button class="btn" data-action="proy-sup">⚙ Supuestos</button></div></div>
    <div class="small muted sup-line">Supuestos: aportas <b>${fmtEUR(F.aport0, 0)}/mes</b> a inversión (sube un ${fmtNum(sup.crecAport, 1)} %/año)${sup.invertirCuota ? ' + la cuota de cada préstamo cuando termine' : ''} · rentabilidad ${fmtNum(sup.rentP, 1)} / ${fmtNum(sup.rentM, 1)} / ${fmtNum(sup.rentO, 1)} % · vivienda +${fmtNum(sup.revVivienda, 1)} %/año · vehículos −${fmtNum(sup.depVeh, 0)} %/año · inflación ${fmtNum(sup.inflacion, 1)} %.</div>
    <div class="kpis">
      ${kpi('Patrimonio neto hoy', fmtEUR(ME[0].neto, 0), `Invertible: ${fmtEUR(F.capital, 0)}`, 'navy')}
      ${kpi(`En ${sup.anios} años (escenario medio)`, fmtEUR(v(ult), 0), `${real ? 'En euros de hoy' : 'Nominal'} · rango ${fmtEUR(v(PR[PR.length - 1]), 0)} – ${fmtEUR(v(OP[OP.length - 1]), 0)}`, 'pos')}
      ${kpi('Libertad financiera', fmtPct(Math.min(1, F.progreso), 0), F.objetivo ? `Tienes ${fmtEUR(F.capital, 0)} de ${fmtEUR(F.objetivo, 0)}` : 'Necesito tus gastos medios', F.progreso >= 1 ? 'pos' : '')}
      ${kpi('La alcanzarías en', F.esc.M === null ? '—' : F.esc.M === 0 ? '¡Ya!' : `${fmtNum(F.esc.M, 1)} años`, F.esc.M ? `${+todayISO().slice(0, 4) + Math.ceil(F.esc.M)}${edad(F.esc.M)} · escenario medio` : '')}
    </div>
    <div class="card"><div class="card-head"><h3>Patrimonio neto proyectado</h3><span class="sub">${real ? 'En euros de hoy (descontada la inflación)' : 'Nominal'}</span></div><div class="chart-box"><canvas id="ch-proy"></canvas></div></div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>🗽 Independencia financiera</h3><span class="sub">Vivir de rentas con la regla del ${fmtNum(sup.tasaRetiro, 1)} %</span></div>
        ${F.objetivo ? `<div class="metrics">
          ${metric('Gasto anual de referencia', fmtEUR(F.gasto, 0), '')}${metric(`Capital necesario (÷ ${fmtNum(sup.tasaRetiro, 1)} %)`, fmtEUR(F.objetivo, 0))}
          ${metric('Capital invertible hoy', fmtEUR(F.capital, 0))}${metric('Te falta', fmtEUR(Math.max(0, F.objetivo - F.capital), 0), 'neg')}
        </div>
        <div style="margin:12px 0 4px" class="small muted">Progreso ${fmtPct(Math.min(1, F.progreso), 1)}</div>${pctBar(F.progreso, 'navy')}
        <table class="tbl" style="margin-top:12px"><thead><tr><th>Escenario</th><th class="right">Rentab.</th><th class="right">La alcanzarías en</th></tr></thead><tbody>
          <tr><td>Prudente</td><td class="right">${fmtNum(sup.rentP, 1)} %</td><td class="right">${anioTxt(F.esc.P)}</td></tr>
          <tr class="root"><td>Medio</td><td class="right">${fmtNum(sup.rentM, 1)} %</td><td class="right">${anioTxt(F.esc.M)}</td></tr>
          <tr><td>Optimista</td><td class="right">${fmtNum(sup.rentO, 1)} %</td><td class="right">${anioTxt(F.esc.O)}</td></tr>
        </tbody></table>
        ${F.pensionAnual ? `<div class="banner blue" style="margin-top:12px">${F.objetivoPension <= 0 ? `Con una pensión de ${fmtEUR(sup.pension, 0)}/mes (14 pagas), a partir de los ${sup.edadPension} años <b>la pensión cubriría todo tu gasto de referencia</b>: el capital que acumules sería un extra o una herencia, y lo que necesitas es poder vivir hasta entonces.` : `Con una pensión de ${fmtEUR(sup.pension, 0)}/mes (14 pagas), a partir de los ${sup.edadPension} años solo necesitarías <b>${fmtEUR(F.objetivoPension, 0)}</b> de capital${F.conPension !== null ? `, que reunirías en <b>${anioTxt(F.conPension)}</b>` : ''}.`}</div>` : '<p class="small muted">Puedes indicar en ⚙ Supuestos tu pensión pública estimada para ver cuánto capital necesitarías al jubilarte.</p>'}
        <div class="sub-title">¿Qué lo acelera?</div>
        <ul class="small" style="margin:0;padding-left:18px;line-height:1.7">
          ${F.esc.M && F.mas100 !== null ? `<li>Aportar <b>100 €/mes más</b>: la adelantas <b>${fmtNum(F.esc.M - F.mas100, 1)} años</b>.</li>` : ''}
          ${F.esc.M && F.mas1 !== null ? `<li><b>1 punto más</b> de rentabilidad (comisiones más bajas, más renta variable): <b>${fmtNum(F.esc.M - F.mas1, 1)} años</b> antes.</li>` : ''}
          ${F.esc.M && F.menos1 !== null ? `<li>Con <b>1 punto menos</b>, se retrasa <b>${fmtNum(F.menos1 - F.esc.M, 1)} años</b>: vigila las comisiones de tus fondos.</li>` : ''}
          <li>Gastar <b>100 €/mes menos</b> reduce el capital necesario en <b>${fmtEUR(1200 / (sup.tasaRetiro / 100), 0)}</b>.</li>
        </ul>` : '<div class="empty">Importa unos meses de movimientos (o indica tu gasto anual en ⚙ Supuestos) para calcularla.</div>'}
      </div>
      <div class="card"><div class="card-head"><h3>🏁 Hitos previstos</h3><span class="sub">Escenario medio</span></div>
        ${hitos.length ? `<div class="top-list">${hitos.map(([i, t, c]) => `<div class="it"><div class="c">${i} ${esc(t)}</div><div><b>${esc(c)}</b></div></div>`).join('')}</div>` : '<div class="empty">—</div>'}
        <div class="sub-title">Cada 5 años (escenario medio${real ? ', euros de hoy' : ''})</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Año</th><th class="right">Invertido</th><th class="right">Inmuebles</th><th class="right">Deudas</th><th class="right">Neto</th></tr></thead><tbody>
          ${tabla.map(r => { const d = real ? Math.pow(1 + sup.inflacion / 100, r.t) : 1; return `<tr><td>${r.anio}${F.edadHoy !== null ? ` <span class="small muted">(${F.edadHoy + r.t})</span>` : ''}</td><td class="right num">${fmtEUR(r.inversiones / d, 0)}</td><td class="right num">${fmtEUR(r.inmuebles / d, 0)}</td><td class="right num neg">${fmtEUR(r.deudas / d, 0)}</td><td class="right num"><b>${fmtEUR(v(r), 0)}</b></td></tr>`; }).join('')}
        </tbody></table></div></div>
    </div>`;

  const lab = ME.map(r => r.anio);
  mkChart('ch-proy', { type: 'line', data: { labels: lab, datasets: [
    { label: 'Optimista', data: OP.map(v), borderColor: '#86efac', backgroundColor: 'rgba(134,239,172,.15)', fill: '+1', pointRadius: 0, tension: .25 },
    { label: 'Medio', data: ME.map(v), borderColor: '#16a34a', backgroundColor: '#16a34a', borderWidth: 3, pointRadius: 0, tension: .25 },
    { label: 'Prudente', data: PR.map(v), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.12)', fill: '-1', pointRadius: 0, tension: .25 },
    ...(F.objetivo ? [{ label: 'Libertad financiera (capital invertible necesario)', data: ME.map(r => real ? F.objetivo : F.objetivo * Math.pow(1 + sup.inflacion / 100, r.t)), borderColor: '#7c3aed', borderDash: [6, 4], pointRadius: 0 },
      { label: 'Capital invertible (medio)', data: ME.map(r => { const d = real ? Math.pow(1 + sup.inflacion / 100, r.t) : 1; return (r.inversiones + Calc.patrimonio().reserva) / d; }), borderColor: '#1e3a8a', borderWidth: 2, pointRadius: 0, tension: .25 }] : [])
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: euroAxis, x: { grid: { display: false } } } } });
}
Views.futuro = renderFuturo;

const FIELDS_PROY = [
  { name: 'anios', label: 'Años a proyectar', type: 'int' },
  { name: 'aportMes', label: 'Aportación mensual a inversión (€)', type: 'number', hint: 'Vacío = automática (tus aportaciones periódicas o la media de 12 meses)' },
  { name: 'crecAport', label: 'La aportación sube cada año (%)', type: 'number' },
  { name: 'invertirCuota', label: 'Invertir la cuota de cada préstamo cuando termine', type: 'checkbox', full: true },
  { name: 'rentP', label: 'Rentabilidad prudente (%/año)', type: 'number' }, { name: 'rentM', label: 'Rentabilidad media (%/año)', type: 'number' },
  { name: 'rentO', label: 'Rentabilidad optimista (%/año)', type: 'number' }, { name: 'inflacion', label: 'Inflación (%/año)', type: 'number', hint: 'El objetivo del BCE es el 2 %' },
  { name: 'revVivienda', label: 'Revalorización vivienda (%/año)', type: 'number' }, { name: 'depVeh', label: 'Depreciación vehículos (%/año)', type: 'number' },
  { name: 'gastoAnual', label: 'Gasto anual para vivir (€, euros de hoy)', type: 'number', hint: 'Vacío = tus gastos operativos medios × 12' },
  { name: 'tasaRetiro', label: 'Tasa de retiro segura (%)', type: 'number', hint: '4 % clásico; 3-3,5 % más prudente' },
  { name: 'nacimiento', label: 'Año de nacimiento (opcional, para ver edades)', type: 'int' },
  { name: 'pension', label: 'Pensión pública estimada (€/mes netos, 14 pagas)', type: 'number' }, { name: 'edadPension', label: 'Edad de jubilación', type: 'int' }
];
Object.assign(Actions, {
  'proy-real': el => { S.proyReal = el.dataset.v === '1'; render(); },
  'proy-sup': () => openForm({ title: 'Supuestos de la proyección', fields: FIELDS_PROY, values: supuestos(),
    intro: '<p class="small muted">Como referencia: una cartera indexada global ha rentado históricamente en torno a un 6-7 % nominal anual a largo plazo, con años muy negativos por el camino. Ser prudente es mejor que llevarse sorpresas.</p>',
    onSubmit: async v => {
      for (const k of Object.keys(v)) if (v[k] === null && PROY_DEF[k] !== null && k !== 'aportMes' && k !== 'gastoAnual') v[k] = PROY_DEF[k];
      await DB.upsert('ajustes', { clave: 'proyeccion', valor: v, updated_at: new Date().toISOString() }, 'clave');
      const r = (S.ajustesRows || []).find(x => x.clave === 'proyeccion'); if (r) r.valor = v; else (S.ajustesRows = S.ajustesRows || []).push({ clave: 'proyeccion', valor: v });
    } })
});
