/* Service worker: permite abrir la app sin conexión.
   Estrategia: red primero (así se ven las actualizaciones), con respaldo en caché. Solo atiende archivos del propio sitio. */
importScripts('version.js');   // define PAN_VERSION: cada versión nueva usa un caché nuevo y borra el anterior
const CACHE = 'panaderia-' + self.PAN_VERSION.v;
const NET_WAIT = 3000, NET_WAIT_SLOW = 0;   // ms que se espera a la red antes de abrir desde la copia guardada (menos si la red ya falló hace poco)
let slowUntil = 0;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './version.js', './guard.js', './firebase-config.js',
  './css/tokens.css', './css/base.css', './css/componentes.css',
  './js/app.js',
  './js/core/nube.js', './js/core/acceso.js', './js/core/ui.js', './js/core/formato.js', './js/core/iconos.js', './js/core/actualizar.js',
  './js/pantallas/ingreso.js', './js/pantallas/inicio.js', './js/pantallas/mas.js',
  './fonts/Barlow-Regular.woff', './fonts/Barlow-Medium.woff', './fonts/Barlow-SemiBold.woff', './fonts/BarlowCondensed-Medium.woff', './fonts/BarlowCondensed-SemiBold.woff', './fonts/BarlowCondensed-Bold.woff',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
/* Copias locales del SDK (las descarga tools/vendor.js). Se guardan aparte y sin exigirlas: si aún no están, la app
   se instala igual y avisa en la pantalla de ingreso. */
const VENDOR = ['./vendor/firebase/firebase-app.js', './vendor/firebase/firebase-auth.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))
      .then(() => Promise.all(VENDOR.map(a => fetch(new Request(a, { cache: 'reload' })).then(r => r.ok ? c.put(a, r) : null).catch(() => null)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('panaderia-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;   // nada de otros sitios pasa por aquí
  if (u.pathname.startsWith('/__/')) return;                                // direcciones reservadas de Firebase Hosting
  if (u.pathname.endsWith('/version.js') && u.searchParams.has('t')) return;   // la comprobación de versión va directo a la red y no se guarda
  // Red primero, pero sin esperar sin límite: si la red tarda más de NET_WAIT ms y hay copia guardada, se usa la copia
  // (tras una espera fallida, durante 30 s se usa la copia de inmediato; la descarga sigue en segundo plano).
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(net.catch(() => null));
  const saved = () => caches.match(req, { ignoreSearch: true });
  const shell = () => req.mode === 'navigate' ? caches.match('./index.html') : undefined;
  e.respondWith(
    Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r('late'), Date.now() < slowUntil ? NET_WAIT_SLOW : NET_WAIT))]).then(r => {
      if (r && r !== 'late') return r;
      if (r === 'late') slowUntil = Date.now() + 30000;
      return saved().then(c => c || (r === 'late' ? net.catch(shell) : shell())).then(x => x || Response.error());
    })
  );
});
