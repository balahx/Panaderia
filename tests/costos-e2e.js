/* Costos y margen de punta a punta (Fase 9), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   insumos con su precio de factura (el primero rige desde el inicio de los datos), la receta de la hallulla de la panadería con su costo
   por kg, el simulador de precio, un alza con fecha futura que no cambia el costo de hoy, «El mes» con venta, ingredientes, margen,
   gastos (copiar del mes anterior) y resultado, un mes cerrado desde Excel (estimado), el Excel con la hoja «Resultado», el externo y la
   tablet (que no ve ni lee nada de costos). Uso: node tests/costos-e2e.js */
const fs = require('fs');
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js'), { leer } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), MANANA = dia(Date.now() + 86400000), MES = HOY.slice(0, 7);
const mesAntes = m => { const [a, n] = m.split('-').map(Number); return n === 1 ? (a - 1) + '-12' : a + '-' + String(n - 1).padStart(2, '0'); };
const MESP = mesAntes(MES);
const pes = (id, prod, cant, unidad) => ['pesajes/' + id, { fecha: HOY, hora: '05:10', entregaN: 1, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.now() }];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/hal': { nombre: 'Hallulla', unidad: 'kg', orden: 1, activo: true, en: 1 },
  'productos/com': { nombre: 'Pan de completo', unidad: 'un', pesoRef: 100, orden: 2, activo: true, en: 1 },
  'precios/hal_c1_2026-01-01': { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: '2026-01-01', en: 1 },
  'precios/com_c1_2026-01-01': { productoId: 'com', clienteId: 'c1', neto: 110, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 },
  ['cierres/' + MESP]: { mes: MESP, origen: 'excel', cerrado: true, iva: 19, lineas: [{ productoId: 'hal', nombre: 'Hallulla', unidad: 'kg', cantidad: 400, precio: 1300, neto: 520000 }],
    neto: 520000, ivaMonto: 98800, total: 618800, kg: 400, un: 0, por: 'u-1001', quien: 'Rosa', en: 1 } },
Object.fromEntries([pes('h1', 'hal', 18.5, 'kg'), pes('h2', 'hal', 17.25, 'kg'), pes('h3', 'com', 192, 'un')]));

(async () => {
  const K = await import('../APP/js/core/costos.js'), V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async (quien, sel) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(sel || '#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const escribir = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); };
  const descarga = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), tocar(sel)]); return { nombre: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) }; };
  const fila = nombre => '#view .mrow:has(.mt b:text-is("' + nombre + '"))';
  const p2 = n => C.pesos(Math.round(n * 100) / 100);
  const costos = async () => ({ insumos: await docs('insumos'), preciosInsumo: await docs('preciosInsumo'), recetas: await docs('recetas') });
  const insumo = async (nombre, unidad, formato, neto) => {
    await tocar('[data-act="cos-ins-nuevo"]'); await page.waitForSelector('#iNombre');
    await page.fill('#iNombre', nombre);
    if (unidad !== 'kg') await page.check('#dlg input[name="iUnidad"][value="' + unidad + '"]');
    if (formato != null) { await escribir('#ipFormato', formato); await escribir('#ipNeto', neto); }
    await tocar('#dlg [data-act="cos-guardar"]'); await cerrada(); await page.waitForSelector(fila(nombre));
  };

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. Insumos con su precio de factura');
  await entrar(null, '#hoyTotales');
  await tocar('#nav button[data-tab="mas"]'); await tocar('#irCostos'); await page.waitForSelector('#cosCuerpo[data-sub="insumos"]');
  ok(/Sin insumos/.test(await texto('#cosCuerpo')) && (await page.title()) === 'Costos · Panadería', 'Más → Costos y margen: aún sin insumos');
  await tocar('[data-act="cos-ins-nuevo"]'); await page.waitForSelector('#iNombre');
  await escribir('#ipFormato', '25'); await escribir('#ipNeto', '18.500');
  ok(/\$740$/.test(await texto('#ipPorUnidad')) && (await page.inputValue('#ipDesde')) === K.INICIO && /primer precio/.test(await texto('#ipPrimero')), 'saco de 25 kg a $18.500 → $740 por kilo; el primer precio rige desde el inicio de los datos');
  await tocar('#dlg [data-act="cos-guardar"]'); ok(/nombre/.test(await texto('#dlg .form-error')), 'sin nombre no se guarda');
  await page.fill('#iNombre', 'Harina'); await tocar('#dlg [data-act="cos-guardar"]'); await cerrada(); await page.waitForSelector(fila('Harina'));
  ok(/\$740 \/ kg/.test(await texto(fila('Harina'))), 'Harina queda en la lista con $740 / kg');
  await insumo('Margarina', 'kg', '10', '22.000');
  await insumo('Agua', 'l', '1', '0');
  await insumo('Levadura', 'kg', '0,5', '2.250');
  await insumo('Sal', 'kg', null, null);
  ok(/Sin precio/.test(await texto(fila('Sal'))) && /Litros/.test(await texto(fila('Agua'))), 'un insumo sin precio lo dice; el agua se mide en litros');
  await tocar(fila('Sal')); await page.waitForSelector('#insPrecioHoy'); await tocar('#dlg [data-act="cos-ins-precio"]'); await page.waitForSelector('#ipFormato');
  await escribir('#ipFormato', '25'); await escribir('#ipNeto', '6.250'); await tocar('#dlg [data-act="cos-guardar"]'); await cerrada();
  await page.waitForFunction(() => /\$250 \/ kg/.test(document.querySelector('#listaInsumos').textContent));
  const ins = await docs('insumos'), id = n => ins.find(i => i.nombre === n).id;
  const prs = await docs('preciosInsumo');
  ok(ins.length === 5 && prs.length === 5 && prs.every(p => p.desde === K.INICIO && p.id === p.insumoId + '_' + p.desde) && ins.find(i => i.nombre === 'Agua').unidad === 'l', 'cinco insumos y sus precios desde el ' + K.INICIO + ' (identificador insumo_fecha)');
  await tocar(fila('Harina')); await page.waitForSelector('#insPrecioHoy'); await tocar('#dlg [data-act="cos-ins-precio"]'); await page.waitForSelector('#ipFormato');
  ok((await page.inputValue('#ipDesde')) === HOY && (await page.inputValue('#ipFormato')) === '25', 'un cambio de precio parte desde hoy y con el formato de siempre');
  await escribir('#ipNeto', '20.000'); await page.fill('#ipDesde', MANANA); await tocar('#dlg [data-act="cos-guardar"]'); await cerrada();
  await tocar(fila('Harina')); await page.waitForSelector('#insHistorial');
  ok(/aún no rige/.test(await texto('#insHistorial')) && /\$740/.test(await texto('#insPrecioHoy')), 'el alza de mañana queda en el historial; hoy sigue $740');
  await tocar('#dlg [data-act="cerrar-hoja"]'); await cerrada();

  console.log('2. Receta de la hallulla (la de la panadería) y su costo por kg');
  await tocar('.volver'); await tocar('#irCatalogo'); await page.waitForSelector(fila('Hallulla'));
  await tocar(fila('Hallulla')); await page.waitForSelector('#fichaCosto');
  ok(/Sin receta/.test(await texto('#fichaCosto')), 'la ficha del pan dice que no tiene receta');
  await tocar('#dlg [data-act="rec-form"]'); await page.waitForSelector('#recRend');
  ok((await page.inputValue('#recDesde')) === K.INICIO && (await page.locator('#recCampos input').count()) === 5, 'una fila por insumo; la primera receta rige desde el inicio');
  await escribir('#rc-' + id('Harina'), '12,5'); await escribir('#rc-' + id('Margarina'), '250 g'); await escribir('#rc-' + id('Sal'), '160 g');
  await escribir('#rc-' + id('Levadura'), '130 g'); await escribir('#rc-' + id('Agua'), '7'); await escribir('#recRend', '16,5');
  const esperadoU = (12.5 * 740 + 0.25 * 2200 + 0.16 * 250 + 0.13 * 4500) / 16.5;
  ok((await texto('#recVista')).includes(p2(esperadoU) + ' por kg'), 'mientras se escribe, la vista previa da ' + p2(esperadoU) + ' por kg');
  await page.fill('#recNotaC', 'Levadura: invierno 130 g, verano 100 g');
  await tocar('#dlg [data-act="rec-guardar"]'); await cerrada();
  const rec = (await docs('recetas'))[0];
  ok(rec && rec.id === 'hal_' + K.INICIO && rec.items.length === 5 && rec.rendimiento === 16.5 && rec.por === 'u-1001' && rec.items.find(x => x.insumoId === id('Margarina')).cantidad === 0.25, 'la receta se guarda: 5 ingredientes, salen 16,5 kg, a nombre de quien la anota');
  await tocar(fila('Hallulla')); await page.waitForSelector('#costoHoy');
  const margenHoy = 1300 - esperadoU;
  ok((await texto('#costoHoy b')) === p2(esperadoU) && (await texto('#costoHoy small')).includes(p2(margenHoy)) && (await texto('#costoHoy small')).includes(K.pctTexto(margenHoy / 13)), 'la ficha: ingredientes ' + p2(esperadoU) + ' por kg y margen ' + p2(margenHoy) + ' (' + K.pctTexto(margenHoy / 13) + ')');
  await tocar('#dlg [data-act="rec-ver"]'); await page.waitForSelector('#recItems');
  ok((await texto('#recUnitario')) === p2(esperadoU) && /Levadura: invierno/.test(await texto('#recNota')) && /vigente/.test(await texto('#recHistorial')), 'la receta muestra cada ingrediente con su costo, la nota y la versión vigente');

  console.log('3. Simulador de precio');
  await tocar('#dlg [data-act="rec-sim"]'); await page.waitForSelector('#simPrecio');
  ok((await texto('#simRes1')).includes(p2(margenHoy)), 'con el precio de hoy, el margen de hoy');
  await escribir('#simPrecio', '1.500');
  ok((await texto('#simRes1')).includes(p2(1500 - esperadoU)) && (await texto('#simRes1')).includes(C.pesos(Math.round(1500 * 1.19))), '«si el precio fuera 1.500»: margen ' + p2(1500 - esperadoU) + ' y el precio con IVA');
  await escribir('#simPct', '40');
  ok((await texto('#simRes2')).includes(p2(Math.round(esperadoU / 0.6 * 100) / 100)), '«para ganar 40 %»: precio neto ' + p2(Math.round(esperadoU / 0.6 * 100) / 100));
  await escribir('#simPct', '100'); ok(/menor que 100/.test(await texto('#simRes2')), 'con 100 % o más no hay precio posible');
  await tocar('#dlg [data-act="cerrar-hoja"]'); await cerrada();

  console.log('4. El mes: venta, ingredientes, margen, gastos y resultado');
  await tocar('.volver'); await tocar('#irCostos'); await tocar('.seg [data-sub="mes"]'); await page.waitForSelector('#cosVenta');
  const kk = await costos(), pz = await docs('pesajes'), pr = await docs('precios'), prods = await docs('productos');
  const R = K.resumenMes(MES, { pesajes: pz, productos: prods, precios: pr, clienteId: 'c1', iva: 19, k: kk });
  ok((await texto('#cosVentaNeta b')) === C.pesos(R.venta) && (await texto('#cosIngredientes b')) === C.pesos(R.costo) && R.costo === Math.round(esperadoU * 35.75), 'venta ' + C.pesos(R.venta) + ' e ingredientes ' + C.pesos(R.costo) + ' (35,75 kg de hallulla × su costo)');
  ok(/Pan de completo/.test(await texto('#cosSinCosto')) && /Sin costo/.test(await texto(fila('Pan de completo'))), 'el pan de completo no tiene receta: se avisa y no descuenta ingredientes');
  ok(/Aún no hay gastos/.test(await texto('#cosSinGastos')) && (await texto('#cosResultadoTotal b')).startsWith(C.pesos(R.margen)), 'sin gastos, el resultado es el margen');

  console.log('5. Un mes cerrado desde Excel (estimado) y sus gastos');
  await tocar('[data-act="cos-mes-nav"][data-d="-1"]'); await page.waitForSelector('#cosFuente');
  const RP = K.resumenMes(MESP, { cierre: (await docs('cierres'))[0], pesajes: [], productos: prods, precios: pr, clienteId: 'c1', iva: 19, k: kk });
  ok(/estiman/.test(await texto('#cosFuente')) && /estimado/.test(await texto('#cosIngredientes span')) && (await texto('#cosVentaNeta b')) === '$520.000' && (await texto('#cosIngredientes b')) === C.pesos(RP.costo), 'venta del cierre ($520.000) e ingredientes estimados (' + C.pesos(RP.costo) + ')');
  await tocar('#cosAnotarGastos'); await page.waitForSelector('#gM0');
  await tocar('#dlg [data-act="gas-copiar"]'); ok(/no tiene gastos/.test(await texto('#dlg .form-error')), '«Copiar del mes anterior» avisa si ese mes no tiene gastos');
  ok((await page.inputValue('#gN0')) === 'Gas' && (await page.inputValue('#gN2')) === 'Sueldos', 'líneas sugeridas: Gas, Luz, Sueldos…');
  await escribir('#gM0', '170.000'); ok((await texto('#gasTotal')) === 'Total: $170.000', 'el total se suma mientras se escribe');
  await tocar('#dlg [data-act="gas-guardar"]'); await cerrada(); await page.waitForSelector('#cosTotalGastos');
  const gP = (await docs('gastos')).find(g => g.id === MESP);
  ok(gP && gP.items.length === 1 && gP.items[0].monto === 170000 && gP.por === 'u-1001' && gP.quien === 'Rosa Dueña', 'los gastos de un mes cerrado se guardan (no tocan la venta)');

  console.log('6. Gastos del mes en curso, resultado y Excel');
  await tocar('[data-act="cos-mes-nav"][data-d="1"]'); await page.waitForSelector('#cosAnotarGastos');
  await tocar('#cosAnotarGastos'); await page.waitForSelector('#gM0'); await tocar('#dlg [data-act="gas-copiar"]'); await page.waitForSelector('#gM0');
  ok((await page.inputValue('#gM0')) === '170.000' && (await texto('#gasTotal')) === 'Total: $170.000', '«Copiar del mes anterior» trae los gastos del mes anterior (y su total)');
  await escribir('#gM0', '180.000'); await escribir('#gM2', '900.000'); await tocar('#dlg [data-act="gas-guardar"]'); await cerrada();
  await page.waitForFunction(() => document.getElementById('cosTotalGastos') && /1\.080\.000/.test(document.getElementById('cosTotalGastos').textContent));
  const res = R.margen - 1080000;
  ok((await texto('#cosResultadoTotal b')).startsWith(C.pesos(res)) && (res >= 0 || /superan/.test(await texto('#cosPerdida'))), 'resultado = margen − gastos = ' + C.pesos(res));
  const x = await descarga('#cosExcel'), L = leer(x.bytes), nV = L.hojas.Ventas.filas.length - 2;
  const fR = t => L.hojas.Resultado.filas.find(f => f[0] === t);
  ok(x.nombre === 'ventas-' + MES + '.xlsx' && L.orden.join() === 'Resumen,Resultado,Ventas,Entregas,Por día,Por pan,Canastos', 'el Excel de El mes trae la hoja «Resultado»');
  ok(L.hojas.Ventas.filas[nV + 1][12] === R.costo && fR('Total de gastos')[1] === 1080000 && fR('Resultado del mes')[1] === res, 'en el Excel: ingredientes, gastos y resultado iguales a la pantalla');
  await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entExcel');
  ok(!leer((await descarga('#entExcel')).bytes).orden.includes('Resultado'), 'el Excel de Entregas (para la contadora) sale sin costos');

  console.log('7. El externo y la tablet');
  await salir(); await entrar(FELIPE, '#hoyTotales');
  await tocar('#nav button[data-tab="mas"]'); await tocar('#irCostos'); await page.waitForSelector('#listaInsumos');
  ok((await page.locator('#listaInsumos .mrow').count()) === 5, 'el externo ve los insumos');
  await tocar('.volver'); await tocar('#irCatalogo'); await tocar(fila('Hallulla')); await page.waitForSelector('#costoHoy');
  ok((await texto('#costoHoy b')) === p2(esperadoU), 'y el costo en la ficha del pan');
  await tocar('#dlg [data-act="cerrar-hoja"]'); await cerrada();
  await salir(); await entrar(TABLET, '#pesQuien');
  await tocar('#nav button[data-tab="mas"]'); await page.waitForSelector('#irAyuda');
  ok(!(await page.$('#irCostos')) && !(await page.$('#irCatalogo')), 'la tablet no tiene Costos en «Más»');
  ok((await db('pedir', 'list', 'insumos')) === false && (await db('pedir', 'list', 'recetas')) === false && (await db('pedir', 'get', 'gastos/' + MES)) === false && (await db('pedir', 'list', 'preciosInsumo')) === false, 'ni con peticiones directas lee insumos, recetas, precios de insumos o gastos');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
