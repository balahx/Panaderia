/* Cierres mensuales de punta a punta (Fase 6), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   importar tres Excel reales (comprimidos, de LibreOffice y openpyxl) con revisión y emparejamiento de panes, que cada mes cuadre
   con el total de su Excel («Listo cuando»), un mes ya cerrado no se reimporta, Entregas y Hoy de un mes cerrado (sin anotar ni corregir),
   «Cerrar mes» con los datos de la app (IVA = 19 % del neto del mes), el mes en curso no se cierra, reabrir (solo dueños),
   el externo, la tablet y la plantilla. Uso: node tests/cierres-e2e.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js'), { leer } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), MES = HOY.slice(0, 7), JUN = '2026-06';
const FX = n => path.join(__dirname, 'fixtures', n);
const pes = (id, fecha, n, prod, cant, unidad, mas) => ['pesajes/' + id, Object.assign({ fecha, hora: '06:00', entregaN: n, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.parse(fecha + 'T12:00:00Z') }, mas || {})];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 }, 'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true, en: 1 }, 'productos/p2': { nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true, en: 1 },
  'productos/p3': { nombre: 'Hallulla', unidad: 'kg', orden: 3, activo: true, en: 1 }, 'productos/p4': { nombre: 'Colisa', unidad: 'kg', orden: 4, activo: false, en: 1 },
  'productos/p5': { nombre: 'Dobladita', unidad: 'kg', orden: 5, activo: true, en: 1 },
  'precios/p1_c1_2026-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1450, desde: '2026-01-01', en: 1 }, 'precios/p2_c1_2026-01-01': { productoId: 'p2', clienteId: 'c1', neto: 120, desde: '2026-01-01', en: 1 },
  'precios/p3_c1_2026-01-01': { productoId: 'p3', clienteId: 'c1', neto: 1512.61, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 } },
Object.fromEntries([pes('j1', '2026-06-10', 1, 'p1', 20.5, 'kg'), pes('j2', '2026-06-10', 1, 'p2', 100, 'un'), pes('j3', '2026-06-10', 2, 'p1', 18.35, 'kg'), pes('j4', '2026-06-11', 1, 'p3', 10.33, 'kg'),
  pes('j5', '2026-06-11', 1, 'p1', 50, 'kg', { anulado: true }), pes('h1', HOY, 1, 'p1', 12, 'kg')]));

(async () => {
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async quien => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel), hay = async sel => !!(await page.$(sel));
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const si = async () => { await page.waitForSelector('dialog.cfm[open]'); await tocar('dialog.cfm [data-r="1"]'); };
  const escribir = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); };
  const irCierres = async (actual) => {
    await tocar('#nav button[data-tab="mas"]'); await tocar('#irCierres'); await page.waitForSelector('#cieMeses');
    if (!actual) while (!/2026/.test(await texto('#view h1'))) await tocar('[data-act="cie-anio"][data-d="-1"]');   // los Excel de prueba son de 2026
  };
  const irEntregas = async mes => { await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entMes'); if (mes) await escribir('#entMes', mes); };

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. Cierres: la lista del año');
  await entrar(); await page.waitForSelector('#hoyTotales');
  await irCierres(true);
  const filas = await page.locator('#cieMeses [data-act="cie-ver"]').count();
  ok(filas === Number(MES.slice(5)) && /En curso/.test(await texto('#cieMeses [data-mes="' + MES + '"]')) && (MES.endsWith('-01') || /Sin cerrar/.test(await texto('#cieMeses [data-mes="' + MES.slice(0, 4) + '-01"]'))), 'un renglón por mes hasta el actual: el de hoy «En curso», los anteriores «Sin cerrar»');

  console.log('2. Importar tres Excel (enero, febrero, marzo y octubre)');
  while (!/2026/.test(await texto('#view h1'))) await tocar('[data-act="cie-anio"][data-d="-1"]');
  await page.setInputFiles('#cieArchivo', [FX('cierre-octubre-2026.xlsx'), FX('Cierres 2026.xlsx'), FX('marzo.xlsx')]);
  await page.waitForSelector('#impResumen');
  const titulos = await page.locator('.imp-mes h2').allTextContents();
  ok(titulos.join() === 'Octubre 2026,Enero 2026,Febrero 2026,Marzo 2026', 'cuatro tablas, cada una con su mes: ' + titulos.join(', '));
  ok(/Coliza/.test(await texto('.imp-mes[data-i="0"]')) && /Falta elegir el pan/.test(await texto('.imp-mes[data-i="0"]')) && /Pan amasado/.test(await texto('.imp-mes[data-i="3"]')), 'los nombres que no están en el catálogo quedan por elegir («Coliza», «Pan amasado»)');
  ok(/✓/.test(await texto('#impCuadra0')) && /✓/.test(await texto('#impCuadra1')) && /✓/.test(await texto('#impCuadra3')), 'la suma de las filas de cada mes es igual al total de su Excel');
  ok(/Importar 2 meses/.test(await texto('#impConfirmar')), 'mientras falten panes, solo enero y febrero están listos');
  ok((await page.inputValue('select[data-clave="marraqueta"] >> nth=0')) === 'p1' && (await page.inputValue('select[data-clave="dobladita"]')) === 'p5', '«Marraqueta» y «Dobladitas» se emparejan solas');
  ok(/Parecidos/.test(await page.innerHTML('select[data-clave="coliza"]')) && /Colisa \(desactivado\)/.test(await page.innerHTML('select[data-clave="coliza"] optgroup')), 'para «Coliza» sugiere «Colisa» (desactivada)');
  await page.selectOption('select[data-clave="coliza"]', 'p4');
  await page.selectOption('select[data-clave="amasado"]', '+nuevo');
  await page.waitForFunction(() => /Importar 4 meses/.test(document.getElementById('impConfirmar').textContent));
  ok((await texto('#impTotal0')).includes(C.pesos(3632570 + Math.round(3632570 * 0.19))), 'octubre: total = neto + 19 % del neto del mes');
  await tocar('#impConfirmar'); await si(); await aviso(/4 meses importados/);
  await page.waitForSelector('#cieResultado');
  const cie = Object.fromEntries((await docs('cierres')).map(d => [d.id, d]));
  const esperados = { '2026-01': 2889060, '2026-02': 2470935, '2026-03': 2688063, '2026-10': 3632570 };
  ok(Object.keys(esperados).every(m => cie[m] && cie[m].cerrado === true && cie[m].origen === 'excel' && cie[m].neto === esperados[m]), '«Listo cuando»: los 4 meses quedaron cerrados con el mismo neto que el total de su Excel');
  ok(cie['2026-10'].kg === 2203 && cie['2026-10'].un === 3200 && cie['2026-10'].ivaMonto === Math.round(3632570 * 0.19) && cie['2026-10'].archivo === 'cierre-octubre-2026.xlsx' && cie['2026-10'].quien === 'Rosa Dueña', 'octubre: kilos, unidades, IVA del mes, archivo y quién importó');
  const nuevo = (await docs('productos')).find(p => p.nombre === 'Pan amasado');
  ok(nuevo && nuevo.activo === false && cie['2026-03'].lineas.some(l => l.productoId === nuevo.id), '«Pan amasado» se creó en el catálogo (desactivado) y su venta quedó en marzo');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('pan.importarNombres'))).coliza === 'p4', 'la elección «Coliza → Colisa» queda recordada en este equipo');
  ok(/Cerrado/.test(await texto('#cieMeses [data-mes="2026-10"]')) && /4 de/.test(await texto('#cieMeses .stats')), 'en la lista, octubre aparece cerrado');

  console.log('3. Un mes cerrado no se vuelve a importar');
  await page.setInputFiles('#cieArchivo', [FX('cierre-octubre-2026.xlsx')]); await page.waitForSelector('#impResumen');
  ok(/ya está cerrado/.test(await texto('.imp-mes[data-i="0"]')) && await page.isDisabled('#impConfirmar') && (await page.inputValue('select[data-clave="coliza"]')) === 'p4', 'avisa que ya está cerrado y no deja importarlo (y recordó «Colisa»)');
  await tocar('.volver'); await page.waitForSelector('#cieMeses');

  console.log('4. El detalle, Entregas y Hoy de un mes cerrado');
  await tocar('#cieMeses [data-mes="2026-10"]'); await page.waitForSelector('#dlg[open] #cieDetalle');
  ok((await texto('#cieTotal b')) === C.pesos(cie['2026-10'].total) && /Colisa/.test(await texto('#cieDetalle')) && /en el Excel: Coliza/.test(await texto('#cieDetalle')) && await hay('#dlg [data-act="cie-reabrir"]'), 'detalle por pan, total y, para la dueña, «Reabrir»');
  await tocar('#dlg [data-act="ir"][data-tab="entregas"]'); await page.waitForSelector('#entCierre');
  ok((await page.inputValue('#entMes')) === '2026-10' && (await texto('#entCierreTotal b')) === C.pesos(cie['2026-10'].total) && await hay('#entDeExcel') && !(await hay('#entCerrar')), 'Entregas de octubre muestra el cierre importado (sin entregas en la app)');
  await tocar('#nav button[data-tab="inicio"]'); await page.waitForSelector('#hoyFecha'); await escribir('#hoyFecha', '2026-10-15');
  await page.waitForSelector('#hoyCerrado');
  ok(!(await hay('#hoyAnotar')) && /desde Excel/.test(await texto('#hoyCerrado')), 'Hoy en un día de octubre: «está cerrado», sin «Anotar canasto»');
  ok(!(await db('pedir', 'set', 'pesajes/x1', { fecha: '2026-10-15', hora: '06:00', entregaN: 1, productoId: 'p1', cantidad: 1, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-1001', en: { __ts: true } })), 'ni con una petición directa se anota en un mes cerrado');

  console.log('5. «Cerrar mes» con los datos de la app');
  await irEntregas(MES); await page.waitForSelector('#entTotal');
  ok(await hay('#entCerrarCuando') && !(await hay('#entCerrar')), 'el mes en curso todavía no se puede cerrar');
  await escribir('#entMes', JUN); await page.waitForSelector('#entCerrar');
  const pj = (await docs('pesajes')).filter(p => p.fecha.startsWith(JUN)), T = V.totales(V.lineas(pj, await docs('productos'), await docs('precios'), 'c1', 19));
  ok((await texto('#entTotal b')) === C.pesos(T.total) && T.iva === Math.round(T.neto * 0.19) && /% del neto/.test(await texto('#entMonto')), 'Entregas de junio: IVA = 19 % del neto del mes (' + C.pesos(T.total) + ')');
  await tocar('#entCerrar'); await page.waitForSelector('dialog.cfm[open]');
  ok((await texto('dialog.cfm')).includes(C.pesos(T.neto)) && (await texto('dialog.cfm')).includes(C.pesos(T.iva)), 'antes de cerrar muestra neto e IVA del mes');
  await tocar('dialog.cfm [data-r="1"]'); await aviso(/quedó cerrado/); await page.waitForSelector('#entCierre');
  const cj = (await docs('cierres')).find(d => d.id === JUN);
  ok(cj && cj.origen === 'app' && cj.neto === T.neto && cj.ivaMonto === Math.round(T.neto * 0.19) && cj.total === T.total && cj.canastos === 4 && cj.dias === 2 && cj.kg === 49.18 && cj.un === 100, 'quedó el cierre de junio: neto, IVA del mes, canastos (sin el anulado), días, kilos y unidades');
  ok((await texto('#entCierreTotal b')) === C.pesos(T.total) && !(await hay('#entCerrar')) && await hay('#entDias'), 'Entregas muestra el cierre y sigue mostrando los días');
  await tocar('[data-act="ir"][data-dia="2026-06-10"]'); await page.waitForSelector('#hoyCerrado');
  await tocar('#hoyEntregas .entrega[data-n="1"] summary'); await tocar('#hoyEntregas .entrega[data-n="1"] .pes-fila'); await page.waitForSelector('#dlg[open] #canDetalle');
  ok(await hay('#canCerrado') && !(await hay('#dlg [data-act="can-corregir"]')), 'un canasto de junio ya no se corrige (lo dice la ficha)');
  await page.keyboard.press('Escape');

  console.log('6. Reabrir (solo dueños)');
  await irCierres(); await tocar('#cieMeses [data-mes="' + JUN + '"]'); await page.waitForSelector('#dlg[open] [data-act="cie-reabrir"]');
  await tocar('#dlg [data-act="cie-reabrir"]'); await si(); await aviso(/reabierto/);
  const rj = (await docs('cierres')).find(d => d.id === JUN);
  ok(rj.cerrado === false && rj.reabiertoQuien === 'Rosa Dueña' && rj.reabiertoPor === 'u-1001' && rj.neto === T.neto, 'junio quedó reabierto, con constancia, y sus montos guardados');
  await page.waitForFunction(() => /Reabierto/.test(document.querySelector('#cieMeses [data-mes="2026-06"]').textContent));
  await tocar('#nav button[data-tab="inicio"]'); await escribir('#hoyFecha', '2026-06-10'); await page.waitForSelector('#hoyAnotar');
  ok(!(await hay('#hoyCerrado')), 'reabierto, en junio se vuelve a anotar');
  await salir();

  console.log('7. El externo');
  await entrar(FELIPE); await page.waitForSelector('#hoyTotales'); await irCierres();
  await tocar('#cieMeses [data-mes="2026-10"]'); await page.waitForSelector('#dlg[open] #cieDetalle');
  ok(!(await hay('#dlg [data-act="cie-reabrir"]')) && /Solo un dueño/.test(await texto('#dlg')), 've el cierre de octubre pero no puede reabrirlo');
  ok(!(await db('pedir', 'update', 'cierres/2026-10', Object.assign({}, cie['2026-10'], { cerrado: false, reabiertoPor: 'u-2002', reabiertoQuien: 'Felipe', reabiertoEn: { __ts: true }, en: { __ts: true } }))), 'ni con una petición directa');
  await page.keyboard.press('Escape');
  await irEntregas(JUN); await page.waitForSelector('#entCerrar'); await page.waitForSelector('#entReabierto');
  await tocar('#entCerrar'); await si(); await aviso(/quedó cerrado/);
  const fj = (await docs('cierres')).find(d => d.id === JUN);
  ok(fj.cerrado === true && fj.quien === 'Felipe Externo' && fj.reabiertoQuien === 'Rosa Dueña', 'el externo vuelve a cerrar junio (queda la constancia de la reapertura)');
  await salir();

  console.log('8. La tablet y la plantilla');
  await entrar(TABLET); await page.waitForSelector('#pesQuien');
  await tocar('#nav button[data-tab="mas"]');
  ok(!(await hay('#irCierres')) && !(await db('pedir', 'get', 'cierres/2026-10')) && !(await db('pedir', 'list', 'cierres')), 'la tablet no ve los cierres (ni con peticiones directas)');
  await salir(); await entrar(); await page.waitForSelector('#hoyTotales'); await irCierres();
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), tocar('[data-act="cie-plantilla"]')]);
  const pl = leer(fs.readFileSync(await d.path()));
  ok(d.suggestedFilename() === 'plantilla-cierres.xlsx' && pl.hojas.Cierres.filas[0].join() === 'Mes,Pan,Unidad,Cantidad,Precio neto,Neto' && pl.hojas.Cierres.filas.some(f => f[1] === 'Marraqueta'), 'la plantilla se descarga con los panes del catálogo');
  await page.setInputFiles('#cieArchivo', [{ name: 'notas.xlsx', mimeType: 'text/plain', buffer: Buffer.from('no soy un excel') }]); await page.waitForSelector('#impAvisos');
  ok(/no es un archivo de Excel/i.test(await texto('#impAvisos')) && await page.isDisabled('#impConfirmar'), 'un archivo que no es Excel se avisa y no se importa nada');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await br.close(); srv.close(); console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
