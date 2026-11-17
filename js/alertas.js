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
  return { ms, n: ms.length, gastos: st.gastos / ms.length, gastosCaja: st.gastosCaja / ms.length, ingresos: st.ingresos / ms.length, ahorro: st.ahorro / ms.length, porRaiz };
}
/** Gasto mensual de una categoría (con sus subcategorías) en los meses indicados: [{ total, n }]. */
function gastoCatPorMes(catId, ms) {
  return ms.map(ym => { const xs = S.movimientos.filter(m => m.tipo === 'gasto' && ymOf(m.mes_imputacion) === ym && m.categoria_id && (m.categoria_id === catId || (catById(m.categoria_id) || {}).parent_id === catId));
    return { total: -sum(xs, 'importe'), n: xs.length }; });
}
/** ¿Es un gasto fijo (hipoteca, alquiler, cuota del gimnasio…)? Cuota de un préstamo, o importe casi idéntico cada mes con 1-2 cargos. */
function esGastoFijo(catId, refYm) {
  const man = fijoManual(catId); if (man !== null) return man;   // lo que hayas marcado en 🏷️ Categorías manda
  if (catAnualDe(catId)) return false;                              // las anualidades se tratan aparte
  if (S.deudas.some(d => d.activa !== false && categoriaCuota(d) === catId)) return true;
  const h = gastoCatPorMes(catId, Array.from({ length: 6 }, (_, i) => addMonths(refYm, -(i + 1)))).filter(x => x.n > 0);
  if (h.length < 3 || h.some(x => x.n > 2)) return false;
  const tot = h.map(x => x.total), med = median(tot);
  return med > 0 && (Math.max(...tot) - Math.min(...tot)) / med <= 0.1;
}
/** Avisos ocultados con ✕ (compartido con tu pareja): { clave: 'AAAA-MM-DD' hasta el que no se muestra }. */
const alertasOcultas = () => (((S.ajustesRows || []).find(r => r.clave === 'alertas_ocultas') || {}).valor) || {};
/** Clave estable de un aviso: el título sin cifras, para que "hace 95 días" y "hace 96 días" sean el mismo aviso. */
const claveAlerta = (nivel, t) => nivel + ':' + String(t).replace(/[-+]?[\d.,]+\s*[%€]?/g, '#');

function buildAlertas(months, st, P, rows) {
  const A = []; const add = (nivel, ic, t, txt, key, dias) => A.push({ nivel, ic, t, txt, key: key || claveAlerta(nivel, t), dias: dias || 30 });
  const today = todayISO(), curYm = ymOf(today), [cy, cm, cd] = today.split('-').map(Number);
  const nM = months.length, enCurso = months.includes(curYm), soloMesActual = nM === 1 && months[0] === curYm;
  const frac = cd / daysInMonth(cy, cm);
  const hist = mediaHistorica(months[0], 6);
  const gastoMes = (hist && hist.gastosCaja > 0) ? hist.gastosCaja : (st.gastosCaja / nM);
  const ingMes = (hist && hist.ingresos > 0) ? hist.ingresos : (st.ingresos / nM);

  // 1) Presupuestos (la proyección solo se aplica a categorías con varios gastos, no a recibos únicos como la hipoteca)
  const nMovsCat = id => st.movs.filter(m => m.tipo === 'gasto' && m.categoria_id && (m.categoria_id === id || (catById(m.categoria_id) || {}).parent_id === id)).length;
  //    Gastos fijos (hipoteca, alquiler, cuotas): estar al 100 % es lo normal; solo se avisa si el cargo ha subido.
  //    Gastos variables: se avisa si te has pasado, o si al ritmo actual te vas a pasar y aún quedan días para reaccionar.
  const conAvisoPres = new Set(), ymKey = months.join(',');
  // Proyección a fin de mes: lo fijo (hipoteca dentro de "Vivienda", p. ej.) no se extrapola; solo lo variable
  const proyeccion = r => { const fijo = r.lvl === 0 ? sum(childrenOf(r.catId).filter(c => esGastoFijo(c.id, months[0])), c => (rows.find(x => x.catId === c.id) || {}).spent || 0) : 0;
    return fijo + (r.spent - fijo) / frac; };
  for (const r of rows) {
    if (!(r.bud > 0) || !r.own) continue;
    const exceso = r.spent - r.bud;
    if (r.anual) {   // anualidad: se compara lo gastado en el año con el presupuesto anual
      if (exceso > Math.max(10, r.bud * 0.03)) { conAvisoPres.add(r.catId);
        add('amber', '🗓️', `${r.nombre}: la anualidad sale más cara`, `En ${r.anio} llevas ${fmtEUR(r.spent)} y presupuestaste ${fmtEUR(r.bud)} al año (<b>+${fmtEUR(exceso)}</b>). Actualiza el presupuesto en 🏷️ Categorías para que la aportación mensual a anualidades sea la correcta.`, `anual:${r.catId}:${r.anio}`); }
      continue;
    }
    if (esGastoFijo(r.catId, months[0])) {
      if (exceso > Math.max(10, r.bud * 0.03)) { conAvisoPres.add(r.catId);
        add('amber', '📌', `${r.nombre}: el cargo fijo ha subido`, `Este ${nM > 1 ? 'periodo' : 'mes'} son ${fmtEUR(r.spent)} y tenías presupuestados ${fmtEUR(r.bud)} (<b>+${fmtEUR(exceso)}</b>). Si es una subida de cuota o de tarifa, compruébala y actualiza el presupuesto en 🏷️ Categorías.`, `fijo:${r.catId}:${ymKey}`); }
      continue;
    }
    if (exceso >= 5) { conAvisoPres.add(r.catId);
      add('red', '🚨', `Presupuesto superado: ${r.nombre}`, `Has gastado ${fmtEUR(r.spent)} de ${fmtEUR(r.bud)}: te has pasado <b>${fmtEUR(exceso)}</b>${soloMesActual && frac < 0.97 ? ` y quedan ${daysInMonth(cy, cm) - cd} días de mes` : ''}.`, `pres:${r.catId}:${ymKey}`); }
    else if (soloMesActual && cd >= 7 && frac < 0.9 && nMovsCat(r.catId) >= 3 && proyeccion(r) > r.bud * 1.1) { conAvisoPres.add(r.catId);
      const quedan = daysInMonth(cy, cm) - cd;
      add('amber', '⚠️', `${r.nombre}: a este ritmo te pasarás`, `Llevas ${fmtEUR(r.spent)} de ${fmtEUR(r.bud)} a día ${cd} y acabarías el mes en <b>${fmtEUR(proyeccion(r))}</b>. Para no pasarte, no superes ${fmtEUR(Math.max(0, r.bud - r.spent) / quedan)}/día los ${quedan} días que quedan.`, `ritmo:${r.catId}:${ymKey}`); }
  }

  // 2) Gastos extraordinarios (importe alto y muy por encima de lo habitual en su categoría)
  const umbral = num(S.ajustes.extra_umbral) || 300;
  const desde = addMonths(months[0], -12);
  const previos = S.movimientos.filter(m => m.tipo === 'gasto' && ymOf(m.mes_imputacion) >= addMonths(desde, -2) && ymOf(m.mes_imputacion) < months[0]);
  // Un cargo anual que ya pasó hace 10-14 meses por un importe parecido (IBI, seguro, ITV…) no es extraordinario: es esperado
  const esAnual = m => previos.some(x => x.categoria_id === m.categoria_id && Math.abs(num(x.importe) - num(m.importe)) <= Math.abs(num(m.importe)) * 0.2
    && Math.abs(monthsDiff(x.fecha, m.fecha)) >= 10 && Math.abs(monthsDiff(x.fecha, m.fecha)) <= 14);
  const extras = st.movs.filter(m => m.tipo === 'gasto' && -num(m.importe) >= umbral && m.categoria_id && !esCatAmortizacion(m.categoria_id) && !catAnualDe(m.categoria_id) && !esAnual(m)).filter(m => {
    const h = previos.filter(x => x.categoria_id === m.categoria_id && ymOf(x.mes_imputacion) >= desde).map(x => -num(x.importe));
    return h.length >= 2 ? -num(m.importe) > 2.5 * median(h) : -num(m.importe) >= 3 * umbral;
  }).sort((a, b) => num(a.importe) - num(b.importe));
  if (extras.length) add('amber', '💥', `${extras.length} gasto(s) extraordinario(s): ${fmtEUR(-sum(extras, 'importe'))}`,
    `Importes muy por encima de lo habitual en su categoría:<ul>${extras.slice(0, 5).map(m => `<li>${fmtDate(m.fecha)} · ${esc(m.concepto || '—')} · <b>${fmtEUR(-num(m.importe))}</b> <span class="muted">(${esc(catName(m.categoria_id) || 'Sin categoría')})</span></li>`).join('')}</ul>${extras.length > 5 ? '…y ' + (extras.length - 5) + ' más.' : ''} Si se van a repetir (cargos anuales, revisiones…), apúntalos en 🎯 Previsión para que no te pillen por sorpresa.`, `extra:${extras.map(m => m.id).join(',')}`);
  const catsExtra = new Set(extras.map(m => { const r = rootOf(catById(m.categoria_id)); return r ? r.id : '_none'; }));

  // 3) Categorías disparadas frente a tu media
  if (hist && hist.n >= 2) {
    // Solo gasto variable: un cargo fijo nuevo (p. ej. la primera cuota de un préstamo) no es "gastar más"
    const fijoCache = {}, esFijoMov = m => m.categoria_id && (fijoCache[m.categoria_id] ??= esGastoFijo(m.categoria_id, months[0]) || !!catAnualDe(m.categoria_id) || S.deudas.some(d => categoriaCuota(d) === m.categoria_id));
    const porRaiz = (movs, div) => { const o = {}; for (const m of movs) if (m.tipo === 'gasto' && !esFijoMov(m)) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.id : '_none'; o[k] = (o[k] || 0) - num(m.importe) / div; } return o; };
    const actual = porRaiz(st.movs, nM), medias = porRaiz(periodStats(hist.ms).movs, hist.n);
    const subidas = Object.entries(actual).map(([k, v]) => ({ k, v, med: medias[k] || 0 }))
      .filter(o => o.med > 0 && o.v > o.med * 1.4 && (o.v - o.med) * nM > 100 && !catsExtra.has(o.k) && !conAvisoPres.has(o.k)
        && !childrenOf(o.k).some(c => conAvisoPres.has(c.id)) && !esGastoFijo(o.k, months[0])).sort((a, b) => (b.v - b.med) - (a.v - a.med)).slice(0, 3);
    for (const o of subidas) { const c = catById(o.k); add('amber', '📈', `${c ? c.nombre : 'Sin categoría'}: +${fmtPct(o.v / o.med - 1, 0)} sobre tu media`, `Llevas ${fmtEUR(o.v)}${nM > 1 ? '/mes' : ''} en gasto variable frente a ${fmtEUR(o.med)}/mes de media en los ${hist.n} meses anteriores${enCurso ? ' (y el mes aún no ha terminado)' : ''}.`, `media:${o.k}:${ymKey}`); }
  }

  // 4) Capacidad de ahorro
  //    Con el mes a medias la tasa de ahorro no dice nada (la nómina ya entró y faltan gastos): solo periodos cerrados.
  if (st.ingresos > 0 && !enCurso) {
    const t = st.ahorro / st.ingresos;
    if (st.ahorro < 0) add('red', '🔻', 'Gastas más de lo que ingresas', `Déficit de <b>${fmtEUR(-st.ahorro)}</b> en el periodo. Revisa primero las categorías con presupuesto superado y los gastos extraordinarios.`, `deficit:${ymKey}`);
    else if (t < 0.1) add('amber', '🐷', `Tasa de ahorro baja: ${fmtPct(t)}`, `Una referencia sana es ahorrar al menos el 15-20 % de los ingresos. Recortar ${fmtEUR(st.ingresos * 0.15 - st.ahorro)} en el periodo te llevaría al 15 %.`, `tasa:${ymKey}`);
  } else if (st.ingresos > 0 && soloMesActual && st.ahorro < 0)
    add('red', '🔻', 'Este mes ya gastas más de lo que ingresas', `Llevas ${fmtEUR(st.gastos)} de gasto frente a ${fmtEUR(st.ingresos)} de ingresos imputados a este mes (<b>${fmtEUR(st.ahorro)}</b>).`, `deficit:${ymKey}`);
  else if (st.gastos > 0 && !enCurso) add('blue', 'ℹ️', 'Sin ingresos imputados en el periodo', 'Comprueba que las nóminas están imputadas al mes correcto (regla de nómina, botón ⏭ en movimientos).');

  // 5) Fondo de emergencia
  const obj = num(S.ajustes.fondo_meses) || 6;
  if (gastoMes > 0) {
    const meses = P.reserva / gastoMes, objetivo = obj * gastoMes;
    if (meses < 3) add('red', '🛟', `Fondo de emergencia bajo: ${fmtNum(meses, 1)} meses`, `Cubre ${fmtNum(meses, 1)} meses de gastos (${fmtEUR(gastoMes, 0)}/mes). Prioriza llegar a ${obj} meses (${fmtEUR(objetivo, 0)}) antes de invertir más: te faltan <b>${fmtEUR(objetivo - P.reserva, 0)}</b>.`, 'fondo-bajo', 30);
    else if (meses < obj) add('amber', '🛟', `Fondo de emergencia: ${fmtNum(meses, 1)} de ${obj} meses`, `Te faltan ${fmtEUR(objetivo - P.reserva, 0)} para tu objetivo. Con ${fmtEUR((objetivo - P.reserva) / 6, 0)}/mes lo completarías en 6 meses.`, 'fondo-falta', 60);
    else if (meses > obj * 1.5) add('blue', '💡', `Fondo de emergencia sobredimensionado: ${fmtNum(meses, 1)} meses`, `Tienes unos <b>${fmtEUR(P.reserva - objetivo, 0)}</b> por encima de tu objetivo de ${obj} meses. Ese excedente podría trabajar a largo plazo en tu cartera de inversión.`, 'fondo-sobra', 90);

    // 6) Dinero ocioso en cuenta corriente/efectivo
    //    Se mira también el saldo a fin del mes pasado: justo después de cobrar la nómina siempre parece que sobra.
    const finPrev = diaAnterior(curYm + '-01');
    const opPrev = sum(S.cuentas.filter(c => c.activa !== false && (c.tipo === 'corriente' || c.tipo === 'efectivo')), c => { const v = Calc.saldoA(c, finPrev); return v === null ? Calc.valor(c) : v; });
    if (Math.min(P.operativa, opPrev) > 2 * gastoMes && Math.min(P.operativa, opPrev) - 1.5 * gastoMes > 500)
      add('blue', '💤', `${fmtEUR(P.operativa - 1.5 * gastoMes, 0)} ociosos en la cuenta corriente`, `Tienes ${fmtEUR(P.operativa, 0)} en cuenta corriente y efectivo, más de 2 meses de gastos. Con 1-1,5 meses de colchón operativo suele bastar: mueve el exceso al fondo de emergencia${P.reserva / gastoMes >= obj ? ' o, como ya está completo, a inversión' : ''}.`, 'ocioso', 30);
  }

  // 7) Inversión y destino del ahorro
  if (st.ingresos > 0 && st.ahorro > 0 && !enCurso) {
    const ti = st.aport.inversion / st.ingresos, movido = st.aport.inversion + st.aport.ahorro + st.capital;
    if (movido < st.ahorro * 0.5) add('blue', '🧭', 'El ahorro se queda en la cuenta corriente', `Has ahorrado ${fmtEUR(st.ahorro)} pero solo has movido ${fmtEUR(Math.max(0, movido))} a ahorro, inversión o amortización de deuda. Programa una transferencia automática el día después de cobrar la nómina (“págate primero”).`, 'ahorro-parado', 60);
    if (ti < 0.1 && P.reserva / (gastoMes || 1) >= 3) add('blue', '📊', `Tasa de inversión del ${fmtPct(ti)}`, `Con tu ahorro medio, una aportación periódica de unos <b>${fmtEUR(Math.max(50, Math.round(((hist ? hist.ahorro : st.ahorro / nM) * 0.5) / 10) * 10), 0)}/mes</b> (la mitad de lo que ahorras) haría crecer el patrimonio de forma constante.`, 'tasa-inversion', 90);
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
    if (tin >= 3) add('blue', '🏦', `${d.nombre}: TIN del ${fmtNum(tin, 2)} %`, `Cada euro amortizado “rinde” un ${fmtNum(tin, 2)} % seguro y sin riesgo (te quedan ${fmtEUR(I.interesesPendientes, 0)} de intereses). Con el fondo de emergencia completo, compara amortizar con invertir en el simulador de 🏦 Deudas.`, `tin:${d.id}`, 180);
    else if (tin < 2) add('blue', '🏦', `${d.nombre}: TIN bajo (${fmtNum(tin, 2)} %)`, 'Con un interés tan bajo, amortizar anticipadamente suele aportar menos que mantener liquidez o invertir a largo plazo. Prioriza fondo de emergencia e inversión periódica.', `tin:${d.id}`, 180);
  }

  // 10) Suscripciones y gastos sin categoría
  const susc = S.categorias.find(c => !c.parent_id && c.tipo === 'gasto' && /suscrip/i.test(c.nombre));
  if (susc && hist && hist.porRaiz[susc.id] > 0) add('blue', '🔁', `Suscripciones: ${fmtEUR(hist.porRaiz[susc.id] * 12, 0)}/año`, 'Revisa una vez al trimestre cuáles usas de verdad. Es el ahorro más fácil: se cancela una vez y se nota todos los meses.', 'suscripciones', 90);
  const sinCat = st.movs.filter(m => m.tipo === 'gasto' && !m.categoria_id);
  if (sinCat.length) add('blue', '🏷️', `${sinCat.length} gasto(s) sin categoría (${fmtEUR(-sum(sinCat, 'importe'))})`, 'Categorízalos en 💳 Movimientos para que el análisis y los presupuestos sean fiables.');

  // 11) Coste real de los vehículos
  const vehFijos = sum(S.vehiculos, v => seguroVehiculo(v) + num(v.gasto_impuesto) + num(v.gasto_mantenimiento));
  const vehDep = sum(S.vehiculos, v => { const ds = v.fecha_compra || (v.anio ? `${v.anio}-07-01` : null); if (!ds) return 0; const a = Math.max(0.5, monthsDiff(ds, today) / 12); return Math.max(0, num(v.valor_compra) - num(v.valor_actual)) / a; });
  if (ingMes > 0 && vehFijos + vehDep > ingMes * 12 * 0.15) add('blue', '🚐', `Vehículos: ${fmtEUR(vehFijos + vehDep, 0)}/año entre gastos fijos y depreciación`, `Supone el ${fmtPct((vehFijos + vehDep) / (ingMes * 12), 0)} de tus ingresos anuales. Merece la pena revisar si el uso de ${S.vehiculos.length === 1 ? 'tu vehículo' : `los ${S.vehiculos.length}`} compensa su coste.`, 'vehiculos', 180);

  // 12) Seguros: vencimientos y renovaciones
  for (const s of S.seguros.filter(s => s.activo !== false)) {
    const x = seguroInfo(s);
    if (x.vencido) add('red', '🛡️', `${s.nombre}: póliza vencida`, `Venció el ${fmtDate(x.venc)} y no se renueva sola. Comprueba que sigues cubierto o márcala como dada de baja en 🛡️ Seguros.`);
    else if (x.dias !== null && x.dias <= 30) add('amber', '🛡️', `${s.nombre}: vence en ${x.dias} días`, `${s.renovacion_auto === false ? 'No se renueva automáticamente.' : 'Se renovará automáticamente.'} Prima actual ${fmtEUR(x.prima)}/año${s.aseguradora ? ' con ' + esc(s.aseguradora) : ''}: pide 2-3 presupuestos antes del ${fmtDate(x.venc)}.`, `vence:${s.id}:${x.venc}`, 40);
  }
  const totSeg = sum(S.seguros.filter(s => s.activo !== false), 'prima_anual');
  if (totSeg > 0 && ingMes > 0 && totSeg > ingMes * 12 * 0.08) add('blue', '🛡️', `Seguros: ${fmtEUR(totSeg, 0)}/año (${fmtPct(totSeg / (ingMes * 12), 0)} de tus ingresos)`, 'Revisa coberturas duplicadas (p. ej. asistencia en viaje en coche y tarjeta) y agrupa pólizas en una aseguradora para pedir descuento.', 'seguros-total', 180);

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

  // 14b) Gastos compartidos pendientes de cobro
  if (S.v6) { const ab = gastosAbiertos().filter(g => diasEntre(g.fecha, today) >= 10);
    if (ab.length) add('blue', '👥', `Te deben ${fmtEUR(sum(ab, g => infoCompartido(g).pendiente))} de ${ab.length} gasto(s) compartido(s)`, `El más antiguo: ${esc(ab[ab.length - 1].concepto)} (${fmtDate(ab[ab.length - 1].fecha)}). Recuérdaselo o márcalo como saldado en 💳 Cuentas.`); }

  // 15) Previsión de tesorería: meses en los que la cuenta se queda corta
  if (S.v52) {
    try {
      const P = calcularPrevision(6, S.prevMetas);
      if (P.minimo.saldo < 0) add('red', '🔮', `Previsión: saldo negativo en ${ymLabel(P.minimo.ym)}`, `Con los cargos previstos, la cuenta operativa bajaría hasta <b>${fmtEUR(P.minimo.saldo, 0)}</b>. Revisa 🎯 Previsión y metas y prepara saldo desde el fondo de emergencia.`);
      else if (P.colchon && P.minimo.saldo < P.colchon) add('amber', '🔮', `Previsión: ${ymLabel(P.minimo.ym)} viene cargado`, `El saldo operativo bajaría a ${fmtEUR(P.minimo.saldo, 0)}, menos de un mes de gastos (${fmtEUR(P.colchon, 0)}). Evita gastos extra ese mes o adelanta saldo.`);
    } catch (e) { console.warn(e); }
    // 16) Metas
    const inf = S.metas.map(m => ({ m, x: metaInfo(m) }));
    for (const { m, x } of inf) {
      if (x.estado === 'retrasada') add('amber', '🎯', `${m.nombre}: vas por detrás`, `Necesitas apartar ${fmtEUR(x.necesariaMes)}/mes y tu ritmo es ${fmtEUR(x.ritmo)}/mes. ${x.fechaEstimada ? `A este ritmo llegarías en ${ymLabel(x.fechaEstimada, true)}.` : ''}`);
      else if (x.estado === 'vencida') add('amber', '🎯', `${m.nombre}: fecha superada`, `Te faltan ${fmtEUR(x.restante, 0)}. Ajusta la fecha objetivo o el importe.`);
      else if (x.conseguida && !m.completada) add('green', '🎉', `${m.nombre}: ¡meta conseguida!`, 'Márcala como conseguida y decide el siguiente objetivo.');
    }
    const nec = sum(inf.filter(o => !o.x.conseguida), o => o.x.necesariaMes || 0);
    if (hist && nec > 0 && nec > hist.ahorro) add('amber', '🎯', `Tus metas piden ${fmtEUR(nec, 0)}/mes y ahorras ${fmtEUR(hist.ahorro, 0)}/mes`, 'No llegas a todas a tiempo: prioriza, alarga alguna fecha o ajusta importes.');
  }

  const ord = { red: 0, amber: 1, blue: 2, green: 3 };
  return A.sort((a, b) => ord[a.nivel] - ord[b.nivel]);
}
function renderAlertas(months, st, P, rows) {
  let A;
  try { A = buildAlertas(months, st, P, rows); } catch (e) { console.error(e); return ''; }
  const oc = alertasOcultas(), hoy = todayISO(), nOcultos = A.filter(a => oc[a.key] && oc[a.key] >= hoy).length;
  A = A.filter(a => !(oc[a.key] && oc[a.key] >= hoy));
  if (!A.length) return nOcultos ? `<div class="small muted" style="margin:4px 0 12px">🔔 Sin avisos pendientes · <a href="#" data-action="alert-reset">mostrar ${nOcultos} oculto(s)</a></div>` : '';
  const cnt = n => A.filter(a => a.nivel === n).length;
  const item = a => `<div class="alert ${a.nivel}"><div class="ic">${a.ic}</div><div style="flex:1"><b class="t">${esc(a.t)}</b>${a.txt}</div>
    <button class="mini" style="align-self:flex-start" data-action="alert-hide" data-key="${esc(a.key)}" data-dias="${a.dias}" title="Ocultar este aviso ${a.dias} días">✕</button></div>`;
  const vis = A.slice(0, 6), rest = A.slice(6);
  return `<div class="card"><div class="card-head"><h3>🔔 Alertas y consejos</h3><div class="btn-row">
      ${cnt('red') ? `<span class="badge red">${cnt('red')} alerta(s)</span>` : ''}${cnt('amber') ? `<span class="badge amber">${cnt('amber')} aviso(s)</span>` : ''}
      ${cnt('blue') ? `<span class="badge blue">${cnt('blue')} consejo(s)</span>` : ''}${cnt('green') ? `<span class="badge green">${cnt('green')} bien</span>` : ''}</div></div>
    <div class="alerts">${vis.map(item).join('')}<div class="alerts" id="alert-more" hidden>${rest.map(item).join('')}</div></div>
    ${rest.length ? `<div style="text-align:center;margin-top:10px"><button class="btn sm ghost" data-action="alert-more" data-more="Ver ${rest.length} más">Ver ${rest.length} más</button></div>` : ''}
    <div class="small muted" style="margin-top:10px">Pulsa ✕ en un aviso para ocultarlo un tiempo (vuelve si la situación sigue igual).${nOcultos ? ` <a href="#" data-action="alert-reset">Mostrar ${nOcultos} oculto(s)</a>.` : ''} Consejos orientativos calculados con tus propios datos; no sustituyen el asesoramiento de un profesional financiero.</div></div>`;
}
async function guardarOcultas(valor) {
  const hoy = todayISO(); Object.keys(valor).forEach(k => { if (!(valor[k] >= hoy)) delete valor[k]; });
  await DB.upsert('ajustes', { clave: 'alertas_ocultas', valor, updated_at: new Date().toISOString() }, 'clave');
  const row = (S.ajustesRows || []).find(r => r.clave === 'alertas_ocultas');
  if (row) row.valor = valor; else (S.ajustesRows = S.ajustesRows || []).push({ clave: 'alertas_ocultas', valor });
}
Object.assign(Actions, {
  'alert-hide': async el => {
    const hasta = new Date(); hasta.setDate(hasta.getDate() + (num(el.dataset.dias) || 30));
    const r = await withSaving(null, () => guardarOcultas({ ...alertasOcultas(), [el.dataset.key]: `${hasta.getFullYear()}-${pad(hasta.getMonth() + 1)}-${pad(hasta.getDate())}` }));
    if (r !== FAIL) { toast(`Aviso oculto ${el.dataset.dias} días`, 'ok'); render(); }
  },
  'alert-reset': async (el, e) => { if (e) e.preventDefault(); const r = await withSaving(null, () => guardarOcultas({})); if (r !== FAIL) render(); }
});
