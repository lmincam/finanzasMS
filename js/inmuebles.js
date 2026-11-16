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
    <div class="section-head"><h2>🏠 Inmuebles</h2><button class="btn" data-action="inm-new">+ Inmueble</button></div>
    ${infos.map(({ i, x }) => `<div class="card">
      <div class="asset-head"><div class="asset-ico">🏠</div><div style="flex:1"><h3>${esc(i.nombre)}</h3><div class="small muted">${esc(i.descripcion || '')}${i.direccion ? ' · ' + esc(i.direccion) : ''}${i.fecha_valoracion ? ` · Valorado a ${fmtDate(i.fecha_valoracion)}` : ''}</div></div>
        <button class="mini" data-action="inm-edit" data-id="${i.id}">✎</button><button class="mini" data-action="inm-del" data-id="${i.id}">🗑</button></div>
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
      </div><div class="small muted" style="margin-top:6px">Neta = renta × (12 − ${fmtNum(num(i.meses_vacio), 1)} meses vacío) − gastos anuales (${fmtEUR(x.gastos, 0)}: IBI, comunidad, seguro, mantenimiento). Antes de impuestos.</div>`
      : '<div class="small muted">Introduce una renta mensual estimada (✎) para calcular la rentabilidad bruta y neta.</div>'}
      ${i.notas ? `<div class="notes">${esc(i.notas)}</div>` : ''}
    </div>`).join('') || '<div class="card empty">Sin inmuebles</div>'}

    <div class="section-head"><h2>🚗 Vehículos</h2><button class="btn" data-action="veh-new">+ Vehículo</button></div>
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
        ${v.notas ? `<div class="notes">🔧 ${esc(v.notas)}</div>` : ''}</div>`;
    }).join('') || '<div class="card empty">Sin vehículos</div>'}</div>`;
}
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

Object.assign(Actions, {
  'inm-new': () => openForm({ title: 'Nuevo inmueble', fields: FIELDS_INM, values: {}, onSubmit: v => saveEntity('inmuebles', null, v) }),
  'inm-edit': el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); openForm({ title: 'Editar inmueble', fields: FIELDS_INM, values: i, onSubmit: v => saveEntity('inmuebles', i.id, v) }); },
  'inm-del': async el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(i.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('inmuebles', i.id); await Promise.all([reloadTable('inmuebles'), reloadTable('deudas')]); }, 'Eliminado'); render(); },
  'veh-new': () => openForm({ title: 'Nuevo vehículo', fields: FIELDS_VEH, values: { tipo: 'coche' }, onSubmit: v => saveEntity('vehiculos', null, v) }),
  'veh-edit': el => { const v0 = S.vehiculos.find(x => x.id === el.dataset.id); openForm({ title: 'Editar vehículo', fields: FIELDS_VEH, values: v0, onSubmit: v => saveEntity('vehiculos', v0.id, v) }); },
  'veh-del': async el => { const v = S.vehiculos.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(v.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('vehiculos', v.id); await reloadTable('vehiculos'); }, 'Eliminado'); render(); }
});
