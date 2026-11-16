'use strict';
/* =====================================================================
   DASHBOARD · ALERTAS Y CONSEJOS
   ---------------------------------------------------------------------
   Motor de reglas que genera alertas y consejos a partir de los datos.
   Para añadir una regla nueva: añade un bloque en buildAlertas() que llame a add().
   Depende de: calculos.js, ui.js
   ===================================================================== */

const median = arr => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** Medias mensuales de los N meses completos anteriores a refYm que tengan datos. */
function mediaHistorica(refYm, n = 6) {
  const ms = Array.from({ length: n }, (_, i) => addMonths(refYm, -(i + 1)))
    .filter(m => S.movimientos.some(x => ymOf(x.mes_imputacion) === m && (x.tipo === 'gasto' || x.tipo === 'ingreso')));
  if (!ms.length) return null;
  const st = periodStats(ms);
  const porRaiz = {};
  for (const m of st.movs) if (m.tipo === 'gasto') { const r = rootOf(catById(m.categoria_id)); const k = r ? r.id : '_none'; porRaiz[k] = (porRaiz[k] || 0) - num(m.importe); }
  Object.keys(porRaiz).forEach(k => { porRaiz[k] /= ms.length; });
  return { n: ms.length, gastos: st.gastos / ms.length, gastosCaja: st.gastosCaja / ms.length, ingresos: st.ingresos / ms.length, ahorro: st.ahorro / ms.length, porRaiz };
}
function buildAlertas(months, st, P, rows) {
  const A = []; const add = (nivel, ic, t, txt) => A.push({ nivel, ic, t, txt });
  const today = todayISO(), curYm = ymOf(today), [cy, cm, cd] = today.split('-').map(Number);
  const nM = months.length, enCurso = months.includes(curYm), soloMesActual = nM === 1 && months[0] === curYm;
  const frac = cd / daysInMonth(cy, cm);
  const hist = mediaHistorica(months[0], 6);
  const gastoMes = (hist && hist.gastosCaja > 0) ? hist.gastosCaja : (st.gastosCaja / nM);
  const ingMes = (hist && hist.ingresos > 0) ? hist.ingresos : (st.ingresos / nM);

  // 1) Presupuestos (la proyección solo se aplica a categorías con varios gastos, no a recibos únicos como la hipoteca)
  const nMovsCat = id => st.movs.filter(m => m.tipo === 'gasto' && m.categoria_id && (m.categoria_id === id || (catById(m.categoria_id) || {}).parent_id === id)).length;
  for (const r of rows) {
    if (!(r.bud > 0) || !r.own) continue;
    const pc = r.spent / r.bud;
    if (pc > 1) add('red', '🚨', `Presupuesto superado: ${r.nombre}`, `Has gastado ${fmtEUR(r.spent)} de ${fmtEUR(r.bud)} (${fmtPct(pc, 0)}). Te has pasado <b>${fmtEUR(r.spent - r.bud)}</b>.`);
    else if (soloMesActual && cd >= 7 && frac < 0.97 && r.spent / frac > r.bud * 1.05 && nMovsCat(r.catId) >= 3)
      add('amber', '⚠️', `${r.nombre}: a este ritmo te pasarás`, `Llevas ${fmtEUR(r.spent)} (${fmtPct(pc, 0)}) a día ${cd}. Proyección a fin de mes: <b>${fmtEUR(r.spent / frac)}</b> frente a ${fmtEUR(r.bud)}.`);
    else if (pc >= 0.85) add('amber', '⚠️', `${r.nombre} cerca del límite`, `Has consumido el ${fmtPct(pc, 0)} del presupuesto. Quedan ${fmtEUR(r.bud - r.spent)}.`);
  }

  // 2) Gastos extraordinarios (importe alto y muy por encima de lo habitual en su categoría)
  const umbral = num(S.ajustes.extra_umbral) || 300;
  const desde = addMonths(months[0], -12);
  const previos = S.movimientos.filter(m => m.tipo === 'gasto' && ymOf(m.mes_imputacion) >= desde && ymOf(m.mes_imputacion) < months[0]);
  const extras = st.movs.filter(m => m.tipo === 'gasto' && -num(m.importe) >= umbral).filter(m => {
    const h = previos.filter(x => x.categoria_id === m.categoria_id).map(x => -num(x.importe));
    return h.length >= 2 ? -num(m.importe) > 2.5 * median(h) : -num(m.importe) >= 3 * umbral;
  }).sort((a, b) => num(a.importe) - num(b.importe));
  if (extras.length) add('amber', '💥', `${extras.length} gasto(s) extraordinario(s): ${fmtEUR(-sum(extras, 'importe'))}`,
    `Importes muy por encima de lo habitual en su categoría:<ul>${extras.slice(0, 5).map(m => `<li>${fmtDate(m.fecha)} · ${esc(m.concepto || '—')} · <b>${fmtEUR(-num(m.importe))}</b> <span class="muted">(${esc(catName(m.categoria_id) || 'Sin categoría')})</span></li>`).join('')}</ul>${extras.length > 5 ? '…y ' + (extras.length - 5) + ' más.' : ''} Si son puntuales (seguro anual, reparación…), valora crear una partida de “gastos anuales” y provisionar cada mes 1/12.`);

  // 3) Categorías disparadas frente a tu media
  if (hist && hist.n >= 2) {
    const actual = {};
    for (const m of st.movs) if (m.tipo === 'gasto') { const r = rootOf(catById(m.categoria_id)); const k = r ? r.id : '_none'; actual[k] = (actual[k] || 0) - num(m.importe) / nM; }
    const subidas = Object.entries(actual).map(([k, v]) => ({ k, v, med: hist.porRaiz[k] || 0 }))
      .filter(o => o.med > 0 && o.v > o.med * 1.4 && (o.v - o.med) * nM > 100).sort((a, b) => (b.v - b.med) - (a.v - a.med)).slice(0, 3);
    for (const o of subidas) { const c = catById(o.k); add('amber', '📈', `${c ? c.nombre : 'Sin categoría'}: +${fmtPct(o.v / o.med - 1, 0)} sobre tu media`, `Gastas ${fmtEUR(o.v)}/mes frente a ${fmtEUR(o.med)}/mes de media en los ${hist.n} meses anteriores${enCurso ? ' (y el mes aún no ha terminado)' : ''}.`); }
  }

  // 4) Capacidad de ahorro
  if (st.ingresos > 0) {
    const t = st.ahorro / st.ingresos;
    if (st.ahorro < 0) add('red', '🔻', 'Gastas más de lo que ingresas', `Déficit de <b>${fmtEUR(-st.ahorro)}</b> en el periodo. Revisa primero las categorías con presupuesto superado y los gastos extraordinarios.`);
    else if (t < 0.1) add('amber', '🐷', `Tasa de ahorro baja: ${fmtPct(t)}`, `Una referencia sana es ahorrar al menos el 15-20 % de los ingresos. Recortar ${fmtEUR(st.ingresos * 0.15 - st.ahorro)} en el periodo te llevaría al 15 %.`);
    else if (t >= 0.3) add('green', '🏆', `Excelente tasa de ahorro: ${fmtPct(t)}`, `Estás ahorrando ${fmtEUR(st.ahorro)}. Asegúrate de que ese dinero se mueve a ahorro o inversión y no se queda parado en la cuenta corriente.`);
  } else if (st.gastos > 0 && !enCurso) add('blue', 'ℹ️', 'Sin ingresos imputados en el periodo', 'Comprueba que las nóminas están imputadas al mes correcto (regla de nómina, botón ⏭ en movimientos).');

  // 5) Fondo de emergencia
  const obj = num(S.ajustes.fondo_meses) || 6;
  if (gastoMes > 0) {
    const meses = P.reserva / gastoMes, objetivo = obj * gastoMes;
    if (meses < 3) add('red', '🛟', `Fondo de emergencia bajo: ${fmtNum(meses, 1)} meses`, `Cubre ${fmtNum(meses, 1)} meses de gastos (${fmtEUR(gastoMes, 0)}/mes). Prioriza llegar a ${obj} meses (${fmtEUR(objetivo, 0)}) antes de invertir más: te faltan <b>${fmtEUR(objetivo - P.reserva, 0)}</b>.`);
    else if (meses < obj) add('amber', '🛟', `Fondo de emergencia: ${fmtNum(meses, 1)} de ${obj} meses`, `Te faltan ${fmtEUR(objetivo - P.reserva, 0)} para tu objetivo. Con ${fmtEUR((objetivo - P.reserva) / 6, 0)}/mes lo completarías en 6 meses.`);
    else if (meses > obj * 1.5) add('blue', '💡', `Fondo de emergencia sobredimensionado: ${fmtNum(meses, 1)} meses`, `Tienes unos <b>${fmtEUR(P.reserva - objetivo, 0)}</b> por encima de tu objetivo de ${obj} meses. Ese excedente podría trabajar a largo plazo en tu cartera de inversión.`);
    else add('green', '🛟', `Fondo de emergencia completo: ${fmtNum(meses, 1)} meses`, 'Tu colchón cubre el objetivo. A partir de aquí, el ahorro puede ir a inversión.');

    // 6) Dinero ocioso en cuenta corriente/efectivo
    if (P.operativa > 2 * gastoMes && P.operativa - 1.5 * gastoMes > 500)
      add('blue', '💤', `${fmtEUR(P.operativa - 1.5 * gastoMes, 0)} ociosos en la cuenta corriente`, `Tienes ${fmtEUR(P.operativa, 0)} en cuenta corriente y efectivo, más de 2 meses de gastos. Con 1-1,5 meses de colchón operativo suele bastar: mueve el exceso al fondo de emergencia${P.reserva / gastoMes >= obj ? ' o, como ya está completo, a inversión' : ''}.`);
  }

  // 7) Inversión y destino del ahorro
  if (st.ingresos > 0 && st.ahorro > 0) {
    const ti = st.aport.inversion / st.ingresos, movido = st.aport.inversion + st.aport.ahorro + st.capital;
    if (movido < st.ahorro * 0.5) add('blue', '🧭', 'El ahorro se queda en la cuenta corriente', `Has ahorrado ${fmtEUR(st.ahorro)} pero solo has movido ${fmtEUR(Math.max(0, movido))} a ahorro, inversión o amortización de deuda. Programa una transferencia automática el día después de cobrar la nómina (“págate primero”).`);
    if (ti < 0.1 && P.reserva / (gastoMes || 1) >= 3) add('blue', '📊', `Tasa de inversión del ${fmtPct(ti)}`, `Con tu ahorro medio, una aportación periódica de unos <b>${fmtEUR(Math.max(50, Math.round(((hist ? hist.ahorro : st.ahorro / nM) * 0.5) / 10) * 10), 0)}/mes</b> (la mitad de lo que ahorras) haría crecer el patrimonio de forma constante.`);
    else if (ti >= 0.15) add('green', '📈', `Buena tasa de inversión: ${fmtPct(ti)}`, `Inviertes ${fmtEUR(st.aport.inversion)} en el periodo. La constancia mensual es lo que más pesa a largo plazo.`);
  }

  // 8) Valoraciones de inversión desactualizadas
  for (const c of S.cuentas.filter(c => c.tipo === 'inversion' && c.activa !== false)) {
    const x = invInfo(c);
    if (!x.tieneVM) add('blue', '🔄', `${c.nombre}: sin valor de mercado`, 'Introduce su valor actual en 📈 Inversiones → “Actualizar valor” para calcular plusvalía y patrimonio real.');
    else if (x.diasVal > 90) add('blue', '🔄', `${c.nombre}: valoración de hace ${x.diasVal} días`, 'Actualiza el valor en 📈 Inversiones para que el patrimonio neto sea fiel.');
  }

  // 9) Hipoteca: amortizar o invertir
  for (const d of S.deudas.filter(d => d.activa !== false && d.tipo === 'hipoteca')) {
    const I = deudaInfo(d), tin = num(d.interes);
    if (!I.pendienteHoy || !tin) continue;
    if (tin >= 3) add('blue', '🏦', `${d.nombre}: TIN del ${fmtNum(tin, 2)} %`, `Cada euro amortizado “rinde” un ${fmtNum(tin, 2)} % seguro y sin riesgo (te quedan ${fmtEUR(I.interesesPendientes, 0)} de intereses). Con el fondo de emergencia completo, compara amortizar con invertir en el simulador de 🏦 Deudas.`);
    else if (tin < 2) add('blue', '🏦', `${d.nombre}: TIN bajo (${fmtNum(tin, 2)} %)`, 'Con un interés tan bajo, amortizar anticipadamente suele aportar menos que mantener liquidez o invertir a largo plazo. Prioriza fondo de emergencia e inversión periódica.');
  }

  // 10) Suscripciones y gastos sin categoría
  const susc = S.categorias.find(c => !c.parent_id && c.tipo === 'gasto' && /suscrip/i.test(c.nombre));
  if (susc && hist && hist.porRaiz[susc.id] > 0) add('blue', '🔁', `Suscripciones: ${fmtEUR(hist.porRaiz[susc.id] * 12, 0)}/año`, 'Revisa una vez al trimestre cuáles usas de verdad. Es el ahorro más fácil: se cancela una vez y se nota todos los meses.');
  const sinCat = st.movs.filter(m => m.tipo === 'gasto' && !m.categoria_id);
  if (sinCat.length) add('blue', '🏷️', `${sinCat.length} gasto(s) sin categoría (${fmtEUR(-sum(sinCat, 'importe'))})`, 'Categorízalos en 💳 Movimientos para que el análisis y los presupuestos sean fiables.');

  // 11) Coste real de los vehículos
  const vehFijos = sum(S.vehiculos, v => seguroVehiculo(v) + num(v.gasto_impuesto) + num(v.gasto_mantenimiento));
  const vehDep = sum(S.vehiculos, v => { const ds = v.fecha_compra || (v.anio ? `${v.anio}-07-01` : null); if (!ds) return 0; const a = Math.max(0.5, monthsDiff(ds, today) / 12); return Math.max(0, num(v.valor_compra) - num(v.valor_actual)) / a; });
  if (ingMes > 0 && vehFijos + vehDep > ingMes * 12 * 0.15) add('blue', '🚐', `Vehículos: ${fmtEUR(vehFijos + vehDep, 0)}/año entre gastos fijos y depreciación`, `Supone el ${fmtPct((vehFijos + vehDep) / (ingMes * 12), 0)} de tus ingresos anuales. Merece la pena revisar si el uso de los tres compensa su coste.`);

  // 12) Seguros: vencimientos y renovaciones
  for (const s of S.seguros.filter(s => s.activo !== false)) {
    const x = seguroInfo(s);
    if (x.vencido) add('red', '🛡️', `${s.nombre}: póliza vencida`, `Venció el ${fmtDate(x.venc)} y no se renueva sola. Comprueba que sigues cubierto o márcala como dada de baja en 🛡️ Seguros.`);
    else if (x.dias !== null && x.dias <= 30) add('amber', '🛡️', `${s.nombre}: vence en ${x.dias} días`, `${s.renovacion_auto === false ? 'No se renueva automáticamente.' : 'Se renovará automáticamente.'} Prima actual ${fmtEUR(x.prima)}/año${s.aseguradora ? ' con ' + esc(s.aseguradora) : ''}: pide 2-3 presupuestos antes del ${fmtDate(x.venc)}.`);
  }
  const totSeg = sum(S.seguros.filter(s => s.activo !== false), 'prima_anual');
  if (totSeg > 0 && ingMes > 0 && totSeg > ingMes * 12 * 0.08) add('blue', '🛡️', `Seguros: ${fmtEUR(totSeg, 0)}/año (${fmtPct(totSeg / (ingMes * 12), 0)} de tus ingresos)`, 'Revisa coberturas duplicadas (p. ej. asistencia en viaje en coche y tarjeta) y agrupa pólizas en una aseguradora para pedir descuento.');

  // 13) Inmuebles: €/m² desactualizado
  if (S.v4) for (const i of S.inmuebles) { const c = calcM2(i); if (c.m2 > 0 && (c.diasM2 === null || c.diasM2 > 100)) add('blue', '🏠', `${i.nombre}: actualiza el €/m² de tu zona`, `${c.diasM2 === null ? 'Aún no lo has introducido' : `Tiene ${c.diasM2} días`}. Con el dato del último informe trimestral la app recalcula el valor de venta y el alquiler.`); }

  // 14) Préstamos: amortización del plan pendiente este mes
  const ymH = ymOf(today);
  for (const p of S.amortizaciones_plan.filter(p => p.activo !== false)) {
    const d = S.deudas.find(x => x.id === p.deuda_id); if (!d) continue;
    let ym = ymOf(p.desde); const cada = Math.max(1, num(p.cada_meses)); while (ym < ymH) ym = addMonths(ym, cada);
    if (ym === ymH && (!p.hasta || ymOf(p.hasta) >= ymH) && !S.amortizaciones.some(a => a.deuda_id === d.id && ymOf(a.fecha) === ymH))
      add('blue', '🏦', `${d.nombre}: este mes toca amortizar ${fmtEUR(p.importe)}`, 'Según tu plan de amortizaciones. Cuando la hagas, regístrala en 🏦 Deudas para actualizar el préstamo y tu ahorro en intereses.');
  }

  const ord = { red: 0, amber: 1, blue: 2, green: 3 };
  return A.sort((a, b) => ord[a.nivel] - ord[b.nivel]);
}
function renderAlertas(months, st, P, rows) {
  let A;
  try { A = buildAlertas(months, st, P, rows); } catch (e) { console.error(e); return ''; }
  if (!A.length) return '';
  const cnt = n => A.filter(a => a.nivel === n).length;
  const item = a => `<div class="alert ${a.nivel}"><div class="ic">${a.ic}</div><div><b class="t">${esc(a.t)}</b>${a.txt}</div></div>`;
  const vis = A.slice(0, 6), rest = A.slice(6);
  return `<div class="card"><div class="card-head"><h3>🔔 Alertas y consejos</h3><div class="btn-row">
      ${cnt('red') ? `<span class="badge red">${cnt('red')} alerta(s)</span>` : ''}${cnt('amber') ? `<span class="badge amber">${cnt('amber')} aviso(s)</span>` : ''}
      ${cnt('blue') ? `<span class="badge blue">${cnt('blue')} consejo(s)</span>` : ''}${cnt('green') ? `<span class="badge green">${cnt('green')} bien</span>` : ''}</div></div>
    <div class="alerts">${vis.map(item).join('')}<div class="alerts" id="alert-more" hidden>${rest.map(item).join('')}</div></div>
    ${rest.length ? `<div style="text-align:center;margin-top:10px"><button class="btn sm ghost" data-action="alert-more" data-more="Ver ${rest.length} más">Ver ${rest.length} más</button></div>` : ''}
    <div class="small muted" style="margin-top:10px">Consejos orientativos calculados con tus propios datos; no sustituyen el asesoramiento de un profesional financiero.</div></div>`;
}
