// Resume con IA las notas de la pestaña Planificar › Notas y guarda el resumen en Supabase.
// Solo resume las notas nuevas o cambiadas (compara la huella del texto con resumen_de).
// Secretos de GitHub: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los mismos que los precios) y ANTHROPIC_API_KEY.
const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY_SB = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KEY_AI = process.env.ANTHROPIC_API_KEY || '';
const MODELO = process.env.MODELO_NOTAS || 'claude-haiku-5-5';

// Sin claves no es un error: se avisa y se termina bien (así GitHub no manda correos de fallo)
if (!URL_SB || !KEY_SB) { console.log('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en los secretos de GitHub. Nada que hacer.'); process.exit(0); }
if (!KEY_AI) { console.log('Falta ANTHROPIC_API_KEY en los secretos de GitHub: las notas se quedan sin resumen. Nada que hacer.'); process.exit(0); }

const H = { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}`, 'Content-Type': 'application/json' };
export function huellaNota(t) { let h = 5381; const s = String(t || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

async function sb(path, opts = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (r.status === 404) { console.log('La tabla "notas" aún no existe (ejecuta el bloque 16 del SQL). Nada que hacer.'); process.exit(0); }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function resumir(n) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY_AI, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO, max_tokens: 200,
      system: 'Resumes notas personales de una familia para una app de finanzas. Responde SOLO con el resumen: en español, una o dos frases (máximo 35 palabras), sin comillas, sin introducciones, conservando importes, fechas y decisiones.',
      messages: [{ role: 'user', content: `${n.titulo ? `Título: ${n.titulo}\n` : ''}Nota:\n${String(n.texto).slice(0, 12000)}` }]
    })
  });
  if (!r.ok) throw new Error(`IA ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ').trim().replace(/^["«]|["»]$/g, '');
}

const notas = await sb('notas?select=id,titulo,texto,resumen_de&order=created_at.desc&limit=500');
const pendientes = notas.filter(n => n.texto && n.resumen_de !== huellaNota(n.texto));
console.log(`${notas.length} notas · ${pendientes.length} por resumir`);
let fallos = 0;
for (const n of pendientes) {
  try {
    const resumen = await resumir(n);
    if (!resumen) continue;
    await sb(`notas?id=eq.${n.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resumen, resumen_de: huellaNota(n.texto) }) });
    console.log(`✓ ${n.id}: ${resumen}`);
  } catch (e) { fallos++; console.log(`✗ ${n.id}: ${e.message}`); }
}
// Un fallo puntual de la IA no debe mandar correos: se reintenta en la siguiente pasada
if (fallos) console.log(`${fallos} notas no se pudieron resumir; se reintentará en la próxima ejecución.`);
