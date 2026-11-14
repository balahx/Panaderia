/* Servidor local de la carpeta APP, con las mismas cabeceras de seguridad que firebase.json.
   Lo usan  node tools/servir.js  (probar en el computador) y las pruebas (tests/).
   Opciones: fake (cambia el SDK y la configuración por los de prueba de tests/fake-firebase) · sinCabeceras · rutas (respuestas a medida)
   · srv.lento(true) simula una red colgada. */
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..'), APP = path.join(RAIZ, 'APP'), FAKE = path.join(RAIZ, 'tests', 'fake-firebase');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

/* Cabeceras que firebase.json aplica a todo el sitio (source "**") */
function cabeceras() {
  const fj = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8'));
  const todas = (fj.hosting.headers || []).find(h => h.source === '**');
  return todas ? todas.headers : [];
}
function crear(o) {
  o = o || {};
  const extra = o.sinCabeceras ? [] : cabeceras();
  let lento = false;
  const atender = (q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    if (o.rutas && o.rutas[p]) return o.rutas[p](q, r);
    let f = path.resolve(APP, '.' + p);
    if (o.fake && p.startsWith('/vendor/firebase/')) f = path.join(FAKE, path.basename(p));
    if (o.fake && p === '/firebase-config.js') f = path.join(FAKE, 'firebase-config.js');
    const dentro = b => f === b || f.startsWith(b + path.sep);
    if (!dentro(APP) && !dentro(FAKE)) { r.writeHead(403); return r.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404, { 'Content-Type': 'text/plain' }); return r.end('no existe'); }
    const h = { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
    for (const x of extra) h[x.key] = x.value;
    r.writeHead(200, h); r.end(fs.readFileSync(f));
  };
  const srv = http.createServer((q, r) => lento ? setTimeout(() => atender(q, r), 12000) : atender(q, r));
  srv.lento = v => { lento = v; };
  srv.abrir = puerto => new Promise((res, rej) => { srv.once('error', rej); srv.listen(puerto || 0, '127.0.0.1', () => res('http://localhost:' + srv.address().port + '/')); });
  return srv;
}
module.exports = { crear, APP, RAIZ };
