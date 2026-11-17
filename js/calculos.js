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
/** Cuenta donde se aparta cada mes la parte de los pagos anuales: la elegida en Cuentas o, si no, la que se llama "Anualidades". */
function cuentaAnualidades() {
  const aj = ((S.ajustesRows || []).find(r => r.clave === 'cuenta_anualidades') || {}).valor;
  if (aj && aj.id) { const c = cuentaById(aj.id); if (c) return c; }
  if (aj && aj.id === '') return null;
  return S.cuentas.find(c => c.activa !== false && normText(c.nombre).includes('anualidad')) || null;
}
const budgetOf = r => num(r.presupuesto_mensual) > 0 ? num(r.presupuesto_mensual) : sum(childrenOf(r.id), 'presupuesto_mensual');
/** Presupuesto anual de una categoría (anualidad: seguro, IBI…). 0 si su presupuesto es mensual. */
const presAnual = c => c && num(c.presupuesto_anual) > 0 ? num(c.presupuesto_anual) : 0;
/** Categoría con presupuesto anual que cubre a esta (ella misma o su principal), o null. */
const catAnualDe = id => { const c = catById(id); if (!c) return null; if (presAnual(c)) return c; const p = c.parent_id ? catById(c.parent_id) : null; return presAnual(p) ? p : null; };
/** Marca manual de gasto fijo (de la categoría o, si no tiene, de su principal): true / false / null (automático). */
const fijoManual = id => { const c = catById(id); if (!c) return null; if (c.gasto_fijo === true || c.gasto_fijo === false) return c.gasto_fijo;
  const p = c.parent_id ? catById(c.parent_id) : null; return p && (p.gasto_fijo === true || p.gasto_fijo === false) ? p.gasto_fijo : null; };
/** Gastado en el año natural del mes indicado (enero → ese mes, por mes de imputación) en esas categorías. */
const gastadoEnAnio = (ids, hastaYm) => { const set = new Set(ids), y = hastaYm.slice(0, 4);
  return round2(-sum(S.movimientos.filter(m => m.tipo === 'gasto' && set.has(m.categoria_id) && mesDe(m) >= y + '-01' && mesDe(m) <= hastaYm), 'importe')); };
const subtipoPorCuenta = c => c ? (c.tipo === 'inversion' ? 'inversion' : c.tipo === 'ahorro' ? 'ahorro' : 'liquidez') : 'liquidez';

/** Milisegundos de una marca de tiempo de Supabase (admite microsegundos, que Safari no siempre entiende). */
const tsMs = t => { const x = String(t).replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/\+00(:?00)?$/, 'Z'); const v = Date.parse(x); return isNaN(v) ? 0 : v; };
const diaAnterior = iso => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) - 1)); return d.toISOString().slice(0, 10); };
const Calc = {
  /** ¿El movimiento es posterior al saldo fijado? Días posteriores siempre; el mismo día, solo si se apuntó después de fijarlo. */
  posterior(m, fecha, ts) {
    if (!fecha || m.fecha > fecha) return true;
    return m.fecha === fecha && !!ts && !!m.created_at && tsMs(m.created_at) > tsMs(ts);
  },
  /** Datos para fijar el saldo real de una cuenta a cierre de un día. Se guarda como saldo del día anterior
   *  descontando los movimientos ya apuntados ese día: así cuentan todos los de ese día, los de antes y los que apuntes después. */
  fijarSaldo(c, saldo, fecha) {
    const delDia = S.movimientos.filter(m => m.cuenta_id === c.id && m.fecha === fecha);
    return { saldo_inicial: round2(num(saldo) - sum(delDia, 'importe')), fecha_saldo_inicial: diaAnterior(fecha),
      ...(S.v7 ? { saldo_actualizado: new Date().toISOString() } : {}) };
  },
  movsDesde(cid, desde, ts) { return S.movimientos.filter(m => m.cuenta_id === cid && this.posterior(m, desde, ts)); },
  /** Saldo contable = saldo de partida + movimientos posteriores. */
  saldo(c) { return round2(num(c.saldo_inicial) + sum(this.movsDesde(c.id, c.fecha_saldo_inicial, c.saldo_actualizado), 'importe')); },
  /** Valor: para inversión usa el valor de mercado + aportaciones posteriores a esa valoración. */
  valor(c) {
    if (c.tipo === 'inversion' && c.valor_mercado !== null && c.valor_mercado !== undefined && c.valor_mercado !== '')
      return round2(num(c.valor_mercado) + sum(this.movsDesde(c.id, c.fecha_valor_mercado || todayISO(), c.valor_actualizado), 'importe'));
    return this.saldo(c);
  },
  /** Capital aportado neto a una cuenta hasta una fecha (incluida). */
  aportadoA(c, fecha) { return round2(num(c.saldo_inicial) + sum(S.movimientos.filter(m => m.cuenta_id === c.id && Calc.posterior(m, c.fecha_saldo_inicial, c.saldo_actualizado) && m.fecha <= fecha), 'importe')); },
  patrimonio() {
    const cuentas = S.cuentas.filter(c => c.activa !== false);
    const det = cuentas.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, valor: this.valor(c) }));
    const liquidez = sum(det.filter(d => d.tipo !== 'inversion'), 'valor');
    const operativa = sum(det.filter(d => d.tipo === 'corriente' || d.tipo === 'efectivo'), 'valor');
    // El dinero apartado para anualidades ya tiene destino: no cuenta como fondo de emergencia
    const ca = cuentaAnualidades(), anualidades = ca ? sum(det.filter(d => d.id === ca.id), 'valor') : 0;
    const reserva = sum(det.filter(d => d.tipo === 'ahorro' && (!ca || d.id !== ca.id)), 'valor');
    const inversiones = sum(det.filter(d => d.tipo === 'inversion'), 'valor');
    const inmuebles = sum(S.inmuebles, 'valor_mercado');
    const vehiculos = sum(S.vehiculos, 'valor_actual');
    const deudas = sum(S.deudas.filter(d => d.activa !== false), d => deudaInfo(d).pendienteHoy);
    const activos = liquidez + inversiones + inmuebles + vehiculos;
    return { liquidez, operativa, reserva, anualidades, inversiones, inmuebles, vehiculos, deudas, activos, neto: activos - deudas, det };
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
/* ---------- Cuotas reales y capital pendiente ----------
   El capital pendiente se calcula cuota a cuota a partir del último dato del banco, usando los cargos reales
   (importe y fecha de cada cuota registrada) y la base de cálculo de intereses del banco:
   - 30/360: interés mensual = pendiente × TIN / 12 (igual todos los meses)
   - act/360 y act/365: interés = pendiente × TIN × días entre cuotas / 360 (o 365): varía según los días del mes */
const BASES_INTERES = { '30/360': 'Mensual fijo (TIN/12)', 'act/360': 'Días reales / 360', 'act/365': 'Días reales / 365' };
const interesPeriodo = (P, tin, base, desde, hasta) => (base === 'act/360' || base === 'act/365')
  ? P * tin * Math.max(0, (Date.parse(hasta) - Date.parse(desde)) / 864e5) / (base === 'act/360' ? 360 : 365) : P * tin / 12;
function cuotaDeuda(d) {
  const r = num(d.interes) / 100 / 12; let cuota = num(d.cuota_mensual);
  if (!cuota) {
    const pagadas = d.fecha_inicio ? Math.max(0, monthsDiff(d.fecha_inicio, todayISO())) : 0, rest = d.plazo_meses ? Math.max(0, num(d.plazo_meses) - pagadas) : 0;
    const tienePend = d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '';
    if (tienePend && rest) cuota = cuotaFrancesa(num(d.capital_pendiente), r, rest);
    else if (num(d.capital_inicial) > 0 && d.plazo_meses) cuota = cuotaFrancesa(num(d.capital_inicial), r, num(d.plazo_meses));
  }
  return cuota;
}
/** Cuotas desde el último dato del banco hasta `hasta` (hoy): [{ fecha, importe, interes, capital, pendiente, ids, real }] y el pendiente final. */
function ledgerDeuda(d, base = d.base_interes || '30/360', hasta = todayISO()) {
  const key = `L|${d.id}|${base}|${hasta}`;
  if (_deudaCache.has(key)) return _deudaCache.get(key);
  const tin = num(d.interes) / 100, cuota = cuotaDeuda(d);
  const tienePend = d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '';
  let P = tienePend ? num(d.capital_pendiente) : num(d.capital_inicial);
  const f0 = tienePend ? (d.fecha_capital_pendiente || hasta) : (d.fecha_inicio ? addDias(addMonths(ymOf(d.fecha_inicio), -1) + d.fecha_inicio.slice(7), 0) : hasta);
  const cat = categoriaCuota(d);
  const todos = cat ? S.movimientos.filter(m => m.tipo === 'gasto' && m.categoria_id === cat && num(m.importe) < 0).sort((a, b) => a.fecha < b.fecha ? -1 : 1) : [];
  const diaHab = todos.length ? Math.round(median(todos.slice(-12).map(m => +m.fecha.slice(8, 10)))) : +((d.fecha_inicio || f0).slice(8, 10));
  const diaEn = ym => { const [y, mo] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(diaHab, daysInMonth(y, mo)))}`; };
  // Desde cuándo corren los intereses de la primera cuota: la última cuota pagada antes del dato del banco
  const antes = todos.filter(m => m.fecha <= f0).pop();
  let prev = antes && diasEntre(antes.fecha, f0) <= 40 ? antes.fecha : (diaEn(ymOf(f0)) <= f0 ? diaEn(ymOf(f0)) : diaEn(addMonths(ymOf(f0), -1)));
  const pagos = [];
  for (let ym = ymOf(f0); ym <= ymOf(hasta) && P > 0.005; ym = addMonths(ym, 1)) {
    const reales = todos.filter(m => ymOf(m.fecha) === ym && m.fecha > f0 && m.fecha <= hasta);
    let fecha, importe, ids = [], real = true;
    if (reales.length) { fecha = reales[0].fecha; importe = -sum(reales, 'importe'); ids = reales.map(m => m.id); }
    else { fecha = diaEn(ym); real = false; importe = cuota; if (!(fecha > f0 && fecha <= hasta) || !cuota) continue; }
    const interes = interesPeriodo(P, tin, base, prev, fecha), capital = Math.max(0, Math.min(P, importe - interes));
    P -= capital; prev = fecha;
    pagos.push({ fecha, importe, interes: round2(interes), capital: round2(capital), pendiente: round2(P), ids, real });
  }
  const out = { pagos, pendiente: round2(Math.max(0, P)), base };
  _deudaCache.set(key, out);
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
  const cuota = cuotaDeuda(d);
  const meses = Math.max(0, monthsDiff(refDate, today));
  // Pendiente de hoy: cuota a cuota desde el último dato del banco, con los cargos reales registrados
  const P = (num(d.interes) > 0 || cuota) ? ledgerDeuda(d).pendiente : round2(P0);
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
/* ---------- Mes de nómina ----------
   Cada "mes" va del día en que cobras la nómina al día antes del siguiente cobro:
   "Noviembre" = 28 oct → 27 nov si la nómina de noviembre llega el 28 de octubre.
   Así los gastos de los últimos días de octubre (pagados ya con esa nómina) cuentan en noviembre. */
const addDias = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };
const mesNominaActivo = () => S.ajustes.mes_nomina !== false;
let _ciclos = null;
/** Inicio de cada mes de nómina detectado: { 'AAAA-MM': 'AAAA-MM-DD' } y el desfase habitual para los meses sin cobro detectado. */
function ciclosNomina() {
  const key = S.movimientos.length + '|' + (S.movimientos[0] || {}).id + '|' + S.ajustes.nomina_umbral + '|' + S.categorias.length + '|' + todayISO();
  if (_ciclos && _ciclos.key === key && _ciclos.ref === S.movimientos) return _ciclos;
  const umbral = Math.max(300, num(S.ajustes.nomina_umbral));
  const esNomina = m => m.tipo === 'ingreso' && num(m.importe) > 0 && (num(m.importe) >= umbral || /nomina/.test(normText(catName(m.categoria_id) || '')));
  const inicio = {};
  for (const m of S.movimientos) {
    if (!esNomina(m)) continue;
    // Mes que paga: el imputado (regla de nómina) o, si no se movió, el siguiente cuando se cobra a partir del día 20
    const ym = ymOf(m.mes_imputacion) !== ymOf(m.fecha) ? ymOf(m.mes_imputacion) : (+m.fecha.slice(8, 10) >= 20 ? addMonths(ymOf(m.fecha), 1) : ymOf(m.fecha));
    // solo cobros cercanos al cambio de mes (del día 15 del mes anterior al 15 de ese mes)
    if (m.fecha < addMonths(ym, -1) + '-15' || m.fecha > ym + '-15') continue;
    if (!inicio[ym] || m.fecha < inicio[ym]) inicio[ym] = m.fecha;
  }
  // Día habitual de cobro: p. ej. el 27 del mes anterior (o el 1 del propio mes si cobras a principios)
  const antes = Object.entries(inicio).filter(([ym, f]) => ymOf(f) < ym).map(([, f]) => +f.slice(8, 10));
  const despues = Object.entries(inicio).filter(([ym, f]) => ymOf(f) === ym).map(([, f]) => +f.slice(8, 10));
  const desfase = antes.length >= despues.length && antes.length ? { prev: true, dia: Math.round(median(antes)) } : { prev: false, dia: despues.length ? Math.round(median(despues)) : 1 };
  const detectados = Object.keys(inicio).sort();
  _ciclos = { key, ref: S.movimientos, inicio, desfase, ultimo: detectados[detectados.length - 1] || null, memo: new WeakMap() };
  return _ciclos;
}
/** Primer día del mes de nómina ym (detectado, o estimado con el día habitual de cobro). */
function inicioCiclo(ym) {
  if (!mesNominaActivo()) return ym + '-01';
  const C = ciclosNomina();
  if (C.inicio[ym]) return C.inicio[ym];
  const base = C.desfase.prev ? addMonths(ym, -1) : ym, [by, bm] = base.split('-').map(Number);
  let f = `${base}-${pad(Math.min(C.desfase.dia, daysInMonth(by, bm)))}`;
  // Si aún no ha llegado la nómina que abre este mes, el mes anterior sigue abierto hasta que llegue
  const hoy = todayISO();
  if (C.ultimo && ym > C.ultimo && f <= hoy) f = addDias(hoy, 1);
  return f;
}
/** Rango del mes de nómina: { ini, fin } (fin = día antes del siguiente cobro, estimado si aún no ha llegado). */
const rangoCiclo = ym => ({ ini: inicioCiclo(ym), fin: addDias(inicioCiclo(addMonths(ym, 1)), -1) });
/** Mes de nómina al que pertenece una fecha. */
function cicloDe(fecha) {
  let ym = ymOf(fecha);
  if (!mesNominaActivo()) return ym;
  if (fecha >= inicioCiclo(addMonths(ym, 1))) return addMonths(ym, 1);
  if (fecha < inicioCiclo(ym)) return addMonths(ym, -1);
  return ym;
}
/** Mes actual (de nómina). */
const mesActual = () => cicloDe(todayISO());
/** Mes contable de un movimiento. Si se imputó a mano (o por la regla) a otro mes, manda eso; si no, su mes de nómina.
 *  Una devolución (Bizum de un gasto compartido) va al mismo mes que el gasto que devuelve. */
function mesDe(m) {
  if (m.reembolso_de) { const o = S.movimientos.find(x => x.id === m.reembolso_de); if (o && o !== m) return mesDe(o); }
  const imp = ymOf(m.mes_imputacion);
  if (!mesNominaActivo() || imp !== ymOf(m.fecha)) return imp;
  const C = ciclosNomina(), c = C.memo.get(m);
  if (c && c[0] === m.fecha && c[1] === m.mes_imputacion) return c[2];
  const r = cicloDe(m.fecha); C.memo.set(m, [m.fecha, m.mes_imputacion, r]); return r;
}
const fmtRango = ym => { const r = rangoCiclo(ym); return `${fmtDate(r.ini).slice(0, 5)} – ${fmtDate(r.fin).slice(0, 5)}`; };

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
  const movs = S.movimientos.filter(m => set.has(mesDe(m)));
  const ingresos = sum(movs.filter(m => m.tipo === 'ingreso'), 'importe');
  const gastosCaja = -sum(movs.filter(m => m.tipo === 'gasto'), 'importe');
  // La parte de capital de las cuotas de préstamos y las amortizaciones anticipadas no es gasto: reduce deuda (ahorro)
  let capital = 0;
  for (const m of movs) if (m.tipo === 'gasto' && num(m.importe) < 0) capital += capitalDeMovimiento(m);
  const gastos = gastosCaja - capital;
  // Transferencias: se toma la pata positiva de cada pareja. Si entra en cuenta de inversión/ahorro suma; si vuelve a operativa, resta (retirada).
  // Lo que va a la cuenta de anualidades se separa: es dinero apartado para pagos anuales, no ahorro.
  const aport = { liquidez: 0, ahorro: 0, inversion: 0, anualidades: 0 }, ca = cuentaAnualidades();
  for (const m of movs) {
    if (m.tipo !== 'transferencia' || num(m.importe) <= 0) continue;
    const st = m.subtipo_transferencia || 'liquidez';
    const c = cuentaById(m.cuenta_id);
    if (ca && m.cuenta_id === ca.id) aport.anualidades += num(m.importe);
    else if (ca && m.cuenta_contraria_id === ca.id) aport.anualidades -= num(m.importe);
    else if (st === 'liquidez') aport.liquidez += num(m.importe);
    else aport[st] += (c && (c.tipo === 'inversion' || c.tipo === 'ahorro')) ? num(m.importe) : -num(m.importe);
  }
  // ahorro = capacidad de ahorro LÍQUIDA: lo que entra menos todo lo que sale de las cuentas (la parte de capital de la cuota
  // ya no está en la cuenta: se ha convertido en vivienda). ahorroPatrimonial = ingresos − gastos operativos (incluye ese capital).
  return { movs, ingresos, gastos, gastosCaja, capital, ahorro: ingresos - gastosCaja, ahorroCaja: ingresos - gastosCaja, ahorroPatrimonial: ingresos - gastos, aport };
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
  // Si la cuota está en el cuadro calculado desde el último dato del banco, se usa ese reparto (el mismo que da el pendiente)
  const e = ledgerDeuda(d).pagos.find(p => p.ids.includes(m.id));
  if (e) return e.importe ? round2(e.capital * abs / e.importe) : 0;
  // La cuota que deja el capital en el dato del banco (copiado justo después de pagarla): se deduce hacia atrás
  const tiene = d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '';
  if (tiene && d.fecha_capital_pendiente && m.fecha <= d.fecha_capital_pendiente && diasEntre(m.fecha, d.fecha_capital_pendiente) <= 25) {
    const base = d.base_interes || '30/360', tin = num(d.interes) / 100;
    const ant = S.movimientos.filter(x => x.tipo === 'gasto' && x.categoria_id === m.categoria_id && num(x.importe) < 0 && x.fecha < m.fecha).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0];
    const rate = interesPeriodo(1, tin, base, ant && diasEntre(ant.fecha, m.fecha) <= 40 ? ant.fecha : addDias(m.fecha, -30), m.fecha);
    return round2(Math.max(0, Math.min(abs, (abs - num(d.capital_pendiente) * rate) / (1 + rate))));
  }
  const interes = Math.min(abs, pendienteEnMes(d, ymOf(m.fecha)) * I.r);
  return Math.max(0, abs - interes);
}
/** Saldo de una cuenta al final de un día (null si es anterior al saldo de partida). */
Calc.saldoA = (c, fecha) => fecha < c.fecha_saldo_inicial ? null : round2(num(c.saldo_inicial) + sum(S.movimientos.filter(m => m.cuenta_id === c.id && Calc.posterior(m, c.fecha_saldo_inicial, c.saldo_actualizado) && m.fecha <= fecha), 'importe'));

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

/* ---------- Rentabilidad real de las inversiones (TIR / XIRR) ---------- */
/** TIR anualizada de una serie de flujos [{fecha, importe}] (negativo = dinero que pones, positivo = valor o retirada). */
function xirr(flows) {
  const fs = flows.filter(x => x.importe && x.fecha).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  if (fs.length < 2 || !fs.some(x => x.importe < 0) || !fs.some(x => x.importe > 0)) return null;
  const t0 = isoToUTC(fs[0].fecha), Y = 365.25 * 86400000;
  const f = r => fs.reduce((s, x) => s + x.importe / Math.pow(1 + r, (isoToUTC(x.fecha) - t0) / Y), 0);
  let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  let mid = 0;
  for (let i = 0; i < 300; i++) {
    mid = (lo + hi) / 2; const fm = f(mid);
    if (Math.abs(fm) < 1e-6) break;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return mid;
}
/** Flujos de una cuenta de inversión: punto de partida (primera valoración o capital aportado de partida),
 *  aportaciones y retiradas posteriores, y su valor de hoy como flujo final. */
function flujosInversion(c) {
  const vals = (S.valoraciones || []).filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  let desde, inicial;
  if (vals.length && vals[0].fecha <= c.fecha_saldo_inicial) { desde = vals[0].fecha; inicial = num(vals[0].valor); }
  else if (vals.length && !num(c.saldo_inicial)) { desde = vals[0].fecha; inicial = num(vals[0].valor); }
  else { desde = c.fecha_saldo_inicial; inicial = num(c.saldo_inicial); }
  const fl = [];
  if (inicial) fl.push({ fecha: desde, importe: -inicial });
  for (const m of S.movimientos) if (m.cuenta_id === c.id && m.tipo === 'transferencia' && m.fecha > desde) fl.push({ fecha: m.fecha, importe: -num(m.importe) });
  return { desde, flujos: fl, valorHoy: Calc.valor(c) };
}
/** Rentabilidad anualizada (TIR) de una o varias cuentas de inversión. */
function tirInversion(cuentas) {
  const hoy = todayISO(); let fl = [], desde = hoy, valor = 0;
  for (const c of cuentas) { const x = flujosInversion(c); fl = fl.concat(x.flujos); valor += x.valorHoy; if (x.desde < desde) desde = x.desde; }
  const dias = diasEntre(desde, hoy);
  if (!valor || dias < 90) return { tir: null, dias, desde, motivo: 'Necesita al menos 3 meses de historia (valoraciones o aportaciones)' };
  const t = xirr(fl.concat([{ fecha: hoy, importe: valor }]));
  return { tir: t, dias, desde, motivo: t === null ? 'No se puede calcular con estos datos' : null };
}
