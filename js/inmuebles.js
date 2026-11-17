'use strict';
/* =====================================================================
   PESTAÑA · INMUEBLES Y VEHÍCULOS
   ---------------------------------------------------------------------
   Valoración, plusvalía, rentabilidad de alquiler y fichas de vehículos.
   Depende de: datos.js, calculos.js, ui.js
   ===================================================================== */

function renderPatrimonio() {
  const el = $('#tab-patrimonio');
  const infos = S.inmuebles.map(i => ({ i, x: inmuebleInfo(i) }));
  const totVM = sum(infos, o => o.x.vm), totPlus = sum(infos, o => o.x.plusvalia), totNeto = sum(infos, o => o.x.neto);
  const totVeh = sum(S.vehiculos, 'valor_actual'), totVehC = sum(S.vehiculos, 'valor_compra');
  el.innerHTML = `
    <div class="kpis">
      ${kpi('Valor inmuebles', fmtEUR(totVM, 0), `${S.inmuebles.length} inmueble(s)`, 'navy')}
      ${kpi('Plusvalía latente', `<span class="${totPlus >= 0 ? 'pos' : 'neg'}">${signed(totPlus)}</span>`, 'Valor mercado − coste adquisición', totPlus >= 0 ? 'pos' : 'neg')}
      ${kpi('Valor neto inmobiliario', fmtEUR(totNeto, 0), 'Descontada la hipoteca pendiente')}
      ${kpi('Valor vehículos', fmtEUR(totVeh, 0), `Depreciación acumulada ${fmtEUR(totVehC - totVeh, 0)}`, 'warn')}
    </div>
    <div class="section-head"><h2>Inmuebles</h2><button class="btn" data-action="inm-new">+ Inmueble</button></div>
    ${infos.map(({ i, x }) => `<div class="card">
      <div class="asset-head"><div class="asset-ico">🏠</div><div style="flex:1"><h3>${esc(i.nombre)}</h3><div class="small muted">${esc(i.descripcion || '')}${i.direccion ? ' · ' + esc(i.direccion) : ''}${i.fecha_valoracion ? ` · Valorado a ${fmtDate(i.fecha_valoracion)}` : ''}</div></div>
        <button class="mini" data-action="inm-edit" data-id="${i.id}">✎</button><button class="mini" data-action="inm-del" data-id="${i.id}">🗑</button></div>
      ${bloqueM2(i, x)}
      <div class="sub-title">Valoración patrimonial</div>
      <div class="metrics">
        ${metric('Coste de adquisición', fmtEUR(x.coste, 0))}${metric('Valor de mercado', fmtEUR(x.vm, 0))}
        ${metric('Plusvalía latente', `${signed(x.plusvalia)} <span class="small">${fmtPct(x.plusPct)}</span>`, x.plusvalia >= 0 ? 'pos' : 'neg')}
        ${metric('Hipoteca pendiente', fmtEUR(x.deuda, 0), 'neg')}${metric('Valor neto', fmtEUR(x.neto, 0))}${metric('LTV (deuda/valor)', fmtPct(x.ltv))}
      </div>
      <div class="sub-title">Rentabilidad potencial si se alquilase</div>
      ${x.renta ? `<div class="metrics">
        ${metric('Renta mensual estimada', fmtEUR(x.renta))}${metric('Rent. bruta s/ valor', fmtPct(x.brutaVM, 2))}${metric('Rent. bruta s/ coste', fmtPct(x.brutaCoste, 2))}
        ${metric('Rent. neta s/ valor', fmtPct(x.netaVM, 2), 'pos')}${metric('Rent. neta s/ coste', fmtPct(x.netaCoste, 2), 'pos')}
        ${metric('Cash-flow mensual tras cuota', fmtEUR(x.cashflow), x.cashflow >= 0 ? 'pos' : 'neg')}
      </div>`
      : '<div class="small muted">Introduce una renta mensual estimada (✎) para calcular la rentabilidad bruta y neta.</div>'}
      ${segurosDe('inmueble_id', i.id)}
      ${i.notas ? `<div class="notes">${esc(i.notas)}</div>` : ''}
    </div>`).join('') || '<div class="card empty">Sin inmuebles</div>'}

    <div class="section-head"><h2>Vehículos</h2><button class="btn" data-action="veh-new">+ Vehículo</button></div>
    <div class="grid-2e">${S.vehiculos.map(v => {
      const dep = num(v.valor_compra) - num(v.valor_actual);
      const desde = v.fecha_compra || (v.anio ? `${v.anio}-07-01` : null);
      const anios = desde ? Math.max(0.5, monthsDiff(desde, todayISO()) / 12) : null;
      const gastos = num(v.gasto_seguro) + num(v.gasto_impuesto) + num(v.gasto_mantenimiento);
      return `<div class="card" style="margin-bottom:0">
        <div class="asset-head"><div class="asset-ico">${VEH_ICON[v.tipo] || '🚙'}</div><div style="flex:1"><h3>${esc(v.nombre)}</h3>
          <div class="small muted">${[v.marca_modelo, v.matricula, v.anio, v.km ? fmtNum(v.km, 0) + ' km' : ''].filter(Boolean).map(esc).join(' · ') || 'Completa la ficha'}</div></div>
          <button class="mini" data-action="veh-edit" data-id="${v.id}">✎</button><button class="mini" data-action="veh-del" data-id="${v.id}">🗑</button></div>
        <div class="metrics">
          ${metric('Valor de compra', fmtEUR(v.valor_compra, 0))}${metric('Valor actual', fmtEUR(v.valor_actual, 0))}
          ${metric('Depreciación', `${fmtEUR(dep, 0)} <span class="small">${num(v.valor_compra) ? fmtPct(dep / num(v.valor_compra), 0) : ''}</span>`, 'neg')}
          ${metric('Depreciación anual media', anios ? fmtEUR(dep / anios, 0) : '—')}
          ${metric('Gastos fijos anuales', fmtEUR(gastos, 0))}${metric('Coste mensual fijo', fmtEUR(gastos / 12, 0))}
        </div>
        ${segurosDe('vehiculo_id', v.id)}
        ${v.notas ? `<div class="notes">🔧 ${esc(v.notas)}</div>` : ''}</div>`;
    }).join('') || '<div class="card empty">Sin vehículos</div>'}</div>`;
  infos.forEach(({ i }, k) => chartM2(`ch-m2-${k}`, i));
}

/* ---------- Valoración automática por €/m² ---------- */
function bloqueM2(i, x) {
  if (!S.v4) return '';
  const idx = S.inmuebles.indexOf(i), hist = S.precios_m2.filter(p => p.inmueble_id === i.id);
  if (!x.m2) return `<div class="banner blue">Añade los m² construidos y el precio medio €/m² de tu zona (✎) para calcular automáticamente el valor de venta y el alquiler.</div>`;
  const desact = x.diasM2 === null || x.diasM2 > 100;
  return `<div class="sub-title">Valoración por m² ${i.valor_automatico !== false ? '<span class="badge green">automática</span>' : '<span class="badge">manual</span>'}</div>
    ${desact ? `<div class="banner amber" style="margin-bottom:10px">${x.diasM2 === null ? 'Aún no has metido el €/m² de tu zona.' : `El €/m² tiene ${x.diasM2} días.`} Actualízalo este trimestre. <button class="btn sm" data-action="inm-m2" data-id="${i.id}">Actualizar €/m²</button></div>` : ''}
    <div class="metrics">
      ${metric('Superficie', `${fmtNum(x.m2, 0)} m²${num(i.metros_utiles) ? ` <span class="small">(${fmtNum(num(i.metros_utiles), 0)} útiles)</span>` : ''}`)}
      ${metric('€/m² venta zona', i.precio_m2_venta ? fmtEUR(i.precio_m2_venta, 0) : '—')}
      ${metric('€/m² alquiler zona', i.precio_m2_alquiler ? fmtEUR(i.precio_m2_alquiler) + '/mes' : '—')}
      ${metric('Ajuste propio', `${num(i.ajuste_pct) >= 0 ? '+' : ''}${fmtNum(num(i.ajuste_pct), 1)} %`)}
      ${metric('Precio de venta estimado', x.ventaCalc !== null ? fmtEUR(x.ventaCalc, 0) : '—', 'pos')}
      ${metric('Alquiler estimado', x.rentaCalc !== null ? fmtEUR(x.rentaCalc, 0) + '/mes' : '—', 'pos')}
      ${metric('Tu coste por m²', x.costeM2 ? fmtEUR(x.costeM2, 0) : '—')}
      ${metric('Actualizado', i.fecha_precio_m2 ? fmtDate(i.fecha_precio_m2) : '—')}
    </div>
    <div class="btn-row" style="margin-top:8px"><button class="btn sm primary" data-action="inm-m2" data-id="${i.id}">Actualizar €/m² del trimestre</button></div>
    ${hist.length >= 2 ? `<div class="chart-box sm" style="margin-top:10px"><canvas id="ch-m2-${idx}"></canvas></div>` : ''}`;
}
function chartM2(id, i) {
  const h = S.precios_m2.filter(p => p.inmueble_id === i.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  if (h.length < 2) return;
  mkChart(id, { type: 'line', data: { labels: h.map(p => fmtDate(p.fecha)), datasets: [
    { label: '€/m² venta', data: h.map(p => num(p.m2_venta)), borderColor: '#1e3a8a', backgroundColor: '#1e3a8a', tension: .25, yAxisID: 'y' },
    { label: '€/m² alquiler (mes)', data: h.map(p => num(p.m2_alquiler)), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: .25, yAxisID: 'y1' }
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtEUR(ctx.parsed.y)}` } } },
    scales: { y: { ...euroAxis, title: { display: true, text: 'Venta €/m²' } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: v => fmtNum(v, 1) + ' €' }, title: { display: true, text: 'Alquiler €/m²' } }, x: { grid: { display: false } } } } });
}
/** Guarda un inmueble aplicando la valoración automática y registrando el histórico de €/m² si ha cambiado. */
async function guardarInmueble(id, v) {
  const prev = id ? S.inmuebles.find(x => x.id === id) : null;
  if (S.v4 && v.valor_automatico !== false) {
    const c = calcM2(v);
    if (c.ventaCalc !== null) { v.valor_mercado = c.ventaCalc; v.fecha_valoracion = v.fecha_precio_m2 || todayISO(); }
    if (c.rentaCalc !== null) v.renta_mensual = c.rentaCalc;
  }
  let saved;
  if (id) saved = (await DB.update('inmuebles', id, v))[0]; else saved = (await DB.insert('inmuebles', [v]))[0];
  const cambio = !prev || num(prev.precio_m2_venta) !== num(v.precio_m2_venta) || num(prev.precio_m2_alquiler) !== num(v.precio_m2_alquiler);
  if (S.v4 && saved && cambio && (num(v.precio_m2_venta) || num(v.precio_m2_alquiler))) {
    const c = calcM2(v);
    await DB.insert('precios_m2', [{ inmueble_id: saved.id, fecha: v.fecha_precio_m2 || todayISO(), m2_venta: v.precio_m2_venta, m2_alquiler: v.precio_m2_alquiler, valor_venta: c.ventaCalc, renta_mensual: c.rentaCalc }]);
    await reloadTable('precios_m2');
  }
  await reloadTable('inmuebles');
}
const FIELDS_INM_M2 = [
  { name: 'referencia_catastral', label: 'Referencia catastral', cls: 'v4', ph: '20 caracteres' },
  { name: 'url_precios', label: 'Enlace al informe de precios de tu zona', cls: 'v4', ph: 'https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/…' },
  { name: 'metros_construidos', label: 'm² construidos', type: 'number', cls: 'v4', hint: 'Los que figuran en el Catastro' },
  { name: 'metros_utiles', label: 'm² útiles', type: 'number', cls: 'v4' },
  { name: 'precio_m2_venta', label: 'Precio medio venta zona (€/m²)', type: 'number', cls: 'v4' },
  { name: 'precio_m2_alquiler', label: 'Precio medio alquiler zona (€/m²/mes)', type: 'number', cls: 'v4' },
  { name: 'fecha_precio_m2', label: 'Fecha de esos precios', type: 'date', cls: 'v4' },
  { name: 'ajuste_pct', label: 'Ajuste propio (%)', type: 'number', cls: 'v4', hint: '+ reformado, exterior, ático… / − a reformar, bajo…' },
  { name: 'valor_anejos', label: 'Valor parking + trastero (€)', type: 'number', cls: 'v4', hint: 'Si no están incluidos en los m²' },
  { name: 'renta_anejos', label: 'Alquiler parking + trastero (€/mes)', type: 'number', cls: 'v4' },
  { name: 'valor_automatico', label: 'Usar el cálculo por m² como valor de mercado y renta estimada', type: 'checkbox', def: true, full: true, cls: 'v4' }
];
const FIELDS_INM = [
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'descripcion', label: 'Descripción', ph: 'Piso + plaza de parking + trastero' },
  { name: 'direccion', label: 'Dirección', full: true },
  { name: 'fecha_compra', label: 'Fecha de compra', type: 'date' }, { name: 'precio_compra', label: 'Precio de compra (€)', type: 'number' },
  { name: 'gastos_adquisicion', label: 'Gastos de adquisición (€)', type: 'number', hint: 'Impuestos, notaría, registro, gestoría, reformas' },
  { name: 'valor_mercado', label: 'Valor actual de mercado (€)', type: 'number' }, { name: 'fecha_valoracion', label: 'Fecha de la valoración', type: 'date' },
  { name: 'renta_mensual', label: 'Renta mensual estimada (€)', type: 'number', hint: 'Para calcular la rentabilidad potencial' },
  { name: 'meses_vacio', label: 'Meses vacío / año', type: 'number', ph: '0', hint: 'Prudente: 0,5 – 1' },
  { name: 'gastos_ibi', label: 'IBI anual (€)', type: 'number' }, { name: 'gastos_comunidad', label: 'Comunidad anual (€)', type: 'number' },
  { name: 'gastos_seguro', label: 'Seguro anual (€)', type: 'number' }, { name: 'gastos_mantenimiento', label: 'Mantenimiento anual (€)', type: 'number' },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
const FIELDS_VEH = [
  { name: 'tipo', label: 'Tipo', type: 'select', options: [{ v: 'coche', l: '🚗 Coche' }, { v: 'moto', l: '🏍️ Moto' }, { v: 'autocaravana', l: '🚐 Autocaravana' }, { v: 'otro', l: 'Otro' }] },
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'marca_modelo', label: 'Marca y modelo' }, { name: 'matricula', label: 'Matrícula' },
  { name: 'anio', label: 'Año', type: 'int' }, { name: 'fecha_compra', label: 'Fecha de compra', type: 'date' }, { name: 'km', label: 'Kilómetros', type: 'int' },
  { name: 'valor_compra', label: 'Valor de compra (€)', type: 'number' }, { name: 'valor_actual', label: 'Valor actual de mercado (€)', type: 'number' },
  { name: 'fecha_valoracion', label: 'Fecha de la valoración', type: 'date' },
  { name: 'gasto_seguro', label: 'Seguro anual (€)', type: 'number' }, { name: 'gasto_impuesto', label: 'Impuesto circulación (€)', type: 'number' },
  { name: 'gasto_mantenimiento', label: 'Mantenimiento anual estimado (€)', type: 'number' },
  { name: 'notas', label: 'Notas de mantenimiento / gastos', type: 'textarea', full: true, ph: 'ITV, revisiones, neumáticos, averías…' }
];

Views.patrimonio = renderPatrimonio;

/** Campos del formulario: los de m² solo si la migración v4 está aplicada. */
const camposInm = () => camposV4([...FIELDS_INM.slice(0, 3), ...FIELDS_INM_M2, ...FIELDS_INM.slice(3)]);
/** Copia editable de un inmueble (sin id ni metadatos). */
const stripInm = i => { const o = { ...i }; delete o.id; delete o.created_at; return o; };

Object.assign(Actions, {
  'inm-new': () => openForm({ title: 'Nuevo inmueble', fields: camposInm(), values: { valor_automatico: true }, onSubmit: v => guardarInmueble(null, v) }),
  'inm-edit': el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); openForm({ title: 'Editar inmueble', fields: camposInm(), values: i, onSubmit: v => guardarInmueble(i.id, v) }); },
  'inm-m2': el => {
    const i = S.inmuebles.find(x => x.id === el.dataset.id);
    openForm({ title: `€/m² del trimestre · ${i.nombre}`, intro: `<p class="small muted">Copia el precio medio de venta y de alquiler de tu barrio o municipio del último informe de precios${i.url_precios ? ` (<a href="${esc(i.url_precios)}" target="_blank" rel="noopener">abrir informe ↗</a>)` : ''}. La app recalcula el valor y la renta y guarda el histórico.</p>`,
      fields: [{ name: 'precio_m2_venta', label: 'Venta (€/m²)', type: 'number' }, { name: 'precio_m2_alquiler', label: 'Alquiler (€/m²/mes)', type: 'number' }, { name: 'fecha_precio_m2', label: 'Fecha', type: 'date' }],
      values: { precio_m2_venta: i.precio_m2_venta, precio_m2_alquiler: i.precio_m2_alquiler, fecha_precio_m2: todayISO() },
      onSubmit: v => guardarInmueble(i.id, { ...stripInm(i), ...v, fecha_precio_m2: v.fecha_precio_m2 || todayISO() }) });
  },
  'inm-del': async el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(i.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('inmuebles', i.id); await Promise.all([reloadTable('inmuebles'), reloadTable('deudas')]); }, 'Eliminado'); render(); },
  'veh-new': () => openForm({ title: 'Nuevo vehículo', fields: FIELDS_VEH, values: { tipo: 'coche' }, onSubmit: v => saveEntity('vehiculos', null, v) }),
  'veh-edit': el => { const v0 = S.vehiculos.find(x => x.id === el.dataset.id); openForm({ title: 'Editar vehículo', fields: FIELDS_VEH, values: v0, onSubmit: v => saveEntity('vehiculos', v0.id, v) }); },
  'veh-del': async el => { const v = S.vehiculos.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(v.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('vehiculos', v.id); await reloadTable('vehiculos'); }, 'Eliminado'); render(); }
});
