// =====================================================================
//  PRECIOS DIARIOS POR ISIN  ·  lo ejecuta GitHub Actions (.github/workflows/precios.yml)
// ---------------------------------------------------------------------
//  1. Lee de Supabase los ISIN de tus productos (tabla posiciones).
//  2. Descarga los precios de cierre desde EODHD (si hay clave EODHD_API_KEY) o, si no, desde Yahoo Finance.
//  3. Los guarda en la tabla "precios". La app calcula con ellos el valor de cada cuenta de inversión.
//  Secretos necesarios en GitHub (Settings → Secrets and variables → Actions):
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y, recomendado, EODHD_API_KEY (plan gratuito: 20 consultas/día).
//  Sin dependencias: Node 20 (fetch nativo).
// =====================================================================
const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY_SB = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KEY_EOD = process.env.EODHD_API_KEY || '';
if (!URL_SB || !KEY_SB) { console.error('Faltan los secretos SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en GitHub.'); process.exit(1); }

const hoy = new Date().toISOString().slice(0, 10);
const restarDias = (iso, n) => new Date(Date.parse(iso) - n * 864e5).toISOString().slice(0, 10);
const H = { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}`, 'Content-Type': 'application/json' };
async function sb(path, opts = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const getJSON = async (url, headers = {}) => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
const ocultar = s => String(s).replaceAll(KEY_EOD || '¤', '***').replaceAll(KEY_SB, '***');

// ---------- Fuentes de precios ----------
let llamadasEOD = 0; const MAX_EOD = 18; // el plan gratuito permite 20 al día
async function eodSerie(ticker, desde) {
  if (!KEY_EOD || llamadasEOD >= MAX_EOD) return null;
  llamadasEOD++;
  const d = await getJSON(`https://eodhd.com/api/eod/${encodeURIComponent(ticker)}?from=${desde}&api_token=${KEY_EOD}&fmt=json`).catch(() => null);
  return Array.isArray(d) && d.length ? d.filter(x => x.close > 0).map(x => ({ fecha: x.date, precio: Number(x.close) })) : null;
}
async function eodBuscar(isin) {
  if (!KEY_EOD || llamadasEOD >= MAX_EOD) return [];
  llamadasEOD++;
  const d = await getJSON(`https://eodhd.com/api/search/${isin}?api_token=${KEY_EOD}&fmt=json`).catch(() => []);
  const pref = ['EUFUND', 'XETRA', 'AS', 'PA', 'MI', 'MC', 'F', 'LSE'];
  return (Array.isArray(d) ? d : []).sort((a, b) => (a.Currency === 'EUR' ? 0 : 1) - (b.Currency === 'EUR' ? 0 : 1) || (pref.indexOf(a.Exchange) + 99) % 99 - (pref.indexOf(b.Exchange) + 99) % 99)
    .map(x => ({ ticker: `${x.Code}.${x.Exchange}`, moneda: x.Currency || null }));
}
const UA = { 'User-Agent': 'Mozilla/5.0 (patrimonio-familiar; precios diarios)' };
async function yahooBuscar(isin) {
  const d = await getJSON(`https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=5&newsCount=0`, UA).catch(() => null);
  return ((d && d.quotes) || []).map(q => q.symbol).filter(Boolean);
}
async function yahooSerie(sym, desde) {
  const p1 = Math.floor(Date.parse(desde) / 1000), p2 = Math.floor(Date.now() / 1000) + 86400;
  const d = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1d`, UA).catch(() => null);
  const r = d && d.chart && d.chart.result && d.chart.result[0]; if (!r || !r.timestamp) return null;
  const cl = (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [];
  const out = r.timestamp.map((t, i) => ({ fecha: new Date(t * 1000).toISOString().slice(0, 10), precio: Number(cl[i]) })).filter(x => x.precio > 0);
  return out.length ? { serie: out, moneda: (r.meta && r.meta.currency) || null } : null;
}

// ---------- Proceso ----------
const posiciones = await sb('posiciones?select=isin,nombre&isin=not.is.null');
const isins = [...new Set(posiciones.map(p => String(p.isin || '').toUpperCase().replace(/\s/g, '')).filter(x => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(x)))];
console.log(`ISIN a actualizar: ${isins.length ? isins.join(', ') : 'ninguno'}`);
const ajTick = await sb('ajustes?select=valor&clave=eq.tickers_isin');
const tickers = (ajTick[0] && ajTick[0].valor) || {};
const resultados = [];

for (const isin of isins) {
  const nombre = (posiciones.find(p => String(p.isin).toUpperCase() === isin) || {}).nombre || '';
  try {
    const ult = await sb(`precios?select=fecha&isin=eq.${isin}&order=fecha.desc&limit=1`);
    const desde = ult.length ? restarDias(ult[0].fecha, 7) : restarDias(hoy, 365);
    const T = tickers[isin] || {};
    let serie = null, fuente = null, ticker = null, moneda = null;
    // 1) EODHD: ticker guardado, o ISIN.EUFUND (fondos europeos), o el que devuelva su buscador
    if (KEY_EOD) {
      const cands = T.eodhd ? [T.eodhd] : [`${isin}.EUFUND`];
      for (const t of cands) { serie = await eodSerie(t, desde); if (serie) { ticker = t; break; } }
      if (!serie && !T.eodhd) for (const c of (await eodBuscar(isin)).slice(0, 2)) { serie = await eodSerie(c.ticker, desde); if (serie) { ticker = c.ticker; moneda = c.moneda; break; } }
      if (serie) { fuente = 'EODHD'; T.eodhd = ticker; }
    }
    // 2) Yahoo Finance (sin clave)
    if (!serie) {
      const syms = T.yahoo ? [T.yahoo] : (await yahooBuscar(isin)).slice(0, 3);
      for (const s of syms) { const y = await yahooSerie(s, desde); if (y) { serie = y.serie; moneda = y.moneda; ticker = s; fuente = 'Yahoo Finance'; T.yahoo = s; break; } }
    }
    if (!serie) throw new Error('ninguna fuente tiene precios para este ISIN');
    tickers[isin] = T;
    const filas = serie.filter(x => x.fecha >= desde).map(x => ({ isin, fecha: x.fecha, precio: x.precio, moneda, fuente, ticker }));
    for (let i = 0; i < filas.length; i += 500)
      await sb('precios?on_conflict=isin,fecha', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(filas.slice(i, i + 500)) });
    const u = serie[serie.length - 1];
    resultados.push({ isin, nombre, ok: true, fuente, ticker, moneda, fecha: u.fecha, precio: u.precio, nuevos: filas.length });
    console.log(`✅ ${isin} ${nombre} · ${fuente} (${ticker}) · ${u.fecha}: ${u.precio}${moneda && moneda !== 'EUR' ? ' ' + moneda + ' ⚠ no es EUR' : ''} · ${filas.length} días guardados`);
  } catch (e) {
    resultados.push({ isin, nombre, ok: false, error: ocultar(e.message) });
    console.log(`❌ ${isin} ${nombre} · ${ocultar(e.message)}`);
  }
}

const upAjuste = (clave, valor) => sb('ajustes?on_conflict=clave', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ clave, valor, updated_at: new Date().toISOString() }]) });
await upAjuste('tickers_isin', tickers);
await upAjuste('precios_estado', { ejecutado: new Date().toISOString(), eodhd: !!KEY_EOD, llamadas_eodhd: llamadasEOD, resultados });
console.log(`Hecho. Llamadas a EODHD: ${llamadasEOD}.`);
if (isins.length && resultados.every(r => !r.ok)) process.exit(1);
