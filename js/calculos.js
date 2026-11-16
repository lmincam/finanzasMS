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
  return {
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
  const gastos = -sum(movs.filter(m => m.tipo === 'gasto'), 'importe');
  // Transferencias: se toma la pata positiva de cada pareja. Si entra en cuenta de inversión/ahorro suma; si vuelve a operativa, resta (retirada).
  const aport = { liquidez: 0, ahorro: 0, inversion: 0 };
  for (const m of movs) {
    if (m.tipo !== 'transferencia' || num(m.importe) <= 0) continue;
    const st = m.subtipo_transferencia || 'liquidez';
    const c = cuentaById(m.cuenta_id);
    if (st === 'liquidez') aport.liquidez += num(m.importe);
    else aport[st] += (c && (c.tipo === 'inversion' || c.tipo === 'ahorro')) ? num(m.importe) : -num(m.importe);
  }
  return { movs, ingresos, gastos, ahorro: ingresos - gastos, aport };
}

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
