/* Plan de producción del día de punta a punta (Fase 10), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   armar el plan de hoy con «Usar sugerencias» (= el cálculo a mano de core/plan.js con los mismos 4 días), tandas en vivo y guardadas,
   Hoy al momento (falta, %, verde desde 95 %, aviso sobre 110 %, fuera del plan, totales = «Pesado hoy»), cambiarlo durante el día, el plan
   de mañana (armar y quitar), un día pasado que solo se mira, el externo y la tablet (plan de hoy con tandas y «faltan …» en el botón de
   cada pan; no lee el de mañana ni escribe planes, ni con peticiones directas). Uso: node tests/plan-e2e.js */
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const sumar = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const HOY = dia(Date.now()), MANANA = sumar(HOY, 1), ANTES = sumar(HOY, -3);
let n = 0;
const pes = (fecha, prod, cant, unidad, mas) => ['pesajes/e' + (++n), Object.assign({ fecha, hora: '05:' + String(10 + n % 50).padStart(2, '0'), entregaN: 1, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.now() - 86400000 }, mas || {})];
/* Los 4 mismos días de la semana anteriores: el de hace 2 semanas no se trabajó. Hallulla: 55,75 · — · 60 · 50,25 → 55,33 → 4 tandas de 16,5 = 66 kg.
   Completo: 392 · — · 400 · 380 → 390,67 → 3 tandas de 192 = 576 un. Marraqueta (sin receta): 40 · — · 35,5 · 44 → 39,83 → 40 kg. */
const MUESTRA = [[sumar(HOY, -7), [['hal', 18.5], ['hal', 17.25], ['hal', 20], ['com', 192, 'un'], ['com', 200, 'un'], ['marr', 40]]],
  [sumar(HOY, -21), [['hal', 60], ['com', 400, 'un'], ['marr', 35.5]]], [sumar(HOY, -28), [['hal', 50.25], ['hal', 99, 'kg', { anulado: true }], ['com', 380, 'un'], ['marr', 44]]]];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/hal': { nombre: 'Hallulla', unidad: 'kg', orden: 1, activo: true, en: 1 },
  'productos/com': { nombre: 'Pan de completo', unidad: 'un', pesoRef: 100, orden: 2, activo: true, en: 1 },
  'productos/marr': { nombre: 'Marraqueta', unidad: 'kg', orden: 3, activo: true, en: 1 },
  'precios/hal_c1_2026-01-01': { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: '2026-01-01', en: 1 },
  'precios/com_c1_2026-01-01': { productoId: 'com', clienteId: 'c1', neto: 110, desde: '2026-01-01', en: 1 },
  'precios/marr_c1_2026-01-01': { productoId: 'marr', clienteId: 'c1', neto: 1450, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 },
  'insumos/har': { nombre: 'Harina', unidad: 'kg', activo: true, en: 1 },
  'recetas/hal_2026-01-01': { productoId: 'hal', desde: '2026-01-01', rendimiento: 16.5, items: [{ insumoId: 'har', cantidad: 12.5 }], por: 'u-1001', en: 1 },
  'recetas/com_2026-01-01': { productoId: 'com', desde: '2026-01-01', rendimiento: 192, items: [{ insumoId: 'har', cantidad: 12 }], por: 'u-1001', en: 1 },
  ['planes/' + ANTES]: { fecha: ANTES, items: [{ productoId: 'hal', cantidad: 50, unidad: 'kg', tandas: 3 }], nota: 'Día de lluvia', por: 'u-1001', quien: 'Rosa Dueña', en: 1 } },
Object.fromEntries([].concat(...MUESTRA.map(([f, l]) => l.map(x => pes(f, x[0], x[1], x[2] || 'kg', x[3]))),
  [pes(HOY, 'hal', 18.5, 'kg'), pes(HOY, 'hal', 17.25, 'kg'), pes(HOY, 'com', 192, 'un'), pes(HOY, 'marr', 22, 'kg'), pes(ANTES, 'hal', 40, 'kg')])));

(async () => {
  const L = await import('../APP/js/core/plan.js'), P = await import('../APP/js/core/pesaje.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block' }), page = await ctx.newPage();
  const errs = global.__errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async (quien, sel) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(sel || '#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const escribir = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); };
  const fila = id => '#hoyPlan .plan-f[data-pan="' + id + '"]';
  const productos = async () => (await docs('productos'));
  /* Lo que debería decir Hoy con lo que hay en la base: core/plan.js con el plan y los canastos de hoy guardados. */
  const esperado = async f => { const plan = await db('leer', 'planes/' + f), p = (await docs('pesajes')).filter(x => x.fecha === f); return L.avance(plan, p, await productos()); };

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. Armar el plan de hoy con las sugerencias');
  await entrar(null, '#hoyTotales'); await page.waitForSelector('#hoyPlan');
  ok(/Sin plan para hoy/.test(await texto('#hoyPlan')) && (await texto('#planArmar')) === 'Armar plan', 'Hoy: «Plan del día» sin plan, con «Armar plan»');
  ok(/Plan de mañana .*sin plan/.test(await texto('#planManana')), 'y el aviso «Plan de mañana: sin plan»');
  const antes = await db('lecturas');
  await tocar('#planArmar'); await page.waitForSelector('#dlg[open] #pl-hal');
  await page.waitForFunction(() => /^Sugerencia:/.test((document.querySelector('#plSug') || {}).textContent || ''));
  const lecturas = (await db('lecturas')) - antes;
  const sug = L.sugerencias(await Promise.all(L.fechasMuestra(HOY).map(async f => ({ fecha: f, pesajes: (await docs('pesajes')).filter(x => x.fecha === f) }))), await productos(), await docs('recetas'), HOY);
  const s = id => sug.find(x => x.productoId === id);
  ok(s('hal').sugerida === 66 && s('com').sugerida === 576 && s('marr').sugerida === 40, 'el cálculo a mano: hallulla 66 kg (4 tandas), completo 576 un (3 tandas), marraqueta 40 kg');
  ok(/promedio de 3 /.test(await texto('#plSug')) && /Sugerido: 66 kg · 4 tandas \(promedio de 3 días: 55,33 kg\)/.test(await texto('#plI-hal')) && /Sugerido: 40 kg \(promedio/.test(await texto('#plI-marr')),
    'la hoja muestra la sugerencia de cada pan con «promedio de N días» (el día sin pesajes no cuenta)');
  ok(lecturas <= 4 + 13, 'la sugerencia lee solo los 4 días de muestra (' + lecturas + ' lecturas: una consulta por fecha)');
  await tocar('#plUsar');
  ok((await page.inputValue('#pl-hal')) === '66' && (await page.inputValue('#pl-com')) === '576' && (await page.inputValue('#pl-marr')) === '40', '«Usar sugerencias» llena los campos vacíos');
  await escribir('#pl-hal', '70,25'); await escribir('#pl-marr', '');
  ok(/^= 4,3 tandas/.test(await texto('#plI-hal')), 'las tandas cambian en vivo al escribir (70,25 ÷ 16,5 = 4,3)');
  await page.fill('#plNota', 'Viernes: más hallulla'); await tocar('#dlg [data-act="plan-guardar"]'); await cerrada();
  const g = await db('leer', 'planes/' + HOY);
  ok(g && JSON.stringify(g.items) === JSON.stringify([{ productoId: 'hal', cantidad: 70.25, unidad: 'kg', tandas: 4.3 }, { productoId: 'com', cantidad: 576, unidad: 'un', tandas: 3 }]) && g.nota === 'Viernes: más hallulla' && g.quien === 'Rosa Dueña' && g.por === 'u-1001',
    'se guarda con las tandas calculadas (la marraqueta en blanco no va), la nota y a nombre de quien lo arma');

  console.log('2. Hoy al momento');
  await page.waitForSelector(fila('hal'));
  let E = await esperado(HOY);
  ok((await texto(fila('hal') + ' .plan-falta')) === L.lineaCorta(E.filas[0]) && L.lineaCorta(E.filas[0]) === 'faltan 34,5 kg' && /50 %/.test(await texto(fila('hal') + ' .plan-pct')), 'hallulla: 35,75 de 70,25 → «faltan 34,5 kg» y 50 %');
  ok(/4,3 tandas/.test(await texto(fila('hal'))) && /3 tandas/.test(await texto(fila('com'))), 'cada pan con sus tandas');
  ok(/Marraqueta/.test(await texto('#planFuera')) && /22 kg/.test(await texto('#planFuera')), 'la marraqueta pesada sin estar en el plan sale «fuera del plan»');
  const R = P.resumen((await docs('pesajes')).filter(x => x.fecha === HOY), await productos(), []);
  ok(Math.round((E.totales.pesado.kg + E.totales.fuera.kg) * 100) === Math.round(R.kg * 100) && /Pesado del plan.*35,75 kg y 192 un/.test(await texto('#planTotales')), 'lo pesado del plan más lo de fuera da los kilos de «Pesado hoy»');
  const [r1] = [pes(HOY, 'hal', 31, 'kg')]; await db('poner', r1[0], r1[1]);   // 66,75 de 70,25 = 95,02 %
  await page.waitForFunction(s => /Cumplido/.test((document.querySelector(s) || {}).textContent || ''), fila('hal'));
  ok((await texto(fila('hal') + ' .plan-falta')) === '✓ cumplido' && (await page.$(fila('hal') + '.est-cumplido .badge.ok')) !== null, 'un canasto más (95 %): verde, «✓ cumplido», sin recargar');
  const [r2] = [pes(HOY, 'hal', 11, 'kg')]; await db('poner', r2[0], r2[1]);   // 77,75 de 70,25 = 110,7 %
  await page.waitForFunction(s => /Sobre el plan/.test((document.querySelector(s) || {}).textContent || ''), fila('hal'));
  E = await esperado(HOY);
  ok((await texto(fila('hal') + ' .plan-falta')) === 'sobre el plan (+ 7,5 kg)' && E.filas[0].estado === 'sobre', 'sobre 110 %: aviso «sobre el plan (+ 7,5 kg)»');
  await db('poner', r2[0], Object.assign({}, r2[1], { anulado: true }));
  await page.waitForFunction(s => /cumplido/.test((document.querySelector(s + ' .plan-falta') || {}).textContent || ''), fila('hal'));
  ok(true, 'al anular ese canasto vuelve a «cumplido» (los anulados no cuentan)');

  console.log('3. Cambiar el plan durante el día');
  await tocar('#planArmar'); await page.waitForSelector('#dlg[open] #pl-com');
  ok((await page.inputValue('#pl-hal')) === '70,25' && (await page.inputValue('#pl-com')) === '576' && (await page.$('#dlg [data-act="plan-quitar"]')) !== null, '«Cambiar plan» abre con lo guardado (y ofrece «Quitar plan»)');
  await escribir('#pl-com', '12,5'); await tocar('#dlg [data-act="plan-guardar"]');
  ok(/sin decimales/.test(await texto('#dlg .form-error')), 'unidades con decimales: error en la hoja, no se guarda');
  await escribir('#pl-com', '384'); await tocar('#dlg [data-act="plan-guardar"]'); await cerrada();
  await page.waitForFunction(s => /384 un · 2 tandas/.test((document.querySelector(s) || {}).textContent || ''), fila('com'));
  ok((await db('leer', 'planes/' + HOY)).items[1].tandas === 2, 'se cambia y se recalculan las tandas (384 ÷ 192 = 2)');

  console.log('4. El plan de mañana');
  await tocar('#planManana button'); await page.waitForSelector('#dlg[open] #pl-hal');
  ok(/Plan de mañana/.test(await texto('#dlg .sheet-h h2')), 'se arma desde «Plan de mañana»');
  await page.waitForFunction(() => !/Calculando/.test((document.querySelector('#plSug') || {}).textContent || ''));
  ok(/Ninguno de los 4 .* anteriores tuvo pesajes/.test(await texto('#plSug')) && (await page.$('#plUsar[disabled]')) !== null, 'sin días con pesajes para ese día de la semana: no hay sugerencia (el botón queda apagado)');
  await escribir('#pl-hal', '33'); await tocar('#dlg [data-act="plan-guardar"]'); await cerrada();
  await page.waitForFunction(() => /1 pan/.test((document.querySelector('#planManana') || {}).textContent || ''));
  ok((await db('leer', 'planes/' + MANANA)).items[0].tandas === 2, 'queda guardado con sus tandas (33 ÷ 16,5 = 2) y Hoy dice «Plan de mañana: 1 pan»');
  ok(/Pan de completo/.test(await texto(fila('com'))) && (await db('leer', 'planes/' + HOY)).items.length === 2, 'el plan de hoy no cambia');
  await tocar('#planManana button'); await page.waitForSelector('#dlg [data-act="plan-quitar"]'); await tocar('#dlg [data-act="plan-quitar"]'); await tocar('dialog.cfm [data-r="1"]'); await cerrada();
  await page.waitForFunction(() => /sin plan/.test((document.querySelector('#planManana') || {}).textContent || ''));
  ok((await db('leer', 'planes/' + MANANA)) === null, '«Quitar plan» lo borra (con confirmación)');

  console.log('5. Un día pasado solo se mira');
  await escribir('#hoyFecha', ANTES); await page.waitForSelector(fila('hal'));
  ok(!(await page.$('#planArmar')) && !(await page.$('#planManana')) && /Ese día ya pasó/.test(await texto('#hoyPlan')) && /Día de lluvia/.test(await texto('#hoyPlan')), 'se ve el plan de ese día con su nota, sin «Cambiar plan»');
  ok((await texto(fila('hal') + ' .plan-falta')) === 'faltan 10 kg' && /80 %/.test(await texto(fila('hal') + ' .plan-pct')), 'y su comparación con lo pesado ese día (40 de 50 kg, 80 %)');
  ok((await db('pedir', 'set', 'planes/' + ANTES, { fecha: ANTES, items: [{ productoId: 'hal', cantidad: 60, unidad: 'kg', tandas: null }], por: 'u-1001', quien: 'Rosa', en: { __ts: true } })) === false && (await db('pedir', 'delete', 'planes/' + ANTES)) === false,
    'ni con una petición directa se cambia o se quita (reglas)');
  await tocar('[data-act="hoy-dia"][data-d="0"]'); await page.waitForSelector('#planArmar');

  console.log('6. El externo');
  await salir(); await entrar(FELIPE, '#hoyTotales'); await page.waitForSelector(fila('hal'));
  ok((await texto('#planArmar')) === 'Cambiar plan' && /Rosa Dueña/.test(await texto('#hoyPlan')), 'el externo ve el plan de hoy y lo puede cambiar');
  await tocar('#planArmar'); await page.waitForSelector('#dlg[open] #pl-hal'); await escribir('#pl-hal', '72'); await tocar('#dlg [data-act="plan-guardar"]'); await cerrada();
  ok((await db('leer', 'planes/' + HOY)).quien === 'Felipe Externo', 'y queda a su nombre');

  console.log('7. La tablet');
  await salir(); await entrar(TABLET, '#pesQuien'); await tocar('#pesQuien .pes-op'); await page.waitForSelector('#pesPlan');
  E = await esperado(HOY);
  ok(/Plan de hoy/.test(await texto('#pesPlan h2')) && /72 kg · 4,4 tandas/.test(await texto('#pesPlan')) && /384 un · 2 tandas/.test(await texto('#pesPlan')), 've el plan de hoy con las tandas guardadas (sin leer recetas)');
  ok((await texto('#pesPanes [data-id="hal"] small')) === L.lineaCorta(E.filas.find(f => f.productoId === 'hal')) && (await texto('#pesPanes [data-id="com"] small')) === 'faltan 192 un' && (await texto('#pesPanes [data-id="marr"] small')) === 'kilos',
    'en el botón de cada pan del plan, lo que falta («faltan 192 un»); la marraqueta (fuera del plan) sigue con «kilos»');
  await tocar('#pesPanes [data-id="com"]'); for (const k of ['1', '9', '2']) await tocar('#pesTeclado [data-k="' + k + '"]'); await tocar('#pesGuardar');
  await page.waitForFunction(() => /cumplido/.test((document.querySelector('#pesPanes [data-id="com"] small') || {}).textContent || ''));
  ok((await texto('#pesPanes [data-id="com"] small')) === '✓ cumplido' && (await page.$('#pesPlan .plan-f[data-pan="com"].est-cumplido')) !== null, 'al pesar el resto, el botón dice «✓ cumplido» y el plan lo marca en verde');
  ok(!/\$|precio|costo/i.test(await texto('#view')), 'sin precios ni costos en la pantalla');
  ok((await db('pedir', 'get', 'planes/' + MANANA)) === false && (await db('pedir', 'list', 'planes')) === false && (await db('pedir', 'get', 'planes/' + ANTES)) === false, 'no puede leer el plan de mañana, ni los de otros días, ni la lista');
  ok((await db('pedir', 'set', 'planes/' + HOY, { fecha: HOY, items: [{ productoId: 'hal', cantidad: 1, unidad: 'kg', tandas: null }], por: 'u-3003', quien: 'Tablet', en: { __ts: true } })) === false && (await db('pedir', 'delete', 'planes/' + HOY)) === false,
    'ni escribe ni quita planes (reglas)');
  await db('borrar', 'planes/' + HOY);
  await page.waitForFunction(() => !document.querySelector('#pesPlan'));
  ok((await texto('#pesPanes [data-id="hal"] small')) === 'kilos', 'sin plan, la tablet queda como siempre');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); console.error('errores de la página: ' + (global.__errs || []).join(' | ')); process.exit(1); });
