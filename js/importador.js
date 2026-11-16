'use strict';
/* =====================================================================
   IMPORTADOR DE EXTRACTOS (Unicaja)
   ---------------------------------------------------------------------
   Lectura de Excel/CSV, mapeo de columnas, categorización automática con
   reglas, preguntas agrupadas por comercio, aprendizaje, duplicados y guardado.
   Depende de: datos.js, calculos.js, ui.js, cuentas.js, reglas.js
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
  const validos = items.filter(x => !x.dup);
  const auto = validos.filter(x => x.fuenteInicial).length, pct = validos.length ? auto / validos.length : 1;
  const pendientes = D.grupos.filter(g => g.idxs.some(i => items[i].sel && necesitaAyuda(items[i])));
  const reglasOff = S.missing.has('reglas_categoria');
  box.innerHTML = `<div class="card-head"><h3>📥 Previsualización · ${esc(cta ? cta.nombre : '')}</h3>
      <span class="sub">${fechas.length ? `${DIAS[weekday(fechas[0])]} ${fmtDate(fechas[0])} → ${DIAS[weekday(fechas[fechas.length - 1])]} ${fmtDate(fechas[fechas.length - 1])}` : ''}</span></div>
    ${reglasOff ? '<div class="banner amber">Ejecuta <code>sql/04_migracion_reglas.sql</code> para que la app recuerde cómo categorizas y la próxima vez lo haga sola.</div>' : ''}
    <div class="imp-summary" style="flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>🤖 <b>Categorizados automáticamente: ${auto} de ${validos.length}</b> (${fmtPct(pct, 0)})</span>
        <span class="muted small">Cuantas más importaciones hagas, más alto será este porcentaje</span></div>
      ${pctBar(pct, pct >= 0.9 ? '' : pct >= 0.6 ? 'amber' : 'red')}
    </div>
    ${D.grupos.length ? `<div class="card" style="border:2px solid ${pendientes.length ? '#f59e0b' : '#16a34a'};box-shadow:none">
      <div class="card-head"><h3>${pendientes.length ? `❓ Necesito tu ayuda con ${pendientes.length} comercio(s)` : '✅ Todo categorizado'}</h3>
        <span class="sub">Lo que elijas se guardará como regla y la próxima vez lo haré yo</span></div>
      ${D.grupos.map((g, k) => grupoCard(g, k)).join('')}</div>` : ''}
    <div class="imp-summary">
      <span><b>${sel.length}</b> de ${items.length} seleccionados</span>
      <span class="pos">Ingresos ${fmtEUR(sum(sel.filter(x => x.tipo === 'ingreso'), 'importe'))}</span>
      <span class="neg">Gastos ${fmtEUR(-sum(sel.filter(x => x.tipo === 'gasto'), 'importe'))}</span>
      <span class="muted">Transferencias ${fmtEUR(sum(sel.filter(x => x.tipo === 'transferencia'), 'importe'))}</span>
      ${nDup ? `<span class="badge amber">${nDup} ya importados</span>` : ''}${nPos ? `<span class="badge amber">${nPos} posibles duplicados</span>` : ''}
      <span class="sp"></span>
      <button class="btn sm ghost" data-action="imp-selall" data-v="1">Marcar todos</button><button class="btn sm ghost" data-action="imp-selall" data-v="0">Ninguno</button>
    </div>
    <details ${pendientes.length ? '' : 'open'}><summary>Todos los movimientos (${items.length}) · puedes corregir cualquiera y también aprenderé</summary>
      <div class="imp-row imp-head"><div></div><div>Fecha</div><div>Concepto</div><div class="right">Importe</div><div>Tipo</div><div>Categoría / destino</div><div>Imputar a</div></div>
      ${items.map((x, i) => impRow(x, i)).join('')}
    </details>
    <div class="actions" style="margin-top:14px"><button class="btn ghost" data-action="imp-back">← Columnas</button><button class="btn ghost" data-action="imp-cancel">Cancelar</button>
      <button class="btn success" data-action="imp-save">Guardar ${sel.length} movimientos${pendientes.length ? ` (${pendientes.length} sin resolver)` : ''}</button></div>`;
}
const necesitaAyuda = x => !x.dup && (x.tipo === 'transferencia' ? !x.cuenta_contraria_id : !x.categoria_id);
const FUENTE_BADGE = { regla: ['green', 'Regla'], aprendida: ['green', 'Aprendida'], transferencia: ['blue', 'Transferencia detectada'], predefinida: ['blue', 'Predefinida'], nomina: ['blue', 'Nómina'] };
function selectCategoria(tipo, sel, attrs) {
  return `<select ${attrs}>${catOpts(tipo, sel, '— Elige categoría —')}<option value="__new__">➕ Nueva categoría…</option></select>`;
}
/** Tarjeta de un grupo de movimientos del mismo comercio que la app no ha sabido categorizar. */
function grupoCard(g, k) {
  const D = S.importData, its = g.idxs.map(i => D.items[i]), x = its[0];
  const ok = !its.some(necesitaAyuda), isT = x.tipo === 'transferencia';
  return `<div style="border-top:1px solid var(--line);padding:12px 0;${ok ? 'opacity:.75' : ''}">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <div><b>${ok ? '✅' : '❓'} ${esc(x.notas || x.concepto)}</b> <span class="small muted">${its.length > 1 ? `· ${its.length} movimientos` : ''}</span></div>
      <div class="num ${x.importe >= 0 ? 'pos' : 'neg'}"><b>${fmtEUR(sum(its, 'importe'))}</b></div></div>
    <div class="small muted" style="margin-bottom:8px">${its.slice(0, 4).map(o => `${fmtDateShort(o.fecha)} · ${esc(o.concepto)} · ${signed(o.importe)}`).join('<br>')}${its.length > 4 ? '<br>…' : ''}</div>
    <div class="form-grid" style="grid-template-columns:minmax(130px,1fr) minmax(120px,.8fr) minmax(180px,1.4fr) auto;align-items:end">
      <div><label>Palabra clave de la regla</label><input data-grp="patron" data-g="${k}" value="${esc(g.patron)}"></div>
      <div><label>Tipo</label><select data-grp="tipo" data-g="${k}">${Object.entries(TIPO_MOV).map(([v, l]) => `<option value="${v}" ${x.tipo === v ? 'selected' : ''}>${v === 'transferencia' ? 'Transferencia' : l}</option>`).join('')}</select></div>
      <div><label>${isT ? 'Cuenta contraria' : 'Categoría'}</label>${isT ? `<select data-grp="cuenta_contraria_id" data-g="${k}">${accOpts(x.cuenta_contraria_id, { exclude: D.cuentaId, empty: '— Elige cuenta —' })}</select>` : selectCategoria(x.tipo, x.categoria_id, `data-grp="categoria_id" data-g="${k}"`)}</div>
      <div><label class="chk" style="margin:0 0 8px"><input type="checkbox" data-grp="recordar" data-g="${k}" ${g.recordar !== false ? 'checked' : ''}> Recordar</label></div>
    </div></div>`;
}
function impRow(x, i) {
  const isT = x.tipo === 'transferencia';
  const fb = x.fuente && FUENTE_BADGE[x.fuente];
  return `<div class="imp-row ${x.dup ? 'dup' : ''} ${x.sel ? '' : 'off'}">
    <input type="checkbox" data-imp="sel" data-i="${i}" ${x.sel ? 'checked' : ''}>
    <div class="small num">${fmtDateShort(x.fecha)} <span class="muted">${DIAS[weekday(x.fecha)]}</span></div>
    <input class="c-concept" data-imp="concepto" data-i="${i}" value="${esc(x.concepto)}" title="${esc(x.notas || '')}">
    <div class="num right ${x.importe >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${signed(x.importe)}</div>
    <select class="c-tipo" data-imp="tipo" data-i="${i}">${Object.entries(TIPO_MOV).map(([k, l]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${k === 'ingreso' ? 'Ingreso' : l}</option>`).join('')}</select>
    ${isT ? `<div class="c-cat tsel"><select data-imp="cuenta_contraria_id" data-i="${i}">${accOpts(x.cuenta_contraria_id, { exclude: S.importData.cuentaId, empty: x.importe < 0 ? '→ ¿Hacia?' : '← ¿Desde?' })}</select></div>
      <select class="c-mes" data-imp="subtipo" data-i="${i}">${subOpts(x.subtipo)}</select>`
    : `${selectCategoria(x.tipo, x.categoria_id, `class="c-cat" data-imp="categoria_id" data-i="${i}"`)}
      <input class="c-mes" type="month" data-imp="mes" data-i="${i}" value="${x.mes}">`}
    <div class="flags">
      ${x.dup ? '<span class="badge amber">Ya importado</span>' : ''}${x.posibleDup ? '<span class="badge amber">Posible duplicado (ya registrado a mano o como aportación periódica)</span>' : ''}
      ${x.nomina && x.tipo === 'ingreso' ? `<span class="badge blue">Regla nómina → ${ymLabel(x.mes, true)}</span>` : ''}
      ${fb && !x.editado ? `<span class="badge ${fb[0]}">${fb[1]}${x.regla ? ': ' + esc(x.regla.patron) : x.patronPredef ? ': ' + esc(x.patronPredef) : ''}</span>` : ''}
      ${!x.dup && necesitaAyuda(x) ? '<span class="badge red">Sin categoría</span>' : ''}
      ${x.editado ? `<span class="badge green">✎ corregido</span> <label class="small" style="display:inline-flex;gap:4px;align-items:center;margin:0;font-weight:500"><input type="checkbox" data-imp="recordar" data-i="${i}" ${x.recordar !== false ? 'checked' : ''}> recordar como regla</label>
        <input data-imp="patron" data-i="${i}" value="${esc(x.patron)}" style="width:150px;padding:3px 6px;font-size:12px" title="Palabra clave de la regla">` : ''}
    </div>
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
function impProcess() {
  const D = S.importData; const { map, data, cuentaId } = D;
  if (map.fecha < 0) { toast('Indica la columna de fecha', 'warn'); return; }
  if (map.importe < 0 && map.cargo < 0 && map.abono < 0) { toast('Indica la columna de importe (o cargo/abono)', 'warn'); return; }
  try { localStorage.setItem(D.sig, JSON.stringify(map)); } catch (e) { /* noop */ }
  const ctx = contextoClasificacion(cuentaId);
  const existing = new Set(S.movimientos.filter(m => m.cuenta_id === cuentaId && m.hash_import).map(m => m.hash_import));
  const soft = S.movimientos.filter(m => m.cuenta_id === cuentaId && !m.hash_import);
  const autos = S.movimientos.filter(m => m.cuenta_id === cuentaId && m.origen === 'auto');
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
    const posibleDup = !dup && (soft.some(m => m.fecha === fecha && round2(num(m.importe)) === imp)
      || autos.some(m => round2(num(m.importe)) === imp && Math.abs(diasEntre(m.fecha, fecha)) <= 5)); // ya generada por aportación periódica
    const sg = clasificar(concepto, cOrig, imp, ctx);
    let mes = ymOf(fecha), nomina = false;
    if (sg.tipo === 'ingreso' && reglaNominaAplica(fecha, imp)) { mes = addMonths(mes, 1); nomina = true; }
    items.push({
      sel: !dup && !posibleDup, fecha, importe: imp, concepto, notas: (anot && cOrig && anot !== cOrig) ? cOrig : null,
      tipo: sg.tipo, categoria_id: sg.categoria_id || null, cuenta_contraria_id: sg.cuenta_contraria_id || null,
      subtipo: sg.subtipo || 'liquidez', mes, nomina, dup, posibleDup, hash, key: normConcept(concepto),
      fuente: sg.fuente, fuenteInicial: sg.fuente, regla: sg.regla || null, patronPredef: sg.patronPredef || null,
      patron: sg.regla ? sg.regla.patron : (sg.patronPredef || proponerPatron(cOrig, concepto)), editado: false, recordar: true
    });
  }
  if (!items.length) { toast('No se encontraron movimientos válidos. Revisa las columnas.', 'warn'); return; }
  items.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  // Agrupa por comercio (palabra clave propuesta) lo que no se ha podido categorizar
  const grupos = new Map();
  items.forEach((x, i) => { if (x.dup || !necesitaAyuda(x)) return; const k = normPatron(x.patron) || '_'; if (!grupos.has(k)) grupos.set(k, { patron: x.patron, idxs: [], recordar: true }); grupos.get(k).idxs.push(i); });
  D.grupos = [...grupos.values()];
  D.items = items; D.stage = 'preview';
  renderImport();
}
function marcarEditado(it) { it.editado = true; it.fuente = null; }
function onImpChange(el) {
  const D = S.importData; if (!D || !D.items) return;
  const i = +el.dataset.i, f = el.dataset.imp, it = D.items[i]; if (!it) return;
  if (el.value === '__new__') { nuevaCategoriaImport(it.tipo, id => { it.categoria_id = id; marcarEditado(it); }); return; }
  if (f === 'sel') it.sel = el.checked;
  else if (f === 'recordar') { it.recordar = el.checked; return; }
  else if (f === 'patron') { it.patron = el.value; return; }
  else if (f === 'tipo') {
    it.tipo = el.value; marcarEditado(it);
    if (it.tipo === 'transferencia') { it.categoria_id = null; const cc = detectarCuentaContraria(normText(it.concepto + ' ' + (it.notas || '')), D.cuentaId); if (cc && !it.cuenta_contraria_id) { it.cuenta_contraria_id = cc.id; it.subtipo = subtipoPorCuenta(cc); } }
    else { it.categoria_id = null; it.mes = (it.tipo === 'ingreso' && reglaNominaAplica(it.fecha, it.importe)) ? addMonths(ymOf(it.fecha), 1) : ymOf(it.fecha); it.nomina = it.mes !== ymOf(it.fecha); }
  } else if (f === 'categoria_id') {
    it.categoria_id = el.value || null; marcarEditado(it);
    // Propaga a filas con el mismo concepto que aún no tengan categoría
    if (it.categoria_id) D.items.forEach(o => { if (o !== it && o.key === it.key && o.tipo === it.tipo && !o.categoria_id) o.categoria_id = it.categoria_id; });
  } else if (f === 'cuenta_contraria_id') { it.cuenta_contraria_id = el.value || null; marcarEditado(it); const c = cuentaById(it.cuenta_contraria_id); if (c) it.subtipo = subtipoPorCuenta(c); }
  else if (f === 'concepto') { it.concepto = el.value; return; }
  else it[f] = el.value || null;
  renderImport();
}
/** Cambios en una tarjeta de grupo: se aplican a todos sus movimientos. */
function onGrupoChange(el) {
  const D = S.importData; if (!D || !D.grupos) return;
  const g = D.grupos[+el.dataset.g], f = el.dataset.grp; if (!g) return;
  const its = g.idxs.map(i => D.items[i]);
  if (el.value === '__new__') { nuevaCategoriaImport(its[0].tipo, id => its.forEach(it => { it.categoria_id = id; marcarEditado(it); })); return; }
  if (f === 'patron') { g.patron = el.value; its.forEach(it => { it.patron = el.value; }); return; }
  if (f === 'recordar') { g.recordar = el.checked; its.forEach(it => { it.recordar = el.checked; }); return; }
  for (const it of its) {
    marcarEditado(it); it.patron = g.patron; it.recordar = g.recordar !== false;
    if (f === 'tipo') {
      it.tipo = el.value; it.categoria_id = null;
      if (it.tipo === 'transferencia') { const cc = detectarCuentaContraria(normText(it.concepto + ' ' + (it.notas || '')), D.cuentaId); it.cuenta_contraria_id = cc ? cc.id : null; it.subtipo = subtipoPorCuenta(cc); }
      else { it.mes = (it.tipo === 'ingreso' && reglaNominaAplica(it.fecha, it.importe)) ? addMonths(ymOf(it.fecha), 1) : ymOf(it.fecha); it.nomina = it.mes !== ymOf(it.fecha); }
    } else if (f === 'categoria_id') it.categoria_id = el.value || null;
    else if (f === 'cuenta_contraria_id') { it.cuenta_contraria_id = el.value || null; it.subtipo = subtipoPorCuenta(cuentaById(it.cuenta_contraria_id)); }
  }
  renderImport();
}
/** Crea una categoría desde el importador y la asigna al terminar. */
function nuevaCategoriaImport(tipo, asignar) {
  const t = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  openForm({ title: `Nueva categoría de ${t}`, fields: [
      { name: 'nombre', label: 'Nombre', required: true, ph: 'Ej: Comida a domicilio' },
      { name: 'parent_id', label: 'Dentro de', type: 'select', options: () => [{ v: '', l: '— Es una categoría principal —' }].concat(S.categorias.filter(c => c.tipo === t && !c.parent_id).sort(byOrden).map(c => ({ v: c.id, l: c.nombre }))) },
      { name: 'presupuesto_mensual', label: 'Presupuesto mensual (€, opcional)', type: 'number' }],
    onSubmit: async v => {
      const [row] = await DB.insert('categorias', [{ nombre: v.nombre, tipo: t, parent_id: v.parent_id || null, presupuesto_mensual: v.presupuesto_mensual || 0, orden: S.categorias.length + 1, color: PALETTE[S.categorias.length % PALETTE.length] }]);
      await reloadTable('categorias');
      asignar(row.id);
    } });
  renderImport(); // devuelve el select a su valor mientras se rellena el formulario
}
async function impSave(btn) {
  const D = S.importData; const sel = D.items.filter(x => x.sel);
  if (!sel.length) { toast('No hay movimientos seleccionados', 'warn'); return; }
  const faltan = sel.filter(x => x.tipo === 'transferencia' && !x.cuenta_contraria_id);
  if (faltan.length) { toast(`Falta la cuenta contraria en ${faltan.length} transferencia(s)`, 'warn'); return; }
  const sinCat = sel.filter(x => x.tipo !== 'transferencia' && !x.categoria_id);
  if (sinCat.length && !(await confirmDlg(`Quedan <b>${sinCat.length}</b> movimiento(s) sin categoría. Puedes guardarlos así y categorizarlos después, pero no aprenderé de ellos.<br><br>¿Guardar igualmente?`, 'Guardar igualmente', false))) return;
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
  let aprendido = { nuevas: 0, actualizadas: 0 };
  const r = await withSaving(btn, async () => {
    for (let i = 0; i < rows.length; i += 400) await DB.insert('movimientos', rows.slice(i, i + 400));
    // Aprendizaje: lo que has categorizado o corregido tú se convierte en regla
    aprendido = await aprenderReglas(sel.filter(x => x.editado && x.recordar !== false));
    await contarUsos(sel);
    await reloadTables('movimientos', ...(S.missing.has('reglas_categoria') ? [] : ['reglas_categoria']));
  });
  if (r !== FAIL) {
    toast(`${sel.length} movimientos importados ✓${aprendido.nuevas || aprendido.actualizadas ? ` · ${aprendido.nuevas} regla(s) nueva(s)${aprendido.actualizadas ? `, ${aprendido.actualizadas} actualizada(s)` : ''}` : ''}`, 'ok', 5000);
    S.importData = null; render();
  }
}

// Los campos de la previsualización y del mapeo se identifican por atributo, no por id
ChangeFilters.push(t => {
  if (t.dataset && t.dataset.grp !== undefined) { onGrupoChange(t); return true; }
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
