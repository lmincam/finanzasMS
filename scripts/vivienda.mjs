// =====================================================================
//  ÍNDICE DE PRECIOS DE VIVIENDA (INE)  ·  lo ejecuta GitHub Actions (.github/workflows/precios.yml)
// ---------------------------------------------------------------------
//  Descarga del INE (API pública, sin clave) la variación trimestral del precio de la vivienda
//  de segunda mano por comunidad autónoma y la guarda en Supabase (tabla ajustes, clave
//  "indice_vivienda"). La app la aplica al €/m² de cada inmueble cuando sale un trimestre nuevo.
//  Solo consulta al INE una vez por semana (el INE publica cada trimestre).
//  Tablas: 76201 (base 2025, desde 2026) y 25171 (base 2015, histórico). Se usan variaciones
//  trimestrales, que no dependen de la base, para encadenar las dos.
//  Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Sin dependencias: Node 20.
//  Pruebas: INE_FIXTURE=ruta.json usa un archivo local en lugar del INE.
// =====================================================================
import { readFileSync } from 'node:fs';

const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY_SB = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!URL_SB || !KEY_SB) { console.error('Faltan los secretos SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en GitHub.'); process.exit(1); }
const H = { apikey: KEY_SB, 'Content-Type': 'application/json', ...(KEY_SB.startsWith('eyJ') ? { Authorization: `Bearer ${KEY_SB}` } : {}) };
async function sb(path, opts = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

/** Nombre de serie del INE → clave de comunidad que usa la app (js/inmuebles.js, CCAA). */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLAVES = [['nacional', 'nacional'], ['andalucia', 'andalucia'], ['aragon', 'aragon'], ['asturias', 'asturias'], ['balears', 'balears'], ['baleares', 'balears'],
  ['canarias', 'canarias'], ['cantabria', 'cantabria'], ['leon', 'leon'], ['mancha', 'mancha'], ['cataluna', 'cataluna'], ['valenciana', 'valenciana'],
  ['extremadura', 'extremadura'], ['galicia', 'galicia'], ['madrid', 'madrid'], ['murcia', 'murcia'], ['navarra', 'navarra'], ['vasco', 'vasco'],
  ['rioja', 'rioja'], ['ceuta', 'ceuta'], ['melilla', 'melilla']];
const claveDe = nombre => { const n = norm(nombre); const c = CLAVES.find(([t]) => n.includes(t)); return c ? c[1] : null; };
/** Trimestre 'AAAAT1' de un dato del INE (por FK_Periodo 19-22, o por la fecha). */
function trimestre(d) {
  const p = Number(d.FK_Periodo);
  if (p >= 19 && p <= 22 && d.Anyo) return `${d.Anyo}T${p - 18}`;
  const f = new Date(typeof d.Fecha === 'number' ? d.Fecha : Date.parse(d.Fecha));
  if (isNaN(f)) return null;
  return `${f.getUTCFullYear()}T${Math.floor(f.getUTCMonth() / 3) + 1}`;
}
/**
 * Lee una tabla del INE y devuelve { clave: { 'AAAAT1': variación % } } para vivienda de segunda mano
 * (si no hay, la general). Usa la serie "Variación trimestral" o, si falta, la calcula con el "Índice".
 */
function parsearTabla(series) {
  const out = {}, prio = {};
  for (const s of series || []) {
    const n = norm(s.Nombre), k = claveDe(s.Nombre); if (!k) continue;
    const tipo = n.includes('segunda mano') ? 2 : n.includes('general') ? 1 : 0; if (!tipo) continue;
    const esVar = n.includes('variacion trimestral'), esInd = !n.includes('variacion') && (n.includes('indice') || n.includes('índice'));
    if (!esVar && !esInd) continue;
    const datos = (s.Data || []).filter(d => d.Valor !== null && d.Valor !== undefined && !d.Secreto).map(d => ({ q: trimestre(d), v: Number(d.Valor) })).filter(d => d.q && isFinite(d.v)).sort((a, b) => a.q < b.q ? -1 : 1);
    let vars = {};
    if (esVar) datos.forEach(d => { vars[d.q] = d.v; });
    else for (let i = 1; i < datos.length; i++) if (datos[i - 1].v > 0) vars[datos[i].q] = Math.round((datos[i].v / datos[i - 1].v - 1) * 10000) / 100;
    const p = tipo * 10 + (esVar ? 1 : 0);
    if (!Object.keys(vars).length || (prio[k] || 0) > p) continue;
    // Misma prioridad (p. ej. dos tablas): se mezclan; la que se lee después manda
    out[k] = (prio[k] || 0) === p ? { ...out[k], ...vars } : vars; prio[k] = p;
  }
  return out;
}

const hoy = new Date().toISOString().slice(0, 10);
const prev = ((await sb('ajustes?select=valor&clave=eq.indice_vivienda')) || [])[0];
const forzar = process.env.FORZAR === '1' || process.env.INE_FIXTURE;
if (prev && prev.valor && prev.valor.consultado && (Date.parse(hoy) - Date.parse(prev.valor.consultado)) / 864e5 < 7 && !forzar) {
  console.log(`IPV ya consultado el ${prev.valor.consultado} (último trimestre ${prev.valor.ultimo}). Nada que hacer.`); process.exit(0);
}

async function tabla(id) {
  if (process.env.INE_FIXTURE) { const f = JSON.parse(readFileSync(process.env.INE_FIXTURE, 'utf8')); return f[id] || []; }
  const r = await fetch(`https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/${id}?nult=48`, { headers: { 'User-Agent': 'patrimonio-familiar (IPV trimestral)' } });
  if (!r.ok) throw new Error(`INE ${id}: HTTP ${r.status}`);
  return r.json();
}
const series = {};
for (const id of [25171, 76201]) {           // primero el histórico; la base nueva manda en los trimestres que coinciden
  try {
    const t = parsearTabla(await tabla(id));
    for (const [k, v] of Object.entries(t)) series[k] = { ...(series[k] || {}), ...v };
    console.log(`Tabla ${id}: ${Object.keys(t).length} series`);
  } catch (e) { console.warn(`Tabla ${id}: ${e.message}`); }
}
if (!Object.keys(series).length) { console.error('El INE no devolvió datos utilizables.'); process.exit(prev ? 0 : 1); }
// Solo los últimos 12 años (de sobra para cualquier €/m² de referencia)
for (const k of Object.keys(series)) for (const q of Object.keys(series[k])) if (q < `${new Date().getUTCFullYear() - 12}T1`) delete series[k][q];
const ultimo = Object.keys(series.nacional || series[Object.keys(series)[0]]).sort().pop();
const valor = { consultado: hoy, ultimo, fuente: 'INE · Índice de Precios de Vivienda (segunda mano, por comunidad autónoma)', series };
await sb('ajustes?on_conflict=clave', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ clave: 'indice_vivienda', valor, updated_at: new Date().toISOString() }]) });
console.log(`Guardado: ${Object.keys(series).length} series, último trimestre ${ultimo}${prev && prev.valor && prev.valor.ultimo !== ultimo ? ` (antes ${prev.valor.ultimo})` : ''}.`);
