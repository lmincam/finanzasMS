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
    const row = (c, lvl) => `<div class="cat-row lvl${lvl}"><span class="cdot" style="background:${esc(c.color || (lvl ? '#cbd5e1' : '#94a3b8'))}"></span><span class="cname">${esc(c.nombre)}</span>
      <span class="cbud">${num(c.presupuesto_mensual) ? fmtEUR(c.presupuesto_mensual) + '/mes' : (lvl === 0 && budgetOf(c) ? `<span class="muted">Σ ${fmtEUR(budgetOf(c))}</span>` : '')}</span>
      ${lvl === 0 ? `<button class="mini" data-action="cat-new" data-tipo="${tipo}" data-parent="${c.id}" title="Añadir subcategoría">+ sub</button>` : ''}
      <button class="mini" data-action="cat-edit" data-id="${c.id}">✎</button><button class="mini" data-action="cat-del" data-id="${c.id}">🗑</button></div>`;
    return `<div class="card"><div class="card-head"><div><h3>${tipo === 'gasto' ? '💸 Categorías de gasto' : '💰 Categorías de ingreso'}</h3>
      <div class="small muted">${tipo === 'gasto' ? 'Presupuesto' : 'Previsión'} mensual total: <b>${fmtEUR(total)}</b></div></div>
      <button class="btn sm" data-action="cat-new" data-tipo="${tipo}">+ Categoría</button></div>
      ${roots.map(r => row(r, 0) + childrenOf(r.id).map(c => row(c, 1)).join('')).join('') || '<div class="empty">Sin categorías</div>'}</div>`;
  };
  el.innerHTML = `<div class="section-head"><div><h2>🏷️ Categorías y presupuestos</h2><div class="small muted">Si una categoría principal no tiene presupuesto propio, se usa la suma (Σ) de sus subcategorías.</div></div></div>
    <div class="grid-2e">${col('gasto')}${col('ingreso')}</div>
    ${renderReglasCard()}`;
}
function openCatForm(cat, tipo, parentId) {
  const t = cat ? cat.tipo : tipo;
  const fields = [
    { name: 'nombre', label: 'Nombre', required: true },
    { name: 'parent_id', label: 'Categoría principal', type: 'select', options: () => [{ v: '', l: '— Ninguna (es principal) —' }].concat(S.categorias.filter(c => c.tipo === t && !c.parent_id && (!cat || c.id !== cat.id)).sort(byOrden).map(c => ({ v: c.id, l: c.nombre }))) },
    { name: 'presupuesto_mensual', label: t === 'gasto' ? 'Presupuesto mensual (€)' : 'Previsión mensual (€)', type: 'number' },
    { name: 'color', label: 'Color', type: 'color' }, { name: 'orden', label: 'Orden', type: 'int' }
  ];
  openForm({
    title: cat ? 'Editar categoría' : (parentId ? 'Nueva subcategoría' : 'Nueva categoría'), fields,
    values: cat || { parent_id: parentId || '', color: PALETTE[S.categorias.length % PALETTE.length], orden: S.categorias.length + 1 },
    onSubmit: async v => {
      if (cat && v.parent_id && childrenOf(cat.id).length) throw new Error('Una categoría con subcategorías no puede convertirse en subcategoría');
      const row = { nombre: v.nombre, tipo: t, parent_id: v.parent_id || null, presupuesto_mensual: v.presupuesto_mensual || 0, color: v.color, orden: v.orden || 0 };
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
