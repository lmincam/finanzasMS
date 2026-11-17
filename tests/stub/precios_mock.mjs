// Simula Supabase, EODHD y Yahoo para probar scripts/precios.mjs sin conexión (lo usa tests/test_precios.py).
const db = { posiciones: [{ isin: 'ES0165237001', nombre: 'Fondo A' }, { isin: 'IE00B4L5Y983', nombre: 'ETF B' }, { isin: 'LU0000000000', nombre: 'Malo' }], precios: [], ajustes: [] };
globalThis.__db = db;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const ok = b => ({ ok: true, status: 200, text: async () => JSON.stringify(b), json: async () => b });
  if (u.host === 'x.supabase.co') {
    const t = u.pathname.split('/').pop();
    if (opts.method === 'POST') { const rows = JSON.parse(opts.body); if (t === 'precios') for (const r of rows) { const i = db.precios.findIndex(x => x.isin === r.isin && x.fecha === r.fecha); if (i >= 0) db.precios[i] = r; else db.precios.push(r); } else for (const r of rows) { db.ajustes = db.ajustes.filter(x => x.clave !== r.clave); db.ajustes.push(r); } return { ok: true, status: 201, text: async () => '' }; }
    if (t === 'posiciones') return ok(db.posiciones);
    if (t === 'precios') { const isin = u.searchParams.get('isin').slice(3); return ok(db.precios.filter(p => p.isin === isin).sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 1)); }
    if (t === 'ajustes') { const c = u.searchParams.get('clave').slice(3); return ok(db.ajustes.filter(a => a.clave === c)); }
  }
  if (u.host === 'eodhd.com') {
    if (u.pathname.includes('/eod/ES0165237001.EUFUND')) return ok([{ date: '2026-11-13', close: 10.5 }, { date: '2026-11-16', close: 10.62 }]);
    if (u.pathname.includes('/eod/')) return ok([]);
    if (u.pathname.includes('/search/IE00B4L5Y983')) return ok([{ Code: 'IWDA', Exchange: 'LSE', Currency: 'USD' }, { Code: 'EUNL', Exchange: 'XETRA', Currency: 'EUR' }]);
    if (u.pathname.includes('/search/')) return ok([]);
  }
  if (u.host.endsWith('yahoo.com')) {
    if (u.pathname.includes('search')) return ok({ quotes: u.searchParams.get('q') === 'IE00B4L5Y983' ? [{ symbol: 'EUNL.DE' }] : [] });
    return ok({ chart: { result: [{ timestamp: [1763251200, 1763337600], indicators: { quote: [{ close: [101.2, 102.3] }] }, meta: { currency: 'EUR' } }] } });
  }
  return { ok: false, status: 404, text: async () => 'nf', json: async () => ({}) };
};
process.on('exit', () => console.log('DB precios:', JSON.stringify(db.precios), '\nestado:', JSON.stringify(db.ajustes.find(a => a.clave === 'precios_estado').valor.resultados.map(r => [r.isin, r.ok, r.fuente || r.error]))));
