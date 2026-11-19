'use strict';
/* =====================================================================
   PREVISIÓN DE TESORERÍA
   ---------------------------------------------------------------------
   Proyecta mes a mes el dinero disponible en cuentas operativas
   (corriente + efectivo) combinando:
     • Recurrentes detectados en tu historial (nómina, luz, colegio…)
     • Partidas previstas que añades a mano (pagas extra, IBI…)
     • Cuotas de préstamos, recibos de seguros, aportaciones periódicas
       y plan de amortizaciones que ya conoce la app
     • Gasto variable estimado (media de lo no recurrente)
     • Aportación mensual a tus metas (opcional)
   Depende de: calculos.js, reglas.js (proponerPatron), seguros (seguroInfo), metas.js
   ===================================================================== */

const FREQS_DET = [1, 2, 3, 6, 12];
const FREQ_LABEL = { 0: 'Una vez', 1: 'Mensual', 2: 'Bimestral', 3: 'Trimestral', 4: 'Cuatrimestral', 6: 'Semestral', 12: 'Anual' };
const cuentasOperativas = () => S.cuentas.filter(c => (c.tipo === 'corriente' || c.tipo === 'efectivo') && c.activa !== false);
const prevIgnorados = () => new Set((((S.ajustesRows || []).find(r => r.clave === 'prevision_ignorar') || {}).valor || {}).claves || []);
const median2 = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Detecta ingresos y gastos que se repiten con una periodicidad y un importe estables. */
/**
 * Nómina(s): el banco suele poner un concepto distinto cada mes ("NÓMINA OCTUBRE", referencias…),
 * así que se agrupan todos los cobros de nómina (los mismos que usa el mes de nómina) en una sola partida.
 * Importe: mediana de los últimos meses sin contar los de paga extra.
 */
function detectarNomina(ops, desde, hoy) {
  const umbral = Math.max(300, num(S.ajustes.nomina_umbral));
  const movs = S.movimientos.filter(m => m.tipo === 'ingreso' && num(m.importe) > 0 && ops.has(m.cuenta_id) && ymOf(m.fecha) >= desde && m.fecha <= hoy
    && !m.reembolso_de && (num(m.importe) >= umbral || /nomina|sueldo|salario/.test(normText(`${catName(m.categoria_id) || ''} ${m.concepto || ''}`))));
  if (!movs.length) return null;
  const mesPaga = m => +m.fecha.slice(8, 10) >= 20 ? addMonths(ymOf(m.fecha), 1) : ymOf(m.fecha);   // cobro a final de mes = mes siguiente
  const porMes = new Map(); movs.forEach(m => { const k = mesPaga(m); porMes.set(k, (porMes.get(k) || 0) + num(m.importe)); });
  const meses = [...porMes.keys()].sort(); if (meses.length < 2) return null;
  const imps = meses.map(k => porMes.get(k)), med = median2(imps);
  const normales = imps.filter(v => v <= med * 1.4 && v >= med * 0.6);           // fuera pagas extra y meses incompletos
  const recientes = normales.slice(-4);
  const ult = [...movs].sort((x, y) => x.fecha < y.fecha ? 1 : -1)[0];
  if (monthsDiff(meses[meses.length - 1] + '-01', addMonths(ymOf(hoy), 1) + '-01') > 2) return null;   // ya no se cobra
  return { key: 'ingreso|nomina', tipo: 'ingreso', categoria_id: ult.categoria_id, patron: 'nomina', movs, freq: 1, ultimo: ymOf(ult.fecha),
    dia: Math.round(median2(movs.map(m => +m.fecha.slice(8, 10)))), importe: round2(recientes.reduce((x, y) => x + y, 0) / (recientes.length || 1)),
    veces: meses.length, cv: 0, nombre: movs.length > meses.length * 1.5 ? 'Nóminas' : 'Nómina', variable: false };
}
function detectarRecurrentes() {
  const hoy = todayISO(), ymH = ymOf(hoy), desde = addMonths(ymH, -13);
  const ops = new Set(cuentasOperativas().map(c => c.id));
  const grupos = new Map();
  const nomina = detectarNomina(ops, desde, hoy), enNomina = new Set(nomina ? nomina.movs.map(m => m.id) : []);
  for (const m of S.movimientos) {
    if (enNomina.has(m.id)) continue;
    if ((m.tipo !== 'gasto' && m.tipo !== 'ingreso') || !ops.has(m.cuenta_id) || ymOf(m.fecha) < desde || m.fecha > hoy) continue;
    if (m.reembolso_de || (m.tipo === 'gasto' && num(m.importe) > 0)) continue; // devoluciones y reembolsos no son recurrentes
    const pat = normPatron(proponerPatron(m.notas, m.concepto)) || normConcept(m.concepto);
    const k = `${m.tipo}|${m.categoria_id || ''}|${pat}`;
    if (!grupos.has(k)) grupos.set(k, { key: k, tipo: m.tipo, categoria_id: m.categoria_id, patron: pat, movs: [] });
    grupos.get(k).movs.push(m);
  }
  const out = [];
  for (const g of grupos.values()) {
    const porMes = new Map();
    for (const m of g.movs) { const ym = ymOf(m.fecha); porMes.set(ym, (porMes.get(ym) || 0) + Math.abs(num(m.importe))); }
    const meses = [...porMes.keys()].sort();
    if (meses.length < 2) continue;
    // Varias compras al mes en el mismo sitio (supermercado, gasolina…) son consumo variable, no un recibo
    const vecesMes = meses.map(ym => g.movs.filter(m => ymOf(m.fecha) === ym).length);
    if (median2(vecesMes) > 1) continue;
    const gaps = meses.slice(1).map((ym, i) => monthsDiff(meses[i] + '-01', ym + '-01'));
    const gap = median2(gaps);
    const freq = FREQS_DET.reduce((b, f) => Math.abs(f - gap) < Math.abs(b - gap) ? f : b, 1);
    if (Math.abs(freq - gap) > (freq >= 6 ? 1 : 0.5)) continue;
    if (meses.length < (freq <= 3 ? 3 : 2)) continue;
    const imps = meses.map(ym => porMes.get(ym)), media = imps.reduce((a, b) => a + b, 0) / imps.length;
    const cv = Math.sqrt(imps.reduce((a, b) => a + (b - media) ** 2, 0) / imps.length) / (media || 1);
    if (cv > 0.35) continue;
    const ultimo = meses[meses.length - 1];
    if (monthsDiff(ultimo + '-01', ymH + '-01') > freq + 1) continue; // ha dejado de repetirse
    const ultMov = g.movs.filter(m => ymOf(m.fecha) === ultimo).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0];
    const recientes = imps.slice(-3);
    out.push({ ...g, freq, ultimo, dia: +ultMov.fecha.slice(8, 10), importe: round2(recientes.reduce((a, b) => a + b, 0) / recientes.length),
      veces: meses.length, cv, nombre: ultMov.concepto || g.patron, variable: cv > 0.12 });
  }
  if (nomina) out.push(nomina);
  return out.sort((a, b) => b.importe - a.importe);
}

/** Fecha dentro de un mes respetando el número de días. */
const fechaEnMes = (ym, dia) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(Math.max(1, dia || 1), daysInMonth(y, m)))}`; };
/** ¿Una serie periódica que empezó en inicioYm cae en el mes ym? */
const caeEnMes = (inicioYm, freq, ym) => { const d = monthsDiff(inicioYm + '-01', ym + '-01'); return freq > 0 ? d >= 0 && d % freq === 0 : d === 0; };

/** Calcula la previsión mes a mes. Devuelve { meses:[{ym, items, ingresos, fijos, variable, ahorro, saldoFinal}], ... } */
function calcularPrevision(horizonte = S.prevH, incluirMetas = S.prevMetas) {
  const hoy = todayISO(), ymH = ymOf(hoy), [cy, cm, cd] = hoy.split('-').map(Number);
  const ops = cuentasOperativas(), opsIds = new Set(ops.map(c => c.id));
  const saldoInicial = sum(ops, c => Calc.valor(c));
  const ign = prevIgnorados();
  const detectados = detectarRecurrentes().filter(r => !ign.has(r.key));
  const explicitos = []; // partidas que la app ya conoce de forma explícita
  const meses = Array.from({ length: horizonte }, (_, i) => addMonths(ymH, i));
  const items = meses.map(() => []);
  const push = (i, it) => { const f = it.fecha; if (i === 0 && f < hoy) return; items[i].push(it); };

  // 1) Préstamos: cuota mensual
  const catsCuota = new Set();
  for (const d of S.deudas.filter(x => x.activa !== false)) {
    const I = deudaInfo(d); if (!I.cuota || !I.restantes) continue;
    const cat = categoriaCuota(d); if (cat) catsCuota.add(cat);
    const dia = d.fecha_inicio ? +d.fecha_inicio.slice(8, 10) : 1;
    meses.forEach((ym, i) => { if (i === 0 || monthsDiff(ymH + '-01', ym + '-01') <= I.restantes) push(i, { fecha: fechaEnMes(ym, dia), concepto: `Cuota ${d.nombre}`, importe: -I.cuota, grupo: 'fijos', origen: 'Préstamo' }); });
    explicitos.push({ cat, importe: I.cuota, freq: 1 });
  }
  // 2) Seguros: recibos según forma de pago
  for (const s of S.seguros.filter(x => x.activo !== false)) {
    const x = seguroInfo(s), f = FREQ_PAGO[s.forma_pago] || 1, cada = 12 / f, ref = x.venc || s.fecha_inicio;
    if (!ref || !x.prima) continue;
    meses.forEach((ym, i) => { const d = ((monthsDiff(ymOf(ref) + '-01', ym + '-01') % cada) + cada) % cada; if (d === 0) push(i, { fecha: fechaEnMes(ym, +ref.slice(8, 10)), concepto: `Seguro ${s.nombre}`, importe: -x.recibo, grupo: 'fijos', origen: 'Seguro' }); });
    explicitos.push({ importe: x.recibo, freq: cada });
  }
  // 3) Aportaciones periódicas que salen de cuentas operativas
  for (const p of S.aportaciones_periodicas.filter(x => x.activo !== false && opsIds.has(x.cuenta_origen_id))) {
    const dest = cuentaById(p.cuenta_id);
    meses.forEach((ym, i) => { const f = fechaEnMes(ym, p.dia_mes); if (f >= p.desde && (!p.hasta || f <= p.hasta)) push(i, { fecha: f, concepto: `Aportación a ${dest ? dest.nombre : '?'}`, importe: -num(p.importe), grupo: 'ahorro', origen: 'Aportación periódica' }); });
  }
  // 4) Plan de amortizaciones anticipadas
  for (const p of S.amortizaciones_plan.filter(x => x.activo !== false)) {
    const d = S.deudas.find(x => x.id === p.deuda_id);
    meses.forEach((ym, i) => { if (caeEnMes(ymOf(p.desde), Math.max(1, num(p.cada_meses)), ym) && (!p.hasta || ym <= ymOf(p.hasta))) push(i, { fecha: fechaEnMes(ym, +p.desde.slice(8, 10)), concepto: `Amortización ${d ? d.nombre : ''}`, importe: -num(p.importe), grupo: 'ahorro', origen: 'Plan de amortización' }); });
  }
  // 5) Partidas previstas manuales
  for (const p of S.partidas_previstas.filter(x => x.activa !== false)) {
    meses.forEach((ym, i) => { if (caeEnMes(ymOf(p.fecha_inicio), num(p.frecuencia_meses), ym) && (!p.fecha_fin || ym <= ymOf(p.fecha_fin)))
      push(i, { fecha: fechaEnMes(ym, +p.fecha_inicio.slice(8, 10)), concepto: p.concepto, importe: p.tipo === 'ingreso' ? num(p.importe) : -num(p.importe), grupo: p.tipo === 'ingreso' ? 'ingresos' : 'fijos', origen: 'Partida prevista' }); });
    if (p.categoria_id) explicitos.push({ cat: p.categoria_id, importe: num(p.importe), freq: num(p.frecuencia_meses) });
  }
  // 6) Recurrentes detectados (sin duplicar lo anterior)
  const usados = [];
  for (const r of detectados) {
    if (r.tipo === 'gasto' && r.categoria_id && catsCuota.has(r.categoria_id)) continue;
    if (r.tipo === 'gasto' && explicitos.some(e => e.freq === r.freq && Math.abs(e.importe - r.importe) <= Math.max(1, e.importe * 0.1) && (!e.cat || !r.categoria_id || e.cat === r.categoria_id))) continue;
    usados.push(r);
    meses.forEach((ym, i) => {
      const k = monthsDiff(r.ultimo + '-01', ym + '-01'); // meses desde la última vez que apareció
      if (k <= 0 || k % r.freq !== 0) return;
      push(i, { fecha: fechaEnMes(ym, r.dia), concepto: r.nombre, importe: r.tipo === 'ingreso' ? r.importe : -r.importe, grupo: r.tipo === 'ingreso' ? 'ingresos' : 'fijos', origen: `Recurrente (${FREQ_LABEL[r.freq].toLowerCase()})`, variable: r.variable });
    });
  }
  // 7) Gasto variable: mediana mensual de los 3 últimos meses completos de lo que no es recurrente ni cuota
  const clavesRec = new Set(usados.map(r => r.key));
  const varPorMes = [1, 2, 3].map(k => { const ym = addMonths(ymH, -k);
    return -sum(S.movimientos.filter(m => m.tipo === 'gasto' && opsIds.has(m.cuenta_id) && ymOf(m.mes_imputacion) === ym && !catsCuota.has(m.categoria_id) && !esCatAmortizacion(m.categoria_id)
      && !clavesRec.has(`gasto|${m.categoria_id || ''}|${normPatron(proponerPatron(m.notas, m.concepto)) || normConcept(m.concepto)}`)), 'importe'); });
  const variableMes = Math.max(0, median2(varPorMes.filter(v => v > 0)));
  // 8) Metas: aportación mensual necesaria (hucha virtual: dinero que deberías apartar)
  const metasMes = incluirMetas ? sum(S.metas.filter(m => !metaInfo(m).conseguida), m => metaInfo(m).necesariaMes || 0) : 0;

  let saldo = saldoInicial, minimo = { saldo: Infinity };
  const fracRestante = (daysInMonth(cy, cm) - cd + 1) / daysInMonth(cy, cm);
  const res = meses.map((ym, i) => {
    const its = items[i].sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    const variable = round2(variableMes * (i === 0 ? fracRestante : 1)), metas = round2(metasMes * (i === 0 ? fracRestante : 1));
    const ingresos = sum(its.filter(x => x.importe > 0), 'importe');
    const fijos = -sum(its.filter(x => x.importe < 0 && x.grupo === 'fijos'), 'importe');
    const ahorro = -sum(its.filter(x => x.grupo === 'ahorro'), 'importe') + metas;
    const ini = saldo; saldo = round2(saldo + ingresos - fijos - variable - ahorro);
    // saldo mínimo dentro del mes (los gastos antes de cobrar)
    let s = ini, minMes = ini;
    for (const it of its) { s += it.importe; minMes = Math.min(minMes, s); }
    const r = { ym, items: its, ingresos, fijos, variable, metas, ahorro, saldoInicial: ini, saldoFinal: saldo, minMes: Math.min(minMes, saldo) };
    if (r.minMes < minimo.saldo) minimo = { saldo: r.minMes, ym };
    return r;
  });
  return { saldoInicial, meses: res, detectados, usados, variableMes, metasMes, minimo, colchon: gastoMensualMedio() };
}
/** Salidas de caja medias al mes (para el colchón operativo). */
function gastoMensualMedio() {
  const h = mediaHistorica(mesActual(), 6);
  return h && h.gastosCaja > 0 ? h.gastosCaja : 0;
}

/* =====================================================================
   SECCIÓN EN LA PESTAÑA "PREVISIÓN Y METAS"
   ===================================================================== */
const fraseNombre = t => { t = String(t || '').trim(); return t && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
function renderPrevisionSection() {
  if (!S.v52) return `<div class="card"><div class="card-head"><h3>🔮 Previsión de tesorería</h3></div><div class="banner amber">Ejecuta <code>sql/esquema_completo.sql</code> en Supabase para activar la previsión y las metas.</div></div>`;
  const P = calcularPrevision(), M = P.meses, col = P.colchon;
  const proximos = M.flatMap(m => m.items).filter(x => diasEntre(todayISO(), x.fecha) <= 30).slice(0, 25);
  const nivel = v => v < 0 ? 'neg' : (col && v < col) ? 'warn-t' : 'pos';
  const ign = prevIgnorados(), usadosK = new Set(P.usados.map(r => r.key));
  const tensos = M.filter(m => m.minMes < (col || 0));
  return `
    <div class="section-head"><div><h2>Previsión de tesorería</h2><div class="sub">Cómo evolucionará el dinero disponible en los próximos meses</div></div>
      <div class="btn-row"><div class="seg">${[3, 6, 12].map(h => `<button data-action="prev-h" data-h="${h}" class="${S.prevH === h ? 'active' : ''}">${h} meses</button>`).join('')}</div>
        <label class="chk" style="margin:0"><input type="checkbox" id="prev-metas" ${S.prevMetas ? 'checked' : ''}> Contar aportaciones a metas</label></div></div>
    <div class="kpis">
      ${kpi('Disponible hoy', fmtEUR(P.saldoInicial), 'Corriente + efectivo', 'navy')}
      ${(ing => kpi('Ingresos previstos', fmtEUR(ing) + '/mes', ing > 0 ? 'Nómina, recurrentes y partidas previstas' : '<a href="#" data-action="pp-new">Añade tu nómina como partida prevista</a>', 'pos', !(ing > 0)))(sum(M.slice(1), 'ingresos') / Math.max(1, M.length - 1))}
      ${kpi('Gastos fijos previstos', fmtEUR(sum(M.slice(1), 'fijos') / Math.max(1, M.length - 1)) + '/mes', `+ ${fmtEUR(P.variableMes, 0)}/mes de gasto variable estimado`, 'neg')}
      ${kpi(`Saldo previsto en ${ymLabel(M[M.length - 1].ym, true)}`, `<span class="${nivel(M[M.length - 1].saldoFinal)}">${fmtEUR(M[M.length - 1].saldoFinal, 0)}</span>`, `Punto más bajo: <b class="${nivel(P.minimo.saldo)}">${fmtEUR(P.minimo.saldo, 0)}</b> en ${ymLabel(P.minimo.ym, true)}`)}
    </div>
    ${tensos.length ? (neg => `<div class="banner ${neg ? 'red' : 'amber'} prev-alerta"><span class="pa-ic">⚠</span><div class="pa-c">
      <b>${neg ? 'En algún momento la cuenta quedaría en negativo' : `Meses con el saldo por debajo de 1 mes de gastos (${fmtEUR(col, 0)})`}</b>
      <div class="pa-meses">${tensos.map(m => `<span class="${m.minMes < 0 ? 'neg' : ''}">${ymLabel(m.ym, true)} · <b>${fmtEUR(m.minMes, 0)}</b></span>`).join('')}</div>
      <small>Revisa los cargos de esos meses o adelanta saldo desde el fondo de emergencia.</small></div></div>`)(tensos.some(m => m.minMes < 0)) : ''}
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Saldo previsto mes a mes</h3></div><div class="chart-box"><canvas id="ch-prev"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>Próximos 30 días</h3></div>
        <div class="top-list">${proximos.length ? proximos.map(x => `<div class="it"><div class="c"><b>${fmtDateShort(x.fecha)}</b> ${esc(x.concepto)}<div class="small muted">${esc(x.origen)}${x.variable ? ' · importe variable' : ''}</div></div><div class="num ${x.importe >= 0 ? 'pos' : 'neg'}">${signed(x.importe)}</div></div>`).join('') : '<div class="empty">Nada previsto. Importa unos meses de movimientos o añade partidas previstas.</div>'}</div></div>
    </div>
    <div class="card"><div class="card-head"><h3>Detalle por mes</h3><span class="sub">Pulsa un mes para ver sus partidas</span></div>
      <div class="tbl-wrap tbl-scroll"><table class="tbl tbl-nowrap"><thead><tr><th>Mes</th><th class="right">Ingresos</th><th class="right">Gastos fijos</th><th class="right">Variable</th><th class="right">Metas</th><th class="right">Saldo final</th></tr></thead><tbody>
      ${M.map((m, i) => `<tr style="cursor:pointer" data-action="prev-mes" data-i="${i}"><td>${ymLabel(m.ym, true)}${i === 0 ? ' <span class="small muted">(resto)</span>' : ''} ▸</td><td class="right num pos">${fmtEUR(m.ingresos, 0)}</td><td class="right num neg">${fmtEUR(m.fijos, 0)}</td><td class="right num neg">${fmtEUR(m.variable, 0)}</td><td class="right num">${fmtEUR(m.ahorro, 0)}</td><td class="right num ${nivel(m.saldoFinal)}"><b>${fmtEUR(m.saldoFinal, 0)}</b></td></tr>
        <tr id="prev-det-${i}" hidden><td colspan="6"><div class="small">${m.items.length ? m.items.map(x => `${fmtDateShort(x.fecha)} · ${esc(x.concepto)} · <b class="${x.importe >= 0 ? 'pos' : 'neg'}">${signed(x.importe)}</b> <span class="muted">(${esc(x.origen)})</span>`).join('<br>') : 'Sin partidas'}${m.variable ? `<br>Gasto variable estimado · <b class="neg">−${fmtEUR(m.variable)}</b>` : ''}${m.metas ? `<br>Apartar para metas · <b>−${fmtEUR(m.metas)}</b>` : ''}</div></td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>Recurrentes detectados</h3><span class="sub">De tu historial (últimos 12 meses)</span></div>
        ${P.detectados.length || ign.size ? detectarRecurrentes().map(r => `<div class="cat-row rec-row" style="${ign.has(r.key) ? 'opacity:.45' : ''}">${iconoMovimiento({ concepto: r.nombre, importe: r.tipo === 'ingreso' ? 1 : -1 })}<span class="cname"><b>${esc(fraseNombre(r.nombre))}</b><span class="small muted">${FREQ_LABEL[r.freq]} · día ${r.dia} · ${r.veces} veces${r.variable ? ' · varía' : ''}${!usadosK.has(r.key) && !ign.has(r.key) ? ' · ya contado en préstamos/seguros/partidas' : ''}</span></span>
          <span class="num ${r.tipo === 'ingreso' ? 'pos' : 'neg'}">${r.tipo === 'ingreso' ? '+' : '−'}${fmtEUR(r.importe)}</span>
          <button class="mini" data-action="prev-ign" data-k="${esc(r.key)}" title="${ign.has(r.key) ? 'Volver a tener en cuenta' : 'No tener en cuenta'}">${ign.has(r.key) ? '↺' : '✕'}</button></div>`).join('')
          : '<div class="empty">Aún no hay suficiente historial: con 3 meses de movimientos importados empezaré a detectar nóminas, recibos y suscripciones.</div>'}</div>
      <div class="card"><div class="card-head"><h3>Partidas previstas</h3><button class="btn sm" data-action="pp-new">+ Partida</button></div>
        ${S.partidas_previstas.length ? S.partidas_previstas.map(p => `<div class="cat-row rec-row" style="${p.activa === false ? 'opacity:.5' : ''}"><span class="cname"><b>${esc(p.concepto)}</b><span class="small muted">${FREQ_LABEL[num(p.frecuencia_meses)] || `Cada ${p.frecuencia_meses} meses`} · desde ${fmtDate(p.fecha_inicio)}${p.fecha_fin ? ' hasta ' + fmtDate(p.fecha_fin) : ''}</span></span>
          <span class="num ${p.tipo === 'ingreso' ? 'pos' : 'neg'}">${p.tipo === 'ingreso' ? '+' : '−'}${fmtEUR(p.importe)}</span>
          <button class="mini" data-action="pp-edit" data-id="${p.id}">✎</button><button class="mini" data-action="pp-del" data-id="${p.id}">🗑</button></div>`).join('') : '<div class="empty">Sin partidas previstas.</div>'}</div>
    </div>`;
}
function chartPrevision() {
  if (!S.v52 || !$('#ch-prev')) return;
  const P = calcularPrevision(), M = P.meses;
  mkChart('ch-prev', { type: 'bar', data: { labels: M.map(m => ymLabel(m.ym, true)), datasets: [
    { type: 'line', label: 'Saldo final', data: M.map(m => m.saldoFinal), borderColor: '#0f1f3a', backgroundColor: '#0f1f3a', tension: .25, borderWidth: 3, order: 1 },
    ...(P.colchon ? [{ type: 'line', label: 'Colchón (1 mes de gastos)', data: M.map(() => round2(P.colchon)), borderColor: '#f59e0b', borderDash: [6, 4], pointRadius: 0, order: 1 }] : []),
    { label: 'Ingresos', data: M.map(m => round2(m.ingresos)), backgroundColor: '#86efac', stack: 'i', order: 2 },
    { label: 'Gastos fijos', data: M.map(m => -round2(m.fijos)), backgroundColor: '#fca5a5', stack: 'g', order: 2 },
    { label: 'Variable', data: M.map(m => -round2(m.variable)), backgroundColor: '#fecaca', stack: 'g', order: 2 },
    { label: 'Ahorro / metas', data: M.map(m => -round2(m.ahorro)), backgroundColor: '#c4b5fd', stack: 'g', order: 2 }
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: euroAxis, x: { grid: { display: false } } } } });
}

const FIELDS_PP = [
  { name: 'concepto', label: 'Concepto', required: true, ph: 'Ej: Paga extra de junio' },
  { name: 'tipo', label: 'Tipo', type: 'select', options: [{ v: 'gasto', l: 'Gasto' }, { v: 'ingreso', l: 'Ingreso' }] },
  { name: 'importe', label: 'Importe (€)', type: 'number', required: true },
  { name: 'frecuencia_meses', label: 'Se repite', type: 'select', options: [0, 1, 2, 3, 4, 6, 12].map(v => ({ v, l: FREQ_LABEL[v] })) },
  { name: 'fecha_inicio', label: 'Primera vez (día incluido)', type: 'date', required: true }, { name: 'fecha_fin', label: 'Última vez (opcional)', type: 'date' },
  { name: 'categoria_id', label: 'Categoría (opcional)', type: 'rawselect', html: v => catOptsAll(v) },
  { name: 'activa', label: 'Activa', type: 'checkbox', def: true }, { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
async function guardarPartida(id, v) {
  const row = { ...v, frecuencia_meses: +v.frecuencia_meses, importe: Math.abs(v.importe), categoria_id: v.categoria_id || null };
  if (id) await DB.update('partidas_previstas', id, row); else await DB.insert('partidas_previstas', [row]);
  await reloadTable('partidas_previstas');
}

Object.assign(Actions, {
  'prev-h': el => { S.prevH = +el.dataset.h; render(); },
  'prev-mes': el => { const r = $('#prev-det-' + el.dataset.i); if (r) r.hidden = !r.hidden; },
  'prev-ign': async el => {
    const k = el.dataset.k, s = prevIgnorados(); s.has(k) ? s.delete(k) : s.add(k);
    const valor = { claves: [...s] };
    await withSaving(null, () => DB.upsert('ajustes', { clave: 'prevision_ignorar', valor, updated_at: new Date().toISOString() }, 'clave'));
    const r = (S.ajustesRows || []).find(x => x.clave === 'prevision_ignorar'); if (r) r.valor = valor; else (S.ajustesRows = S.ajustesRows || []).push({ clave: 'prevision_ignorar', valor });
    render();
  },
  'pp-new': () => openForm({ title: 'Nueva partida prevista', fields: FIELDS_PP, values: { tipo: 'gasto', frecuencia_meses: 12, fecha_inicio: todayISO(), activa: true }, onSubmit: v => guardarPartida(null, v) }),
  'pp-edit': el => { const p = S.partidas_previstas.find(x => x.id === el.dataset.id); openForm({ title: 'Editar partida prevista', fields: FIELDS_PP, values: p, onSubmit: v => guardarPartida(p.id, v) }); },
  'pp-del': async el => { if (!(await confirmDlg('¿Eliminar esta partida prevista?', 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('partidas_previstas', el.dataset.id); await reloadTable('partidas_previstas'); }, 'Eliminada'); render(); }
});
Object.assign(Changes, { 'prev-metas': el => { S.prevMetas = el.checked; render(); } });
