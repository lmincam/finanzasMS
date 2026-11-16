'use strict';
/* =====================================================================
   CÁLCULOS FINANCIEROS
   ---------------------------------------------------------------------
   Saldos, patrimonio, préstamos (sistema francés), inmuebles, inversiones y periodos.
   Sin acceso al DOM: solo leen S y devuelven números.
   Depende de: utilidades.js, estado.js
   ===================================================================== */

let _deudaCache = new Map();
const cuentaById = id => S.cuentas.find(c => c.id === id);
const catById = id => S.categorias.find(c => c.id === id);
const childrenOf = id => S.categorias.filter(c => c.parent_id === id).sort(byOrden);
const rootOf = c => (c && c.parent_id) ? (catById(c.parent_id) || c) : c;
const catName = id => { const c = catById(id); if (!c) return ''; const p = c.parent_id ? catById(c.parent_id) : null; return p ? `${p.nombre} › ${c.nombre}` : c.nombre; };
const budgetOf = r => num(r.presupuesto_mensual) > 0 ? num(r.presupuesto_mensual) : sum(childrenOf(r.id), 'presupuesto_mensual');
const subtipoPorCuenta = c => c ? (c.tipo === 'inversion' ? 'inversion' : c.tipo === 'ahorro' ? 'ahorro' : 'liquidez') : 'liquidez';

const Calc = {
  movsDesde(cid, desde) { return S.movimientos.filter(m => m.cuenta_id === cid && (!desde || m.fecha > desde)); },
  /** Saldo contable = saldo de partida + movimientos posteriores. */
  saldo(c) { return round2(num(c.saldo_inicial) + sum(this.movsDesde(c.id, c.fecha_saldo_inicial), 'importe')); },
  /** Valor: para inversión usa el valor de mercado + aportaciones posteriores a esa valoración. */
  valor(c) {
    if (c.tipo === 'inversion' && c.valor_mercado !== null && c.valor_mercado !== undefined && c.valor_mercado !== '')
      return round2(num(c.valor_mercado) + sum(this.movsDesde(c.id, c.fecha_valor_mercado || todayISO()), 'importe'));
    return this.saldo(c);
  },
  /** Capital aportado neto a una cuenta hasta una fecha (incluida). */
  aportadoA(c, fecha) { return round2(num(c.saldo_inicial) + sum(S.movimientos.filter(m => m.cuenta_id === c.id && m.fecha > c.fecha_saldo_inicial && m.fecha <= fecha), 'importe')); },
  patrimonio() {
    const cuentas = S.cuentas.filter(c => c.activa !== false);
    const det = cuentas.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, valor: this.valor(c) }));
    const liquidez = sum(det.filter(d => d.tipo !== 'inversion'), 'valor');
    const operativa = sum(det.filter(d => d.tipo === 'corriente' || d.tipo === 'efectivo'), 'valor');
    const reserva = sum(det.filter(d => d.tipo === 'ahorro'), 'valor');
    const inversiones = sum(det.filter(d => d.tipo === 'inversion'), 'valor');
    const inmuebles = sum(S.inmuebles, 'valor_mercado');
    const vehiculos = sum(S.vehiculos, 'valor_actual');
    const deudas = sum(S.deudas.filter(d => d.activa !== false), d => deudaInfo(d).pendienteHoy);
    const activos = liquidez + inversiones + inmuebles + vehiculos;
    return { liquidez, operativa, reserva, inversiones, inmuebles, vehiculos, deudas, activos, neto: activos - deudas, det };
  }
};

/* ---------- Préstamos: sistema francés ---------- */
const cuotaFrancesa = (P, r, n) => n > 0 ? (r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n))) : 0;
function amortizar(P, r, cuota, startYm) {
  const out = []; let p = P, ym = startYm;
  if (!(cuota > 0) || p <= 0.005) return out;
  if (r > 0 && cuota <= p * r + 1e-9) return null; // la cuota no cubre intereses
  while (p > 0.005 && out.length < 720) {
    const int = p * r; const cap = Math.min(cuota - int, p);
    p -= cap; out.push({ ym, cuota: cap + int, interes: int, capital: cap, pendiente: Math.max(0, p) });
    ym = addMonths(ym, 1);
  }
  return out;
}
function deudaInfo(d) {
  if (_deudaCache.has(d.id)) return _deudaCache.get(d.id);
  const today = todayISO();
  const r = num(d.interes) / 100 / 12;
  const pagadas = d.fecha_inicio ? Math.max(0, monthsDiff(d.fecha_inicio, today)) : null;
  const restContrato = d.plazo_meses ? Math.max(0, num(d.plazo_meses) - (pagadas || 0)) : null;
  const tienePend = d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '';
  let P0, refDate;
  if (tienePend) { P0 = num(d.capital_pendiente); refDate = d.fecha_capital_pendiente || today; }
  else if (num(d.capital_inicial) > 0 && d.fecha_inicio) { P0 = num(d.capital_inicial); refDate = d.fecha_inicio; }
  else { P0 = num(d.capital_inicial); refDate = today; }
  let cuota = num(d.cuota_mensual);
  if (!cuota) {
    if (tienePend && restContrato) cuota = cuotaFrancesa(P0, r, restContrato);
    else if (num(d.capital_inicial) > 0 && d.plazo_meses) cuota = cuotaFrancesa(num(d.capital_inicial), r, num(d.plazo_meses));
  }
  const meses = Math.max(0, monthsDiff(refDate, today));
  let P = P0;
  for (let i = 0; i < meses && P > 0; i++) P = Math.max(0, P - Math.max(0, cuota - P * r));
  P = round2(P);
  const sched = amortizar(P, r, cuota, addMonths(ymOf(today), 1));
  const s = sched || [];
  const info = {
    r, cuota, pendienteHoy: P, pagadas, restContrato, viable: sched !== null,
    restantes: sched ? s.length : null, fin: s.length ? s[s.length - 1].ym : null,
    interesesPendientes: sum(s, 'interes'), sched: s, estimado: meses > 0,
    pctAmort: num(d.capital_inicial) > 0 ? Math.max(0, 1 - P / num(d.capital_inicial)) : null
  };
  _deudaCache.set(d.id, info);
  return info;
}
function inmuebleInfo(i) {
  const coste = num(i.precio_compra) + num(i.gastos_adquisicion);
  const vm = num(i.valor_mercado);
  const debts = S.deudas.filter(d => d.inmueble_id === i.id && d.activa !== false);
  const deuda = sum(debts, d => deudaInfo(d).pendienteHoy);
  const cuota = sum(debts, d => deudaInfo(d).cuota);
  const renta = num(i.renta_mensual);
  const rentaAnual = renta * Math.max(0, 12 - num(i.meses_vacio));
  const gastos = num(i.gastos_ibi) + num(i.gastos_comunidad) + num(i.gastos_seguro) + num(i.gastos_mantenimiento);
  const netoAnual = rentaAnual - gastos;
  const m2 = calcM2(i);
  return {
    ...m2,
    coste, vm, plusvalia: vm - coste, plusPct: coste ? (vm - coste) / coste : null, deuda, neto: vm - deuda, ltv: vm ? deuda / vm : null,
    renta, rentaAnual, gastos, netoAnual, cuota,
    brutaVM: vm ? renta * 12 / vm : null, brutaCoste: coste ? renta * 12 / coste : null,
    netaVM: vm ? netoAnual / vm : null, netaCoste: coste ? netoAnual / coste : null,
    cashflow: renta ? netoAnual / 12 - cuota : null
  };
}

/* ---------- Periodo del dashboard ---------- */
function periodMonths() {
  const p = S.period;
  switch (p.mode) {
    case '2m': case '3m': case '6m': { const n = parseInt(p.mode, 10); return Array.from({ length: n }, (_, i) => addMonths(p.ref, i - n + 1)); }
    case 'anio': { const y = p.ref.slice(0, 4); return Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`); }
    case 'custom': return monthsBetween(p.from || p.ref, p.to || p.ref);
    default: return [p.ref];
  }
}
function periodStats(months) {
  const set = new Set(months);
  const movs = S.movimientos.filter(m => set.has(ymOf(m.mes_imputacion)));
  const ingresos = sum(movs.filter(m => m.tipo === 'ingreso'), 'importe');
  const gastosCaja = -sum(movs.filter(m => m.tipo === 'gasto'), 'importe');
  // La parte de capital de las cuotas de préstamos y las amortizaciones anticipadas no es gasto: reduce deuda (ahorro)
  let capital = 0;
  for (const m of movs) if (m.tipo === 'gasto' && num(m.importe) < 0) capital += capitalDeMovimiento(m);
  const gastos = gastosCaja - capital;
  // Transferencias: se toma la pata positiva de cada pareja. Si entra en cuenta de inversión/ahorro suma; si vuelve a operativa, resta (retirada).
  const aport = { liquidez: 0, ahorro: 0, inversion: 0 };
  for (const m of movs) {
    if (m.tipo !== 'transferencia' || num(m.importe) <= 0) continue;
    const st = m.subtipo_transferencia || 'liquidez';
    const c = cuentaById(m.cuenta_id);
    if (st === 'liquidez') aport.liquidez += num(m.importe);
    else aport[st] += (c && (c.tipo === 'inversion' || c.tipo === 'ahorro')) ? num(m.importe) : -num(m.importe);
  }
  return { movs, ingresos, gastos, gastosCaja, capital, ahorro: ingresos - gastos, ahorroCaja: ingresos - gastosCaja, aport };
}

/* ---------- Préstamos: separar intereses y capital de las cuotas pagadas ---------- */
/** Categoría donde se registra la cuota de un préstamo (por defecto, "Hipoteca" para las hipotecas). */
function categoriaCuota(d) {
  if (d.categoria_cuota_id) return d.categoria_cuota_id;
  if (d.tipo === 'hipoteca') { const c = S.categorias.find(x => x.tipo === 'gasto' && x.parent_id && normText(x.nombre) === 'hipoteca'); return c ? c.id : null; }
  return null;
}
/** ¿La categoría (o su principal) es de amortización anticipada? */
const esCatAmortizacion = id => { const c = catById(id); if (!c) return false; const p = c.parent_id ? catById(c.parent_id) : null; return c.naturaleza === 'amortizacion' || (p && p.naturaleza === 'amortizacion'); };
/** Capital pendiente al inicio de un mes (hacia delante o hacia atrás desde el último dato conocido). */
function pendienteEnMes(d, ym) {
  const I = deudaInfo(d), r = I.r, c = I.cuota;
  const tiene = d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '';
  let P = tiene ? num(d.capital_pendiente) : num(d.capital_inicial);
  const refYm = ymOf(tiene ? (d.fecha_capital_pendiente || todayISO()) : (d.fecha_inicio || todayISO()));
  const k = monthsDiff(refYm + '-01', ym + '-01');
  if (k >= 0) for (let i = 0; i < k && P > 0; i++) P = Math.max(0, P * (1 + r) - c);
  else for (let i = 0; i < -k; i++) P = r > 0 ? (P + c) / (1 + r) : P + c;
  return P;
}
/** Parte de capital (no gasto) de un movimiento de gasto. */
function capitalDeMovimiento(m) {
  const abs = Math.abs(num(m.importe));
  if (!m.categoria_id) return 0;
  if (esCatAmortizacion(m.categoria_id)) return abs;
  const d = S.deudas.find(x => x.activa !== false && categoriaCuota(x) === m.categoria_id);
  if (!d) return 0;
  const I = deudaInfo(d); if (!I.r && !I.cuota) return 0;
  const interes = Math.min(abs, pendienteEnMes(d, ymOf(m.fecha)) * I.r);
  return Math.max(0, Math.min(abs, I.cuota) - interes);
}
/** Saldo de una cuenta al final de un día (null si es anterior al saldo de partida). */
Calc.saldoA = (c, fecha) => fecha < c.fecha_saldo_inicial ? null : round2(num(c.saldo_inicial) + sum(S.movimientos.filter(m => m.cuenta_id === c.id && m.fecha > c.fecha_saldo_inicial && m.fecha <= fecha), 'importe'));

/* ---------- Inversiones ---------- */
function invInfo(c) {
  const valor = Calc.valor(c), aportado = Calc.saldo(c);
  const tieneVM = c.valor_mercado !== null && c.valor_mercado !== undefined && c.valor_mercado !== '';
  const plus = valor - aportado;
  const hace12 = addMonths(ymOf(todayISO()), -11) + '-01';
  const ap12 = sum(S.movimientos.filter(m => m.cuenta_id === c.id && m.tipo === 'transferencia' && m.fecha >= hace12), 'importe');
  const vals = S.valoraciones.filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  return { valor, aportado, plus, rent: aportado > 0 && tieneVM ? plus / aportado : null, tieneVM, ap12, vals,
    diasVal: tieneVM && c.fecha_valor_mercado ? Math.round((new Date(todayISO()) - new Date(c.fecha_valor_mercado)) / 86400000) : null };
}
const apVal = v => (v.aportado_neto === null || v.aportado_neto === undefined) ? (cuentaById(v.cuenta_id) ? Calc.aportadoA(cuentaById(v.cuenta_id), v.fecha) : 0) : num(v.aportado_neto);


/* ---------- Inmuebles: valoración por €/m² ---------- */
/** Venta = m² × €/m² zona × (1 + ajuste%) + anejos. Alquiler = m² × €/m²/mes × (1 + ajuste%) + renta anejos. */
function calcM2(i) {
  const m2 = num(i.metros_construidos), aj = 1 + num(i.ajuste_pct) / 100;
  const ventaCalc = m2 > 0 && num(i.precio_m2_venta) > 0 ? round2(m2 * num(i.precio_m2_venta) * aj + num(i.valor_anejos)) : null;
  const rentaCalc = m2 > 0 && num(i.precio_m2_alquiler) > 0 ? round2(m2 * num(i.precio_m2_alquiler) * aj + num(i.renta_anejos)) : null;
  const diasM2 = i.fecha_precio_m2 ? diasEntre(i.fecha_precio_m2, todayISO()) : null;
  return { m2, ventaCalc, rentaCalc, diasM2, costeM2: m2 > 0 ? (num(i.precio_compra) + num(i.gastos_adquisicion)) / m2 : null, valorM2: m2 > 0 ? num(i.valor_mercado) / m2 : null };
}

/* ---------- Fechas auxiliares ---------- */
const isoToUTC = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((isoToUTC(b) - isoToUTC(a)) / 86400000);
const addYearsISO = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const yy = y + n; return `${yy}-${pad(m)}-${pad(Math.min(d, daysInMonth(yy, m)))}`; };

/* ---------- Préstamos: amortizaciones anticipadas ---------- */
/**
 * Cuadro de amortización con pagos extraordinarios.
 * extras: Map 'AAAA-MM' → { importe, modo }   modo 'plazo' = misma cuota, acaba antes
 *                                              modo 'cuota' = mismo plazo, baja la cuota
 * nMeses: cuotas que quedan sin amortizar (necesario para recalcular la cuota).
 * Cada fila: { n, ym, cuota, interes, capital, extra, pendiente, cuotaVigente }
 */
function amortizarConExtras(P, r, cuota, startYm, nMeses, extras, modoDef = 'plazo') {
  const out = []; let p = P, ym = startYm, c = cuota, n = nMeses || 0;
  if (!(c > 0) || p <= 0.005) return out;
  if (r > 0 && c <= p * r + 1e-9) return null;
  while (p > 0.005 && out.length < 720) {
    const int = p * r, cap = Math.min(c - int, p);
    p -= cap; n--;
    let extra = 0;
    const e = extras && extras.get(ym);
    if (e && p > 0.005) {
      extra = Math.min(num(e.importe), p); p -= extra;
      if ((e.modo || modoDef) === 'cuota' && p > 0.005 && n > 0) c = cuotaFrancesa(p, r, n);
    }
    out.push({ n: out.length + 1, ym, cuota: cap + int, interes: int, capital: cap, extra, pendiente: Math.max(0, p), cuotaVigente: c });
    ym = addMonths(ym, 1);
  }
  return out;
}
/** Genera el mapa de pagos extra a partir de una pauta: importe cada N meses desde un mes (opcional hasta). */
function extrasPauta({ importe, cada = 0, desdeYm, hastaYm = null, modo = 'plazo' }, map = new Map()) {
  if (!(num(importe) > 0) || !desdeYm) return map;
  let ym = desdeYm;
  for (let k = 0; k < 720; k++) {
    if (hastaYm && ym > hastaYm) break;
    const prev = map.get(ym);
    map.set(ym, { importe: num(importe) + (prev ? num(prev.importe) : 0), modo });
    if (!(cada > 0)) break;
    ym = addMonths(ym, cada);
  }
  return map;
}
/** Extras del plan guardado de una deuda (solo meses futuros). */
function extrasDelPlan(deudaId) {
  const map = new Map(), next = addMonths(ymOf(todayISO()), 1);
  for (const p of S.amortizaciones_plan.filter(x => x.deuda_id === deudaId && x.activo !== false)) {
    let ym = ymOf(p.desde);
    const cada = Math.max(1, num(p.cada_meses) || 12);
    while (ym < next) ym = addMonths(ym, cada);
    extrasPauta({ importe: p.importe, cada, desdeYm: ym, hastaYm: p.hasta ? ymOf(p.hasta) : null, modo: p.modo }, map);
  }
  return map;
}
/** Compara el préstamo sin pagos extra frente a un escenario con pagos extra (cálculo exacto mes a mes). */
function compararAmortizacion(d, extras, modoDef = 'plazo') {
  const I = deudaInfo(d), start = addMonths(ymOf(todayISO()), 1);
  const base = I.sched;
  const con = amortizarConExtras(I.pendienteHoy, I.r, I.cuota, start, I.restantes, extras, modoDef) || [];
  const intBase = sum(base, 'interes'), intCon = sum(con, 'interes'), totalExtra = sum(con, 'extra');
  const comision = totalExtra * num(d.comision_amortizacion) / 100;
  return {
    I, base, con, intBase, intCon, totalExtra, comision,
    ahorro: intBase - intCon, neto: intBase - intCon - comision,
    mesesAhorro: base.length - con.length,
    finBase: base.length ? base[base.length - 1].ym : null, finCon: con.length ? con[con.length - 1].ym : null,
    cuotaFinal: con.length ? con[con.length - 1].cuotaVigente : I.cuota,
    pagadoBase: sum(base, 'cuota'), pagadoCon: sum(con, 'cuota') + totalExtra
  };
}
/** Efecto de una amortización puntual hoy sobre la deuda (para registrarla). */
function efectoAmortizacion(d, importe, modo) {
  const I = deudaInfo(d), P2 = Math.max(0, I.pendienteHoy - importe), start = addMonths(ymOf(todayISO()), 1);
  const cuota2 = modo === 'cuota' && I.restantes ? cuotaFrancesa(P2, I.r, I.restantes) : I.cuota;
  const s2 = amortizar(P2, I.r, cuota2, start) || [];
  return { antes: I.pendienteHoy, despues: round2(P2), cuotaAntes: I.cuota, cuotaDespues: round2(cuota2), meses: (I.restantes || 0) - s2.length, ahorro: round2(I.interesesPendientes - sum(s2, 'interes')) };
}
/** Intereses ya ahorrados (devengados) desde que se hizo una amortización hasta hoy. */
function ahorroDevengado(a, d) {
  const meses = Math.max(0, monthsDiff(a.fecha, todayISO()));
  if (!meses || !num(a.pendiente_antes)) return 0;
  const r = num(d.interes) / 100 / 12, start = addMonths(ymOf(a.fecha), 1);
  const sin = amortizar(num(a.pendiente_antes), r, num(a.cuota_antes), start) || [];
  const con = amortizar(num(a.pendiente_antes) - num(a.importe), r, num(a.cuota_despues) || num(a.cuota_antes), start) || [];
  return Math.max(0, sum(sin.slice(0, meses), 'interes') - sum(con.slice(0, meses), 'interes'));
}
/** Valor final de invertir los mismos pagos a una rentabilidad anual (para comparar con amortizar). */
function valorInvertir(extras, rentAnual, hastaYm) {
  const rm = Math.pow(1 + rentAnual / 100, 1 / 12) - 1;
  let fv = 0, aportado = 0;
  for (const [ym, e] of extras) { if (hastaYm && ym > hastaYm) continue; const n = Math.max(0, monthsDiff(ym + '-01', (hastaYm || ym) + '-01')); fv += num(e.importe) * Math.pow(1 + rm, n); aportado += num(e.importe); }
  return { fv, aportado, ganancia: fv - aportado };
}

/* ---------- Seguros ---------- */
function seguroInfo(s) {
  const today = todayISO(), prima = num(s.prima_anual), freq = FREQ_PAGO[s.forma_pago] || 1;
  let venc = s.fecha_vencimiento || null;
  if (venc && s.renovacion_auto !== false) for (let k = 0; k < 50 && venc < today; k++) venc = addYearsISO(venc, 1);
  const dias = venc ? diasEntre(today, venc) : null;
  return { prima, recibo: prima / freq, mensual: prima / 12, venc, dias, vencido: !!(venc && venc < today) };
}

/* ---------- Inversiones: posiciones y distribución ---------- */
/** Valor en € de cada posición de una cuenta (por importe o por % del valor de la cuenta) + "Sin asignar". */
function posicionesCuenta(c) {
  const V = Calc.valor(c);
  const ps = S.posiciones.filter(p => p.cuenta_id === c.id).sort(byOrden).map(p => ({
    ...p, val: (p.valor !== null && p.valor !== undefined && p.valor !== '') ? num(p.valor) : num(p.porcentaje) / 100 * V
  }));
  const asignado = sum(ps, 'val'), resto = V - asignado;
  return { V, ps, asignado, resto, exceso: resto < -0.5 };
}
/** Agrega por producto (ISIN o nombre), clase o región, para una o varias cuentas. */
function distribucion(cuentas, por = 'producto') {
  const m = new Map();
  for (const c of cuentas) {
    const { ps, resto } = posicionesCuenta(c);
    for (const p of ps) {
      const k = por === 'producto' ? ((p.isin || '').toUpperCase() || normText(p.nombre)) : por === 'clase' ? (p.clase || 'otro') : (p.region || 'Sin indicar');
      const l = por === 'producto' ? p.nombre : por === 'clase' ? (CLASE_ACTIVO[p.clase] || 'Otro') : (p.region || 'Sin indicar');
      const o = m.get(k) || { k, label: l, isin: p.isin, val: 0 }; o.val += p.val; m.set(k, o);
    }
    if (resto > 0.5) { const o = m.get('_sin') || { k: '_sin', label: 'Sin asignar', val: 0 }; o.val += resto; m.set('_sin', o); }
  }
  const arr = [...m.values()].filter(x => x.val > 0.005).sort((a, b) => b.val - a.val);
  const tot = sum(arr, 'val');
  arr.forEach(x => { x.pct = tot ? x.val / tot : 0; });
  return arr;
}
function isinValido(s) {
  s = String(s || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s)) return false;
  const digits = s.slice(0, 11).split('').map(ch => /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch).join('');
  let tot = 0, dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) { let d = +digits[i]; if (dbl) { d *= 2; if (d > 9) d -= 9; } tot += d; dbl = !dbl; }
  return (10 - (tot % 10)) % 10 === +s[11];
}
/** Total mensual comprometido en aportaciones periódicas activas (opcional: de una cuenta). */
const aportacionMensual = cid => sum(S.aportaciones_periodicas.filter(p => p.activo !== false && (!cid || p.cuenta_id === cid) && (!p.hasta || p.hasta >= todayISO())), 'importe');
