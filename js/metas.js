'use strict';
/* =====================================================================
   METAS DE AHORRO  +  PESTAÑA "PREVISIÓN Y METAS"
   ---------------------------------------------------------------------
   Cada meta tiene objetivo, fecha y progreso. Dos modos:
     • Manual ("hucha virtual"): vas anotando lo que apartas para ella.
     • Vinculada a una cuenta: el progreso es el valor de esa cuenta
       (ideal para el fondo de emergencia o una cuenta específica).
   Calcula la aportación mensual necesaria, tu ritmo real y la fecha
   estimada en la que la conseguirás.
   Depende de: calculos.js, ui.js, prevision.js, alertas.js (mediaHistorica)
   ===================================================================== */

const ICONOS_META = ['🎯', '🛟', '🎓', '🚗', '🚐', '🏖️', '🏠', '💍', '👶', '🎁', '💻', '🩺', '📈', '✈️'];

function metaInfo(m) {
  const hoy = todayISO(), obj = num(m.importe_objetivo);
  const cta = m.modo === 'cuenta' ? cuentaById(m.cuenta_id) : null;
  const ahorrado = cta ? Math.max(0, Calc.valor(cta)) : num(m.ahorrado);
  const restante = Math.max(0, obj - ahorrado), pct = obj > 0 ? Math.min(1, ahorrado / obj) : 0;
  const conseguida = !!m.completada || (obj > 0 && ahorrado >= obj);
  const mesesRest = m.fecha_objetivo ? Math.max(1, monthsDiff(ymOf(hoy) + '-01', ymOf(m.fecha_objetivo) + '-01')) : null; // meses que quedan para apartar
  const necesariaMes = conseguida ? 0 : (mesesRest ? restante / mesesRest : null);
  // Ritmo real de los últimos 3 meses
  const hace3 = addMonths(ymOf(hoy), -3) + '-01';
  const ritmo = cta
    ? sum(S.movimientos.filter(x => x.cuenta_id === cta.id && x.tipo === 'transferencia' && x.fecha >= hace3), 'importe') / 3
    : sum((m.aportaciones || []).filter(a => a.fecha >= hace3), 'importe') / 3;
  const mesesAlRitmo = ritmo > 0 ? Math.ceil(restante / ritmo) : null;
  const fechaEstimada = conseguida ? null : (mesesAlRitmo !== null ? addMonths(ymOf(hoy), mesesAlRitmo) : null);
  let estado = 'sin_fecha';
  if (conseguida) estado = 'conseguida';
  else if (m.fecha_objetivo && m.fecha_objetivo < hoy) estado = 'vencida';
  else if (necesariaMes !== null) estado = ritmo >= necesariaMes * 0.95 ? 'en_camino' : 'retrasada';
  return { obj, ahorrado, restante, pct, conseguida, mesesRest, necesariaMes, ritmo, fechaEstimada, estado, cta };
}
const ESTADO_META = { conseguida: ['green', '✅ Conseguida'], en_camino: ['green', 'En camino'], retrasada: ['amber', 'Vas por detrás'], vencida: ['red', 'Fecha superada'], sin_fecha: ['', 'Sin fecha objetivo'] };

function renderMetasSection() {
  if (!S.v52) return '';
  const metas = [...S.metas].sort((a, b) => (num(a.prioridad) - num(b.prioridad)) || ((a.fecha_objetivo || '9') < (b.fecha_objetivo || '9') ? -1 : 1));
  const infos = metas.map(m => ({ m, x: metaInfo(m) })), act = infos.filter(o => !o.x.conseguida);
  const totObj = sum(act, o => o.x.obj), totAh = sum(act, o => o.x.ahorrado), totNec = sum(act, o => o.x.necesariaMes || 0);
  const h = mediaHistorica(mesActual(), 6), ahorroMedio = h ? h.ahorro : null;
  const hayFondo = S.metas.some(m => m.modo === 'cuenta' && cuentaById(m.cuenta_id) && cuentaById(m.cuenta_id).tipo === 'ahorro');
  const fondo = S.cuentas.find(c => c.tipo === 'ahorro' && c.activa !== false), gm = gastoMensualMedio();
  return `
    <div class="section-head" style="margin-top:22px"><div><h2>🎯 Metas de ahorro</h2><div class="small muted">Para qué ahorras, cuánto te falta y cuánto apartar cada mes</div></div>
      <div class="btn-row">${!hayFondo && fondo ? `<button class="btn" data-action="meta-fondo">+ Meta: fondo de emergencia</button>` : ''}<button class="btn primary" data-action="meta-new">+ Meta</button></div></div>
    ${act.length ? `<div class="kpis">
      ${kpi('Metas activas', fmtNum(act.length, 0), `${infos.length - act.length} conseguida(s)`, 'navy')}
      ${kpi('Ahorrado para metas', fmtEUR(totAh, 0), `de ${fmtEUR(totObj, 0)} (${fmtPct(totObj ? totAh / totObj : 0, 0)})`, 'pos')}
      ${kpi('Necesitas apartar', fmtEUR(totNec) + '/mes', 'Para llegar a tiempo a todas', totNec > (ahorroMedio || Infinity) ? 'neg' : '')}
      ${kpi('Tu ahorro medio', ahorroMedio !== null ? fmtEUR(ahorroMedio) + '/mes' : '—', ahorroMedio !== null ? (totNec > ahorroMedio ? `<b class="neg">No llega</b>: faltan ${fmtEUR(totNec - ahorroMedio)}/mes` : `<b class="pos">Llega</b>: te sobran ${fmtEUR(ahorroMedio - totNec)}/mes`) : 'Últimos 6 meses', totNec > (ahorroMedio || Infinity) ? 'warn' : 'pos')}
    </div>` : ''}
    <div class="grid-2e">${infos.map(({ m, x }) => {
      const [bc, bl] = ESTADO_META[x.estado];
      return `<div class="card" style="margin-bottom:0;${x.conseguida ? 'opacity:.8' : ''}">
        <div class="asset-head"><div class="asset-ico">${esc(m.icono || '🎯')}</div><div style="flex:1"><h3>${esc(m.nombre)}</h3>
          <div class="small muted">${x.cta ? `Vinculada a ${esc(x.cta.nombre)}` : 'Hucha virtual'}${m.fecha_objetivo ? ` · objetivo ${fmtDate(m.fecha_objetivo)}` : ''}</div></div>
          <span class="badge ${bc}">${bl}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><b style="font-size:20px">${fmtEUR(x.ahorrado, 0)}</b><span class="small muted">de ${fmtEUR(x.obj, 0)} · ${fmtPct(x.pct, 0)}</span></div>
        ${pctBar(x.pct, x.estado === 'retrasada' ? 'amber' : x.estado === 'vencida' ? 'red' : '')}
        ${!x.conseguida ? `<div class="metrics" style="margin-top:10px">
          ${metric('Te falta', fmtEUR(x.restante, 0))}
          ${metric('Apartar al mes', x.necesariaMes !== null ? fmtEUR(x.necesariaMes) : '—')}
          ${metric('Tu ritmo (3 meses)', x.ritmo > 0 ? fmtEUR(x.ritmo) + '/mes' : '—')}
          ${metric('Al ritmo actual', x.fechaEstimada ? ymLabel(x.fechaEstimada, true) : '—', x.estado === 'retrasada' ? 'warn-t' : '')}
        </div>` : ''}
        ${m.notas ? `<div class="notes">${esc(m.notas)}</div>` : ''}
        <div class="btn-row" style="margin-top:10px">${m.modo !== 'cuenta' && !x.conseguida ? `<button class="btn sm primary" data-action="meta-aportar" data-id="${m.id}">+ Apartar dinero</button>` : ''}
          ${x.cta && !x.conseguida ? `<button class="btn sm" data-action="quick-open" data-tipo="transferencia" data-destino="${x.cta.id}">+ Transferir a ${esc(x.cta.nombre)}</button>` : ''}
          <button class="mini" data-action="meta-edit" data-id="${m.id}">✎</button><button class="mini" data-action="meta-del" data-id="${m.id}">🗑</button></div>
      </div>`; }).join('') || `<div class="card empty">Aún no tienes metas. Ejemplos: fondo de emergencia${fondo && gm ? ` (${fmtEUR(gm * (num(S.ajustes.fondo_meses) || 6), 0)} = ${num(S.ajustes.fondo_meses) || 6} meses de gastos)` : ''}, estudios de los niños, cambio de coche, viaje con la autocaravana…</div>`}</div>`;
}

/* ---------- Vista combinada ---------- */
function renderPlanificacion() {
  $('#tab-planificacion').innerHTML = renderPrevisionSection() + renderMetasSection();
  chartPrevision();
}
Views.planificacion = renderPlanificacion;

/* ---------- Formularios ---------- */
const FIELDS_META = [
  { name: 'nombre', label: 'Nombre', required: true, ph: 'Ej: Estudios de los niños' },
  { name: 'icono', label: 'Icono', type: 'select', options: ICONOS_META.map(v => ({ v, l: v })) },
  { name: 'importe_objetivo', label: 'Objetivo (€)', type: 'number', required: true },
  { name: 'fecha_objetivo', label: 'Fecha objetivo', type: 'date', hint: 'Opcional, pero sin fecha no puedo calcular cuánto apartar al mes' },
  { name: 'modo', label: 'Cómo se sigue', type: 'select', options: [{ v: 'manual', l: 'Hucha virtual (voy anotando lo que aparto)' }, { v: 'cuenta', l: 'Vinculada a una cuenta (su saldo es el progreso)' }] },
  { name: 'cuenta_id', label: 'Cuenta vinculada', type: 'rawselect', html: v => accOpts(v, { empty: '— Solo si está vinculada —' }) },
  { name: 'ahorrado', label: 'Ya ahorrado (€, hucha virtual)', type: 'number' },
  { name: 'prioridad', label: 'Prioridad', type: 'select', options: [{ v: 1, l: 'Alta' }, { v: 2, l: 'Media' }, { v: 3, l: 'Baja' }] },
  { name: 'completada', label: 'Marcar como conseguida', type: 'checkbox' },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
async function guardarMeta(id, v) {
  if (v.modo === 'cuenta' && !v.cuenta_id) throw new Error('Elige la cuenta vinculada');
  const row = { ...v, prioridad: +v.prioridad || 2, cuenta_id: v.modo === 'cuenta' ? v.cuenta_id : null, ahorrado: v.ahorrado || 0 };
  if (id) await DB.update('metas', id, row); else await DB.insert('metas', [{ ...row, aportaciones: [] }]);
  await reloadTable('metas');
}

Object.assign(Actions, {
  'meta-new': () => openForm({ title: 'Nueva meta de ahorro', fields: FIELDS_META, values: { icono: '🎯', modo: 'manual', prioridad: 2 }, onSubmit: v => guardarMeta(null, v) }),
  'meta-fondo': () => { const f = S.cuentas.find(c => c.tipo === 'ahorro' && c.activa !== false), meses = num(S.ajustes.fondo_meses) || 6, gm = gastoMensualMedio();
    openForm({ title: 'Meta: fondo de emergencia', fields: FIELDS_META, values: { nombre: 'Fondo de emergencia', icono: '🛟', modo: 'cuenta', cuenta_id: f && f.id, prioridad: 1, importe_objetivo: gm ? Math.round(gm * meses / 100) * 100 : null },
      intro: `<p class="small muted">${gm ? `Tus salidas de caja medias son ${fmtEUR(gm, 0)}/mes; ${meses} meses de colchón son unos ${fmtEUR(gm * meses, 0)}.` : 'Un fondo de emergencia suele cubrir 6 meses de gastos.'}</p>`, onSubmit: v => guardarMeta(null, v) }); },
  'meta-edit': el => { const m = S.metas.find(x => x.id === el.dataset.id); openForm({ title: 'Editar meta', fields: FIELDS_META, values: m, onSubmit: v => guardarMeta(m.id, v) }); },
  'meta-del': async el => { const m = S.metas.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar la meta <b>${esc(m.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('metas', m.id); await reloadTable('metas'); }, 'Meta eliminada'); render(); },
  'meta-aportar': el => { const m = S.metas.find(x => x.id === el.dataset.id);
    openForm({ title: `Apartar dinero · ${m.nombre}`, intro: '<p class="small muted">Hucha virtual: anotas que este dinero queda reservado para la meta (no mueve dinero entre cuentas). Usa un importe negativo para retirar.</p>',
      fields: [{ name: 'importe', label: 'Importe (€)', type: 'number', required: true }, { name: 'fecha', label: 'Fecha', type: 'date' }, { name: 'nota', label: 'Nota', full: true }], values: { fecha: todayISO() },
      onSubmit: async v => {
        const ap = [...(m.aportaciones || []), { fecha: v.fecha || todayISO(), importe: v.importe, nota: v.nota || null }];
        const ahorrado = round2(num(m.ahorrado) + v.importe);
        await DB.update('metas', m.id, { aportaciones: ap, ahorrado, completada: ahorrado >= num(m.importe_objetivo) ? true : m.completada });
        await reloadTable('metas');
        if (ahorrado >= num(m.importe_objetivo)) toast(`🎉 ¡Meta “${m.nombre}” conseguida!`, 'ok', 5000);
      } }); }
});
