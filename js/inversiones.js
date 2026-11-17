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

/* ---------- Tarjeta "Precios automáticos" ---------- */
const REPO_GH = 'https://github.com/lmincam/finanzasMS';
function renderPreciosCard() {
  if (!S.v10) return '<div class="banner blue">📡 Para que el valor de tus fondos y ETF se actualice solo cada día, ejecuta <code>sql/esquema_completo.sql</code> en Supabase (bloque 12).</div>';
  const est = ((S.ajustesRows || []).find(r => r.clave === 'precios_estado') || {}).valor;
  const isins = [...new Set(S.posiciones.filter(p => p.isin).map(p => p.isin.toUpperCase()))];
  const sinPart = S.posiciones.filter(p => p.isin && !(num(p.participaciones) > 0));
  const filas = isins.map(i => { const u = precioEn(i, todayISO()), r = est && est.resultados && est.resultados.find(x => x.isin === i), p = S.posiciones.find(x => (x.isin || '').toUpperCase() === i);
    return `<div class="acc-row"><span><b>${esc(p ? p.nombre : i)}</b> <span class="muted small">${i}</span></span>
      <span class="small">${u ? `<b class="num">${fmtNum(u.precio, 4)}</b> · ${fmtDate(u.fecha)}${u.fuente ? ` <span class="muted">(${esc(u.fuente)})</span>` : ''}` : (r && !r.ok ? `<span class="neg">❌ ${esc(r.error)}</span>` : '<span class="muted">sin precio aún</span>')}</span></div>`; }).join('');
  const activo = !!est;
  return `<div class="card"><div class="card-head"><div><h3>📡 Precios automáticos</h3><div class="small muted">${activo ? `Última actualización: ${new Date(est.ejecutado).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}${est.eodhd ? ' · EODHD + Yahoo' : ' · Yahoo Finance (sin clave EODHD)'}` : 'Aún no se ha ejecutado la tarea diaria'}</div></div>
      <a class="btn sm" href="${REPO_GH}/actions/workflows/precios.yml" target="_blank" rel="noopener">Ver / lanzar en GitHub</a></div>
    ${isins.length ? filas : '<div class="small muted">Añade productos con su ISIN en cada cuenta de inversión.</div>'}
    ${sinPart.length ? `<div class="banner amber" style="margin-top:10px">Para valorar solo ${sinPart.length === 1 ? 'este producto' : 'estos productos'} falta indicar las <b>participaciones</b>: ${sinPart.map(p => esc(p.nombre)).join(', ')}. Edita el producto (✎) en su cuenta.</div>` : ''}
    ${activo ? '' : `<details class="small" style="margin-top:10px"><summary><b>Cómo activarlo (5 minutos, una sola vez)</b></summary><ol style="line-height:1.6;padding-left:18px">
      <li>Regístrate gratis en <a href="https://eodhd.com/register" target="_blank" rel="noopener">eodhd.com/register</a> y copia tu <b>API token</b> del <a href="https://eodhd.com/cp/dashboard" target="_blank" rel="noopener">Dashboard</a> (también llega por email). Es opcional, pero cubre mejor los fondos europeos.</li>
      <li>En Supabase → ⚙️ Project Settings → <b>API Keys</b> → apartado <b>Secret keys</b>, copia la clave que empieza por <code>sb_secret_</code> (si no hay, pulsa <i>Create new API keys</i>).</li>
      <li>En <a href="${REPO_GH}/settings/secrets/actions" target="_blank" rel="noopener">GitHub → Settings → Secrets → Actions</a> crea <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code> y <code>EODHD_API_KEY</code>.</li>
      <li>En <a href="${REPO_GH}/actions/workflows/precios.yml" target="_blank" rel="noopener">Actions → Precios diarios</a> pulsa <b>Run workflow</b> para la primera carga.</li></ol></details>`}
  </div>`;
}

/** Valoración automática: si hay precios nuevos de los ISIN de una cuenta, guarda su valor de mercado y una valoración (para gráficos y TIR). */
async function sincronizarValoresAuto() {
  if (S.offline || !S.v10) return;
  let cambios = 0;
  for (const c of S.cuentas.filter(x => x.tipo === 'inversion' && x.activa !== false)) {
    const A = valorAutoCuenta(c); if (!A) continue;
    const mismo = c.fecha_valor_mercado === A.fecha && Math.abs(num(c.valor_mercado) - A.valor) < 0.01;
    if (mismo || (c.fecha_valor_mercado && c.fecha_valor_mercado > A.fecha)) continue;
    try {
      await DB.update('cuentas', c.id, { valor_mercado: A.valor, fecha_valor_mercado: A.fecha, ...(S.v7 ? { valor_actualizado: new Date().toISOString() } : {}) });
      if (S.tablaValoraciones) {
        const prev = S.valoraciones.find(v => v.cuenta_id === c.id && v.fecha === A.fecha), row = { cuenta_id: c.id, fecha: A.fecha, valor: A.valor, aportado_neto: Calc.aportadoA(c, A.fecha) };
        if (prev) await DB.update('valoraciones', prev.id, row); else await DB.insert('valoraciones', [row]);
      }
      cambios++;
    } catch (e) { console.warn('Valoración automática', c.nombre, e); }
  }
  if (cambios) { await reloadTables('cuentas', ...(S.tablaValoraciones ? ['valoraciones'] : [])); render(); }
}
AfterLoad.push(sincronizarValoresAuto);

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
  const infos = act.map(c => ({ c, x: invInfo(c), A: valorAutoCuenta(c) }));
  const totVal = sum(infos, o => o.x.valor), totAp = sum(infos, o => o.x.aportado), totPlus = totVal - totAp;
  const cambios = infos.filter(o => o.A && o.A.cambio !== null), cambioDia = cambios.length ? sum(cambios, o => o.A.cambio) : null;
  const t = tirInversion(act);
  const mensual = aportacionMensual();
  const dimDist = S.invDist || 'producto', dist = distribucion(act, dimDist);
  const avisos = avisosInversion(act);

  el.innerHTML = `
    <div class="section-head"><div><h2>📈 Inversiones</h2><div class="small muted">${act.length} cuenta(s)${cambios.length ? ` · 📡 precios de cierre del ${fmtDate(cambios[0].A.fecha)}` : ''}</div></div>
      <button class="btn" data-action="inv-new">+ Cuenta de inversión</button></div>
    ${bannerV4()}
    ${avisos}
    ${heroInversion({ valor: totVal, aportado: totAp, plus: totPlus, cambio: cambioDia, t, mensual, titulo: 'Valor total de la cartera' })}

    <div class="inv-cuentas">${infos.map(({ c, x, A }) => `
      <div class="card inv-card2" style="--acc:${esc(c.color || '#7c3aed')}" data-action="inv-open" data-id="${c.id}" role="button" tabindex="0">
        <div class="ic2-head"><div><h3>${esc(c.nombre)}</h3><div class="small muted">${esc(c.entidad || '')}${A ? ' · 📡 automático' : x.tieneVM ? ` · valor manual ${fmtDate(c.fecha_valor_mercado)}` : ' · sin valorar'}</div></div><span class="ic2-go">›</span></div>
        <div class="ic2-val">${fmtEUR(x.valor)}</div>
        <div class="ic2-row"><span>Invertido de tu bolsillo</span><b class="num">${fmtEUR(x.aportado)}</b></div>
        <div class="ic2-row"><span>Ganancia</span><b class="num ${x.plus >= 0 ? 'pos' : 'neg'}">${signed(x.plus)} · ${x.aportado > 0 ? fmtPct(x.plus / x.aportado) : '—'}</b></div>
        ${A && A.cambio !== null ? `<div class="ic2-row"><span>Último día</span><b class="num ${A.cambio >= 0 ? 'pos' : 'neg'}">${signed(A.cambio)} · ${fmtPct(A.pctCambio, 2)}</b></div>` : ''}
        ${aportacionMensual(c.id) ? `<div class="ic2-foot">🔁 ${fmtEUR(aportacionMensual(c.id))}/mes${(p => p ? ` · próxima ${fmtDate(proximaAportacion(p))}` : '')(S.aportaciones_periodicas.find(p => p.cuenta_id === c.id && p.activo !== false && proximaAportacion(p)))}</div>` : ''}
      </div>`).join('') || '<div class="card empty">No tienes cuentas de inversión.</div>'}</div>

    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Evolución: valor vs. lo invertido</h3><span class="sub">La distancia entre las dos líneas es tu ganancia</span></div>
        ${S.valoraciones.some(v => act.some(c => c.id === v.cuenta_id)) ? '<div class="chart-box"><canvas id="ch-inv-evo"></canvas></div>' : '<div class="empty">Se irá dibujando con cada valoración diaria.</div>'}</div>
      ${tarjetaDistribucion('ch-inv-dist', dist, dimDist, '¿En qué está invertido?')}
    </div>

    <details class="card inv-more"><summary><b>⚙️ Precios automáticos y aportaciones</b> <span class="small muted">· estado de la descarga diaria y planes mensuales</span></summary>
      <div style="margin-top:12px">${renderPreciosCard()}</div>
      <div class="card" style="box-shadow:none;border:1px solid var(--line)"><div class="card-head"><h3>🔁 Aportaciones periódicas</h3></div>${S.v4 ? listaAportPeriodicas(S.aportaciones_periodicas.filter(p => inv.some(c => c.id === p.cuenta_id)), true) : bannerV4()}</div>
    </details>`;

  chartDistribucion('ch-inv-dist', dist);
  chartEvolucion('ch-inv-evo', act);
}

/** Bloque principal: valor, invertido, ganancia, variación del día y TIR. */
function heroInversion({ valor, aportado, plus, cambio, t, mensual, titulo }) {
  return `<div class="card inv-hero">
    <div class="ih-main"><div class="l">${titulo}</div><div class="ih-val">${fmtEUR(valor)}</div>
      ${cambio !== null && cambio !== undefined ? `<div class="ih-dia ${cambio >= 0 ? 'pos' : 'neg'}">${cambio >= 0 ? '▲' : '▼'} ${signed(cambio)} el último día</div>` : ''}</div>
    <div class="ih-grid">
      <div><div class="l">Invertido de tu bolsillo</div><div class="v num">${fmtEUR(aportado)}</div><div class="s">Aportaciones − retiradas</div></div>
      <div><div class="l">Ganancia</div><div class="v num ${plus >= 0 ? 'pos' : 'neg'}">${signed(plus)}</div><div class="s">${aportado > 0 ? `${plus >= 0 ? '+' : ''}${fmtPct(plus / aportado)} sobre lo invertido` : '—'}</div></div>
      <div><div class="l">Rentabilidad anual (TIR)</div><div class="v num ${t.tir !== null && t.tir >= 0 ? 'pos' : t.tir !== null ? 'neg' : ''}">${t.tir !== null ? fmtPct(t.tir, 2) : '—'}</div><div class="s">${t.tir !== null ? (t.dias < 365 ? 'Menos de 1 año: orientativa' : `Real: ${fmtPct((1 + t.tir) / (1 + supuestos().inflacion / 100) - 1, 2)} tras inflación`) : esc(t.motivo || '')}</div></div>
      <div><div class="l">Aportas</div><div class="v num">${fmtEUR(mensual)}/mes</div><div class="s">${fmtEUR(mensual * 12, 0)} al año</div></div>
    </div></div>`;
}
/** Distribución con selector Producto / Clase / Región en una sola tarjeta. */
function tarjetaDistribucion(id, dist, dim, titulo) {
  const tabs = [['producto', 'Producto'], ['clase', 'Clase'], ['region', 'Región']];
  return `<div class="card"><div class="card-head"><h3>${titulo}</h3><div class="seg seg-sm">${tabs.map(([k, l]) => `<button data-action="inv-dist" data-k="${k}" class="${dim === k ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    ${dist.length ? `<div class="dist-wrap"><div class="chart-box sm"><canvas id="${id}"></canvas></div>
      <div class="brk">${dist.map((x, i) => `<div class="r" style="grid-template-columns:1fr 60px 90px"><span><span class="cdot" style="background:${colorDe(x, i)}"></span>${esc(x.label)}</span>
        <span class="right num"><b>${fmtPct(x.pct, 1)}</b></span><span class="right num small">${fmtEUR(x.val, 0)}</span></div>`).join('')}</div></div>`
      : '<div class="empty">Añade los productos de cada cuenta (ISIN, fondo, ETF…) para ver la distribución.</div>'}</div>`;
}
/** Solo lo que requiere atención: precios que fallan, productos sin participaciones, repartos que no suman 100 %, valoraciones viejas. */
function avisosInversion(cuentas) {
  const out = [];
  const est = ((S.ajustesRows || []).find(r => r.clave === 'precios_estado') || {}).valor;
  const fallos = est && est.resultados ? est.resultados.filter(r => !r.ok) : [];
  if (fallos.length) out.push(`📡 No hay precio automático para ${fallos.map(f => esc(f.nombre || f.isin)).join(', ')}. Revisa el ISIN en el producto.`);
  if (est && est.ejecutado && diasEntre(est.ejecutado.slice(0, 10), todayISO()) > 4) out.push(`📡 La descarga de precios no se ejecuta desde el ${fmtDate(est.ejecutado.slice(0, 10))}. Revisa la tarea en GitHub (Actions → Precios diarios).`);
  for (const c of cuentas) {
    const ps = S.posiciones.filter(p => p.cuenta_id === c.id), auto = ps.filter(tieneAuto);
    const sinPart = ps.filter(p => p.isin && !(num(p.participaciones) > 0));
    if (S.v10 && sinPart.length) out.push(`<b>${esc(c.nombre)}</b>: indica las participaciones de ${sinPart.map(p => esc(p.nombre)).join(', ')} para que se valore solo.`);
    const sumPct = sum(auto, p => num(p.porcentaje));
    if (auto.length > 1 && aportacionMensual(c.id) && Math.abs(sumPct - 100) > 0.5) out.push(`<b>${esc(c.nombre)}</b>: el reparto de la aportación suma ${fmtNum(sumPct, 1)} % (debería ser 100 %). Ajusta el % de cada producto.`);
    const x = invInfo(c);
    if (!valorAutoCuenta(c) && x.diasVal !== null && x.diasVal > 60) out.push(`<b>${esc(c.nombre)}</b>: el valor se actualizó hace ${x.diasVal} días.`);
  }
  return out.length ? `<div class="banner amber inv-avisos">${out.map(t => `<div>⚠ ${t}</div>`).join('')}</div>` : '';
}

/* =====================================================================
   DETALLE DE UNA CUENTA
   ===================================================================== */
function renderInversionDetalle(c) {
  const el = $('#tab-inversiones');
  const x = invInfo(c), P = posicionesCuenta(c), A = valorAutoCuenta(c);
  const dimDist = S.invDistD || 'clase', dist = distribucion([c], dimDist);
  const planes = S.aportaciones_periodicas.filter(p => p.cuenta_id === c.id), plan = planes.find(p => p.activo !== false);
  const vals = S.valoraciones.filter(v => v.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const mensual = aportacionMensual(c.id);
  const totPeso = sum(P.ps, p => num(p.porcentaje));

  el.innerHTML = `
    <div class="section-head"><div style="display:flex;gap:10px;align-items:center"><button class="btn sm ghost" data-action="inv-back">← Inversiones</button>
      <div><h2>${esc(c.nombre)}</h2><div class="small muted">${esc(c.entidad || '')}${A ? ` · 📡 valor automático · cierre del ${fmtDate(A.fecha)}` : x.tieneVM ? ` · valor manual del ${fmtDate(c.fecha_valor_mercado)}` : ' · sin valoración de mercado'}</div></div></div>
      <div class="btn-row"><button class="btn sm primary" data-action="quick-open" data-tipo="transferencia" data-destino="${c.id}">+ Aportación puntual</button>
        ${A ? '' : `<button class="btn sm" data-action="cuenta-valor" data-id="${c.id}">Actualizar valor</button>`}
        <button class="mini" data-action="cuenta-edit" data-id="${c.id}" title="Editar cuenta">✎</button><button class="mini" data-action="cuenta-del" data-id="${c.id}" title="Eliminar">🗑</button></div></div>
    ${bannerV4()}
    ${avisosInversion([c])}
    ${heroInversion({ valor: x.valor, aportado: x.aportado, plus: x.plus, cambio: A ? A.cambio : null, t: tirInversion([c]), mensual, titulo: 'Valor de la cuenta' })}

    <div class="card"><div class="card-head"><div><h3>🧩 Tus productos</h3><div class="small muted">${A ? 'Participaciones actuales = las que indicaste + las compradas con cada aportación posterior' : 'Indica ISIN y participaciones de cada producto para que se valore solo'}</div></div>
      ${S.v4 ? `<button class="btn sm" data-action="pos-new" data-id="${c.id}">+ Producto</button>` : ''}</div>
      ${P.ps.length ? `<div class="tbl-wrap"><table class="tbl prod-tbl"><thead><tr><th>Producto</th><th class="right">Reparto aportación</th><th class="right">Participaciones</th><th class="right">Precio</th><th class="right">Valor</th><th class="right">Peso real</th><th></th></tr></thead><tbody>
        ${P.ps.map((p, i) => { const a = p.auto, pesoReal = P.V ? p.val / Math.max(P.V, P.asignado) : null, obj = num(p.porcentaje) / 100, desv = obj && pesoReal !== null ? pesoReal - obj : null;
          return `<tr><td data-l=""><span class="cdot" style="background:${PALETTE[i % PALETTE.length]}"></span><b>${esc(p.nombre)}</b>${p.isin ? `<div class="small muted">${esc(p.isin)}${isinValido(p.isin) ? '' : ' <span class="neg" title="ISIN con formato o dígito de control incorrecto">⚠</span>'}${p.isin ? ` · <a href="https://www.morningstar.es/es/funds/SecuritySearchResults.aspx?search=${esc(p.isin)}" target="_blank" rel="noopener">ficha</a>` : ''}</div>` : ''}</td>
            <td class="right num" data-l="Reparto">${num(p.porcentaje) ? `${fmtNum(num(p.porcentaje), 1)} %${mensual ? `<div class="small muted">${fmtEUR(mensual * obj)}/mes</div>` : ''}` : '<span class="muted">—</span>'}</td>
            <td class="right num" data-l="Particip.">${a ? `<b>${fmtNum(a.acciones, 4)}</b>${a.acciones - a.base > 0.00005 ? `<div class="small pos">+${fmtNum(a.acciones - a.base, 4)} desde ${fmtDate(p.fecha_participaciones).slice(0, 5)}</div>` : ''}` : (num(p.participaciones) ? fmtNum(num(p.participaciones), 4) : '<span class="muted">—</span>')}</td>
            <td class="right num" data-l="Precio">${a ? `${fmtNum(a.precio, 4)}<div class="small ${a.pctDia === null ? 'muted' : a.pctDia >= 0 ? 'pos' : 'neg'}">${a.pctDia === null ? fmtDate(a.fecha).slice(0, 5) : `${a.pctDia >= 0 ? '+' : ''}${fmtPct(a.pctDia, 2)} · ${fmtDate(a.fecha).slice(0, 5)}`}</div>` : '<span class="muted">—</span>'}</td>
            <td class="right num" data-l="Valor"><b>${fmtEUR(p.val)}</b></td>
            <td class="right num" data-l="Peso real">${pesoReal !== null ? fmtPct(pesoReal, 1) : '—'}${desv !== null && Math.abs(desv) >= 0.05 ? `<div class="small warn-t" title="Se ha desviado del reparto que eliges">${desv > 0 ? '+' : ''}${fmtNum(desv * 100, 1)} pp</div>` : ''}</td>
            <td><button class="mini" data-action="pos-edit" data-id="${p.id}">✎</button><button class="mini" data-action="pos-del" data-id="${p.id}">🗑</button></td></tr>`; }).join('')}
        ${P.resto > 0.5 && !A ? `<tr><td class="muted">Sin asignar</td><td></td><td></td><td></td><td class="right num muted">${fmtEUR(P.resto)}</td><td class="right num muted">${fmtPct(P.resto / P.V, 1)}</td><td></td></tr>` : ''}
        </tbody></table></div>
        ${totPeso && Math.abs(totPeso - 100) > 0.5 ? `<div class="small warn-t" style="margin-top:6px">El reparto suma ${fmtNum(totPeso, 1)} %: debería sumar 100 %.</div>` : ''}`
        : `<div class="empty">Añade cada fondo, ETF o acción con su ISIN, sus participaciones y el % de la aportación mensual que va a cada uno.${S.v4 ? '' : '<br>' + bannerV4()}</div>`}
    </div>

    <div class="grid-2e">
      <div class="card"><div class="card-head"><h3>🔁 Aportación mensual</h3>${S.v4 ? `<button class="btn sm" data-action="ap-new" data-id="${c.id}">+ Programar</button>` : ''}</div>
        ${plan ? `<div class="ap-plan"><div class="ap-big">${fmtEUR(plan.importe)}<span>/mes</span></div><div class="small muted">Día ${plan.dia_mes} desde ${esc((cuentaById(plan.cuenta_origen_id) || {}).nombre || '?')}${proximaAportacion(plan) ? ` · próxima el <b>${fmtDate(proximaAportacion(plan))}</b>` : ''}</div></div>
          ${A && P.ps.some(p => p.auto) ? `<div class="cz-list" style="margin-top:10px">${P.ps.filter(p => p.auto && p.auto.peso > 0).map(p => `<div><span>${esc(p.nombre)} <span class="muted small">${fmtPct(p.auto.peso, 1)}</span></span><span class="num">${fmtEUR(num(plan.importe) * p.auto.peso)} ≈ <b>${fmtNum(num(plan.importe) * p.auto.peso / p.auto.precio, 4)}</b> part.</span></div>`).join('')}</div>
            <div class="small muted">Cada mes se registra sola la transferencia, y las participaciones de cada producto suben según este reparto al precio del día en que entra el dinero.</div>` : ''}
          <div style="margin-top:8px">${listaAportPeriodicas(planes, false)}</div>`
        : (S.v4 ? '<div class="empty">Programa tu aportación mensual: se registrará sola cada mes y comprará participaciones según el reparto de cada producto.</div>' : bannerV4())}
      </div>
      <div class="card"><div class="card-head"><h3>🧾 Últimas compras</h3><span class="sub">${A ? 'Participaciones compradas con cada aportación' : 'Aportaciones y retiradas'}</span></div>
        ${A && A.compras.length ? `<div class="top-list">${A.compras.slice(0, 8).map(cm => `<div class="it"><div class="c"><b>${fmtDate(cm.fecha)}</b> ${cm.auto ? '<span class="badge blue">mensual</span>' : ''}
            <div class="small muted">${cm.items.map(it => `${esc(it.nombre)}: ${fmtNum(it.acciones, 4)} a ${fmtNum(it.precio, 4)}`).join(' · ')}</div></div><div class="num ${cm.importe >= 0 ? 'pos' : 'neg'}">${signed(cm.importe)}</div></div>`).join('')}</div>`
          : (() => { const ult = S.movimientos.filter(m => m.tipo === 'transferencia' && m.cuenta_id === c.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 8);
            return ult.length ? `<div class="top-list">${ult.map(m => `<div class="it"><div class="c"><b>${fmtDate(m.fecha)}</b> ${m.origen === 'auto' ? '<span class="badge blue">mensual</span>' : ''}<div class="small muted">${esc(m.concepto || '')}</div></div><div class="num ${num(m.importe) >= 0 ? 'pos' : 'neg'}">${signed(num(m.importe))}</div></div>`).join('')}</div>` : '<div class="empty">Sin movimientos todavía.</div>'; })()}
      </div>
    </div>

    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Evolución: valor vs. lo invertido</h3></div>${vals.length ? '<div class="chart-box"><canvas id="ch-acc-evo"></canvas></div>' : '<div class="empty">Se irá dibujando con cada valoración diaria.</div>'}</div>
      ${tarjetaDistribucion('ch-acc-dist', dist, dimDist, 'Diversificación')}
    </div>

    <details class="card inv-more"><summary><b>📋 Histórico de valoraciones y ajustes</b> <span class="small muted">· ${vals.length} valoraciones</span></summary>
      <div class="btn-row" style="margin:12px 0"><button class="btn sm" data-action="cuenta-valor" data-id="${c.id}">Fijar valor a mano</button><button class="btn sm ghost" data-action="inv-aportado" data-id="${c.id}">Ajustar lo invertido</button></div>
      ${vals.length ? `<div class="tbl-wrap" style="max-height:320px;overflow:auto"><table class="tbl"><thead><tr><th>Fecha</th><th class="right">Valor</th><th class="right">Invertido</th><th class="right">Ganancia</th><th></th></tr></thead><tbody>
        ${vals.map(v => { const ap = apVal(v), pl = num(v.valor) - ap; return `<tr><td class="small">${fmtDate(v.fecha)}</td><td class="right num">${fmtEUR(v.valor)}</td><td class="right num">${fmtEUR(ap)}</td><td class="right num ${pl >= 0 ? 'pos' : 'neg'}">${signed(pl)}</td><td><button class="mini" data-action="val-del" data-id="${v.id}">🗑</button></td></tr>`; }).join('')}
      </tbody></table></div>` : ''}
    </details>`;
  chartDistribucion('ch-acc-dist', dist);
  chartEvolucion('ch-acc-evo', [c]);
}

/* ---------- Formularios ---------- */
const FIELDS_POS = [
  { name: 'nombre', label: 'Producto', required: true, full: true, ph: 'Ej: Vanguard Global Stock Index Fund' },
  { name: 'isin', label: 'ISIN', ph: 'IE00B03HCZ61', hint: '12 caracteres; se comprueba el dígito de control' },
  { name: 'tipo_activo', label: 'Tipo de producto', type: 'select', options: Object.entries(TIPO_ACTIVO).map(([v, l]) => ({ v, l })) },
  { name: 'clase', label: 'Clase de activo', type: 'select', options: Object.entries(CLASE_ACTIVO).map(([v, l]) => ({ v, l })) },
  { name: 'region', label: 'Región', ph: 'Global, EEUU, Europa, Emergentes…' },
  { name: 'porcentaje', label: '% de cada aportación (reparto)', type: 'number', ph: 'Ej: 70', hint: 'Cuánto de cada aportación mensual va a este producto. Entre todos deben sumar 100 %' },
  { name: 'valor', label: '… o el valor en € (prevalece sobre el %)', type: 'number' },
  { name: 'participaciones', label: '📡 Participaciones', type: 'number', cls: 'v10', hint: 'Con el ISIN y las participaciones, el valor se actualiza solo cada día' },
  { name: 'fecha_participaciones', label: 'A fecha de', type: 'date', cls: 'v10', hint: 'Las aportaciones posteriores se suman solas' },
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
const camposPos = () => FIELDS_POS.filter(f => f.cls !== 'v10' || S.v10);
async function guardarPosicion(cid, id, v) {
  if (v.isin) { v.isin = v.isin.toUpperCase().replace(/\s/g, ''); if (!isinValido(v.isin)) throw new Error(`El ISIN ${v.isin} no es válido (formato o dígito de control). Revísalo o déjalo vacío.`); }
  if (v.porcentaje === null && v.valor === null && !(num(v.participaciones) > 0 && v.isin)) throw new Error('Indica el % de la cuenta, su valor en € o el ISIN con las participaciones');
  if (num(v.participaciones) > 0 && !v.fecha_participaciones) v.fecha_participaciones = todayISO();
  if (!S.v10) { delete v.participaciones; delete v.fecha_participaciones; }
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
  'inv-dist': el => { if (S.invSel) S.invDistD = el.dataset.k; else S.invDist = el.dataset.k; render(); },
  'cuenta-valor': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Valor de mercado · ${c.nombre}`, intro: `<p class="small muted">Introduce el valor total actual de la cartera (lo que muestra ${esc(c.entidad || 'el bróker')}). Las aportaciones posteriores a esta fecha se sumarán automáticamente.</p>`,
      fields: [{ name: 'valor', label: 'Valor actual (€)', type: 'number', required: true }, { name: 'fecha', label: 'Fecha', type: 'date' }], values: { valor: Calc.valor(c), fecha: todayISO() },
      onSubmit: async v => {
        const fecha = v.fecha || todayISO();
        await saveEntity('cuentas', c.id, { valor_mercado: v.valor, fecha_valor_mercado: fecha, ...(S.v7 ? { valor_actualizado: new Date().toISOString() } : {}) });
        if (S.tablaValoraciones) { await DB.insert('valoraciones', [{ cuenta_id: c.id, fecha, valor: v.valor, aportado_neto: Calc.aportadoA(c, fecha) }]); await reloadTable('valoraciones'); }
      } });
  },
  'inv-new': () => openForm({ title: 'Nueva cuenta de inversión', fields: FIELDS_CUENTA, values: { tipo: 'inversion', fecha_saldo_inicial: todayISO(), orden: S.cuentas.length + 1, activa: true, color: PALETTE[S.cuentas.length % PALETTE.length] },
    onSubmit: v => saveEntity('cuentas', null, zeroNulls({ ...v, fecha_saldo_inicial: v.fecha_saldo_inicial || todayISO(), ...(S.v7 ? { saldo_actualizado: new Date().toISOString() } : {}) }, ['saldo_inicial', 'orden'])) }),
  'inv-aportado': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Capital aportado · ${c.nombre}`, intro: '<p class="small muted">Total que has aportado de tu bolsillo a esta cuenta (aportaciones − retiradas) hasta la fecha indicada. Las aportaciones posteriores (puntuales o periódicas) se sumarán solas.</p>',
      fields: [{ name: 'saldo', label: 'Capital aportado neto (€)', type: 'number', required: true }, { name: 'fecha', label: 'Hasta el día', type: 'date' }], values: { saldo: Calc.saldo(c), fecha: todayISO() },
      onSubmit: v => saveEntity('cuentas', c.id, { saldo_inicial: v.saldo, fecha_saldo_inicial: v.fecha || todayISO(), ...(S.v7 ? { saldo_actualizado: new Date().toISOString() } : {}) }) });
  },
  'val-del': async el => {
    const v = S.valoraciones.find(x => x.id === el.dataset.id); if (!v) return;
    if (!(await confirmDlg(`¿Eliminar la valoración del ${fmtDate(v.fecha)} (${fmtEUR(v.valor)}) del histórico?`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('valoraciones', v.id); await reloadTable('valoraciones'); }, 'Valoración eliminada'); render();
  },
  'pos-new': el => openForm({ title: 'Añadir producto', fields: camposPos(), values: { tipo_activo: 'fondo', clase: 'renta_variable', orden: S.posiciones.filter(p => p.cuenta_id === el.dataset.id).length + 1 }, onSubmit: v => guardarPosicion(el.dataset.id, null, v) }),
  'pos-edit': el => { const p = S.posiciones.find(x => x.id === el.dataset.id); openForm({ title: 'Editar producto', fields: camposPos(), values: p, onSubmit: v => guardarPosicion(p.cuenta_id, p.id, v) }); },
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
