/* Fase 8 de punta a punta (con dobles de Firebase, Google y Firestore): aviso de privacidad (desde el ingreso, la espera y «Más», en
   todos los perfiles), Ayuda según el perfil, títulos y foco al cambiar de pantalla, App Check (aviso de reCAPTCHA, insignia oculta y
   comprobante en el Diagnóstico) y el detalle de los bloqueos de seguridad. Uso: node tests/privacidad-e2e.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' }, NUEVA = { sub: '6006', email: 'nueva@example.com', name: 'Persona Nueva' };
const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true, en: 1 }, 'trabajadores/t1': { nombre: 'Luis Soto', activo: true, en: 1 } };
const conClave = fs.readFileSync(path.join(__dirname, 'fake-firebase', 'firebase-config.js'), 'utf8').replace("appCheckSiteKey = ''", "appCheckSiteKey = 'clave-recaptcha-de-prueba'");
const js = t => (q, r) => { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); r.end(t); };

(async () => {
  const br = await chromium.launch(), errs = [];
  async function abrir(rutas) {
    const srv = crear({ fake: true, rutas }), URL = await srv.abrir(), ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }), page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForSelector('#btnGoogle');
    await page.evaluate(s => localStorage.setItem('fake.db', s), JSON.stringify(SEMILLA));
    const entrar = async (quien, espera) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(espera); };
    const salir = async () => { await page.click('#nav button[data-tab="mas"]').catch(() => {}); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
    const privacidad = async sel => { await page.click(sel); await page.waitForSelector('#dlg[open] #privacidad'); const t = await page.textContent('#privacidad'); await page.keyboard.press('Escape'); await page.waitForSelector('#dlg:not([open])', { state: 'attached' }); return t; };
    return { srv, ctx, page, URL, entrar, salir, privacidad, cerrar: async () => { await ctx.close(); srv.close(); } };
  }
  const temas = page => page.$$eval('#ayudaTemas details', l => l.map(d => d.id.replace('ay-', '')));

  console.log('1. Sin App Check: aviso de privacidad desde el ingreso y la espera');
  let A = await abrir(), page = A.page;
  ok((await page.title()) === 'Panadería', 'el ingreso se titula «Panadería»');
  const t1 = await A.privacidad('#lnkPrivacidad');
  ok(/Vigente desde/.test(t1) && /nombre, tu correo/.test(t1) && /fuera de Chile/.test(t1) && /no se venden/.test(t1) && /sin precios ni ventas/.test(t1), 'sin sesión se lee el aviso: qué datos, dónde, quién los ve y qué no se hace');
  ok(!/reCAPTCHA/.test(t1) && !(await page.$('#avisoRecaptcha')), 'sin App Check configurado no se menciona reCAPTCHA');
  await A.entrar(NUEVA, '#pedir');
  ok(/nombre, tu correo/.test(await A.privacidad('#lnkPrivacidad')), 'quien va a pedir acceso también lo puede leer antes de enviar su nombre');
  await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle');

  console.log('2. La dueña: Ayuda, títulos y foco al cambiar de pantalla');
  await A.entrar({}, '#hoySaludo');
  ok((await page.title()) === 'Hoy · Panadería', 'cada pantalla tiene su título (Hoy)');
  await page.click('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entMes');
  const foco = await page.evaluate(() => ({ tag: document.activeElement.tagName, t: document.activeElement.textContent, titulo: document.title }));
  ok(foco.titulo === 'Entregas · Panadería' && foco.tag === 'H1', 'al cambiar de pantalla, el título cambia y el foco queda en el encabezado (lo anuncia el lector de pantalla)');
  await page.click('#nav button[data-tab="mas"]'); await page.waitForSelector('#irAyuda');
  ok(/Qué datos/.test(await A.privacidad('#irPrivacidad')), 'en «Más» está el aviso de privacidad');
  await page.click('#irAyuda'); await page.waitForSelector('#ayudaTemas');
  const tD = await temas(page);
  ok((await page.title()) === 'Ayuda · Panadería' && ['pesar', 'corregir', 'entrega', 'sinred', 'hoy', 'entregas', 'cerrar', 'numeros', 'precios', 'respaldo', 'accesos', 'actualizar', 'problema'].every(x => tD.includes(x)), 'la Ayuda de la dueña trae todos los temas (' + tD.length + '), incluido dar accesos');
  ok(await page.$$eval('#ayudaTemas details[open]', l => l.length) === 0, 'los temas parten cerrados: se abre solo el que se necesita');
  await page.click('#ay-cerrar summary');
  ok(/día 1 del mes siguiente/.test(await page.textContent('#ay-cerrar')) && await page.isVisible('#ay-cerrar .ayuda-b'), 'al tocar un tema se abre su explicación');
  await page.click('.volver'); await page.waitForSelector('#irAyuda');
  await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  const d1 = await page.textContent('#diag');
  ok(/App CheckSin configurar/.test(d1) && /Bloqueos de seguridad0/.test(d1) && !/Qué se bloqueó/.test(d1) && /Apertura de la app/.test(d1), 'Diagnóstico: App Check sin configurar, 0 bloqueos (sin detalle) y la apertura');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const i = document.createElement('img'); i.src = 'https://otro.example.com/x.png'; document.body.appendChild(i); });
  await page.waitForFunction(() => window.__csp.length > 0);
  await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  ok(/Bloqueos de seguridad[1-9]/.test(await page.textContent('#diag')) && /Qué se bloqueóimg-src https:\/\/otro\.example\.com/.test(await page.textContent('#diag')), 'si la política bloquea algo, el Diagnóstico dice qué fue (para copiarlo al chat)');
  await page.keyboard.press('Escape');
  await A.salir();

  console.log('3. El externo y la tablet');
  await A.entrar(FELIPE, '#hoySaludo'); await page.click('#nav button[data-tab="mas"]'); await page.click('#irAyuda'); await page.waitForSelector('#ayudaTemas');
  const tE = await temas(page);
  ok(tE.includes('precios') && tE.includes('cerrar') && !tE.includes('accesos'), 'el externo ve los temas de gestión, no el de accesos');
  await page.click('.volver'); await A.salir();
  await A.entrar(TABLET, '#pesQuien'); await page.click('#nav button[data-tab="mas"]'); await page.waitForSelector('#irAyuda');
  ok(/sin precios ni ventas/.test(await A.privacidad('#irPrivacidad')), 'la tablet también tiene el aviso de privacidad');
  await page.click('#irAyuda'); await page.waitForSelector('#ayudaTemas');
  const tT = await temas(page), txt = await page.textContent('#view');
  ok(tT.join() === 'pesar,corregir,entrega,sinred,actualizar,problema' && !/precio|Excel|Entregas/.test(txt), 'la tablet ve solo pesar, corregir, entrega, sin internet, actualizar y problemas (nada de precios ni ventas)');
  ok(await page.evaluate(() => document.documentElement.dataset.escala) === 'grande', 'y con letra grande');
  await page.click('.volver'); await A.salir();
  await A.cerrar();

  console.log('4. Con App Check (clave de sitio puesta)');
  A = await abrir({ '/firebase-config.js': js(conClave) }); page = A.page;
  await page.waitForSelector('#avisoRecaptcha');
  const links = await page.$$eval('#avisoRecaptcha a', l => l.map(a => [a.href, a.target, a.rel]));
  ok(links.length === 2 && links[0][0] === 'https://policies.google.com/privacy' && links[1][0] === 'https://policies.google.com/terms' && links.every(x => x[1] === '_blank' && /noopener/.test(x[2])), 'el ingreso muestra el aviso de reCAPTCHA con la Política de Privacidad y las Condiciones de Google (se abren aparte)');
  ok(/reCAPTCHA/.test(await A.privacidad('#lnkPrivacidad')), 'y el aviso de privacidad explica qué hace reCAPTCHA');
  await A.entrar({}, '#hoySaludo');
  const oculta = await page.evaluate(() => { const b = document.createElement('div'); b.className = 'grecaptcha-badge'; b.textContent = 'reCAPTCHA'; document.body.appendChild(b); const v = getComputedStyle(b).visibility; b.remove(); return v; });
  ok(oculta === 'hidden', 'la insignia de reCAPTCHA queda oculta (no tapa la barra de abajo)');
  await page.click('#nav button[data-tab="mas"]'); await page.waitForFunction(() => true);
  await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  ok(/App CheckActivo · comprobante recibido/.test(await page.textContent('#diag')), 'Diagnóstico: «App Check: Activo · comprobante recibido»');
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.setItem('fake.appCheckFalla', 'appCheck/recaptcha-error'));
  await page.reload(); await page.waitForSelector('#hoySaludo');
  await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  ok(/App CheckActivo · sin comprobante \(appCheck\/recaptcha-error\)/.test(await page.textContent('#diag')), 'si reCAPTCHA no entrega el comprobante, el Diagnóstico lo dice con su código');
  await page.keyboard.press('Escape');
  await A.cerrar();
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await br.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
