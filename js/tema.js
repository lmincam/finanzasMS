'use strict';
/* =====================================================================
   TEMA (claro / oscuro)
   ---------------------------------------------------------------------
   "auto" sigue al sistema (prefers-color-scheme). "light"/"dark" lo
   fuerzan en este dispositivo (localStorage pf_tema → <html data-theme>).
   El atributo se fija ya en <head> para que no haya destello al abrir.
   Depende de: graficos.js (mkChart / Charts), app.js (render)
   ===================================================================== */

const Tema = {
  pref: () => { try { return localStorage.getItem('pf_tema') || 'auto'; } catch (e) { return 'auto'; } },
  mq: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  oscuro() { const p = Tema.pref(); return p === 'dark' || (p === 'auto' && !!(Tema.mq && Tema.mq.matches)); },
  aplicar() {
    const p = Tema.pref(), html = document.documentElement;
    if (p === 'auto') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', p);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', Tema.oscuro() ? '#0b1426' : '#0f1f3a');
    if (window.Chart) {
      Chart.defaults.color = Tema.oscuro() ? '#a9b6c9' : '#475569';
      Chart.defaults.borderColor = Tema.oscuro() ? 'rgba(148,163,184,.16)' : 'rgba(15,23,42,.08)';
    }
  },
  /** Colores que dependen del tema para las opciones de Chart.js. */
  rejilla: () => Tema.oscuro() ? '#1f2b40' : '#eef2f7',
  hueco: () => Tema.oscuro() ? '#131c2e' : '#fff'
};
if (Tema.mq && Tema.mq.addEventListener) Tema.mq.addEventListener('change', () => { if (Tema.pref() === 'auto') { Tema.aplicar(); if (typeof render === 'function') render(); } });

function renderTemaCard() {
  const p = Tema.pref();
  const op = (k, l, i) => `<button class="seg-btn ${p === k ? 'active' : ''}" data-action="tema" data-v="${k}">${icono(i)}<span>${l}</span></button>`;
  return `<div class="card"><div class="card-head"><h3>Apariencia</h3></div>
    <div class="seg">${op('auto', 'Automático', 'phone')}${op('light', 'Claro', 'eye')}${op('dark', 'Oscuro', 'moon')}</div>
    <p class="small muted" style="margin-bottom:0">Automático sigue el modo claro/oscuro del móvil u ordenador. Se guarda en este dispositivo.</p></div>`;
}

Object.assign(Actions, {
  tema: (el) => { try { localStorage.setItem('pf_tema', el.dataset.v); } catch (e) { /* noop */ } Tema.aplicar(); render(); }
});
