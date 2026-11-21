/* Varios clientes y ventas sueltas de punta a punta (Fase 11), con dobles de Firebase, Google y Firestore y las cabeceras de Hosting:
   la tablet con un solo cliente queda como antes; crear un cliente copiando los precios del supermercado y ajustar uno; activar
   «Ventas sueltas»; la tablet elige «Para:», cierra la entrega de un cliente sin tocar la del supermercado y anota una venta suelta con
   «¿Quién compró?» (nunca ve precios); Hoy con el total del negocio, «Por cliente» y el filtro; corregir el cliente de un canasto (con
   bitácora); Entregas con el filtro y el Excel de un cliente; cerrar el mes con líneas por cliente; Números «Por cliente»; el externo
   anota para otro cliente; el plan de producción cuenta a todos. Uso: node tests/clientes-e2e.js */
const fs = require('fs');
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js'), { leer, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const FELIPE = { sub: '2002', email: 'felipe@example.com', name: 'Felipe Externo' }, TABLET = { sub: '3003', email: 'tablet@example.com', name: 'Tablet Panadería' };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), MES = HOY.slice(0, 7);
const mesAntes = m => { const [a, b] = m.split('-').map(Number); return b === 1 ? (a - 1) + '-12' : a + '-' + String(b - 1).padStart(2, '0'); };
const ANT = mesAntes(MES);
let n = 0;
const pes = (fecha, prod, cant, unidad, mas) => ['pesajes/e' + (++n), Object.assign({ fecha, hora: '05:' + String(10 + n % 50).padStart(2, '0'), entregaN: 1, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-3003', en: Date.now() - 86400000 }, mas || {})];
const SEMILLA = Object.assign({ 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: true, por: 'u-1001', en: 1 },
  'config/respaldo': { por: 'u-1001', quien: 'Rosa', conteos: {}, lecturas: 1, en: Date.now() },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/hal': { nombre: 'Hallulla', unidad: 'kg', orden: 1, activo: true, en: 1 },
  'productos/com': { nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true, en: 1 },
  'precios/hal_c1_2026-01-01': { productoId: 'hal', clienteId: 'c1', neto: 1300, desde: '2026-01-01', en: 1 },
  'precios/com_c1_2026-01-01': { productoId: 'com', clienteId: 'c1', neto: 110, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis', activo: true, en: 1 },
  ['planes/' + HOY]: { fecha: HOY, items: [{ productoId: 'hal', cantidad: 50, unidad: 'kg', tandas: null }], por: 'u-1001', quien: 'Rosa Dueña', en: 1 } },
Object.fromEntries([pes(HOY, 'hal', 20, 'kg'), pes(HOY, 'com', 100, 'un'),                       // de hoy, anotados antes de la versión 0.11.0 (sin cliente)
  pes(ANT + '-10', 'hal', 30, 'kg'), pes(ANT + '-11', 'com', 200, 'un')]));                     // del mes anterior (sin cerrar)

(async () => {
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js');
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir();
  const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errs.push(m.text()); });
  const entrar = async (quien, sel) => { await fakeGoogle(page, quien || {}); await page.goto(URL); await page.waitForSelector('#btnGoogle'); await page.click('#btnGoogle'); await page.waitForSelector(sel || '#appRoot:not([hidden])'); };
  const salir = async () => { await page.click('#nav button[data-tab="mas"]'); await page.click('[data-act="salir"]'); await page.click('dialog.cfm [data-r="1"]'); await page.waitForSelector('#btnGoogle'); };
  const db = (f, ...a) => page.evaluate(([f, a]) => window.__fakeDb[f](...a), [f, a]);
  const docs = async col => Object.entries(await db('todo')).filter(e => e[0].startsWith(col + '/')).map(e => Object.assign({ id: e[0].split('/')[1] }, e[1]));
  const tocar = sel => page.click(sel), texto = sel => page.textContent(sel), hay = async sel => !!(await page.$(sel));
  const aviso = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, re.source);
  const cerrada = () => page.waitForSelector('#dlg:not([open])', { state: 'attached' });
  const descarga = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), tocar(sel)]); return { nombre: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) }; };
  const irMas = async (sel, espera) => { await page.click('#nav button[data-tab="mas"]'); await page.click(sel); await page.waitForSelector(espera); };
  const teclear = async t => { for (const k of t) await tocar('#pesTeclado [data-k="' + (k === ',' ? ',' : k) + '"]'); };
  const esperado = async (filtro, f) => { const k = { p: await docs('productos'), pr: await docs('precios'), c: await docs('clientes') };
    return V.totales(V.deCliente(V.lineas((await docs('pesajes')).filter(f || (() => true)), k.p, k.pr, k.c, 19), filtro || '')); };

  await page.goto(URL); await page.waitForSelector('#btnGoogle');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('fake.db', s); }, JSON.stringify(SEMILLA));

  console.log('1. Con un solo cliente, la tablet queda igual que antes');
  await entrar(TABLET, '#pesQuien'); await tocar('[data-act="pes-quien"][data-id="t1"]'); await page.waitForSelector('#pesEntrega');
  ok(!(await hay('#pesPara')) && /Entrega en curso/.test(await texto('#pesEntrega')) && !/ de Supermercado/.test(await texto('#pesEntrega')), 'sin «Para:» y la entrega en curso como siempre');
  await tocar('[data-act="pes-pan"][data-id="hal"]'); await teclear('12'); await tocar('#pesGuardar'); await aviso(/Guardado: Hallulla 12/);
  let p1 = (await docs('pesajes')).filter(p => p.fecha === HOY && p.cantidad === 12)[0];
  ok(p1 && p1.clienteId === 'c1' && p1.entregaN === 1, 'el canasto nuevo ya lleva el cliente (el supermercado)');
  await salir();

  console.log('2. Crear un cliente copiando los precios y activar ventas sueltas');
  await entrar(null, '#hoyTotales');
  ok(!(await hay('#hoyCliente')) && !(await hay('#hoyPorCliente')), 'Hoy, con un solo cliente, sin filtro ni «Por cliente»');
  await irMas('[data-act="ir"][data-tab="catalogo"]', '#catCuerpo'); await tocar('[data-act="cat-sub"][data-sub="negocio"]'); await page.waitForSelector('#listaClientes');
  ok(/Clientes e IVA/.test(await texto('.seg')) && /Supermercado/.test(await texto('#listaClientes')) && /Cliente original/.test(await texto('#listaClientes')), '«Clientes e IVA» lista al supermercado como cliente original');
  await tocar('[data-act="cat-cli-nuevo"]'); await page.waitForSelector('#cCopiar');
  await page.fill('#cNombre', 'Supermercado'); await tocar('[data-act="cat-cliente-guardar"]');
  ok(/Ya hay un cliente con ese nombre/.test(await texto('#dlg .form-error')), 'no se repite el nombre de un cliente');
  await page.fill('#cNombre', 'Almacén Rosa'); await page.selectOption('#cCopiar', 'c1'); await tocar('[data-act="cat-cliente-guardar"]'); await cerrada(); await aviso(/Cliente creado: Almacén Rosa · 2 precios copiados de Supermercado/);
  const alm = (await docs('clientes')).find(x => x.nombre === 'Almacén Rosa'), ALM = alm && alm.id;
  const prA = (await docs('precios')).filter(x => x.clienteId === ALM);
  ok(alm && alm.tipo === 'regular' && alm.activo === true && prA.length === 2 && prA.every(x => x.desde === HOY) && prA.find(x => x.productoId === 'hal').neto === 1300, 'el cliente nuevo queda con su lista: los precios de hoy del supermercado, desde hoy');
  await page.waitForSelector('[data-act="cat-sueltas"]'); await tocar('[data-act="cat-sueltas"]'); await aviso(/Ventas sueltas activadas/);
  const SU = ((await docs('clientes')).find(x => x.tipo === 'suelta') || {}).id;
  await page.waitForFunction(() => !document.querySelector('[data-act="cat-sueltas"]') && /Ventas sueltas/.test(document.getElementById('listaClientes').textContent));
  ok(!!SU && !(await page.$('[data-act="cat-sueltas"]')) && (await docs('clientes')).filter(x => x.tipo === 'suelta').length === 1, '«Ventas sueltas» es un cliente fijo (uno solo; el botón desaparece)');
  /* Precios: el almacén paga más la hallulla desde hoy; ventas sueltas, al público. */
  await tocar('[data-act="cat-sub"][data-sub="productos"]'); await page.waitForSelector('#catLista');
  await tocar('[data-act="cat-prod"][data-id="hal"]'); await page.waitForSelector('#precioClientes');
  ok((await page.$$('#precioClientes .mrow')).length === 3 && /Sin precio/.test(await texto('#precioClientes')), 'la ficha del pan muestra el precio de cada cliente (ventas sueltas, sin precio todavía)');
  await tocar('#precioClientes [data-cli="' + ALM + '"]'); await page.waitForSelector('#precioDe');
  ok(/Almacén Rosa/.test(await texto('#precioDe')), 'al tocar un cliente se ve su precio y su historial');
  await tocar('[data-act="cat-precio"]'); await page.fill('#prNeto', '1500'); await tocar('[data-act="cat-precio-guardar"]'); await cerrada(); await aviso(/Hallulla: \$1\.500 para Almacén Rosa/);
  await tocar('[data-act="cat-prod"][data-id="hal"]'); await page.waitForSelector('#precioClientes'); await tocar('#precioClientes [data-cli="' + SU + '"]'); await page.waitForSelector('#precioDe');
  await tocar('[data-act="cat-precio"]'); await page.fill('#prNeto', '2000'); await tocar('[data-act="cat-precio-guardar"]'); await cerrada(); await aviso(/para Ventas sueltas/);
  ok((await docs('precios')).find(x => x.id === 'hal_' + ALM + '_' + HOY).neto === 1500 && (await docs('precios')).find(x => x.id === 'hal_' + SU + '_' + HOY).neto === 2000 && (await docs('precios')).find(x => x.id === 'hal_c1_2026-01-01').neto === 1300,
    'cada cliente con su precio: almacén $1.500, sueltas $2.000, el supermercado sigue en $1.300');
  await page.selectOption('#catLista', ALM); await page.waitForFunction(() => /1\.500/.test(document.getElementById('listaProductos').textContent));
  ok(true, '«Precios de» cambia la lista de productos al cliente elegido');
  await salir();

  console.log('3. La tablet elige el cliente, cierra su entrega y anota una venta suelta');
  await entrar(TABLET, '#pesPara');
  const para = await page.$$eval('#pesPara [data-act="pes-cliente"]', l => l.map(b => b.textContent + ':' + b.getAttribute('aria-pressed')));
  ok(para.join() === 'Supermercado:true,Almacén Rosa:false,Ventas sueltas:false', '«Para:» con los tres clientes; el supermercado viene marcado');
  await tocar('#pesPara [data-id="' + ALM + '"]'); await aviso(/Para: Almacén Rosa/);
  ok(/Entrega en curso de Almacén Rosa/.test(await texto('#pesEntrega')) && /N\.º 1/.test(await texto('#pesEntregaN')), 'la entrega en curso es la del almacén (n.º 1)');
  await tocar('[data-act="pes-pan"][data-id="hal"]'); await teclear('8'); await tocar('#pesGuardar'); await aviso(/Guardado: Hallulla 8,00 kg para Almacén Rosa|Guardado: Hallulla 8 kg para Almacén Rosa/);
  ok((await docs('pesajes')).some(p => p.clienteId === ALM && p.cantidad === 8 && p.entregaN === 1), 'el canasto queda para el almacén');
  await page.waitForFunction(() => !document.querySelector('[data-act="pes-cerrar-entrega"]').disabled);
  await tocar('[data-act="pes-cerrar-entrega"]'); await page.waitForSelector('dialog.cfm[open]');
  ok(/de Almacén Rosa/.test(await texto('dialog.cfm')), '«¿Cerrar la entrega n.º 1 de Almacén Rosa?»');
  await tocar('dialog.cfm [data-r="1"]'); await aviso(/Entrega n.º 1 de Almacén Rosa cerrada/);
  await page.waitForFunction(() => /N\.º 2/.test(document.getElementById('pesEntregaN').textContent));
  ok((await db('leer', 'dias/' + HOY + '_' + ALM)).entregaN === 2 && !(await db('leer', 'dias/' + HOY)), 'cerrar la entrega del almacén no toca la del supermercado (dias/{hoy} sigue sin cerrar)');
  ok((await page.evaluate(() => localStorage.getItem('pan.cliente'))) === ALM, 'la elección queda guardada en el equipo');
  await page.reload(); await page.waitForSelector('#pesPara');
  ok((await page.getAttribute('#pesPara [data-id="' + ALM + '"]', 'aria-pressed')) === 'true', 'al volver a abrir, sigue elegido el almacén');
  await tocar('#pesPara [data-id="' + SU + '"]'); await page.waitForSelector('#pesEntrega');
  ok(/Sin entregas/.test(await texto('#pesEntrega')) && !(await hay('[data-act="pes-cerrar-entrega"]')), 'ventas sueltas: sin entregas ni «Cerrar entrega»');
  await tocar('[data-act="pes-pan"][data-id="hal"]'); await teclear('2'); await tocar('#pesGuardar'); await page.waitForSelector('#dlg[open] #pComprador');
  ok(/¿Quién compró\?/.test(await texto('#dlg')), 'al guardar pide «¿Quién compró?» (opcional)');
  await page.fill('#pComprador', 'Sra. Marta'); await tocar('[data-act="pes-suelta-guardar"]'); await aviso(/Venta suelta: Hallulla .* · Sra\. Marta/);
  await tocar('[data-act="pes-pan"][data-id="com"]'); await teclear('6'); await tocar('#pesGuardar'); await page.waitForSelector('#dlg[open] #pComprador'); await tocar('[data-act="pes-suelta-sin"]'); await aviso(/Venta suelta: Pan de completo/);
  const sue = (await docs('pesajes')).filter(p => p.clienteId === SU);
  ok(sue.length === 2 && sue.find(p => p.productoId === 'hal').nota === 'Sra. Marta' && !('nota' in sue.find(p => p.productoId === 'com')) && sue.every(p => p.entregaN === 1), 'las dos ventas sueltas quedan con su cliente (una con quién compró)');
  await tocar('#pesPara [data-id="c1"]'); await page.waitForSelector('#pesEntrega');
  ok(/Entrega en curso de Supermercado/.test(await texto('#pesEntrega')) && /N\.º 1/.test(await texto('#pesEntregaN')), 'el supermercado sigue en su entrega n.º 1');
  ok(!/\$/.test(await texto('#view')), 'la tablet nunca muestra precios');
  const planTab = await page.evaluate(() => (document.querySelector('[data-act="pes-pan"][data-id="hal"] .pes-plan-l') || {}).textContent || '');
  const kgHal = (await docs('pesajes')).filter(p => p.fecha === HOY && p.productoId === 'hal' && !p.anulado).reduce((t, p) => t + p.cantidad, 0);
  ok(kgHal === 42 && /faltan 8/.test(planTab), 'el plan de producción cuenta a todos los clientes (20 + 12 + 8 + 2 = 42 kg de 50: «faltan 8 kg»)');
  await salir();

  console.log('4. Hoy: total del negocio, «Por cliente» y el filtro');
  await entrar(null, '#hoyTotales'); await page.waitForSelector('#hoyCliente');
  const T = await esperado(null, p => p.fecha === HOY), TA = await esperado(ALM, p => p.fecha === HOY), TS = await esperado(SU, p => p.fecha === HOY);
  ok((await texto('#hoyTotal b')) === C.pesos(T.total) && /todos los clientes/.test(await texto('#hoyMontos')), 'Hoy muestra el total del negocio (' + C.pesos(T.total) + ')');
  const porCli = await page.$$eval('#hoyPorCliente .kv', l => l.map(x => x.textContent));
  ok(porCli.length === 3 && porCli[1].includes(C.pesos(TA.neto)) && porCli[2].includes(C.pesos(TS.neto)) && TA.neto === 12000 && TS.neto === 4000, '«Por cliente»: almacén 8 kg × $1.500 = $12.000; sueltas 2 kg × $2.000 = $4.000 (y el completo sin precio)');
  ok((await page.$$('#hoyEntregas .hoy-cli')).length === 3 && /Sra\. Marta/.test(await texto('#hoyEntregas [data-n="0"]')), 'las entregas van agrupadas por cliente; las sueltas, una por una con quién compró');
  ok(/Entrega n\.º 2 de Almacén Rosa en curso/.test(await texto('#hoyEntregas')), 'y la entrega n.º 2 del almacén aparece en curso, sin canastos');
  await page.selectOption('#hoyCliente', ALM); await page.waitForFunction(t => document.getElementById('hoyTotal') && document.getElementById('hoyTotal').textContent.includes(t), C.pesos(TA.total));
  ok(/a Almacén Rosa/.test(await texto('#hoyMontos')) && !(await hay('#hoyPorCliente')) && (await page.$$('#hoyEntregas .entrega')).length === 1, 'con el filtro: la venta y las entregas solo del almacén');
  await page.selectOption('#hoyCliente', ''); await page.waitForSelector('#hoyPorCliente');

  console.log('5. Corregir el cliente de un canasto (queda en la bitácora)');
  const viejo = (await docs('pesajes')).find(p => p.fecha === HOY && p.cantidad === 20 && !p.clienteId);
  await tocar('#hoyEntregas [data-cliente="c1"] details summary'); await tocar('#hoyEntregas [data-act="can-ver"][data-id="' + viejo.id + '"]'); await page.waitForSelector('#canDetalle');
  ok(/Para.*Supermercado/.test(await texto('#canDetalle')), 'la ficha dice para quién es (lo antiguo, del supermercado)');
  await tocar('[data-act="can-corregir"]'); await page.waitForSelector('#cCliente'); await page.selectOption('#cCliente', ALM); await tocar('[data-act="can-guardar"]'); await cerrada(); await aviso(/Canasto corregido/);
  const cor = await db('leer', 'pesajes/' + viejo.id), bit = (await docs('cambios')).find(x => x.pesajeId === viejo.id);
  ok(cor.clienteId === ALM && bit && bit.despues.clienteId === ALM && !('clienteId' in bit.antes), 'el canasto pasa al almacén y la bitácora guarda el cambio');
  await irMas('[data-act="ir"][data-tab="registro"]', '#regFiltros'); await tocar('[data-act="reg-ver"][data-v="bitacora"]'); await page.waitForSelector('#regBitacora');
  ok(/cliente: Supermercado → Almacén Rosa/.test(await texto('#regBitacora')), 'el Registro general lo muestra: «cliente: Supermercado → Almacén Rosa»');
  await tocar('[data-act="reg-ver"][data-v="canastos"]'); await page.selectOption('#regCliente', SU); await page.waitForFunction(() => /2 canastos/.test(document.getElementById('regResumen').textContent));
  ok(true, 'el Registro filtra por cliente (ventas sueltas: 2 canastos)');
  await page.selectOption('#regCliente', '');

  console.log('6. Entregas: filtro y Excel de un cliente');
  await page.click('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entMonto');
  const TM = await esperado(null, p => p.fecha.startsWith(MES));
  ok((await texto('#entTotal b')) === C.pesos(TM.total) && await hay('#entPorCliente') && /todos los clientes/.test(await texto('#entMonto')), 'Entregas: el total del negocio y «Por cliente»');
  await page.selectOption('#entCliente', ALM); await page.waitForFunction(() => /Descargar Excel de Almacén Rosa/.test(document.getElementById('entExcel').textContent));
  const TMA = await esperado(ALM, p => p.fecha.startsWith(MES));
  ok((await texto('#entTotal b')) === C.pesos(TMA.total) && !(await hay('#entPorCliente')), 'con el filtro, solo el almacén (' + C.pesos(TMA.total) + ')');
  const x1 = await descarga('#entExcel'), L1 = leer(x1.bytes);
  ok(x1.nombre === 'ventas-' + MES + '-almacen-rosa.xlsx' && sumaCol(L1.hojas.Ventas.filas, 9, 1, L1.hojas.Ventas.filas.length - 1) === TMA.neto && L1.hojas.Ventas.filas.slice(1, -1).every(f => f[3] === 'Almacén Rosa'), 'el Excel de un cliente: su nombre en el archivo y solo sus líneas');
  await page.selectOption('#entCliente', ''); await page.waitForSelector('#entPorCliente');
  const x2 = await descarga('#entExcel'), L2 = leer(x2.bytes), pc = L2.hojas['Por cliente'].filas;
  ok(x2.nombre === 'ventas-' + MES + '.xlsx' && pc.length === 5 && pc[4][6] === TM.neto && sumaCol(pc, 6, 1, 4) === sumaCol(L2.hojas.Ventas.filas, 9, 1, L2.hojas.Ventas.filas.length - 1) && L2.hojas.Ventas.filas.some(f => f[13] === 'Sra. Marta'),
    'el Excel del mes: «Por cliente» = «Ventas» = Entregas, con el comprador de la venta suelta');

  console.log('7. Cerrar el mes anterior y Números «Por cliente»');
  await page.selectOption('#entMes', ANT).catch(() => {}); await page.fill('#entMes', ANT); await page.dispatchEvent('#entMes', 'input'); await page.waitForSelector('#entCerrar');
  const TP = await esperado(null, p => p.fecha.startsWith(ANT));
  await tocar('#entCerrar'); await page.waitForSelector('dialog.cfm[open]'); await tocar('dialog.cfm [data-r="1"]'); await aviso(/quedó cerrado/);
  const cie = (await docs('cierres')).find(x => x.id === ANT);
  ok(cie && cie.neto === TP.neto && cie.lineas.every(l => l.clienteId === 'c1' && l.cliente === 'Supermercado') && cie.clientes.length === 1 && cie.clientes[0].neto === TP.neto, 'el cierre del mes anterior: lo pesado sin cliente queda del supermercado, por pan y por cliente');
  await page.click('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indClientes');
  const filas = await page.$$eval('#indClientes .ind-cli', l => l.map(x => x.getAttribute('data-cliente') + '|' + x.textContent));
  const G = V.porCliente(V.lineas((await docs('pesajes')).filter(p => p.fecha.startsWith(MES)), await docs('productos'), await docs('precios'), await docs('clientes'), 19), await docs('clientes'));
  ok(filas.length === 3 && G.every(g => filas.some(f => f.startsWith(g.clienteId + '|') && f.includes(C.pesos(g.neto)))), 'Números → El mes: «Por cliente» con el neto de cada uno (= Entregas)');
  await page.selectOption('#indCliente', ALM); await page.waitForSelector('#indMetaCli');
  ok(!(await hay('#indClientes')) && /negocio entero/.test(await texto('#indMetaCli')), 'con el filtro, el mes del almacén; la meta queda del negocio entero');
  await page.selectOption('#indCliente', '');
  await salir();

  console.log('8. El externo anota para otro cliente');
  await entrar(FELIPE, '#hoyTotales'); await page.waitForSelector('#hoyCliente');
  await tocar('#hoyAnotar'); await page.waitForSelector('#anCliente');
  await page.selectOption('#anCliente', SU);
  ok(await page.isHidden('#anEntregaCaja') && /Quién compró/.test(await texto('#anNotaT')), 'en una venta suelta la hoja no pide entrega y la nota es «quién compró»');
  await page.selectOption('#anCliente', ALM);
  ok((await page.$$eval('#anEntrega option', l => l.length)) === 2 && (await page.inputValue('#anEntrega')) === '2', 'para el almacén ofrece sus entregas (la n.º 2 en curso)');
  await page.selectOption('#anPan', 'com'); await page.fill('#anCant', '50'); await tocar('[data-act="anotar-guardar"]'); await cerrada(); await aviso(/para Almacén Rosa/);
  ok((await docs('pesajes')).some(p => p.clienteId === ALM && p.productoId === 'com' && p.cantidad === 50 && p.entregaN === 2 && p.creadoPor === 'u-2002'), 'queda para el almacén en su entrega n.º 2');
  await salir();

  ok(!errs.length, 'sin errores en la consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); srv.close();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
