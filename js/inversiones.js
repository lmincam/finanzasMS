'use strict';
/* =====================================================================
   PESTAÑA · INVERSIONES
   ---------------------------------------------------------------------
   Vista global de la cartera (todas las cuentas) y detalle por cuenta:
   Asset Location por producto/ISIN, clase y región, valoraciones,
   aportaciones y aportaciones periódicas automáticas.
   Depende de: datos.js, calculos.js, ui.js, graficos.js, cuentas.js, deudas.js (bannerV4)
   ===================================================================== */

const colorDe = (x, i) => x.k === '_sin' ? '#cbd5e1' : PALETTE[i % PALETTE.length];

/* ---------- Aportaciones periódicas: generación automática de movimientos ---------- */
function fechaAportacion(p, ym) { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(num(p.dia_mes) || 1, daysInMonth(y, m)))}`; }
function proximaAportacion(p) {
  const hoy = todayISO(); let ym = ymOf(p.desde > hoy ? p.desde : hoy);
  for (let k = 0; k < 3; k++, ym = addMonths(ym, 1)) { const f = fechaAportacion(p, ym); if (f >= hoy && f >= p.desde && (!p.hasta || f <= p.hasta)) return f; }
  return null;
}
/** Crea las transferencias de las aportaciones periódicas vencidas que aún no existan. Idempotente. */
async function generarAportaciones() {
  if (S.missing.has('aportaciones_periodicas') || !S.aportaciones_periodicas.length) return 0;
  const hoy = todayISO(), rows = [];
  const hechas = new Set(S.movimientos.filter(m => m.hash_import && m.hash_import.startsWith('auto|')).map(m => m.hash_import));
  for (const p of S.aportaciones_periodicas.filter(x => x.activo !== false)) {
    const dest = cuentaById(p.cuenta_id), orig = cuentaById(p.cuenta_origen_id);
    if (!dest || !orig || !(num(p.importe) > 0)) continue;
    const omit = new Set(p.omitidos || []), fin = p.hasta && p.hasta < hoy ? p.hasta : hoy;
    for (let ym = ymOf(p.desde), k = 0; ym <= ymOf(fin) && k < 600; ym = addMonths(ym, 1), k++) {
      const fecha = fechaAportacion(p, ym), hash = `auto|${p.id}|${ym}`;
      if (fecha < p.desde || fecha > fin || hechas.has(hash) || omit.has(ym)) continue;
      if (fecha <= dest.fecha_saldo_inicial) continue; // ya incluida en el capital aportado de partida
      const tid = uuid(), imp = round2(num(p.importe));
      const base = { fecha, mes_imputacion: ym + '-01', concepto: `Aportación periódica · ${dest.nombre}`, tipo: 'transferencia', subtipo_transferencia: subtipoPorCuenta(dest), transfer_id: tid, origen: 'auto', notas: p.notas || null, categoria_id: null };
      rows.push({ id: uuid(), ...base, cuenta_id: orig.id, cuenta_contraria_id: dest.id, importe: -imp, hash_import: hash });
      rows.push({ id: uuid(), ...base, cuenta_id: dest.id, cuenta_contraria_id: orig.id, importe: imp, hash_import: null });
    }
  }
  if (!rows.length) return 0;
  for (let i = 0; i < rows.length; i += 400) await DB.insert('movimientos', rows.slice(i, i + 400));
  await reloadTable('movimientos');
  toast(`Registradas ${rows.length / 2} aportación(es) periódica(s) ✓`, 'ok', 4000);
  return rows.length / 2;
}
AfterLoad.push(generarAportaciones);

/* ---------- Bloques reutilizables ---------- */
function bloqueDistribucion(id, dist, titulo, sub) {
  return `<div class="card"><div class="card-head"><h3>${titulo}</h3><span class="sub">${sub}</span></div>
    ${dist.length ? `<div class="grid-2e" style="align-items:center"><div class="chart-box sm"><canvas id="${id}"></canvas></div>
      <div class="brk">${dist.map((x, i) => `<div class="r" style="grid-template-columns:1fr 70px 100px"><span><span class="cdot" style="background:${colorDe(x, i)}"></span>${esc(x.label)}${x.isin ? ` <span class="small muted">${esc(x.isin)}</span>` : ''}</span>
        <span class="right num"><b>${fmtPct(x.pct, 1)}</b></span><span class="right num small">${fmtEUR(x.val, 0)}</span></div>`).join('')}</div></div>`
      : '<div class="empty">Añade los productos de cada cuenta (ISIN, fondo, ETF…) para ver la distribución.</div>'}</div>`;
}
function chartDistribucion(id, dist) {
  if (!dist.length) return;
  mkChart(id, { type: 'doughnut', data: { labels: dist.map(x => x.label), datasets: [{ data: dist.map(x => round2(x.val)), backgroundColor: dist.map(colorDe), borderColor: '#fff', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtEUR(ctx.parsed)} (${fmtPct(dist[ctx.dataIndex].pct, 1)})` } } } } });
}
function chartEvolucion(id, cuentas) {
  const vals = S.valoraciones.filter(v => cuentas.some(c => c.id === v.cuenta_id));
  if (!vals.length) return false;
  const fechas = [...new Set(vals.map(v => v.fecha))].sort();
  const series = cuentas.map((c, i) => {
    const vs = vals.filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    let lv = null, la = null; const val = [], ap = [];
    for (const f of fechas) { const h = vs.filter(v => v.fecha === f).pop(); if (h) { lv = num(h.valor); la = apVal(h); } val.push(lv); ap.push(la); }
    return { c, val, ap, color: c.color || PALETTE[i % PALETTE.length] };
  }).filter(s => s.val.some(v => v !== null));
  const tot = fechas.map((_, k) => sum(series, s => s.val[k] || 0)), totA = fechas.map((_, k) => sum(series, s => s.ap[k] || 0));
  mkChart(id, { type: 'line', data: { labels: fechas.map(fmtDate), datasets: [
    { label: 'Valor', data: tot.map(round2), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.12)', fill: true, borderWidth: 3, tension: .25 },
    { label: 'Aportado', data: totA.map(round2), borderColor: '#0f1f3a', borderDash: [6, 4], borderWidth: 2, pointRadius: 2, tension: .25 },
    ...(series.length > 1 ? series.map(s => ({ label: s.c.nombre, data: s.val, borderColor: s.color, backgroundColor: s.color, borderWidth: 1.5, pointRadius: 2, tension: .25, spanGaps: true })) : [])
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: euroAxis, x: { grid: { display: false } } } } });
  return true;
}
function listaAportPeriodicas(planes, conCuenta) {
  if (!planes.length) return '<div class="empty">Sin aportaciones periódicas configuradas.</div>';
  return planes.map(p => { const c = cuentaById(p.cuenta_id), o = cuentaById(p.cuenta_origen_id), prox = p.activo !== false ? proximaAportacion(p) : null;
    return `<div class="cat-row"><span class="cname"><b>${fmtEUR(p.importe)}/mes</b> · día ${p.dia_mes}${conCuenta && c ? ` → ${esc(c.nombre)}` : ''}<br>
      <span class="small muted">Desde ${esc(o ? o.nombre : '?')} · inicio ${fmtDate(p.desde)}${p.hasta ? ' · fin ' + fmtDate(p.hasta) : ''}${p.activo === false ? ' · <b>pausada</b>' : prox ? ' · próxima ' + fmtDate(prox) : ''}</span></span>
      <button class="mini" data-action="ap-edit" data-id="${p.id}">✎</button><button class="mini" data-action="ap-del" data-id="${p.id}">🗑</button></div>`; }).join('');
}

/* =====================================================================
   VISTA GLOBAL
   ===================================================================== */
function renderInversiones() {
  const c0 = S.invSel && S.cuentas.find(c => c.id === S.invSel && c.tipo === 'inversion');
  if (c0) return renderInversionDetalle(c0);
  S.invSel = null;
  const el = $('#tab-inversiones');
  const inv = S.cuentas.filter(c => c.tipo === 'inversion').sort(byOrden), act = inv.filter(c => c.activa !== false);
  const infos = inv.map(c => ({ c, x: invInfo(c) })), A = infos.filter(o => o.c.activa !== false);
  const totVal = sum(A, o => o.x.valor), totAp = sum(A, o => o.x.aportado), totPlus = totVal - totAp;
  const anio = todayISO().slice(0, 4);
  const apAnio = sum(S.movimientos.filter(m => m.tipo === 'transferencia' && act.some(c => c.id === m.cuenta_id) && m.fecha.startsWith(anio)), 'importe');
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(ymOf(todayISO()), i - 11));
  const dProd = distribucion(act, 'producto'), dClase = distribucion(act, 'clase'), dReg = distribucion(act, 'region');
  const planes = S.aportaciones_periodicas.filter(p => inv.some(c => c.id === p.cuenta_id));

  el.innerHTML = `
    <div class="section-head"><div><h2>📈 Inversiones · visión global</h2><div class="small muted">Todas tus cuentas de inversión. Pulsa una cuenta para ver su detalle.</div></div>
      <button class="btn" data-action="inv-new">+ Cuenta de inversión</button></div>
    ${bannerV4()}
    ${!S.tablaValoraciones ? '<div class="banner amber">Ejecuta <code>sql/02_migracion_v2_inversiones.sql</code> para guardar el histórico de valoraciones.</div>' : ''}
    <div class="kpis">
      ${kpi('Valor de la cartera', fmtEUR(totVal), `${act.length} cuenta(s)`, 'navy')}
      ${kpi('Capital aportado neto', fmtEUR(totAp), 'Aportaciones − retiradas')}
      ${kpi('Plusvalía latente', `<span class="${totPlus >= 0 ? 'pos' : 'neg'}">${signed(totPlus)}</span>`, `Rentabilidad acumulada: <b>${totAp > 0 ? fmtPct(totPlus / totAp) : '—'}</b>`, totPlus >= 0 ? 'pos' : 'neg')}
      ${kpi(`Aportado en ${anio}`, fmtEUR(apAnio), `Periódicas: <b>${fmtEUR(aportacionMensual())}/mes</b> (${fmtEUR(aportacionMensual() * 12, 0)}/año)`)}
    </div>
    <div class="grid-2e">${infos.map(({ c, x }) => { const top = distribucion([c], 'producto').slice(0, 3);
      return `<div class="card inv-card ${c.activa === false ? 'off' : ''}" style="--acc:${esc(c.color || '#7c3aed')};margin-bottom:0;cursor:pointer" data-action="inv-open" data-id="${c.id}">
        <div class="asset-head"><div class="asset-ico">📈</div><div style="flex:1"><h3>${esc(c.nombre)}</h3><div class="small muted">${esc(c.entidad || '')}${x.tieneVM ? ` · valorada ${fmtDate(c.fecha_valor_mercado)}` : ' · sin valoración'}</div></div><span class="btn sm">Ver detalle →</span></div>
        <div class="metrics">${metric('Valor', fmtEUR(x.valor, 0))}${metric('Aportado', fmtEUR(x.aportado, 0))}${metric('Plusvalía', x.tieneVM ? signed(x.plus) : '—', x.plus >= 0 ? 'pos' : 'neg')}${metric('Rentab.', fmtPct(x.rent, 1), x.plus >= 0 ? 'pos' : 'neg')}</div>
        ${top.length ? `<div class="small muted" style="margin-top:10px">${top.map(t => `${esc(t.label)} <b>${fmtPct(t.pct, 0)}</b>`).join(' · ')}</div>` : ''}
        ${aportacionMensual(c.id) ? `<div class="small" style="margin-top:6px">🔁 ${fmtEUR(aportacionMensual(c.id))}/mes automáticos</div>` : ''}
      </div>`; }).join('') || '<div class="card empty">No tienes cuentas de inversión.</div>'}</div>
    <div style="height:16px"></div>
    ${bloqueDistribucion('ch-inv-loc', dProd, '🧩 Asset Location global', 'Qué % de toda tu cartera está en cada producto')}
    <div class="grid-2e">${bloqueDistribucion('ch-inv-clase', dClase, 'Por clase de activo', 'Renta variable, fija, monetario…')}${bloqueDistribucion('ch-inv-reg', dReg, 'Por región', 'Exposición geográfica')}</div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Evolución: valor vs. aportado</h3><span class="sub">Según tus valoraciones</span></div>${S.valoraciones.length ? '<div class="chart-box"><canvas id="ch-inv-evo"></canvas></div>' : '<div class="empty">Cada “Actualizar valor” guarda un punto del histórico.</div>'}</div>
      <div class="card"><div class="card-head"><h3>🔁 Aportaciones periódicas</h3></div>${S.v4 ? listaAportPeriodicas(planes, true) : bannerV4()}</div>
    </div>
    <div class="card"><div class="card-head"><h3>Aportaciones netas por mes</h3><span class="sub">Últimos 12 meses</span></div><div class="chart-box sm"><canvas id="ch-inv-ap"></canvas></div></div>`;

  chartDistribucion('ch-inv-loc', dProd); chartDistribucion('ch-inv-clase', dClase); chartDistribucion('ch-inv-reg', dReg);
  chartEvolucion('ch-inv-evo', inv);
  mkChart('ch-inv-ap', { type: 'bar', data: { labels: meses.map(m => ymLabel(m, true)),
    datasets: act.map((c, i) => ({ label: c.nombre, backgroundColor: c.color || PALETTE[i % PALETTE.length], borderRadius: 4, stack: 'a',
      data: meses.map(m => round2(sum(S.movimientos.filter(x => x.cuenta_id === c.id && x.tipo === 'transferencia' && ymOf(x.fecha) === m), 'importe'))) })) },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true, grid: { display: false } }, y: { ...euroAxis, stacked: true } } } });
}

/* =====================================================================
   DETALLE DE UNA CUENTA
   ===================================================================== */
function renderInversionDetalle(c) {
  const el = $('#tab-inversiones');
  const x = invInfo(c), P = posicionesCuenta(c);
  const dProd = distribucion([c], 'producto'), dClase = distribucion([c], 'clase'), dReg = distribucion([c], 'region');
  const planes = S.aportaciones_periodicas.filter(p => p.cuenta_id === c.id);
  const ultimos = S.movimientos.filter(m => m.tipo === 'transferencia' && m.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 15);
  const vals = S.valoraciones.filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);

  el.innerHTML = `
    <div class="section-head"><div style="display:flex;gap:10px;align-items:center"><button class="btn sm ghost" data-action="inv-back">← Visión global</button>
      <div><h2>${esc(c.nombre)}</h2><div class="small muted">${esc(c.entidad || '')}${x.tieneVM ? ` · valorada a ${fmtDate(c.fecha_valor_mercado)}` : ' · sin valoración de mercado'}</div></div></div>
      <div class="btn-row"><button class="btn sm primary" data-action="cuenta-valor" data-id="${c.id}">Actualizar valor</button>
        <button class="btn sm" data-action="quick-open" data-tipo="transferencia" data-destino="${c.id}">+ Aportación puntual</button>
        <button class="btn sm ghost" data-action="inv-aportado" data-id="${c.id}">Ajustar aportado</button>
        <button class="mini" data-action="cuenta-edit" data-id="${c.id}">✎</button><button class="mini" data-action="cuenta-del" data-id="${c.id}">🗑</button></div></div>
    ${bannerV4()}
    ${x.diasVal !== null && x.diasVal > 90 ? `<div class="banner amber">La última valoración tiene ${x.diasVal} días. Actualízala para que el patrimonio sea fiel.</div>` : ''}
    <div class="kpis">
      ${kpi('Valor actual', fmtEUR(x.valor), x.tieneVM ? 'Valoración + aportaciones posteriores' : 'Sin valoración: igual al aportado', 'navy')}
      ${kpi('Aportado neto', fmtEUR(x.aportado), `Últimos 12 meses: ${fmtEUR(x.ap12)}`)}
      ${kpi('Plusvalía', x.tieneVM ? `<span class="${x.plus >= 0 ? 'pos' : 'neg'}">${signed(x.plus)}</span>` : '—', `Rentabilidad: <b>${fmtPct(x.rent, 2)}</b>`, x.plus >= 0 ? 'pos' : 'neg')}
      ${kpi('Aportación periódica', fmtEUR(aportacionMensual(c.id)) + '/mes', `${fmtEUR(aportacionMensual(c.id) * 12, 0)} al año`)}
    </div>

    <div class="card"><div class="card-head"><h3>🧩 Asset Location · ${esc(c.nombre)}</h3>${S.v4 ? `<button class="btn sm" data-action="pos-new" data-id="${c.id}">+ Añadir producto</button>` : ''}</div>
      ${P.exceso ? `<div class="banner red">Los productos suman ${fmtEUR(P.asignado)}, más que el valor de la cuenta (${fmtEUR(P.V)}). Revisa importes o porcentajes, o actualiza el valor de la cuenta.</div>` : ''}
      ${P.ps.length && P.resto > 0.5 ? `<div class="banner blue">Quedan ${fmtEUR(P.resto)} (${fmtPct(P.resto / P.V, 1)}) sin asignar a ningún producto.</div>` : ''}
      ${dProd.length ? `<div class="grid-2e" style="align-items:center"><div class="chart-box"><canvas id="ch-acc-loc"></canvas></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Tipo / clase</th><th class="right">%</th><th class="right">Valor</th><th></th></tr></thead><tbody>
        ${P.ps.map((p, i) => `<tr><td><span class="cdot" style="background:${PALETTE[i % PALETTE.length]}"></span><b>${esc(p.nombre)}</b>${p.isin ? `<div class="small muted">${esc(p.isin)} ${isinValido(p.isin) ? '<span class="pos">✓</span>' : '<span class="neg" title="ISIN con formato o dígito de control incorrecto">⚠</span>'} · <a href="https://www.google.com/search?q=${encodeURIComponent(p.isin)}" target="_blank" rel="noopener">ficha</a></div>` : ''}</td>
          <td class="small">${TIPO_ACTIVO[p.tipo_activo] || ''}<br><span class="muted">${CLASE_ACTIVO[p.clase] || ''}${p.region ? ' · ' + esc(p.region) : ''}</span></td>
          <td class="right num"><b>${P.V ? fmtPct(p.val / Math.max(P.V, P.asignado), 1) : '—'}</b></td><td class="right num">${fmtEUR(p.val)}</td>
          <td><button class="mini" data-action="pos-edit" data-id="${p.id}">✎</button><button class="mini" data-action="pos-del" data-id="${p.id}">🗑</button></td></tr>`).join('')}
        ${P.resto > 0.5 ? `<tr><td class="muted">Sin asignar</td><td></td><td class="right num muted">${fmtPct(P.resto / P.V, 1)}</td><td class="right num muted">${fmtEUR(P.resto)}</td><td></td></tr>` : ''}
        </tbody></table></div></div>`
        : `<div class="empty">Indica en qué está invertida esta cuenta: añade cada fondo, ETF o acción con su ISIN y el % (o el importe) que representa.${S.v4 ? '' : '<br>' + bannerV4()}</div>`}
    </div>
    <div class="grid-2e">${bloqueDistribucion('ch-acc-clase', dClase, 'Por clase de activo', '')}${bloqueDistribucion('ch-acc-reg', dReg, 'Por región', '')}</div>

    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>🔁 Aportaciones periódicas</h3>${S.v4 ? `<button class="btn sm" data-action="ap-new" data-id="${c.id}">+ Programar</button>` : ''}</div>
        ${S.v4 ? listaAportPeriodicas(planes, false) + '<p class="small muted">Se registran solas cada mes como transferencia desde la cuenta de origen. Si luego el cargo aparece en el Excel de Unicaja, el importador lo marca como ya registrado para no duplicarlo.</p>' : bannerV4()}</div>
      <div class="card"><div class="card-head"><h3>Últimas aportaciones y retiradas</h3></div>
        <div class="top-list">${ultimos.length ? ultimos.map(m => { const o = cuentaById(m.cuenta_contraria_id); return `<div class="it"><div class="c"><b>${fmtDate(m.fecha)}</b> ${m.origen === 'auto' ? '<span class="badge blue">periódica</span>' : ''}<div class="small muted">${num(m.importe) >= 0 ? 'desde' : 'hacia'} ${esc(o ? o.nombre : '?')} · ${esc(m.concepto || '')}</div></div><div class="num ${num(m.importe) >= 0 ? 'pos' : 'neg'}">${signed(num(m.importe))}</div></div>`; }).join('') : '<div class="empty">Sin movimientos todavía.</div>'}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Evolución de la cuenta</h3></div>${vals.length ? '<div class="chart-box"><canvas id="ch-acc-evo"></canvas></div>' : '<div class="empty">Sin valoraciones guardadas.</div>'}</div>
      <div class="card"><div class="card-head"><h3>Histórico de valoraciones</h3></div>
        ${vals.length ? `<div class="tbl-wrap" style="max-height:320px;overflow:auto"><table class="tbl"><thead><tr><th>Fecha</th><th class="right">Valor</th><th class="right">Aportado</th><th class="right">Plusvalía</th><th></th></tr></thead><tbody>
          ${vals.map(v => { const ap = apVal(v), pl = num(v.valor) - ap; return `<tr><td class="small">${fmtDate(v.fecha)}</td><td class="right num">${fmtEUR(v.valor)}</td><td class="right num">${fmtEUR(ap)}</td><td class="right num ${pl >= 0 ? 'pos' : 'neg'}">${signed(pl)}</td><td><button class="mini" data-action="val-del" data-id="${v.id}">🗑</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">—</div>'}</div>
    </div>`;
  chartDistribucion('ch-acc-loc', dProd); chartDistribucion('ch-acc-clase', dClase); chartDistribucion('ch-acc-reg', dReg);
  chartEvolucion('ch-acc-evo', [c]);
}

/* ---------- Formularios ---------- */
const FIELDS_POS = [
  { name: 'nombre', label: 'Producto', required: true, full: true, ph: 'Ej: Vanguard Global Stock Index Fund' },
  { name: 'isin', label: 'ISIN', ph: 'IE00B03HCZ61', hint: '12 caracteres; se comprueba el dígito de control' },
  { name: 'tipo_activo', label: 'Tipo de producto', type: 'select', options: Object.entries(TIPO_ACTIVO).map(([v, l]) => ({ v, l })) },
  { name: 'clase', label: 'Clase de activo', type: 'select', options: Object.entries(CLASE_ACTIVO).map(([v, l]) => ({ v, l })) },
  { name: 'region', label: 'Región', ph: 'Global, EEUU, Europa, Emergentes…' },
  { name: 'porcentaje', label: '% de la cuenta', type: 'number', ph: 'Ej: 70', hint: 'Rellena el % …' },
  { name: 'valor', label: '… o el valor en € (prevalece sobre el %)', type: 'number' },
  { name: 'orden', label: 'Orden', type: 'int' }, { name: 'notas', label: 'Notas', type: 'textarea', full: true, ph: 'TER, índice que replica, cartera modelo…' }
];
const FIELDS_AP = [
  { name: 'importe', label: 'Importe mensual (€)', type: 'number', required: true },
  { name: 'dia_mes', label: 'Día del mes (1-28)', type: 'int', required: true },
  { name: 'cuenta_origen_id', label: 'Sale de la cuenta', type: 'rawselect', html: v => accOpts(v, { empty: '— Selecciona —' }) },
  { name: 'desde', label: 'Primera aportación', type: 'date', required: true, hint: 'La primera que aún NO tengas registrada' },
  { name: 'hasta', label: 'Última (opcional)', type: 'date' },
  { name: 'activo', label: 'Activa', type: 'checkbox', def: true }, { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
async function guardarPosicion(cid, id, v) {
  if (v.isin) { v.isin = v.isin.toUpperCase().replace(/\s/g, ''); if (!isinValido(v.isin)) throw new Error(`El ISIN ${v.isin} no es válido (formato o dígito de control). Revísalo o déjalo vacío.`); }
  if (v.porcentaje === null && v.valor === null) throw new Error('Indica el % de la cuenta o su valor en €');
  const row = { ...v, cuenta_id: cid, orden: v.orden || 0 };
  if (id) await DB.update('posiciones', id, row); else await DB.insert('posiciones', [row]);
  await reloadTable('posiciones');
}
async function guardarAportPeriodica(cid, id, v) {
  if (!v.cuenta_origen_id) throw new Error('Indica de qué cuenta sale el dinero');
  if (v.cuenta_origen_id === cid) throw new Error('La cuenta de origen no puede ser la propia cuenta de inversión');
  if (!(v.dia_mes >= 1 && v.dia_mes <= 28)) throw new Error('El día debe estar entre 1 y 28');
  const row = { ...v, cuenta_id: cid };
  if (id) await DB.update('aportaciones_periodicas', id, row); else await DB.insert('aportaciones_periodicas', [row]);
  await reloadTable('aportaciones_periodicas');
  await generarAportaciones();
}

Views.inversiones = renderInversiones;

Object.assign(Actions, {
  'inv-open': el => { S.invSel = el.dataset.id; render(); window.scrollTo({ top: 0 }); },
  'inv-back': () => { S.invSel = null; render(); },
  'cuenta-valor': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Valor de mercado · ${c.nombre}`, intro: `<p class="small muted">Introduce el valor total actual de la cartera (lo que muestra ${esc(c.entidad || 'el bróker')}). Las aportaciones posteriores a esta fecha se sumarán automáticamente.</p>`,
      fields: [{ name: 'valor', label: 'Valor actual (€)', type: 'number', required: true }, { name: 'fecha', label: 'Fecha', type: 'date' }], values: { valor: Calc.valor(c), fecha: todayISO() },
      onSubmit: async v => {
        const fecha = v.fecha || todayISO();
        await saveEntity('cuentas', c.id, { valor_mercado: v.valor, fecha_valor_mercado: fecha });
        if (S.tablaValoraciones) { await DB.insert('valoraciones', [{ cuenta_id: c.id, fecha, valor: v.valor, aportado_neto: Calc.aportadoA(c, fecha) }]); await reloadTable('valoraciones'); }
      } });
  },
  'inv-new': () => openForm({ title: 'Nueva cuenta de inversión', fields: FIELDS_CUENTA, values: { tipo: 'inversion', fecha_saldo_inicial: todayISO(), orden: S.cuentas.length + 1, activa: true, color: PALETTE[S.cuentas.length % PALETTE.length] },
    onSubmit: v => saveEntity('cuentas', null, zeroNulls({ ...v, fecha_saldo_inicial: v.fecha_saldo_inicial || todayISO() }, ['saldo_inicial', 'orden'])) }),
  'inv-aportado': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Capital aportado · ${c.nombre}`, intro: '<p class="small muted">Total que has aportado de tu bolsillo a esta cuenta (aportaciones − retiradas) hasta la fecha indicada. Las aportaciones posteriores (puntuales o periódicas) se sumarán solas.</p>',
      fields: [{ name: 'saldo', label: 'Capital aportado neto (€)', type: 'number', required: true }, { name: 'fecha', label: 'Hasta el día', type: 'date' }], values: { saldo: Calc.saldo(c), fecha: todayISO() },
      onSubmit: v => saveEntity('cuentas', c.id, { saldo_inicial: v.saldo, fecha_saldo_inicial: v.fecha || todayISO() }) });
  },
  'val-del': async el => {
    const v = S.valoraciones.find(x => x.id === el.dataset.id); if (!v) return;
    if (!(await confirmDlg(`¿Eliminar la valoración del ${fmtDate(v.fecha)} (${fmtEUR(v.valor)}) del histórico?`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('valoraciones', v.id); await reloadTable('valoraciones'); }, 'Valoración eliminada'); render();
  },
  'pos-new': el => openForm({ title: 'Añadir producto', fields: FIELDS_POS, values: { tipo_activo: 'fondo', clase: 'renta_variable', orden: S.posiciones.filter(p => p.cuenta_id === el.dataset.id).length + 1 }, onSubmit: v => guardarPosicion(el.dataset.id, null, v) }),
  'pos-edit': el => { const p = S.posiciones.find(x => x.id === el.dataset.id); openForm({ title: 'Editar producto', fields: FIELDS_POS, values: p, onSubmit: v => guardarPosicion(p.cuenta_id, p.id, v) }); },
  'pos-del': async el => { const p = S.posiciones.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Quitar <b>${esc(p.nombre)}</b> de la cuenta?`, 'Quitar'))) return; await withSaving(null, async () => { await DB.remove('posiciones', p.id); await reloadTable('posiciones'); }, 'Producto quitado'); render(); },
  'ap-new': el => { const def = S.cuentas.find(c => c.tipo === 'corriente' && c.activa !== false);
    openForm({ title: `Programar aportación periódica · ${cuentaById(el.dataset.id).nombre}`, fields: FIELDS_AP, values: { dia_mes: 1, desde: todayISO(), activo: true, cuenta_origen_id: def && def.id }, onSubmit: v => guardarAportPeriodica(el.dataset.id, null, v) }); },
  'ap-edit': el => { const p = S.aportaciones_periodicas.find(x => x.id === el.dataset.id); openForm({ title: 'Editar aportación periódica', fields: FIELDS_AP, values: p,
    intro: '<p class="small muted">Los cambios se aplican a las aportaciones futuras; las ya registradas no se modifican.</p>', onSubmit: v => guardarAportPeriodica(p.cuenta_id, p.id, v) }); },
  'ap-del': async el => {
    if (!(await confirmDlg('¿Eliminar esta aportación periódica?<br><span class="small">Las aportaciones ya registradas se conservan como movimientos.</span>', 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('aportaciones_periodicas', el.dataset.id); await reloadTable('aportaciones_periodicas'); }, 'Eliminada'); render();
  }
});
