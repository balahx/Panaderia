/* Ingreso con Google de punta a punta (con dobles de Firebase y de Google): sin configurar, ingreso correcto, respuestas
   falsas o canceladas, sesión que se conserva, navegación, diagnóstico y cierre de sesión. Uso: node tests/ingreso-e2e.js */
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const br = await chromium.launch();
  console.log('1. Sin configurar (un firebase-config.js con «PEGAR…»)');
  const vacio = require('fs').readFileSync(require('path').join(__dirname, 'fake-firebase', 'firebase-config-vacio.js'));
  const real = crear({ rutas: { '/firebase-config.js': (q, r) => { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); r.end(vacio); } } }), URL0 = await real.abrir();
  let ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  const errs0 = []; page.on('pageerror', e => errs0.push(e.message));
  await page.goto(URL0); await page.waitForSelector('#sinConfig');
  ok(await page.isDisabled('.gate .btn.lg'), 'avisa que falta conectar Firebase y el botón queda deshabilitado');
  ok((await page.textContent('.gate .nm')) === 'Panadería' && await page.isHidden('#appRoot'), 'se ve la marca «Panadería» y la app queda oculta');
  ok(/^Versión \d+\.\d+\.\d+$/.test((await page.textContent('.gate .ver-line')).trim()), 'muestra la versión');
  ok(errs0.length === 0, 'sin errores de JavaScript' + (errs0.length ? ': ' + errs0[0] : ''));
  await ctx.close(); real.close();

  console.log('2. Ingreso con Google');
  const srv = crear({ fake: true }), URL = await srv.abrir();
  ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }); page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let visto = null;
  await fakeGoogle(page, { visto: u => { visto = u; } });
  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  ok(await page.isHidden('#appRoot'), 'sin sesión solo se ve el ingreso');
  await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])');
  ok(visto && visto.searchParams.get('redirect_uri') === URL && visto.searchParams.get('client_id') === 'cliente-de-prueba.apps.googleusercontent.com' && visto.searchParams.get('response_type') === 'id_token', 'fue a Google con el cliente y la dirección de retorno de la app');
  ok(visto.searchParams.get('state').length === 32 && visto.searchParams.get('nonce').length === 32 && visto.searchParams.get('state') !== visto.searchParams.get('nonce'), 'con state y nonce al azar');
  ok(page.url() === URL, 'al volver, el token no queda en la dirección: ' + page.url());
  ok((await page.evaluate(() => history.length)) >= 1 && (await page.evaluate(() => localStorage.getItem('pan.ingreso'))) === null, 'lo guardado para el ingreso se borra al usarlo');
  ok((await page.textContent('#view h1')).trim() === 'Hola, Rosa', 'entra a Inicio y saluda por el nombre');
  ok((await page.evaluate(() => window.__fakeAuth.opciones.popupRedirectResolver)) === undefined && (await page.evaluate(() => window.__fakeAuth.opciones.persistence.length)) === 2, 'Firebase se inicia sin ventanas emergentes ni marcos, con la sesión guardada en el equipo');
  await page.reload(); await page.waitForSelector('#appRoot:not([hidden])');
  ok(true, 'al recargar la sesión sigue iniciada');

  console.log('3. Navegación, «Más» y diagnóstico');
  await page.click('#nav button[data-tab="mas"]');
  ok((await page.textContent('.more-head .who')).includes('rosa@example.com') && (await page.textContent('.av')).trim() === 'RD', 'muestra la cuenta (nombre, correo e iniciales)');
  ok((await page.getAttribute('#nav button[data-tab="mas"]', 'aria-current')) === 'page', 'la barra marca la sección actual');
  await page.waitForFunction(() => /última versión/.test(document.getElementById('updCard').textContent));
  ok(true, '«Buscar actualización» responde: ya tienes la última versión');
  await page.click('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  const diag = await page.textContent('#diag');
  ok(/En el navegador/.test(diag) && /rosa@example\.com/.test(diag) && /Google, por redirección/.test(diag) && /Bloqueos de seguridad0/.test(diag), 'diagnóstico: modo, sesión, ingreso y cero bloqueos');
  await page.click('[data-act="cerrar-hoja"]'); ok(!(await page.evaluate(() => document.getElementById('dlg').open)), 'la hoja se cierra');
  await page.click('#gear'); ok((await page.textContent('#view h1')).trim() === 'Cuenta y ajustes', 'el botón de la cabecera lleva a «Más»');

  console.log('4. Cerrar sesión');
  await page.click('[data-act="salir"]'); await page.waitForSelector('dialog.cfm[open]');
  await page.click('dialog.cfm [data-r="0"]'); ok(await page.isVisible('#appRoot'), 'cancelar deja la sesión abierta');
  await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle');
  ok(await page.isHidden('#appRoot') && (await page.evaluate(() => document.getElementById('view').textContent + document.getElementById('nav').textContent)) === '', 'al cerrar sesión vuelve el ingreso y no queda nada de la cuenta en la página');
  await page.reload(); await page.waitForSelector('#btnGoogle'); ok(true, 'y al recargar sigue cerrada');

  console.log('5. Respuestas falsas o canceladas');
  const intento = async (o, espera) => {
    await fakeGoogle(page, o); await page.goto(URL); await page.waitForSelector('#btnGoogle');
    await page.click('#btnGoogle'); await page.waitForSelector('.form-error');
    const t = (await page.textContent('.form-error')).trim();
    return espera.test(t) && await page.isHidden('#appRoot') && page.url() === URL;
  };
  ok(await intento({ state: 'x'.repeat(32) }, /no corresponde/), 'state que no es el de este ingreso: no entra');
  ok(await intento({ nonce: 'y'.repeat(32) }, /no corresponde/), 'token con otro nonce: no entra');
  ok(await intento({ error: 'access_denied' }, /canceló/), 'ingreso cancelado en Google: avisa y no entra');
  ok(await intento({ rechazar: true }, /Firebase no aceptó/), 'token que Firebase rechaza: avisa y no entra');
  await page.goto('about:blank'); await page.goto(URL + '#state=abc&id_token=a.b.c'); await page.waitForSelector('.form-error');
  ok(/no comenzó/.test(await page.textContent('.form-error')) && page.url() === URL, 'un enlace con token pegado (sin haber comenzado aquí) no entra y se limpia');
  await ctx.setOffline(true); await page.click('#btnGoogle'); await page.waitForSelector('.form-error');
  ok(/Sin conexión/.test(await page.textContent('.form-error')), 'sin internet avisa en vez de salir a Google'); await ctx.setOffline(false);
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

  console.log('6. Escritorio');
  const p2 = await (await br.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  await fakeGoogle(p2); await p2.goto(URL); await p2.click('#btnGoogle'); await p2.waitForSelector('#appRoot:not([hidden])');
  const nav = await p2.evaluate(() => { const r = document.getElementById('nav').getBoundingClientRect(), v = document.getElementById('view').getBoundingClientRect(); return { w: r.width, left: r.left, vl: v.left }; });
  ok(nav.left === 0 && nav.w === 248 && nav.vl >= 248, 'en pantalla ancha la navegación va al costado y el contenido a la derecha');

  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
