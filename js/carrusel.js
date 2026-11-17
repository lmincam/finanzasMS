'use strict';
/* =====================================================================
   CARRUSEL INFINITO
   ---------------------------------------------------------------------
   carrusel(itemsHTML[], cls) devuelve el HTML; se activa solo al aparecer
   en pantalla (MutationObserver). Si las tarjetas caben, se quedan quietas;
   si no, avanzan despacio en bucle (la primera vuelve a entrar por la
   derecha), se pueden arrastrar con el dedo o el ratón y se paran al
   tocarlas o pasar el ratón por encima. Respeta "reducir movimiento".
   El orden se mantiene: empieza siempre por la primera tarjeta.
   ===================================================================== */

const carrusel = (items, cls = '') => items.length
  ? `<div class="crs ${cls}" data-crs><div class="crs-track">${items.map(h => `<div class="crs-it">${h}</div>`).join('')}</div></div>` : '';

const CRS_VEL = 0.35;                 // px por fotograma (unos 20 px/s)
const CRS_PAUSA = 3500;               // ms parado tras tocarlo
const crsReducido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function iniciarCarrusel(vp) {
  if (vp.dataset.on) return;
  if (!vp.clientWidth) {   // aún oculto (pestaña sin mostrar): se activa cuando tenga tamaño
    vp.dataset.on = 'espera';
    const ro = new ResizeObserver(() => { if (vp.clientWidth) { ro.disconnect(); delete vp.dataset.on; iniciarCarrusel(vp); } }); ro.observe(vp); return;
  }
  vp.dataset.on = '1';
  const tr = vp.querySelector('.crs-track'); if (!tr) return;
  const orig = [...tr.children]; if (!orig.length) return;
  const gap = parseFloat(getComputedStyle(tr).columnGap || getComputedStyle(tr).gap) || 0;
  const ancho = () => orig.reduce((s, el) => s + el.getBoundingClientRect().width + gap, 0);
  let set = ancho();
  if (set - gap <= vp.clientWidth + 1) { vp.classList.add('crs-quieto'); return; }   // caben: sin bucle
  // Dos copias más (antes y después) para que el bucle no tenga huecos; las copias no se leen en voz alta
  const clon = () => orig.map(el => { const c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); c.querySelectorAll('button,a,[tabindex]').forEach(n => n.setAttribute('tabindex', '-1')); return c; });
  clon().reverse().forEach(c => tr.prepend(c)); clon().forEach(c => tr.append(c));
  let x = -set, vel = 0, arrastrando = false, movido = false, sx = 0, x0 = 0, ultimaX = 0, pausaHasta = 0, encima = false;
  const envolver = () => { while (x <= -2 * set) x += set; while (x > -set) x -= set; };
  const OFF = 16;   // margen para que la primera tarjeta no nazca difuminada
  const pinta = () => { tr.style.transform = `translate3d(${(x + OFF).toFixed(1)}px,0,0)`; };
  const paso = () => {
    if (!vp.isConnected) return;   // la vista se ha vuelto a pintar: este carrusel ya no existe
    if (!arrastrando) {
      if (Math.abs(vel) > 0.05) { x += vel; vel *= 0.93; }
      else if (!encima && Date.now() > pausaHasta && !crsReducido() && !document.hidden) x -= CRS_VEL;
      envolver(); pinta();
    }
    requestAnimationFrame(paso);
  };
  vp.addEventListener('pointerdown', e => { if (e.button > 0) return; arrastrando = true; movido = false; sx = ultimaX = e.clientX; x0 = x; vel = 0; });
  vp.addEventListener('pointermove', e => {
    if (!arrastrando) return;
    const dx = e.clientX - sx;
    if (!movido && Math.abs(dx) > 6) { movido = true; try { vp.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } vp.classList.add('crs-arrastra'); }
    if (!movido) return;
    vel = e.clientX - ultimaX; ultimaX = e.clientX; x = x0 + dx; envolver(); x0 = x - dx; pinta();
  });
  const soltar = () => { if (!arrastrando) return; arrastrando = false; vp.classList.remove('crs-arrastra'); pausaHasta = Date.now() + CRS_PAUSA; };
  vp.addEventListener('pointerup', soltar); vp.addEventListener('pointercancel', soltar);
  // Un arrastre no debe contar como pulsación en lo que hay dentro
  vp.addEventListener('click', e => { if (movido) { e.stopPropagation(); e.preventDefault(); movido = false; } }, true);
  vp.addEventListener('mouseenter', () => { encima = true; }); vp.addEventListener('mouseleave', () => { encima = false; });
  vp.addEventListener('focusin', () => { pausaHasta = Date.now() + 10000; });
  vp.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); x -= e.deltaX; envolver(); pinta(); pausaHasta = Date.now() + CRS_PAUSA; } }, { passive: false });
  new ResizeObserver(() => { const n = ancho(); if (n && Math.abs(n - set) > 1) { x = x / set * n; set = n; envolver(); pinta(); } }).observe(vp);
  pinta(); requestAnimationFrame(paso);
}
new MutationObserver(() => document.querySelectorAll('[data-crs]:not([data-on])').forEach(vp => requestAnimationFrame(() => iniciarCarrusel(vp))))
  .observe(document.documentElement, { childList: true, subtree: true });
