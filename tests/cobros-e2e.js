/* Cobros, abonos y cotizaciones de punta a punta (Fase 12), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   datos para documentos; datos de cobro en la ficha del cliente; emitir un cobro semanal (desde la ficha) y uno mensual, con el mismo neto que
   Entregas con el filtro del cliente; el PDF descargado; sin conexión no emite pero sí descarga; abono parcial, «Pagar saldo», pago de más y
   saldo a favor aplicado al cobro siguiente; cambiar el reparto y anular un abono; estado de cuenta en PDF; vencido con su franja; «Cambió
   desde que se emitió» y «Anular y emitir de nuevo»; dos equipos no sacan el mismo número; cotización → cliente con sus precios; Excel con
   «Cobros» y «Abonos»; el externo; la tablet no ve nada. Uso: node tests/cobros-e2e.js */
const fs = require('fs');
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js'), { leer: leerXlsx, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now());
const sumar = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let n = 0;
const pes = (fecha, prod, cant, unidad, cli, mas) => ['pesajes/e' + (++n), Object.assign({ fecha, hora: '05:' + String(10 + n % 50).padStart(2, '0'), entregaN: 1, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.now() - 86400000 }, cli ? { clienteId: cli } : {}, mas || {})];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 }, 'clientes/c2': { nombre: 'Almacén Rosa', activo: true, tipo: 'regular', en: 2 }, 'clientes/cs': { nombre: 'Ventas sueltas', activo: true, tipo: 'suelta', en: 3 },
  'productos/hal': { nombre: 'Hallulla', unidad: 'kg', orden: 1, activo: true, en: 1 }, 'productos/com': { nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true, en: 1 },
  'precios/hal_c1_2026-01-01': { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: '2026-01-01', en: 1 }, 'precios/com_c1_2026-01-01': { productoId: 'com', clienteId: 'c1', neto: 110, desde: '2026-01-01', en: 1 },
  'precios/hal_c2_2026-01-01': { productoId: 'hal', clienteId: 'c2', neto: 1512.61, desde: '2026-01-01', en: 1 }, 'precios/com_c2_2026-01-01': { productoId: 'com', clienteId: 'c2', neto: 120, desde: '2026-01-01', en: 1 },
  'precios/hal_cs_2026-01-01': { productoId: 'hal', clienteId: 'cs', neto: 2000, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 } },
Object.fromEntries([].concat(...Array.from({ length: 21 }, (x, i) => { const f = sumar(HOY, -21 + i); return f < '2026-11-01' ? [] : [pes(f, 'hal', 20 + i / 4, 'kg', i % 3 ? 'c1' : null), pes(f, 'com', 100, 'un', 'c1'),
  pes(f, 'hal', 8.35 + i / 10, 'kg', 'c2'), pes(f, 'com', 40 + i, 'un', 'c2'), pes(f, 'hal', 1.5, 'kg', 'cs', { nota: 'Sra. Marta' })]; }))));

(async () => {
  const V = await import('../APP/js/core/ventas.js'), CB = await import('../APP/js/core/cobros.js'), C = await import('../APP/js/core/catalogo.js'), A = await import('../APP/js/core/abonos.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage();
  const errs = global.__errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async (quien, sel) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(sel || '#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const doc = async ruta => (await db('todo'))[ruta] || null;
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel), hay = async sel => !!(await page.$(sel));
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const descarga = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), tocar(sel)]); return { nombre: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) }; };
  const irMas = async (sel, espera) => { await page.click('#nav button[data-tab="mas"]'); await page.click(sel); await page.waitForSelector(espera); };
  const pdfTexto = b => { const s = Buffer.from(b).toString('latin1'); return [...s.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replace(/\\([0-7]{3}|.)/g, (z, e) => (e.length === 3 ? String.fromCharCode(parseInt(e, 8)) : e))).join('\n'); };
  const esperado = async (cid, desde, hasta, descuento) => { const k = { p: await docs('productos'), pr: await docs('precios'), c: await docs('clientes') };
    return CB.armar(V.deCliente(V.lineas((await docs('pesajes')).filter(p => p.fecha >= desde && p.fecha <= hasta), k.p, k.pr, k.c, 19), cid), { iva: 19, descuento, productos: k.p }); };
  const SEM = CB.ultimoTerminado('semana', HOY).hasta < CB.INICIO ? CB.semanaDe(HOY) : CB.ultimoTerminado('semana', HOY);

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. Datos para documentos');
  await entrar(null, '#view h1');
  await irMas('#irEmpresa', '#empGuardar');
  ok(/faltan la razón social y el RUT/.test(await texto('#empFalta')), 'sin datos, avisa que faltan la razón social y el RUT');
  await page.fill('#emp-razonSocial', 'Panadería Familiar SpA'); await page.fill('#emp-rut', '76.123.456-1'); await tocar('#empGuardar');
  await page.waitForSelector('#empError'); ok(/dígito verificador/.test(await texto('#empError')) && (await page.inputValue('#emp-razonSocial')) === 'Panadería Familiar SpA', 'revisa el dígito verificador del RUT (y no borra lo escrito)');
  await page.fill('#emp-rut', '761234560'); await page.fill('#emp-banco', 'Banco Estado'); await page.fill('#emp-tipoCuenta', 'Cuenta corriente'); await page.fill('#emp-cuenta', '123456789'); await page.fill('#emp-correoAviso', 'pagos@example.com');
  await tocar('#empGuardar'); await aviso(/Datos de la panadería guardados/);
  const emp = await doc('config/empresa');
  ok(emp && emp.rut === '76.123.456-0' && emp.banco === 'Banco Estado' && emp.por === 'u-1001' && emp.quien, 'guardados en config/empresa (RUT con formato, a nombre de quien los guarda)');

  console.log('2. Datos de cobro en la ficha del cliente');
  await irMas('#irCatalogo', '#catCuerpo'); await tocar('[data-act="cat-sub"][data-sub="negocio"]'); await page.waitForSelector('#listaClientes');
  await tocar('[data-act="cat-cli"][data-id="c2"]'); await page.waitForSelector('#cliCobro');
  ok(/\$0/.test(await texto('#cliPorCobrar')) && /Sin datos de cobro/.test(await texto('#cliDatosCobro')), 'la ficha del cliente muestra «Por cobrar» ($0) y que no tiene datos de cobro');
  await tocar('[data-act="cc-datos"][data-id="c2"]'); await page.waitForSelector('#ccRazon');
  await page.fill('#ccRazon', 'Comercial Rosa Ltda.'); await page.fill('#ccRut', '12.345.678-9'); await tocar('[data-act="cc-guardar"]');
  ok(/dígito verificador/.test(await texto('#dlg .form-error')), 'el RUT del cliente también se revisa');
  await page.fill('#ccRut', '12.345.678-5'); await page.fill('#ccContacto', 'Rosa · +56 9 1111 2222'); await page.check('input[name="ccPeriodo"][value="semana"]');
  await page.check('input[name="ccTipo"][value="pct"]'); await page.fill('#ccValor', '5'); await page.fill('#ccTexto', 'Descuento familia 5 %'); await tocar('[data-act="cc-guardar"]'); await cerrada(); await aviso(/Datos de cobro de Almacén Rosa guardados/);
  const dc = await doc('clientesCobro/c2');
  ok(dc && dc.rut === '12.345.678-5' && dc.periodo === 'semana' && dc.plazo === 7 && dc.descuento && dc.descuento.valor === 5 && !(await doc('clientes/c2')).rut, 'guardados en clientesCobro (aparte de clientes, que lee la tablet): semanal, 7 días, 5 %');

  console.log('3. Cobro semanal desde la ficha del cliente');
  await tocar('[data-act="cat-cli"][data-id="c2"]'); await page.waitForSelector('#cliCobro');
  await tocar('#cliCobro [data-abrir="nuevo"]'); await page.waitForSelector('#cnTotal');
  const e1 = await esperado('c2', SEM.desde, SEM.hasta, { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' });
  ok((await page.inputValue('#cnCliente')) === 'c2' && (await page.getAttribute('[data-act="cn-tipo"][data-v="semana"]', 'aria-pressed')) === 'true' && (await page.inputValue('#cnSemana')) === SEM.desde, 'abre con el cliente, su período habitual (la semana pasada) y su descuento');
  ok((await texto('#cnTotal')) === C.pesos(e1.total) && e1.neto === V.totales(V.deCliente(V.lineas((await docs('pesajes')).filter(p => p.fecha >= SEM.desde && p.fecha <= SEM.hasta), await docs('productos'), await docs('precios'), await docs('clientes'), 19), 'c2')).neto,
    'la vista previa da el total esperado (' + C.pesos(e1.total) + '), con el neto de Entregas con el filtro del cliente');
  ok(/Descuento familia 5 %/.test(await texto('#cnTotales')) && (e1.ajuste === 0 || /Ajuste por redondeo/.test(await texto('#cnTotales'))), 'muestra el descuento y, si hace falta, el ajuste por redondeo');
  await tocar('#cnEmitir'); await aviso(/Cobro N.º 0001 emitido/);
  await page.waitForSelector('#cfFicha[data-n="1"]');
  const c1 = await doc('cobros/0001'), f1 = await doc('config/folios');
  ok(c1 && c1.numero === 1 && c1.clienteId === 'c2' && c1.total === e1.total && c1.netoFinal === e1.netoFinal && c1.desde === SEM.desde && c1.emisor.rut === '76.123.456-0' && c1.cliente.razonSocial === 'Comercial Rosa Ltda.' && f1.cobro === 1,
    'emitido con el folio 1: total, cliente y panadería de ese momento');
  ok(c1.vence === CB.vence(HOY, 7) && /Pendiente/.test(await texto('#cfFicha .cf-est')), 'vence en 7 días y nace Pendiente');
  const p1 = await descarga('#cfFicha [data-act="cf-pdf"][data-modo="bajar"]'), t1 = pdfTexto(p1.bytes);
  ok(p1.nombre === 'cobro-0001-almacen-rosa-' + SEM.desde + '.pdf' && p1.bytes.slice(0, 8).toString() === '%PDF-1.4' && /COBRO N.º 0001/.test(t1) && t1.includes(C.pesos(e1.total)) && /No válido como factura/.test(t1), 'el PDF se descarga: «COBRO N.º 0001», el total y el pie');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('4. Cobro mensual del supermercado, y lo que impide emitir');
  const MES = V.rangoMes(V.mesDe(HOY)), hastaM = MES.hasta;
  await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente');
  await page.selectOption('#cnCliente', 'c1'); await page.waitForSelector('[data-act="cn-tipo"][data-v="mes"][aria-pressed="true"]');
  await page.fill('#cnMes', V.mesDe(HOY)); await page.waitForFunction(() => /todavía no termina/.test(document.getElementById('cnPeriodo').textContent));
  await page.waitForSelector('#cnTotal');
  const e2 = await esperado('c1', MES.desde, hastaM, null);
  ok((await texto('#cnTotal')) === C.pesos(e2.total) && !(await hay('#cnTotales .kv:nth-child(2)')) === false, 'mensual: el mes en curso (con aviso de que no termina) y el total esperado ' + C.pesos(e2.total) + ' (lo pesado sin cliente es del supermercado)');
  await page.check('input[name="cnTipo"][value="monto"]'); await page.fill('#cnValor', '999999999'); await page.waitForFunction(() => /superar el subtotal/.test((document.getElementById('cnBloqueo') || {}).textContent || ''));
  ok(await page.isDisabled('#cnEmitir'), 'un descuento mayor que el subtotal no deja emitir');
  await page.check('input[name="cnTipo"][value=""]'); await page.waitForFunction(() => !document.getElementById('cnBloqueo'));
  await db('poner', 'pesajes/sinp', { fecha: MES.desde, hora: '09:00', entregaN: 1, productoId: 'hal', cantidad: 3, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-1001', en: 1, clienteId: 'c1' });
  await db('poner', 'precios/hal_c1_2026-01-01', { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: MES.desde > '2026-11-02' ? MES.desde : '2026-11-02', en: 1 });
  await page.keyboard.press('Escape'); await cerrada(); await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente'); await page.selectOption('#cnCliente', 'c1');
  await page.fill('#cnMes', V.mesDe(HOY)); await page.waitForSelector('#cnBloqueo');
  ok(/Falta el precio de Hallulla para Supermercado/.test(await texto('#cnBloqueo')) && await page.isDisabled('#cnEmitir'), 'un pan sin precio para ese cliente bloquea la emisión');
  await db('poner', 'precios/hal_c1_2026-01-01', { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: '2026-01-01', en: 1 }); await db('borrar', 'pesajes/sinp');
  await page.keyboard.press('Escape'); await cerrada(); await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente'); await page.selectOption('#cnCliente', 'c1'); await page.fill('#cnMes', V.mesDe(HOY)); await page.waitForSelector('#cnTotal');
  await tocar('#cnEmitir'); await aviso(/Cobro N.º 0002 emitido/); await page.waitForSelector('#cfFicha[data-n="2"]');
  const c2 = await doc('cobros/0002');
  ok(c2 && c2.periodo === 'mes' && c2.total === e2.total && c2.descuento === null && c2.plazo === 7 && (await doc('config/folios')).cobro === 2, 'emitido el N.º 0002 (mensual, sin descuento)');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('5. Sin conexión: no emite, pero el PDF sí se descarga');
  await db('fuera', true); await ctx.setOffline(true);
  await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente'); await page.selectOption('#cnCliente', 'c2'); await page.waitForSelector('#cnTotal');
  await tocar('#cnEmitir'); await page.waitForFunction(() => /necesita internet/.test(document.querySelector('#dlg .form-error').textContent));
  ok(!(await doc('cobros/0003')), 'sin conexión, el borrador se arma pero no se emite (el número no puede repetirse)');
  await page.keyboard.press('Escape'); await cerrada();
  await tocar('#listaCobros [data-act="cob-ver"][data-n="1"]'); await page.waitForSelector('#cfFicha[data-n="1"]');
  const pOff = await descarga('#cfFicha [data-act="cf-pdf"][data-modo="bajar"]');
  ok(pOff.bytes.slice(0, 8).toString() === '%PDF-1.4', 'un cobro ya emitido se descarga en PDF sin conexión');
  await page.keyboard.press('Escape'); await cerrada(); await ctx.setOffline(false); await db('fuera', false);

  console.log('6. Abonos: parcial, «Pagar saldo», pago de más y saldo a favor');
  await tocar('#listaCobros [data-act="cob-ver"][data-n="1"]'); await page.waitForSelector('#cfFicha[data-n="1"]');
  await tocar('#cfFicha [data-act="ab-nuevo"]'); await page.waitForSelector('#abMonto');
  await page.fill('#abMonto', '50000'); await page.waitForFunction(() => document.getElementById('ab-p-1') && document.getElementById('ab-p-1').value === '50000');
  ok(/Queda a favor del cliente: \$0/.test(await texto('#abResto')), 'el abono se reparte solo al cobro más antiguo con saldo');
  await page.check('input[name="abMedio"][value="transferencia"]'); await page.fill('#abNota', 'Transferencia 4471'); await tocar('[data-act="ab-guardar"]'); await cerrada(); await aviso(/Abono de \$50\.000 anotado/);
  const sal1 = e1.total - 50000;
  await page.waitForFunction(s => /Abonado/.test(document.querySelector('#listaCobros [data-n="1"]').textContent) && document.querySelector('#listaCobros [data-n="1"]').textContent.includes(s), C.pesos(sal1));
  ok(true, 'el N.º 0001 queda Abonado, con saldo ' + C.pesos(sal1));
  ok((await page.inputValue('#cobCliente')) === 'c2' && (await texto('#cobPorCobrar')).includes(C.pesos(sal1)), 'llegando desde la ficha, Cobros muestra solo a ese cliente: Por cobrar = su saldo (' + C.pesos(sal1) + ')');
  await page.selectOption('#cobCliente', ''); await page.waitForFunction(s => document.getElementById('cobPorCobrar').textContent.includes(s), C.pesos(sal1 + e2.total));
  ok(true, 'con todos los clientes, Por cobrar = la suma de los saldos (' + C.pesos(sal1 + e2.total) + ')');
  await tocar('#listaCobros [data-act="cob-ver"][data-n="1"]'); await page.waitForSelector('#cfFicha[data-n="1"] [data-act="cf-pagar"]');
  await tocar('[data-act="cf-pagar"]'); await page.waitForSelector('#abMonto');
  ok((await page.inputValue('#abMonto')) === String(sal1) && (await page.inputValue('#ab-p-1')) === String(sal1), '«Pagar saldo» propone el saldo exacto, aplicado a ese cobro');
  await page.check('input[name="abMedio"][value="efectivo"]'); await tocar('[data-act="ab-guardar"]'); await cerrada(); await aviso(/anotado/);
  await page.waitForFunction(() => /Pagado/.test(document.querySelector('#listaCobros [data-n="1"]').textContent));
  ok(true, 'el N.º 0001 queda Pagado');
  await tocar('[data-act="cob-abono"]'); await page.waitForSelector('#abMonto'); await page.selectOption('#abCliente', 'c2');
  await page.fill('#abMonto', '30000'); await page.waitForSelector('#abSinCobros');
  ok(/Queda a favor del cliente: \$30\.000/.test(await texto('#abResto')), 'sin cobros con saldo, todo queda a favor');
  await tocar('[data-act="ab-guardar"]'); await cerrada(); await aviso(/\$30\.000 a favor/);
  await page.waitForFunction(() => /\$30\.000/.test(document.getElementById('cobAFavor').textContent));
  ok(true, 'arriba, Saldo a favor $30.000');
  const ANT = { desde: sumar(SEM.desde, -7), hasta: sumar(SEM.desde, -1) };
  await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente'); await page.selectOption('#cnCliente', 'c2');
  await tocar('[data-act="cn-tipo"][data-v="otro"]'); await page.waitForSelector('#cnDesde'); await page.fill('#cnDesde', ANT.desde); await page.fill('#cnHasta', ANT.hasta);
  await page.waitForSelector('#cnAFavor');
  const e3 = await esperado('c2', ANT.desde, ANT.hasta, { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' });
  ok((await texto('#cnTotal')) === C.pesos(e3.total) && /\$30\.000/.test(await texto('#cnAFavor')), 'el cobro siguiente avisa que se aplica el saldo a favor ($30.000)');
  await tocar('#cnEmitir'); await aviso(/Cobro N.º 0003 emitido/); await page.waitForSelector('#cfFicha[data-n="3"]');
  const ab = await docs('abonos'), af = ab.find(a => a.monto === 30000);
  ok(af.aFavor === 0 && af.aplicado.length === 1 && af.aplicado[0].cobro === 3 && af.aplicado[0].previo === true && (await doc('cobros/0003')).total === e3.total && (await doc('cobros/0003')).netoFinal === e3.netoFinal,
    'al emitir, el saldo a favor pasa al N.º 0003 (como pago: el neto y el IVA no cambian)');
  await page.waitForFunction(s => document.getElementById('cfSaldo').textContent.includes(s), C.pesos(e3.total - 30000));
  ok(true, 'el N.º 0003 queda con saldo ' + C.pesos(e3.total - 30000));
  const p3 = pdfTexto((await descarga('#cfFicha [data-act="cf-pdf"][data-modo="bajar"]')).bytes);
  ok(/Saldo a favor anterior/.test(p3) && /Saldo de este cobro/.test(p3), 'su PDF muestra «Saldo a favor anterior» y el saldo de este cobro');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('7. Cambiar el reparto y anular un abono');
  const a50 = (await docs('abonos')).find(a => a.monto === 50000);
  await tocar('#cobAbonos [data-act="ab-ver"][data-id="' + a50.id + '"]'); await page.waitForSelector('#abFicha');
  await tocar('[data-act="ab-reparto"]'); await page.waitForSelector('#ab-p-1');
  await page.fill('#ab-p-1', '40000'); await page.waitForFunction(() => /\$10\.000/.test(document.getElementById('abResto').textContent));
  await tocar('[data-act="ab-reparto-ok"]'); await cerrada(); await aviso(/Reparto guardado/);
  const a50b = await doc('abonos/' + a50.id);
  ok(a50b.aFavor === 10000 && a50b.aplicado[0].monto === 40000 && a50b.reparto && a50b.reparto.por === 'u-1001', 'reparto a mano: $40.000 al N.º 0001 y $10.000 a favor (queda quién y cuándo)');
  await page.waitForFunction(() => /Abonado/.test(document.querySelector('#listaCobros [data-n="1"]').textContent));
  ok(true, 'el N.º 0001 vuelve a Abonado (le faltan $10.000)');
  const aSaldo = (await docs('abonos')).find(a => a.medio === 'efectivo');
  await tocar('#cobAbonos [data-act="ab-ver"][data-id="' + aSaldo.id + '"]'); await page.waitForSelector('#abFicha');
  await tocar('[data-act="ab-anular"]'); await page.waitForSelector('#motivo'); await tocar('[data-act="ab-anular-ok"]');
  ok(/motivo/.test(await texto('#dlg .form-error')), 'anular un abono pide el motivo');
  await page.fill('#motivo', 'Mal anotado'); await tocar('[data-act="ab-anular-ok"]'); await cerrada(); await aviso(/Abono anulado/);
  const ca = A.cuenta(await docs('cobros').then(l => l.map(x => Object.assign(x, { numero: Number(x.numero) }))), await docs('abonos'), 'c2', HOY);
  ok((await doc('abonos/' + aSaldo.id)).anulado.motivo === 'Mal anotado' && ca.porCobrar === 10000 + sal1 + (e3.total - 30000), 'anulado, deja de contar: el N.º 0001 vuelve a tener ese saldo (no se borra)');

  console.log('8. Estado de cuenta en PDF');
  await tocar('[data-act="cob-cuenta"]'); await page.waitForSelector('#ecSaldo'); await page.selectOption('#ecCliente', 'c2'); await page.fill('#ecDesde', '2026-11-01');
  await page.waitForFunction(() => /Saldo adeudado/.test(document.getElementById('ecResumen').textContent));
  ok((await texto('#ecSaldo')) === 'Saldo adeudado' + C.pesos(ca.porCobrar - ca.aFavor), 'saldo adeudado = Por cobrar − saldo a favor (' + C.pesos(ca.porCobrar - ca.aFavor) + ')');
  const pe = await descarga('[data-act="ec-pdf"][data-modo="bajar"]'), te = pdfTexto(pe.bytes);
  ok(pe.nombre === 'estado-de-cuenta-almacen-rosa-' + HOY + '.pdf' && /ESTADO DE CUENTA/.test(te) && /Cobro N.º 0001/.test(te) && /Abono/.test(te) && te.includes(C.pesos(ca.porCobrar - ca.aFavor)), 'el PDF: cobros, abonos y el saldo final');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('9. Vencido, con su franja');
  await db('poner', 'cobros/0002', Object.assign({}, await doc('cobros/0002'), { vence: sumar(HOY, -2) }));
  await page.click('#nav button[data-tab="inicio"]'); await page.waitForSelector('#avisoVencidos');
  ok(/1 cobro vencido · /.test(await texto('#avisoVencidos')) && (await texto('#avisoVencidos')).includes(C.pesos(e2.total)), 'franja en Hoy: «1 cobro vencido · ' + C.pesos(e2.total) + '»');
  await tocar('#avisoVencidos [data-act="ir"]'); await page.waitForSelector('#listaCobros');
  ok((await page.inputValue('#cobEstado')) === 'vencido' && (await page.$$('#listaCobros .mrow')).length === 1 && /Vencido/.test(await texto('#listaCobros')) && (await texto('#cobVencido')).includes(C.pesos(e2.total)), '«Ver» lleva a Cobros con el filtro «Vencidos»; arriba, Vencido');
  await page.selectOption('#cobEstado', 'todos');
  // Fase 13 (parte D): un filtro sin resultados ofrece volver a ver todos
  await page.selectOption('#cobEstado', 'anulado'); await page.waitForSelector('#cobVerTodos');
  await tocar('#cobVerTodos'); await page.waitForSelector('#listaCobros');
  ok((await page.inputValue('#cobEstado')) === 'todos' && (await page.inputValue('#cobCliente')) === '', 'filtro sin resultados: «Ver todos los cobros» quita el cliente y el estado');

  console.log('10. «Cambió desde que se emitió» y «Anular y emitir de nuevo»');
  const pc = (await docs('pesajes')).find(p => p.clienteId === 'c2' && p.productoId === 'hal' && p.fecha === SEM.desde);
  await db('poner', 'pesajes/' + pc.id, Object.assign({}, pc, { cantidad: pc.cantidad + 2 }));
  await tocar('#listaCobros [data-act="cob-ver"][data-n="1"]'); await page.waitForSelector('#cfCambio .note');
  ok(/Cambió desde que se emitió/.test(await texto('#cfCambio')), 'al abrir el N.º 0001, avisa que los canastos cambiaron');
  await tocar('[data-act="cf-reemitir"]'); await page.waitForSelector('#cnReemplaza'); await page.waitForSelector('#cnTotal');
  const e4 = await esperado('c2', SEM.desde, SEM.hasta, { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' });
  ok((await texto('#cnTotal')) === C.pesos(e4.total) && e4.total > e1.total, 'la hoja «Emitir de nuevo» trae el mismo período con los canastos de hoy (' + C.pesos(e4.total) + ')');
  await tocar('#cnEmitir'); await aviso(/Cobro N.º 0004 emitido \(reemplaza al N.º 0001\)/);
  const v1 = await doc('cobros/0001'), n4 = await doc('cobros/0004'), a50c = await doc('abonos/' + a50.id);
  ok(v1.anulado && v1.anulado.reemplazo === 4 && n4.reemplaza === 1 && n4.total === e4.total && a50c.aplicado.some(x => x.cobro === 4 && x.monto === 40000) && !a50c.aplicado.some(x => x.cobro === 1),
    'el N.º 0001 queda anulado (con constancia) y lo abonado pasa al N.º 0004, que dice «Reemplaza al N.º 0001»');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('11. Dos equipos no sacan el mismo número');
  await page.evaluate(() => { window.__fakeDb.alConfirmar = () => { const d = window.__fakeDb.todo(), f = d['config/folios'], n = f.cobro + 1, id = String(n).padStart(4, '0');
    window.__fakeDb.poner('cobros/' + id, Object.assign({}, d['cobros/0002'], { numero: n, por: 'u-2002', quien: 'Otro equipo' })); window.__fakeDb.poner('config/folios', Object.assign({}, f, { cobro: n })); }; window.__fakeDb.reintentos = 0; });
  await tocar('[data-act="cob-nuevo"]'); await page.waitForSelector('#cnCliente'); await page.selectOption('#cnCliente', 'c2');
  await tocar('[data-act="cn-tipo"][data-v="otro"]'); await page.waitForSelector('#cnDesde'); await page.fill('#cnDesde', HOY); await page.fill('#cnHasta', HOY);
  await page.waitForSelector('#cnBloqueo'); await page.fill('#cnDesde', sumar(HOY, -1)); await page.fill('#cnHasta', sumar(HOY, -1)); await page.waitForSelector('#cnTotal');
  await tocar('#cnEmitir'); await aviso(/Cobro N.º 0006 emitido/);
  ok((await doc('cobros/0005')).quien === 'Otro equipo' && (await doc('cobros/0006')).clienteId === 'c2' && (await doc('config/folios')).cobro === 6 && await page.evaluate(() => window.__fakeDb.reintentos) >= 1,
    'si otro equipo emite al mismo tiempo, la transacción se repite sola: este sale con el N.º 0006 y el otro conserva el 0005');
  await page.keyboard.press('Escape'); await cerrada();

  console.log('12. Cotización → cliente con sus precios');
  await irMas('#irCotizaciones', '[data-act="qz-nueva"]'); await tocar('[data-act="qz-nueva"]'); await page.waitForSelector('#qz-nombre');
  await tocar('[data-act="qz-emitir"]'); ok(/a quién va/.test(await texto('#dlg .form-error')), 'el nombre del posible cliente es obligatorio');
  await page.fill('#qz-nombre', 'Casino Sur'); await page.fill('#qz-contacto', 'Ana · ana@example.com');
  ok((await page.inputValue('#qz-n-hal')) === '1300' && (await page.inputValue('#qz-n-com')) === '110', 'los precios parten de la lista del cliente principal');
  await page.fill('#qz-n-hal', '1.250'); await page.fill('#qz-c-hal', '40'); await page.waitForSelector('#qzTotal');
  ok((await texto('#qzTotal')).endsWith(C.pesos(C.montos(1250, 40, 19).total)), 'con cantidad estimada sale el total estimado (' + C.pesos(C.montos(1250, 40, 19).total) + ')');
  await tocar('[data-act="qz-emitir"]'); await cerrada(); await aviso(/Cotización N.º 0001 emitida/);
  const q1 = await doc('cotizaciones/0001');
  ok(q1 && q1.para.nombre === 'Casino Sur' && q1.lineas.length === 2 && q1.lineas[0].neto === 1250 && q1.estado === 'enviada' && (await doc('config/folios')).cotizacion === 1 && (await doc('config/folios')).cobro === 6, 'emitida con su propio folio (los cobros siguen en 6)');
  await page.waitForSelector('#listaCotizaciones [data-n="1"]'); await tocar('#listaCotizaciones [data-act="qz-ver"][data-n="1"]'); await page.waitForSelector('#qzFicha');
  const pq = await descarga('#qzFicha [data-act="qz-pdf"][data-modo="bajar"]');
  ok(pq.nombre === 'cotizacion-0001-casino-sur.pdf' && /COTIZACIÓN N.º 0001/.test(pdfTexto(pq.bytes)), 'el PDF de la cotización');
  await tocar('[data-act="qz-cliente"]'); await page.waitForSelector('#qzDesde'); await tocar('[data-act="qz-cliente-ok"]'); await cerrada(); await aviso(/Cliente creado: Casino Sur/);
  const nuevoCli = (await docs('clientes')).find(x => x.nombre === 'Casino Sur'), q1b = await doc('cotizaciones/0001');
  const prN = (await docs('precios')).filter(x => x.clienteId === (nuevoCli && nuevoCli.id));
  ok(nuevoCli && nuevoCli.tipo === 'regular' && prN.length === 2 && prN.find(x => x.productoId === 'hal').neto === 1250 && prN.every(x => x.desde === HOY) && (await doc('clientesCobro/' + nuevoCli.id)).contacto === 'Ana · ana@example.com'
    && q1b.estado === 'aceptada' && q1b.clienteId === nuevoCli.id, '«Crear cliente con estos precios»: cliente regular, su lista y sus datos de cobro; la cotización queda Aceptada y enlazada');

  console.log('13. Excel del mes con «Cobros» y «Abonos»');
  await irMas('#irDatos', '#datExcel'); await page.uncheck('#datCostos');
  const xl = leerXlsx((await descarga('#datExcel')).bytes), hc = xl.hojas.Cobros.filas;
  const cs = (await docs('cobros')).map(x => Object.assign(x, { numero: Number(x.numero) })), as = await docs('abonos'), enMes = cs.filter(x => x.hasta >= MES.desde && x.hasta <= MES.hasta), vivos = enMes.filter(x => !x.anulado);
  const saldoMes = vivos.reduce((t, x) => t + A.estado(x, as, HOY).saldo, 0);
  ok(xl.orden.includes('Cobros') && xl.orden.includes('Abonos') && hc[vivos.length + 1][9] === saldoMes && sumaCol(hc, 9, 1, vivos.length + 1) === saldoMes, 'el Excel trae «Cobros» con el saldo de cada cobro (suma ' + C.pesos(saldoMes) + ') y «Abonos»');
  ok(hc.some(f => /Anulado/.test(String(f[10] || ''))), 'el cobro anulado va al final, sin sumar');
  await salir();

  console.log('14. El externo');
  await entrar(FELIPE, '#view h1'); await irMas('#irCobros', '#listaCobros');
  ok((await page.$$('#listaCobros .mrow')).length === cs.length && /Por cobrar/.test(await texto('#cobResumen')), 'el externo ve los cobros y Por cobrar');
  await tocar('#listaCobros [data-act="cob-ver"][data-n="2"]'); await page.waitForSelector('#cfFicha[data-n="2"]'); await tocar('[data-act="cf-factura"]'); await page.waitForSelector('#cfFacturaNum');
  await page.fill('#cfFacturaNum', '4521'); await tocar('[data-act="cf-factura-ok"]'); await cerrada(); await aviso(/Factura SII anotada: 4521/);
  ok((await doc('cobros/0002')).factura === '4521', 'y anota el n.º de factura SII (lo único que cambia de un cobro emitido, además de anularlo)');
  await salir();

  console.log('15. La tablet no ve nada de esto');
  await entrar(TABLET, '#pesQuien'); await page.click('#nav button[data-tab="mas"]'); await page.waitForSelector('#miPerfil');
  ok(!(await hay('#irCobros')) && !(await hay('#irCotizaciones')) && !(await hay('#avisoVencidos')), 'sin «Cobros» en Más ni franja de vencidos');
  ok(!(await db('pedir', 'list', 'cobros')) && !(await db('pedir', 'list', 'abonos')) && !(await db('pedir', 'get', 'config/empresa')) && !(await db('pedir', 'list', 'clientesCobro')) && !(await db('pedir', 'list', 'cotizaciones')),
    'las reglas le niegan cobros, abonos, datos de cobro, cotizaciones y los datos de la panadería');
  await salir();

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien');
  ok(errs.length === 0, 'sin errores en la consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e.message.split('\n')[0]); console.error('ERRORES:', (global.__errs || []).join(' | ')); process.exit(1); });
