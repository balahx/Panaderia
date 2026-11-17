/* Ventas, Excel y respaldo (APP/js/core/ventas.js, excel.js, respaldo.js), sin navegador. Incluye el «Listo cuando» de la Fase 5:
   el Excel de un mes cuadra con la suma de sus entregas (y con cada día, cada pan y el resumen). Desde la Fase 6 el IVA de un total
   es el IVA % de su neto (redondeado una vez): el neto cuadra exacto y el total puede diferir en unos pesos de sumar los totales de cada entrega. Uso: node tests/ventas-unit.js */
const { leer, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js'), E = await import('../APP/js/core/excel.js'), R = await import('../APP/js/core/respaldo.js');

  console.log('1. Montos en pesos sin errores de decimales');
  ok(C.montos(105, 2.3, 19).neto === 242 && C.montos(1450, 12.35, 19).neto === 17908, '105 × 2,30 = 242 y 1.450 × 12,35 = 17.908 (antes daban 241 y 17.907)');
  let malos = 0; for (let n = 100; n < 2000; n += 7) for (let c = 1; c < 3000; c += 3) if (C.montos(n, c / 100, 0).neto !== Math.round(n * c / 100)) malos++;
  ok(malos === 0, 'en 170 mil combinaciones de precio y kilos el neto es exacto');
  ok(C.montos(1512.61, 18.5, 19).neto === 27983 && C.montos(1512.61, 18.5, 19).iva === 5317 && C.montos(250, 120, 19).total === 35700, 'precios con decimales, IVA y total');

  console.log('2. Líneas de venta: un pan en una entrega de un día');
  const prods = [{ id: 'p1', nombre: 'Marraqueta', unidad: 'kg', orden: 1 }, { id: 'p2', nombre: 'Pan de completo', unidad: 'un', orden: 2 }, { id: 'p3', nombre: 'Hallulla', unidad: 'kg', orden: 3 }];
  const precios = [{ productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2026-01-01' }, { productoId: 'p1', clienteId: 'c1', neto: 1512.61, desde: '2026-11-10' }, { productoId: 'p2', clienteId: 'c1', neto: 250, desde: '2026-01-01' }];
  const P = (id, fecha, hora, n, prod, cant, u, mas) => Object.assign({ id, fecha, hora, entregaN: n, productoId: prod, cantidad: cant, unidad: u, trabajadorId: 't1', anulado: false, en: Date.parse(fecha + 'T15:00:00Z') }, mas || {});
  const pes = [P('a', '2026-11-09', '05:00', 1, 'p1', 18.5, 'kg'), P('b', '2026-11-09', '05:10', 1, 'p1', 2.3, 'kg'), P('c', '2026-11-09', '08:00', 2, 'p2', 120, 'un'),
    P('d', '2026-11-10', '05:30', 1, 'p1', 12.35, 'kg'), P('e', '2026-11-10', '05:00', 1, 'p3', 4, 'kg'), P('f', '2026-11-10', '06:00', 1, 'p1', 99, 'kg', { anulado: true })];
  const L = V.lineas(pes, prods, precios, 'c1', 19);
  ok(L.length === 4 && L.map(l => l.fecha.slice(8) + '/' + l.entregaN + '/' + l.productoId).join() === '09/1/p1,09/2/p2,10/1/p1,10/1/p3', 'una línea por pan y entrega, ordenadas por día, entrega y catálogo; los anulados no cuentan');
  ok(L[0].cantidad === 20.8 && L[0].canastos === 2 && L[0].desde === '05:00' && L[0].hasta === '05:10' && L[0].neto === 29120, '18,5 + 2,3 kg = 20,80 kg × $1.400 = $29.120, con su horario');
  ok(L[2].precio === 1512.61 && L[2].neto === 18681, 'el 10 de noviembre rige el precio nuevo ($1.512,61)');
  ok(L[3].precio === null && L[3].neto === null && L[3].cantidad === 4, 'un pan sin precio ese día queda registrado (4 kg) sin montos');
  const T = V.totales(L);
  ok(T.neto === 29120 + 30000 + 18681 && T.iva === 5533 + 5700 + 3549 && T.total === T.neto + T.iva && T.kg === 37.15 && T.un === 120 && T.canastos === 5 && T.sinPrecio === 1, 'totales: suma de líneas (neto, IVA, total, kilos, unidades, canastos)');
  ok(JSON.stringify(V.faltanPrecios(L)) === JSON.stringify([{ productoId: 'p3', nombre: 'Hallulla', fechas: ['2026-11-10'] }]), 'qué pan quedó sin precio y qué días');
  ok(V.juntarFaltan([{ productoId: 'p3', nombre: 'H', fechas: ['2026-11-10'] }], [{ productoId: 'p3', nombre: 'H', fechas: ['2026-11-02', '2026-11-10'] }])[0].fechas.join() === '2026-11-02,2026-11-10', 'se juntan sin repetir días');
  ok(V.lineas(pes, prods, precios, null, 19).every(l => l.neto === null), 'sin cliente no hay montos');

  console.log('3. Por entrega, por día y por pan: todo cuadra');
  const ent = V.porEntrega(L), dias = V.porDia(L), panes = V.porPan(L, prods);
  ok(ent.length === 3 && ent[0].neto === 29120 && ent[1].neto === 30000 && ent[2].neto === 18681 && ent[2].sinPrecio === 1, 'tres entregas, cada una con su venta');
  ok(dias.length === 2 && dias[0].entregas === 2 && dias[0].neto === 59120 && dias[1].entregas === 1, 'dos días, con cuántas entregas tuvo cada uno');
  ok(panes.map(p => p.nombre + ':' + p.cantidad).join() === 'Marraqueta:33.15,Pan de completo:120,Hallulla:4', 'por pan, en el orden del catálogo y en su unidad');
  const suma = (l, k) => l.reduce((t, x) => t + x[k], 0);
  ok(['neto', 'iva', 'total', 'canastos'].every(k => suma(ent, k) === T[k] && suma(dias, k) === T[k] && suma(panes, k) === T[k]), 'entregas, días y panes suman lo mismo que el total');

  console.log('4. Meses y períodos');
  ok(JSON.stringify(V.rangoMes('2026-11')) === '{"desde":"2026-11-01","hasta":"2026-11-30"}' && V.rangoMes('2028-02').hasta === '2028-02-29' && V.rangoMes('2026-02').hasta === '2026-02-28', 'días de cada mes (con años bisiestos)');
  ok(V.sumarMeses('2026-11', 2) === '2027-01' && V.sumarMeses('2026-01', -1) === '2025-12' && V.mesTexto('2026-11') === 'noviembre 2026' && V.esMes('2026-11') && !V.esMes('2026-13'), 'cambiar de mes y nombrarlo');
  ok(V.diaSemana('2026-11-16') === 'lun' && V.diasEntre('2026-11-01', '2026-11-30') === 30, 'día de la semana y días de un período');
  ok(V.validarPeriodo('2026-11-01', '2026-12-31', '2026-11-16').hasta === '2026-11-16' && V.validarPeriodo('2026-11-10', '2026-11-01', '2026-11-16').error && V.validarPeriodo('2024-01-01', '2026-11-16', '2026-11-16').error && V.validarPeriodo('', '2026-11-01', '2026-11-16').error, 'un período válido no pasa de hoy ni de un año, y «desde» va antes');

  console.log('5. Registro general: filtros');
  ok(V.filtrar(pes, {}).length === 5 && V.filtrar(pes, { estado: 'anulados' }).map(p => p.id).join() === 'f' && V.filtrar(pes, { estado: 'todos' }).length === 6, 'por estado: vigentes (por omisión), anulados o todos');
  ok(V.filtrar(pes, { productoId: 'p1', entregaN: '1' }).map(p => p.id).join() === 'a,b,d' && V.filtrar(pes, { trabajadorId: 'otro' }).length === 0, 'por pan, entrega y trabajador');
  ok(V.ordenRegistro(pes).map(p => p.id).join() === 'f,d,e,c,b,a', 'del más nuevo al más antiguo');

  console.log('6. Excel del mes: «Listo cuando» (cuadra con la suma de sus entregas)');
  const lib = E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: pes, productos: prods, trabajadores: [{ id: 't1', nombre: 'Luis' }], precios, cliente: { id: 'c1', nombre: 'Supermercado' }, iva: 19, quien: 'Rosa', ahora: Date.parse('2026-11-16T13:00:00Z') });
  ok(lib.nombre === 'ventas-2026-11.xlsx' && E.nombreArchivo('2026-11-01', '2026-11-16') === 'ventas-2026-11.xlsx' && E.nombreArchivo('2026-10-15', '2026-11-16') === 'ventas-2026-10-15_a_2026-11-16.xlsx', 'nombre del archivo: el mes o el período');
  const X = leer(E.bytes(lib)), H = X.hojas;
  ok(X.orden.join() === 'Resumen,Ventas,Entregas,Por día,Por pan,Canastos', 'hojas: Resumen, Ventas, Entregas, Por día, Por pan y Canastos');
  const vf = H.Ventas.filas, nV = vf.length - 2;
  ok(vf[0].join('|') === 'Fecha|Día|Entrega|Cliente|Pan|Unidad|Cantidad|Canastos|Precio neto|Neto|IVA|Total|Observación' && vf[1][3] === 'Supermercado', 'Ventas: con cliente, neto, IVA y total');
  ok(vf[4][12] === 'Sin precio ese día: no suma' && vf[4][9] == null, 'la fila sin precio lo dice y no suma');
  const totV = sumaCol(vf, 9, 1, 1 + nV), totE = sumaCol(H.Entregas.filas, 7, 1, H.Entregas.filas.length - 1), totD = sumaCol(H['Por día'].filas, 6, 1, H['Por día'].filas.length - 1), totP = sumaCol(H['Por pan'].filas, 4, 1, H['Por pan'].filas.length - 1);
  ok(totV === T.neto && totE === T.neto && totD === T.neto && totP === T.neto, 'neto del mes: Ventas = Entregas = Por día = Por pan = $' + T.neto);
  ok(sumaCol(vf, 10, 1, 1 + nV) === sumaCol(H.Entregas.filas, 8, 1, H.Entregas.filas.length - 1) && sumaCol(vf, 11, 1, 1 + nV) === sumaCol(H.Entregas.filas, 9, 1, H.Entregas.filas.length - 1), 'el IVA y el total también cuadran fila a fila con las entregas');
  ok(vf[nV + 1][9] === T.neto && H.Ventas.formulas['J' + (nV + 2)] === 'SUM(J2:J' + (nV + 1) + ')' && H.Entregas.formulas['H' + (H.Entregas.filas.length)] === 'SUM(H2:H' + (H.Entregas.filas.length - 1) + ')', 'las filas de total son fórmulas SUMA (si se edita una fila, el total cambia)');
  const res = H.Resumen.filas, fila = t => res.find(f => f[0] === t) || [];
  ok(fila('Neto')[1] === T.neto && fila('Total')[1] === T.total && H.Resumen.formulas.B8 === 'Ventas!J' + (nV + 2) && fila('Período')[1] === '1 nov 2026 a 30 nov 2026' && fila('Cliente')[1] === 'Supermercado', 'Resumen: período, cliente y totales enlazados a la hoja Ventas');
  ok(res.some(f => f[0] === 'Hallulla' && f[2] === '10 nov 2026'), 'Resumen: lista los panes vendidos sin precio');
  ok(H.Canastos.filas.length === 7 && H.Canastos.filas.some(f => f[8] === 'Anulado') && H.Canastos.filas[1][6] === 'Luis', 'Canastos: cada uno (también el anulado, marcado) con quién pesó');
  ok(E.libro({ desde: '2026-12-01', hasta: '2026-12-31', pesajes: [], productos: prods, precios, cliente: null, iva: 19 }).hojas[1].filas.length === 1, 'un mes sin ventas da un Excel con sus encabezados, sin errores');

  console.log('7. Un mes completo al azar (30 días, varias entregas, precios que cambian)');
  let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const muchos = [], pr2 = precios.concat([{ productoId: 'p3', clienteId: 'c1', neto: 1333.33, desde: '2026-10-20' }]);
  for (let d = 1; d <= 30; d++) for (let n = 1; n <= 1 + Math.floor(azar() * 3); n++) for (let k = 0; k < 6; k++) {
    const p = prods[Math.floor(azar() * 3)]; muchos.push(P('m' + d + n + k, '2026-11-' + String(d).padStart(2, '0'), '0' + (4 + n) + ':' + String(k * 7).padStart(2, '0'), n, p.id, p.unidad === 'un' ? 1 + Math.floor(azar() * 300) : Math.round(azar() * 2500) / 100 + 0.01, p.unidad, { anulado: azar() < 0.05 }));
  }
  const lib2 = E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: muchos, productos: prods, precios: pr2, cliente: { id: 'c1', nombre: 'S' }, iva: 19 }), H2 = leer(E.bytes(lib2)).hojas;
  const nE2 = H2.Entregas.filas.length - 2, nV2 = H2.Ventas.filas.length - 2;
  const netoE2 = sumaCol(H2.Entregas.filas, 7, 1, 1 + nE2), ivaMes2 = Math.round(lib2.totales.neto * 19 / 100);
  ok(netoE2 === sumaCol(H2.Ventas.filas, 9, 1, 1 + nV2) && netoE2 === lib2.totales.neto && lib2.totales.iva === ivaMes2 && lib2.totales.total === netoE2 + ivaMes2 && lib2.totales.total > 0, muchos.length + ' canastos, ' + nE2 + ' entregas: el neto del Excel del mes es la suma del neto de sus entregas, y el IVA es el 19 % de ese neto ($' + lib2.totales.total + ')');
  ok(Math.abs(sumaCol(H2.Entregas.filas, 9, 1, 1 + nE2) - lib2.totales.total) <= nE2 && H2.Entregas.filas[nE2 + 1][9] === lib2.totales.total && H2.Ventas.filas[nV2 + 1][11] === lib2.totales.total, 'la fila Total de cada hoja da el total del mes; sumar el total de cada entrega difiere a lo más en unos pesos (' + Math.abs(sumaCol(H2.Entregas.filas, 9, 1, 1 + nE2) - lib2.totales.total) + ')');

  console.log('8. Respaldo');
  const leidas = [], falso = { doc: async r => { leidas.push(r); return r === 'config/negocio' ? { duenos: ['u1'] } : null; }, col: async r => { leidas.push(r); return r === 'pesajes' ? pes : []; } };
  const dueno = await R.reunir(falso, 'dueno'), ext = await R.reunir(falso, 'externo');
  ok(Object.keys(dueno.datos).includes('miembros') && !Object.keys(ext.datos).includes('miembros') && !Object.keys(ext.datos).includes('solicitudes'), 'los dueños respaldan también los accesos; el externo no (no puede leerlos)');
  ok(dueno.lecturas === 2 + 6 + 10 && ext.lecturas === 2 + 6 + 8, 'cuenta las lecturas (al menos una por consulta, como cobra Firestore)');
  const arch = R.armar(dueno.datos, { por: { uid: 'u1' }, perfil: 'dueno', lecturas: dueno.lecturas, creado: '2026-11-16T10:00:00Z' });
  ok(R.esRespaldo(arch) && arch.conteos.pesajes === 6 && arch.conteos.miembros === 0 && R.nombreArchivo('2026-11-16') === 'respaldo-panaderia-2026-11-16.json', 'el archivo tiene cabecera, conteos y nombre con la fecha');
  let corto = null; try { await R.reunir({ doc: async () => null, col: async r => { if (r === 'pesajes') throw new Error('sin red'); return []; } }, 'externo'); } catch (e) { corto = e.message; }
  ok(corto === 'sin red', 'si una lectura falla, el respaldo se corta (no entrega uno incompleto)');
  const dia = 86400000, ahora = Date.parse('2026-11-16T12:00:00Z');
  ok(R.toca(null, ahora) && !R.toca(undefined, ahora) && !R.toca({ en: ahora - 6 * dia }, ahora) && R.toca({ en: ahora - 7 * dia }, ahora), 'la franja sale si nunca hubo respaldo o pasaron 7 días (y no mientras no se sabe)');
  ok(R.textoMarca({ en: ahora - 3 * dia, quien: 'Rosa' }, ahora) === 'Último respaldo: hace 3 días (Rosa).' && /hoy/.test(R.textoMarca({ en: ahora }, ahora)) && /Aún no hay/.test(R.textoMarca(null)), 'texto del último respaldo');
  const m = R.marcaNueva('u1', '  Rosa   Pérez ', { pesajes: 6 }, 18.4);
  ok(JSON.stringify(m) === '{"por":"u1","quien":"Rosa Pérez","conteos":{"pesajes":6},"lecturas":18}' && R.marcaNueva('u1', '', {}, 1).quien === 'Sin nombre', 'la marca guardada cumple la forma que piden las reglas');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
