/* Comprueba que la app se instala (manifest, íconos) y abre sin conexión gracias al service worker, con y sin sesión. Uso: node tests/pwa.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { crear, APP } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const pngSize = f => { const b = fs.readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : '?'; };
(async () => {
  console.log('1. Manifest e íconos');
  const m = JSON.parse(fs.readFileSync(path.join(APP, 'manifest.webmanifest'), 'utf8'));
  ok(m.name === 'Panadería' && m.display === 'standalone' && m.start_url && m.scope && m.icons.length >= 3, 'manifest: nombre «Panadería», standalone, start_url e íconos');
  for (const i of m.icons) { const f = path.join(APP, i.src.split('?')[0]); ok(fs.existsSync(f) && pngSize(f) === i.sizes, 'ícono ' + i.src + ' existe y mide ' + i.sizes); }
  ok(m.icons.some(i => i.purpose === 'maskable') && m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'), 'hay ícono de 192, de 512 y uno adaptable (maskable)');
  ok(pngSize(path.join(APP, 'icons', 'icon-180.png')) === '180x180' && /apple-touch-icon" href="icons\/icon-180\.png/.test(fs.readFileSync(path.join(APP, 'index.html'), 'utf8')), 'ícono de 180 para iPhone y iPad');

  console.log('2. Sin conexión');
  const srv = crear({ fake: true }), URL = await srv.abrir();
  const br = await chromium.launch(), ctx = await br.newContext(), page = await ctx.newPage();
  await fakeGoogle(page);
  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForSelector('#btnGoogle');   // ya controlado por el service worker
  ok(!!(await page.evaluate(() => navigator.serviceWorker.controller)), 'el service worker controla la página');
  const cached = await page.evaluate(async () => (await (await caches.open('panaderia-' + window.PAN_VERSION.v)).keys()).map(r => new URL(r.url).pathname));
  ok(['/index.html', '/js/app.js', '/js/core/nube.js', '/js/core/acceso.js', '/js/pantallas/ingreso.js', '/css/tokens.css', '/css/base.css', '/css/componentes.css', '/firebase-config.js', '/version.js', '/guard.js', '/manifest.webmanifest', '/vendor/firebase/firebase-app.js', '/vendor/firebase/firebase-auth.js'].every(p => cached.includes(p)), 'archivos en caché (incluido el SDK local): ' + cached.length);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#btnGoogle');
  ok(true, 'sin conexión y sin sesión, la app abre desde la caché');
  await ctx.setOffline(false);
  await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#appRoot:not([hidden])');
  ok((await page.textContent('#view h1')).trim() === 'Hola, Rosa', 'con sesión iniciada, en modo avión abre directo en la app');
  await page.waitForSelector('#netBar:not([hidden])'); ok(/Sin conexión/.test(await page.textContent('#netBar')), 'avisa que está sin conexión');
  ok(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('700 20px "Barlow Condensed"') && document.fonts.check('400 15px Barlow'))), 'las tipografías cargan sin conexión');
  await ctx.setOffline(false); await page.waitForSelector('#netBar', { state: 'hidden' }); ok(true, 'al volver la conexión el aviso se quita');

  console.log('3. Red colgada');
  srv.lento(true);   // con la red colgada la app abre en pocos segundos desde la copia guardada, no se queda esperando
  const t0 = Date.now();
  await page.reload({ waitUntil: 'commit' }); await page.waitForSelector('#appRoot:not([hidden])', { timeout: 9000 });
  const dt = Date.now() - t0;
  ok(dt < 8000, 'con la red colgada abre desde la copia en ' + (dt / 1000).toFixed(1) + ' s (límite 8 s)');
  srv.lento(false);

  console.log('4. Sin el SDK local (antes de ejecutar tools/vendor.js)');
  const srv2 = crear({ rutas: { '/firebase-config.js': (q, r) => { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(fs.readFileSync(path.join(__dirname, 'fake-firebase', 'firebase-config.js'))); },
    '/vendor/firebase/firebase-app.js': (q, r) => { r.writeHead(404); r.end(); }, '/vendor/firebase/firebase-auth.js': (q, r) => { r.writeHead(404); r.end(); } } }), URL2 = await srv2.abrir();
  const p2 = await (await br.newContext()).newPage();
  await p2.goto(URL2); await p2.waitForSelector('.errbox');
  ok(/tools\/vendor\.js/.test(await p2.textContent('.errbox')), 'explica que falta ejecutar tools/vendor.js');
  ok(!!(await p2.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active))), 'aun así el service worker se instala');
  await br.close(); srv.close(); srv2.close(); console.log(fails ? fails + ' FALLAS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
