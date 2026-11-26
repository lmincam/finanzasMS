'use strict';
/* =====================================================================
   PESTAÑA · PERTENENCIAS
   ---------------------------------------------------------------------
   Inventario de lo que hay en cada vivienda (tecnología, electrodomésticos,
   muebles, cosas del bebé…). NO suma al patrimonio neto: se enseña aparte
   como "patrimonio con pertenencias". Sirve sobre todo para:
     · comprobar que el contenido del seguro de hogar de cada vivienda
       cubre lo que costaría reponerlo todo
     · tener a mano fechas de compra, precios y garantías
   Cada objeto tiene dos valores:
     · reposición: lo que costaría comprarlo nuevo hoy (por defecto, lo que costó)
     · venta estimada: se deprecia sola según la categoría (o la que pongas tú)
   Tabla: pertenencias (bloque 15 del SQL). Seguros: columna capital_contenido.
   Depende de: datos.js, ui.js, seguros.js, inmuebles.js
   ===================================================================== */

/** d1: pérdida el primer año · d: pérdida anual después · min: lo mínimo que conserva (fracción del precio). Orientativo. */
const CAT_PERT = {
  tecnologia: { l: 'Tecnología', ico: 'phone', d1: 0.35, d: 0.22, min: 0.08 },
  electro: { l: 'Electrodomésticos', ico: 'bolt', d1: 0.30, d: 0.12, min: 0.10 },
  cocina: { l: 'Cocina y menaje', ico: 'fork', d1: 0.25, d: 0.10, min: 0.20 },
  muebles: { l: 'Muebles y decoración', ico: 'home', d1: 0.45, d: 0.10, min: 0.10 },
  bebe: { l: 'Bebé y niños', ico: 'baby', d1: 0.35, d: 0.10, min: 0.25 },
  deporte: { l: 'Deporte y ocio', ico: 'dumbbell', d1: 0.35, d: 0.12, min: 0.15 },
  herramientas: { l: 'Herramientas y bricolaje', ico: 'tool', d1: 0.30, d: 0.08, min: 0.25 },
  joyas: { l: 'Joyas y relojes', ico: 'gift', d1: 0.25, d: 0.00, min: 0.75 },
  otros: { l: 'Otros', ico: 'tag', d1: 0.40, d: 0.15, min: 0.10 }
};
const GARANTIA_ANIOS = 3;   // garantía legal en España para compras desde 2022

const pertOk = () => !(S.missing && S.missing.has('pertenencias'));
const aniosDesde = f => f ? Math.max(0, (Date.parse(todayISO()) - Date.parse(f)) / (365.25 * 864e5)) : 0;
function garantiaDe(p) {
  if (p.garantia_hasta) return p.garantia_hasta;
  if (!p.fecha_compra) return null;
  // Mismo día y mes, N años después (sin pasar por la hora local: en España daba un día menos). 29/02 → 28/02.
  const [y, m, d] = p.fecha_compra.slice(0, 10).split('-').map(Number), Y = y + GARANTIA_ANIOS;
  return `${Y}-${pad(m)}-${pad(Math.min(d, daysInMonth(Y, m)))}`;
}
/** Valores de un objeto: reposición, venta estimada y estado de la garantía. */
function pertInfo(p) {
  const c = CAT_PERT[p.categoria] || CAT_PERT.otros, precio = num(p.precio_compra), t = aniosDesde(p.fecha_compra);
  const factor = t <= 1 ? 1 - c.d1 * t : (1 - c.d1) * Math.pow(1 - c.d, t - 1);
  const ventaAuto = round2(precio * Math.max(c.min, factor));
  const venta = p.valor_venta !== null && p.valor_venta !== undefined && p.valor_venta !== '' ? num(p.valor_venta) : ventaAuto;
  const repo = p.valor_reposicion !== null && p.valor_reposicion !== undefined && p.valor_reposicion !== '' ? num(p.valor_reposicion) : precio;
  const g = garantiaDe(p), gDias = g ? diasEntre(todayISO(), g) : null;
  return { cat: c, repo, venta, ventaAuto, manual: venta !== ventaAuto, anios: t, garantia: g, gDias };
}
/** Totales (de todo o de una vivienda: id, 'sin' = sin asignar). */
function pertTotales(inmuebleId) {
  const L = (S.pertenencias || []).filter(p => inmuebleId === undefined ? true : inmuebleId === 'sin' ? !p.inmueble_id : p.inmueble_id === inmuebleId);
  return { n: L.length, repo: round2(sum(L, p => pertInfo(p).repo)), venta: round2(sum(L, p => pertInfo(p).venta)), lista: L };
}
/** Seguro de hogar en vigor de una vivienda y si su contenido cubre la reposición. */
function coberturaHogar(inmuebleId) {
  const seg = S.seguros.filter(s => s.activo !== false && s.tipo === 'hogar' && s.inmueble_id === inmuebleId);
  const cont = sum(seg, s => num(s.capital_contenido)), repo = pertTotales(inmuebleId).repo;
  return { seg, cont, repo, falta: round2(repo - cont), sinDato: seg.length > 0 && !seg.some(s => num(s.capital_contenido) > 0) };
}

function renderPertenencias() {
  const el = $('#tab-pertenencias');
  if (!pertOk()) {
    el.innerHTML = `<div class="section-head"><h2>Pertenencias</h2></div>
      <div class="banner amber"><span>Ejecuta el SQL actualizado (<code>sql/esquema_completo.sql</code>, bloque 15) para activar el inventario de pertenencias.</span></div>`;
    return;
  }
  const T = pertTotales(), P = Calc.patrimonio();
  const casas = [...S.inmuebles.map(i => ({ id: i.id, nombre: i.nombre })), ...(T.lista.some(p => !p.inmueble_id) || !S.inmuebles.length ? [{ id: 'sin', nombre: S.inmuebles.length ? 'Sin vivienda asignada' : 'Casa' }] : [])];
  el.innerHTML = `
    <div class="section-head"><div><h2>Pertenencias</h2><div class="small muted">No suman al patrimonio neto · ${T.n} objeto(s)</div></div>
      <button class="btn" data-action="pert-new">+ Pertenencia</button></div>
    ${T.n ? `<div class="kpis">
      ${kpi('Valor de reposición', fmtEUR(T.repo, 0), 'lo que costaría comprarlo todo nuevo', 'navy', true)}
      ${kpi('Valor de venta estimado', fmtEUR(T.venta, 0), 'lo que sacaríais vendiéndolo', '', true)}
      ${kpi('Patrimonio con pertenencias', fmtEUR(P.neto + T.venta, 0), `neto ${fmtEUR(P.neto, 0)} + venta estimada`, '', true)}
    </div>` : ''}
    ${T.n ? casas.map(c => tarjetaCasa(c)).join('') : `<div class="card"><div class="empty">Apunta aquí lo que tenéis en casa (tecnología, electrodomésticos, muebles, cosas del bebé…) para saber cuánto vale y si el seguro de hogar lo cubre.<br><br><button class="btn primary" data-action="pert-new">+ Añadir la primera</button></div></div>`}`;
}
function tarjetaCasa(c) {
  const T = pertTotales(c.id); if (!T.n && c.id === 'sin') return '';
  const cob = c.id !== 'sin' ? coberturaHogar(c.id) : null;
  let seguro = '';
  if (cob && T.n) {
    if (!cob.seg.length) seguro = `<div class="banner amber"><span>Sin seguro de hogar vinculado a esta vivienda. <button class="btn sm" data-action="tab" data-tab="seguros">Ir a Seguros</button></span></div>`;
    else if (cob.sinDato) seguro = `<div class="banner blue"><span>Indica el <b>capital de contenido</b> de tu seguro de hogar (✎ en Seguros) para comprobar si cubre ${fmtEUR(cob.repo, 0)}.</span></div>`;
    else if (cob.falta > 0) seguro = `<div class="banner red"><span>El contenido asegurado (${fmtEUR(cob.cont, 0)}) no cubre lo que costaría reponerlo todo (${fmtEUR(cob.repo, 0)}): faltan <b>${fmtEUR(cob.falta, 0)}</b>. En un siniestro te pagarían en proporción.</span></div>`;
    else seguro = `<div class="banner green"><span>El seguro de hogar cubre el contenido: ${fmtEUR(cob.cont, 0)} asegurados para ${fmtEUR(cob.repo, 0)} de reposición.</span></div>`;
  }
  const porCat = Object.keys(CAT_PERT).map(k => [k, T.lista.filter(p => (CAT_PERT[p.categoria] ? p.categoria : 'otros') === k)]).filter(([, l]) => l.length);
  return `<div class="card">
    <div class="card-head"><h3>🏠 ${esc(c.nombre)}</h3><span class="sub">${T.n} objeto(s) · reposición ${fmtEUR(T.repo, 0)} · venta ${fmtEUR(T.venta, 0)}</span></div>
    ${seguro}
    ${T.n ? porCat.map(([k, l]) => `<div class="pert-cat"><div class="pert-cat-h">${icono(CAT_PERT[k].ico)}<span>${CAT_PERT[k].l}</span><b>${fmtEUR(sum(l, p => pertInfo(p).repo), 0)}</b></div>
      <div class="pert-list">${l.sort((a, b) => num(b.precio_compra) - num(a.precio_compra)).map(filaPert).join('')}</div></div>`).join('')
      : '<div class="small muted">Nada apuntado en esta vivienda todavía.</div>'}
  </div>`;
}
function filaPert(p) {
  const x = pertInfo(p);
  return `<div class="pert-row" data-action="pert-edit" data-id="${p.id}" role="button" tabindex="0">
    <div class="pert-c"><div class="pert-t">${esc(p.nombre)}${num(p.cantidad) > 1 ? ` <span class="muted">×${num(p.cantidad)}</span>` : ''}</div>
      <div class="small muted">${[p.marca_modelo ? esc(p.marca_modelo) : '', p.fecha_compra ? `comprado ${fmtDate(p.fecha_compra)}` : ''].filter(Boolean).join(' · ')}</div></div>
    <div class="pert-v"><b class="num">${fmtEUR(x.repo, 0)}</b><small>venta ${x.manual ? '' : '≈ '}${fmtEUR(x.venta, 0)}</small></div>
  </div>`;
}

const FIELDS_PERT = () => [
  { name: 'nombre', label: 'Qué es', required: true, ph: 'MacBook Air, Thermomix, cuna…' },
  { name: 'categoria', label: 'Categoría', type: 'select', options: Object.entries(CAT_PERT).map(([v, c]) => ({ v, l: c.l })) },
  { name: 'inmueble_id', label: 'Vivienda', type: 'select', options: [{ v: '', l: '— Sin asignar —' }, ...S.inmuebles.map(i => ({ v: i.id, l: i.nombre }))] },
  { name: 'cantidad', label: 'Cantidad', type: 'int' },
  { name: 'marca_modelo', label: 'Marca y modelo' },
  { name: 'fecha_compra', label: 'Fecha de compra', type: 'date' },
  { name: 'precio_compra', label: 'Precio de compra (€, total)', type: 'number', required: true },
  { name: 'valor_reposicion', label: 'Coste de reponerlo hoy (€)', type: 'number', hint: 'Si lo dejas vacío, el de compra' },
  { name: 'valor_venta', label: 'Valor de venta (€)', type: 'number', hint: 'Si lo dejas vacío, se calcula solo' },
  { name: 'garantia_hasta', label: 'Garantía hasta', type: 'date', hint: `Si lo dejas vacío, ${GARANTIA_ANIOS} años desde la compra` },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true, ph: 'Nº de serie, dónde está la factura…' }
];
Views.pertenencias = renderPertenencias;
Object.assign(Actions, {
  'pert-new': () => openForm({ title: 'Nueva pertenencia', fields: FIELDS_PERT(), values: { categoria: 'tecnologia', cantidad: 1, inmueble_id: S.inmuebles.length === 1 ? S.inmuebles[0].id : '' },
    onSubmit: v => saveEntity('pertenencias', null, { ...v, inmueble_id: v.inmueble_id || null }) }),
  'pert-edit': el => {
    const p = S.pertenencias.find(x => x.id === el.dataset.id);
    const x = pertInfo(p);
    const intro = x.garantia ? `<div class="pert-gar ${x.gDias < 0 ? 'off' : x.gDias <= 60 ? 'warn' : 'ok'}">🛡️ ${x.gDias < 0 ? `Sin garantía desde el ${fmtDate(x.garantia)}` : `En garantía hasta el ${fmtDate(x.garantia)}${x.gDias <= 60 ? ` · quedan ${x.gDias} días` : ''}`}</div>` : '';
    const md = openForm({ title: 'Editar pertenencia', fields: FIELDS_PERT(), values: p, intro, onSubmit: v => saveEntity('pertenencias', p.id, { ...v, inmueble_id: v.inmueble_id || null }) });
    const acts = md.el.querySelector('.actions');
    acts.insertAdjacentHTML('afterbegin', '<button type="button" class="btn danger" data-del style="margin-right:auto">Eliminar</button>');
    acts.querySelector('[data-del]').addEventListener('click', async () => { if (!(await confirmDlg(`¿Eliminar <b>${esc(p.nombre)}</b>?`, 'Eliminar'))) return; md.close();
      await withSaving(null, async () => { await DB.remove('pertenencias', p.id); await reloadTable('pertenencias'); }, 'Eliminado'); render(); });
  }
});
