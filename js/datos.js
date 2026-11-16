'use strict';
/* =====================================================================
   CAPA DE DATOS
   ---------------------------------------------------------------------
   Lectura y escritura en Supabase. Ningún otro módulo habla con Supabase directamente.
   Depende de: config.js, utilidades.js, estado.js
   ===================================================================== */

const OPTIONAL_TABLES = ['valoraciones', 'precios_m2', 'amortizaciones', 'amortizaciones_plan', 'aportaciones_periodicas', 'posiciones', 'seguros', 'reglas_categoria'];
const ORDER = { cuentas: 'orden', categorias: 'orden', movimientos: 'fecha', inmuebles: 'created_at', vehiculos: 'created_at', deudas: 'created_at', snapshots: 'fecha', ajustes: 'clave', valoraciones: 'fecha',
  precios_m2: 'fecha', amortizaciones: 'fecha', amortizaciones_plan: 'created_at', aportaciones_periodicas: 'created_at', posiciones: 'orden', seguros: 'created_at', reglas_categoria: 'created_at' };
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
      let q = this.client.from(table).select('*').order(ORDER[table] || 'created_at', { ascending: true });
      if (table !== 'ajustes') q = q.order('id', { ascending: true }); // desempate estable para paginar > 1.000 filas sin saltos
      const { data, error } = await q.range(from, from + 999);
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
  async updateIn(table, ids, patch) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await this.client.from(table).update(patch).in('id', ids.slice(i, i + 200));
      if (error) throw error;
    }
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
    // Tablas opcionales (migraciones v2 y v4): si no existen, la app sigue funcionando y lo indica.
    S.missing = new Set();
    const optP = Promise.all(OPTIONAL_TABLES.map(t => DB.all(t).then(v => { S[t] = v; }).catch(() => { S[t] = []; S.missing.add(t); })));
    const res = await Promise.all(tables.map(t => DB.all(t)));
    await optP;
    S.tablaValoraciones = !S.missing.has('valoraciones');
    S.v4 = !S.missing.has('seguros') && !S.missing.has('precios_m2');
    tables.forEach((t, i) => { if (t !== 'ajustes') S[t] = res[i]; });
    const regla = res[7].find(r => r.clave === 'regla_nomina');
    if (regla && regla.valor) { S.ajustes.nomina_dias = num(regla.valor.dias) || 5; S.ajustes.nomina_umbral = num(regla.valor.umbral); }
    const alertas = res[7].find(r => r.clave === 'alertas');
    if (alertas && alertas.valor) { S.ajustes.extra_umbral = num(alertas.valor.extra_umbral) || 300; S.ajustes.fondo_meses = num(alertas.valor.fondo_meses) || 6; }
    S.connected = true; S.loaded = true;
    if (!S.importCuenta) S.importCuenta = (S.cuentas.find(c => c.tipo === 'corriente') || S.cuentas[0] || {}).id || null;
    setConn('ok', 'Conectado');
    for (const fn of AfterLoad) { try { await fn(); } catch (e) { console.error(e); toast('Aviso: ' + (e.message || e), 'warn', 5000); } }
  } catch (e) {
    console.error(e); S.connected = false;
    setConn('err', 'Error');
    const msg = /relation|does not exist|schema cache/i.test(e.message || '') ? 'Faltan las tablas: ejecuta el script SQL en Supabase.' : (e.message || String(e));
    toast('No se pudo cargar: ' + msg, 'err', 6000);
    if (S.tab !== 'ajustes') S.tab = 'ajustes';
  } finally { loading(false); render(); }
}
async function reloadTable(t) { S[t] = await DB.all(t); }
async function reloadTables(...ts) { await Promise.all(ts.map(reloadTable)); }
async function saveEntity(table, id, vals) {
  if (id) await DB.update(table, id, vals); else await DB.insert(table, [vals]);
  await reloadTable(table);
}
