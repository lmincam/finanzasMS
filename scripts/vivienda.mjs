// =====================================================================
//  PRECIO DE LA VIVIENDA (Ministerio por provincia + INE por comunidad) · GitHub Actions (.github/workflows/vivienda.yml)
// ---------------------------------------------------------------------
//  Guarda en Supabase (tabla ajustes, clave "indice_vivienda") la variación trimestral del precio
//  de la vivienda, de dos fuentes públicas sin clave:
//    · Ministerio de Vivienda: valor tasado de la vivienda libre (€/m²) por PROVINCIA  → series 'p:<provincia>'
//    · INE: Índice de Precios de Vivienda, segunda mano, por COMUNIDAD AUTÓNOMA         → series '<comunidad>'
//  La app usa la más cercana al inmueble (provincia → comunidad → España) y la aplica al €/m²
//  de referencia cuando sale un trimestre nuevo.
//  Lo lanza .github/workflows/vivienda.yml cada lunes (o a mano). Si ya consultó hace menos de 7 días, no hace nada (salvo FORZAR=1).
//  Tablas: 76201 (base 2025, desde 2026) y 25171 (base 2015, histórico). Se usan variaciones
//  trimestrales, que no dependen de la base, para encadenar las dos.
//  Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Sin dependencias: Node 20.
//  Pruebas: INE_FIXTURE=ruta.json / MIVAU_FIXTURE=ruta.csv usan archivos locales.
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

// ---------- Ministerio de Vivienda: valor tasado por provincia (CSV trimestral) ----------
const URL_MIVAU = 'https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP006_01.csv';
const PROV = { alava: ['alava', 'araba', 'araba alava', 'alava araba'], albacete: ['albacete'], alicante: ['alicante', 'alacant'], almeria: ['almeria'], asturias: ['asturias'],
  avila: ['avila'], badajoz: ['badajoz'], balears: ['balears', 'baleares', 'illes balears', 'islas baleares'], barcelona: ['barcelona'], bizkaia: ['bizkaia', 'vizcaya'],
  burgos: ['burgos'], caceres: ['caceres'], cadiz: ['cadiz'], cantabria: ['cantabria'], castellon: ['castellon', 'castello', 'castellon de la plana'], ceuta: ['ceuta'],
  'ciudad real': ['ciudad real'], cordoba: ['cordoba'], coruna: ['coruna', 'a coruna', 'la coruna'], cuenca: ['cuenca'], gipuzkoa: ['gipuzkoa', 'guipuzcoa'],
  girona: ['girona', 'gerona'], granada: ['granada'], guadalajara: ['guadalajara'], huelva: ['huelva'], huesca: ['huesca'], jaen: ['jaen'], leon_p: ['leon'],
  lleida: ['lleida', 'lerida'], lugo: ['lugo'], madrid: ['madrid'], malaga: ['malaga'], melilla: ['melilla'], murcia: ['murcia'], navarra: ['navarra'],
  ourense: ['ourense', 'orense'], palencia: ['palencia'], palmas: ['palmas', 'las palmas'], pontevedra: ['pontevedra'], rioja: ['rioja', 'la rioja'],
  salamanca: ['salamanca'], tenerife: ['santa cruz de tenerife', 'tenerife', 's c tenerife'], segovia: ['segovia'], sevilla: ['sevilla'], soria: ['soria'],
  tarragona: ['tarragona'], teruel: ['teruel'], toledo: ['toledo'], valencia: ['valencia'], valladolid: ['valladolid'], zamora: ['zamora'], zaragoza: ['zaragoza'] };
/** Nombre de provincia tal como venga ("Coruña (A)", "Alicante/Alacant", "Balears, Illes"…) → clave, o null. Exige coincidencia exacta de una parte. */
function provDe(txt) {
  const base = norm(txt).replace(/[()]/g, ' ').replace(/[^a-z/, ]/g, ' ').replace(/\s+/g, ' ').trim();
  const partes = new Set(base.split(/[\/,]/).map(x => x.trim()).filter(Boolean));
  for (const x of [...partes]) partes.add(x.replace(/^(a|la|las|illes|islas|provincia de) /, '').replace(/ (a|la|las|illes)$/, '').trim());
  for (const [k, al] of Object.entries(PROV)) if (al.some(a => partes.has(a))) return k;
  return null;
}
/** Trimestre en cualquiera de los formatos habituales: 2026T2, 2026-T2, 2T 2026, T2 2026, II trimestre 2026, 2026/2, 30/06/2026… */
function trimTexto(t) {
  const x = norm(t).trim(); let m;
  if ((m = x.match(/(\d{4})\s*[-/ ]?\s*t\s*([1-4])\b/))) return `${m[1]}T${m[2]}`;
  if ((m = x.match(/\b([1-4])\s*(?:t|º|o)?\s*(?:trim\w*)?\s*[-/ ]\s*(\d{4})/)) && /t|trim|º/.test(x)) return `${m[2]}T${m[1]}`;
  if ((m = x.match(/\bt\s*([1-4])\D+(\d{4})/))) return `${m[2]}T${m[1]}`;
  if ((m = x.match(/\b(iv|iii|ii|i)\s+trim\w*\D+(\d{4})/))) return `${m[2]}T${{ i: 1, ii: 2, iii: 3, iv: 4 }[m[1]]}`;
  if ((m = x.match(/^(\d{4})\s*[-/.]\s*0?([1-4])$/))) return `${m[1]}T${m[2]}`;
  if ((m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}T${Math.floor((+m[2] - 1) / 3) + 1}`;
  if ((m = x.match(/^(\d{4})-(\d{2})-\d{2}/))) return `${m[1]}T${Math.floor((+m[2] - 1) / 3) + 1}`;
  return null;
}
const numES = t => { let x = String(t).trim().replace(/[€\s]/g, ''); if (!x || !/\d/.test(x)) return NaN; if (/,\d{1,2}$/.test(x)) x = x.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, ''); return Number(x); };
function csvFilas(txt) {
  const linea0 = txt.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = [';', '\t', ','].sort((a, b) => linea0.split(b).length - linea0.split(a).length)[0];
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; continue; }
    if (c === '"') q = true; else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); campo = ''; if (fila.some(x => x.trim())) filas.push(fila); fila = []; }
    else campo += c;
  }
  fila.push(campo); if (fila.some(x => x.trim())) filas.push(fila);
  return filas;
}
/**
 * Lee el CSV del Ministerio (formato "largo" con columnas de provincia/periodo/valor, o "ancho" con un trimestre por columna)
 * y devuelve { 'p:granada': { '2026T2': variación % }, … } usando solo vivienda libre, total (no por antigüedad) cuando haya esas columnas.
 */
function parsearMivau(txt) {
  const filas = csvFilas(txt); if (filas.length < 2) return { series: {}, diag: 'CSV vacío' };
  let h = filas.findIndex(f => f.some(c => /provincia|territorio|ambito|comunidad|ccaa/.test(norm(c))) || f.filter(c => trimTexto(c)).length >= 3);
  if (h < 0) h = 0;
  const cab = filas[h].map(c => norm(c).trim()), datos = filas.slice(h + 1);
  const col = re => cab.findIndex(c => re.test(c));
  const cTer = col(/provincia|territorio|ambito|comunidad|ccaa|zona|geograf/), cPer = col(/periodo|trimestre|fecha/), cAnio = col(/^ano$|^anyo$|^año$|ejercicio/), cVal = col(/valor|euros|eur|precio|€|m2|dato/);
  const cReg = col(/regimen|tipo de vivienda|tipo vivienda|clase/), cAnt = col(/antig/);
  const colsPer = cab.map((c, i) => trimTexto(filas[h][i]) ? i : -1).filter(i => i >= 0);
  const niveles = {}; // prov → { trimestre: €/m² }
  const valido = f => (cReg < 0 || !/protegid/.test(norm(f[cReg]))) && (cAnt < 0 || /total|todas|^$/.test(norm(f[cAnt]).trim()));
  for (const f of datos) {
    if (!valido(f)) continue;
    const prov = cTer >= 0 ? provDe(f[cTer]) : f.map(provDe).find(Boolean); if (!prov) continue;
    if (colsPer.length >= 3) { for (const i of colsPer) { const v = numES(f[i]); if (v > 0) (niveles[prov] ||= {})[trimTexto(filas[h][i])] = v; } continue; }
    const q = cPer >= 0 ? (trimTexto(f[cPer]) || (cAnio >= 0 ? trimTexto(`${f[cAnio]} T${String(f[cPer]).match(/[1-4]/)?.[0]}`) : null)) : null;
    const v = numES(cVal >= 0 ? f[cVal] : f[f.length - 1]);
    if (q && v > 0) (niveles[prov] ||= {})[q] = v;
  }
  const series = {};
  for (const [k, n] of Object.entries(niveles)) {
    const qs = Object.keys(n).sort(); const vars = {};
    for (let i = 1; i < qs.length; i++) vars[qs[i]] = Math.round((n[qs[i]] / n[qs[i - 1]] - 1) * 10000) / 100;
    if (Object.keys(vars).length) series['p:' + k] = vars;
  }
  return { series, diag: `cabecera fila ${h + 1}: [${filas[h].slice(0, 8).join(' | ')}${filas[h].length > 8 ? ' …' : ''}] · ejemplo: [${(datos[0] || []).slice(0, 8).join(' | ')}] · ${Object.keys(series).length} provincias` };
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
// Provincias (Ministerio de Vivienda)
try {
  let txt;
  if (process.env.MIVAU_FIXTURE) txt = readFileSync(process.env.MIVAU_FIXTURE, 'utf8');
  else {
    const r = await fetch(URL_MIVAU, { headers: { 'User-Agent': 'patrimonio-familiar (valor tasado trimestral)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = new Uint8Array(await r.arrayBuffer());
    txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1252').decode(buf);
  }
  const m = parsearMivau(txt.replace(/^\uFEFF/, ''));
  Object.assign(series, m.series);
  console.log(`Ministerio de Vivienda (provincias): ${m.diag}`);
  if (m.series['p:granada']) console.log(`  Granada: ${Object.entries(m.series['p:granada']).slice(-4).map(([q, v]) => `${q} ${v > 0 ? '+' : ''}${v} %`).join(' · ')}`);
} catch (e) { console.warn(`Ministerio de Vivienda: ${e.message} (se usará la comunidad autónoma)`); }

if (!Object.keys(series).length) { console.error('No se obtuvieron datos utilizables.'); process.exit(prev ? 0 : 1); }
// Solo los últimos 12 años (de sobra para cualquier €/m² de referencia)
for (const k of Object.keys(series)) for (const q of Object.keys(series[k])) if (q < `${new Date().getUTCFullYear() - 12}T1`) delete series[k][q];
const ultimo = Object.keys(series.nacional || series[Object.keys(series)[0]]).sort().pop();
const valor = { consultado: hoy, ultimo, fuente: 'Ministerio de Vivienda (valor tasado por provincia) e INE (IPV por comunidad)', series };
await sb('ajustes?on_conflict=clave', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ clave: 'indice_vivienda', valor, updated_at: new Date().toISOString() }]) });
console.log(`Guardado: ${Object.keys(series).length} series, último trimestre ${ultimo}${prev && prev.valor && prev.valor.ultimo !== ultimo ? ` (antes ${prev.valor.ultimo})` : ''}.`);
