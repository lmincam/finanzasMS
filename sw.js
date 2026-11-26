/* =====================================================================
   SERVICE WORKER · Patrimonio Miñán Sánchez
   ---------------------------------------------------------------------
   • La página (index.html) se pide primero a internet para tener siempre
     la última versión; si no hay conexión, se usa la copia guardada.
   • Los archivos de la app (js/css con ?v=…) y las librerías externas
     se guardan en el dispositivo para que abra al instante y sin cobertura.
   • NUNCA guarda las llamadas a Supabase (tus datos van por otro camino).
   ===================================================================== */
const CACHE = 'patrimonio-v5.28.6';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/supabase\.(co|in)$/.test(url.hostname) || url.pathname.includes('/auth/') || url.pathname.includes('/rest/') || url.pathname.includes('/storage/')) return;
  // Página: red primero
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Resto (app y librerías): caché primero, actualizando en segundo plano
  e.respondWith(caches.match(req).then(hit => {
    const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || red;
  }));
});
// Al tocar una notificación, abre (o enfoca) la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || './#dashboard';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { w.navigate && w.navigate(destino); return w.focus(); }
    return self.clients.openWindow(destino);
  }));
});
