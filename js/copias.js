'use strict';
/* =====================================================================
   COPIAS DE SEGURIDAD
   ---------------------------------------------------------------------
   • Copia automática semanal en Supabase Storage (espacio privado "copias"),
     se conservan las 12 últimas.
   • Copia manual en la nube o descargada al dispositivo.
   • Restauración desde la nube o desde un archivo (.json), en modo
     "fusionar": recupera lo borrado y revierte lo modificado, sin borrar
     lo que hayas creado después de la copia. Antes de restaurar se hace
     siempre una copia de seguridad del estado actual.
   Depende de: datos.js, ui.js, auth.js
   ===================================================================== */

/** Tablas en orden de restauración (primero las que otras referencian). */
const TABLAS_COPIA = ['cuentas', 'categorias', 'inmuebles', 'vehiculos', 'deudas', 'movimientos', 'snapshots', 'valoraciones', 'precios_m2',
  'amortizaciones', 'amortizaciones_plan', 'aportaciones_periodicas', 'posiciones', 'seguros', 'reglas_categoria', 'patrimonio_mensual', 'partidas_previstas', 'metas', 'ajustes'];
const COPIAS_GUARDADAS = 12, COPIA_CADA_DIAS = 7;

const Copias = {
  bucket() { return DB.client.storage.from('copias'); },
  async listar() {
    const { data, error } = await this.bucket().list('', { limit: 200, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw error;
    return (data || []).filter(f => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name));
  },
  async subir(obj, sufijo = '') {
    const d = new Date(), name = `copia_${todayISO()}_${pad(d.getHours())}${pad(d.getMinutes())}${sufijo}.json`;
    const { error } = await this.bucket().upload(name, new Blob([JSON.stringify(obj)], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
    if (error) throw error;
    return name;
  },
  async bajar(name) { const { data, error } = await this.bucket().download(name); if (error) throw error; return JSON.parse(await data.text()); },
  async borrar(names) { if (!names.length) return; const { error } = await this.bucket().remove(names); if (error) throw error; },
  async podar() { const l = await this.listar(); await this.borrar(l.slice(COPIAS_GUARDADAS).map(f => f.name)); }
};

/** Lee TODAS las tablas directamente de Supabase (no del estado en pantalla). */
async function datosCopia() {
  const out = { app: 'patrimonio-familiar', version: APP_VERSION, fecha: new Date().toISOString(), usuario: Auth.user ? Auth.user.email : null, tablas: {} };
  for (const t of TABLAS_COPIA) { if (S.missing.has(t)) continue; out.tablas[t] = await DB.all(t); }
  return out;
}
const resumenCopia = obj => Object.entries(obj.tablas || {}).map(([t, r]) => ({ t, n: (r || []).length }));
/** Acepta también el formato de copia de versiones anteriores (tablas en la raíz). */
function normalizarCopia(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('El archivo no es una copia válida');
  if (obj.tablas) return obj;
  const tablas = {};
  for (const t of TABLAS_COPIA) if (Array.isArray(obj[t])) tablas[t] = obj[t];
  if (!tablas.cuentas) throw new Error('El archivo no parece una copia de esta app');
  return { app: 'patrimonio-familiar', version: obj.version || 'anterior', fecha: obj.exportado || obj.fecha || null, tablas };
}
const estadoCopias = () => ((S.ajustesRows || []).find(r => r.clave === 'copias') || {}).valor || { auto: true };
async function guardarEstadoCopias(v) {
  const valor = { ...estadoCopias(), ...v };
  await DB.upsert('ajustes', { clave: 'copias', valor, updated_at: new Date().toISOString() }, 'clave');
  const r = (S.ajustesRows || []).find(x => x.clave === 'copias'); if (r) r.valor = valor; else (S.ajustesRows = S.ajustesRows || []).push({ clave: 'copias', valor });
}

/** Copia automática semanal (se ejecuta tras cargar los datos). */
async function copiaAutomatica() {
  const st = estadoCopias();
  if (st.auto === false) return;
  if (st.ultima && diasEntre(st.ultima.slice(0, 10), todayISO()) < COPIA_CADA_DIAS) return;
  try {
    const nombre = await Copias.subir(await datosCopia());
    await Copias.podar();
    await guardarEstadoCopias({ ultima: new Date().toISOString(), ultimaNombre: nombre, error: null });
    toast('Copia de seguridad semanal guardada en la nube ✓', 'ok', 3500);
  } catch (e) {
    console.warn('Copia automática no realizada:', e);
    S.copiasError = /bucket|not found|policy|row-level/i.test(e.message || '') ? 'Falta el espacio de copias: ejecuta sql/esquema_completo.sql en Supabase.' : (e.message || String(e));
  }
}
AfterLoad.push(copiaAutomatica);

function descargarJSON(obj, nombre) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Restaura en modo fusionar. */
async function restaurarCopia(obj, origen) {
  obj = normalizarCopia(obj);
  const res = resumenCopia(obj);
  const html = `<p>Copia del <b>${obj.fecha ? fmtDate(obj.fecha.slice(0, 10)) + ' ' + obj.fecha.slice(11, 16) : '¿fecha?'}</b>${obj.usuario ? ` (hecha por ${esc(obj.usuario)})` : ''} · ${esc(origen)}</p>
    <div class="tbl-wrap" style="max-height:220px;overflow:auto"><table class="tbl"><thead><tr><th>Tabla</th><th class="right">En la copia</th><th class="right">Ahora</th></tr></thead><tbody>
    ${res.map(r => `<tr><td>${esc(r.t)}</td><td class="right">${r.n}</td><td class="right">${S.missing.has(r.t) ? '—' : (r.t === 'ajustes' ? (S.ajustesRows || []).length : (S[r.t] || []).length)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small" style="margin-top:10px"><b>Cómo funciona:</b> se recupera todo lo que había en la copia (lo borrado vuelve y lo modificado se revierte). Lo que hayas creado después de la copia <b>se conserva</b>. Antes de empezar se guarda automáticamente una copia del estado actual.</p>`;
  if (!(await confirmDlg(html, 'Restaurar', false))) return;
  loading(true, 'Guardando copia del estado actual…');
  try {
    const actual = await datosCopia();
    try { await Copias.subir(actual, '_antes_de_restaurar'); } catch (e) { descargarJSON(actual, `antes_de_restaurar_${todayISO()}.json`); }
    const omitidas = [];
    for (const t of TABLAS_COPIA) {
      let rows = (obj.tablas[t] || []).slice();
      if (!rows.length) continue;
      if (S.missing.has(t)) { omitidas.push(t); continue; }
      loading(true, `Restaurando ${t} (${rows.length})…`);
      if (t === 'categorias') rows.sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
      // Evita choques con valores únicos que ya existen con otro id (p. ej. un movimiento reimportado)
      if (t === 'movimientos') { const ya = new Map((actual.tablas.movimientos || []).filter(m => m.hash_import).map(m => [m.hash_import, m.id])); rows = rows.filter(r => !r.hash_import || !ya.has(r.hash_import) || ya.get(r.hash_import) === r.id); }
      if (t === 'reglas_categoria') { const ya = new Map((actual.tablas.reglas_categoria || []).map(r => [normText(r.patron), r.id])); rows = rows.filter(r => !ya.has(normText(r.patron)) || ya.get(normText(r.patron)) === r.id); }
      await DB.upsertMany(t, rows, t === 'ajustes' ? 'clave' : 'id');
    }
    loading(false);
    toast(`Copia restaurada ✓${omitidas.length ? ` (omitidas: ${omitidas.join(', ')})` : ''}`, 'ok', 5000);
    await loadAll();
  } catch (e) { loading(false); console.error(e); toast('Error al restaurar: ' + (e.message || e), 'err', 7000); }
}

/* ---------- Tarjeta en Ajustes ---------- */
function renderCopiasCard() {
  const st = estadoCopias();
  return `<div class="card"><div class="card-head"><h3>💾 Copias de seguridad</h3>
      <label class="chk" style="margin:0"><input type="checkbox" id="copias-auto" ${st.auto !== false ? 'checked' : ''}> Automática cada semana</label></div>
    ${S.copiasError ? `<div class="banner amber">${esc(S.copiasError)}</div>` : ''}
    <p class="small muted" style="margin-top:0">Última: <b>${st.ultima ? fmtDate(st.ultima.slice(0, 10)) : 'ninguna todavía'}</b> · se guardan las ${COPIAS_GUARDADAS} últimas</p>
    <div class="btn-row" style="margin-bottom:12px">
      <button class="btn primary" data-action="copia-nube">Hacer copia ahora</button>
      <button class="btn" data-action="cfg-export">Descargar</button>
      <label class="btn ghost" style="cursor:pointer">Restaurar archivo…<input type="file" id="restore-file" accept=".json,application/json" hidden></label>
    </div>
    <div class="sub-title">Copias en la nube</div>
    <div id="copias-list"><div class="small muted">Cargando…</div></div></div>`;
}
async function cargarListaCopias() {
  const box = $('#copias-list'); if (!box) return;
  try {
    const l = await Copias.listar();
    box.innerHTML = l.length ? l.map(f => `<div class="cat-row"><span class="cname small">${esc(f.name.replace('copia_', '').replace('.json', '').replace(/_(\d{2})(\d{2})/, ' $1:$2').replace('_antes_de_restaurar', ' · antes de restaurar'))}
        <span class="muted">${f.metadata && f.metadata.size ? '· ' + fmtNum(f.metadata.size / 1024, 0) + ' KB' : ''}</span></span>
        <button class="mini" data-action="copia-bajar" data-n="${esc(f.name)}" title="Descargar">⬇</button><button class="btn sm" data-action="copia-restaurar" data-n="${esc(f.name)}">Restaurar</button></div>`).join('')
      : '<div class="small muted">Aún no hay copias en la nube.</div>';
  } catch (e) { box.innerHTML = `<div class="banner amber">No se puede acceder al espacio de copias. Ejecuta <code>sql/esquema_completo.sql</code> en Supabase.</div>`; }
}

Object.assign(Actions, {
  'copia-nube': async el => {
    const r = await withSaving(el, async () => { await Copias.subir(await datosCopia()); await Copias.podar(); await guardarEstadoCopias({ ultima: new Date().toISOString() }); }, 'Copia guardada en la nube ✓', 'Copiando…');
    if (r !== FAIL) { S.copiasError = null; render(); }
  },
  'cfg-export': async el => { const r = await withSaving(el, async () => descargarJSON(await datosCopia(), `patrimonio_copia_${todayISO()}.json`), null, 'Preparando…'); },
  'copia-bajar': async el => { loading(true, 'Descargando…'); try { descargarJSON(await Copias.bajar(el.dataset.n), el.dataset.n); } catch (e) { toast(e.message, 'err'); } finally { loading(false); } },
  'copia-restaurar': async el => { loading(true, 'Leyendo copia…'); let obj; try { obj = await Copias.bajar(el.dataset.n); } catch (e) { loading(false); toast(e.message, 'err'); return; } loading(false); await restaurarCopia(obj, 'nube'); }
});
Object.assign(Changes, {
  'copias-auto': async el => { try { await guardarEstadoCopias({ auto: el.checked }); toast(el.checked ? 'Copia automática activada' : 'Copia automática desactivada', 'ok'); } catch (e) { toast(e.message, 'err'); } },
  'restore-file': async el => {
    const f = el.files && el.files[0]; if (!f) return;
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { toast('El archivo no es un JSON válido', 'err'); return; } finally { el.value = ''; }
    await restaurarCopia(obj, f.name);
  }
});
