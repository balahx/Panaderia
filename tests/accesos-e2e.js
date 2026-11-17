/* Accesos de punta a punta (con dobles de Firebase, Google y Firestore): primer paso de configuración, pedir acceso, espera,
   aprobar con perfil, rechazar, cambiar perfil, quitar y devolver, lo que ve cada perfil, peticiones directas, sin conexión,
   cierre de sesión y App Check. Las reglas reales las prueba el emulador (tests/rules-emulator.js). Uso: node tests/accesos-e2e.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const INTRUSO = { sub: '4004', email: 'intruso@example.com', name: 'Otra Persona' }, NORA = { sub: '5005', email: 'nora@example.com', name: 'Nora Paz' };

(async () => {
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const entrar = async (quien, espera) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(espera); };
  const salir = async () => { await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const tocar = async sel => { await page.click(sel); };
  const confirmar = async () => { await page.waitForSelector('dialog.cfm[open]'); await page.click('dialog.cfm [data-r="1"]'); };
  const aviso = async re => { await page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source); };

  console.log('1. Primer paso de configuración (aún no existe config/negocio)');
  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(() => localStorage.setItem('fake.db', '{}'));
  await entrar(FELIPE, '#sinNegocio');
  ok(await page.isHidden('#appRoot') && (await page.textContent('#miUid')) === 'u-2002', 'sin el documento de los dueños nadie entra; la pantalla muestra el identificador de la cuenta');
  ok(/paso 14/.test(await page.textContent('#sinNegocio')), 'y dice dónde está el paso en la guía');
  await db('poner', 'config/negocio', { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 });
  await page.waitForSelector('#pedir'); ok(true, 'al crearse el documento (en la consola), la pantalla cambia sola a «Pedir acceso»');

  console.log('2. Pedir acceso y esperar');
  ok((await page.inputValue('#solNombre')) === 'Felipe Externo', 'el nombre viene de la cuenta de Google y se puede corregir');
  await page.fill('#solNombre', ' '); await tocar('[data-act="pedir"]');
  ok(/al menos 2 letras/.test(await page.textContent('#solError')) && (await db('leer', 'solicitudes/u-2002')) === null, 'sin nombre no se envía');
  await page.fill('#solNombre', '  Felipe   González '); await page.press('#solNombre', 'Enter'); await page.waitForSelector('#espera');
  const s1 = await db('leer', 'solicitudes/u-2002');
  ok(s1 && s1.nombre === 'Felipe González' && s1.correo === 'felipe@example.com' && typeof s1.creado === 'number' && Object.keys(s1).length === 3, 'la solicitud guarda nombre, correo de Google y la hora del servidor (nada más)');
  ok(await page.isHidden('#appRoot') && (await page.textContent('#view')) === '', 'mientras espera no ve nada de la app');
  await page.reload(); await page.waitForSelector('#espera'); ok(true, 'al reabrir sigue en espera');
  await tocar('[data-act="retirar"]'); await confirmar(); await page.waitForSelector('#pedir');
  ok((await db('leer', 'solicitudes/u-2002')) === null, 'puede retirar su solicitud');
  await page.fill('#solNombre', 'Felipe González'); await tocar('[data-act="pedir"]'); await page.waitForSelector('#espera'); await salir();
  await entrar(TABLET, '#pedir'); await tocar('[data-act="pedir"]'); await page.waitForSelector('#espera'); await salir();
  await entrar(INTRUSO, '#pedir'); await tocar('[data-act="pedir"]'); await page.waitForSelector('#espera'); await salir();

  console.log('3. La dueña revisa las solicitudes');
  await entrar({}, '#appRoot:not([hidden])');
  await page.waitForSelector('#avisoAccesos');
  ok(/3 solicitudes de acceso por revisar/.test(await page.textContent('#avisoAccesos')), 'en Inicio hay un aviso con las solicitudes por revisar');
  ok((await page.getAttribute('#view', 'data-tab')) === 'inicio' && /Hola, Rosa/.test(await page.textContent('#hoySaludo')) && (await page.locator('#nav button').allTextContents()).join() === 'Hoy,Entregas,Pesaje,Más', 'la dueña entra a «Hoy»; la barra tiene Hoy, Entregas, Pesaje y Más');
  await tocar('#nav button[data-tab="mas"]');
  ok((await page.textContent('#miPerfil')) === 'Dueño' && /3 por revisar/.test(await page.textContent('#irAccesos')), '«Más» muestra el perfil y la entrada a Accesos con el número pendiente');
  await tocar('#irAccesos'); await page.waitForSelector('#secSolicitudes .persona');
  ok((await page.locator('#secSolicitudes .persona').count()) === 3 && /Felipe González/.test(await page.textContent('#secSolicitudes')) && /felipe@example\.com/.test(await page.textContent('#secSolicitudes')), 've las tres solicitudes con nombre y correo');
  ok((await page.getAttribute('#nav button[data-tab="mas"]', 'aria-current')) === 'page' && await page.isHidden('#avisoAccesos').catch(() => true), 'Accesos cuelga de «Más» y ahí no se repite el aviso');
  await tocar('[data-uid="u-2002"] [data-act="acc-elegir"]'); await page.waitForSelector('#dlg[open] .opcion');
  ok((await page.locator('#dlg .opcion').count()) === 2 && !/Dueño/.test(await page.textContent('#dlg .sheet-b')), 'al aprobar se elige entre Externo y Pesaje (no hay «Dueño»)');
  await tocar('#dlg .opcion[data-perfil="externo"]'); await confirmar(); await aviso(/Felipe González ya tiene acceso \(Externo\)/);
  const m1 = await db('leer', 'miembros/u-2002');
  ok(m1 && m1.perfil === 'externo' && m1.activo === true && m1.por === 'u-1001' && typeof m1.en === 'number' && (await db('leer', 'solicitudes/u-2002')) === null, 'queda la ficha (perfil, quién aprobó, cuándo) y se borra la solicitud');
  await tocar('[data-uid="u-3003"] [data-act="acc-elegir"]'); await tocar('#dlg .opcion[data-perfil="pesaje"]'); await confirmar(); await aviso(/Tablet Panadería ya tiene acceso \(Pesaje\)/);
  await tocar('[data-uid="u-4004"] [data-act="acc-rechazar"]'); await confirmar(); await aviso(/Solicitud rechazada/);
  await page.waitForFunction(() => !document.querySelector('#secSolicitudes .persona'));
  ok((await db('leer', 'solicitudes/u-4004')) === null && (await db('leer', 'miembros/u-4004')) === null && /Sin solicitudes/.test(await page.textContent('#secSolicitudes')), 'rechazar borra la solicitud y no da acceso');
  ok((await page.locator('#secMiembros .persona').count()) === 3 && /Externo/.test(await page.textContent('#secMiembros [data-uid="u-2002"]')) && /Pesaje/.test(await page.textContent('#secMiembros [data-uid="u-3003"]')), 'la lista «Con acceso» muestra a la dueña y a los dos aprobados con su perfil');

  console.log('4. Cambiar perfil, quitar y devolver el acceso');
  await tocar('[data-uid="u-3003"] [data-act="acc-ver"]'); await page.waitForSelector('#dlg[open] .opcion');
  ok(await page.isDisabled('#dlg .opcion[data-perfil="pesaje"]'), 'el perfil actual aparece marcado');
  await tocar('#dlg .opcion[data-perfil="externo"]'); await confirmar(); await aviso(/ahora es Externo/);
  ok((await db('leer', 'miembros/u-3003')).perfil === 'externo', 'cambia el perfil');
  await tocar('[data-uid="u-3003"] [data-act="acc-ver"]'); await tocar('#dlg .opcion[data-perfil="pesaje"]'); await confirmar(); await aviso(/ahora es Pesaje/);
  await tocar('[data-uid="u-2002"] [data-act="acc-ver"]'); await tocar('#dlg [data-act="acc-quitar"]'); await confirmar(); await aviso(/Se quitó el acceso a Felipe/);
  await page.waitForSelector('#secSinAcceso [data-uid="u-2002"]');
  const m2 = await db('leer', 'miembros/u-2002');
  ok(m2.activo === false && m2.perfil === 'externo' && m2.nombre === 'Felipe González', 'quitar el acceso lo desactiva sin borrar la ficha');
  await tocar('#secSinAcceso [data-act="acc-ver"]'); await tocar('#dlg [data-act="acc-devolver"]'); await aviso(/vuelve a tener acceso/);
  await page.waitForFunction(() => !document.querySelector('#secSinAcceso'));
  ok((await db('leer', 'miembros/u-2002')).activo === true, 'y se le puede devolver');
  await db('poner', 'miembros/u-9', { nombre: 'Persona Antigua', correo: 'antigua@example.com', perfil: 'pesaje', activo: false, por: 'u-1001', en: 1 });
  await page.waitForSelector('#secSinAcceso [data-uid="u-9"]');
  await tocar('#secSinAcceso [data-act="acc-ver"]'); await tocar('#dlg [data-act="acc-borrar"]'); await confirmar(); await aviso(/Ficha borrada/);
  ok((await db('leer', 'miembros/u-9')) === null, 'una ficha sin acceso se puede borrar de la lista');
  await tocar('.volver'); await salir();

  console.log('5. Externo: todo salvo accesos');
  await entrar(FELIPE, '#appRoot:not([hidden])');
  ok((await page.getAttribute('#view', 'data-tab')) === 'inicio' && !(await page.$('#avisoAccesos')), 'el externo entra a «Hoy» y sin avisos de solicitudes');
  await tocar('#nav button[data-tab="mas"]');
  ok((await page.textContent('#miPerfil')) === 'Externo' && !(await page.$('#irAccesos')), '«Más» no le ofrece Accesos');
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'ir'; b.dataset.tab = 'accesos'; b.id = 'trampa'; document.getElementById('view').appendChild(b); b.click(); });
  ok((await page.getAttribute('#view', 'data-tab')) === 'mas' && !(await page.$('#secSolicitudes')), 'forzar la pantalla de Accesos no la abre');
  ok((await db('pedir', 'list', 'miembros')) === false && (await db('pedir', 'list', 'solicitudes')) === false && (await db('pedir', 'set', 'miembros/u-2002', { nombre: 'Felipe', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-2002', en: { __ts: true } })) === false, 'ni con peticiones directas lee o cambia accesos');
  ok((await db('pedir', 'list', 'precios')) === true && (await db('pedir', 'list', 'pesajes')) === true, 'sí puede leer precios y pesajes');
  await tocar('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  const diag = await page.textContent('#diag');
  ok(/PerfilExterno/.test(diag) && /Identificador \(UID\)u-2002/.test(diag) && /DatosCon copia sin conexión/.test(diag) && /App CheckSin configurar/.test(diag) && /Bloqueos de seguridad0/.test(diag), 'diagnóstico: perfil, identificador, copia sin conexión y App Check');
  ok((await page.evaluate(() => window.__fakeFs.opciones.localCache.tipo)) === 'persistente' && (await page.evaluate(() => window.__fakeFs.opciones.localCache.o.tabManager.tipo)) === 'varias-pestañas', 'Firestore se inicia con su caché sin conexión, para varias pestañas');
  await tocar('[data-act="cerrar-hoja"]');

  console.log('6. Sin conexión y cierre de sesión');
  await db('fuera', true); await page.reload(); await page.waitForSelector('#appRoot:not([hidden])');
  ok((await page.getAttribute('#view', 'data-tab')) === 'inicio' && !!(await page.$('#nav button[data-tab="pesaje"]')), 'sin conexión, la app abre con el perfil guardado en el equipo');
  await db('fuera', false);
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('fake.cache') || '[]').length)) > 0, 'hay copia de datos en el equipo');
  await tocar('#nav button[data-tab="mas"]'); await salir();
  ok((await page.evaluate(() => localStorage.getItem('fake.cache'))) === null, 'al cerrar sesión se borra la copia de datos del equipo');
  await page.evaluate(() => localStorage.setItem('fake.fuera', '1'));
  await entrar(NORA, '#comprobando');
  await page.waitForTimeout(500);
  ok(await page.isVisible('#comprobando') && !(await page.$('#pedir')) && await page.isHidden('#appRoot'), 'una cuenta nueva sin conexión queda en «Comprobando» (no se concluye nada sin el servidor)');
  await db('fuera', false); await page.waitForSelector('#pedir'); ok(true, 'y al volver la conexión sigue sola');

  console.log('7. Pesaje: aprobación en vivo y lo que no puede ver');
  await tocar('[data-act="pedir"]'); await page.waitForSelector('#espera');
  await db('poner', 'miembros/u-5005', { nombre: 'Nora Paz', correo: 'nora@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 });
  await page.waitForSelector('#appRoot:not([hidden])'); await aviso(/Tu acceso fue aprobado/);
  ok((await page.getAttribute('#view', 'data-tab')) === 'pesaje' && (await page.locator('#nav button').allTextContents()).join() === 'Pesaje,Más' && (await page.getAttribute('html', 'data-escala')) === 'grande', 'cuando un dueño aprueba, la espera pasa sola a la pantalla de pesaje (solo Pesaje y Más, letra grande)');
  await tocar('#nav button[data-tab="mas"]');
  ok((await page.textContent('#miPerfil')) === 'Pesaje' && !(await page.$('#irAccesos')), 'la cuenta de pesaje no ve Accesos');
  await db('poner', 'precios/pr1', { productoId: 'p1', clienteId: 'c1', neto: 1450, desde: '2026-01-01', en: 1 });
  await db('poner', 'productos/p1', { nombre: 'Marraqueta', unidad: 'kg', activo: true, en: 1 });
  ok((await db('pedir', 'get', 'precios/pr1')) === false && (await db('pedir', 'list', 'precios')) === false && (await db('pedir', 'list', 'clientes')) === false && (await db('pedir', 'list', 'cierres')) === false, 'con peticiones directas NO lee precios, clientes ni cierres');
  ok((await db('pedir', 'list', 'productos')) === true && (await db('pedir', 'list', 'trabajadores')) === true, 'sí lee productos y trabajadores');
  ok(!/1450|1\.450/.test(await page.evaluate(() => document.body.textContent)), 'ningún precio aparece en la pantalla');
  await db('poner', 'miembros/u-5005', { nombre: 'Nora Paz', correo: 'nora@example.com', perfil: 'pesaje', activo: false, por: 'u-1001', en: 2 });
  await page.waitForSelector('#sinAcceso');
  ok(await page.isHidden('#appRoot') && (await page.textContent('#view')) === '' && (await page.textContent('#nav')) === '', 'si un dueño quita el acceso, la app se cierra sola y no queda nada en la página');
  await salir();
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await ctx.close(); srv.close();

  console.log('8. App Check (con clave de sitio en firebase-config.js)');
  const conClave = fs.readFileSync(path.join(__dirname, 'fake-firebase', 'firebase-config.js'), 'utf8').replace("appCheckSiteKey = ''", "appCheckSiteKey = 'clave-recaptcha-de-prueba'");
  const js = t => (q, r) => { r.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); r.end(t); };
  for (const [caso, rutas, espera, clave] of [
    ['con el SDK', { '/firebase-config.js': js(conClave) }, /App CheckActivo/, 'clave-recaptcha-de-prueba'],
    ['sin el SDK de App Check', { '/firebase-config.js': js(conClave), '/vendor/firebase/firebase-app-check.js': (q, r) => { r.writeHead(404); r.end(); } }, /App CheckFalta el SDK/, null]]) {
    const s2 = crear({ fake: true, rutas }), U2 = await s2.abrir();
    const c2 = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }), p2 = await c2.newPage();
    await fakeGoogle(p2); await p2.goto(U2); await p2.click('#btnGoogle'); await p2.waitForSelector('#appRoot:not([hidden])');
    await p2.click('#nav button[data-tab="mas"]'); await p2.click('[data-act="diag"]'); await p2.waitForSelector('#dlg[open] #diag');
    const ac = await p2.evaluate(() => window.__fakeAppCheck || null);
    ok(espera.test(await p2.textContent('#diag')) && (clave ? ac && ac.clave === clave && ac.renovar === true : ac === null), caso + ': ' + (clave ? 'App Check se activa con la clave y renueva solo' : 'la app entra igual y el diagnóstico lo avisa'));
    await c2.close(); s2.close();
  }
  await br.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
