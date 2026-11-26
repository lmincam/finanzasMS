'use strict';
/* =====================================================================
   PESTAÑA · SEGUROS
   ---------------------------------------------------------------------
   Pólizas activas de la familia: coste anual, recibos, vencimientos y
   renovaciones, coberturas y vínculo con vehículos e inmuebles.
   Depende de: datos.js, calculos.js (seguroInfo), ui.js, graficos.js, deudas.js (camposV4, bannerV4)
   ===================================================================== */

/** Pequeño resumen de los seguros vinculados a un vehículo o inmueble (se usa en sus fichas). */
function segurosDe(campo, id) {
  const ss = S.seguros.filter(s => s[campo] === id && s.activo !== false);
  if (!ss.length) return '';
  return `<div class="small" style="margin-top:10px">${ss.map(s => { const x = seguroInfo(s);
    return `🛡️ <b>${esc(s.aseguradora || s.nombre)}</b> · ${fmtEUR(x.prima, 0)}/año${x.venc ? ` · vence ${fmtDate(x.venc)}` : ''}`; }).join('<br>')}</div>`;
}
/** Prima anual de los seguros vinculados a un vehículo (o su gasto_seguro si no hay pólizas registradas). */
const seguroVehiculo = v => { const ss = S.seguros.filter(s => s.vehiculo_id === v.id && s.activo !== false); return ss.length ? sum(ss, 'prima_anual') : num(v.gasto_seguro); };

function renderSeguros() {
  const el = $('#tab-seguros');
  if (!S.v4) { el.innerHTML = `<div class="section-head"><h2>Seguros</h2></div>${bannerV4()}`; return; }
  const act = S.seguros.filter(s => s.activo !== false), inact = S.seguros.filter(s => s.activo === false);
  const infos = act.map(s => ({ s, x: seguroInfo(s) }));
  const total = sum(infos, o => o.x.prima);
  const prox = infos.filter(o => o.x.dias !== null && o.x.dias >= 0).sort((a, b) => a.x.dias - b.x.dias);
  const porTipo = Object.keys(TIPO_SEGURO).map(t => ({ t, items: infos.filter(o => (o.s.tipo || 'otro') === t) })).filter(g => g.items.length);
  const vencenPronto = infos.filter(o => o.x.dias !== null && o.x.dias <= 45);
  // Recibos de los próximos 12 meses (según forma de pago y fecha de vencimiento/renovación)
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(ymOf(todayISO()), i));
  const recibosMes = meses.map(m => sum(infos, o => {
    const f = FREQ_PAGO[o.s.forma_pago] || 1, ref = o.x.venc || o.s.fecha_inicio; if (!ref) return f === 12 ? o.x.recibo : 0;
    const diff = ((monthsDiff(ymOf(ref) + '-01', m + '-01') % 12) + 12) % 12; return diff % (12 / f) === 0 ? o.x.recibo : 0;
  }));

  el.innerHTML = `
    <div class="section-head"><div><h2>Seguros</h2></div>
      <button class="btn" data-action="seg-new">+ Seguro</button></div>
    ${!S.seguros.length ? `<div class="card"><div class="empty">Aún no has añadido ningún seguro.<br><br><button class="btn primary" data-action="seg-new">+ Añadir el primero</button><div class="small muted" style="margin-top:10px">Coche, hogar, vida, salud… La app te avisará antes de cada renovación.</div></div></div>` : ''}
    <div class="kpis" ${!S.seguros.length ? 'hidden' : ''}>
      ${kpi('Pólizas activas', fmtNum(act.length, 0), inact.length ? `${inact.length} dada(s) de baja` : '', 'navy')}
      ${kpi('Coste anual total', fmtEUR(total), `<span class="seg-kpi-mes">${fmtEUR(total / 12)}/mes</span>`, 'warn', true)}
      ${prox.length ? kpi('Próximo vencimiento', fmtDate(prox[0].x.venc), `${esc(prox[0].s.nombre)} · en ${prox[0].x.dias} días`) : ''}
      ${vencenPronto.length ? kpi('Renovaciones en 45 días', fmtNum(vencenPronto.length, 0), 'Buen momento para comparar precios', 'warn') : ''}
    </div>
    ${vencenPronto.length ? `<div class="banner amber">📅 Vencen pronto: ${vencenPronto.map(o => `<b>${esc(o.s.nombre)}</b> (${fmtDate(o.x.venc)}${o.s.renovacion_auto === false ? ', <u>no se renueva sola</u>' : ''})`).join(' · ')}. Pide otros presupuestos antes de que renueve.</div>` : ''}
    ${act.length ? `<div class="grid-2">
      <div class="card"><div class="card-head"><h3>Recibos previstos</h3><span class="sub">Próximos 12 meses según forma de pago</span></div><div class="chart-box sm"><canvas id="ch-seg-rec"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>Coste anual por tipo</h3></div><div class="chart-box sm"><canvas id="ch-seg-tipo"></canvas></div></div>
    </div>` : ''}
    ${porTipo.map(g => `<div class="sub-title grp-title"><span>${TIPO_SEGURO[g.t]}</span><span class="muted">${fmtEUR(sum(g.items, o => o.x.prima) / 12)}/mes · ${fmtEUR(sum(g.items, o => o.x.prima), 0)}/año</span></div>
      <div class="grid-2e" style="margin-bottom:16px">${g.items.map(({ s, x }) => tarjetaSeguro(s, x)).join('')}</div>`).join('')}
    ${inact.length ? `<details class="card"><summary>Pólizas dadas de baja (${inact.length})</summary><div class="grid-2e" style="margin-top:10px">${inact.map(s => tarjetaSeguro(s, seguroInfo(s))).join('')}</div></details>` : ''}`;

  if (act.length) {
    mkChart('ch-seg-rec', { type: 'bar', data: { labels: meses.map(m => ymLabel(m, true)), datasets: [{ label: 'Recibos', data: recibosMes.map(round2), backgroundColor: '#1e3a8a', borderRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: euroAxis, x: { grid: { display: false } } } } });
    mkChart('ch-seg-tipo', { type: 'doughnut', data: { labels: porTipo.map(g => TIPO_SEGURO[g.t]), datasets: [{ data: porTipo.map(g => round2(sum(g.items, o => o.x.prima))), backgroundColor: porTipo.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: Tema.hueco(), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right' } } } });
  }
}
function tarjetaSeguro(s, x) {
  const veh = s.vehiculo_id && S.vehiculos.find(v => v.id === s.vehiculo_id), inm = s.inmueble_id && S.inmuebles.find(i => i.id === s.inmueble_id), cta = s.cuenta_id && cuentaById(s.cuenta_id);
  const urg = x.dias !== null && x.dias <= 45;
  return `<div class="card" style="margin-bottom:0;${s.activo === false ? 'opacity:.6' : ''}">
    <div class="asset-head"><div class="asset-ico">${(TIPO_SEGURO[s.tipo] || '📄').split(' ')[0]}</div><div style="flex:1"><h3>${esc(s.nombre)}</h3>
      <div class="small muted">${[s.aseguradora, s.poliza ? 'Póliza ' + s.poliza : '', veh ? veh.nombre : '', inm ? inm.nombre : '', s.asegurado].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="seg-mes"><b>${fmtEUR(x.prima / 12)}</b><span>al mes</span></div>
      <button class="mini" data-action="seg-edit" data-id="${s.id}" title="Editar">✎</button><button class="mini" data-action="seg-del" data-id="${s.id}" title="Eliminar">🗑</button></div>
    <div class="metrics">
      ${metric('Prima anual', fmtEUR(x.prima))}${Math.abs(x.recibo - x.prima) > 0.5 ? metric(`Recibo ${s.forma_pago || 'anual'}`, fmtEUR(x.recibo)) : ''}
      ${metric('Vencimiento', x.venc ? `${fmtDate(x.venc)}${x.dias !== null && x.dias >= 0 ? ` <span class="small ${urg ? 'warn-t' : 'muted'}">(${x.dias} d)</span>` : ''}` : '—', urg ? 'warn-t' : '')}
      ${metric('Renovación', s.renovacion_auto === false ? 'Manual' : 'Automática')}
      ${s.capital_asegurado ? metric(s.tipo === 'hogar' ? 'Continente' : 'Capital asegurado', fmtEUR(s.capital_asegurado, 0)) : ''}${s.tipo === 'hogar' && s.capital_contenido ? metric('Contenido', fmtEUR(s.capital_contenido, 0)) : ''}${s.franquicia ? metric('Franquicia', fmtEUR(s.franquicia, 0)) : ''}
    </div>
    ${s.coberturas ? `<div class="small" style="margin-top:10px;white-space:pre-wrap"><b>Coberturas:</b> ${esc(s.coberturas)}</div>` : ''}
    ${s.telefono_asistencia || cta ? `<div class="small muted" style="margin-top:6px">${s.telefono_asistencia ? `📞 Asistencia: <a href="tel:${esc(s.telefono_asistencia.replace(/\s/g, ''))}">${esc(s.telefono_asistencia)}</a>` : ''}${cta ? ` · Cargo en ${esc(cta.nombre)}` : ''}</div>` : ''}
    ${s.notas ? `<div class="notes">${esc(s.notas)}</div>` : ''}</div>`;
}

const FIELDS_SEG = [
  { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPO_SEGURO).map(([v, l]) => ({ v, l })) },
  { name: 'nombre', label: 'Nombre', required: true, ph: 'Ej: Seguro coche todo riesgo' },
  { name: 'aseguradora', label: 'Aseguradora' }, { name: 'poliza', label: 'Nº de póliza' },
  { name: 'tomador', label: 'Tomador' }, { name: 'asegurado', label: 'Asegurado / bien', ph: 'Persona, mascota…', cls: 'sg sg-salud sg-vida sg-mascota sg-decesos sg-accidentes sg-viaje sg-otro' },
  { name: 'vehiculo_id', label: 'Vehículo asegurado', cls: 'sg sg-vehiculo', type: 'select', options: () => [{ v: '', l: '— Ninguno —' }].concat(S.vehiculos.map(v => ({ v: v.id, l: v.nombre }))) },
  { name: 'inmueble_id', label: 'Vivienda asegurada', cls: 'sg sg-hogar', type: 'select', options: () => [{ v: '', l: '— Ninguno —' }].concat(S.inmuebles.map(i => ({ v: i.id, l: i.nombre }))) },
  { name: 'prima_anual', label: 'Prima anual total (€)', type: 'number', required: true },
  { name: 'forma_pago', label: 'Forma de pago', type: 'select', options: Object.keys(FREQ_PAGO).map(k => ({ v: k, l: k[0].toUpperCase() + k.slice(1) })) },
  { name: 'fecha_inicio', label: 'Fecha de alta', type: 'date' }, { name: 'fecha_vencimiento', label: 'Fecha de vencimiento / renovación', type: 'date' },
  { name: 'capital_asegurado', label: 'Capital asegurado (€)', type: 'number', cls: 'sg sg-vehiculo sg-hogar sg-vida sg-decesos sg-responsabilidad_civil sg-accidentes sg-otro' }, { name: 'franquicia', label: 'Franquicia (€)', type: 'number', cls: 'sg sg-vehiculo sg-hogar sg-salud sg-mascota sg-responsabilidad_civil sg-otro' },
  { name: 'capital_contenido', label: 'Capital de contenido (€)', type: 'number', cls: 'v12 sg sg-hogar', hint: 'Lo que cubre de muebles, aparatos y enseres' },
  { name: 'telefono_asistencia', label: 'Teléfono de asistencia', type: 'tel' },
  { name: 'cuenta_id', label: 'Cuenta de cargo', type: 'rawselect', html: v => accOpts(v, { empty: '— Sin indicar —' }) },
  { name: 'coberturas', label: 'Coberturas principales', type: 'textarea', full: true, ph: 'Todo riesgo con franquicia, asistencia en viaje, lunas…' },
  { name: 'renovacion_auto', label: 'Se renueva automáticamente', type: 'checkbox', def: true },
  { name: 'activo', label: 'Póliza en vigor', type: 'checkbox', def: true },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
const limpiarSeg = v => {
  const t = v.tipo, vale = n => { const f = FIELDS_SEG.find(x => x.name === n); return !f || !(f.cls || '').includes('sg ') || f.cls.split(' ').includes('sg-' + t); };
  const out = { ...v, vehiculo_id: v.vehiculo_id || null, inmueble_id: v.inmueble_id || null, cuenta_id: v.cuenta_id || null, prima_anual: v.prima_anual || 0 };
  // Lo que no corresponde al tipo elegido se vacía (p. ej. el contenido en un seguro de coche)
  for (const n of ['asegurado', 'vehiculo_id', 'inmueble_id', 'capital_asegurado', 'franquicia', 'capital_contenido']) if (n in out && !vale(n)) out[n] = null;
  return out;
};
/** Textos de cada tipo de seguro: el formulario se adapta al tipo elegido. */
const SEG_TXT = {
  vehiculo: { nombre: 'Ej: Coche todo riesgo con franquicia', capital: 'Valor asegurado del vehículo (€)', cob: 'Todo riesgo con franquicia, asistencia en viaje, lunas…' },
  hogar: { nombre: 'Ej: Hogar vivienda habitual', capital: 'Continente: la vivienda (€)', cob: 'Daños por agua, robo, responsabilidad civil, asistencia 24 h…' },
  salud: { nombre: 'Ej: Salud familiar', aseg: 'Quiénes están cubiertos', asegPh: 'Ej: los cuatro de la familia', cob: 'Cuadro médico, copagos, dental…' },
  vida: { nombre: 'Ej: Vida vinculado a la hipoteca', aseg: 'Persona asegurada', capital: 'Capital en caso de fallecimiento (€)', cob: 'Fallecimiento, invalidez absoluta…' },
  mascota: { nombre: 'Ej: Seguro del perro', aseg: 'Mascota', asegPh: 'Nombre y especie', cob: 'Responsabilidad civil, veterinario…' },
  decesos: { nombre: 'Ej: Decesos familiar', aseg: 'Personas cubiertas', capital: 'Capital del servicio (€)', cob: 'Servicio funerario, traslado…' },
  responsabilidad_civil: { nombre: 'Ej: RC familiar', capital: 'Límite de cobertura (€)', cob: 'Daños a terceros…' },
  accidentes: { nombre: 'Ej: Accidentes personales', aseg: 'Persona asegurada', capital: 'Capital asegurado (€)', cob: 'Fallecimiento o invalidez por accidente…' },
  viaje: { nombre: 'Ej: Seguro de viaje anual', aseg: 'Viajeros cubiertos', cob: 'Asistencia médica, cancelación, equipaje…' },
  otro: { nombre: 'Nombre del seguro', aseg: 'Asegurado / bien', capital: 'Capital asegurado (€)', cob: 'Coberturas principales' }
};
function adaptarFormSeg(md) {
  const form = md.el.querySelector('form') || md.el, sel = form.querySelector('[name="tipo"]'); if (!sel) return;
  const setLabel = (n, t) => { const i = form.querySelector(`[name="${n}"]`); const l = i && form.querySelector(`label[for="${i.id}"]`); if (l && t) l.textContent = t; };
  const ajustar = () => {
    const t = sel.value, T = SEG_TXT[t] || SEG_TXT.otro;
    form.querySelectorAll('.sg').forEach(w => { w.style.display = w.classList.contains('sg-' + t) ? '' : 'none'; });
    setLabel('capital_asegurado', T.capital || 'Capital asegurado (€)'); setLabel('asegurado', T.aseg || 'Asegurado / bien');
    const ph = (n, v) => { const i = form.querySelector(`[name="${n}"]`); if (i && v) i.placeholder = v; };
    ph('nombre', T.nombre); ph('asegurado', T.asegPh || ''); ph('coberturas', T.cob);
  };
  sel.addEventListener('change', ajustar); ajustar();
}

Views.seguros = renderSeguros;

Object.assign(Actions, {
  'seg-new': () => adaptarFormSeg(openForm({ title: 'Nuevo seguro', fields: camposV4(FIELDS_SEG), values: { tipo: 'vehiculo', forma_pago: 'anual', renovacion_auto: true, activo: true }, onSubmit: v => saveEntity('seguros', null, limpiarSeg(v)) })),
  'seg-edit': el => { const s = S.seguros.find(x => x.id === el.dataset.id); adaptarFormSeg(openForm({ title: 'Editar seguro', fields: camposV4(FIELDS_SEG), values: s, onSubmit: v => saveEntity('seguros', s.id, limpiarSeg(v)) })); },
  'seg-del': async el => {
    const s = S.seguros.find(x => x.id === el.dataset.id);
    if (!(await confirmDlg(`¿Eliminar <b>${esc(s.nombre)}</b>?<br><span class="small">Si solo la has dado de baja, mejor edítala y desmarca “Póliza en vigor” para conservar el histórico.</span>`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('seguros', s.id); await reloadTable('seguros'); }, 'Seguro eliminado'); render();
  }
});
