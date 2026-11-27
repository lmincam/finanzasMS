'use strict';
/* =====================================================================
   EXPORTAR PARA CLAUDE
   ---------------------------------------------------------------------
   Genera un informe en Markdown con toda la foto financiera de la familia
   (patrimonio, cuentas, inversiones, inmuebles, vehículos, deudas,
   ingresos y gastos de 12 meses por categoría, presupuestos, seguros,
   metas, partidas previstas y evolución) para analizarlo con Claude.
   No incluye datos identificativos: ni IBAN, ni matrículas, ni nº de
   póliza, ni direcciones, ni referencias catastrales.
   Depende de: calculos.js, alertas.js, metas.js, pertenencias.js, ui.js
   ===================================================================== */

const EXP_MESES = 12;

/** Formato compacto para el informe (sin símbolo de miles raro ni HTML). */
const xE = (n, d = 0) => (n === null || n === undefined || !isFinite(n)) ? '—' : fmtEUR(n, d);
const xP = (x, d = 1) => fmtPct(x, d);
const xT = s => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim() || '—';
const tabla = (cab, filas) => filas.length
  ? `| ${cab.join(' | ')} |\n|${cab.map(() => '---').join('|')}|\n${filas.map(f => `| ${f.map(xT).join(' | ')} |`).join('\n')}\n`
  : '_Sin datos._\n';
/** Cada sección se genera por separado: si una falla (tabla que no existe…), el resto sale igual. */
let _secN = 0;
function seccion(titulo, fn) {
  titulo = titulo.replace(/^\d+\.\s*/, '');
  try { const c = fn(); return c ? `\n## ${++_secN}. ${titulo}\n\n${c}` : ''; }
  catch (e) { console.warn('Exportar:', titulo, e); return `\n## ${++_secN}. ${titulo}\n\n_No se pudo generar (${xT(e.message || e)})._\n`; }
}
/** Meses con datos completos para las medias: se descartan los que no tienen ingresos (p. ej. el primer mes, registrado a medias). */
const mesesCompletos = meses => meses.filter(ym => periodStats([ym]).ingresos > 0);
/** Indicadores clave que se guardan en cada exportación para comparar en la siguiente. */
function indicadoresExport(meses) {
  const P = Calc.patrimonio(), mc = mesesCompletos(meses), n = mc.length || 1;
  const st = mc.map(ym => periodStats([ym])), ing = sum(st, 'ingresos') / n, gas = sum(st, 'gastosCaja') / n;
  const cats = {};
  for (const m of S.movimientos) if (m.tipo === 'gasto' && mc.includes(mesDe(m))) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.nombre : 'Sin categoría'; cats[k] = round2((cats[k] || 0) - num(m.importe) / n); }
  return { fecha: todayISO(), version: APP_VERSION, neto: round2(P.neto), liquidez: round2(P.liquidez), inversiones: round2(P.inversiones), deudas: round2(P.deudas),
    ingresosMes: round2(ing), gastosMes: round2(gas), tasaAhorro: ing ? round2((ing - gas) / ing * 1000) / 1000 : null, meses: mc.length, cats };
}
const expPrevio = () => { const r = (S.ajustesRows || []).find(x => x.clave === 'export_ultimo'); return r && r.valor && r.valor.fecha ? r.valor : null; };
async function guardarIndicadoresExport() {
  try { const valor = S._expInd; if (!valor) return; await DB.upsert('ajustes', { clave: 'export_ultimo', valor, updated_at: new Date().toISOString() }, 'clave');
    S.ajustesRows = (S.ajustesRows || []).filter(r => r.clave !== 'export_ultimo').concat([{ clave: 'export_ultimo', valor }]); } catch (e) { console.warn('export_ultimo', e); }
}

function informeClaude({ movimientos = false } = {}) {
  const hoy = todayISO(), mA = mesActual();
  // Últimos 12 meses cerrados, sin contar los anteriores al primer movimiento (no hay datos y bajarían las medias)
  const primero = S.movimientos.reduce((a, m) => { const ym = mesDe(m); return ym && (!a || ym < a) ? ym : a; }, null);
  let meses = Array.from({ length: EXP_MESES }, (_, i) => addMonths(mA, i - EXP_MESES)).filter(ym => !primero || ym >= primero);
  if (!meses.length) meses = [addMonths(mA, -1)];
  const P = Calc.patrimonio(), mc = mesesCompletos(meses), nC = mc.length || 1, prev = expPrevio();
  _secN = 0; S._expInd = indicadoresExport(meses);
  let md = `# Finanzas familiares · Patrimonio Miñán Sánchez

Exportado el ${fmtDate(hoy)} desde la app (versión ${APP_VERSION}).

> **Para Claude:** analiza estos datos como asesor financiero familiar. Da un diagnóstico claro (qué va bien, qué es un riesgo), compara con referencias razonables para una familia española joven y termina con un plan de acción priorizado y con cifras (qué hacer este mes, este trimestre y este año). Contexto:
> - Importes en euros. Cada "mes" es un **mes de nómina** (del día de cobro al día antes del siguiente cobro), no un mes natural.
> - **Ahorro líquido** = ingresos − todo lo que sale de las cuentas. El capital amortizado de los préstamos no cuenta como ahorro disponible (se convierte en vivienda).
> - Los gastos ya descuentan lo devuelto por gastos compartidos (Bizum).
> - Las pertenencias del hogar no suman al patrimonio neto (se dan aparte).
> - Historial de movimientos desde ${primero ? ymLabel(primero) : '—'}: las medias usan ${mc.length} mes(es) cerrado(s) completo(s)${mc.length < meses.length ? ` (se descartan ${meses.length - mc.length} sin ingresos registrados, p. ej. el primer mes a medias)` : ''}.
> - Préstamos: intereses de cada recibo = pendiente × TIN × días reales entre recibos / 365 (comprobado con los recibos del banco).
> - ${prev ? `Hay una exportación anterior (${fmtDate(prev.fecha)}): la sección «Cambios desde la última exportación» resume la evolución; coméntala.` : 'Es la **primera exportación**: sus indicadores quedan guardados como punto de partida para comparar en las siguientes.'}
`;

  if (prev) md += seccion('Cambios desde la última exportación', () => {
    const a = S._expInd, d = (x, y) => (x === null || y === null || x === undefined || y === undefined) ? '—' : (x - y >= 0 ? '+' : '−') + xE(Math.abs(x - y));
    const meses = Math.max(1, Math.round(diasEntre(prev.fecha, hoy) / 30.4));
    let t = `Desde el ${fmtDate(prev.fecha)} (unos ${meses} mes(es)).\n\n` + tabla(['Indicador', 'Antes', 'Ahora', 'Cambio'], [
      ['Patrimonio neto', xE(prev.neto), xE(a.neto), d(a.neto, prev.neto)], ['Liquidez', xE(prev.liquidez), xE(a.liquidez), d(a.liquidez, prev.liquidez)],
      ['Inversiones', xE(prev.inversiones), xE(a.inversiones), d(a.inversiones, prev.inversiones)], ['Deudas', xE(prev.deudas), xE(a.deudas), d(a.deudas, prev.deudas)],
      ['Ingresos medios/mes', xE(prev.ingresosMes), xE(a.ingresosMes), d(a.ingresosMes, prev.ingresosMes)], ['Gastos medios/mes', xE(prev.gastosMes), xE(a.gastosMes), d(a.gastosMes, prev.gastosMes)],
      ['Tasa de ahorro', xP(prev.tasaAhorro, 0), xP(a.tasaAhorro, 0), prev.tasaAhorro !== null && a.tasaAhorro !== null ? `${a.tasaAhorro >= prev.tasaAhorro ? '+' : '−'}${fmtNum(Math.abs(a.tasaAhorro - prev.tasaAhorro) * 100, 1)} pp` : '—']]);
    const ks = [...new Set([...Object.keys(prev.cats || {}), ...Object.keys(a.cats)])].map(k => [k, num((prev.cats || {})[k]), num(a.cats[k])]).filter(x => Math.abs(x[2] - x[1]) >= 10).sort((x, y) => Math.abs(y[2] - y[1]) - Math.abs(x[2] - x[1])).slice(0, 8);
    if (ks.length) t += '\n**Gasto medio por categoría que más ha cambiado**\n\n' + tabla(['Categoría', 'Antes/mes', 'Ahora/mes', 'Cambio'], ks.map(([k, x, y]) => [k, xE(x), xE(y), d(y, x)]));
    return t;
  });


  md += seccion('1. Patrimonio neto hoy', () => tabla(['Concepto', 'Importe', '% de activos'], [
    ['Liquidez (cuentas, ahorro, efectivo)', xE(P.liquidez), xP(P.activos ? P.liquidez / P.activos : null, 0)],
    ['· de ella, fondo de emergencia / ahorro', xE(P.reserva), ''],
    ['· de ella, apartado para pagos anuales', xE(P.anualidades), ''],
    ['Inversiones', xE(P.inversiones), xP(P.activos ? P.inversiones / P.activos : null, 0)],
    ['Inmuebles (valor de venta estimado)', xE(P.inmuebles), xP(P.activos ? P.inmuebles / P.activos : null, 0)],
    ['Vehículos', xE(P.vehiculos), xP(P.activos ? P.vehiculos / P.activos : null, 0)],
    ['**Total activos**', xE(P.activos), '100 %'],
    ['Deudas pendientes', '−' + xE(P.deudas), xP(P.activos ? P.deudas / P.activos : null, 0)],
    ['**Patrimonio neto**', xE(P.neto), '']
  ]));

  md += seccion('2. Cuentas', () => tabla(['Cuenta', 'Entidad', 'Tipo', 'Saldo / valor'],
    S.cuentas.filter(c => c.activa !== false).sort(byOrden).map(c => {
      const ca = cuentaAnualidades();
      return [c.nombre + (ca && ca.id === c.id ? ' (anualidades)' : ''), c.entidad, TIPO_CUENTA[c.tipo] || c.tipo, xE(Calc.valor(c))];
    })));

  md += seccion('3. Inversiones', () => {
    const inv = S.cuentas.filter(c => c.tipo === 'inversion' && c.activa !== false);
    if (!inv.length) return '_Sin cuentas de inversión._\n';
    let s = tabla(['Cuenta', 'Valor', 'Aportado', 'Ganancia', 'Rentab.', 'Aportado 12 m', 'Aportación periódica/mes'], inv.map(c => {
      const x = invInfo(c);
      return [c.nombre, xE(x.valor), xE(x.aportado), xE(x.plus), xP(x.rent), xE(x.ap12), xE(aportacionMensual(c.id))];
    }));
    try { const t = tirInversion(inv); if (t && t.tir !== null && isFinite(t.tir)) s += `\nTIR anual conjunta (dinero ponderado): ${xP(t.tir)}${t.dias < 365 ? ` · ojo: solo ${t.dias} días de historia, la cifra anualizada exagera` : ''}\n`; } catch (e) { /* opcional */ }
    const pos = (S.posiciones || []).filter(p => inv.some(c => c.id === p.cuenta_id));
    if (pos.length) {
      s += '\n**Productos**\n\n' + tabla(['Cuenta', 'Producto', 'ISIN', 'Tipo', 'Clase', 'Región', '% reparto'], pos.map(p => [
        (cuentaById(p.cuenta_id) || {}).nombre, p.nombre, p.isin, TIPO_ACTIVO[p.tipo_activo] || p.tipo_activo, CLASE_ACTIVO[p.clase] || p.clase, p.region,
        num(p.porcentaje) ? fmtNum(num(p.porcentaje), 1) + ' %' : (num(p.valor) ? xE(num(p.valor)) : '—')]));
    }
    return s;
  });

  md += seccion('4. Inmuebles', () => S.inmuebles.length ? tabla(
    ['Inmueble', 'Compra', 'Coste total', 'Valor actual', 'Plusvalía', 'Deuda', 'Neto', 'LTV', 'm² const.', 'Renta/mes', 'Gastos/año (IBI, comunidad, seguro, mant.)'],
    S.inmuebles.map(i => { const x = inmuebleInfo(i); return [i.nombre, i.fecha_compra ? fmtDate(i.fecha_compra) : '—', xE(x.coste), xE(x.vm), xE(x.plusvalia), xE(x.deuda), xE(x.neto),
      xP(x.ltv, 0), i.metros_construidos || '—', x.renta ? xE(x.renta) : '—', xE(x.gastos)]; })) : '_Sin inmuebles._\n');

  md += seccion('5. Vehículos', () => S.vehiculos.length ? tabla(['Vehículo', 'Tipo', 'Año', 'Compra', 'Precio compra', 'Valor actual', 'Km', 'Seguro/año', 'Impuesto/año', 'Mantenimiento últimos 12 m'],
    S.vehiculos.map(v => { const segs = (S.seguros || []).filter(x => x.vehiculo_id === v.id && x.activo !== false), seg = segs.length ? sum(segs, x => seguroInfo(x).prima) : num(v.gasto_seguro);
      const desde = addDias(hoy, -365), mant = sum((S.mantenimientos || []).filter(m => m.vehiculo_id === v.id && m.fecha >= desde), m => num(m.coste ?? m.importe));
      return [v.nombre + (v.marca_modelo ? ` (${v.marca_modelo})` : ''), v.tipo, v.anio, v.fecha_compra ? fmtDate(v.fecha_compra) : '—', xE(num(v.valor_compra)), xE(num(v.valor_actual)),
        v.km ? fmtNum(num(v.km), 0) : '—', seg ? xE(seg, 2) : '—', num(v.gasto_impuesto) ? xE(num(v.gasto_impuesto), 2) : '—', mant ? xE(mant, 2) : (num(v.gasto_mantenimiento) ? xE(num(v.gasto_mantenimiento)) + ' (estimado/año)' : '—')]; })) : '_Sin vehículos._\n');

  md += seccion('6. Deudas', () => {
    const ds = S.deudas.filter(d => d.activa !== false);
    if (!ds.length) return '_Sin deudas._\n';
    return tabla(['Préstamo', 'Tipo', 'Entidad', 'Capital inicial', 'Inicio', 'TIN', 'Cuota/mes', 'Pendiente hoy', '% amortizado', 'Cuotas restantes', 'Fin previsto', 'Intereses que quedan', 'Comisión amort. anticipada'],
      ds.map(d => { const x = deudaInfo(d); return [d.nombre, TIPO_DEUDA[d.tipo] || d.tipo, d.entidad, xE(num(d.capital_inicial)), d.fecha_inicio ? fmtDate(d.fecha_inicio) : '—',
        num(d.interes) ? fmtNum(num(d.interes), 2) + ' %' : '—', xE(x.cuota, 2), xE(x.pendienteHoy), xP(x.pctAmort, 0), x.restantes ?? '—', x.fin ? ymLabel(x.fin) : '—',
        xE(x.interesesPendientes), d.comision_amortizacion !== null && d.comision_amortizacion !== undefined && d.comision_amortizacion !== '' ? fmtNum(num(d.comision_amortizacion), 2) + ' %' : '—']; }))
      + '\n**Últimos 12 meses (recibos cobrados)**\n\n' + tabla(['Préstamo', 'Dato del banco', 'Recibos', 'Pagado', 'de ello intereses', 'de ello capital'], ds.map(d => {
        const desde = addDias(hoy, -365), cat = categoriaCuota(d);
        const ms = cat ? S.movimientos.filter(m => m.tipo === 'gasto' && m.categoria_id === cat && num(m.importe) < 0 && m.fecha >= desde && deudaDeMovimiento(m) === d) : [];
        const pag = -sum(ms, 'importe'), cap = sum(ms, m => capitalDeMovimiento(m));
        return [d.nombre, d.capital_pendiente !== null && d.capital_pendiente !== undefined && d.capital_pendiente !== '' ? `${xE(num(d.capital_pendiente), 2)} a ${d.fecha_capital_pendiente ? fmtDate(d.fecha_capital_pendiente) : '—'}` : '—',
          ms.length, xE(pag, 2), xE(pag - cap, 2), xE(cap, 2)]; }));
  });

  md += seccion(`7. Ingresos, gastos y ahorro (últimos ${meses.length} meses de nómina cerrados + el actual)`, () => {
    const filas = [], tot = { ing: 0, gc: 0, cap: 0, inv: 0, aho: 0 };
    for (const ym of [...meses, mA]) {
      const st = periodStats([ym]), abierto = ym === mA;
      const incompleto = !abierto && !mc.includes(ym);
      if (!abierto && !incompleto) { tot.ing += st.ingresos; tot.gc += st.gastosCaja; tot.cap += st.capital; tot.inv += st.aport.inversion; tot.aho += st.aport.ahorro; }
      filas.push([ymLabel(ym) + (abierto ? ' (en curso)' : incompleto ? ' (incompleto, fuera de medias)' : ''), xE(st.ingresos), xE(st.gastosCaja), xE(st.capital), xE(st.ahorroCaja), xP(st.ingresos ? st.ahorroCaja / st.ingresos : null, 0), xE(st.aport.ahorro), xE(st.aport.inversion)]);
    }
    const n = nC;
    filas.push([`**Media ${n} meses cerrados**`, xE(tot.ing / n), xE(tot.gc / n), xE(tot.cap / n), xE((tot.ing - tot.gc) / n), xP(tot.ing ? (tot.ing - tot.gc) / tot.ing : null, 0), xE(tot.aho / n), xE(tot.inv / n)]);
    return tabla(['Mes', 'Ingresos', 'Gastos (salidas)', 'de ellos, capital amortizado', 'Ahorro líquido', 'Tasa ahorro', 'A cuentas de ahorro', 'A inversión'], filas);
  });

  md += seccion(`8. Gasto por categoría (${nC} meses cerrados completos)`, () => {
    const meses = mc.length ? mc : [addMonths(mA, -1)];
    const ult3 = meses.slice(-3), roots = S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).sort(byOrden);
    const gasto = (ids, ms) => { const set = new Set(ms), idSet = new Set(ids);
      return -sum(S.movimientos.filter(m => m.tipo === 'gasto' && idSet.has(m.categoria_id) && set.has(mesDe(m))), 'importe'); };
    const totalG = -sum(S.movimientos.filter(m => m.tipo === 'gasto' && new Set(meses).has(mesDe(m))), 'importe'), filas = [];
    for (const r of roots) {
      const subs = childrenOf(r.id), ids = [r.id, ...subs.map(c => c.id)];
      const t12 = gasto(ids, meses); const pres = budgetOf(r), pa = presAnual(r);
      if (!t12 && !pres && !pa) continue;
      const med = t12 / meses.length, ref = pres || (pa ? pa / 12 : 0);
      filas.push([`**${r.nombre}**`, xE(t12), xE(med), xP(totalG ? t12 / totalG : null, 0), xE(gasto(ids, ult3) / ult3.length), pres ? xE(pres) : (pa ? xE(pa) + '/año' : '—'), ref ? (med - ref >= 0 ? '+' : '−') + xE(Math.abs(med - ref)) : '—', esGastoFijoSafe(r.id, mA)]);
      for (const c of subs) {
        const s12 = gasto([c.id], meses); if (!s12 && !num(c.presupuesto_mensual) && !presAnual(c)) continue;
        const cm = s12 / meses.length, cr = num(c.presupuesto_mensual) || (presAnual(c) ? presAnual(c) / 12 : 0);
        filas.push([`· ${c.nombre}`, xE(s12), xE(cm), xP(totalG ? s12 / totalG : null, 0), xE(gasto([c.id], ult3) / ult3.length), num(c.presupuesto_mensual) ? xE(num(c.presupuesto_mensual)) : (presAnual(c) ? xE(presAnual(c)) + '/año' : '—'), cr ? (cm - cr >= 0 ? '+' : '−') + xE(Math.abs(cm - cr)) : '—', esGastoFijoSafe(c.id, mA)]);
      }
    }
    const sinCat = -sum(S.movimientos.filter(m => m.tipo === 'gasto' && !m.categoria_id && new Set(meses).has(mesDe(m))), 'importe');
    if (sinCat) filas.push(['Sin categoría', xE(sinCat), xE(sinCat / meses.length), xP(totalG ? sinCat / totalG : null, 0), '—', '—', '—', '—']);
    return tabla(['Categoría', `Total ${meses.length} m`, 'Media/mes', '% del gasto', `Media últimos ${Math.min(3, meses.length)} m`, 'Presupuesto/mes', 'Media vs presupuesto', '¿Fijo?'], filas);
  });

  md += seccion(`9. Ingresos por categoría (${nC} meses cerrados completos)`, () => {
    const meses = mc.length ? mc : [addMonths(mA, -1)], set = new Set(meses), mapa = new Map();
    for (const m of S.movimientos) if (m.tipo === 'ingreso' && set.has(mesDe(m))) { const r = rootOf(catById(m.categoria_id)); const k = r ? r.nombre : 'Sin categoría'; mapa.set(k, (mapa.get(k) || 0) + num(m.importe)); }
    return tabla(['Categoría', `Total ${meses.length} m`, 'Media/mes'], [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, xE(v), xE(v / meses.length)]));
  });

  md += seccion('10. Seguros', () => {
    const ss = (S.seguros || []).filter(s => s.activo !== false);
    if (!ss.length) return '_Sin seguros registrados._\n';
    return tabla(['Seguro', 'Tipo', 'Aseguradora', 'Prima anual', 'Pago', 'Vence', 'Capital asegurado', 'Franquicia', 'Coberturas'], ss.map(s => { const x = seguroInfo(s);
      return [s.nombre, (TIPO_SEGURO[s.tipo] || s.tipo || '').replace(/^\S+\s/, ''), s.aseguradora, xE(x.prima, 2), s.forma_pago, x.venc ? fmtDate(x.venc) : '—',
        num(s.capital_asegurado) ? xE(num(s.capital_asegurado)) : '—', num(s.franquicia) ? xE(num(s.franquicia)) : '—', String(s.coberturas || '').slice(0, 140)]; }))
      + `\nTotal en seguros: ${xE(sum(ss, s => seguroInfo(s).prima), 2)}/año (${xE(sum(ss, s => seguroInfo(s).prima) / 12, 2)}/mes)\n`;
  });

  md += seccion('11. Metas de ahorro', () => {
    const ms = (S.metas || []);
    if (!ms.length) return '_Sin metas._\n';
    return tabla(['Meta', 'Objetivo', 'Ahorrado', '% hecho', 'Fecha objetivo', 'Necesario/mes', 'Ritmo real/mes', 'Estado'], ms.map(m => { const x = metaInfo(m);
      return [m.nombre, xE(x.obj), xE(x.ahorrado), xP(x.pct, 0), m.fecha_objetivo ? fmtDate(m.fecha_objetivo) : '—', x.necesariaMes !== null ? xE(x.necesariaMes) : '—', xE(x.ritmo), (ESTADO_META[x.estado] || ['', x.estado])[1]]; }));
  });

  md += seccion('12. Partidas previstas (pagos e ingresos futuros)', () => {
    const ps = (S.partidas_previstas || []).filter(p => p.activa !== false && (!p.fecha_fin || p.fecha_fin >= hoy));
    if (!ps.length) return '';
    return tabla(['Concepto', 'Tipo', 'Importe', 'Cada (meses)', 'Desde', 'Hasta', 'Categoría'], ps.map(p => [p.concepto, p.tipo, xE(num(p.importe), 2),
      num(p.frecuencia_meses) || 'una vez', p.fecha_inicio ? fmtDate(p.fecha_inicio) : '—', p.fecha_fin ? fmtDate(p.fecha_fin) : '—', catName(p.categoria_id) || '—']));
  });

  md += seccion('13. Recibos recurrentes detectados', () => {
    if (typeof detectarRecurrentes !== 'function') return '';
    const rs = detectarRecurrentes(); if (!rs.length) return '';
    return tabla(['Concepto', 'Tipo', 'Categoría', 'Importe', 'Cada (meses)', 'Último'], rs.map(r => [r.patron, r.tipo, catName(r.categoria_id) || '—', xE(r.importe, 2), r.freq, ymLabel(r.ultimo)]));
  });

  md += seccion('14. Evolución del patrimonio (cierres de mes)', () => {
    const pm = (S.patrimonio_mensual || []).slice().sort((a, b) => a.anio_mes < b.anio_mes ? -1 : 1).slice(-24);
    if (!pm.length) return '';
    return tabla(['Mes', 'Liquidez', 'Inversiones', 'Inmuebles', 'Vehículos', 'Deudas', 'Neto'], pm.map(r => [ymLabel(String(r.anio_mes).slice(0, 7)), xE(num(r.liquidez)), xE(num(r.inversiones)),
      xE(num(r.inmuebles)), xE(num(r.vehiculos)), xE(num(r.deudas)), xE(num(r.patrimonio_neto))]));
  });

  md += seccion('15. Pertenencias del hogar (no suman al neto)', () => {
    if (typeof pertOk !== 'function' || !pertOk()) return '';
    const t = pertTotales(); if (!t.n) return '';
    let s = `${t.n} artículos · valor de reposición ${xE(t.repo)} · valor de venta ${xE(t.venta)}\n`;
    for (const i of S.inmuebles) { try { const c = coberturaHogar(i.id); if (c.seg.length && c.cont) s += `\n${i.nombre}: contenido asegurado ${xE(c.cont)} frente a reposición ${xE(c.repo)}${c.falta > 0 ? ` (faltan ${xE(c.falta)})` : ''}\n`; } catch (e) { /* opcional */ } }
    return s;
  });

  md += seccion('Calidad de los datos (para interpretar con cautela)', () => {
    const out = [];
    try { for (const x of chequeoDatos()) if (x.items && x.items.length) out.push([x.nivel === 'alto' ? '⚠ ' + x.titulo : x.titulo, x.items.length]); } catch (e) { /* opcional */ }
    const set = new Set(mc), sc = S.movimientos.filter(m => m.tipo !== 'transferencia' && !m.categoria_id && set.has(mesDe(m)));
    if (sc.length) out.push([`Movimientos sin categoría en el periodo (${xE(-sum(sc.filter(m => num(m.importe) < 0), 'importe'))} de gasto)`, sc.length]);
    const sinTin = S.deudas.filter(d => d.activa !== false && !num(d.interes)); if (sinTin.length) out.push(['Préstamos sin TIN', sinTin.length]);
    return out.length ? tabla(['Aviso', 'Nº'], out) : '_Sin avisos: los datos están completos._\n';
  });

  if (movimientos) md += seccion('Movimientos de los últimos 3 meses', () => {
    const set = new Set([...meses.slice(-2), mA]);
    const ms = S.movimientos.filter(m => set.has(mesDe(m)) && m.tipo !== 'transferencia').sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    return tabla(['Fecha', 'Mes de nómina', 'Concepto', 'Categoría', 'Cuenta', 'Importe'], ms.map(m => [fmtDate(m.fecha), ymLabel(mesDe(m)), String(m.concepto || '').slice(0, 60), catName(m.categoria_id) || 'Sin categoría',
      (cuentaById(m.cuenta_id) || {}).nombre, xE(num(m.importe), 2)]));
  });

  return md + `\n---\n_Para análisis detallados, adjunta también el CSV de movimientos (botón «Movimientos CSV» en Ajustes)._\n`;
}
function esGastoFijoSafe(id, ym) { try { return typeof esGastoFijo === 'function' ? (esGastoFijo(id, ym) ? 'sí' : 'no') : '—'; } catch (e) { return ''; } }

/* ---------- Tarjeta en Ajustes ---------- */
function renderExportarCard() {
  return `<div class="card"><div class="card-head"><h3>🤖 Exportar para Claude</h3>
      <button class="info-btn" data-action="exp-info" title="¿Qué incluye?">ⓘ</button></div>
    <label class="chk-line" style="margin-bottom:12px"><input type="checkbox" id="exp-movs" ${localStorage.getItem('pf_exp_movs') === '1' ? 'checked' : ''}>
      <span><b>Incluir movimientos de los últimos 3 meses</b><small>Más detalle, informe más largo</small></span></label>
    <div class="btn-row">
      <button class="btn primary" data-action="exp-compartir" ${S.loaded ? '' : 'disabled'}>Compartir informe</button>
      <button class="btn" data-action="exp-copiar" ${S.loaded ? '' : 'disabled'}>Copiar texto</button>
      <button class="btn" data-action="exp-csv" ${S.loaded ? '' : 'disabled'}>Movimientos CSV</button>
    </div>
    <p class="small muted" style="margin:10px 0 0">${(p => p ? `Última exportación: <b>${fmtDate(p.fecha)}</b>. La próxima incluirá los cambios desde entonces.` : 'Aún no has exportado: la primera quedará como punto de partida para comparar.')(expPrevio())}</p></div>`;
}
const expNombre = () => `finanzas_${todayISO()}.md`;
/** CSV con TODOS los movimientos, pensado para analizar en Claude o en una hoja de cálculo (UTF-8, coma, punto decimal). */
function movimientosCSV() {
  const q = v => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const cab = ['fecha', 'mes_nomina', 'tipo', 'categoria', 'subcategoria', 'concepto', 'cuenta', 'importe', 'cuenta_destino', 'notas'];
  const filas = S.movimientos.slice().sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0).map(m => {
    const c = catById(m.categoria_id), r = c ? rootOf(c) : null;
    return [m.fecha, mesDe(m) || '', m.tipo, r ? r.nombre : '', c && r && c.id !== r.id ? c.nombre : '', m.concepto, (cuentaById(m.cuenta_id) || {}).nombre || '',
      round2(num(m.importe)).toFixed(2), m.cuenta_destino_id ? ((cuentaById(m.cuenta_destino_id) || {}).nombre || '') : '', m.notas].map(q).join(',');
  });
  return '\ufeff' + cab.join(',') + '\n' + filas.join('\n') + '\n';
}
function descargar(nombre, texto, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const expTexto = () => informeClaude({ movimientos: !!($('#exp-movs') || {}).checked });

async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
  }
}

Changes['exp-movs'] = el => localStorage.setItem('pf_exp_movs', el.checked ? '1' : '0');

Object.assign(Actions, {
  'exp-info': () => toast('El informe incluye patrimonio, cuentas, inversiones, inmuebles, vehículos, deudas (con intereses y capital de 12 meses), ingresos y gastos por categoría frente a presupuesto, seguros, metas, calidad de los datos y los cambios desde la última exportación. El CSV trae todos los movimientos. Sin IBAN, matrículas, pólizas ni direcciones.', 'ok', 9000),
  'exp-csv': async () => {
    const nombre = `movimientos_${todayISO()}.csv`, txt = movimientosCSV(), file = new File([txt], nombre, { type: 'text/csv' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Movimientos' }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
    descargar(nombre, txt, 'text/csv'); toast(`CSV descargado ✓ ${S.movimientos.length} movimientos`, 'ok', 4000);
  },
  'exp-copiar': async () => {
    const ok = await copiarTexto(expTexto()); if (ok) { await guardarIndicadoresExport(); render(); }
    toast(ok ? 'Copiado ✓ Pégalo en el chat con Claude' : 'No se pudo copiar: usa Compartir', ok ? 'ok' : 'warn', 4000);
  },
  'exp-compartir': async () => {
    const txt = expTexto(), file = new File([txt], expNombre(), { type: 'text/markdown' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Finanzas familiares' }); await guardarIndicadoresExport(); render(); return; }
      if (navigator.share) { await navigator.share({ title: 'Finanzas familiares', text: txt }); await guardarIndicadoresExport(); render(); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
    // Sin "Compartir" en este navegador: se descarga el archivo
    descargar(expNombre(), txt, 'text/markdown'); await guardarIndicadoresExport(); render();
    toast('Informe descargado ✓ Adjúntalo en el chat con Claude', 'ok', 4000);
  }
});
