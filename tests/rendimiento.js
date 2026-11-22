/* Rendimiento (PLAN, Fase 8). Con datos de tamaño real (unas 40 canastas al día), comprueba que:
   (1) la app que se descarga es liviana y cada archivo propio está en la caché sin conexión,
   (2) los cálculos de un año completo (líneas de venta, indicadores de 12 meses, Excel del año, respaldo) toman poco,
   (3) en el navegador, con dos meses de canastos, cada pantalla se dibuja rápido (lo mide la propia app: window.__pan, el mismo
       dato que muestra «Diagnóstico»).
   Los límites son holgados (un computador de GitHub Actions es más lento que uno de escritorio): avisan si algo se vuelve
   claramente lento, no miden al milisegundo. Uso: node tests/rendimiento.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { crear, APP } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now());
const sumar = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const PRODS = Array.from({ length: 12 }, (x, i) => ({ id: 'p' + i, nombre: ['Marraqueta', 'Hallulla', 'Colisa', 'Integral', 'Dobladita', 'Amasado', 'Coliza', 'Baguette', 'Molde', 'Completo', 'Frica', 'Ciabatta'][i], unidad: i % 4 === 3 ? 'un' : 'kg', orden: i + 1, activo: true }));
/* Canastos de un período, 40 por día en dos entregas, por dos trabajadores; uno de cada 40 anulado. */
function canastos(desde, hasta) {
  const l = []; let n = 0;
  for (let f = desde; f <= hasta; f = sumar(f, 1)) for (let k = 0; k < 40; k++) {
    const p = PRODS[k % 12];
    l.push({ id: 'k' + f.replace(/-/g, '') + '_' + k, fecha: f, hora: String(4 + (k >> 3)).padStart(2, '0') + ':' + String((k * 7) % 60).padStart(2, '0'), entregaN: k < 22 ? 1 : 2, productoId: p.id,
      cantidad: p.unidad === 'un' ? 120 + (n++ % 30) : Math.round((14 + (k * 37 % 90) / 10) * 100) / 100, unidad: p.unidad, trabajadorId: 't' + (1 + k % 2), anulado: k === 7, creadoPor: 'u-1001', en: Date.parse(f + 'T09:00:00Z') + k });
  }
  return l;
}
function precios(anio) {
  const l = [];
  for (const p of PRODS) for (const m of ['01', '04', '07', '10']) l.push({ id: p.id + '_c1_' + anio + '-' + m + '-01', productoId: p.id, clienteId: 'c1', neto: p.unidad === 'un' ? 120 + Number(m) : 1300 + Number(m) * 10, desde: anio + '-' + m + '-01' });
  return l;
}

(async () => {
  console.log('1. Lo que se descarga');
  const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8'), assets = JSON.parse(('[' + /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1] + ']').replace(/'/g, '"'));
  const propios = assets.filter(a => /\.(js|css|html|webmanifest)$/.test(a)), bytes = propios.reduce((t, a) => t + fs.statSync(path.join(APP, a)).size, 0);
  /* Límite: 550 KB hasta la Fase 11; 700 KB desde la Fase 12 (cobros, abonos, cotizaciones y el escritor de PDF suman unos 140 KB). Se descarga una
     vez por versión (después queda en la caché sin conexión) y Hosting lo envía comprimido (unas 4 veces menos). */
  ok(bytes < 700 * 1024, 'código propio de la app (sin el SDK ni tipografías): ' + Math.round(bytes / 1024) + ' KB, sin comprimir (límite 700 KB)');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const js = walk(path.join(APP, 'js')).filter(f => f.endsWith('.js')).map(f => './' + path.relative(APP, f).split(path.sep).join('/'));
  const faltan = js.filter(f => !assets.includes(f));
  ok(faltan.length === 0, 'cada módulo de js/ está en la caché sin conexión (sw.js, ASSETS)' + (faltan.length ? ': faltan ' + faltan.join(', ') : ''));
  const largos = js.map(f => [f, fs.readFileSync(path.join(APP, f), 'utf8').split('\n').length]).filter(x => x[1] > 320);
  ok(largos.length === 0, 'ningún archivo pasa de ~300 líneas (actualizar solo lo que cambia)' + (largos.length ? ': ' + largos.map(x => x.join(' ')).join(', ') : ''));
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  /* Las etiquetas script de index.html, sin expresión regular (CodeQL las marca al filtrar HTML; aquí es nuestro propio archivo) */
  const etiquetas = html.split('<script').slice(1).map(t => t.slice(0, t.indexOf('>')));
  const clasicos = etiquetas.filter(t => !t.includes('type="module"')).map(t => { const i = t.indexOf('src="'); return i < 0 ? '' : t.slice(i + 5, t.indexOf('"', i + 5)); });
  ok((html.match(/rel="preload"[^>]+as="font"/g) || []).length === 2 && clasicos.join() === 'guard.js,version.js', 'index.html adelanta las dos tipografías de la primera pantalla y antes del módulo solo carga guard.js y version.js (pequeños)');

  console.log('2. Cálculos de un año completo (40 canastas al día)');
  /* En Windows, import() necesita una dirección file:// (no acepta «D:\…»): pathToFileURL sirve en todos los sistemas. */
  const { pathToFileURL } = require('url'), cargar = n => import(pathToFileURL(path.join(APP, 'js', 'core', n)).href);
  const V = await cargar('ventas.js'), I = await cargar('indicadores.js'), E = await cargar('excel.js'), R = await cargar('respaldo.js');
  const anio = HOY.slice(0, 4), pes = canastos(anio + '-01-01', anio + '-12-31'), pr = precios(anio), trab = [{ id: 't1', nombre: 'Luis' }, { id: 't2', nombre: 'Marta' }];
  const medir = f => { const t = process.hrtime.bigint(), r = f(); return [r, Number(process.hrtime.bigint() - t) / 1e6]; };
  const [L, tL] = medir(() => V.lineas(pes, PRODS, pr, 'c1', 19));
  ok(L.length > 8000 && tL < 800, 'líneas de venta del año (' + pes.length + ' canastos): ' + Math.round(tL) + ' ms (límite 800)');
  const [, tI] = medir(() => { for (let m = 1; m <= 12; m++) { const mes = anio + '-' + String(m).padStart(2, '0'); I.resumenMes(mes, { pesajes: pes.filter(p => p.fecha.startsWith(mes)), productos: PRODS, precios: pr, clienteId: 'c1', iva: 19, trabajadores: trab, hoy: anio + '-12-31' }); } });
  ok(tI < 800, 'los nueve indicadores de los 12 meses: ' + Math.round(tI) + ' ms (límite 800)');
  const [xl, tX] = medir(() => E.bytes(E.libro({ desde: anio + '-01-01', hasta: anio + '-12-31', pesajes: pes, productos: PRODS, trabajadores: trab, precios: pr, cliente: { id: 'c1', nombre: 'Supermercado' }, iva: 19 })));
  ok(tX < 4000, 'Excel de un año entero (' + Math.round(xl.length / 1024) + ' KB): ' + Math.round(tX) + ' ms (límite 4.000)');
  const [txt, tR] = medir(() => JSON.stringify(R.armar({ pesajes: pes, productos: PRODS, precios: pr }, { anio: Number(anio) }), null, 1));
  ok(tR < 1500, 'archivo de respaldo de un año (' + Math.round(txt.length / 1024) + ' KB): ' + Math.round(tR) + ' ms (límite 1.500)');
  ok(pes.length < 50000 / 2, 'un respaldo del año (' + pes.length + ' canastos) usa menos de la mitad de la cuota diaria gratuita de lecturas (50 mil): por eso se respalda por año');

  console.log('3. Cada pantalla se dibuja rápido, con dos meses de canastos');
  const desde = V.rangoMes(V.sumarMeses(HOY.slice(0, 7), -1)).desde, datos = canastos(desde, HOY);
  const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 }, 'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
    'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 }, 'trabajadores/t1': { nombre: 'Luis Soto', activo: true, en: 1 }, 'trabajadores/t2': { nombre: 'Marta Díaz', activo: true, en: 1 } };
  PRODS.forEach(p => { SEMILLA['productos/' + p.id] = Object.assign({ en: 1 }, p); delete SEMILLA['productos/' + p.id].id; });
  precios(anio).concat(precios(String(Number(anio) - 1))).forEach(p => { SEMILLA['precios/' + p.id] = Object.assign({ en: 1 }, p); delete SEMILLA['precios/' + p.id].id; });
  datos.forEach(p => { const d = Object.assign({}, p); delete d.id; SEMILLA['pesajes/' + p.id] = d; });
  const srv = crear({ fake: true }), URL = await srv.abrir(), br = await chromium.launch(), errores = [];
  const ctx = await br.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  page.on('pageerror', e => errores.push(e.message));
  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => localStorage.setItem('fake.db', s), JSON.stringify(SEMILLA));
  await fakeGoogle(page); await page.click('#btnGoogle'); await page.waitForSelector('#hoyTotales');
  const tocar = s => page.click(s);
  await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entTotal');
  await tocar('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indNeto');
  await tocar('[data-act="ind-vista"][data-v="anio"]'); await page.waitForSelector('#anioProy'); await page.waitForTimeout(300);
  await tocar('#nav button[data-tab="mas"]'); await tocar('#irRegistro'); await page.waitForSelector('#regResumen');
  await page.click('.volver'); await tocar('[data-act="diag"]'); await page.waitForSelector('#dlg[open] #diag');
  const pan = await page.evaluate(() => window.__pan), diag = await page.textContent('#diag');
  const LIM = 400;
  for (const [id, t] of [['inicio', 'Hoy'], ['entregas', 'Entregas (' + datos.filter(p => p.fecha.slice(0, 7) === HOY.slice(0, 7)).length + ' canastos del mes)'], ['indicadores', 'Números (mes y año)'], ['registro', 'Registro general']]) {
    const ms = pan.dibujo[id];
    ok(typeof ms === 'number' && ms < LIM, t + ': se dibuja en ' + (typeof ms === 'number' ? Math.round(ms) : '?') + ' ms (límite ' + LIM + ')');
  }
  ok(pan.apertura > 0 && pan.apertura < 8000 && /Apertura de la app\d+,\d s/.test(diag) && /Pantalla más lenta.+ms/.test(diag), 'el Diagnóstico muestra la apertura (' + (pan.apertura / 1000).toFixed(1) + ' s aquí) y la pantalla más lenta');
  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores[0] : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
