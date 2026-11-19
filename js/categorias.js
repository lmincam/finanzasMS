'use strict';
/* =====================================================================
   PESTAÑA · CATEGORÍAS Y PRESUPUESTOS
   ---------------------------------------------------------------------
   Gestor de categorías, subcategorías y presupuestos mensuales.
   Depende de: datos.js, calculos.js, ui.js
   ===================================================================== */

function renderCategorias() {
  const el = $('#tab-categorias');
  const col = tipo => {
    const roots = S.categorias.filter(c => c.tipo === tipo && !c.parent_id).sort(byOrden);
    const total = sum(roots, r => budgetOf(r));
    const anualesMes = round2(sum(S.categorias.filter(c => c.tipo === tipo && presAnual(c)), c => presAnual(c) / 12));
    const row = (c, lvl) => {
      const tags = [c.naturaleza === 'amortizacion' ? '<span class="badge green" title="Cuenta como ahorro, no como gasto">capital</span>' : '',
        S.deudas.some(d => categoriaCuota(d) === c.id) ? '<span class="badge blue" title="Se separa en intereses (gasto) y capital (ahorro)">cuota préstamo</span>' : '',
        tipo === 'gasto' ? badgeFijo(c).trim() : ''].filter(Boolean).join('');
      const pa = presAnual(c), pm = num(c.presupuesto_mensual), suma = lvl === 0 && !pa && !pm ? budgetOf(c) : 0;
      const imp = pa ? `<b>${fmtEUR(pa, 0)}</b><small>/año · ${fmtEUR(pa / 12, 0)}/mes</small>`
        : pm ? `<b>${fmtEUR(pm, 0)}</b><small>/mes</small>`
        : suma ? `<b>${fmtEUR(suma, 0)}</b><small>/mes · suma</small>` : '<small class="muted">—</small>';
      return `<div class="cat-r lvl${lvl}">
        <span class="cdot" style="background:${esc(c.color || (lvl ? '#cbd5e1' : '#94a3b8'))}"></span>
        <div class="cr-main"><div class="cr-name">${esc(c.nombre)}</div>${tags ? `<div class="cr-tags">${tags}</div>` : ''}</div>
        <div class="cr-amt">${imp}</div>
        <button class="mv-more" data-action="cat-menu" data-id="${c.id}" data-tipo="${tipo}" data-lvl="${lvl}" aria-label="Opciones de ${esc(c.nombre)}">⋯</button></div>`;
    };
    return `<div class="card"><div class="card-head"><div><h3>${tipo === 'gasto' ? '💸 Categorías de gasto' : '💰 Categorías de ingreso'}</h3>
      <div class="cat-tot"><b>${fmtEUR(total, 0)}</b> <span>${tipo === 'gasto' ? 'presupuesto' : 'previsión'} al mes</span></div>
      ${tipo === 'gasto' && anualesMes ? `<div class="small muted">De ello ${fmtEUR(anualesMes, 0)}/mes son <a href="#" data-action="anual-ver">anualidades</a></div>` : ''}</div>
      <button class="btn sm" data-action="cat-new" data-tipo="${tipo}">+ Categoría</button></div>
      <div class="cat-list">${roots.map(r => `<div class="cat-grp">${row(r, 0)}${childrenOf(r.id).map(c => row(c, 1)).join('')}</div>`).join('') || '<div class="empty">Sin categorías</div>'}</div></div>`;
  };
  el.innerHTML = `<div class="section-head"><div><h2>Presupuestos</h2></div></div>
    <div class="grid-2e">${col('gasto')}${col('ingreso')}</div>
    ${renderReglasCard()}`;
}
/** Menú ⋯ de una categoría: editar, añadir subcategoría, eliminar. */
function abrirMenuCat(el) {
  const c = catById(el.dataset.id); if (!c) return;
  const op = (a, ic, t, extra = '') => `<button class="mv-op" data-op="${a}" ${extra}>${ic} ${t}</button>`;
  const md = modal(`<h3 style="margin-bottom:10px">${esc(c.nombre)}</h3><div class="mv-ops">
    ${op('cat-edit', '✎', 'Editar (presupuesto, color, fijo…)')}
    ${el.dataset.lvl === '0' ? op('cat-new', '＋', 'Añadir subcategoría') : ''}
    ${op('cat-del', '🗑', 'Eliminar', 'style="color:var(--red)"')}</div>`);
  md.el.addEventListener('click', e => { const b = e.target.closest('[data-op]'); if (!b) return; md.close();
    const fake = { dataset: { id: c.id, tipo: el.dataset.tipo, parent: c.id } };
    Actions[b.dataset.op](fake); });
}
Actions['cat-menu'] = el => abrirMenuCat(el);
/** Etiqueta de gasto fijo: marcada por ti (📌 fijo) o detectada por la app (fijo · auto). */
function badgeFijo(c) {
  if (c.gasto_fijo === true) return ' <span class="badge" title="Marcado por ti como gasto fijo">fijo</span>';
  if (c.gasto_fijo === false || presAnual(c) || catAnualDe(c.id)) return '';
  return esGastoFijo(c.id, mesActual()) ? ' <span class="badge" title="La app lo detecta como fijo: importe casi igual cada mes. Puedes cambiarlo al editar la categoría.">fijo · auto</span>' : '';
}
function openCatForm(cat, tipo, parentId) {
  const t = cat ? cat.tipo : tipo;
  const fields = [
    { name: 'nombre', label: 'Nombre', required: true },
    { name: 'parent_id', label: 'Categoría principal', type: 'select', options: () => [{ v: '', l: '— Ninguna (es principal) —' }].concat(S.categorias.filter(c => c.tipo === t && !c.parent_id && (!cat || c.id !== cat.id)).sort(byOrden).map(c => ({ v: c.id, l: c.nombre }))) },
    ...(S.v8 && t === 'gasto'
      ? [{ name: 'periodo', label: 'El pago es…', type: 'select', options: [{ v: 'mensual', l: 'Mensual' }, { v: 'anual', l: 'Anual (anualidad: seguro, IBI, ITV…)' }] },
         { name: 'importe', label: 'Presupuesto (€)', type: 'number' },
         { name: 'fijo', label: 'Gasto fijo', type: 'select', options: [{ v: '', l: 'Que lo decida la app' }, { v: 'si', l: 'Sí: fijo (hipoteca, alquiler, cuotas…)' }, { v: 'no', l: 'No: variable' }] }]
      : [{ name: 'presupuesto_mensual', label: t === 'gasto' ? 'Presupuesto mensual (€)' : 'Previsión mensual (€)', type: 'number' }]),
    { name: 'color', label: 'Color', type: 'color' }, { name: 'orden', label: 'Orden', type: 'int' },
    ...(S.v5 && t === 'gasto' ? [{ name: 'es_amort', label: 'Es amortización de deuda (cuenta como ahorro, no como gasto)', type: 'checkbox', full: true }] : [])
  ];
  openForm({
    title: cat ? 'Editar categoría' : (parentId ? 'Nueva subcategoría' : 'Nueva categoría'), fields,
    values: cat ? { ...cat, es_amort: cat.naturaleza === 'amortizacion', periodo: presAnual(cat) ? 'anual' : 'mensual', importe: presAnual(cat) || num(cat.presupuesto_mensual) || null,
        fijo: cat.gasto_fijo === true ? 'si' : cat.gasto_fijo === false ? 'no' : '' }
      : { parent_id: parentId || '', color: PALETTE[S.categorias.length % PALETTE.length], orden: S.categorias.length + 1, periodo: 'mensual' },
    intro: S.v8 && t === 'gasto' ? '<div class="small muted" style="margin-bottom:10px">Si el pago es <b>anual</b>, pon lo que cuesta al año: la app lo reparte en 12 meses y te dice cuánto pasar cada mes a tu cuenta de anualidades. Un <b>gasto fijo</b> no avisa por estar al 100 % y va aparte en el Dashboard.</div>' : '',
    onMount: form => { const sel = form.elements.periodo, lab = sel && form.elements.importe.closest('div').querySelector('label');
      const upd = () => { if (lab) lab.textContent = sel.value === 'anual' ? 'Importe al año (€)' : 'Presupuesto mensual (€)'; };
      if (sel) { sel.addEventListener('change', upd); upd(); } },
    onSubmit: async v => {
      if (cat && v.parent_id && childrenOf(cat.id).length) throw new Error('Una categoría con subcategorías no puede convertirse en subcategoría');
      const row = { nombre: v.nombre, tipo: t, parent_id: v.parent_id || null, presupuesto_mensual: v.presupuesto_mensual || 0, color: v.color, orden: v.orden || 0 };
      if (S.v8 && t === 'gasto') {
        const anual = v.periodo === 'anual' && num(v.importe) > 0;
        row.presupuesto_anual = anual ? round2(v.importe) : null;
        row.presupuesto_mensual = anual ? round2(v.importe / 12) : (v.importe || 0);   // el equivalente mensual mantiene los totales
        row.gasto_fijo = v.fijo === 'si' ? true : v.fijo === 'no' ? false : null;
      }
      if (S.v5 && t === 'gasto') row.naturaleza = v.es_amort ? 'amortizacion' : null;
      if (cat) await DB.update('categorias', cat.id, row); else await DB.insert('categorias', [row]);
      await reloadTable('categorias');
    }
  });
}

Views.categorias = renderCategorias;

Object.assign(Actions, {
  'cat-new': el => openCatForm(null, el.dataset.tipo, el.dataset.parent),
  'cat-edit': el => openCatForm(catById(el.dataset.id)),
  'cat-del': async el => {
    const c = catById(el.dataset.id); const ids = [c.id, ...childrenOf(c.id).map(x => x.id)];
    const n = S.movimientos.filter(m => ids.includes(m.categoria_id)).length;
    if (!(await confirmDlg(`¿Eliminar <b>${esc(c.nombre)}</b>${ids.length > 1 ? ` y sus ${ids.length - 1} subcategorías` : ''}?<br>${n} movimiento(s) quedarán sin categoría.`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('categorias', c.id); await Promise.all([reloadTable('categorias'), reloadTable('movimientos')]); }, 'Categoría eliminada'); render();
  }
});
