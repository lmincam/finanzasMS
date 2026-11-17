'use strict';
/* =====================================================================
   ICONOS SVG
   ---------------------------------------------------------------------
   Iconos de línea propios (24×24, color del texto) para que la app se vea
   igual en todos los dispositivos. icono('home') devuelve el <svg>.
   iconizar(root) cambia, tras cada pintado, los emojis de títulos, avisos
   y botones por su icono equivalente (y quita los que no tienen pareja).
   ===================================================================== */

const ICONOS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  arrows: '<path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2M6 6l9-3 1.5 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
  bars: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 2.9 7.6 7 9 4.1-1.4 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  car: '<path d="M3 13l2-6h14l2 6v4H3z"/><path d="M3 13h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  signal: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 13l2 2 4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/><path d="M5 17v4M19 17v4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  pin: '<path d="M12 16v5M8 3h8l-1 5 3 4H6l3-4z"/>',
  buoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  puzzle: '<path d="M4 8h3.5a2 2 0 1 1 4 0H15v3.5a2 2 0 1 1 0 4V20H4z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  skip: '<path d="M5 5l9 7-9 7zM19 5v14"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  power: '<path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5"/>',
  dots: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'
};
const icono = (n, cls = '') => ICONOS[n] ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n]}</svg>` : '';

/** Emoji → icono. Los emojis de títulos sin pareja se quitan; en avisos y botones se dejan. */
const EMOJI_ICONO = { '🔧': 'tool', '🛞': 'car', '🎨': 'edit',
  '📊': 'bars', '💳': 'card', '🎯': 'target', '🏠': 'home', '📈': 'chart', '🏦': 'bank', '🛡': 'shield', '🚀': 'trend', '📸': 'clock', '🏷': 'tag',
  '⚙': 'sliders', '💸': 'coin', '💰': 'coin', '🚗': 'car', '🚙': 'car', '🧩': 'pie', '🔁': 'repeat', '🧾': 'receipt', '📡': 'signal', '📅': 'calendar', '🗓': 'calendar',
  '📋': 'clipboard', '🔐': 'lock', '🔒': 'lock', '🕘': 'clock', '🔔': 'bell', '👤': 'user', '👥': 'users', '📥': 'download', '🔮': 'eye', '🤖': 'cpu', '☁': 'cloud',
  '🛟': 'buoy', '📌': 'pin', '🚨': 'alert', '⚠': 'alert', '✅': 'check', '⏭': 'skip', '📱': 'phone', '🏁': 'flag', '🔻': 'trend', '🐷': 'coin', '🧭': 'target',
  '🏆': 'flag', '🏢': 'home', '🏘': 'home', '⏳': 'hourglass', '🔌': 'power', '📆': 'calendar', '💡': 'info', '📉': 'chart', '🌙': 'moon'
};
const RE_EMOJI = /^\s*(\p{Extended_Pictographic})️?\s*/u;
const _claves = Object.keys(EMOJI_ICONO).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const RE_EMOJIS_TODOS = new RegExp(`(${_claves})\\uFE0F?`, 'u');
const RE_EMOJIS_G = new RegExp(`(${_claves})\\uFE0F?`, 'gu');
function iconizar(root = document) {
  // Títulos y avisos: el emoji inicial pasa a icono
  root.querySelectorAll('h2, h3, .alert .ic, .ic2-foot, .sub-title, .cz-head h3, .drawer-item .ico').forEach(el => {
    if (el.dataset.ico) return; el.dataset.ico = '1';
    const tn = [...el.childNodes].find(n => !(n.nodeType === 3 && !n.textContent.trim())); // primer hijo con contenido
    if (!tn || tn.nodeType !== 3) return;
    const m = tn.textContent.match(RE_EMOJI); if (!m) return;
    const nombre = EMOJI_ICONO[m[1]];
    tn.textContent = tn.textContent.slice(m[0].length);
    if (nombre) el.insertAdjacentHTML('afterbegin', icono(nombre, 'i-t'));
  });
  // Resto de textos: cualquier emoji con pareja pasa a icono pequeño en línea (no en desplegables ni campos)
  const w = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => RE_EMOJIS_TODOS.test(n.textContent) && n.parentElement && !n.parentElement.closest('select, option, textarea, input, script, style, svg, title, [data-noico]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  const nodos = []; while (w.nextNode()) nodos.push(w.currentNode);
  for (const tn of nodos) {
    const span = document.createElement('span');
    span.innerHTML = esc(tn.textContent).replace(RE_EMOJIS_G, (m, e) => icono(EMOJI_ICONO[e], 'i-s'));
    tn.replaceWith(...span.childNodes);
  }
  // Botones pequeños ✎ / 🗑 y el ⓘ de información
  root.querySelectorAll('.mini, .info-btn').forEach(b => {
    if (b.dataset.ico) return; const t = b.textContent.trim();
    const n = t === '✎' ? 'edit' : t === '🗑' ? 'trash' : t === 'ⓘ' ? 'info' : null;
    if (n) { b.innerHTML = icono(n); b.dataset.ico = '1'; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', n === 'edit' ? 'Editar' : n === 'trash' ? 'Eliminar' : 'Información'); }
  });
}

// Se aplica solo a todo lo que se pinte (pestañas, ventanas, listas que se cargan después)
(function () {
  let pend = false;
  const run = () => { pend = false; try { iconizar(document); } catch (e) { console.warn('iconizar', e); } };
  new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(run); } }).observe(document.documentElement, { childList: true, subtree: true });
})();
