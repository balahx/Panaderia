/* Indicadores, proyección y metas de punta a punta (Fase 7), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   la pestaña Indicadores (dueños y externo, no la tablet), el mes en curso con los mismos totales que Entregas, un mes cerrado desde Excel
   y otro cerrado con la app con los totales de su cierre («Listo cuando»), la comparación con el mes anterior y con el del año pasado,
   días de la semana y kilos por trabajador, «Año y metas» (año contra año, ajustar la proyección, fijar metas y escribir una a mano),
   real contra la meta, sin conexión y lo que cuesta en lecturas. Uso: node tests/indicadores-e2e.js */
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), MES = HOY.slice(0, 7), Y = Number(MES.slice(0, 4));
const sumar = (mes, n) => { const [a, m] = mes.split('-').map(Number), d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
const M1 = sumar(MES, -1), M2 = sumar(MES, -2), M12 = sumar(MES, -12), M13 = sumar(MES, -13);
const pes = (id, fecha, n, prod, cant, unidad, mas) => ['pesajes/' + id, Object.assign({ fecha, hora: '06:0' + (id.length % 10), entregaN: n, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.parse(fecha + 'T12:00:00Z') }, mas || {})];
const excel = (mes, f) => ({ mes, origen: 'excel', cerrado: true, iva: 19, lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 1000 * f, precio: 1400, neto: 1400000 * f },
  { productoId: 'p2', nombre: 'Pan de completo', unidad: 'un', cantidad: 2000 * f, precio: 100, neto: 200000 * f }], neto: 1600000 * f, ivaMonto: 304000 * f, total: 1904000 * f, kg: 1000 * f, un: 2000 * f,
  archivo: 'Cierres.xlsx', hoja: 'Cierres', por: 'u-1001', quien: 'Rosa', en: 1 });
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 }, 'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true, en: 1 }, 'productos/p2': { nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true, en: 1 },
  'productos/p3': { nombre: 'Hallulla', unidad: 'kg', orden: 3, activo: true, en: 1 },
  'precios/p1_c1_2020-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1450, desde: '2020-01-01', en: 1 }, 'precios/p2_c1_2020-01-01': { productoId: 'p2', clienteId: 'c1', neto: 120, desde: '2020-01-01', en: 1 },
  'precios/p3_c1_2020-01-01': { productoId: 'p3', clienteId: 'c1', neto: 1512.61, desde: '2020-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 }, 'trabajadores/t2': { nombre: 'Marta', activo: true, en: 1 },
  ['cierres/' + M1]: excel(M1, 2), ['cierres/' + M12]: excel(M12, 1), ['cierres/' + M13]: excel(M13, 1.5) },
Object.fromEntries([pes('a1', MES + '-01', 1, 'p1', 20.5, 'kg'), pes('a2', MES + '-01', 1, 'p2', 300, 'un', { trabajadorId: 't2' }), pes('a3', HOY, 2, 'p3', 10.33, 'kg'), pes('a4', HOY, 2, 'p1', 50, 'kg', { anulado: true }),
  pes('b1', M2 + '-03', 1, 'p1', 25, 'kg'), pes('b2', M2 + '-04', 1, 'p1', 30.25, 'kg', { trabajadorId: 't2' }), pes('b3', M2 + '-04', 1, 'p2', 150, 'un')]));

(async () => {
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js'), CI = await import('../APP/js/core/cierres.js'), I = await import('../APP/js/core/indicadores.js');
  const lista = col => Object.entries(SEMILLA).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const k = { productos: lista('productos'), precios: lista('precios') }, pesM2 = lista('pesajes').filter(p => p.fecha.startsWith(M2));
  SEMILLA['cierres/' + M2] = Object.assign(CI.desdeApp(M2, pesM2, k, { id: 'c1', nombre: 'Supermercado' }, 19, { por: 'u-1001', quien: 'Rosa' }).doc, { en: 1 });
  const netoMes = V.totales(V.lineas(lista('pesajes').filter(p => p.fecha.startsWith(MES)), k.productos, k.precios, 'c1', 19)).neto;

  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async quien => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel), hay = async sel => !!(await page.$(sel));
  const escribir = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); };
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const irMes = async mes => { await escribir('#indMes', mes); await page.waitForFunction(m => document.querySelector('#indMes') && document.querySelector('#indMes').value === m && (document.querySelector('#indNeto') || document.querySelector('.empty')), mes); await page.waitForSelector('#indNeto, .empty'); };
  const sinCargar = () => page.waitForFunction(() => !/Cargando…|cargando…/.test(document.querySelector('#view').textContent) && !document.querySelector('#view .spin'));

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. El mes en curso: los mismos totales que Entregas');
  await entrar(); await page.waitForSelector('#hoyTotales');
  const tabs = await page.locator('#nav button span').allTextContents();
  ok(tabs.join('|') === 'Hoy|Entregas|Números|Pesaje|Más', 'la barra de un dueño: Hoy · Entregas · Números (indicadores) · Pesaje · Más');
  await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entMonto');
  const netoEnt = (await texto('#entMonto .kv b')).trim();
  await tocar('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indNeto'); await sinCargar();
  ok((await texto('#indNeto')) === C.pesos(netoMes) && netoEnt === C.pesos(netoMes), 'neto del mes = Entregas (' + C.pesos(netoMes) + ')');
  ok(/En curso/.test(await texto('#indFuente')) && (await page.locator('#indPanes .ind-pan').count()) === 3, 'dice que el mes está en curso y muestra los 3 panes vendidos');
  const panes = await page.locator('#indPanes .ind-pan .precio small').allTextContents();
  ok(Math.abs(panes.map(t => parseFloat(t.replace(',', '.'))).reduce((a, b) => a + b, 0) - 100) < 0.3, 'la participación de los panes suma 100 %');
  ok(/Luis/.test(await texto('#indTrabajadores')) && /Marta/.test(await texto('#indTrabajadores')) && (await page.locator('#indSemana .mrow').count()) >= 1, 'kilos por trabajador y días de la semana (con datos de la app)');
  ok(/Contra /.test(await texto('#indComparar')) && /vs/.test(await texto('#indComparar')), 'compara con el mes anterior y con el del año pasado');
  ok(/no tiene meta ni proyección|Real contra proyectado|Proyectado/.test(await texto('#indMeta')), 'real contra proyectado (con la base del año pasado)');

  console.log('2. Meses cerrados: los totales de su cierre («Listo cuando»)');
  await irMes(M1); await sinCargar();
  ok((await texto('#indNeto')) === C.pesos(SEMILLA['cierres/' + M1].neto) && /desde Excel/.test(await texto('#indFuente')), M1 + ' (desde Excel): neto del cierre ' + C.pesos(SEMILLA['cierres/' + M1].neto));
  ok(/no trae los días/.test(await texto('#indSemana')) && /no lo trae/.test(await texto('#indTrabajadores')) && /por día del mes/.test(await texto('#indPromedio')), 'sin días ni trabajadores: el promedio es por día del mes');
  const comp = await texto('#indComparar');
  ok((comp.match(/Contra /g) || []).length === 2 && /\+33,3 %/.test(comp), 'contra el mes anterior y contra el mismo mes del año pasado (+33,3 %)');
  await irMes(M2); await sinCargar();
  const c2 = SEMILLA['cierres/' + M2];
  ok((await texto('#indNeto')) === C.pesos(c2.neto) && /con los datos de la app/.test(await texto('#indFuente')) && /Marta/.test(await texto('#indTrabajadores')), M2 + ' (cerrado con la app): neto del cierre y detalle por trabajador');
  await tocar('#nav button[data-tab="entregas"]'); await escribir('#entMes', M2); await page.waitForSelector('#entCierreTotal');
  ok((await texto('#entCierre .kv b')).trim() === C.pesos(c2.neto), 'el mismo neto que muestra Entregas para ese mes');
  await tocar('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indNeto');

  console.log('3. Año y metas');
  await tocar('[data-act="ind-vista"][data-v="anio"]'); await page.waitForSelector('#anioResumen'); await sinCargar();
  const realAnio = [M1, M2].filter(m => m.startsWith(String(Y))).reduce((t, m) => t + SEMILLA['cierres/' + m].neto, 0) + netoMes;
  ok((await texto('#anioReal')) === C.pesos(realAnio) && (await page.locator('#anioMeses .anio-fila').count()) === 12 && await hay('#anioGrafico svg rect'), 'el año: real = suma de sus meses, 12 meses y el gráfico');
  ok(/Sin base en /.test(await texto('#anioSinBase')), 'la tarjeta de la proyección dice qué meses no tienen base en ' + (Y - 1));
  await tocar('[data-act="anio-ajustar"]'); await page.waitForSelector('#dlg[open] #pyFactor');
  await escribir('#pyFactor', 'mucho'); await page.waitForSelector('#pyError:not([hidden])');
  ok(/porcentaje/.test(await texto('#pyError')), 'un porcentaje que no es número se avisa en la hoja');
  await escribir('#pyFactor', '10'); await escribir('#pyPrecio', '5');
  const baseAnio = [M12, M13].filter(m => m.startsWith(String(Y - 1))).reduce((t, m) => t + SEMILLA['cierres/' + m].neto, 0);
  const proyAnio = [M12, M13].filter(m => m.startsWith(String(Y - 1))).reduce((t, m) => t + SEMILLA['cierres/' + m].lineas.reduce((s, l) => s + C.redondearPesos(l.neto * 1.1 * 1.05), 0), 0);
  await page.waitForFunction(t => document.querySelector('#pyVista b').textContent === t, C.pesos(proyAnio));
  ok(true, 'vista previa mientras se escribe: ' + C.pesos(proyAnio) + ' (base ' + C.pesos(baseAnio) + ')');
  const pid = await page.getAttribute('#dlg [data-pid="p2"]', 'id'); await escribir('#' + pid, '-50');
  const proyAnio2 = [M12, M13].filter(m => m.startsWith(String(Y - 1))).reduce((t, m) => t + SEMILLA['cierres/' + m].lineas.reduce((s, l) => s + C.redondearPesos(l.neto * (l.productoId === 'p2' ? 0.5 : 1.1) * 1.05), 0), 0);
  await page.waitForFunction(t => document.querySelector('#pyVista b').textContent === t, C.pesos(proyAnio2));
  await tocar('#dlg [data-act="anio-guardar"]'); await aviso(/Proyección guardada/); await page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  let doc = (await db('todo'))['proyeccion/' + Y];
  ok(doc && doc.factor === 1.1 && doc.factorPrecio === 1.05 && doc.panes.p2 === 0.5 && doc.metas.every(m => m === null) && doc.por === 'u-1001' && doc.quien, 'se guarda proyeccion/' + Y + ' (pasó las reglas): +10 %, precio +5 %, Pan de completo −50 %, sin metas aún');
  await page.waitForFunction(t => document.querySelector('#anioProyTotal b').textContent === t, C.pesos(proyAnio2));
  ok(/\+10 %/.test(await texto('#anioFactor')) && /1 pan con el suyo/.test(await texto('#anioFactor')), 'la tarjeta muestra los factores');
  await tocar('#anioFijar'); await page.waitForSelector('dialog.cfm[open]'); await tocar('dialog.cfm [data-r="1"]'); await aviso(/Metas de \d{4} fijadas/);
  doc = (await db('todo'))['proyeccion/' + Y];
  const iM = Number(MES.slice(5)) - 1, proyMes = SEMILLA['cierres/' + M12].lineas.reduce((s, l) => s + C.redondearPesos(l.neto * (l.productoId === 'p2' ? 0.5 : 1.1) * 1.05), 0);
  ok(doc.metas[iM] === proyMes && doc.metas.filter(m => m !== null).length === [M12, M13].filter(m => m.startsWith(String(Y - 1))).length, 'fijar metas: cada mes con base queda con su proyección (' + C.pesos(proyMes) + ' para ' + MES + ')');
  await tocar('#anioMeses [data-mes="' + MES + '"]'); await page.waitForSelector('#dlg[open] #pyMeta');
  await escribir('#pyMeta', 'mucho'); await tocar('#dlg [data-act="anio-meta-guardar"]'); await page.waitForSelector('#pyMetaError:not([hidden])');
  await escribir('#pyMeta', '1.000.000'); await tocar('#dlg [data-act="anio-meta-guardar"]'); await aviso(/Meta de .* guardada/);
  doc = (await db('todo'))['proyeccion/' + Y];
  ok(doc.metas[iM] === 1000000, 'la meta de un mes se escribe a mano');
  await tocar('#anioMeses [data-mes="' + MES + '"]'); await page.waitForSelector('#dlg[open] [data-act="anio-ver-mes"]'); await tocar('#dlg [data-act="anio-ver-mes"]');
  await page.waitForSelector('#indMeta'); await sinCargar();
  const pct = netoMes / 1000000 * 100;
  ok(/Meta/.test(await texto('#indMeta')) && (await texto('#indMetaPct')) === I.pctTexto(pct, false), 'el mes muestra real contra su meta (' + I.pctTexto(pct, false) + ')');
  await tocar('[data-act="ind-vista"][data-v="anio"]'); await page.waitForSelector('#anioResumen');

  console.log('4. Sin conexión, externo y tablet');
  await tocar('#anioMeses [data-mes="' + MES + '"]'); await page.waitForSelector('#dlg[open] #pyMeta'); await escribir('#pyMeta', '2'); await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  await tocar('#dlg [data-act="anio-meta-guardar"]'); await aviso(/hace falta internet/);
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true })); await page.keyboard.press('Escape');
  ok((await db('todo'))['proyeccion/' + Y].metas[iM] === 1000000, 'sin conexión no se guarda (se avisa)');
  await salir(); await entrar(FELIPE); await page.waitForSelector('#hoyTotales');
  await tocar('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indNeto'); await tocar('[data-act="ind-vista"][data-v="anio"]'); await page.waitForSelector('#anioProy');
  await tocar('[data-act="anio-ajustar"]'); await page.waitForSelector('#dlg[open] #pyFactor'); await escribir('#pyFactor', '3'); await tocar('#dlg [data-act="anio-guardar"]'); await aviso(/Proyección guardada/);
  doc = (await db('todo'))['proyeccion/' + Y];
  ok(doc.factor === 1.03 && doc.por === 'u-2002' && doc.metas[iM] === 1000000, 'el externo ajusta la proyección (las metas fijadas no cambian)');
  await salir(); await entrar(TABLET); await page.waitForSelector('#pesQuien');
  ok(!(await hay('#nav button[data-tab="indicadores"]')), 'la tablet no ve Indicadores');
  ok(errs.length === 0, 'sin errores en la consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
