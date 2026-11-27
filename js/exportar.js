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
function seccion(titulo, fn) {
  try { const c = fn(); return c ? `\n## ${titulo}\n\n${c}` : ''; }
  catch (e) { console.warn('Exportar:', titulo, e); return `\n## ${titulo}\n\n_No se pudo generar (${xT(e.message || e)})._\n`; }
}

function informeClaude({ movimientos = false } = {}) {
  const hoy = todayISO(), mA = mesActual();
  // Últimos 12 meses cerrados, sin contar los anteriores al primer movimiento (no hay datos y bajarían las medias)
  const primero = S.movimientos.reduce((a, m) => { const ym = mesDe(m); return ym && (!a || ym < a) ? ym : a; }, null);
  let meses = Array.from({ length: EXP_MESES }, (_, i) => addMonths(mA, i - EXP_MESES)).filter(ym => !primero || ym >= primero);
  if (!meses.length) meses = [addMonths(mA, -1)];
  const P = Calc.patrimonio();
  let md = `# Finanzas familiares · Patrimonio Miñán Sánchez

Exportado el ${fmtDate(hoy)} desde la app (versión ${APP_VERSION}).

> **Para Claude:** analiza estos datos como asesor financiero familiar. Da un diagnóstico claro (qué va bien, qué es un riesgo), compara con referencias razonables para una familia española joven y termina con un plan de acción priorizado y con cifras (qué hacer este mes, este trimestre y este año). Contexto:
> - Importes en euros. Cada "mes" es un **mes de nómina** (del día de cobro al día antes del siguiente cobro), no un mes natural.
> - **Ahorro líquido** = ingresos − todo lo que sale de las cuentas. El capital amortizado de los préstamos no cuenta como ahorro disponible (se convierte en vivienda).
> - Los gastos ya descuentan lo devuelto por gastos compartidos (Bizum).
> - Las pertenencias del hogar no suman al patrimonio neto (se dan aparte).
> - Historial de movimientos desde ${primero ? ymLabel(primero) : '—'}: las medias usan ${meses.length} mes(es) cerrado(s).
`;

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
    try { const t = tirInversion(inv); if (t && t.tir !== null && isFinite(t.tir)) s += `\nTIR anual conjunta (dinero ponderado): ${xP(t.tir)}\n`; } catch (e) { /* opcional */ }
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

  md += seccion('5. Vehículos', () => S.vehiculos.length ? tabla(['Vehículo', 'Tipo', 'Año', 'Compra', 'Precio compra', 'Valor actual', 'Km', 'Seguro+impuesto+mant./año'],
    S.vehiculos.map(v => [v.nombre + (v.marca_modelo ? ` (${v.marca_modelo})` : ''), v.tipo, v.anio, v.fecha_compra ? fmtDate(v.fecha_compra) : '—', xE(num(v.valor_compra)), xE(num(v.valor_actual)),
      v.km ? fmtNum(num(v.km), 0) : '—', xE(num(v.gasto_seguro) + num(v.gasto_impuesto) + num(v.gasto_mantenimiento))])) : '_Sin vehículos._\n');

  md += seccion('6. Deudas', () => {
    const ds = S.deudas.filter(d => d.activa !== false);
    if (!ds.length) return '_Sin deudas._\n';
    return tabla(['Préstamo', 'Tipo', 'Entidad', 'Capital inicial', 'Inicio', 'TIN', 'Cuota/mes', 'Pendiente hoy', '% amortizado', 'Cuotas restantes', 'Fin previsto', 'Intereses que quedan', 'Comisión amort. anticipada'],
      ds.map(d => { const x = deudaInfo(d); return [d.nombre, TIPO_DEUDA[d.tipo] || d.tipo, d.entidad, xE(num(d.capital_inicial)), d.fecha_inicio ? fmtDate(d.fecha_inicio) : '—',
        num(d.interes) ? fmtNum(num(d.interes), 2) + ' %' : '—', xE(x.cuota, 2), xE(x.pendienteHoy), xP(x.pctAmort, 0), x.restantes ?? '—', x.fin ? ymLabel(x.fin) : '—',
        xE(x.interesesPendientes), d.comision_amortizacion !== null && d.comision_amortizacion !== undefined && d.comision_amortizacion !== '' ? fmtNum(num(d.comision_amortizacion), 2) + ' %' : '—']; }));
  });

  md += seccion(`7. Ingresos, gastos y ahorro (últimos ${meses.length} meses de nómina cerrados + el actual)`, () => {
    const filas = [], tot = { ing: 0, gc: 0, cap: 0, inv: 0, aho: 0 };
    for (const ym of [...meses, mA]) {
      const st = periodStats([ym]), abierto = ym === mA;
      if (!abierto) { tot.ing += st.ingresos; tot.gc += st.gastosCaja; tot.cap += st.capital; tot.inv += st.aport.inversion; tot.aho += st.aport.ahorro; }
      filas.push([ymLabel(ym) + (abierto ? ' (en curso)' : ''), xE(st.ingresos), xE(st.gastosCaja), xE(st.capital), xE(st.ahorroCaja), xP(st.ingresos ? st.ahorroCaja / st.ingresos : null, 0), xE(st.aport.ahorro), xE(st.aport.inversion)]);
    }
    const n = meses.length;
    filas.push([`**Media ${n} meses cerrados**`, xE(tot.ing / n), xE(tot.gc / n), xE(tot.cap / n), xE((tot.ing - tot.gc) / n), xP(tot.ing ? (tot.ing - tot.gc) / tot.ing : null, 0), xE(tot.aho / n), xE(tot.inv / n)]);
    return tabla(['Mes', 'Ingresos', 'Gastos (salidas)', 'de ellos, capital amortizado', 'Ahorro líquido', 'Tasa ahorro', 'A cuentas de ahorro', 'A inversión'], filas);
  });

  md += seccion(`8. Gasto por categoría (últimos ${meses.length} meses cerrados)`, () => {
    const ult3 = meses.slice(-3), roots = S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).sort(byOrden);
    const gasto = (ids, ms) => { const set = new Set(ms), idSet = new Set(ids);
      return -sum(S.movimientos.filter(m => m.tipo === 'gasto' && idSet.has(m.categoria_id) && set.has(mesDe(m))), 'importe'); };
    const filas = [];
    for (const r of roots) {
      const subs = childrenOf(r.id), ids = [r.id, ...subs.map(c => c.id)];
      const t12 = gasto(ids, meses); const pres = budgetOf(r), pa = presAnual(r);
      if (!t12 && !pres && !pa) continue;
      filas.push([`**${r.nombre}**`, xE(t12), xE(t12 / meses.length), xE(gasto(ids, ult3) / ult3.length), pres ? xE(pres) : (pa ? xE(pa) + '/año' : '—'), esGastoFijoSafe(r.id, mA)]);
      for (const c of subs) {
        const s12 = gasto([c.id], meses); if (!s12 && !num(c.presupuesto_mensual) && !presAnual(c)) continue;
        filas.push([`· ${c.nombre}`, xE(s12), xE(s12 / meses.length), xE(gasto([c.id], ult3) / ult3.length), num(c.presupuesto_mensual) ? xE(num(c.presupuesto_mensual)) : (presAnual(c) ? xE(presAnual(c)) + '/año' : '—'), esGastoFijoSafe(c.id, mA)]);
      }
    }
    const sinCat = -sum(S.movimientos.filter(m => m.tipo === 'gasto' && !m.categoria_id && new Set(meses).has(mesDe(m))), 'importe');
    if (sinCat) filas.push(['Sin categoría', xE(sinCat), xE(sinCat / meses.length), '—', '—', '—']);
    return tabla(['Categoría', `Total ${meses.length} m`, 'Media/mes', `Media últimos ${Math.min(3, meses.length)} m`, 'Presupuesto/mes', '¿Fijo?'], filas);
  });

  md += seccion(`9. Ingresos por categoría (últimos ${meses.length} meses cerrados)`, () => {
    const set = new Set(meses), mapa = new Map();
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

  if (movimientos) md += seccion('16. Movimientos de los últimos 3 meses', () => {
    const set = new Set([...meses.slice(-2), mA]);
    const ms = S.movimientos.filter(m => set.has(mesDe(m)) && m.tipo !== 'transferencia').sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    return tabla(['Fecha', 'Concepto', 'Categoría', 'Cuenta', 'Importe'], ms.map(m => [fmtDate(m.fecha), String(m.concepto || '').slice(0, 60), catName(m.categoria_id) || 'Sin categoría',
      (cuentaById(m.cuenta_id) || {}).nombre, xE(num(m.importe), 2)]));
  });

  return md + '\n';
}
function esGastoFijoSafe(id, ym) { try { return typeof esGastoFijo === 'function' ? (esGastoFijo(id, ym) ? 'sí' : 'no') : '—'; } catch (e) { return ''; } }

/* ---------- Tarjeta en Ajustes ---------- */
function renderExportarCard() {
  return `<div class="card"><div class="card-head"><h3>🤖 Exportar para Claude</h3>
      <button class="info-btn" data-action="exp-info" title="¿Qué incluye?">ⓘ</button></div>
    <label class="chk-line" style="margin-bottom:12px"><input type="checkbox" id="exp-movs" ${localStorage.getItem('pf_exp_movs') === '1' ? 'checked' : ''}>
      <span><b>Incluir movimientos de los últimos 3 meses</b><small>Más detalle, informe más largo</small></span></label>
    <div class="btn-row">
      <button class="btn primary" data-action="exp-compartir" ${S.loaded ? '' : 'disabled'}>Compartir</button>
      <button class="btn" data-action="exp-copiar" ${S.loaded ? '' : 'disabled'}>Copiar texto</button>
    </div></div>`;
}
const expNombre = () => `finanzas_${todayISO()}.md`;
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
  'exp-info': () => toast('Incluye patrimonio, cuentas, inversiones, inmuebles, vehículos, deudas, 12 meses de ingresos y gastos por categoría, presupuestos, seguros, metas y evolución. Sin IBAN, matrículas, pólizas ni direcciones.', 'ok', 7000),
  'exp-copiar': async () => {
    const ok = await copiarTexto(expTexto());
    toast(ok ? 'Copiado ✓ Pégalo en el chat con Claude' : 'No se pudo copiar: usa Compartir', ok ? 'ok' : 'warn', 4000);
  },
  'exp-compartir': async () => {
    const txt = expTexto(), file = new File([txt], expNombre(), { type: 'text/markdown' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Finanzas familiares' }); return; }
      if (navigator.share) { await navigator.share({ title: 'Finanzas familiares', text: txt }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
    // Sin "Compartir" en este navegador: se descarga el archivo
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = expNombre();
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Informe descargado ✓ Adjúntalo en el chat con Claude', 'ok', 4000);
  }
});
