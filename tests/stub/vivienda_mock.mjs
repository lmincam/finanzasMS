// Simula Supabase y la API del INE para probar scripts/vivienda.mjs sin conexión (lo usa tests/test_precios.py).
const db = { ajustes: [] };
const serie = (nombre, datos) => ({ Nombre: nombre, Data: datos.map(([anyo, t, v]) => ({ Anyo: anyo, FK_Periodo: 18 + t, Fecha: Date.UTC(anyo, (t - 1) * 3, 1), Valor: v })) });
// 25171 (base 2015): solo índices → el script calcula la variación trimestral
const t25171 = [
  serie('Nacional. General. Índice.', [[2025, 1, 180], [2025, 2, 185], [2025, 3, 190], [2025, 4, 195]]),
  serie('13 Madrid, Comunidad de. Vivienda segunda mano. Índice.', [[2025, 1, 200], [2025, 2, 210], [2025, 3, 214.2], [2025, 4, 220.626]]),
  serie('13 Madrid, Comunidad de. Vivienda nueva. Índice.', [[2025, 1, 100], [2025, 2, 300]])
];
// 76201 (base 2025): variaciones trimestrales de 2026
const t76201 = [
  serie('Nacional. General. Variación trimestral.', [[2026, 1, 3.5], [2026, 2, 2.0]]),
  serie('13 Madrid, Comunidad de. Vivienda segunda mano. Variación trimestral.', [[2026, 1, 4.0], [2026, 2, 1.0]]),
  serie('13 Madrid, Comunidad de. Vivienda segunda mano. Variación anual.', [[2026, 1, 13.0]])
];
// Ministerio de Vivienda: CSV "largo" con ; y coma decimal, vivienda libre/protegida y antigüedad
const csv = ['Provincia;Régimen;Antigüedad;Periodo;Valor (€/m2)',
  ...[['Granada', ['2025T4', '1.500,00'], ['2026T1', '1.530,00'], ['2026T2', '1.560,60']], ['Castilla y León', ['2026T1', '9.999,00'], ['2026T2', '1,00']], ['León', ['2026T1', '1.000,00'], ['2026T2', '1.010,00']], ['Coruña (A)', ['2026T1', '1.200,00'], ['2026T2', '1.212,00']]]
    .flatMap(([p, ...qs]) => qs.flatMap(([q, v]) => [`${p};Libre;Total;${q};${v}`, `${p};Protegida;Total;${q};800,00`, `${p};Libre;Hasta 5 años;${q};5.000,00`]))].join('\r\n');
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const ok = b => ({ ok: true, status: 200, text: async () => JSON.stringify(b), json: async () => b });
  if (u.host === 'x.supabase.co') {
    if (opts.method === 'POST') { for (const r of JSON.parse(opts.body)) { db.ajustes = db.ajustes.filter(x => x.clave !== r.clave); db.ajustes.push(r); } return { ok: true, status: 201, text: async () => '' }; }
    return ok(db.ajustes.filter(a => a.clave === u.searchParams.get('clave').slice(3)));
  }
  if (u.host === 'cdn.mivau.gob.es') { const b = new TextEncoder().encode(csv); return { ok: true, status: 200, arrayBuffer: async () => b.buffer }; }
  if (u.host === 'servicios.ine.es') return ok(u.pathname.endsWith('/25171') ? t25171 : t76201);
  return { ok: false, status: 404, text: async () => 'nf', json: async () => ({}) };
};
process.on('exit', () => { const a = db.ajustes.find(x => x.clave === 'indice_vivienda'); console.log('IPV:', JSON.stringify(a ? a.valor : null)); });
