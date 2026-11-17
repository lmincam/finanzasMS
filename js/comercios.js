'use strict';
/* =====================================================================
   ICONOS DE COMERCIOS Y CATEGORÍAS (lista de movimientos)
   ---------------------------------------------------------------------
   Cada movimiento lleva delante un icono:
     1. el que hayas elegido tú para ese comercio (⋯ → "Icono del comercio");
        se aplica a todos sus movimientos y se guarda en ajustes.iconos_comercio
     2. el de un comercio conocido (Mercadona → carrito, Netflix → "N"…)
     3. el de su categoría (Restaurantes → cubiertos, Gasolina → surtidor…);
        si el movimiento no tiene categoría, la de otros movimientos del mismo comercio
     4. uno genérico según el tipo (transferencia, Bizum, ingreso, gasto)
   Para los comercios con web conocida se muestra el icono que publica la propia web (favicon),
   descargado al vuelo; si no carga (sin conexión…), queda la inicial o el icono genérico.
   Depende de: iconos.js, utilidades.js
   ===================================================================== */

Object.assign(ICONOS, {
  cart: '<path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  fork: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
  cup: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 8h6"/><path d="M14 10h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .2 2 1 3 2 3.5C11 9 11 6 12 3z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19.5" r="1"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M19 19v2H6"/>',
  pill: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 9.2 4.2C19.5 15.4 12 20 12 20z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  shirt: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4.5 9.5 8 12 8zM12 8s1.5-5 4-3.5S14.5 8 12 8z"/>',
  plane: '<path d="M10.5 13.5 3 11l1.5-1.5 8 .5 4-4.5a2 2 0 0 1 3 3L15 12.5l.5 8L14 22l-2.5-7.5L8 18v2l-1.5 1.5-1-3.5-3.5-1L3.5 15.5h2z"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".8"/><circle cx="15" cy="14" r=".8"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7 21v-3M17 21v-3"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
  paw: '<circle cx="5.5" cy="10" r="1.8"/><circle cx="9.5" cy="5.5" r="1.8"/><circle cx="14.5" cy="5.5" r="1.8"/><circle cx="18.5" cy="10" r="1.8"/><path d="M12 11c-3 0-5.5 4.5-5 7 .4 2 3 1.5 5 1.5s4.6.5 5-1.5c.5-2.5-2-7-5-7z"/>',
  baby: '<circle cx="12" cy="8" r="4.5"/><path d="M5 21a7 7 0 0 1 14 0M10.3 8h.01M13.7 8h.01M10.5 10.2c.8.6 2.2.6 3 0"/>',
  tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 1-5-5z" transform="translate(-1 -1)"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 18M8 16.5 20 6"/>',
  school: '<path d="M2 9 12 4l10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
  beer: '<path d="M6 7h10v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7a3 3 0 0 1 5-2.5A3 3 0 0 1 16 7"/>',
  doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>'
});

/* Comercios conocidos: [expresión, letras o icono, color de fondo, web]. Se comprueban en orden. */
const COMERCIOS = [
  // Supermercados
  [/mercadona/, '@cart', '#0f8a3a', 'mercadona.es'], [/carrefour/, '@cart', '#1e5bc6', 'carrefour.es'], [/\blidl\b/, '@cart', '#0050aa', 'lidl.es'], [/\baldi\b/, '@cart', '#00205b', 'aldi.es'],
  [/supermercados? dia\b|dia retail|\bdia %/, '@cart', '#e30613', 'dia.es'], [/eroski/, '@cart', '#d4001a', 'eroski.es'], [/alcampo|auchan/, '@cart', '#e2001a', 'alcampo.es'], [/\bconsum\b/, '@cart', '#f18a00', 'consum.es'],
  [/coviran|covirán/, '@cart', '#2f8f3b', 'coviran.es'], [/hipercor/, '@cart', '#1c7a3d', 'hipercor.es'], [/supersol|ahorramas|bm supermercados|gadis|froiz|masymas|\bspar\b|el arbol|mas supermercados/, '@cart', '#2f7d32'],
  [/el corte ingles|elcorteingles/, 'ECI', '#1c7a3d', 'elcorteingles.es'],
  // Plataformas y suscripciones
  [/netflix/, 'N', '#111111', 'netflix.com'], [/spotify/, '@music', '#1db954', 'spotify.com'], [/hbo|\bmax\.com|hbomax/, 'max', '#2f2fbd', 'max.com'], [/disney/, 'D+', '#0e3a7a', 'disneyplus.com'],
  [/prime video|primevideo|amazon prime/, 'P', '#0f79af', 'primevideo.com'], [/youtube/, '@play', '#e62117', 'youtube.com'], [/dazn/, 'DZ', '#111111', 'dazn.com'], [/apple\.com|itunes|apple\b/, 'A', '#555555', 'apple.com'],
  [/google|google play/, 'G', '#4285f4', 'google.com'], [/microsoft|xbox/, 'MS', '#107c10', 'microsoft.com'], [/playstation|sony interactive/, 'PS', '#003791', 'playstation.com'], [/filmin/, 'F', '#d6001c', 'filmin.es'],
  [/audible/, '@book', '#f39200', 'audible.es'], [/kindle/, '@book', '#232f3e', 'amazon.es'], [/chatgpt|openai/, 'AI', '#10a37f', 'openai.com'], [/claude\.ai|anthropic/, 'AI', '#c96442', 'claude.ai'],
  // Telefonía e internet
  [/movistar|telefonica/, 'M', '#019df4', 'movistar.es'], [/vodafone/, 'V', '#e60000', 'vodafone.es'], [/\borange\b/, 'O', '#ff7900', 'orange.es'], [/masmovil|más ?movil/, 'm', '#ffd200', 'masmovil.es'],
  [/\bdigi\b/, 'DG', '#1f5ca8', 'digimobil.es'], [/yoigo/, 'Y', '#7f2b8f', 'yoigo.com'], [/pepephone/, 'PP', '#e5004b', 'pepephone.com'], [/\blowi\b/, 'L', '#3cb371', 'lowi.es'], [/jazztel/, 'J', '#ffb400', 'jazztel.com'], [/simyo/, 'S', '#ff6b00', 'simyo.es'], [/\bo2 (fibra|movil)/, 'O2', '#0019a5'],
  // Energía y agua
  [/iberdrola|curenergia/, '@bolt', '#00a443', 'iberdrola.es'], [/endesa/, '@bolt', '#0072ce', 'endesa.com'], [/naturgy|gas natural/, '@flame', '#004571', 'naturgy.es'], [/totalenergies|holaluz|octopus|repsol luz/, '@bolt', '#e95f00', 'totalenergies.es'],
  [/emasagra|aguas de|canal de isabel|aqualia|emasesa|hidralia/, '@drop', '#0b82c4', 'emasagra.es'],
  // Gasolineras
  [/repsol/, '@fuel', '#ff8200'], [/cepsa|moeve/, '@fuel', '#d8262e', 'moeve.es'], [/\bbp\b|bp oil/, '@fuel', '#009900', 'bp.com'], [/shell/, '@fuel', '#e30613', 'shell.es'], [/galp/, '@fuel', '#ff6600', 'galp.com'],
  [/ballenoil|plenoil|petroprix|petronor|\bavia\b|carrefour gas|gasolinera|estacion de servicio|e\.s\./, '@fuel', '#475569', 'ballenoil.es'],
  // Tiendas
  [/amazon|amzn/, 'a', '#232f3e', 'amazon.es'], [/aliexpress/, 'AE', '#e62e04', 'aliexpress.com'], [/\bzara\b/, 'Z', '#111111', 'zara.com'], [/primark/, 'P', '#0095d9', 'primark.com'], [/decathlon/, 'D', '#0082c3', 'decathlon.es'],
  [/ikea/, 'IK', '#0058a3', 'ikea.com'], [/leroy merlin/, '@tool', '#78be20', 'leroymerlin.es'], [/bricomart|bricodepot|brico/, '@tool', '#f39200', 'bricomart.es'], [/media ?markt/, 'MM', '#df0000', 'mediamarkt.es'],
  [/\bmango\b/, 'M', '#111111', 'mango.com'], [/lefties/, 'L', '#e4002b', 'lefties.com'], [/pull ?& ?bear|bershka|stradivarius|massimo dutti|h&m|hm\b/, '@shirt', '#333333'], [/\baction\b/, 'A', '#003f8c', 'action.com'],
  [/fnac/, 'F', '#e1a925', 'fnac.es'], [/pccomponentes/, 'PC', '#ff6000', 'pccomponentes.com'], [/tiendanimal|kiwoko/, '@paw', '#e7542a', 'tiendanimal.es'], [/druni|primor|sephora|douglas/, '@bag', '#8e2a76', 'druni.es'],
  // Comer fuera y reparto
  [/mcdonald/, 'M', '#da291c', 'mcdonalds.es'], [/burger king/, 'BK', '#d62300', 'burgerking.es'], [/telepizza/, '@fork', '#e30613', 'telepizza.es'], [/domino/, 'D', '#006491', 'dominospizza.es'], [/starbucks/, '@cup', '#00704a', 'starbucks.es'],
  [/glovo/, 'G', '#ffc244', 'glovoapp.com'], [/just ?eat/, 'JE', '#ff8000', 'just-eat.es'], [/uber ?eats/, 'UE', '#06c167', 'ubereats.com'], [/kfc/, 'KFC', '#a3080c', 'kfc.es'], [/100 montaditos|tgb|goiko|vips|foster/, '@fork', '#8a4b2a'],
  // Transporte y viajes
  [/\buber\b(?! ?eats)/, 'U', '#000000', 'uber.com'], [/cabify/, 'C', '#7145d6', 'cabify.com'], [/renfe/, '@train', '#702082', 'renfe.com'], [/\balsa\b/, '@bus', '#1d4e9e', 'alsa.es'], [/ryanair/, '@plane', '#073590', 'ryanair.com'],
  [/vueling/, '@plane', '#ffcc00', 'vueling.com'], [/iberia/, '@plane', '#d7192d', 'iberia.com'], [/booking/, 'B', '#003580', 'booking.com'], [/airbnb/, 'A', '#ff5a5f', 'airbnb.es'], [/blablacar/, 'BB', '#00aff5', 'blablacar.es'],
  [/parking|aparcamiento|empark|\bsaba\b|\bora\b|telpark/, '@parking', '#1e5bc6'], [/autopista|peaje|via-t|viat/, '@car', '#555555'], [/\bitv\b/, '@doc', '#475569'],
  // Salud, deporte, seguros
  [/farmacia|parafarmacia/, '@pill', '#00a650'], [/altafit|basic-?fit|mcfit|holmes place|vivagym|anytime fitness|gimnasio|\bgym\b|dreamfit|go fit/, '@dumbbell', '#e4572e'],
  [/sanitas|adeslas|dkv|asisa|mapfre salud/, '@heart', '#0072bc', 'sanitas.es'], [/mapfre|mutua|linea directa|allianz|axa\b|generali|reale|zurich|pelayo|santalucia|ocaso/, '@shield', '#c4161c'],
  [/clinica|dentist|optica|hospital|fisioterap/, '@heart', '#0ea5e9'],
  // Dinero, administraciones
  [/bizum/, '@swap', '#0f766e', 'bizum.es'], [/hacienda|aeat|agencia tributaria/, '@doc', '#7a1f1f', 'agenciatributaria.gob.es'], [/\bdgt\b|trafico/, '@doc', '#334155', 'dgt.es'], [/ayuntamiento|\bibi\b|seguridad social|tgss/, '@doc', '#334155'],
  [/nomina|nómina/, '@coin', '#15803d'], [/cajero|reintegro|atm\b/, '@coin', '#64748b'],
  [/peluquer|barber/, '@scissors', '#a855f7'], [/colegio|guarderia|academia|universidad|escuela/, '@school', '#2563eb'], [/veterinari/, '@paw', '#e7542a']
];

/* Categoría → icono genérico (por palabras del nombre de la categoría o de su madre). */
const CAT_ICONOS = [
  [/supermerc|aliment|compra/, 'cart'], [/restaur|comer fuera|comida|bar|tapas/, 'fork'], [/cafe|cafeter/, 'cup'], [/copas|ocio noct/, 'beer'],
  [/gasolin|combust|carburante/, 'fuel'], [/parking|aparca/, 'parking'], [/transport|tren|autobus|metro|taxi/, 'bus'], [/coche|vehicul|taller|moto|itv/, 'car'],
  [/luz|electric/, 'bolt'], [/agua/, 'drop'], [/\bgas\b|butano/, 'flame'], [/internet|telef|movil|fibra/, 'wifi'], [/hipoteca|prestamo|banco|comision/, 'bank'],
  [/vivienda|hogar|casa|alquiler|comunidad|ibi/, 'home'], [/suscrip|streaming|plataforma/, 'play'], [/musica/, 'music'], [/cine|teatro|ocio|entradas|concierto/, 'ticket'],
  [/salud|medic|dentist|clinica/, 'heart'], [/farmac/, 'pill'], [/deporte|gimnasio|gym/, 'dumbbell'], [/ropa|calzado|moda/, 'shirt'], [/belleza|cosmet|perfum/, 'bag'],
  [/peluquer/, 'scissors'], [/regalo/, 'gift'], [/viaje|vacacion|hotel|vuelo/, 'plane'], [/mascota|veterin/, 'paw'], [/niñ|nin[oa]s|hijo|bebe|guarder/, 'baby'],
  [/educa|colegio|formacion|curso|libro/, 'school'], [/seguro/, 'shield'], [/impuesto|tasa|hacienda|multa/, 'doc'], [/bricolaje|reforma|ferreter|mantenim/, 'tool'],
  [/electron|tecnolog|informat/, 'tv'], [/tienda|compras|amazon/, 'bag'], [/nomina|sueldo|salario/, 'coin'], [/ahorro|inversion/, 'trend']
];

/* ---------- Clave del comercio a partir del concepto del banco ---------- */
const RUIDO_CONCEPTO = /\b(compra|compras|tarj(eta)?|tj|pago|pagos|en|con|movil|móvil|recibo|adeudo|domiciliacion|domiciliación|cargo|transf(erencia)?|inmediata|a favor de|de|del|la|el|los|las|sl|s\.l\.|sa|s\.a\.|sociedad|es|esp|espana|españa|ref|www|com|nº|num)\b/g;
function claveComercio(concepto) {
  const t = normText(concepto || '').replace(/\b[\dx*]*\d[\dx*]*x[\dx*]*\b|\bx{3,}\b|\d{4,}|\*+|\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?/g, ' ').replace(/[^a-z0-9ñ ]/g, ' ').replace(RUIDO_CONCEPTO, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w)).slice(0, 2).join(' ') || null;
}
const iconosComercio = () => { const r = (S.ajustesRows || []).find(x => x.clave === 'iconos_comercio'); return (r && r.valor) || {}; };
const comercioConocido = txt => { const n = normText(txt || ''); return COMERCIOS.find(c => c[0].test(n)) || null; };
function iconoCategoria(catId) {
  const c = catById(catId); if (!c) return null;
  for (const x of [c, c.parent_id ? catById(c.parent_id) : null].filter(Boolean)) { const n = normText(x.nombre); const hit = CAT_ICONOS.find(([re]) => re.test(n)); if (hit) return hit[1]; }
  return null;
}
/** Categoría que sueles poner a este comercio (para los movimientos sin categoría). */
let _catComercio = null, _catComercioN = -1;
function categoriaHabitual(clave) {
  if (!clave) return null;
  if (_catComercioN !== S.movimientos.length) {
    _catComercio = new Map(); _catComercioN = S.movimientos.length;
    for (const m of S.movimientos) { if (!m.categoria_id) continue; const k = claveComercio(m.concepto); if (k && !_catComercio.has(k)) _catComercio.set(k, m.categoria_id); }
  }
  return _catComercio.get(clave) || null;
}
const pastilla = (contenido, color, cls = '', web = null) => `<span class="mv-ico ${cls}${web ? ' con-logo' : ''}" style="--ic:${esc(color)}">${contenido}${web ? `<img src="${urlLogo(web)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('con-logo');this.remove()">` : ''}</span>`;
/** Icono que publica la web del comercio (servicio de favicons de Google, 64 px). */
const urlLogo = web => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(String(web).replace(/^https?:\/\//, '').replace(/\/.*$/, ''))}`;
/** Web que aparece escrita en el propio concepto (p. ej. "NETFLIX.COM", "WWW.PCCOMPONENTES.COM"). */
const webEnConcepto = txt => { const m = normText(txt || '').match(/\b([a-z0-9-]{3,}\.(?:com|es|net|org|eu|io|tv|app))\b/); return m ? m[1] : null; };
const letras = t => `<b>${esc(t)}</b>`;
/** Icono (HTML) de un movimiento. */
function iconoMovimiento(m) {
  const isT = m.tipo === 'transferencia', imp = num(m.importe);
  const k = claveComercio(m.concepto), propio = k && iconosComercio()[k];
  if (propio) return propio.l ? pastilla(letras(propio.l), propio.c || '#475569', '', propio.w) : pastilla(icono(propio.i || 'tag'), propio.c || '#475569', '', propio.w);
  const cc = comercioConocido(`${m.concepto || ''} ${m.notas || ''}`), web = (cc && cc[3]) || webEnConcepto(m.concepto);
  if (cc) return cc[1].startsWith('@') ? pastilla(icono(cc[1].slice(1)), cc[2], '', web) : pastilla(letras(cc[1] || '•'), cc[2], '', web);
  if (web) return pastilla(letras(web[0].toUpperCase()), '#475569', '', web);
  if (isT) return pastilla(icono('swap'), '#64748b', 'suave');
  const cat = m.categoria_id || categoriaHabitual(k), c = catById(cat), r = c ? rootOf(c) : null;
  const color = (c && c.color) || (r && r.color) || (imp >= 0 ? '#16a34a' : '#94a3b8');
  const ic = iconoCategoria(cat) || (imp >= 0 ? 'coin' : 'tag');
  return pastilla(icono(ic), color, 'suave');
}

/* ---------- Elegir el icono de un comercio ---------- */
const ICONOS_ELEGIBLES = ['cart', 'fork', 'cup', 'beer', 'fuel', 'car', 'parking', 'bus', 'train', 'plane', 'home', 'bolt', 'drop', 'flame', 'wifi', 'phone', 'play', 'music', 'tv', 'ticket',
  'bag', 'shirt', 'gift', 'heart', 'pill', 'dumbbell', 'scissors', 'paw', 'baby', 'school', 'book', 'tool', 'shield', 'doc', 'bank', 'coin', 'card', 'swap', 'tag'];
const COLORES_ICONO = ['#0f8a3a', '#16a34a', '#0ea5e9', '#1e5bc6', '#7c3aed', '#c026d3', '#e11d48', '#dc2626', '#ea580c', '#f59e0b', '#475569', '#111111'];
function elegirIconoComercio(m) {
  const k = claveComercio(m.concepto); if (!k) { toast('No reconozco el comercio de este movimiento', 'warn'); return; }
  const actual = iconosComercio()[k] || {}; let sel = { i: actual.i || null, l: actual.l || '', c: actual.c || '#475569', w: actual.w || '' };
  const md = modal(`<h3>Icono de "${esc(k)}"</h3><p class="small muted" style="margin-top:0">Se usará en todos los movimientos de este comercio.</p>
    <div class="ico-prev" id="ico-prev"></div>
    <div class="ico-grid">${ICONOS_ELEGIBLES.map(n => `<button type="button" class="ico-op" data-i="${n}" title="${n}">${icono(n)}</button>`).join('')}</div>
    <div class="form-grid" style="margin-top:12px"><div class="full"><label>Web del comercio (para usar su logo)</label><input id="ico-web" value="${esc(sel.w)}" placeholder="Ej. barpepe.es"></div><div><label>O unas letras (máx. 3)</label><input id="ico-letras" maxlength="3" value="${esc(sel.l)}" placeholder="Ej. N"></div>
      <div><label>Color</label><div class="ico-cols">${COLORES_ICONO.map(c => `<button type="button" class="ico-col" data-c="${c}" style="background:${c}"></button>`).join('')}</div></div></div>
    <div class="actions" style="margin-top:14px">${actual.i || actual.l ? '<button class="btn ghost" data-quitar>Quitar el mío</button>' : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-guardar>Guardar</button></div>`);
  const prev = () => { md.el.querySelector('#ico-prev').innerHTML = (sel.l ? pastilla(letras(sel.l), sel.c, '', sel.w) : sel.i || sel.w ? pastilla(icono(sel.i || 'tag'), sel.c, '', sel.w) : iconoMovimiento(m)) + `<span>${esc(m.concepto || '')}</span>`;
    md.el.querySelectorAll('.ico-op').forEach(b => b.classList.toggle('on', !sel.l && b.dataset.i === sel.i)); md.el.querySelectorAll('.ico-col').forEach(b => b.classList.toggle('on', b.dataset.c === sel.c)); };
  md.el.addEventListener('click', async e => {
    const op = e.target.closest('.ico-op'), col = e.target.closest('.ico-col');
    if (op) { sel.i = op.dataset.i; sel.l = ''; md.el.querySelector('#ico-letras').value = ''; prev(); }
    if (col) { sel.c = col.dataset.c; prev(); }
    if (e.target.closest('[data-close]')) md.close();
    if (e.target.closest('[data-guardar]') || e.target.closest('[data-quitar]')) {
      const mapa = { ...iconosComercio() };
      if (e.target.closest('[data-quitar]')) delete mapa[k]; else { if (!sel.i && !sel.l && !sel.w) { toast('Elige un icono, escribe unas letras o la web', 'warn'); return; } mapa[k] = { ...(sel.l ? { l: sel.l } : { i: sel.i || 'tag' }), c: sel.c, ...(sel.w ? { w: sel.w } : {}) }; }
      const r = await withSaving(null, async () => {
        await DB.upsert('ajustes', { clave: 'iconos_comercio', valor: mapa, updated_at: new Date().toISOString() }, 'clave');
        const row = (S.ajustesRows = S.ajustesRows || []).find(x => x.clave === 'iconos_comercio'); if (row) row.valor = mapa; else S.ajustesRows.push({ clave: 'iconos_comercio', valor: mapa });
      }, 'Icono guardado');
      if (r !== FAIL) { md.close(); render(); }
    }
  });
  md.el.querySelector('#ico-letras').addEventListener('input', e => { sel.l = e.target.value.trim().slice(0, 3); prev(); });
  md.el.querySelector('#ico-web').addEventListener('change', e => { sel.w = e.target.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); prev(); });
  prev();
}
Object.assign(Actions, { 'mov-icono': el => { const m = S.movimientos.find(x => x.id === el.dataset.id); if (m) elegirIconoComercio(m); } });
