'use strict';
/* =====================================================================
   CAPA DE DATOS
   ---------------------------------------------------------------------
   Lectura y escritura en Supabase. Ningún otro módulo habla con Supabase directamente.
   Depende de: config.js, utilidades.js, estado.js
   ===================================================================== */

const ORDER = { cuentas: 'orden', categorias: 'orden', movimientos: 'fecha', inmuebles: 'created_at', vehiculos: 'created_at', deudas: 'created_at', snapshots: 'fecha', ajustes: 'clave', valoraciones: 'fecha' };
const getConn = () => ({
  url: (SUPABASE_URL || localStorage.getItem('pf_sb_url') || '').trim(),
  key: (SUPABASE_ANON_KEY || localStorage.getItem('pf_sb_key') || '').trim()
});
const DB = {
  client: null,
  init() {
    const { url, key } = getConn();
    if (!url || !key || !window.supabase) { this.client = null; return false; }
    this.client = window.supabase.createClient(url, key, { auth: { persistSession: false } });
    return true;
  },
  async all(table) {
    let out = [], from = 0;
    for (;;) {
      const { data, error } = await this.client.from(table).select('*').order(ORDER[table] || 'created_at', { ascending: true }).range(from, from + 999);
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    return out;
  },
  async insert(table, rows) {
    const { data, error } = await this.client.from(table).insert(rows).select();
    if (error) throw error; return data;
  },
  async update(table, id, patch) {
    const { data, error } = await this.client.from(table).update(patch).eq('id', id).select();
    if (error) throw error; return data;
  },
  async remove(table, id) {
    const { error } = await this.client.from(table).delete().eq('id', id);
    if (error) throw error;
  },
  async removeWhere(table, col, val) {
    const { error } = await this.client.from(table).delete().eq(col, val);
    if (error) throw error;
  },
  async upsert(table, row, onConflict) {
    const { data, error } = await this.client.from(table).upsert(row, onConflict ? { onConflict } : undefined).select();
    if (error) throw error; return data;
  }
};

function setConn(state, txt) {
  const d = $('#conn-dot'); d.className = 'dot ' + (state || '');
  $('#conn-txt').textContent = txt;
}

async function loadAll() {
  if (!DB.init()) { S.connected = false; setConn('', 'Sin configurar'); render(); return; }
  loading(true, 'Cargando datos…'); setConn('busy', 'Cargando…');
  try {
    const tables = ['cuentas', 'categorias', 'movimientos', 'inmuebles', 'vehiculos', 'deudas', 'snapshots', 'ajustes'];
    // La tabla de valoraciones es opcional (migración v2): si no existe, la app sigue funcionando.
    const valP = DB.all('valoraciones').then(v => { S.valoraciones = v; S.tablaValoraciones = true; }).catch(() => { S.valoraciones = []; S.tablaValoraciones = false; });
    const res = await Promise.all(tables.map(t => DB.all(t)));
    await valP;
    tables.forEach((t, i) => { if (t !== 'ajustes') S[t] = res[i]; });
    const regla = res[7].find(r => r.clave === 'regla_nomina');
    if (regla && regla.valor) { S.ajustes.nomina_dias = num(regla.valor.dias) || 5; S.ajustes.nomina_umbral = num(regla.valor.umbral); }
    const alertas = res[7].find(r => r.clave === 'alertas');
    if (alertas && alertas.valor) { S.ajustes.extra_umbral = num(alertas.valor.extra_umbral) || 300; S.ajustes.fondo_meses = num(alertas.valor.fondo_meses) || 6; }
    S.connected = true; S.loaded = true;
    if (!S.importCuenta) S.importCuenta = (S.cuentas.find(c => c.tipo === 'corriente') || S.cuentas[0] || {}).id || null;
    setConn('ok', 'Conectado');
  } catch (e) {
    console.error(e); S.connected = false;
    setConn('err', 'Error');
    const msg = /relation|does not exist|schema cache/i.test(e.message || '') ? 'Faltan las tablas: ejecuta el script SQL en Supabase.' : (e.message || String(e));
    toast('No se pudo cargar: ' + msg, 'err', 6000);
    if (S.tab !== 'ajustes') S.tab = 'ajustes';
  } finally { loading(false); render(); }
}
async function reloadTable(t) { S[t] = await DB.all(t); }
async function saveEntity(table, id, vals) {
  if (id) await DB.update(table, id, vals); else await DB.insert(table, [vals]);
  await reloadTable(table);
}
