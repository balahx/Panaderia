/* Pesaje y entregas de punta a punta (con dobles de Firebase, Google y Firestore): la tablet elige quién pesa, registra canastos en
   3 toques (kilos y unidades, aviso sobre 20 kg, nota, teclado físico), cierra y vuelve a abrir entregas, corrige y anula con constancia,
   trabaja SIN CONEXIÓN (lo anotado aparece en el equipo del dueño al volver internet) y no ve precios. Luego el dueño ve «Hoy» en vivo,
   con montos del precio vigente, entregas, otro día y corrección. Las reglas reales las prueba el emulador. Uso: node tests/pesaje-e2e.js */
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' }, FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), AYER = dia(Date.now() - 86400000), ANTES = dia(Date.now() - 3 * 86400000);
const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true, en: 1 },
  'productos/p2': { nombre: 'Hallulla', unidad: 'kg', orden: 2, activo: true, en: 1 },
  'productos/p3': { nombre: 'Pan de completo', unidad: 'un', pesoRef: 100, orden: 3, activo: true, en: 1 },
  'productos/p4': { nombre: 'Colisa', unidad: 'kg', orden: 4, activo: false, en: 1 },
  'precios/p1_c1_2026-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2026-01-01', en: 1 },
  'precios/p3_c1_2026-01-01': { productoId: 'p3', clienteId: 'c1', neto: 250, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 }, 'trabajadores/t2': { nombre: 'Ana', activo: true, en: 1 }, 'trabajadores/t3': { nombre: 'Marta', activo: false, en: 1 },
  'pesajes/ayer1': { fecha: AYER, hora: '06:00', entregaN: 1, productoId: 'p1', cantidad: 10, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: 1 } };

(async () => {
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 800, height: 1100 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const entrar = async quien => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const deHoy = async () => (await docs('pesajes')).filter(p => p.fecha === HOY).sort((a, b) => a.en - b.en);
  const ultimo = async () => (await deHoy()).pop();
  const tocar = sel => page.click(sel);
  const confirmar = async si => { await page.waitForSelector('dialog.cfm[open]'); await page.click('dialog.cfm [data-r="' + (si === false ? 0 : 1) + '"]'); await page.waitForSelector('dialog.cfm', { state: 'detached' }); };
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const pan = nombre => tocar('#pesPanes .pes-op:has(b:text-is("' + nombre + '"))');
  const teclas = async s => { for (const k of s) await tocar('#pesTeclado [data-k="' + k + '"]'); };
  const valor = () => page.textContent('#pesValor');
  const nCanastos = async n => page.waitForFunction(n => document.querySelectorAll('#listaPesajes .pes-fila').length === n, n);

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. La tablet: solo pesaje, letra grande y quién pesa');
  await entrar(TABLET);
  await page.waitForSelector('#pesQuien');
  ok((await page.getAttribute('#view', 'data-tab')) === 'pesaje' && (await page.getAttribute('html', 'data-escala')) === 'grande', 'entra directo a la pantalla de pesaje, con letra grande');
  ok((await page.locator('#pesQuien .pes-op').allTextContents()).join() === 'Ana,Luis', 'pregunta quién pesa, solo con los trabajadores activos');
  await tocar('#pesQuien .pes-op:has-text("Luis")'); await page.waitForSelector('#pesQuienActual');
  ok(/Pesa: Luis/.test(await page.textContent('#pesQuienActual')) && (await page.evaluate(() => localStorage.getItem('pan.pesador'))) === 't1', 'queda elegido en el equipo');
  ok((await page.locator('#pesPanes .pes-op b').allTextContents()).join() === 'Marraqueta,Hallulla,Pan de completo', 'los panes activos, en el orden del catálogo');
  ok(/N\.º 1/.test(await page.textContent('#pesEntrega')) && await page.isDisabled('[data-act="pes-cerrar-entrega"]'), 'la entrega en curso es la n.º 1 y no se cierra vacía');
  ok(!(await page.$('#pesTeclado .pes-tecla')), 'el teclado aparece al elegir el pan');

  console.log('2. Un canasto en 3 toques');
  await pan('Marraqueta'); await teclas('9'); await tocar('#pesGuardar');
  await aviso(/Guardado: Marraqueta 9,00 kg/); await nCanastos(1);
  const c1 = await ultimo();
  ok(c1 && c1.fecha === HOY && /^\d\d:\d\d$/.test(c1.hora) && c1.entregaN === 1 && c1.productoId === 'p1' && c1.cantidad === 9 && c1.unidad === 'kg' && c1.trabajadorId === 't1' && c1.anulado === false && c1.creadoPor === 'u-3003' && typeof c1.en === 'number',
    'pan → número → Guardar: queda el canasto con día, hora, entrega, pan, kilos, quién pesó, cuenta y hora del servidor');
  ok((await page.getAttribute('#pesPanes .pes-op:has(b:text-is("Marraqueta"))', 'aria-pressed')) === 'true' && (await valor()) === '0 kg', 'el pan sigue elegido para el canasto siguiente (2 toques más)');
  ok(/1 canasto · 9,00 kg/.test(await page.textContent('#pesTotales')) && /Luis · Entrega 1/.test(await page.textContent('#listaPesajes')), '«Pesado hoy» suma el canasto y dice quién pesó');

  console.log('3. Kilos con decimales, aviso sobre 20 kg y confirmación de lo absurdo');
  await teclas(['2', '1', ',', '5', '7', '9']);
  ok((await valor()) === '21,57 kg' && /Más de 20 kg/.test(await page.textContent('#pesAviso')) && await page.isEnabled('#pesGuardar'), 'dos decimales como máximo; sobre 20 kg avisa sin bloquear');
  await tocar('#pesGuardar'); await nCanastos(2);
  ok((await ultimo()).cantidad === 21.57 && !(await page.$('dialog.cfm[open]')), 'se guarda sin preguntar');
  await teclas(['1', '2', '5']); await tocar('#pesGuardar'); await confirmar(false);
  ok((await deHoy()).length === 2 && (await valor()) === '125 kg', '125 kg pide confirmar; «Corregir» no guarda y deja el número para arreglarlo');
  await teclas(['borrar', 'borrar']);
  ok((await valor()) === '1 kg', 'el botón ⌫ borra el último número');
  await teclas(['borrar']);
  ok(await page.isDisabled('#pesGuardar'), 'vacío no se puede guardar');
  ok(/Escribe los kilos del canasto/.test(await page.textContent('#pesGuardarMotivo')) && (await page.getAttribute('#pesGuardar', 'aria-describedby')) === 'pesGuardarMotivo', 'deshabilitado, dice qué falta y el botón lo enlaza (Fase 13, parte B)');

  console.log('4. Unidades, nota y teclado físico');
  await pan('Pan de completo');
  ok(!(await page.$('#pesTeclado [data-k=","]')) && !!(await page.$('#pesTeclado [data-k="limpiar"]')) && /Unidades de Pan de completo/.test(await page.textContent('#pesTeclado')), 'por unidad el teclado no tiene coma');
  await teclas(['1', '2', '0']); await tocar('#pesNota'); await page.waitForSelector('#pNota');
  await page.fill('#pNota', '  canasto   chico '); await tocar('[data-act="pes-nota-guardar"]'); await cerrada();
  ok(/Nota: canasto chico/.test(await page.textContent('#pesNota')) && (await valor()) === '120 un', 'la nota queda lista para este canasto, sin perder el número');
  await tocar('#pesGuardar'); await nCanastos(3);
  const c3 = await ultimo();
  ok(c3.cantidad === 120 && c3.unidad === 'un' && c3.nota === 'canasto chico' && /Agregar nota/.test(await page.textContent('#pesNota')), 'se guarda en unidades, con la nota (y la nota no pasa al siguiente)');
  await pan('Hallulla'); await page.click('h1'); await page.keyboard.type('7.25');
  ok((await valor()) === '7,25 kg', 'con un teclado físico se escribe el número (el punto vale como coma)');
  await page.keyboard.press('Enter'); await nCanastos(4);
  ok((await ultimo()).cantidad === 7.25 && (await ultimo()).productoId === 'p2', 'y Enter guarda');

  console.log('5. Entregas');
  ok(/N\.º 1/.test(await page.textContent('#pesEntrega')) && /4 canastos/.test(await page.textContent('#pesEntrega')), 'la entrega en curso suma sus canastos');
  await tocar('[data-act="pes-cerrar-entrega"]'); await page.waitForSelector('dialog.cfm[open]');
  ok(/n\.º 1/.test(await page.textContent('dialog.cfm')) && /irán a la entrega n\.º 2/.test(await page.textContent('dialog.cfm')), 'cerrar la entrega pide confirmar y explica qué sigue');
  await confirmar(); await aviso(/Entrega n\.º 1 cerrada/);
  await page.waitForFunction(() => /N\.º 2/.test(document.getElementById('pesEntrega').textContent));
  const d1 = await db('leer', 'dias/' + HOY);
  ok(d1 && d1.entregaN === 2 && d1.por === 'u-3003' && /Sin canastos todavía/.test(await page.textContent('#pesEntrega')), 'pasa a la entrega n.º 2 (queda en el día, a nombre de la tablet)');
  await tocar('[data-act="pes-reabrir"]'); await confirmar();
  await page.waitForFunction(() => /N\.º 1/.test(document.getElementById('pesEntrega').textContent));
  ok((await db('leer', 'dias/' + HOY)).entregaN === 1, 'si se cerró por error y no hay canastos nuevos, se vuelve a abrir la anterior');
  await tocar('[data-act="pes-cerrar-entrega"]'); await confirmar();
  await page.waitForFunction(() => /N\.º 2/.test(document.getElementById('pesEntrega').textContent));
  await pan('Marraqueta'); await teclas(['1', '5']); await tocar('#pesGuardar'); await nCanastos(5);
  ok((await ultimo()).entregaN === 2 && !(await page.$('[data-act="pes-reabrir"]')), 'el canasto siguiente va a la entrega n.º 2 (y ya no se reabre la anterior)');

  console.log('6. Corregir y anular lo del día, con constancia');
  await tocar('#listaPesajes .pes-fila:first-child'); await page.waitForSelector('#dlg[open] #canDetalle');
  ok(/15,00 kg/.test(await page.textContent('#canDetalle')) && /N\.º 2/.test(await page.textContent('#canDetalle')), 'tocar un canasto muestra su ficha');
  await tocar('#dlg [data-act="can-corregir"]'); await page.waitForSelector('#cCant');
  await page.fill('#cCant', '14,5'); await page.selectOption('#cQuien', 't2'); await page.selectOption('#cEntrega', '1');
  await tocar('#dlg [data-act="can-guardar"]'); await cerrada(); await aviso(/Canasto corregido/);
  const c5 = await ultimo(), k1 = (await docs('cambios'))[0];
  ok(c5.cantidad === 14.5 && c5.trabajadorId === 't2' && c5.entregaN === 1 && c5.creadoPor === 'u-3003', 'corrige cantidad, quién pesó y entrega');
  ok(k1 && k1.tipo === 'corregir' && k1.pesajeId === c5.id && k1.antes.cantidad === 15 && k1.despues.cantidad === 14.5 && k1.antes.trabajadorId === 't1' && k1.por === 'u-3003' && typeof k1.en === 'number', 'y deja constancia de qué cambió, quién y cuándo');
  await tocar('#listaPesajes .pes-fila:first-child'); await tocar('#dlg [data-act="can-corregir"]'); await page.fill('#cCant', 'mucho'); await tocar('#dlg [data-act="can-guardar"]');
  ok(/Escribe los kilos/.test(await page.textContent('#dlg .form-error')), 'una cantidad que no es número no se guarda');
  await page.fill('#cCant', '14,5'); await tocar('#dlg [data-act="can-guardar"]'); await cerrada(); await aviso(/Sin cambios/);
  ok((await docs('cambios')).length === 1, 'si no cambia nada, no hay constancia');
  await tocar('#listaPesajes .pes-fila:first-child'); await tocar('#dlg [data-act="can-anular"]'); await confirmar(); await aviso(/Canasto anulado/);
  await page.waitForSelector('#listaPesajes .pes-fila.anulado');
  ok((await ultimo()).anulado === true && /4 canastos/.test(await page.textContent('#pesTotales')) && (await docs('cambios')).some(k => k.tipo === 'anular'), 'anular no borra: queda marcado, deja de sumar y queda constancia');
  await tocar('#listaPesajes .pes-fila.anulado'); await tocar('#dlg [data-act="can-reactivar"]'); await aviso(/Canasto reactivado/);
  await page.waitForFunction(() => !document.querySelector('#listaPesajes .pes-fila.anulado'));
  ok((await ultimo()).anulado === false && (await docs('cambios')).length === 3, 'y se puede reactivar');

  console.log('7. Sin conexión (Listo cuando: lo anotado sin internet aparece al volver)');
  await db('fuera', true); await ctx.setOffline(true);
  await page.waitForSelector('#netBar:not([hidden])');
  await pan('Marraqueta'); await teclas(['1', '1']); await tocar('#pesGuardar');
  await aviso(/se enviará al volver internet/); await nCanastos(6);
  ok(/Por enviar/.test(await page.textContent('#listaPesajes .pes-fila:first-child')) && await page.isVisible('#pesPendientes'), 'el canasto se ve al instante, marcado «Por enviar»');
  ok((await deHoy()).length === 5, 'todavía no llegó al servidor');
  await tocar('[data-act="pes-cerrar-entrega"]'); await confirmar();
  await page.waitForFunction(() => /N\.º 3/.test(document.getElementById('pesEntrega').textContent));
  ok(true, 'sin conexión también se cierra la entrega');
  await tocar('#nav button[data-tab="mas"]'); await tocar('[data-act="salir"]'); await page.waitForSelector('dialog.cfm[open]');
  ok(/Hay datos sin enviar/.test(await page.textContent('dialog.cfm')), 'cerrar sesión con datos sin enviar avisa que se perderían');
  await confirmar(false);
  ok(!!(await page.$('#appRoot:not([hidden])')) && (await db('pendientes')).length === 2, '«Esperar» no cierra la sesión ni pierde nada');
  await ctx.setOffline(false); await db('fuera', false);
  await tocar('#nav button[data-tab="pesaje"]');
  await page.waitForFunction(() => !document.querySelector('#pesPendientes'));
  const c6 = await ultimo();
  ok((await deHoy()).length === 6 && c6.cantidad === 11 && c6.entregaN === 2 && c6.creadoPor === 'u-3003' && (await db('leer', 'dias/' + HOY)).entregaN === 3, 'al volver internet se envía solo: el canasto y el cierre llegan al servidor');

  console.log('8. Lo que la tablet no puede');
  ok(!/\$\s?\d/.test(await page.evaluate(() => document.body.textContent)), 'ningún precio aparece en la pantalla');
  const copia = await db('cache');
  ok(!copia.some(r => /^(precios|cambios)\//.test(r)), 'la app de la tablet no pide precios ni la bitácora (los clientes sí desde la Fase 11: sin montos)');
  const ajeno = { fecha: ANTES, hora: '06:00', entregaN: 1, productoId: 'p1', cantidad: 5, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: { __ts: true } };
  /* Para «no corrige los de otro día» se usa un canasto de hace tres días: entre las 00:00 y las 00:59 (y de 23:00 a 23:59 en invierno) las reglas
     aceptan dos fechas como «hoy» (no conocen la zona horaria: ver esHoy en firestore.rules), así que uno de AYER puede valer a esa hora. */
  await db('poner', 'pesajes/antes1', Object.assign({}, SEMILLA['pesajes/ayer1'], { fecha: ANTES }));
  ok((await db('pedir', 'set', 'pesajes/trampa', ajeno)) === false && (await db('pedir', 'list', 'pesajes')) === false && (await db('pedir', 'update', 'pesajes/antes1', Object.assign({}, SEMILLA['pesajes/ayer1'], { fecha: ANTES, cantidad: 99, en: { __ts: true } }))) === false,
    'con peticiones directas no anota en otra fecha, no lista todos los pesajes ni corrige los de días anteriores');
  await db('borrar', 'pesajes/antes1');
  await salir();

  console.log('9. El dueño: «Hoy» en vivo, con montos');
  await entrar();
  await page.waitForSelector('#hoyTotales');
  ok((await page.getAttribute('html', 'data-escala')) === null, 'el dueño usa letra normal');
  ok(/^6(?!\d)/.test(await page.textContent('#hoyTotales .stat:nth-child(1)')) && /63,32/.test(await page.textContent('#hoyTotales')) && /120/.test(await page.textContent('#hoyTotales')), 've los totales del día: 6 canastos, 63,32 kg y 120 un');
  const montos = await page.textContent('#hoyMontos');
  ok(/Sin precio ese día \(no suman\): Hallulla/.test(montos), 'avisa el pan que no tiene precio ese día');
  const marr = 9 + 21.57 + 14.5 + 11, neto = Math.round(1400 * marr) + 120 * 250, iva = Math.round(neto * 0.19);
  ok(montos.includes('$' + neto.toLocaleString('de-DE')) && (await page.textContent('#hoyTotal')).includes('$' + (neto + iva).toLocaleString('de-DE')), 'venta del día con el precio vigente: neto ' + neto + ', total ' + (neto + iva));
  ok((await page.locator('#hoyEntregas .entrega').count()) === 2 && /Cerrada/.test(await page.textContent('#hoyEntregas .entrega[data-n="1"]')) && /Cerrada/.test(await page.textContent('#hoyEntregas .entrega[data-n="2"]')) && /Entrega n\.º 3 en curso/.test(await page.textContent('#hoyEntregas')),
    'las entregas se arman solas con los pesajes (la n.º 3 está en curso, sin canastos)');
  ok(/Ana/.test(await page.textContent('#hoyPorTrabajador')) && /Luis/.test(await page.textContent('#hoyPorTrabajador')), 'y lo pesado por cada trabajador');
  await db('poner', 'pesajes/vivo1', { fecha: HOY, hora: '23:58', entregaN: 3, productoId: 'p2', cantidad: 3, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.now() });
  await page.waitForFunction(() => /^7(?!\d)/.test(document.querySelector('#hoyTotales .stat').textContent));
  ok(/En curso/.test(await page.textContent('#hoyEntregas .entrega[data-n="3"]')), 'un canasto nuevo de la tablet aparece sin recargar, en la entrega en curso');

  console.log('10. Otro día y corrección del dueño');
  await tocar('[data-act="hoy-dia"][data-d="-1"]'); await page.waitForFunction(() => /^Pesado el/.test(document.querySelector('#view h1').textContent));
  await page.waitForSelector('#hoyTotales');
  ok(/^1(?!\d)/.test(await page.textContent('#hoyTotales .stat')) && (await page.textContent('#hoyTotal')).includes('$16.660'), 'el día anterior: su canasto y su monto (10 kg × $1.400 + IVA)');
  await tocar('#hoyEntregas summary'); await tocar('#hoyEntregas .pes-fila'); await tocar('#dlg [data-act="can-corregir"]');
  await page.fill('#cCant', '12'); await tocar('#dlg [data-act="can-guardar"]'); await cerrada();
  ok((await db('leer', 'pesajes/ayer1')).cantidad === 12 && (await docs('cambios')).some(k => k.pesajeId === 'ayer1' && k.por === 'u-1001'), 'el dueño corrige un canasto de otro día, con constancia a su nombre');
  await tocar('[data-act="hoy-dia"][data-d="0"]'); await page.waitForFunction(() => /^Pesado hoy/.test(document.querySelector('#view h1').textContent));
  ok(true, '«Hoy» vuelve al día de hoy');
  await page.fill('#hoyFecha', ANTES); await page.waitForSelector('.empty');
  ok(/Sin pesajes ese día/.test(await page.textContent('#view')), 'se puede ir a una fecha con el calendario');
  await salir();

  console.log('11. El externo también ve «Hoy» y puede pesar');
  await entrar(FELIPE); await page.waitForSelector('#hoyTotales');
  ok((await page.locator('#nav button').allTextContents()).join() === 'Hoy,Entregas,Números,Pesaje,Más' && !!(await page.$('#hoyMontos')), 've Hoy con montos, y las pestañas Entregas, Números y Pesaje');
  await tocar('#nav button[data-tab="pesaje"]'); await page.waitForSelector('#pesPanes');
  ok((await page.getAttribute('html', 'data-escala')) === 'grande' && /Pesa: Luis/.test(await page.textContent('#pesQuienActual')), 'en Pesaje la letra crece (y el equipo recuerda quién pesa)');
  await salir();
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await ctx.close(); srv.close(); await br.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
