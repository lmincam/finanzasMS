'use strict';
/* =====================================================================
   IMPORTADOR DE EXTRACTOS (Unicaja)
   ---------------------------------------------------------------------
   Lectura de Excel/CSV, mapeo de columnas, sugerencias, duplicados y guardado.
   Depende de: datos.js, calculos.js, ui.js, cuentas.js (guardado)
   ===================================================================== */

function renderImport() {
  const box = $('#import-card'); if (!box) return;
  const D = S.importData;
  if (!D) {
    box.innerHTML = `<div class="card-head"><h3>📥 Importar extracto semanal</h3><span class="sub">.xlsx · .xls · .csv · periodo domingo → sábado</span></div>
      <div class="form-grid">
        <div><label>Cuenta del extracto</label><select id="imp-cuenta">${accOpts(S.importCuenta)}</select></div>
        <div><label>Archivo</label><input type="file" id="imp-file" accept=".xlsx,.xls,.csv,.txt"></div>
      </div>
      <p class="small muted" style="margin-bottom:0">Se usará la columna de <b>anotaciones</b> (tu concepto aclarado) si existe; si no, el concepto del banco. Antes de guardar verás una previsualización con detección de duplicados, sugerencia de categoría y regla de nómina aplicada.</p>`;
    return;
  }
  if (D.stage === 'map') {
    const keys = [['fecha', 'Fecha *'], ['concepto', 'Concepto banco'], ['anot', 'Anotaciones (tu concepto)'], ['importe', 'Importe (con signo)'], ['cargo', 'Cargo (si va separado)'], ['abono', 'Abono (si va separado)']];
    box.innerHTML = `<div class="card-head"><h3>📥 ${esc(D.fileName)}</h3><span class="sub">${D.data.length} filas detectadas · cabecera en fila ${D.headerRow + 1}</span></div>
      <p class="small muted">Comprueba qué columna corresponde a cada dato (se recordará para próximas importaciones):</p>
      <div class="map-grid">${keys.map(([k, l]) => `<div><label>${l}</label><select data-map="${k}"><option value="-1">— ninguna —</option>${D.headers.map((h, i) => `<option value="${i}" ${D.map[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="tbl-wrap" style="max-height:180px;overflow:auto;margin-bottom:12px"><table class="tbl"><thead><tr>${D.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${D.data.slice(0, 4).map(r => `<tr>${D.headers.map((_, i) => `<td class="small">${esc(r[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="actions"><button class="btn ghost" data-action="imp-cancel">Cancelar</button><button class="btn primary" data-action="imp-process">Previsualizar →</button></div>`;
    return;
  }
  // stage preview
  const items = D.items;
  const sel = items.filter(x => x.sel);
  const fechas = items.map(x => x.fecha).sort();
  const nDup = items.filter(x => x.dup).length, nPos = items.filter(x => x.posibleDup).length;
  const cta = cuentaById(D.cuentaId);
  box.innerHTML = `<div class="card-head"><h3>📥 Previsualización · ${esc(cta ? cta.nombre : '')}</h3>
      <span class="sub">${fechas.length ? `${DIAS[weekday(fechas[0])]} ${fmtDate(fechas[0])} → ${DIAS[weekday(fechas[fechas.length - 1])]} ${fmtDate(fechas[fechas.length - 1])}` : ''}</span></div>
    <div class="imp-summary">
      <span><b>${sel.length}</b> de ${items.length} seleccionados</span>
      <span class="pos">Ingresos ${fmtEUR(sum(sel.filter(x => x.tipo === 'ingreso'), 'importe'))}</span>
      <span class="neg">Gastos ${fmtEUR(-sum(sel.filter(x => x.tipo === 'gasto'), 'importe'))}</span>
      <span class="muted">Transferencias ${fmtEUR(sum(sel.filter(x => x.tipo === 'transferencia'), 'importe'))}</span>
      ${nDup ? `<span class="badge amber">${nDup} ya importados</span>` : ''}${nPos ? `<span class="badge amber">${nPos} posibles duplicados</span>` : ''}
      <span class="sp"></span>
      <button class="btn sm ghost" data-action="imp-selall" data-v="1">Marcar todos</button><button class="btn sm ghost" data-action="imp-selall" data-v="0">Ninguno</button>
    </div>
    <div class="imp-row imp-head"><div></div><div>Fecha</div><div>Concepto</div><div class="right">Importe</div><div>Tipo</div><div>Categoría / destino</div><div>Imputar a</div></div>
    ${items.map((x, i) => impRow(x, i)).join('')}
    <div class="actions" style="margin-top:14px"><button class="btn ghost" data-action="imp-back">← Columnas</button><button class="btn ghost" data-action="imp-cancel">Cancelar</button>
      <button class="btn success" data-action="imp-save">Guardar ${sel.length} movimientos</button></div>`;
}
function impRow(x, i) {
  const isT = x.tipo === 'transferencia';
  return `<div class="imp-row ${x.dup ? 'dup' : ''} ${x.sel ? '' : 'off'}">
    <input type="checkbox" data-imp="sel" data-i="${i}" ${x.sel ? 'checked' : ''}>
    <div class="small num">${fmtDateShort(x.fecha)} <span class="muted">${DIAS[weekday(x.fecha)]}</span></div>
    <input class="c-concept" data-imp="concepto" data-i="${i}" value="${esc(x.concepto)}" title="${esc(x.notas || '')}">
    <div class="num right ${x.importe >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${signed(x.importe)}</div>
    <select class="c-tipo" data-imp="tipo" data-i="${i}">${Object.entries(TIPO_MOV).map(([k, l]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${k === 'ingreso' ? 'Ingreso' : l}</option>`).join('')}</select>
    ${isT ? `<div class="c-cat tsel"><select data-imp="cuenta_contraria_id" data-i="${i}">${accOpts(x.cuenta_contraria_id, { exclude: S.importData.cuentaId, empty: x.importe < 0 ? '→ ¿Hacia?' : '← ¿Desde?' })}</select></div>
      <select class="c-mes" data-imp="subtipo" data-i="${i}">${subOpts(x.subtipo)}</select>`
    : `<select class="c-cat" data-imp="categoria_id" data-i="${i}">${catOpts(x.tipo, x.categoria_id)}</select>
      <input class="c-mes" type="month" data-imp="mes" data-i="${i}" value="${x.mes}">`}
    ${(x.dup || x.posibleDup || x.nomina || x.learned) ? `<div class="flags">
      ${x.dup ? '<span class="badge amber">Ya importado</span>' : ''}${x.posibleDup ? '<span class="badge amber">Posible duplicado (manual mismo día e importe)</span>' : ''}
      ${x.nomina && x.tipo === 'ingreso' ? `<span class="badge blue">Regla nómina → ${ymLabel(x.mes, true)}</span>` : ''}${x.learned ? '<span class="badge green">Categoría aprendida</span>' : ''}</div>` : ''}
  </div>`;
}
async function impReadFile(file) {
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  let h = rows.findIndex((r, i) => i < 40 && r.some(c => /fecha/i.test(String(c))) && r.some(c => /importe|cargo|abono|cantidad/i.test(String(c))));
  if (h < 0) h = 0;
  const width = Math.max(...rows.slice(h, h + 30).map(r => r.length), 1);
  const headers = Array.from({ length: width }, (_, i) => String((rows[h] || [])[i] ?? '').trim() || `Columna ${i + 1}`);
  const data = rows.slice(h + 1).filter(r => r.some(c => String(c).trim() !== ''));
  const sig = 'pf_map_' + normText(headers.join('|')).slice(0, 180);
  let map = null;
  try { map = JSON.parse(localStorage.getItem(sig) || 'null'); } catch (e) { map = null; }
  if (!map) {
    const H = headers.map(normText);
    const idx = (...tests) => { for (const t of tests) { const i = H.findIndex(t); if (i >= 0) return i; } return -1; };
    map = {
      fecha: idx(x => x === 'fecha', x => x.includes('fecha') && x.includes('operac'), x => x.includes('fecha') && !x.includes('valor'), x => x.includes('fecha')),
      concepto: idx(x => x === 'concepto', x => x.includes('concepto'), x => x.includes('descrip'), x => x.includes('movimiento')),
      anot: idx(x => x.includes('anotac'), x => x.includes('observ'), x => x.includes('comentario'), x => x.includes('nota')),
      importe: idx(x => x === 'importe', x => x.includes('importe') && !x.includes('saldo'), x => x.includes('cantidad')),
      cargo: idx(x => x.includes('cargo') || x === 'debe'),
      abono: idx(x => x.includes('abono') || x === 'haber')
    };
    if (map.anot === map.concepto) map.anot = -1;
  }
  S.importData = { stage: 'map', cuentaId: S.importCuenta, fileName: file.name, headers, data, map, sig, headerRow: h };
}
function buildLearned(cuentaId) {
  const L = new Map();
  const sorted = S.movimientos.filter(m => m.cuenta_id === cuentaId).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  for (const m of sorted) {
    if (m.tipo !== 'transferencia' && !m.categoria_id) continue;
    if (m.tipo === 'transferencia' && !m.cuenta_contraria_id) continue;
    const v = { tipo: m.tipo, categoria_id: m.categoria_id, cuenta_contraria_id: m.cuenta_contraria_id, subtipo: m.subtipo_transferencia };
    for (const k of [normConcept(m.concepto), normConcept(m.notas)]) if (k && k.length >= 4) L.set(k, v);
  }
  return L;
}
const KW_TRANSF = /traspaso|transferencia|aportacion|ahorro|inversion|propia/;
const STOP = new Set(['cuenta', 'principal', 'inversion', 'fondo', 'ahorro', 'para', 'desde']);
function detectarCuentaContraria(t, cuentaId) {
  if (/cajero|reintegro|retirada de efectivo|disposicion.*efectivo|retirada efectivo/.test(t)) {
    const e = S.cuentas.find(c => c.tipo === 'efectivo' && c.id !== cuentaId && c.activa !== false); if (e) return e;
  }
  const tn = t.replace(/\s/g, '');
  let best = null, bs = 0;
  for (const c of S.cuentas) {
    if (c.id === cuentaId || c.activa === false) continue;
    let s = 0;
    const ent = normText(c.entidad).replace(/\s/g, '');
    if (ent.length > 3 && tn.includes(ent)) s += 2;
    for (const w of normText(c.nombre).split(' ').filter(w => w.length > 3 && !STOP.has(w))) if (t.includes(w)) s += 1;
    if (s > 0 && KW_TRANSF.test(t)) s += 1;
    if (s > bs) { bs = s; best = c; }
  }
  return bs >= 2 ? best : null;
}
function sugerir(concepto, cOrig, imp, cuentaId, learned) {
  const L = learned.get(normConcept(concepto)) || (cOrig ? learned.get(normConcept(cOrig)) : null);
  if (L && L.cuenta_contraria_id !== cuentaId) return { ...L, learned: true };
  const t = normText(`${concepto} ${cOrig}`);
  const cc = detectarCuentaContraria(t, cuentaId);
  if (cc) return { tipo: 'transferencia', cuenta_contraria_id: cc.id, subtipo: subtipoPorCuenta(cc), categoria_id: null };
  if (imp > 0) {
    const nom = /nomina|haberes|salario|sueldo|paga extra/.test(t) ? S.categorias.find(c => c.tipo === 'ingreso' && normText(c.nombre) === 'nomina') : null;
    return { tipo: 'ingreso', categoria_id: nom ? nom.id : null };
  }
  return { tipo: 'gasto', categoria_id: null };
}
function impProcess() {
  const D = S.importData; const { map, data, cuentaId } = D;
  if (map.fecha < 0) { toast('Indica la columna de fecha', 'warn'); return; }
  if (map.importe < 0 && map.cargo < 0 && map.abono < 0) { toast('Indica la columna de importe (o cargo/abono)', 'warn'); return; }
  try { localStorage.setItem(D.sig, JSON.stringify(map)); } catch (e) { /* noop */ }
  const learned = buildLearned(cuentaId);
  const existing = new Set(S.movimientos.filter(m => m.cuenta_id === cuentaId && m.hash_import).map(m => m.hash_import));
  const soft = S.movimientos.filter(m => m.cuenta_id === cuentaId && !m.hash_import);
  const occ = {}; const items = [];
  for (const r of data) {
    const fecha = parseDateAny(r[map.fecha]); if (!fecha) continue;
    let imp = map.importe >= 0 ? parseNum(r[map.importe]) : null;
    if ((imp === null || isNaN(imp)) && (map.cargo >= 0 || map.abono >= 0)) {
      const c = map.cargo >= 0 ? num(r[map.cargo]) : 0, a = map.abono >= 0 ? num(r[map.abono]) : 0;
      imp = Math.abs(a) - Math.abs(c);
    }
    if (imp === null || isNaN(imp) || imp === 0) continue;
    imp = round2(imp);
    const cOrig = map.concepto >= 0 ? String(r[map.concepto] ?? '').trim() : '';
    const anot = map.anot >= 0 ? String(r[map.anot] ?? '').trim() : '';
    const concepto = anot || cOrig || '(sin concepto)';
    const key = `${fecha}|${imp.toFixed(2)}|${normConcept(cOrig || anot)}`;
    occ[key] = (occ[key] || 0) + 1;
    const hash = `${cuentaId}|${key}#${occ[key]}`;
    const dup = existing.has(hash);
    const posibleDup = !dup && soft.some(m => m.fecha === fecha && round2(num(m.importe)) === imp);
    const sg = sugerir(concepto, cOrig, imp, cuentaId, learned);
    let mes = ymOf(fecha), nomina = false;
    if (sg.tipo === 'ingreso' && reglaNominaAplica(fecha, imp)) { mes = addMonths(mes, 1); nomina = true; }
    items.push({
      sel: !dup && !posibleDup, fecha, importe: imp, concepto, notas: (anot && cOrig && anot !== cOrig) ? cOrig : null,
      tipo: sg.tipo, categoria_id: sg.categoria_id || null, cuenta_contraria_id: sg.cuenta_contraria_id || null,
      subtipo: sg.subtipo || 'liquidez', mes, nomina, dup, posibleDup, hash, learned: !!sg.learned, key: normConcept(concepto)
    });
  }
  if (!items.length) { toast('No se encontraron movimientos válidos. Revisa las columnas.', 'warn'); return; }
  items.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  D.items = items; D.stage = 'preview';
  renderImport();
}
function onImpChange(el) {
  const D = S.importData; if (!D || !D.items) return;
  const i = +el.dataset.i, f = el.dataset.imp, it = D.items[i]; if (!it) return;
  if (f === 'sel') it.sel = el.checked;
  else if (f === 'tipo') {
    it.tipo = el.value; it.learned = false;
    if (it.tipo === 'transferencia') { it.categoria_id = null; const cc = detectarCuentaContraria(normText(it.concepto + ' ' + (it.notas || '')), D.cuentaId); if (cc && !it.cuenta_contraria_id) { it.cuenta_contraria_id = cc.id; it.subtipo = subtipoPorCuenta(cc); } }
    else { it.categoria_id = null; it.mes = (it.tipo === 'ingreso' && reglaNominaAplica(it.fecha, it.importe)) ? addMonths(ymOf(it.fecha), 1) : ymOf(it.fecha); it.nomina = it.mes !== ymOf(it.fecha); }
  } else if (f === 'categoria_id') {
    it.categoria_id = el.value || null;
    // Propaga a filas con el mismo concepto que aún no tengan categoría
    if (it.categoria_id) D.items.forEach(o => { if (o !== it && o.key === it.key && o.tipo === it.tipo && !o.categoria_id) o.categoria_id = it.categoria_id; });
  } else if (f === 'cuenta_contraria_id') { it.cuenta_contraria_id = el.value || null; const c = cuentaById(it.cuenta_contraria_id); if (c) it.subtipo = subtipoPorCuenta(c); }
  else if (f === 'concepto') { it.concepto = el.value; return; }
  else it[f] = el.value || null;
  renderImport();
}
async function impSave(btn) {
  const D = S.importData; const sel = D.items.filter(x => x.sel);
  if (!sel.length) { toast('No hay movimientos seleccionados', 'warn'); return; }
  const faltan = sel.filter(x => x.tipo === 'transferencia' && !x.cuenta_contraria_id);
  if (faltan.length) { toast(`Falta la cuenta contraria en ${faltan.length} transferencia(s)`, 'warn'); return; }
  const rows = [];
  for (const x of sel) {
    const isT = x.tipo === 'transferencia', tid = isT ? uuid() : null;
    const mes = (isT ? ymOf(x.fecha) : (x.mes || ymOf(x.fecha))) + '-01';
    const hash = x.dup ? `${x.hash}~${Date.now()}` : x.hash;
    const base = { id: uuid(), cuenta_id: D.cuentaId, fecha: x.fecha, mes_imputacion: mes, concepto: x.concepto, notas: x.notas, importe: x.importe, tipo: x.tipo,
      categoria_id: isT ? null : x.categoria_id, subtipo_transferencia: isT ? x.subtipo : null, cuenta_contraria_id: isT ? x.cuenta_contraria_id : null, transfer_id: tid, origen: 'import', hash_import: hash };
    rows.push(base);
    if (isT) rows.push({ ...base, id: uuid(), cuenta_id: x.cuenta_contraria_id, cuenta_contraria_id: D.cuentaId, importe: -x.importe, hash_import: null });
  }
  const r = await withSaving(btn, async () => {
    for (let i = 0; i < rows.length; i += 400) await DB.insert('movimientos', rows.slice(i, i + 400));
    await reloadTable('movimientos');
  }, `${sel.length} movimientos importados ✓`);
  if (r !== FAIL) { S.importData = null; render(); }
}

// Los campos de la previsualización y del mapeo se identifican por atributo, no por id
ChangeFilters.push(t => {
  if (t.dataset && t.dataset.imp !== undefined) { onImpChange(t); return true; }
  if (t.dataset && t.dataset.map !== undefined) { S.importData.map[t.dataset.map] = parseInt(t.value, 10); return true; }
  return false;
});

Object.assign(Actions, {
  'imp-cancel': () => { S.importData = null; renderImport(); },
  'imp-back': () => { S.importData.stage = 'map'; renderImport(); },
  'imp-process': () => impProcess(),
  'imp-selall': el => { S.importData.items.forEach(x => { x.sel = el.dataset.v === '1'; }); renderImport(); },
  'imp-save': el => impSave(el)
});

Object.assign(Changes, {
  'imp-cuenta': el => { S.importCuenta = el.value; },
  'imp-file': async el => {
    const f = el.files && el.files[0]; if (!f) return;
    if (!window.XLSX) { toast('No se pudo cargar la librería de Excel (¿sin conexión?)', 'err'); return; }
    S.importCuenta = $('#imp-cuenta').value;
    if (!S.importCuenta) { toast('Selecciona la cuenta del extracto', 'warn'); return; }
    loading(true, 'Leyendo archivo…');
    try { await impReadFile(f); } catch (e) { console.error(e); toast('No se pudo leer el archivo: ' + e.message, 'err'); }
    finally { loading(false); renderImport(); }
  }
});
