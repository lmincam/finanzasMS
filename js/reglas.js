'use strict';
/* =====================================================================
   REGLAS DE CATEGORIZACIÓN
   ---------------------------------------------------------------------
   Motor que decide la categoría de cada movimiento importado y que
   aprende de tus correcciones. Orden de prioridad:
     1. Tus reglas (creadas a mano o aprendidas al categorizar)
     2. Concepto idéntico a un movimiento ya categorizado
     3. Transferencias internas detectadas (MyInvestor, cajero…)
     4. Reglas predefinidas de comercios habituales en España
     5. Nómina
   Si varias reglas coinciden, gana la palabra clave más larga (más específica).
   Depende de: utilidades.js, estado.js, datos.js, ui.js
   ===================================================================== */

/** Reglas predefinidas: [palabra clave, 'Categoría › Subcategoría'].
 *  Si la subcategoría no existe en tus categorías se usa la principal; si tampoco existe, se ignora. */
const REGLAS_PREDEFINIDAS = [
  // Supermercados
  ...['mercadona', 'carrefour', 'lidl', 'aldi', 'eroski', 'alcampo', 'hipercor', 'supercor', 'consum', 'ahorramas', 'gadis', 'froiz', 'caprabo', 'bonpreu', 'condis', 'coviran', 'spar', 'makro', 'supermercado', 'supermercados dia', 'dia retail', 'el arbol', 'masymas', 'family cash', 'mercado'].map(p => [p, 'Alimentación › Supermercado']),
  // Comida a domicilio
  ...['glovo', 'just eat', 'justeat', 'uber eats', 'ubereats', 'deliveroo', 'telepizza', 'dominos', 'domino s'].map(p => [p, 'Alimentación › Comida a domicilio']),
  // Restaurantes y bares
  ...['mcdonald', 'burger king', 'kfc', 'starbucks', 'foster', 'vips', 'goiko', 'montaditos', 'five guys', 'taco bell', 'tgb', 'restaurante', 'cafeteria', 'bar ', 'cerveceria', 'pizzeria', 'tapas', 'rodilla', 'udon', 'ginos', 'la tagliatella'].map(p => [p, 'Alimentación › Restaurantes y bares']),
  // Combustible
  ...['repsol', 'cepsa', 'moeve', 'galp', 'bp', 'shell', 'petronor', 'ballenoil', 'plenoil', 'petroprix', 'avia', 'campsa', 'gasolinera', 'estacion de servicio', 'carburante'].map(p => [p, 'Transporte y vehículos › Combustible']),
  // Peajes y parking
  ...['autopista', 'peaje', 'via t', 'telepeaje', 'empark', 'saba', 'parking', 'aparcamiento', 'easypark', 'elparking', 'telpark', 'ora '].map(p => [p, 'Transporte y vehículos › Peajes y parking']),
  // Mantenimiento y seguros de vehículos
  ...['taller', 'itv', 'neumatic', 'norauto', 'midas', 'feu vert', 'euromaster', 'carglass', 'lavado'].map(p => [p, 'Transporte y vehículos › Mantenimiento vehículos']),
  ...['linea directa', 'mutua madrilena', 'allianz', 'axa', 'generali', 'reale', 'pelayo', 'verti', 'qualitas', 'regal'].map(p => [p, 'Transporte y vehículos › Seguros vehículos']),
  // Transporte
  ...['renfe', 'cabify', 'uber', 'bolt', 'alsa', 'blablacar', 'avlo', 'iryo', 'ouigo', 'metro de', 'emt', 'tmb', 'bus '].map(p => [p, 'Transporte y vehículos']),
  // Viajes
  ...['ryanair', 'vueling', 'iberia', 'air europa', 'easyjet', 'binter', 'booking', 'airbnb', 'expedia', 'edreams', 'rumbo', 'hotel', 'melia', 'nh hotel', 'barcelo', 'parador', 'camping'].map(p => [p, 'Ocio y viajes › Viajes']),
  // Ocio y deporte
  ...['cinesa', 'yelmo', 'kinepolis', 'cine', 'ticketmaster', 'entradas', 'steam', 'playstation', 'nintendo', 'xbox', 'museo', 'teatro', 'parque'].map(p => [p, 'Ocio y viajes › Ocio']),
  ...['decathlon', 'gimnasio', 'gym', 'basic fit', 'mcfit', 'holmes place', 'altafit', 'synergym', 'padel', 'sprinter', 'forum sport'].map(p => [p, 'Ocio y viajes › Deporte']),
  // Suscripciones
  ...['netflix', 'spotify', 'hbo', 'disney', 'prime video', 'amazon prime', 'apple com bill', 'icloud', 'youtube', 'google one', 'dazn', 'movistar plus', 'audible', 'kindle', 'openai', 'chatgpt', 'filmin', 'atresplayer', 'microsoft'].map(p => [p, 'Suscripciones']),
  // Suministros
  ...['iberdrola', 'endesa', 'naturgy', 'holaluz', 'totalenergies', 'octopus', 'edp', 'repsol luz', 'curenergia', 'som energia', 'lucera'].map(p => [p, 'Vivienda › Luz']),
  ...['canal de isabel', 'aqualia', 'emasesa', 'agbar', 'aguas de', 'agua'].map(p => [p, 'Vivienda › Agua']),
  ...['movistar', 'vodafone', 'orange', 'yoigo', 'masmovil', 'pepephone', 'digi', 'jazztel', 'lowi', 'simyo', 'o2', 'finetwork', 'telefonica'].map(p => [p, 'Vivienda › Internet y móvil']),
  ...['comunidad de propietarios', 'comunidad prop', 'cdad prop'].map(p => [p, 'Vivienda › Comunidad']),
  ...['prestamo', 'hipoteca', 'cuota prest'].map(p => [p, 'Vivienda › Hipoteca']),
  ...['ibi', 'basura', 'tasa'].map(p => [p, 'Vivienda › IBI y tasas']),
  // Salud
  ...['farmacia', 'parafarmacia', 'farma'].map(p => [p, 'Salud › Farmacia']),
  ...['sanitas', 'adeslas', 'asisa', 'dkv', 'quiron', 'hospital', 'clinica', 'dental', 'dentista', 'optica', 'fisioterap', 'vithas', 'hm hospitales'].map(p => [p, 'Salud › Médicos y seguros']),
  // Compras
  ...['zara', 'bershka', 'pull&bear', 'pull bear', 'stradivarius', 'massimo dutti', 'mango', 'primark', 'h&m', 'c&a', 'springfield', 'cortefiel', 'kiabi', 'uniqlo', 'shein', 'zalando', 'lefties', 'oysho', 'calzedonia', 'tezenis', 'deichmann', 'zapateria'].map(p => [p, 'Compras › Ropa adultos']),
  ...['ikea', 'leroy merlin', 'bricomart', 'bauhaus', 'brico depot', 'media markt', 'mediamarkt', 'worten', 'pccomponentes', 'fnac', 'amazon', 'amzn', 'aliexpress', 'apple store', 'conforama', 'jysk', 'action', 'tiger', 'ferreteria', 'temu'].map(p => [p, 'Compras › Hogar y electrónica']),
  ...['el corte ingles', 'corte ingles'].map(p => [p, 'Compras']),
  // Hijos
  ...['colegio', 'escuela', 'guarderia', 'academia', 'libreria', 'papeleria', 'juguet', 'toys'].map(p => [p, 'Hijos › Colegio y material']),
  // Impuestos y comisiones
  ...['aeat', 'agencia tributaria', 'hacienda'].map(p => [p, 'Impuestos y comisiones › Hacienda']),
  ...['comision', 'comis mant', 'mantenimiento cuenta'].map(p => [p, 'Impuestos y comisiones › Comisiones bancarias'])
];

/* ---------- Utilidades del motor ---------- */
const normPatron = s => normText(s).replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
const textoMov = (...partes) => ' ' + normPatron(partes.filter(Boolean).join(' ')) + ' ';
/** ¿El texto contiene la palabra clave? Las claves cortas (≤ 4 letras) deben ser palabra completa. */
function coincide(texto, patron) {
  const p = normPatron(patron); if (!p) return false;
  if (p.length <= 4) return texto.includes(' ' + p + ' ');
  return texto.includes(p);
}
/** Busca una categoría por ruta 'Principal › Sub' (con alternativas si no existe exactamente). */
function resolverRuta(ruta, tipo = 'gasto') {
  const [a, b] = ruta.split('›').map(x => normText(x));
  const roots = S.categorias.filter(c => c.tipo === tipo && !c.parent_id);
  const root = roots.find(c => normText(c.nombre) === a);
  if (b) {
    if (root) { const ch = S.categorias.find(c => c.parent_id === root.id && normText(c.nombre) === b); if (ch) return ch; }
    const any = S.categorias.find(c => c.tipo === tipo && c.parent_id && normText(c.nombre) === b); if (any) return any;
  }
  return root || null;
}
const STOP_PATRON = new Set(['compra', 'compras', 'tarj', 'tarjeta', 'pago', 'pagos', 'en', 'de', 'del', 'la', 'el', 'los', 'las', 'cargo', 'recibo', 'adeudo', 'transferencia',
  'transf', 'trf', 'com', 'es', 'esp', 'espana', 'sl', 'sa', 'slu', 'sau', 'www', 'http', 'https', 'card', 'contactless', 'movil', 'pay', 'operacion', 'fecha', 'ref', 'num',
  'con', 'visa', 'mastercard', 'debito', 'credito', 'internet', 'online', 'tpv', 'pos', 'y', 'a', 'por', 'e', 'cta', 'ord', 'ordenante', 'beneficiario', 'domiciliacion', 'cobro',
  'apple', 'google', 'paypal', 'sumup', 'bizum', 'madrid', 'barcelona', 'sevilla', 'valencia', 'malaga', 'eur', 'tj', 'tarjeta credito', 'emisor']);
/** Propone la palabra clave de una regla a partir del concepto del banco (p. ej. "COMPRA TARJ 1234 GLOVOAPP ES" → "glovoapp"). */
function proponerPatron(cOrig, concepto) {
  const base = cOrig || concepto || '';
  const toks = normPatron(base).split(' ').map(t => t.replace(/\d+/g, '')).filter(t => t.length >= 2 && !STOP_PATRON.has(t) && !/^x+$/.test(t));
  if (!toks.length) return normPatron(base).replace(/\d+/g, '').trim().slice(0, 25);
  if (/bizum/.test(normPatron(base))) return toks.slice(0, 3).join(' '); // en un Bizum, el nombre completo (no basta con "maria")
  return toks[0].length >= 5 ? toks[0] : toks.slice(0, 2).join(' ');
}

/** Prepara el contexto de clasificación una sola vez por importación. */
function contextoClasificacion(cuentaId) {
  const usuario = S.reglas_categoria.filter(r => r.activa !== false && (r.tipo_mov === 'transferencia' ? r.cuenta_contraria_id && r.cuenta_contraria_id !== cuentaId : r.categoria_id && catById(r.categoria_id)))
    .sort((a, b) => normPatron(b.patron).length - normPatron(a.patron).length);
  const predef = REGLAS_PREDEFINIDAS.map(([p, ruta]) => ({ patron: p, cat: resolverRuta(ruta) })).filter(x => x.cat)
    .sort((a, b) => normPatron(b.patron).length - normPatron(a.patron).length);
  return { cuentaId, usuario, predef, learned: buildLearned(cuentaId) };
}
/** Clasifica un movimiento. Devuelve { tipo, categoria_id, cuenta_contraria_id, subtipo, fuente, regla } */
function clasificar(concepto, cOrig, imp, ctx) {
  const t = textoMov(concepto, cOrig);
  // 1. Tus reglas
  const r = ctx.usuario.find(x => coincide(t, x.patron));
  if (r) return r.tipo_mov === 'transferencia'
    ? { tipo: 'transferencia', cuenta_contraria_id: r.cuenta_contraria_id, subtipo: r.subtipo || subtipoPorCuenta(cuentaById(r.cuenta_contraria_id)), fuente: 'regla', regla: r }
    : { tipo: r.tipo_mov, categoria_id: r.categoria_id, fuente: 'regla', regla: r };
  // 2. Concepto idéntico ya categorizado
  const L = ctx.learned.get(normConcept(concepto)) || (cOrig ? ctx.learned.get(normConcept(cOrig)) : null);
  if (L && L.cuenta_contraria_id !== ctx.cuentaId) return { ...L, fuente: 'aprendida' };
  // 3. Transferencias internas
  const cc = detectarCuentaContraria(normText(`${concepto} ${cOrig}`), ctx.cuentaId);
  if (cc) return { tipo: 'transferencia', cuenta_contraria_id: cc.id, subtipo: subtipoPorCuenta(cc), fuente: 'transferencia' };
  // 4. Ingresos: nómina
  if (imp > 0) {
    const nom = /nomina|haberes|salario|sueldo|paga extra/.test(t) ? S.categorias.find(c => c.tipo === 'ingreso' && normText(c.nombre) === 'nomina') : null;
    if (nom) return { tipo: 'ingreso', categoria_id: nom.id, fuente: 'nomina' };
  }
  // 5. Predefinidas (solo gastos; una devolución de un comercio también reduce ese gasto)
  const p = ctx.predef.find(x => coincide(t, x.patron));
  if (p) return { tipo: 'gasto', categoria_id: p.cat.id, fuente: 'predefinida', patronPredef: p.patron };
  return { tipo: imp > 0 ? 'ingreso' : 'gasto', categoria_id: null, fuente: null };
}

/** Guarda o actualiza las reglas aprendidas de una importación. items: [{ patron, tipo, categoria_id, cuenta_contraria_id, subtipo }] */
async function aprenderReglas(items) {
  if (S.missing.has('reglas_categoria')) return { nuevas: 0, actualizadas: 0 };
  const porPatron = new Map();
  for (const x of items) { const p = normPatron(x.patron); if (p.length >= 2) porPatron.set(p, x); }
  let nuevas = 0, actualizadas = 0; const inserts = [];
  for (const [p, x] of porPatron) {
    const isT = x.tipo === 'transferencia';
    if (isT ? !x.cuenta_contraria_id : !x.categoria_id) continue;
    const row = { patron: p, tipo_mov: x.tipo, categoria_id: isT ? null : x.categoria_id, cuenta_contraria_id: isT ? x.cuenta_contraria_id : null, subtipo: isT ? x.subtipo : null, activa: true };
    const prev = S.reglas_categoria.find(r => normPatron(r.patron) === p);
    if (prev) {
      if (prev.tipo_mov !== row.tipo_mov || prev.categoria_id !== row.categoria_id || prev.cuenta_contraria_id !== row.cuenta_contraria_id || prev.activa === false) { await DB.update('reglas_categoria', prev.id, row); actualizadas++; }
    } else { inserts.push({ ...row, origen: 'aprendida', usos: 0 }); nuevas++; }
  }
  if (inserts.length) await DB.insert('reglas_categoria', inserts);
  return { nuevas, actualizadas };
}
/** Suma usos a las reglas que han categorizado movimientos en una importación. */
async function contarUsos(items) {
  if (S.missing.has('reglas_categoria')) return;
  const c = new Map();
  for (const x of items) if (x.fuente === 'regla' && x.regla && !x.editado) c.set(x.regla.id, (c.get(x.regla.id) || 0) + 1);
  for (const [id, n] of c) { const r = S.reglas_categoria.find(x => x.id === id); if (r) await DB.update('reglas_categoria', id, { usos: num(r.usos) + n, ultima_vez: todayISO() }); }
}

/* =====================================================================
   GESTIÓN DE REGLAS (se muestra en la pestaña Categorías)
   ===================================================================== */
const destinoRegla = r => r.tipo_mov === 'transferencia'
  ? `⇄ ${esc((cuentaById(r.cuenta_contraria_id) || {}).nombre || '?')} · ${SUBTIPO[r.subtipo] || ''}`
  : esc(catName(r.categoria_id) || '¿categoría borrada?');
function renderReglasCard() {
  if (S.missing.has('reglas_categoria')) return `<div class="card"><div class="card-head"><h3>🤖 Reglas de categorización</h3></div><div class="banner amber">Ejecuta <code>sql/04_migracion_reglas.sql</code> en Supabase para que la app aprenda de cómo categorizas.</div></div>`;
  const q = normPatron(S.reglasQ || '');
  const reglas = S.reglas_categoria.filter(r => !q || normPatron(r.patron).includes(q) || normText(catName(r.categoria_id)).includes(q)).sort((a, b) => normPatron(a.patron).localeCompare(normPatron(b.patron)));
  const predef = REGLAS_PREDEFINIDAS.map(([p, ruta]) => ({ p, ruta, cat: resolverRuta(ruta) }));
  const sinCat = S.movimientos.filter(m => (m.tipo === 'gasto' || m.tipo === 'ingreso') && !m.categoria_id).length;
  return `<div class="card"><div class="card-head"><div><h3>🤖 Reglas de categorización</h3>
      <div class="small muted">${S.reglas_categoria.length} tuyas · ${predef.filter(x => x.cat).length} predefinidas</div></div>
      <button class="btn sm" data-action="regla-new">+ Regla</button></div>
    ${sinCat ? `<div class="reg-aplicar"><span>${sinCat} movimiento(s) sin categoría</span><button class="btn sm primary" data-action="reglas-aplicar">Categorizar con las reglas</button></div>` : ''}
    <input id="reg-q" type="search" placeholder="Buscar palabra clave o categoría…" value="${esc(S.reglasQ || '')}" style="margin-bottom:10px">
    <div id="reglas-list">${reglas.length ? `<div class="tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>Si contiene…</th><th>→ Categoría</th><th class="right">Usos</th><th></th></tr></thead><tbody>
      ${reglas.map(r => `<tr style="${r.activa === false ? 'opacity:.5' : ''}"><td><code>${esc(r.patron)}</code> ${r.origen === 'aprendida' ? '<span class="badge green">aprendida</span>' : '<span class="badge">manual</span>'}</td>
        <td class="small">${destinoRegla(r)}</td><td class="right small">${num(r.usos)}${r.ultima_vez ? `<div class="muted">${fmtDate(r.ultima_vez)}</div>` : ''}</td>
        <td><button class="mini" data-action="regla-edit" data-id="${r.id}">✎</button><button class="mini" data-action="regla-del" data-id="${r.id}">🗑</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Aún no hay reglas tuyas: se crean solas cuando categorizas al importar.</div>'}</div>
    <details style="margin-top:10px"><summary>Reglas predefinidas (${predef.length})</summary>
      <p class="small muted">Comercios habituales en España. Tus reglas tienen prioridad: si una no te encaja, crea una regla tuya con la misma palabra clave.</p>
      <div class="small" style="columns:2;column-gap:24px">${predef.map(x => `<div style="break-inside:avoid;padding:2px 0"><code>${esc(x.p)}</code> → ${x.cat ? esc(catName(x.cat.id)) : `<span class="muted">${esc(x.ruta)} (no existe)</span>`}</div>`).join('')}</div>
    </details></div>`;
}
const FIELDS_REGLA = [
  { name: 'patron', label: 'Si el concepto contiene…', required: true, ph: 'ej: glovo', hint: 'Sin importar mayúsculas ni acentos. Palabras de 4 letras o menos deben aparecer completas.' },
  { name: 'tipo_mov', label: 'Tipo', type: 'select', options: Object.entries(TIPO_MOV).map(([v, l]) => ({ v, l })) },
  { name: 'categoria_id', label: 'Categoría (gasto / ingreso)', type: 'rawselect', html: v => catOptsAll(v) },
  { name: 'cuenta_contraria_id', label: 'Cuenta contraria (transferencia)', type: 'rawselect', html: v => accOpts(v, { empty: '— Solo para transferencias —' }) },
  { name: 'subtipo', label: 'Naturaleza (transferencia)', type: 'select', options: [{ v: '', l: '—' }].concat(Object.entries(SUBTIPO).map(([v, l]) => ({ v, l }))) },
  { name: 'activa', label: 'Regla activa', type: 'checkbox', def: true }
];
async function guardarRegla(id, v) {
  v.patron = normPatron(v.patron);
  if (v.patron.length < 2) throw new Error('La palabra clave es demasiado corta');
  const isT = v.tipo_mov === 'transferencia';
  if (isT && !v.cuenta_contraria_id) throw new Error('Indica la cuenta contraria');
  if (!isT && !v.categoria_id) throw new Error('Indica la categoría');
  if (!isT && catById(v.categoria_id) && catById(v.categoria_id).tipo !== v.tipo_mov) v.tipo_mov = catById(v.categoria_id).tipo;
  const dup = S.reglas_categoria.find(r => normPatron(r.patron) === v.patron && r.id !== id);
  if (dup) throw new Error(`Ya existe una regla para “${v.patron}”. Edítala en su lugar.`);
  const row = { ...v, categoria_id: isT ? null : v.categoria_id, cuenta_contraria_id: isT ? v.cuenta_contraria_id : null, subtipo: isT ? (v.subtipo || subtipoPorCuenta(cuentaById(v.cuenta_contraria_id))) : null };
  if (id) await DB.update('reglas_categoria', id, row); else await DB.insert('reglas_categoria', [{ ...row, origen: 'usuario' }]);
  await reloadTable('reglas_categoria');
}
/** Aplica las reglas a los movimientos ya guardados que no tienen categoría. */
async function aplicarReglasExistentes(btn) {
  const pend = S.movimientos.filter(m => (m.tipo === 'gasto' || m.tipo === 'ingreso') && !m.categoria_id);
  const ctxs = new Map(), cambios = [];
  for (const m of pend) {
    if (!ctxs.has(m.cuenta_id)) ctxs.set(m.cuenta_id, contextoClasificacion(m.cuenta_id));
    const c = clasificar(m.concepto || '', m.notas || '', num(m.importe), ctxs.get(m.cuenta_id));
    if (c.categoria_id && c.tipo === m.tipo) cambios.push({ m, cat: c.categoria_id });
  }
  if (!cambios.length) { toast('Ninguna regla encaja con los movimientos sin categoría. Categorízalos en el importador o crea reglas nuevas.', 'warn', 5000); return; }
  if (!(await confirmDlg(`Se categorizarán <b>${cambios.length}</b> de ${pend.length} movimientos sin categoría:<br><br><span class="small">${cambios.slice(0, 10).map(x => `${fmtDate(x.m.fecha)} · ${esc(x.m.concepto)} → <b>${esc(catName(x.cat))}</b>`).join('<br>')}${cambios.length > 10 ? '<br>…' : ''}</span>`, 'Aplicar', false))) return;
  const porCat = new Map(); cambios.forEach(x => { if (!porCat.has(x.cat)) porCat.set(x.cat, []); porCat.get(x.cat).push(x.m.id); });
  await withSaving(btn, async () => { for (const [cat, ids] of porCat) await DB.updateIn('movimientos', ids, { categoria_id: cat }); await reloadTable('movimientos'); }, `${cambios.length} movimientos categorizados ✓`, 'Aplicando…');
  render();
}

Inputs['reg-q'] = el => { S.reglasQ = el.value; const box = $('#reglas-list'); if (!box) return; const tmp = document.createElement('div'); tmp.innerHTML = renderReglasCard(); const nb = tmp.querySelector('#reglas-list'); if (nb) box.innerHTML = nb.innerHTML; };

Object.assign(Actions, {
  'regla-new': () => openForm({ title: 'Nueva regla de categorización', fields: FIELDS_REGLA, values: { tipo_mov: 'gasto', activa: true }, onSubmit: v => guardarRegla(null, v) }),
  'regla-edit': el => { const r = S.reglas_categoria.find(x => x.id === el.dataset.id); openForm({ title: 'Editar regla', fields: FIELDS_REGLA, values: r, onSubmit: v => guardarRegla(r.id, v) }); },
  'regla-del': async el => { const r = S.reglas_categoria.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar la regla <code>${esc(r.patron)}</code>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('reglas_categoria', r.id); await reloadTable('reglas_categoria'); }, 'Regla eliminada'); render(); },
  'reglas-aplicar': el => aplicarReglasExistentes(el)
});
