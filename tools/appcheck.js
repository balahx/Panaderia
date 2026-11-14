#!/usr/bin/env node
/* App Check (reCAPTCHA v3) necesita cargar un script y un marco de Google. La app, por defecto, no admite NADA de otros
   sitios (PLAN §9). Esta herramienta abre o cierra esa excepción en los dos lugares donde vive la política de contenido
   (APP/index.html y firebase.json), siempre igual en ambos:
     node tools/appcheck.js activar      admite reCAPTCHA y el servicio de App Check (y nada más)
     node tools/appcheck.js desactivar   vuelve a la política estricta: solo archivos de la propia app
     node tools/appcheck.js estado       dice cómo está
   La clave de sitio va en APP/firebase-config.js (appCheckSiteKey). tests/csp.js exige que ambas cosas coincidan:
   política abierta ⇔ clave puesta. Pasos completos: GUIA-FIREBASE.md, paso 16. */
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..'), HTML = path.join(RAIZ, 'APP', 'index.html'), FJ = path.join(RAIZ, 'firebase.json');
const RECAPTCHA = ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'];
const MARCOS = ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'];
const SERVICIOS = ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'];
const APPCHECK = ['https://content-firebaseappcheck.googleapis.com', 'https://www.google.com/recaptcha/'];

/* La política de index.html (la cabecera de Hosting es la misma más frame-ancestors 'none'). */
function politica(conAppCheck) {
  return ["default-src 'none'",
    "script-src 'self'" + (conAppCheck ? ' ' + RECAPTCHA.join(' ') : ''),
    "style-src 'self'", "font-src 'self'", "img-src 'self' data:",
    "connect-src 'self' " + SERVICIOS.concat(conAppCheck ? APPCHECK : []).join(' ')]
    .concat(conAppCheck ? ['frame-src ' + MARCOS.join(' ')] : [])
    .concat(["manifest-src 'self'", "worker-src 'self'", "media-src 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]).join('; ');
}
const RE = /(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(")/;
function leer() {
  const m = RE.exec(fs.readFileSync(HTML, 'utf8'));
  return m ? (m[2] === politica(true) ? 'activo' : m[2] === politica(false) ? 'estricto' : 'otro') : 'otro';
}
function escribir(conAppCheck) {
  const html = fs.readFileSync(HTML, 'utf8');
  if (!RE.test(html)) throw new Error('No se encontró la política en APP/index.html');
  fs.writeFileSync(HTML, html.replace(RE, (x, a, b, c) => a + politica(conAppCheck) + c));
  const texto = fs.readFileSync(FJ, 'utf8'), fj = JSON.parse(texto);
  const h = fj.hosting.headers.find(x => x.source === '**').headers.find(x => x.key === 'Content-Security-Policy');
  h.value = politica(conAppCheck) + "; frame-ancestors 'none'";
  fs.writeFileSync(FJ, JSON.stringify(fj, null, 2) + (texto.endsWith('\n') ? '\n' : ''));
}
/* ¿Hay clave de sitio en firebase-config.js? */
function hayClave(archivo) {
  const m = /appCheckSiteKey\s*=\s*'([^']*)'/.exec(fs.readFileSync(archivo || path.join(RAIZ, 'APP', 'firebase-config.js'), 'utf8'));
  return !!m && m[1].length > 0 && !/^PEGAR/i.test(m[1]);
}
if (require.main === module) {
  const que = process.argv[2];
  if (que === 'activar' || que === 'desactivar') {
    escribir(que === 'activar');
    console.log(que === 'activar' ? 'Política abierta SOLO para reCAPTCHA y App Check (index.html y firebase.json).' : 'Política estricta: solo archivos de la propia app.');
    if (que === 'activar' && !hayClave()) console.log('Falta pegar la clave de sitio en APP/firebase-config.js (appCheckSiteKey). GUIA-FIREBASE.md, paso 16.');
    if (que === 'desactivar' && hayClave()) console.log("Deja también  appCheckSiteKey = ''  en APP/firebase-config.js.");
    console.log('Luego: npm test  y  npm run publicar');
  } else if (que === 'estado') {
    console.log('Política: ' + leer() + ' · clave de sitio: ' + (hayClave() ? 'puesta' : 'vacía'));
  } else { console.error('Uso: node tools/appcheck.js activar | desactivar | estado'); process.exit(1); }
}
module.exports = { politica, leer, hayClave, RECAPTCHA, MARCOS, APPCHECK };
