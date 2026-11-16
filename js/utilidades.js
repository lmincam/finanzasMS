'use strict';
/* =====================================================================
   UTILIDADES
   ---------------------------------------------------------------------
   Funciones puras: DOM, números y formato €, fechas, texto.
   Depende de: config.js
   ===================================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const FAIL = Symbol('fail');
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const byOrden = (a, b) => (num(a.orden) - num(b.orden)) || String(a.nombre).localeCompare(String(b.nombre), 'es');

/** Convierte "1.250,50 €", "-12,3", 1250.5, "(45,00)" → número. Vacío → null. */
function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[€\s ]/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return neg ? -n : n;
}
const num = v => { const n = parseNum(v); return (n === null || isNaN(n)) ? 0 : n; };
const sum = (arr, f) => arr.reduce((a, x) => a + num(typeof f === 'function' ? f(x) : (f ? x[f] : x)), 0);

/** Formato español estricto: 1.250,50 € (con separador de miles siempre). */
function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return '—';
  const fixed = Math.abs(n).toFixed(dec);
  const neg = n < 0 && Number(fixed) !== 0;
  const [i, d] = fixed.split('.');
  return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + d : '');
}
const fmtEUR = (n, dec = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : fmtNum(n, dec) + ' €';
const fmtPct = (x, dec = 1) => (x === null || x === undefined || !isFinite(x)) ? '—' : fmtNum(x * 100, dec) + ' %';
const signed = n => (n > 0 ? '+' : '') + fmtEUR(n);
const numInput = v => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ',');

/* ---------- Fechas (siempre como texto ISO 'YYYY-MM-DD', sin husos) ---------- */
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ymOf = iso => String(iso || '').slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
const monthsBetween = (a, b) => { if (a > b) [a, b] = [b, a]; const out = []; let c = a; while (c <= b && out.length < 240) { out.push(c); c = addMonths(c, 1); } return out; };
const ymLabel = (ym, short = false) => { if (!ym) return '—'; const [y, m] = ym.split('-').map(Number); return short ? `${MES_C[m - 1]} ${String(y).slice(2)}` : `${MESES[m - 1]} ${y}`; };
const fmtDate = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
const fmtDateShort = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—';
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const monthsDiff = (a, b) => { const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0); };
const quarterOf = iso => Math.floor((Number(String(iso).slice(5, 7)) - 1) / 3) + 1;
const weekday = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];

/** Días laborables (L-V) que quedan en el mes DESPUÉS de la fecha dada. */
function diasLaborablesRestantes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dim = daysInMonth(y, m); let c = 0;
  for (let k = d + 1; k <= dim; k++) { const wd = new Date(y, m - 1, k).getDay(); if (wd !== 0 && wd !== 6) c++; }
  return c;
}
/** Regla de nómina: ¿la fecha cae en los últimos N días laborables del mes? */
const enVentanaNomina = iso => diasLaborablesRestantes(iso) < Math.max(1, num(S.ajustes.nomina_dias));
const reglaNominaAplica = (fecha, importe) => num(importe) > 0 && num(importe) >= num(S.ajustes.nomina_umbral) && enVentanaNomina(fecha);

function parseDateAny(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let y, mo, d, m;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
const normText = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const normConcept = s => normText(s).replace(/\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
const zeroNulls = (v, keys) => { keys.forEach(k => { if (v[k] === null) v[k] = 0; }); return v; };
