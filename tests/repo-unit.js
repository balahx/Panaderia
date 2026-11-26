/* Higiene del repositorio (PLAN §9): nada privado ni secreto en los archivos, .gitignore completo, CI con permisos mínimos y
   acciones fijadas por hash, reglas de Firestore cerradas y SDK local sin cargas externas. Uso: node tests/repo-unit.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FUERA = new Set(['.git', 'node_modules', 'privado', 'app de muestra', '.firebase', 'huellas']);   // huellas/: tools/huella.js (Fase 13)
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => FUERA.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const files = walk(ROOT), texto = f => /\.(js|json|md|css|html|yml|yaml|rules|webmanifest|txt|svg)$|(^|\/)\.[a-z]+$/.test(rel(f)) ? fs.readFileSync(f, 'utf8') : '';

console.log('1. Sin secretos ni datos privados');
const nombres = files.map(rel).filter(f => /(^|\/)\.env|serviceAccount.*\.json$|adminsdk.*\.json$|\.pem$|\.key$|\.p12$/i.test(f));
ok(nombres.length === 0, 'no hay archivos de claves (.env, serviceAccount, adminsdk, .pem, .key)' + (nombres.length ? ': ' + nombres.join(', ') : ''));
const PATRONES = [['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/], ['cuenta de servicio', /"type"\s*:\s*"service_account"|"private_key"\s*:/], ['token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}/], ['secreto de cliente de Google', /GOCSPX-[A-Za-z0-9_-]{20,}/]];
const hall = [];
for (const f of files) { const r = rel(f); if (r.startsWith('APP/vendor/') || r === 'tests/repo-unit.js') continue; const t = texto(f); if (!t) continue;
  for (const [n, re] of PATRONES) if (re.test(t)) hall.push(r + ' (' + n + ')');
  if (r !== 'APP/firebase-config.js' && /AIza[0-9A-Za-z_-]{35}/.test(t)) hall.push(r + ' (clave web fuera de firebase-config.js)');
  const correos = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}/g) || []).filter(c => !/@(example\.com|users\.noreply\.github\.com)$/i.test(c) && !/\.(png|svg|js|css)$/i.test(c));
  if (correos.length) hall.push(r + ' (correo: ' + correos[0] + ')'); }
ok(hall.length === 0, 'ningún archivo trae claves privadas, tokens ni correos reales' + (hall.length ? ': ' + hall.join(' · ') : ''));

console.log('2. .gitignore');
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).map(x => x.trim());
const falta = ['privado/', 'app de muestra/', '.env*', 'serviceAccount*.json', '*adminsdk*.json', '*.pem', '*.key', 'tests/shots/', 'huellas/', 'node_modules/'].filter(x => !gi.includes(x));
ok(falta.length === 0, '.gitignore excluye lo privado y las claves' + (falta.length ? ' · falta: ' + falta.join(', ') : ''));

console.log('3. Integración continua');
const enSuLugar = fs.existsSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'));
if (!enSuLugar) { if (process.env.CI) ok(false, 'falta .github/workflows/ci.yml'); else console.log('  · pendiente: copiar tools/plantillas-github a .github (GUIA-FIREBASE.md, paso 10); se revisan las plantillas'); }
const wfDir = enSuLugar ? path.join(ROOT, '.github', 'workflows') : path.join(ROOT, 'tools', 'plantillas-github'), wfs = fs.readdirSync(wfDir).filter(f => /^ci.*\.ya?ml$/.test(f) || (enSuLugar && /\.ya?ml$/.test(f)));
ok(wfs.length >= 1, 'hay un flujo de pruebas (' + wfs.join(', ') + ')');
for (const w of wfs) { const t = fs.readFileSync(path.join(wfDir, w), 'utf8'), uses = t.match(/uses:\s*\S+/g) || [];
  ok(uses.length > 0 && uses.every(u => /@[0-9a-f]{40}$/.test(u)), w + ': acciones fijadas por hash completo (' + uses.length + ')');
  ok(/^permissions:\s*\n\s+contents: read\s*$/m.test(t) && !/write/.test(t), w + ': permisos mínimos (contents: read)');
  ok(!/pull_request_target/.test(t) && !/secrets\./.test(t), w + ': no usa pull_request_target ni secretos');
  ok(/emulators:exec[^\n]*rules-emulator\.js/.test(t), w + ': prueba las reglas de Firestore con el emulador'); }

console.log('4. Reglas de Firestore');
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8').replace(/\/\/.*$/gm, '');
ok(!/\{document=\*\*\}/.test(rules) && !/allow[^;]*:\s*if true\s*;/.test(rules), 'sin comodín general ni «if true»: lo que no se nombra queda cerrado');
ok(/function esDueno\(\)[\s\S]*config\/negocio[\s\S]*?\.data\.duenos/.test(rules) && /match \/config\/negocio \{[\s\S]*?allow create, delete: if false;/.test(rules), 'los dueños salen de config/negocio, que no se crea ni se borra desde la app');
ok(fs.existsSync(path.join(ROOT, 'tests', 'rules-emulator.js')) && fs.existsSync(path.join(ROOT, 'tests', 'reglas-casos.js')), 'hay prueba de reglas con el emulador y sus casos');

console.log('5. SDK local (APP/vendor/firebase)');
const V = require('../tools/vendor.js'), vdir = path.join(ROOT, 'APP', 'vendor', 'firebase');
ok(V.localizar('import{a}from"https://www.gstatic.com/firebasejs/1.2.3/firebase-app.js";x\n//# sourceMappingURL=a.js.map', '1.2.3') === 'import{a}from"./firebase-app.js";x', 'tools/vendor.js deja los import apuntando a la copia local');
ok(V.cargasExternas('import{a}from"https://otro.sitio/x.js";import("https://y.z/w.js")').length === 2 && V.cargasExternas('import{a}from"./firebase-app.js";const u="https://identitytoolkit.googleapis.com"').length === 0, 'y detecta cualquier carga desde otro sitio');
if (!fs.existsSync(path.join(vdir, 'VERSION.json'))) {
  if (process.env.CI) ok(false, 'falta APP/vendor/firebase: ejecuta «node tools/vendor.js» y súbelo al repositorio');
  else console.log('  · pendiente: aún no se ha ejecutado «node tools/vendor.js» (GUIA-FIREBASE.md, paso 2)');
} else {
  const info = JSON.parse(fs.readFileSync(path.join(vdir, 'VERSION.json'), 'utf8'));
  const obligatorios = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'];
  ok(obligatorios.every(a => info.archivos[a]), 'están los archivos que la app necesita (app, auth y firestore)');
  if (!info.archivos['firebase-app-check.js']) console.log('  · pendiente: falta firebase-app-check.js; vuelve a ejecutar «node tools/vendor.js» antes de activar App Check (GUIA-FIREBASE.md, paso 16)');
  for (const a of Object.keys(info.archivos)) {
    const f = path.join(vdir, a), t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    ok(t !== null && V.cargasExternas(t).length === 0, a + ' (' + info.version + ') está y no carga nada de otro sitio');
    ok(t !== null && info.archivos[a] && crypto.createHash('sha256').update(t).digest('hex') === info.archivos[a].sha256, a + ' coincide con la huella anotada al descargarlo');
  }
}
console.log('6. Revisión final de seguridad (Fase 8)');
const APPD = path.join(ROOT, 'APP'), sw = fs.readFileSync(path.join(APPD, 'sw.js'), 'utf8');
ok(/u\.origin !== self\.location\.origin\) return/.test(sw) && /startsWith\('\/__\/'\)\) return/.test(sw), 'el service worker no toca nada de otros sitios ni las direcciones reservadas de Firebase');
const codigo = walk(APPD).filter(f => /\.js$/.test(f) && !rel(f).startsWith('APP/vendor/')).map(f => [rel(f), fs.readFileSync(f, 'utf8')]);
const guardaToken = codigo.filter(([r, t]) => /(localStorage|sessionStorage)\.setItem\([^)]*(id_?token|idToken|token)/i.test(t)).map(x => x[0]);
ok(guardaToken.length === 0, 'el token de Google no se guarda en el equipo (solo state y nonce del ingreso)' + (guardaToken.length ? ': ' + guardaToken.join(', ') : ''));
ok(/history\.replaceState\(null, '', location\.pathname \+ location\.search\)/.test(fs.readFileSync(path.join(APPD, 'js', 'core', 'acceso.js'), 'utf8')), 'al volver de Google, el token se borra de la dirección y del historial');
const cfgTxt = fs.readFileSync(path.join(APPD, 'firebase-config.js'), 'utf8');
ok(!/secret|privateKey|private_key/i.test(cfgTxt.replace(/\/\*[\s\S]*?\*\//g, '')), 'firebase-config.js solo tiene datos públicos (la clave secreta de reCAPTCHA va solo en la consola)');
const enlacesBlank = codigo.flatMap(([r, t]) => (t.match(/target="_blank"[^>]*/g) || []).filter(x => !/rel="noopener/.test(x)).map(() => r));
ok(enlacesBlank.length === 0, 'todo enlace que abre aparte lleva rel="noopener"' + (enlacesBlank.length ? ': ' + enlacesBlank.join(', ') : ''));
/* El servidor local (solo pruebas y computador) rechaza direcciones tramposas (revisión de CodeQL) */
(async () => {
  const http = require('http'), { crear } = require('../tools/servidor.js');
  const srv = crear({ rutas: { '/hola': (q, r) => { r.writeHead(200); r.end('hola'); } } }), URL = await srv.abrir(), puerto = new globalThis.URL(URL).port;
  const pedir = ruta => new Promise(res => { const q = http.request({ host: '127.0.0.1', port: puerto, path: ruta }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }); q.on('error', () => res(0)); q.end(); });
  const c = {}; for (const r of ['/', '/hola', '/__proto__', '/constructor', '/%E0%A4%A', '/../package.json', '/..%2Fpackage.json', '/js/%00app.js', '/..%5Cpackage.json']) c[r] = await pedir(r);
  ok(c['/'] === 200 && c['/hola'] === 200, 'el servidor local sirve la app y sus rutas a medida');
  ok(c['/__proto__'] === 404 && c['/constructor'] === 404, 'nombres especiales de JavaScript no se tratan como rutas a medida');
  ok(c['/%E0%A4%A'] === 400 && [c['/../package.json'], c['/..%2Fpackage.json'], c['/js/%00app.js'], c['/..%5Cpackage.json']].every(x => x === 403 || x === 404) && c['/..%2Fpackage.json'] === 403, 'una dirección mal codificada no lo cae, y nada fuera de APP\\ se entrega (.., %2F, %5C, byte nulo)');
  srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
