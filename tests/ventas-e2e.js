/* Ventas para los dueños de punta a punta (Fase 5), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   Entregas del mes, venta sin precio con aviso, anotar en fecha pasada, registro general con filtros y bitácora, corrección con
   constancia a nombre de quien corrige, Excel que cuadra con las entregas («Listo cuando»), respaldo con su franja semanal,
   sin conexión, el externo y la tablet. Uso: node tests/ventas-e2e.js */
const fs = require('fs');
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js'), { leer, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), ANTES = dia(Date.now() - 3 * 86400000), V5 = dia(Date.now() - 5 * 86400000), MES = ANTES.slice(0, 7);
const pes = (id, fecha, hora, n, prod, cant, unidad, mas) => ['pesajes/' + id, Object.assign({ fecha, hora, entregaN: n, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.parse(fecha + 'T12:00:00Z') }, mas || {})];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true, en: 1 },
  'productos/p2': { nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true, en: 1 },
  'productos/p3': { nombre: 'Hallulla', unidad: 'kg', orden: 3, activo: true, en: 1 },
  'precios/p1_c1_2026-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2026-01-01', en: 1 },
  'precios/p2_c1_2026-01-01': { productoId: 'p2', clienteId: 'c1', neto: 250, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 }, 'trabajadores/t2': { nombre: 'Ana', activo: true, en: 1 },
  'cambios/k1': { tipo: 'corregir', pesajeId: 'a1', fecha: ANTES, antes: { cantidad: 29 }, despues: { cantidad: 30 }, por: 'u-3003', quien: 'Tablet Panadería', en: Date.parse(ANTES + 'T13:00:00Z') } },
Object.fromEntries([pes('h1', HOY, '05:10', 1, 'p1', 18.5, 'kg'), pes('h2', HOY, '05:20', 1, 'p2', 120, 'un'), pes('h3', HOY, '08:00', 2, 'p1', 20.25, 'kg'),
  pes('a1', ANTES, '05:00', 1, 'p1', 30, 'kg'), pes('a2', ANTES, '05:05', 1, 'p3', 5, 'kg'), pes('a3', ANTES, '05:10', 1, 'p1', 99, 'kg', { anulado: true }), pes('a4', ANTES, '09:00', 2, 'p2', 60, 'un', { trabajadorId: 't2' })]
  .concat(Array.from({ length: 105 }, (_, i) => pes('v' + i, V5, '06:' + String(i % 60).padStart(2, '0'), 1 + (i % 2), 'p1', 1, 'kg')))));

(async () => {
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async quien => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel);
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const escribir = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); };
  const elegir = async (sel, v) => { await page.selectOption(sel, v); };
  const descarga = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), tocar(sel)]); return { nombre: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) }; };
  /* Lo que debería mostrar la app, calculado aquí con la misma lógica y los datos guardados */
  const esperado = async (desde, hasta) => {
    const [p, pr, prs] = await Promise.all([docs('pesajes'), docs('precios'), docs('productos')]);
    return V.totales(V.lineas(p.filter(x => x.fecha >= desde && x.fecha <= hasta), prs, pr, 'c1', 19));
  };
  const rMes = V.rangoMes(MES), hastaMes = rMes.hasta > HOY ? HOY : rMes.hasta;

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. La dueña: barra, franja del respaldo semanal');
  await entrar(); await page.waitForSelector('#hoyTotales');
  ok((await page.locator('#nav button').allTextContents()).join() === 'Hoy,Entregas,Pesaje,Más', 'la barra tiene Hoy, Entregas, Pesaje y Más');
  await page.waitForSelector('#avisoRespaldo');
  ok(/Todavía no hay ningún respaldo/.test(await texto('#avisoRespaldo')), 'sin respaldos aún: la franja lo avisa');
  await tocar('#avisoRespaldo [data-act="aviso-luego"]'); await page.waitForSelector('#avisoRespaldo', { state: 'detached' });
  ok((await page.evaluate(() => localStorage.getItem('pan.respaldoLuego'))) === HOY, '«Más tarde» la calla hasta mañana en este equipo');
  ok(!(await page.$('#avisoSinPrecio')), 'hoy no hay ventas sin precio: no hay franja de precio');
  ok(/neto/.test(await texto('#hoyEntregas .entrega[data-n="1"] .chico')), 'en Hoy cada entrega muestra su venta neta');

  console.log('2. Entregas del mes');
  await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entMes');
  if ((await page.inputValue('#entMes')) !== MES) await escribir('#entMes', MES);
  await page.waitForSelector('#entTotal');
  const T1 = await esperado(rMes.desde, hastaMes);
  ok((await texto('#entTotal b')) === C.pesos(T1.total), 'venta del mes: ' + (await texto('#entTotal b')) + ' (la misma que se calcula con los datos)');
  const dias1 = new Set((await docs('pesajes')).filter(p => p.fecha >= rMes.desde && p.fecha <= hastaMes && !p.anulado).map(p => p.fecha));
  ok((await page.locator('#entDias .ent-dia').count()) === dias1.size, 'un recuadro por día con ventas (' + dias1.size + '), del más nuevo al más antiguo');
  const tarjeta = '#entDias .ent-dia[data-fecha="' + ANTES + '"]';
  ok((await page.locator(tarjeta + ' .mrow').count()) === 2 && /Sin precio|neto/.test(await texto(tarjeta)), 'cada día muestra sus entregas con horario, cantidad y venta');
  await page.waitForSelector('#avisoSinPrecio');
  ok(/Hallulla/.test(await texto('#avisoSinPrecio')) && /no suma/i.test(await texto('#avisoSinPrecio')) && !!(await page.$('#entSinPrecio')), 'venta sin precio: se registra igual y una franja avisa a los dueños (Hallulla)');
  await tocar(tarjeta + ' [data-act="ir"][data-tab="inicio"]'); await page.waitForSelector('#hoyTotales');
  ok((await page.inputValue('#hoyFecha')) === ANTES && /Hallulla/.test(await texto('#hoySinPrecio')), '«Ver el día y corregir» abre ese día en Hoy (con el aviso de precio)');

  console.log('3. Anotar en fecha pasada');
  ok(/Anotar canasto el/.test(await texto('#hoyAnotar')), 'en un día pasado, el botón dice «Anotar canasto el …»');
  await tocar('#hoyAnotar'); await page.waitForSelector('#dlg[open] #anCant');
  ok(/Día:/.test(await texto('#anDia')), 'la hoja dice en qué día se anota');
  await tocar('#dlg [data-act="anotar-guardar"]');
  ok(/kilos/.test(await texto('#dlg .form-error')), 'sin cantidad no se guarda');
  await elegir('#anPan', 'p1'); await page.fill('#anCant', '12,5'); await elegir('#anQuien', 't2'); await elegir('#anEntrega', '2'); await page.fill('#anHora', '10:00');
  await tocar('#dlg [data-act="anotar-otro"]'); await aviso(/Anotado: Marraqueta 12,50 kg el/);
  ok((await page.$('#dlg[open] #anCant')) && (await page.inputValue('#anCant')) === '' && (await page.inputValue('#anPan')) === 'p1', '«Guardar y anotar otro» deja la hoja lista para el siguiente');
  await elegir('#anPan', 'p3'); await page.fill('#anCant', '3'); await tocar('#dlg [data-act="anotar-guardar"]'); await cerrada();
  await aviso(/sin precio ese día/);
  const nuevos = (await docs('pesajes')).filter(p => p.fecha === ANTES && p.creadoPor === 'u-1001');
  ok(nuevos.length === 2 && nuevos.some(p => p.productoId === 'p1' && p.cantidad === 12.5 && p.trabajadorId === 't2' && p.entregaN === 2 && p.hora === '10:00'), 'quedan en la nube con ese día, a nombre de la dueña (pan, cantidad, persona, entrega y hora)');
  await page.waitForFunction(() => /anotado el/.test(document.getElementById('hoyEntregas').textContent));
  ok(true, 'en la lista del día se ve que se anotaron después');

  console.log('4. Registro general: filtros y bitácora');
  await tocar('#nav button[data-tab="mas"]'); await page.waitForSelector('#irRegistro');
  ok(!!(await page.$('#irDatos')) && !!(await page.$('#irFechaPasada')) && (await page.locator('.mas-grupo').allTextContents()).join() === 'Catálogo,Registros,Datos,Cuenta', '«Más» tiene los submenús Catálogo, Registros y Datos');
  await tocar('#irRegistro'); await page.waitForSelector('#regDesde');
  await escribir('#regDesde', V5); await page.waitForSelector('#regResumen');
  const enRango = (await docs('pesajes')).filter(p => p.fecha >= V5 && p.fecha <= HOY);
  ok((await texto('#regResumen')).startsWith(enRango.filter(p => !p.anulado).length + ' canastos'), 'del ' + V5 + ' a hoy: ' + enRango.filter(p => !p.anulado).length + ' canastos vigentes');
  ok((await page.locator('#regCuerpo .pes-fila').count()) === 100 && !!(await page.$('#regMas')), 'muestra los primeros 100 y ofrece «Mostrar más»');
  await tocar('#regMas'); await page.waitForFunction(n => document.querySelectorAll('#regCuerpo .pes-fila').length === n, enRango.filter(p => !p.anulado).length);
  ok(!(await page.$('#regMas')), 'con «Mostrar más» aparecen todos');
  await elegir('#regPan', 'p3'); await page.waitForFunction(() => /^2 canastos/.test(document.getElementById('regResumen').textContent));
  ok(true, 'filtro por pan: Hallulla, 2 canastos');
  await elegir('#regPan', ''); await tocar('[data-act="reg-estado"][data-v="anulados"]'); await page.waitForFunction(() => /^1 canasto$/.test(document.getElementById('regResumen').textContent.trim()));
  ok((await page.locator('#regCuerpo .pes-fila.anulado').count()) === 1, 'filtro por estado: el anulado');
  await tocar('[data-act="reg-estado"][data-v="vigentes"]'); await elegir('#regQuien', 't2'); await elegir('#regEntrega', '2');
  await page.waitForFunction(() => /^3 canastos/.test(document.getElementById('regResumen').textContent));
  ok(true, 'filtros por quién pesó y entrega: Ana en la entrega 2 (el Pan de completo y los dos anotados)');
  await tocar('[data-act="reg-ver"][data-v="bitacora"]'); await page.waitForSelector('#regCuerpo[data-ver="bitacora"] .empty');
  ok(true, 'la bitácora respeta los filtros (la corrección de la tablet era de un canasto de Luis)');
  await elegir('#regQuien', ''); await elegir('#regEntrega', ''); await page.waitForSelector('#regBitacora');
  ok(/Corregido · Marraqueta/.test(await texto('#regBitacora')) && /cantidad: 29,00 kg → 30,00 kg/.test(await texto('#regBitacora')) && /Tablet Panadería/.test(await texto('#regBitacora')), 'la bitácora muestra qué cambió, quién (la tablet) y cuándo');
  await tocar('[data-act="reg-ver"][data-v="canastos"]'); await elegir('#regPan', 'p2');
  await page.waitForSelector('#regCuerpo .pes-fila[data-id="a4"]');
  await tocar('#regCuerpo .pes-fila[data-id="a4"]'); await page.waitForSelector('#dlg[open] #canDetalle');
  await tocar('#dlg [data-act="can-corregir"]'); await page.fill('#cCant', '65'); await tocar('#dlg [data-act="can-guardar"]'); await cerrada(); await aviso(/Canasto corregido/);
  const k = (await docs('cambios')).find(x => x.pesajeId === 'a4');
  ok(k && k.por === 'u-1001' && k.quien === 'Rosa Dueña' && k.despues.cantidad === 65 && (await db('leer', 'pesajes/a4')).cantidad === 65, 'corregir desde el registro deja constancia con el nombre de quien corrige');
  await tocar('[data-act="reg-ver"][data-v="bitacora"]'); await page.waitForFunction(() => /Tú/.test(document.getElementById('regBitacora').textContent));
  ok(/Pan de completo/.test(await texto('#regBitacora')), 'y aparece en la bitácora como «Tú»');

  console.log('5. Excel: cuadra con las entregas («Listo cuando»)');
  await tocar('.volver'); await tocar('#irDatos'); await page.waitForSelector('#datExcel');
  ok(!(await page.$('#avisoRespaldo')), 'en Datos no se repite la franja del respaldo');
  if ((await page.inputValue('#datMes')) !== MES) await escribir('#datMes', MES);
  const x1 = await descarga('#datExcel');
  ok(x1.nombre === 'ventas-' + MES + '.xlsx', 'baja «' + x1.nombre + '»');
  let L = null; try { L = leer(x1.bytes); } catch (e) { console.log('    ' + e.message); }
  ok(!!L && L.orden.join() === 'Resumen,Ventas,Entregas,Por día,Por pan,Canastos', 'el archivo es un Excel válido con sus seis hojas');
  const T2 = await esperado(rMes.desde, hastaMes), H = L.hojas, nV = H.Ventas.filas.length - 2, nE = H.Entregas.filas.length - 2;
  ok(H.Ventas.filas[nV + 1][11] === T2.total && H.Entregas.filas[nE + 1][9] === T2.total && sumaCol(H.Ventas.filas, 9, 1, 1 + nV) === sumaCol(H.Entregas.filas, 7, 1, 1 + nE) && sumaCol(H.Ventas.filas, 9, 1, 1 + nV) === T2.neto && T2.iva === Math.round(T2.neto * 19 / 100), 'Ventas = suma de las entregas (neto) y el IVA es el 19 % del neto del mes: total ' + C.pesos(T2.total));
  ok(H.Ventas.filas.slice(1, 1 + nV).some(f => f[4] === 'Hallulla' && f[12] === 'Sin precio ese día: no suma') && H.Ventas.filas[1][3] === 'Supermercado', 'con cliente, y la Hallulla sin precio marcada');
  await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entTotal');
  ok((await texto('#entTotal b')) === C.pesos(T2.total), 'y el Excel dice lo mismo que la pantalla Entregas (' + C.pesos(T2.total) + ')');
  const x2 = await descarga('#entExcel');
  ok(x2.nombre === x1.nombre && leer(x2.bytes).hojas.Entregas.filas[nE + 1][9] === T2.total, 'el botón de Entregas baja el mismo Excel');
  await tocar('#nav button[data-tab="mas"]'); await tocar('#irDatos'); await page.waitForSelector('#datExcel');
  await tocar('[data-act="dat-modo"][data-v="rango"]'); await escribir('#datDesde', HOY); await escribir('#datHasta', V5);
  ok(/antes/.test(await texto('#secExcel .form-error')) && await page.isDisabled('#datExcel'), 'otras fechas: si «desde» va después de «hasta», lo dice y no deja descargar');
  await escribir('#datDesde', V5); await escribir('#datHasta', HOY);
  const x3 = await descarga('#datExcel'), T3 = await esperado(V5, HOY);
  ok(x3.nombre === (V5.slice(0, 7) === HOY.slice(0, 7) && V5.endsWith('-01') ? 'ventas-' + HOY.slice(0, 7) + '.xlsx' : 'ventas-' + V5 + '_a_' + HOY + '.xlsx') && (f => f[f.length - 1][11])(leer(x3.bytes).hojas.Ventas.filas) === T3.total, 'un período a elección: ' + x3.nombre);

  console.log('6. Respaldo');
  const r1 = await descarga('#datRespaldo'), arch = JSON.parse(r1.bytes.toString('utf8'));
  ok(r1.nombre === 'respaldo-panaderia-' + HOY + '.json' && arch.formato === 'panaderia-respaldo' && arch.v === 1, 'baja el respaldo con su fecha');
  ok(arch.datos.pesajes.length === (await docs('pesajes')).length && arch.datos.cambios.length === (await docs('cambios')).length && arch.datos.precios.length === 2 && !!arch.datos['config/negocio'], 'trae todo: canastos, correcciones, precios, negocio…');
  ok(Array.isArray(arch.datos.miembros) && arch.datos.miembros.length === 2, '…y, por ser dueña, los accesos');
  await page.waitForSelector('#datMarca'); await page.waitForFunction(() => /hoy/.test(document.getElementById('datMarca').textContent));
  const marca = await db('leer', 'config/respaldo');
  ok(marca && marca.por === 'u-1001' && marca.quien === 'Rosa Dueña' && marca.conteos.pesajes === arch.conteos.pesajes && marca.lecturas === arch.lecturas, 'queda anotado en la nube quién y cuándo (para la franja semanal)');
  await page.evaluate(() => localStorage.removeItem('pan.respaldoLuego'));
  await tocar('#nav button[data-tab="inicio"]'); await page.waitForSelector('#hoyTotales');
  ok(!(await page.$('#avisoRespaldo')), 'con un respaldo de hoy, la franja ya no sale');
  await db('poner', 'config/respaldo', Object.assign({}, marca, { en: Date.now() - 8 * 86400000 }));
  await page.waitForSelector('#avisoRespaldo');
  ok(/hace 8 días/.test(await texto('#avisoRespaldo')), 'a los 7 días o más vuelve a salir (hace 8 días)');

  console.log('7. Sin conexión');
  await tocar('#nav button[data-tab="mas"]'); await tocar('#irDatos'); await page.waitForSelector('#datExcel');
  await db('fuera', true); await ctx.setOffline(true); await page.evaluate(() => dispatchEvent(new Event('offline')));
  let bajo = false; page.once('download', () => { bajo = true; });
  await tocar('#datExcel'); await aviso(/hace falta internet/);
  await tocar('#datRespaldo'); await aviso(/hace falta internet/);
  await page.waitForTimeout(300);
  ok(!bajo, 'sin internet no se descarga un Excel ni un respaldo a medias: lo dice');
  await ctx.setOffline(false); await db('fuera', false);
  ok((await page.evaluate(() => (window.__csp || []).length)) === 0, 'todo esto sin ningún bloqueo de la política de seguridad (descargas incluidas)');

  console.log('8. El externo');
  await salir(); await entrar(FELIPE); await page.waitForSelector('#hoyTotales');
  await tocar('#nav button[data-tab="mas"]'); await page.waitForSelector('#irRegistro');
  ok(!!(await page.$('#irDatos')) && !(await page.$('#irAccesos')), 've Registros y Datos, no Accesos');
  await tocar('#irDatos'); await page.waitForSelector('#datRespaldo');
  const r2 = JSON.parse((await descarga('#datRespaldo')).bytes.toString('utf8'));
  ok(r2.datos.pesajes.length > 0 && !('miembros' in r2.datos) && !('solicitudes' in r2.datos) && r2.perfil === 'externo', 'su respaldo trae los datos, pero no los accesos (no puede leerlos)');
  const x4 = await descarga('#datExcel');
  ok(leer(x4.bytes).orden.length === 6, 'y también descarga el Excel');

  console.log('9. La tablet no ve nada de esto');
  await salir(); await entrar(TABLET); await page.waitForSelector('#pesQuien');
  ok((await page.locator('#nav button').allTextContents()).join() === 'Pesaje,Más' && !(await page.$('#avisoRespaldo')) && !(await page.$('#avisoSinPrecio')), 'solo Pesaje y Más, sin franjas de ventas ni respaldo');
  await tocar('#nav button[data-tab="mas"]');
  ok(!(await page.$('#irRegistro')) && !(await page.$('#irDatos')) && !(await page.$('.mas-grupo')), 'en «Más» no tiene Registros ni Datos');
  ok(!(await db('pedir', 'get', 'config/respaldo')) && !(await db('pedir', 'list', 'cambios')), 'ni con peticiones directas lee el respaldo o la bitácora');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
