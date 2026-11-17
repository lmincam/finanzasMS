'use strict';
/* =====================================================================
   PESTAÑA · VEHÍCULOS
   ---------------------------------------------------------------------
   Ficha de cada vehículo (valor, depreciación, gastos fijos) y su
   libro de mantenimiento: lo que se le ha hecho en el taller, cuánto
   costó y cuándo toca lo siguiente (por fecha o por kilómetros).
   Tabla: mantenimientos (bloque 14 del SQL).
   Depende de: datos.js, ui.js, seguros.js
   ===================================================================== */

const TIPOS_MANT = {
  revision: '🔧 Revisión / aceite y filtros', itv: '📋 ITV', neumaticos: '🛞 Neumáticos', frenos: '🛑 Frenos', bateria: '🔋 Batería',
  distribucion: '⚙️ Distribución / correas', aire: '❄️ Aire acondicionado', averia: '🚨 Avería / reparación', carroceria: '🚗 Carrocería / chapa',
  limpieza: '🧽 Limpieza / estética', otro: '📝 Otro'
};
const FIELDS_VEH = [
  { name: 'tipo', label: 'Tipo', type: 'select', options: [{ v: 'coche', l: '🚗 Coche' }, { v: 'moto', l: '🏍️ Moto' }, { v: 'autocaravana', l: '🚐 Autocaravana' }, { v: 'otro', l: 'Otro' }] },
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'marca_modelo', label: 'Marca y modelo' }, { name: 'matricula', label: 'Matrícula' },
  { name: 'anio', label: 'Año', type: 'int' }, { name: 'fecha_compra', label: 'Fecha de compra', type: 'date' }, { name: 'km', label: 'Kilómetros actuales', type: 'int' },
  { name: 'valor_compra', label: 'Valor de compra (€)', type: 'number' }, { name: 'valor_actual', label: 'Valor actual de mercado (€)', type: 'number' },
  { name: 'fecha_valoracion', label: 'Fecha de la valoración', type: 'date' },
  { name: 'gasto_seguro', label: 'Seguro anual (€)', type: 'number' }, { name: 'gasto_impuesto', label: 'Impuesto circulación (€)', type: 'number' },
  { name: 'gasto_mantenimiento', label: 'Mantenimiento anual estimado (€)', type: 'number' },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true, ph: 'Cualquier otra cosa que quieras recordar' }
];
const FIELDS_MANT = [
  { name: 'fecha', label: 'Fecha', type: 'date', required: true }, { name: 'tipo', label: 'Qué se hizo', type: 'select', options: Object.entries(TIPOS_MANT).map(([v, l]) => ({ v, l })) },
  { name: 'descripcion', label: 'Detalle', full: true, ph: 'Cambio de aceite 5W30, filtros de aire y habitáculo…' },
  { name: 'km', label: 'Kilómetros', type: 'int' }, { name: 'coste', label: 'Coste (€)', type: 'number' },
  { name: 'taller', label: 'Taller', ph: 'Nombre del taller' },
  { name: 'proxima_fecha', label: 'Próxima vez (fecha)', type: 'date', hint: 'Opcional: te avisa cuando se acerque' },
  { name: 'proximo_km', label: 'Próxima vez (km)', type: 'int', hint: 'Opcional' },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];

const mantDe = vid => (S.mantenimientos || []).filter(m => m.vehiculo_id === vid).sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : num(b.km) - num(a.km));
/** Lo que toca hacer próximamente: para cada tipo, el último registro con próxima fecha/km. */
function proximosMant(v) {
  const hoy = todayISO(), vistos = new Set(), out = [];
  for (const m of mantDe(v.id)) {
    if (vistos.has(m.tipo)) continue; vistos.add(m.tipo);
    if (!m.proxima_fecha && !num(m.proximo_km)) continue;
    const dias = m.proxima_fecha ? diasEntre(hoy, m.proxima_fecha) : null;
    const kmRest = num(m.proximo_km) && num(v.km) ? num(m.proximo_km) - num(v.km) : null;
    const nivel = (dias !== null && dias < 0) || (kmRest !== null && kmRest < 0) ? 'red' : (dias !== null && dias <= 45) || (kmRest !== null && kmRest <= 1500) ? 'amber' : 'ok';
    out.push({ m, dias, kmRest, nivel });
  }
  return out.sort((a, b) => ({ red: 0, amber: 1, ok: 2 }[a.nivel] - { red: 0, amber: 1, ok: 2 }[b.nivel]));
}

function renderVehiculos() {
  const el = $('#tab-vehiculos');
  const totVeh = sum(S.vehiculos, 'valor_actual'), totVehC = sum(S.vehiculos, 'valor_compra');
  const anio = todayISO().slice(0, 4), gastoAnio = sum((S.mantenimientos || []).filter(m => String(m.fecha).startsWith(anio)), 'coste');
  const sinTabla = S.missing && S.missing.has('mantenimientos');
  el.innerHTML = `
    <div class="section-head"><div><h2>Vehículos</h2><div class="small muted">${S.vehiculos.length} vehículo(s)</div></div>
      <button class="btn" data-action="veh-new">+ Vehículo</button></div>
    ${S.vehiculos.length ? `<div class="kpis">
      ${kpi('Valor de los vehículos', fmtEUR(totVeh, 0), '', 'navy', true)}
      ${kpi('Depreciación acumulada', fmtEUR(totVehC - totVeh, 0), '', 'neg')}
      ${kpi(`Taller en ${anio}`, fmtEUR(gastoAnio, 0), '', 'warn')}
    </div>` : ''}
    ${sinTabla ? '<div class="banner amber">Ejecuta el SQL actualizado (<code>sql/esquema_completo.sql</code>, bloque 14) para activar el libro de mantenimiento.</div>' : ''}
    ${S.vehiculos.map(v => tarjetaVehiculo(v, sinTabla)).join('') || `<div class="card"><div class="empty">Aún no has añadido ningún vehículo.<br><br><button class="btn primary" data-action="veh-new">+ Añadir el primero</button></div></div>`}`;
}
function tarjetaVehiculo(v, sinTabla) {
  const dep = num(v.valor_compra) - num(v.valor_actual);
  const desde = v.fecha_compra || (v.anio ? `${v.anio}-07-01` : null);
  const anios = desde ? Math.max(0.5, monthsDiff(desde, todayISO()) / 12) : null;
  const gastos = num(v.gasto_seguro) + num(v.gasto_impuesto) + num(v.gasto_mantenimiento);
  const lista = mantDe(v.id), prox = proximosMant(v), abierto = S.vehAbierto === v.id, verN = abierto ? lista.length : 4;
  const totalMant = sum(lista, 'coste');
  return `<div class="card veh-card">
    <div class="asset-head"><div class="asset-ico">${VEH_ICON[v.tipo] || '🚙'}</div><div style="flex:1"><h3>${esc(v.nombre)}</h3>
      <div class="small muted">${[v.marca_modelo, v.matricula, v.anio, v.km ? fmtNum(v.km, 0) + ' km' : ''].filter(Boolean).map(esc).join(' · ') || 'Completa la ficha'}</div></div>
      <button class="mini" data-action="veh-edit" data-id="${v.id}">✎</button><button class="mini" data-action="veh-del" data-id="${v.id}">🗑</button></div>
    <div class="metrics">
      ${metric('Valor de compra', fmtEUR(v.valor_compra, 0))}${metric('Valor actual', fmtEUR(v.valor_actual, 0))}
      ${metric('Depreciación', `${fmtEUR(dep, 0)} <span class="small">${num(v.valor_compra) ? fmtPct(dep / num(v.valor_compra), 0) : ''}</span>`, 'neg')}
      ${metric('Depreciación anual media', anios ? fmtEUR(dep / anios, 0) : '—')}
      ${metric('Gastos fijos anuales', fmtEUR(gastos, 0))}${metric('Coste mensual fijo', fmtEUR(gastos / 12, 0))}
    </div>
    ${sinTabla ? '' : `
    <div class="mant-head"><div class="sub-title" style="margin:0">Mantenimiento${lista.length ? ` <span class="muted small">· ${lista.length} registro(s) · ${fmtEUR(totalMant, 0)} en total</span>` : ''}</div>
      <button class="btn sm primary" data-action="mant-new" data-id="${v.id}">+ Mantenimiento</button></div>
    ${prox.length ? `<div class="mant-prox">${prox.map(p => `<div class="mp ${p.nivel}"><b>${esc(TIPOS_MANT[p.m.tipo] || p.m.tipo)}</b>
      <span>${p.m.proxima_fecha ? `${p.dias < 0 ? `venció hace ${-p.dias} días` : p.dias === 0 ? 'hoy' : `en ${p.dias} días`} (${fmtDate(p.m.proxima_fecha)})` : ''}${p.m.proxima_fecha && num(p.m.proximo_km) ? ' · ' : ''}${num(p.m.proximo_km) ? `${fmtNum(p.m.proximo_km, 0)} km${p.kmRest !== null ? ` (${p.kmRest < 0 ? `pasado ${fmtNum(-p.kmRest, 0)} km` : `faltan ${fmtNum(p.kmRest, 0)} km`})` : ''}` : ''}</span></div>`).join('')}</div>` : ''}
    ${lista.length ? `<div class="mant-list">${lista.slice(0, verN).map(m => `
      <div class="mant-row" data-action="mant-edit" data-id="${m.id}" role="button" tabindex="0">
        <div class="mant-f"><b>${fmtDate(m.fecha)}</b>${num(m.km) ? `<span>${fmtNum(m.km, 0)} km</span>` : ''}</div>
        <div class="mant-c"><div class="mant-t">${esc(TIPOS_MANT[m.tipo] || m.tipo || 'Mantenimiento')}</div>
          <div class="small muted">${[m.descripcion, m.taller].filter(Boolean).map(esc).join(' · ')}</div>${m.notas ? `<div class="small muted">${esc(m.notas)}</div>` : ''}</div>
        <div class="mant-e num">${num(m.coste) ? fmtEUR(m.coste) : ''}</div>
      </div>`).join('')}</div>
      ${lista.length > 4 ? `<div style="text-align:center;margin-top:6px"><button class="btn sm ghost" data-action="mant-toggle" data-id="${v.id}">${abierto ? 'Ver menos' : `Ver los ${lista.length}`}</button></div>` : ''}`
      : '<div class="small muted">Apunta aquí cada visita al taller (revisiones, ITV, neumáticos…) para tener el historial a mano.</div>'}`}
    ${segurosDe('vehiculo_id', v.id)}
    ${v.notas ? `<div class="notes">${esc(v.notas)}</div>` : ''}</div>`;
}

/** Al guardar un mantenimiento con más km que la ficha, actualiza los km del vehículo. */
async function guardarMant(id, v) {
  await saveEntity('mantenimientos', id, v);
  const veh = S.vehiculos.find(x => x.id === v.vehiculo_id);
  if (veh && num(v.km) > num(veh.km)) { await DB.update('vehiculos', veh.id, { km: v.km }); await reloadTable('vehiculos'); }
}

Views.vehiculos = renderVehiculos;

Object.assign(Actions, {
  'veh-new': () => openForm({ title: 'Nuevo vehículo', fields: FIELDS_VEH, values: { tipo: 'coche' }, onSubmit: v => saveEntity('vehiculos', null, v) }),
  'veh-edit': el => { const v0 = S.vehiculos.find(x => x.id === el.dataset.id); openForm({ title: 'Editar vehículo', fields: FIELDS_VEH, values: v0, onSubmit: v => saveEntity('vehiculos', v0.id, v) }); },
  'veh-del': async el => { const v = S.vehiculos.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(v.nombre)}</b>? También se borrará su historial de mantenimiento.`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('vehiculos', v.id); await Promise.all([reloadTable('vehiculos'), S.missing.has('mantenimientos') ? null : reloadTable('mantenimientos')]); }, 'Eliminado'); render(); },
  'mant-new': el => { const v = S.vehiculos.find(x => x.id === el.dataset.id);
    openForm({ title: `Mantenimiento · ${v.nombre}`, fields: FIELDS_MANT, values: { fecha: todayISO(), tipo: 'revision', km: v.km || null }, onSubmit: x => guardarMant(null, { ...x, vehiculo_id: v.id }) }); },
  'mant-edit': el => { const m = S.mantenimientos.find(x => x.id === el.dataset.id); const v = S.vehiculos.find(x => x.id === m.vehiculo_id);
    const md = openForm({ title: `Mantenimiento · ${v ? v.nombre : ''}`, fields: FIELDS_MANT, values: m, onSubmit: x => guardarMant(m.id, { ...x, vehiculo_id: m.vehiculo_id }) });
    const acts = md.el.querySelector('.actions');
    acts.insertAdjacentHTML('afterbegin', '<button type="button" class="btn danger" data-del style="margin-right:auto">Eliminar</button>');
    acts.querySelector('[data-del]').addEventListener('click', async () => { if (!(await confirmDlg('¿Eliminar este registro de mantenimiento?', 'Eliminar'))) return; md.close();
      await withSaving(null, async () => { await DB.remove('mantenimientos', m.id); await reloadTable('mantenimientos'); }, 'Eliminado'); render(); }); },
  'mant-toggle': el => { S.vehAbierto = S.vehAbierto === el.dataset.id ? null : el.dataset.id; render(); }
});
