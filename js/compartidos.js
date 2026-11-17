'use strict';
/* =====================================================================
   GASTOS COMPARTIDOS Y REEMBOLSOS (BIZUM)
   ---------------------------------------------------------------------
   • Un gasto puede marcarse como compartido: cuánto te deben devolver
     (por ejemplo, cena de 6 de 200 € → te deben 166,67 €).
   • Un Bizum (o transferencia) recibido puede marcarse como reembolso
     de un gasto: pasa a restar de la categoría de ese gasto y en el mes
     de ese gasto, en lugar de contar como ingreso.
   • Los Bizum nunca generan reglas automáticas: el mismo amigo puede
     devolverte una cena hoy y hacerte un regalo mañana.
   Depende de: calculos.js, ui.js, cuentas.js (guardado)
   ===================================================================== */

const esBizum = (...t) => /bizum/.test(normText(t.filter(Boolean).join(' ')));
const reembolsosDe = id => S.movimientos.filter(m => m.reembolso_de === id);
function infoCompartido(g) {
  const aCobrar = num(g.a_cobrar), cobrado = sum(reembolsosDe(g.id), 'importe');
  return { aCobrar, cobrado, pendiente: round2(Math.max(0, aCobrar - cobrado)), personas: num(g.personas) || null, miParte: round2(Math.abs(num(g.importe)) - cobrado) };
}
/** Gastos compartidos con dinero pendiente de cobro (los más recientes primero). */
const gastosAbiertos = () => S.movimientos.filter(m => m.tipo === 'gasto' && num(m.a_cobrar) > 0 && infoCompartido(m).pendiente > 0.01).sort((a, b) => a.fecha < b.fecha ? 1 : -1);

/** Para un Bizum recibido, propone el gasto compartido abierto más probable. */
function sugerirReembolso(imp, fecha, pendientesImport = new Map()) {
  const cands = gastosAbiertos().filter(g => g.fecha <= fecha && diasEntre(g.fecha, fecha) <= 60)
    .map(g => ({ g, pend: infoCompartido(g).pendiente - (pendientesImport.get(g.id) || 0) })).filter(x => x.pend >= imp - 0.01)
    // Si sabes entre cuántas personas se repartió, solo propongo importes que sean la parte de 1 o varias personas
    .filter(x => { const i = infoCompartido(x.g); if (!(i.personas > 1)) return true; const parte = Math.abs(num(x.g.importe)) / i.personas;
      for (let k = 1; k < i.personas; k++) if (Math.abs(parte * k - imp) <= Math.max(0.05, parte * k * 0.01)) return true; return false; });
  if (!cands.length) return null;
  // Preferencia: importe igual a la parte de cada persona, y el más reciente
  const parte = x => { const i = infoCompartido(x.g); return i.personas > 1 ? Math.abs(num(x.g.importe)) / i.personas : null; };
  cands.sort((a, b) => { const pa = parte(a), pb = parte(b); const da = pa ? Math.abs(pa - imp) < 0.02 : false, db = pb ? Math.abs(pb - imp) < 0.02 : false; return (db - da) || (a.g.fecha < b.g.fecha ? 1 : -1); });
  return cands[0].g;
}
/** Opciones del selector "¿Qué es este Bizum?" en el importador. */
function opcionesBizum(item, items) {
  const imp = item.importe, abiertos = gastosAbiertos().filter(g => g.fecha <= item.fecha && diasEntre(g.fecha, item.fecha) <= 90);
  const desde = addMonths(ymOf(item.fecha), -2) + '-01';
  const recientes = S.movimientos.filter(m => m.tipo === 'gasto' && num(m.importe) <= -imp + 0.01 && m.fecha >= desde && m.fecha <= item.fecha && !abiertos.includes(m))
    .sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 25);
  const delImport = items.filter(x => x !== item && x.tipo === 'gasto' && x.importe <= -imp + 0.01 && !x.dup && x.sel);
  const sel = item.reembolsoDe ? 'r:' + item.reembolsoDe : item.categoria_id ? 'c:' + item.categoria_id : '';
  const o = (v, l) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
  return `<option value="">— ¿Qué es? —</option>
    ${abiertos.length ? `<optgroup label="↩ Reembolso de un gasto compartido">${abiertos.map(g => o('r:' + g.id, `👥 ${fmtDateShort(g.fecha)} ${g.concepto} · te deben ${fmtEUR(infoCompartido(g).pendiente)}`)).join('')}</optgroup>` : ''}
    ${delImport.length ? `<optgroup label="↩ Reembolso de un gasto de este Excel">${delImport.map(x => o('r:' + x.id, `${fmtDateShort(x.fecha)} ${x.concepto} · ${fmtEUR(-x.importe)}`)).join('')}</optgroup>` : ''}
    ${recientes.length ? `<optgroup label="↩ Reembolso de otro gasto reciente">${recientes.map(g => o('r:' + g.id, `${fmtDateShort(g.fecha)} ${g.concepto} · ${fmtEUR(-num(g.importe))}`)).join('')}</optgroup>` : ''}
    <optgroup label="💰 Ingreso (regalo, venta, otro)">${S.categorias.filter(c => c.tipo === 'ingreso').sort(byOrden).map(c => o('c:' + c.id, (c.parent_id ? '   ↳ ' : '') + c.nombre)).join('')}</optgroup>`;
}
/** Categoría y mes a los que se imputa un reembolso (los del gasto original). */
function destinoReembolso(id, items = []) {
  const m = S.movimientos.find(x => x.id === id);
  if (m) return { categoria_id: m.categoria_id, mes: ymOf(m.mes_imputacion), concepto: m.concepto };
  const it = items.find(x => x.id === id);
  if (it) return { categoria_id: it.categoria_id, mes: it.mes || ymOf(it.fecha), concepto: it.concepto };
  return null;
}

/* ---------- Tarjeta "Te deben" en Cuentas ---------- */
/** Chip "Te deben X €" para la cabecera de Movimientos (abre el detalle en una ventana). */
function chipPendientes() {
  if (!S.v6) return ''; const ab = gastosAbiertos(); if (!ab.length) return '';
  return `<button class="btn sm chip-deben" data-action="comp-ver">👥 Te deben ${fmtEUR(sum(ab, g => infoCompartido(g).pendiente))}</button>`;
}
Object.assign(Actions, { 'comp-ver': () => { const md = modal(renderPendientesCard()); md.el.classList.add('modal-wide'); md.el.addEventListener('click', e => { if (e.target.closest('[data-action="comp-saldar"]')) setTimeout(() => md.close(), 0); }); } });
function renderPendientesCard() {
  if (!S.v6) return '';
  const ab = gastosAbiertos();
  if (!ab.length) return '';
  const total = sum(ab, g => infoCompartido(g).pendiente);
  return `<div class="card"><div class="card-head"><h3>👥 Te deben ${fmtEUR(total)}</h3><span class="sub">${ab.length} gasto(s) compartido(s) pendientes de cobro</span></div>
    ${ab.map(g => { const i = infoCompartido(g), rs = reembolsosDe(g.id);
      return `<div class="cat-row"><span class="cname"><b>${esc(g.concepto)}</b> <span class="small muted">${fmtDate(g.fecha)} · pagaste ${fmtEUR(-num(g.importe))}${i.personas ? ` entre ${i.personas}` : ''} · cobrado ${fmtEUR(i.cobrado)}${rs.length ? ` (${rs.length} reembolso${rs.length > 1 ? 's' : ''})` : ''}</span></span>
        <b class="num warn-t">${fmtEUR(i.pendiente)}</b>
        <button class="btn sm ghost" data-action="comp-saldar" data-id="${g.id}" title="Ya no esperas cobrar más">Saldado</button></div>`; }).join('')}
    <p class="small muted" style="margin-bottom:0">Cuando lleguen los Bizum, el importador te propondrá asignarlos a estos gastos. Lo cobrado resta de la categoría del gasto (p. ej. Restaurantes) en el mes en que pagaste.</p></div>`;
}

/* ---------- Acciones ---------- */
async function vincularReembolso(mov, gastoId) {
  const g = S.movimientos.find(x => x.id === gastoId); if (!g) throw new Error('No encuentro el gasto');
  await DB.update('movimientos', mov.id, { tipo: 'gasto', categoria_id: g.categoria_id, mes_imputacion: g.mes_imputacion, reembolso_de: g.id, transfer_id: null, cuenta_contraria_id: null, subtipo_transferencia: null });
  await reloadTable('movimientos');
}
Object.assign(Actions, {
  'mov-compartir': el => {
    const g = S.movimientos.find(x => x.id === el.dataset.id); if (!g) return;
    const total = Math.abs(num(g.importe)), i = infoCompartido(g);
    openForm({ title: `Gasto compartido · ${g.concepto}`, intro: `<p class="small muted">Pagaste <b>${fmtEUR(total)}</b>. Indica entre cuántas personas se reparte (contándote a ti) o directamente cuánto te tienen que devolver. Lo que te devuelvan restará de <b>${esc(catName(g.categoria_id) || 'su categoría')}</b>.</p>`,
      fields: [{ name: 'personas', label: 'Personas en total (contándote)', type: 'int' }, { name: 'a_cobrar', label: 'O importe que te deben (€)', type: 'number', hint: 'Si lo dejas vacío se calcula con las personas' }],
      values: { personas: i.personas || null, a_cobrar: num(g.a_cobrar) || null },
      onSubmit: async v => {
        let aCobrar = v.a_cobrar;
        if (aCobrar === null) { if (!(v.personas > 1)) throw new Error('Indica al menos 2 personas o el importe que te deben'); aCobrar = round2(total * (v.personas - 1) / v.personas); }
        if (aCobrar > total) throw new Error('No te pueden deber más de lo que pagaste');
        await DB.update('movimientos', g.id, { a_cobrar: aCobrar || null, personas: v.personas || null }); await reloadTable('movimientos');
        toast(`Te deben ${fmtEUR(aCobrar)} ✓`, 'ok');
      } });
  },
  'mov-reembolso': el => {
    const m = S.movimientos.find(x => x.id === el.dataset.id); if (!m) return;
    const fake = { ...m, importe: num(m.importe), mes: ymOf(m.mes_imputacion) };
    openForm({ title: 'Es un reembolso de…', intro: `<p class="small muted">${esc(m.concepto)} · <b>${fmtEUR(num(m.importe))}</b>. Al vincularlo restará del gasto original (su categoría y su mes) y dejará de contar como ingreso.</p>`,
      fields: [{ name: 'dest', label: 'Gasto que te están devolviendo', type: 'rawselect', html: () => opcionesBizum(fake, []).replace(/<optgroup label="💰[\s\S]*?<\/optgroup>/, '') }],
      onSubmit: async v => { if (!v.dest || !v.dest.startsWith('r:')) throw new Error('Elige el gasto'); await vincularReembolso(m, v.dest.slice(2)); toast('Reembolso vinculado ✓', 'ok'); } });
  },
  'mov-desvincular': async el => {
    const m = S.movimientos.find(x => x.id === el.dataset.id); if (!m) return;
    if (!(await confirmDlg('¿Quitar el vínculo con el gasto? Volverá a contar como ingreso sin categoría.', 'Quitar vínculo', false))) return;
    await withSaving(null, async () => { await DB.update('movimientos', m.id, { reembolso_de: null, tipo: 'ingreso', categoria_id: null, mes_imputacion: ymOf(m.fecha) + '-01' }); await reloadTable('movimientos'); }, 'Vínculo quitado'); render();
  },
  'comp-saldar': async el => {
    const g = S.movimientos.find(x => x.id === el.dataset.id), i = infoCompartido(g);
    if (!(await confirmDlg(`¿Dar por saldado <b>${esc(g.concepto)}</b>? Ya no esperarás cobrar los ${fmtEUR(i.pendiente)} pendientes y ese importe quedará como gasto tuyo.`, 'Saldado', false))) return;
    await withSaving(null, async () => { await DB.update('movimientos', g.id, { a_cobrar: i.cobrado || null }); await reloadTable('movimientos'); }, 'Saldado ✓'); render();
  }
});
