/* Varios clientes y ventas sueltas (Fase 11), sin navegador: APP/js/core/catalogo.js, ventas.js, pesaje.js, cierres.js, excel.js e
   indicadores.js. Un mes con el supermercado (el cliente original, también con canastos anotados antes de la versión 0.11.0, sin
   `clienteId`), un almacén con su propia lista de precios y «Ventas sueltas», contra el cálculo a mano. Comprueba el «Listo cuando»:
   cada línea usa el precio de SU cliente ese día; el total = la suma de los clientes (Entregas, Números, cierre y Excel dicen lo mismo);
   lo pesado antes sigue siendo del supermercado aunque se desactive; las entregas se numeran por cliente; las sueltas van una por una.
   Uso: node tests/clientes-unit.js */
const { leer, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const C = await import('../APP/js/core/catalogo.js'), V = await import('../APP/js/core/ventas.js'), P = await import('../APP/js/core/pesaje.js');
  const CI = await import('../APP/js/core/cierres.js'), E = await import('../APP/js/core/excel.js'), I = await import('../APP/js/core/indicadores.js');
  const R = await import('./fake-firebase/reglas.mjs'), X = await import('../APP/js/core/xlsx.js');

  const prods = [{ id: 'p1', nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true }, { id: 'p2', nombre: 'Pan de completo', unidad: 'un', orden: 2, activo: true }, { id: 'p9', nombre: 'Viejo', unidad: 'kg', orden: 9, activo: false }];
  const CLI = [{ id: 'c2', nombre: 'Almacén Rosa', activo: true, tipo: 'regular', en: 5 }, { id: 'cs', nombre: 'Ventas sueltas', activo: true, tipo: 'suelta', en: 6 },
    { id: 'c1', nombre: 'Supermercado', activo: true, en: 1 }, { id: 'c3', nombre: 'Casino cerrado', activo: false, en: 7 }];
  const pr = (productoId, clienteId, neto, desde) => ({ id: C.idPrecio(productoId, clienteId, desde), productoId, clienteId, neto, desde });
  const precios = [pr('p1', 'c1', 1450, '2026-01-01'), pr('p2', 'c1', 250, '2026-01-01'), pr('p1', 'c2', 1600, '2026-11-01'), pr('p2', 'c2', 300, '2026-11-01'),
    pr('p1', 'cs', 2000, '2026-11-01'), pr('p2', 'cs', 350, '2026-11-01'), pr('p9', 'c1', 999, '2026-01-01')];
  const pz = (id, fecha, hora, n, prod, cant, u, mas) => Object.assign({ id, fecha, hora, entregaN: n, productoId: prod, cantidad: cant, unidad: u, trabajadorId: 't1', anulado: false, creadoPor: 'tablet', en: 1 }, mas || {});
  const pes = [pz('a', '2026-11-02', '05:00', 1, 'p1', 20, 'kg'),                                       // antes de la 0.11.0: sin cliente = el original
    pz('b', '2026-11-02', '05:10', 1, 'p1', 10.5, 'kg', { clienteId: 'c1' }), pz('c', '2026-11-02', '07:00', 2, 'p2', 120, 'un', { clienteId: 'c1' }),
    pz('d', '2026-11-02', '06:00', 1, 'p1', 8, 'kg', { clienteId: 'c2' }), pz('e', '2026-11-02', '06:30', 1, 'p2', 40, 'un', { clienteId: 'c2' }),
    pz('f', '2026-11-02', '09:00', 1, 'p1', 2, 'kg', { clienteId: 'cs', nota: 'Sra. Marta' }), pz('g', '2026-11-02', '10:42', 1, 'p1', 1.5, 'kg', { clienteId: 'cs' }),
    pz('h', '2026-11-03', '05:00', 1, 'p1', 15, 'kg', { clienteId: 'c2' }), pz('i', '2026-11-03', '05:30', 1, 'p1', 99, 'kg', { clienteId: 'c1', anulado: true })];
  /* A mano: Supermercado 30,5 kg × 1.450 = 44.225 + 120 un × 250 = 30.000 → 74.225 · Almacén 8 × 1.600 = 12.800 + 40 × 300 = 12.000 + 15 × 1.600 = 24.000 → 48.800
     · Ventas sueltas 2 × 2.000 = 4.000 + 1,5 × 2.000 = 3.000 → 7.000 · negocio 130.025, IVA 19 % = 24.704,75 → 24.705, total 154.730 */
  const MANO = { c1: 74225, c2: 48800, cs: 7000, neto: 130025, iva: 24705, total: 154730 };

  console.log('1. Clientes: original, principal, orden y copiar precios');
  ok(C.clienteOriginal(CLI).id === 'c1' && C.clientePrincipal(CLI).id === 'c1', 'el original es el regular más antiguo (el supermercado) y es el que se propone');
  const sinSuper = CLI.map(x => (x.id === 'c1' ? Object.assign({}, x, { activo: false }) : x));
  ok(C.clienteOriginal(sinSuper).id === 'c1' && C.clientePrincipal(sinSuper).id === 'c2', 'desactivado, el supermercado sigue siendo el original; se propone el regular activo más antiguo');
  ok(C.ordenarClientes(CLI).map(x => x.id).join() === 'c1,c2,c3,cs' && C.clientesActivos(CLI).map(x => x.id).join() === 'c1,c2,cs', 'orden: el original, los regulares por antigüedad y al final «Ventas sueltas»');
  ok(C.clienteSuelto(CLI).id === 'cs' && C.esSuelta(C.clienteSuelto(CLI)) && !C.esSuelta(CLI[0]), '«Ventas sueltas» es el cliente de tipo suelta');
  ok(C.variosClientes(CLI) && !C.variosClientes([CLI[2]]) && !C.variosClientes([CLI[2], CLI[3]]), 'hay que elegir cliente solo con más de uno activo (con uno solo, la tablet queda igual)');
  ok(C.clienteDe({ clienteId: 'c2' }, 'c1') === 'c2' && C.clienteDe({}, 'c1') === 'c1', 'lo pesado sin cliente es del original');
  const cop = C.copiarPrecios(precios, prods, 'c1', 'c4', '2026-11-20', '2026-11-21');
  ok(cop.length === 2 && cop.every(x => x.datos.clienteId === 'c4' && x.datos.desde === '2026-11-21' && x.id === x.datos.productoId + '_c4_2026-11-21') && cop.find(x => x.datos.productoId === 'p1').datos.neto === 1450,
    'copiar precios: los de hoy del otro cliente, uno por pan activo, desde la fecha elegida (sin el pan desactivado)');
  ok(cop.every(x => R.permitido({ uid: 'rosa' }, 'create', 'precios/' + x.id, Object.assign({}, x.datos, { en: R.TS }), null, r => (r === 'config/negocio' ? { duenos: ['rosa'] } : null), Date.now())), 'y las reglas aceptan cada precio copiado');
  ok(C.copiarPrecios(precios, prods, 'c1', 'c4', '2025-06-01', '2025-06-01').length === 0 && C.copiarPrecios(precios, prods, 'c9', 'c4', '2026-11-20', '2026-11-20').length === 0, 'de un cliente sin precios ese día no se copia nada');
  ok(C.soloCliente({ id: 'x', nombre: 'Ventas sueltas', activo: false, tipo: 'suelta', en: 3 }).tipo === 'suelta' && !('en' in C.soloCliente(CLI[0])) && !('tipo' in C.soloCliente(CLI[2])), 'el documento de un cliente lleva nombre, activo y tipo');

  console.log('2. Líneas de venta con el precio de cada cliente');
  const L = V.lineas(pes, prods, precios, CLI, 19), T = V.totales(L);
  ok(L.length === 7 && L.map(l => l.clienteId).join() === 'c1,c1,c2,c2,cs,cs,c2', 'una línea = un pan en una entrega de un cliente en un día (sueltas, una por canasto); por fecha, cliente y entrega');
  const lin = (cid, prod, f) => L.find(l => l.clienteId === cid && l.productoId === prod && (!f || l.fecha === f));
  ok(lin('c1', 'p1').precio === 1450 && lin('c1', 'p1').cantidad === 30.5 && lin('c1', 'p1').neto === 44225 && lin('c2', 'p1', '2026-11-02').precio === 1600 && lin('c2', 'p2').neto === 12000, 'cada línea con el precio vigente ese día PARA ESE CLIENTE');
  ok(lin('c1', 'p1').canastos === 2 && lin('c1', 'p1').cliente === 'Supermercado', 'el canasto sin cliente se suma al supermercado');
  const S = L.filter(l => l.suelta);
  ok(S.length === 2 && S[0].comprador === 'Sra. Marta' && S[0].hora === '09:00' && S[1].comprador === '' && S[1].hora === '10:42' && S.every(l => l.canastos === 1 && l.entregaN === 0), 'ventas sueltas: una por una, con su hora y quién compró (opcional), sin entrega');
  ok(T.neto === MANO.neto && T.iva === MANO.iva && T.total === MANO.total && T.canastos === 8, 'total del día = cálculo a mano (130.025 neto, 24.705 IVA, 154.730), sin el anulado');
  const G = V.porCliente(L, CLI);
  ok(G.map(g => g.clienteId + ':' + g.neto).join() === 'c1:74225,c2:48800,cs:7000' && G.reduce((t, g) => t + g.neto, 0) === T.neto && Math.abs(G.reduce((t, g) => t + g.pct, 0) - 100) < 1e-9,
    '«Por cliente»: neto de cada uno = a mano, la suma es el neto del negocio y las participaciones suman 100 %');
  ok(G[0].entregas === 2 && G[1].entregas === 2 && G[2].entregas === 0 && G[2].ventas === 2, 'entregas de cada cliente (las sueltas cuentan ventas, no entregas)');
  ok(V.totales(V.deCliente(L, 'c2')).neto === MANO.c2 && V.deCliente(L, '').length === 7, 'las líneas de un solo cliente (filtro «Cliente»)');
  const E1 = V.porEntrega(L);
  ok(E1.length === 5 && V.soloEntregas(E1).length === 4 && E1.filter(e => e.fecha === '2026-11-02').map(e => e.clienteId + '#' + e.n).join() === 'c1#1,c1#2,c2#1,cs#0', 'entregas numeradas por cliente: Supermercado n.º 1 y 2, Almacén n.º 1; las sueltas aparte');
  const D = V.porDia(L).find(d => d.fecha === '2026-11-02');
  ok(D.entregas === 3 && D.sueltas === 2 && D.neto === MANO.c1 + 12800 + 12000 + MANO.cs, 'el día cuenta 3 entregas (de todos los clientes) y 2 ventas sueltas');

  console.log('3. Lo pesado antes de la versión 0.11.0 sigue siendo del supermercado');
  const viejos = pes.filter(p => !p.clienteId || p.clienteId === 'c1').map(p => { const x = Object.assign({}, p); delete x.clienteId; return x; });
  const antes = V.totales(V.lineas(viejos, prods, precios, 'c1', 19)), ahora = V.totales(V.lineas(viejos, prods, precios, CLI, 19));
  ok(antes.neto === MANO.c1 && ahora.neto === antes.neto && ahora.total === antes.total, 'sin cliente, los mismos montos que antes de la Fase 11 (precio del supermercado)');
  ok(V.lineas(viejos, prods, precios, sinSuper, 19).every(l => l.clienteId === 'c1' && l.neto != null), 'aunque el supermercado se desactive, lo antiguo no cambia de dueño ni de precio');
  ok(V.lineas(pes, prods, precios, null, 19).every(l => l.neto === null), 'sin clientes no hay montos');
  ok(V.filtrar(pes, { clienteId: 'c1', original: 'c1' }).map(p => p.id).join() === 'a,b,c' && V.filtrar(pes, { clienteId: 'c2', original: 'c1', estado: 'todos' }).length === 3, 'el registro general filtra por cliente (con lo antiguo en el original)');

  console.log('4. Pesaje: entregas de cada cliente');
  const hoy = pes.filter(p => p.fecha === '2026-11-02'), Rz = P.resumen(hoy, prods, [{ id: 't1', nombre: 'Luis' }], CLI);
  ok(Rz.porEntrega.map(e => e.cliente + ' ' + e.n).join() === 'Supermercado 1,Supermercado 2,Almacén Rosa 1,Ventas sueltas 0' && Rz.canastos === 7 && Rz.kg === 42, 'el resumen del día separa las entregas por cliente; los totales son del negocio');
  ok(Rz.porCliente.map(x => x.clienteId + ':' + x.kg + '/' + x.un).join() === 'c1:30.5/120,c2:8/40,cs:3.5/0', 'y suma por cliente');
  ok(P.resumen(hoy, prods, []).porEntrega.map(e => e.n).join() === '1,2' && P.resumen(viejos.filter(p => p.fecha === '2026-11-02'), prods, []).porEntrega.map(e => e.n).join() === '1,2', 'sin la lista de clientes (o con uno solo) queda como antes');
  const dia = { dia: { entregaN: 2 }, dias: { c2: { entregaN: 1 } } };
  ok(P.rutaDia('2026-11-02', 'c1', 'c1') === 'dias/2026-11-02' && P.rutaDia('2026-11-02', 'c2', 'c1') === 'dias/2026-11-02_c2' && P.rutaDia('2026-11-02', null, 'c1') === 'dias/2026-11-02', 'el supermercado sigue en dias/{fecha}; otro cliente, en dias/{fecha}_{cliente}');
  ok(P.diaDoc(dia, 'c1', 'c1').entregaN === 2 && P.diaDoc(dia, 'c2', 'c1').entregaN === 1 && P.diaDoc(dia, 'c4', 'c1') === undefined, 'la entrega en curso de cada cliente');
  const ea = P.entregaActual(hoy, { entregaN: 1 }, 'c1', 'c1'), eb = P.entregaActual(hoy, { entregaN: 1 }, 'c2', 'c1');
  ok(ea.canastos === 2 && ea.kg === 30.5 && eb.canastos === 2 && eb.kg === 8 && eb.un === 40, '«Cerrar entrega» cuenta solo los canastos de la entrega en curso de ESE cliente');
  const nuevo = P.nuevoPesaje({ fecha: '2026-11-02', hora: '11:00', entregaN: 1, clienteId: 'cs', productoId: 'p1', cantidad: 1, unidad: 'kg', trabajadorId: 't1', nota: '  Don   Luis ', creadoPor: 'tablet' });
  ok(nuevo.clienteId === 'cs' && nuevo.nota === 'Don Luis' && P.soloPesaje(Object.assign({ id: 'x', _pend: true }, nuevo)).clienteId === 'cs', 'el pesaje nuevo lleva el cliente (y la nota de quién compró)');
  const dif = P.diferencia(pes[0], Object.assign({}, pes[0], { clienteId: 'c2' })), txt = P.describirCambio({ tipo: 'corregir', antes: dif.antes, despues: dif.despues }, prods, [], 'kg', CLI);
  ok(txt.detalle === 'cliente: Supermercado → Almacén Rosa', 'cambiar el cliente al corregir queda en la bitácora: «cliente: Supermercado → Almacén Rosa»');

  console.log('5. Cierre del mes por cliente (cuadra con Entregas)');
  const k = { productos: prods, precios, clientes: CLI }, A = CI.desdeApp('2026-11', pes, k, C.clienteOriginal(CLI), 19, { por: 'rosa', quien: 'Rosa' });
  ok(A.doc.neto === MANO.neto && A.doc.ivaMonto === MANO.iva && A.doc.total === MANO.total && A.doc.neto === T.neto, 'neto, IVA (19 % del neto del mes) y total del cierre = Entregas = a mano');
  ok(A.doc.lineas.length === 5 && A.doc.lineas.every(l => l.clienteId && l.cliente) && A.doc.lineas.map(l => l.clienteId + '/' + l.productoId).join() === 'c1/p1,c1/p2,c2/p1,c2/p2,cs/p1', 'una línea por pan y por cliente');
  ok(A.doc.clientes.map(x => x.clienteId + ':' + x.neto).join() === 'c1:74225,c2:48800,cs:7000' && A.doc.clientes.reduce((t, x) => t + x.neto, 0) === A.doc.neto && !('clienteId' in A.doc), 'el resumen por cliente suma el neto del mes (sin cliente único arriba)');
  const leerDb = db => r => (r in db ? db[r] : null), AHORA = Date.parse('2026-12-02T15:00:00Z'), quien = { uid: 'rosa', email: 'rosa@example.com', email_verified: true };
  ok(R.permitido(quien, 'create', 'cierres/2026-11', Object.assign({}, A.doc, { en: R.TS }), null, leerDb({ 'config/negocio': { duenos: ['rosa'] } }), AHORA), 'las reglas (la copia) aceptan el cierre por cliente');
  const panes = CI.panesDeCierre(A.doc);
  ok(panes.length === 2 && panes[0].cantidad === 30.5 + 8 + 15 + 3.5 && panes[0].neto === 44225 + 12800 + 24000 + 7000 && panes[1].cantidad === 160, 'por pan (sumando los clientes): lo que usan Números, Costos y el detalle del cierre');
  const solo = CI.desdeApp('2026-11', viejos, { productos: prods, precios, clientes: [CLI[2]] }, CLI[2], 19, { por: 'rosa', quien: 'Rosa' }).doc;
  ok(solo.clienteId === 'c1' && solo.cliente === 'Supermercado' && solo.clientes.length === 1 && solo.neto === MANO.c1, 'con un solo cliente el cierre queda como antes (más el cliente en cada línea)');
  const c2 = CI.cierreDeCliente(A.doc, 'c2', 'c1'), excel = { mes: '2026-10', origen: 'excel', cerrado: true, clienteId: 'c1', neto: 500, kg: 10, un: 0, lineas: [{ productoId: 'p1', unidad: 'kg', cantidad: 10, neto: 500 }] };
  ok(c2.neto === MANO.c2 && c2.lineas.length === 2 && CI.cierreDeCliente(excel, 'c1', 'c1').neto === 500 && CI.cierreDeCliente(excel, 'c2', 'c1').neto === 0, 'un cierre visto para un cliente; los importados desde Excel son del supermercado');

  console.log('6. Excel con «Por cliente», «Comprador» y el de un solo cliente');
  const lib = E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: pes, productos: prods, trabajadores: [{ id: 't1', nombre: 'Luis' }], precios, clientes: CLI, iva: 19, quien: 'Rosa', ahora: Date.parse('2026-12-01T12:00:00Z') });
  const Xl = leer(X.crear(lib.hojas, new Date('2026-12-01T12:00:00Z'))), vf = Xl.hojas.Ventas.filas, pc = Xl.hojas['Por cliente'].filas;
  ok(Xl.orden.join() === 'Resumen,Ventas,Entregas,Por día,Por pan,Por cliente,Canastos', 'hojas: …, Por pan, Por cliente y Canastos');
  ok(vf[1][3] === 'Supermercado' && vf[3][3] === 'Almacén Rosa' && vf[5][3] === 'Ventas sueltas' && vf[0][13] === 'Comprador' && vf[5][13] === 'Sra. Marta' && vf[5][2] == null && /Venta suelta de las 09:00/.test(vf[5][12]), 'Ventas: el cliente de cada línea; las sueltas sin entrega y con el comprador');
  ok(sumaCol(vf, 9, 1, 8) === MANO.neto && sumaCol(pc, 6, 1, 4) === MANO.neto && pc[4][6] === MANO.neto && pc[4][7] === MANO.iva && pc[4][8] === MANO.total && Xl.hojas['Por cliente'].formulas.G5 === 'SUM(G2:G4)', '«Por cliente» cuadra con «Ventas» (neto, IVA y total, con fórmula)');
  ok(pc.slice(1, 4).map(f => f[0] + ':' + f[6]).join() === 'Supermercado:74225,Almacén Rosa:48800,Ventas sueltas:7000' && pc[3][2] === 2, 'una fila por cliente (las sueltas cuentan 2 ventas)');
  ok(Xl.hojas.Resumen.filas.some(f => f[0] === 'Cliente' && f[1] === 'Todos (3 clientes)') && Xl.hojas.Resumen.filas.some(f => f[0] === 'Almacén Rosa' && f[1] === MANO.c2), 'el Resumen nombra los clientes del período con su neto');
  ok(Xl.hojas.Entregas.filas[0][10] === 'Cliente' && Xl.hojas.Entregas.filas.slice(1, 6).map(f => f[10]).join() === 'Supermercado,Supermercado,Almacén Rosa,Ventas sueltas,Almacén Rosa' && Xl.hojas['Por día'].filas[3][2] === 4, '«Entregas» con el cliente; «Por día» suma 4 entregas (las sueltas no son entregas)');
  ok(Xl.hojas.Canastos.filas[0][10] === 'Cliente' && Xl.hojas.Canastos.filas.some(f => f[3] === 'Marraqueta' && f[4] === 20 && f[10] === 'Supermercado'), '«Canastos» con el cliente (lo antiguo, del supermercado)');
  const uno = E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: pes, productos: prods, trabajadores: [], precios, clientes: CLI, clienteId: 'c2', iva: 19, ahora: 0 });
  ok(uno.nombre === 'ventas-2026-11-almacen-rosa.xlsx' && uno.totales.neto === MANO.c2 && uno.lineas.every(l => l.clienteId === 'c2') && uno.hojas.find(h => h.nombre === 'Canastos').filas.length === 4, 'el Excel de un solo cliente: sus líneas, sus canastos y su nombre en el archivo');
  ok(E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: viejos, productos: prods, trabajadores: [], precios, cliente: CLI[2], iva: 19, ahora: 0 }).totales.neto === MANO.c1, 'con un solo cliente el Excel suma lo mismo que antes');

  console.log('7. Números: «Por cliente» y el total del negocio');
  const base = { productos: prods, precios, clientes: CLI, iva: 19, trabajadores: [], hoy: '2026-11-20' };
  const Rm = I.resumenMes('2026-11', Object.assign({ pesajes: pes }, base));
  ok(Rm.neto === MANO.neto && Rm.clientes.map(x => x.clienteId + ':' + x.neto).join() === 'c1:74225,c2:48800,cs:7000' && Math.abs(Rm.clientes.reduce((t, x) => t + x.pct, 0) - 100) < 1e-9, 'el mes en curso: neto del negocio y de cada cliente (= Entregas)');
  const Rc = I.resumenMes('2026-11', Object.assign({ pesajes: pes, cierre: A.doc }, base, { hoy: '2026-12-05' }));
  ok(Rc.neto === A.doc.neto && Rc.clientes.length === 3 && Rc.clientes[1].neto === MANO.c2 && Rc.panes.length === 2 && !Rc.cambio, 'cerrado: Números = el cierre (por cliente y por pan), sin «cambió después del cierre»');
  const Re = I.resumenMes('2026-10', Object.assign({ cierre: Object.assign({ cliente: 'Supermercado' }, excel) }, base));
  ok(Re.clientes.length === 1 && Re.clientes[0].neto === 500 && Re.clientes[0].cliente === 'Supermercado', 'un mes importado desde Excel es todo del supermercado');

  console.log('8. Reglas (copia a mano): el cliente del pesaje');
  const db = { 'config/negocio': { duenos: ['rosa'] }, 'miembros/tablet': { perfil: 'pesaje', activo: true }, 'productos/p1': prods[0], 'trabajadores/t1': { nombre: 'Luis', activo: true },
    'clientes/c1': CLI[2], 'clientes/c2': CLI[0], 'clientes/cs': CLI[1], 'clientes/c3': CLI[3] };
  const tablet = { uid: 'tablet' }, ya = Date.now(), hoyCl = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(ya));
  const doc = cid => Object.assign(P.nuevoPesaje({ fecha: hoyCl, hora: '08:00', entregaN: 1, clienteId: cid, productoId: 'p1', cantidad: 2, unidad: 'kg', trabajadorId: 't1', creadoPor: 'tablet' }), { en: R.TS });
  ok(R.permitido(tablet, 'create', 'pesajes/n1', doc('c2'), null, leerDb(db), ya) && R.permitido(tablet, 'create', 'pesajes/n2', doc('cs'), null, leerDb(db), ya), 'la tablet guarda para otro cliente y una venta suelta');
  ok(!R.permitido(tablet, 'create', 'pesajes/n3', doc('c3'), null, leerDb(db), ya) && !R.permitido(tablet, 'create', 'pesajes/n4', doc('zz'), null, leerDb(db), ya), 'no para un cliente desactivado ni para uno que no existe');
  ok(R.permitido(tablet, 'get', 'clientes/c2', null, CLI[0], leerDb(db), ya) && !R.permitido(tablet, 'get', 'precios/p1_c2_2026-11-01', null, precios[2], leerDb(db), ya), 'la tablet lee los clientes, pero no sus precios');
  ok(R.permitido(tablet, 'create', 'dias/' + hoyCl + '_c2', { entregaN: 2, por: 'tablet', en: R.TS }, null, leerDb(db), ya) && !R.permitido(tablet, 'create', 'dias/' + hoyCl + '_zz', { entregaN: 2, por: 'tablet', en: R.TS }, null, leerDb(db), ya),
    'la tablet cierra la entrega de otro cliente en su propio documento (el cliente debe existir)');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
