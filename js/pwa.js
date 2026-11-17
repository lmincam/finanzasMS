'use strict';
/* =====================================================================
   APP INSTALABLE, MODO SIN CONEXIÓN Y AVISOS
   ---------------------------------------------------------------------
   • Registra el service worker (sw.js) y gestiona la instalación.
   • Guarda en el dispositivo (IndexedDB) una copia de los últimos datos
     cargados para poder abrir la app sin cobertura en modo solo lectura.
     Se borra al cerrar sesión.
   • Avisos del sistema al abrir la app con las alertas importantes del
     Dashboard (como máximo 3 al día, sin repetir el mismo en 7 días).
   Depende de: utilidades.js, estado.js, ui.js, alertas.js
   ===================================================================== */

const PWA = { prompt: null, sw: null };
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esInstalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/* ---------- Service worker e instalación ---------- */
function iniciarPWA() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(reg => { PWA.sw = reg; }).catch(e => console.warn('SW no registrado', e));
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return; recargando = true;
      if (!document.querySelector('.modal')) location.reload(); else toast('Hay una versión nueva de la app: se aplicará al recargar', 'ok', 6000);
    });
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.prompt = e; if (S.tab === 'ajustes') render(); });
  window.addEventListener('appinstalled', () => { PWA.prompt = null; toast('App instalada ✓', 'ok'); });
}

/* ---------- Copia local de los datos para usar sin conexión ---------- */
const IDB = {
  db: null,
  abrir() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open('patrimonio', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); }); },
  async set(k, v) { const db = await this.abrir(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async get(k) { const db = await this.abrir(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readonly').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); },
  async borrar() { const db = await this.abrir(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = res; t.onerror = res; }); }
};
const TABLAS_LOCAL = ['cuentas', 'categorias', 'movimientos', 'inmuebles', 'vehiculos', 'deudas', 'snapshots', 'valoraciones', 'precios_m2', 'amortizaciones', 'amortizaciones_plan',
  'aportaciones_periodicas', 'posiciones', 'seguros', 'reglas_categoria', 'patrimonio_mensual', 'partidas_previstas', 'metas'];
async function guardarCopiaLocal() {
  try {
    const d = { fecha: new Date().toISOString(), usuario: Auth.user && Auth.user.email, missing: [...S.missing], ajustes: S.ajustes, ajustesRows: S.ajustesRows, tablas: {} };
    for (const t of TABLAS_LOCAL) d.tablas[t] = S[t];
    await IDB.set('datos', d);
  } catch (e) { console.warn('No se pudo guardar la copia local', e); }
}
async function cargarCopiaLocal() {
  try {
    const d = await IDB.get('datos'); if (!d || !d.tablas) return false;
    for (const t of TABLAS_LOCAL) if (d.tablas[t]) S[t] = d.tablas[t];
    S.missing = new Set(d.missing || []); S.ajustes = { ...S.ajustes, ...(d.ajustes || {}) }; S.ajustesRows = d.ajustesRows || [];
    S.tablaValoraciones = !S.missing.has('valoraciones'); S.v4 = !S.missing.has('seguros'); S.v5 = !S.missing.has('patrimonio_mensual'); S.v52 = !S.missing.has('metas');
    S.offline = d.fecha; S.connected = true; S.loaded = true;
    return true;
  } catch (e) { return false; }
}
const borrarCopiaLocal = () => IDB.borrar().catch(() => {});
window.addEventListener('online', () => { if (S.offline) { toast('Vuelve a haber conexión: recargando datos…', 'ok'); S.offline = null; loadAll(); } });

/* ---------- Avisos del sistema ---------- */
const avisosActivos = () => localStorage.getItem('pf_avisos') === '1' && 'Notification' in window && Notification.permission === 'granted';
async function mostrarAviso(titulo, cuerpo, url = './#dashboard') {
  const opts = { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url }, tag: titulo };
  try { const reg = PWA.sw || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration()); if (reg) return reg.showNotification(titulo, opts); } catch (e) { /* noop */ }
  try { new Notification(titulo, opts); } catch (e) { /* noop */ }
}
/** Lanza como aviso del sistema las alertas importantes del mes en curso (sin repetir en 7 días). */
async function avisosAlAbrir() {
  if (!avisosActivos() || S.offline) return;
  let enviados = {}; try { enviados = JSON.parse(localStorage.getItem('pf_avisos_enviados') || '{}'); } catch (e) { enviados = {}; }
  const hoy = todayISO();
  for (const k of Object.keys(enviados)) if (diasEntre(enviados[k], hoy) > 30) delete enviados[k];
  const ym = mesActual(), st = periodStats([ym]), P = Calc.patrimonio();
  const rows = budgetRows(st.movs.filter(m => m.tipo === 'gasto'), 1, [ym]), oc = alertasOcultas();
  const A = buildAlertas([ym], st, P, rows).filter(a => (a.nivel === 'red' || a.nivel === 'amber') && !(oc[a.key] && oc[a.key] >= hoy)).filter(a => !enviados[a.t] || diasEntre(enviados[a.t], hoy) >= 7);
  const txt = h => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const yaHoy = Object.values(enviados).filter(d => d === hoy).length; // máximo 3 avisos al día
  for (const a of A.slice(0, Math.max(0, 3 - yaHoy))) { await mostrarAviso(`${a.ic} ${a.t}`, txt(a.txt).slice(0, 180)); enviados[a.t] = hoy; }
  localStorage.setItem('pf_avisos_enviados', JSON.stringify(enviados));
}
AfterLoad.push(async () => { await guardarCopiaLocal(); setTimeout(avisosAlAbrir, 1500); });

/* ---------- Tarjeta en Ajustes ---------- */
function renderAppCard() {
  const inst = esInstalada(), perm = 'Notification' in window ? Notification.permission : 'no';
  let instalar;
  if (inst) instalar = '<span class="badge green">✓ Instalada en este dispositivo</span>';
  else if (PWA.prompt) instalar = '<button class="btn primary" data-action="pwa-instalar">📲 Instalar la app</button>';
  else if (esIOS()) instalar = '<div class="small">En iPhone: abre la app en <b>Safari</b> → botón <b>Compartir</b> (cuadrado con flecha) → <b>Añadir a pantalla de inicio</b>.</div>';
  else instalar = '<div class="small">En Android/Chrome: menú <b>⋮</b> → <b>Instalar aplicación</b> (o "Añadir a pantalla de inicio"). En el ordenador: icono de instalar en la barra de direcciones.</div>';
  let avisos;
  if (perm === 'no') avisos = '<div class="small muted">Este navegador no admite avisos.' + (esIOS() && !inst ? ' En iPhone, primero instala la app en la pantalla de inicio.' : '') + '</div>';
  else if (perm === 'denied') avisos = '<div class="small warn-t">Los avisos están bloqueados para esta web. Actívalos en los ajustes del navegador o del móvil.</div>';
  else if (avisosActivos()) avisos = '<span class="badge green">✓ Activados</span> <button class="btn sm" data-action="pwa-probar">Probar</button> <button class="btn sm ghost" data-action="pwa-avisos-off">Desactivar</button>';
  else avisos = '<button class="btn" data-action="pwa-avisos-on">🔔 Activar avisos en este dispositivo</button>';
  return `<div class="card"><div class="card-head"><h3>📱 App en el móvil</h3></div>
    <div class="sub-title" style="margin-top:0">Instalar</div>${instalar}
    <p class="small muted">Instalada se abre a pantalla completa con su icono, arranca al instante y <b>abre sin cobertura</b> con los últimos datos (solo lectura).</p>
    <div class="sub-title">Avisos</div>${avisos}
    <p class="small muted" style="margin-bottom:0">Al abrir la app te avisa de lo importante: presupuestos superados, vencimientos de seguros, saldo previsto bajo, metas retrasadas… (como máximo 3 al día y sin repetir el mismo aviso en una semana).</p></div>`;
}

Object.assign(Actions, {
  'pwa-instalar': async () => { if (!PWA.prompt) return; PWA.prompt.prompt(); await PWA.prompt.userChoice; PWA.prompt = null; render(); },
  'pwa-avisos-on': async () => {
    const p = await Notification.requestPermission();
    if (p === 'granted') { localStorage.setItem('pf_avisos', '1'); toast('Avisos activados ✓', 'ok'); await mostrarAviso('🔔 Avisos activados', 'Te avisaré al abrir la app cuando haya algo importante.'); }
    else toast('No se han concedido los permisos de avisos', 'warn');
    render();
  },
  'pwa-avisos-off': () => { localStorage.removeItem('pf_avisos'); toast('Avisos desactivados', 'ok'); render(); },
  'pwa-probar': () => mostrarAviso('💶 Patrimonio Miñán Sánchez', 'Así se verán los avisos de la app.')
});
