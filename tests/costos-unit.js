/* Costos y margen por pan sin navegador (APP/js/core/costos.js), con las recetas de la panadería (Felipe, 20-nov-2026):
   insumos y sus precios con vigencia, cantidades («250 g»), receta por tanda con su rendimiento, costo por kg o por unidad,
   margen por línea de venta y del mes, meses cerrados (desde Excel: estimado), gastos del mes, resultado y simulador de precio.
   «Listo cuando» (PLAN, Fase 9): la receta da el mismo costo que el cálculo a mano y un alza (o una receta nueva) no cambia los meses anteriores.
   Uso: node tests/costos-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cerca = (a, b, d) => typeof a === 'number' && Math.abs(a - b) <= (d || 1e-6);

/* Datos de ejemplo: los precios son inventados (netos de factura); las recetas son las de la panadería. */
const INSUMOS = [
  { id: 'har', nombre: 'Harina', unidad: 'kg', activo: true }, { id: 'mar', nombre: 'Margarina', unidad: 'kg', activo: true },
  { id: 'sal', nombre: 'Sal', unidad: 'kg', activo: true }, { id: 'azu', nombre: 'Azúcar', unidad: 'kg', activo: true },
  { id: 'lev', nombre: 'Levadura', unidad: 'kg', activo: true }, { id: 'agu', nombre: 'Agua', unidad: 'l', activo: true },
  { id: 'hue', nombre: 'Huevo', unidad: 'un', activo: true }];
const PRECIOS = [
  { id: 'har_2026-01-01', insumoId: 'har', formato: 25, neto: 18500, desde: '2026-01-01' },   // 740 el kilo
  { id: 'mar_2026-01-01', insumoId: 'mar', formato: 10, neto: 22000, desde: '2026-01-01' },   // 2.200 el kilo
  { id: 'sal_2026-01-01', insumoId: 'sal', formato: 25, neto: 6250, desde: '2026-01-01' },    // 250 el kilo
  { id: 'azu_2026-01-01', insumoId: 'azu', formato: 25, neto: 25000, desde: '2026-01-01' },   // 1.000 el kilo
  { id: 'lev_2026-01-01', insumoId: 'lev', formato: 0.5, neto: 2250, desde: '2026-01-01' },   // 4.500 el kilo
  { id: 'agu_2026-01-01', insumoId: 'agu', formato: 1, neto: 0, desde: '2026-01-01' },        // el agua va en los gastos del mes
  { id: 'hue_2026-01-01', insumoId: 'hue', formato: 30, neto: 6000, desde: '2026-01-01' }];   // 200 cada huevo
const PROD = [{ id: 'hal', nombre: 'Hallulla', unidad: 'kg', orden: 1 }, { id: 'marr', nombre: 'Marraqueta', unidad: 'kg', orden: 2 },
  { id: 'com', nombre: 'Pan de completo', unidad: 'un', pesoRef: 100, orden: 3 }, { id: 'dob', nombre: 'Dobladita', unidad: 'kg', orden: 4 }];
const it = (insumoId, cantidad) => ({ insumoId, cantidad });
const RECETAS = [
  { id: 'hal_2026-01-01', productoId: 'hal', desde: '2026-01-01', rendimiento: 16.5, items: [it('har', 12.5), it('mar', 0.25), it('sal', 0.16), it('azu', 0.06), it('lev', 0.13), it('agu', 7)], nota: 'Levadura: invierno 130 g, verano 100 g' },
  { id: 'marr_2026-01-01', productoId: 'marr', desde: '2026-01-01', rendimiento: 17.5, items: [it('har', 12), it('mar', 0.2), it('sal', 0.16), it('azu', 0.06), it('lev', 0.13), it('agu', 7.5)] },
  { id: 'com_2026-01-01', productoId: 'com', desde: '2026-01-01', rendimiento: 192, items: [it('har', 12), it('mar', 0.2), it('sal', 0.16), it('azu', 0.06), it('lev', 0.13), it('agu', 7.5)] },
  { id: 'dob_2026-01-01', productoId: 'dob', desde: '2026-01-01', rendimiento: 14.2, items: [it('har', 10), it('mar', 1), it('sal', 0.13), it('hue', 1), it('agu', 3.5)] }];
const K = { insumos: INSUMOS, preciosInsumo: PRECIOS, recetas: RECETAS };
/* A mano: hallulla 12,5×740 + 0,25×2.200 + 0,16×250 + 0,06×1.000 + 0,13×4.500 = 9.250 + 550 + 40 + 60 + 585 = 10.485 → /16,5 kg
           marraqueta (y completos) 12×740 + 0,2×2.200 + 40 + 60 + 585 = 8.880 + 440 + 685 = 10.005 → /17,5 kg · /192 unidades
           dobladita 10×740 + 1×2.200 + 0,13×250 + 1×200 = 7.400 + 2.200 + 32,5 + 200 = 9.832,5 → /14,2 kg */
const A_MANO = { hal: 10485 / 16.5, marr: 10005 / 17.5, com: 10005 / 192, dob: 9832.5 / 14.2 };

(async () => {
  const C = await import('../APP/js/core/costos.js'), V = await import('../APP/js/core/ventas.js');

  console.log('1. Insumos y sus precios');
  ok(eq(C.validarInsumo({ nombre: '  Harina  ', unidad: 'kg' }, []).datos, { nombre: 'Harina', unidad: 'kg', activo: true }), 'un insumo: nombre limpio, unidad y activo');
  ok(/Ya hay/.test(C.validarInsumo({ nombre: 'harina', unidad: 'kg' }, INSUMOS).error) && /kilos, litros/.test(C.validarInsumo({ nombre: 'Crema', unidad: 'x' }, []).error), 'no repite nombres y pide la unidad');
  ok(eq(C.validarPrecio({ formato: '25', neto: '18.500', desde: '2026-01-01' }).datos, { formato: 25, neto: 18500, desde: '2026-01-01' }), 'precio de factura: formato (saco de 25 kg) y neto');
  ok(C.validarPrecio({ formato: '1', neto: '0', desde: '2026-01-01' }).datos.neto === 0, 'un insumo puede costar $0 (el agua va en los gastos del mes)');
  ok(!!C.validarPrecio({ formato: '0', neto: '100', desde: '2026-01-01' }).error && !!C.validarPrecio({ formato: '25', neto: 'x', desde: '2026-01-01' }).error && !!C.validarPrecio({ formato: '25', neto: '100', desde: '' }).error, 'rechaza formato 0, precio que no es número y fecha vacía');
  ok(C.porUnidad(PRECIOS[0]) === 740 && C.porUnidad(PRECIOS[4]) === 4500 && C.porUnidad(PRECIOS[6]) === 200, 'pesos por kilo o unidad = neto ÷ formato (740, 4.500 y 200)');
  const alza = PRECIOS.concat([{ id: 'har_2026-12-01', insumoId: 'har', formato: 25, neto: 20000, desde: '2026-12-01' }]);
  ok(C.precioVigente(alza, 'har', '2026-11-30').neto === 18500 && C.precioVigente(alza, 'har', '2026-12-01').neto === 20000 && C.precioVigente(alza, 'har', '2025-12-31') === null, 'el precio vigente es el de «desde» más reciente que no pasa del día');
  ok(C.idPrecio('har', '2026-12-01') === 'har_2026-12-01' && C.historial(alza, 'har')[0].desde === '2026-12-01', 'identificador insumo_fecha e historial del más nuevo al más antiguo');

  console.log('2. Cantidades de la receta');
  ok(C.cantidad('250 g', 'kg') === 0.25 && C.cantidad('250gr', 'kg') === 0.25 && C.cantidad('160 GR', 'kg') === 0.16 && C.cantidad('12,5', 'kg') === 12.5 && C.cantidad('12,5 kg', 'kg') === 12.5, 'en kilos: «250 g», «250gr», «12,5» y «12,5 kg»');
  ok(C.cantidad('7,5', 'l') === 7.5 && C.cantidad('7,5 lt', 'l') === 7.5 && C.cantidad('500 ml', 'l') === 0.5 && C.cantidad('1', 'un') === 1, 'en litros: «7,5», «7,5 lt», «500 ml»; en unidades: «1»');
  ok([C.cantidad('', 'kg'), C.cantidad('mucho', 'kg'), C.cantidad('250 g', 'l'), C.cantidad('2 kg', 'un'), C.cantidad('12 k1/2', 'kg')].every(Number.isNaN), 'lo que no se entiende (o con la unidad equivocada) se rechaza');
  ok(C.textoCantidad(0.25, 'kg') === '250 g' && C.textoCantidad(12.5, 'kg') === '12,5 kg' && C.textoCantidad(0.5, 'l') === '500 ml' && C.textoCantidad(7, 'l') === '7 l' && C.textoCantidad(1, 'un') === '1 un', 'se muestran en g o ml cuando es menos de 1');

  console.log('3. Receta y costo por kg o unidad (las cuatro recetas)');
  const cant = { har: '12,5', mar: '250 g', sal: '160 g', azu: '60 g', lev: '130 g', agu: '7' };
  const v = C.validarReceta({ cantidades: cant, rendimiento: '16,5', desde: '2026-01-01', nota: ' Levadura: invierno 130 g, verano 100 g ' }, PROD[0], INSUMOS);
  ok(eq(v.datos, { productoId: 'hal', desde: '2026-01-01', items: RECETAS[0].items, rendimiento: 16.5, nota: 'Levadura: invierno 130 g, verano 100 g' }), 'la hallulla escrita como en la panadería queda igual a la receta');
  ok(/Harina/.test(C.validarReceta({ cantidades: { har: 'doce' }, rendimiento: '16', desde: '2026-01-01' }, PROD[0], INSUMOS).error), 'una cantidad que no se entiende dice de qué insumo es');
  ok(/al menos un ingrediente/.test(C.validarReceta({ cantidades: {}, rendimiento: '16', desde: '2026-01-01' }, PROD[0], INSUMOS).error), 'pide al menos un ingrediente');
  ok(/kilos de pan/.test(C.validarReceta({ cantidades: cant, rendimiento: '0', desde: '2026-01-01' }, PROD[0], INSUMOS).error) && /unidades salen/.test(C.validarReceta({ cantidades: cant, rendimiento: '192,5', desde: '2026-01-01' }, PROD[2], INSUMOS).error), 'el rendimiento: kilos (pan por kilo) o unidades enteras (pan por unidad)');
  for (const p of PROD) {
    const r = C.costoReceta(C.recetaVigente(RECETAS, p.id, '2026-11-20'), INSUMOS, PRECIOS, '2026-11-20', p);
    ok(cerca(r.unitario, A_MANO[p.id]) && r.faltan.length === 0, p.nombre + ': ' + Math.round(r.tanda) + ' pesos la tanda → ' + (Math.round(r.unitario * 100) / 100) + (p.unidad === 'un' ? ' por unidad' : ' por kg') + ' (igual al cálculo a mano)');
  }
  const h = C.costoReceta(RECETAS[0], INSUMOS, PRECIOS, '2026-11-20', PROD[0]);
  ok(h.masa === 20.1 && h.merma === 17.9 && h.items.length === 6 && h.items[0].costo === 9250, 'hallulla: 20,1 kg de masa, 17,9 % se pierde al hornear (informativo), la harina pone 9.250 pesos');
  ok(C.costoReceta(RECETAS[2], INSUMOS, PRECIOS, '2026-11-20', PROD[2]).merma === null, 'en un pan por unidad no se calcula la merma');
  const sinSal = PRECIOS.filter(p => p.insumoId !== 'sal'), x = C.costoReceta(RECETAS[0], INSUMOS, sinSal, '2026-11-20', PROD[0]);
  ok(x.unitario === null && eq(x.faltan, ['Sal']) && C.faltaCosto({ insumos: INSUMOS, preciosInsumo: sinSal, recetas: RECETAS }, 'hal', '2026-11-20') === 'precio', 'si falta el precio de un insumo, no hay costo y se dice cuál');
  ok(C.faltaCosto(K, 'nada', '2026-11-20') === 'receta' && C.costoUnitario(K, 'nada', '2026-11-20') === null && C.faltaCosto(K, 'hal', '2026-11-20') === '', 'un pan sin receta no tiene costo');

  console.log('4. Vigencia: un alza o una receta nueva no cambian los meses anteriores');
  const K2 = { insumos: INSUMOS, preciosInsumo: alza, recetas: RECETAS.concat([Object.assign({}, RECETAS[0], { id: 'hal_2027-01-01', desde: '2027-01-01', items: RECETAS[0].items.map(i => (i.insumoId === 'lev' ? it('lev', 0.1) : i)) })]) };
  ok(cerca(C.costoUnitario(K2, 'hal', '2026-11-30'), A_MANO.hal), 'noviembre conserva el costo de la hallulla después del alza de la harina');
  ok(cerca(C.costoUnitario(K2, 'hal', '2026-12-01'), (12.5 * 800 + 550 + 40 + 60 + 585) / 16.5), 'desde el 1 de diciembre rige la harina a 800 el kilo');
  ok(cerca(C.costoUnitario(K2, 'hal', '2027-01-05'), (12.5 * 800 + 550 + 40 + 60 + 450) / 16.5) && C.recetaVigente(K2.recetas, 'hal', '2026-12-31').desde === '2026-01-01', 'la receta de verano (100 g de levadura) rige desde su fecha; antes, la de invierno');

  console.log('5. Margen por línea y por mes');
  const precios = [{ productoId: 'hal', clienteId: 'c', neto: 1300, desde: '2026-01-01' }, { productoId: 'marr', clienteId: 'c', neto: 1200, desde: '2026-01-01' },
    { productoId: 'com', clienteId: 'c', neto: 110, desde: '2026-01-01' }];   // la dobladita queda sin precio
  const pz = (id, fecha, productoId, cantidad, mas) => Object.assign({ id, fecha, hora: '07:00', entregaN: 1, productoId, cantidad, unidad: productoId === 'com' ? 'un' : 'kg', trabajadorId: 't', anulado: false }, mas || {});
  const pes = [pz('1', '2026-11-02', 'hal', 18.5), pz('2', '2026-11-02', 'hal', 17.25), pz('3', '2026-11-02', 'marr', 20), pz('4', '2026-11-03', 'com', 192), pz('5', '2026-11-03', 'dob', 7.1), pz('6', '2026-11-03', 'hal', 5, { anulado: true })];
  const L = C.conCostos(V.lineas(pes, PROD, precios, 'c', 19), K, PROD), hal = L.find(l => l.productoId === 'hal');
  ok(hal.cantidad === 35.75 && hal.neto === 46475 && hal.costo === Math.round(A_MANO.hal * 35.75) && hal.margen === 46475 - hal.costo, 'hallulla: 35,75 kg → venta 46.475, ingredientes ' + hal.costo + ' (sin el canasto anulado)');
  ok(cerca(hal.margenPct, (46475 - hal.costo) / 46475 * 100), 'margen % = (venta − costo) ÷ venta');
  const dob = L.find(l => l.productoId === 'dob');
  ok(dob.neto === null && dob.costo === Math.round(A_MANO.dob * 7.1) && dob.margen === null, 'un pan sin precio tiene costo, pero no margen');
  const T = C.totalesCosto(L);
  ok(T.venta === V.totales(L).neto && T.costo === L.reduce((s, l) => s + l.costo, 0) && T.margen === T.venta - T.costo && T.sinCosto === 0, 'totales del período = suma de las líneas');
  const R = C.resumenMes('2026-11', { pesajes: pes, productos: PROD, precios, clienteId: 'c', iva: 19, k: K, gastos: { mes: '2026-11', items: [{ nombre: 'Gas', monto: 180000 }, { nombre: 'Sueldos', monto: 900000 }] } });
  ok(R.venta === T.venta && R.costo === T.costo && R.margen === T.margen && R.totalGastos === 1080000 && R.resultado === T.margen - 1080000, 'resultado del mes = venta − ingredientes − gastos');
  ok(cerca(R.resultadoPct, R.resultado / R.venta * 100) && R.panes[0].productoId === 'hal' && R.sinPrecio.length === 1 && R.sinCosto.length === 0 && !R.estimado, 'por pan, de la que más vende; avisa el pan sin precio');
  const sinRec = C.resumenMes('2026-11', { pesajes: pes, productos: PROD, precios, clienteId: 'c', iva: 19, k: { insumos: INSUMOS, preciosInsumo: PRECIOS, recetas: RECETAS.slice(0, 2) } });
  ok(sinRec.sinCosto.map(p => p.productoId).join() === 'com,dob' && sinRec.costo === sinRec.panes.reduce((s, p) => s + (p.costo || 0), 0), 'los panes sin receta se avisan y no suman ingredientes');
  ok(eq(C.faltanCostos(C.conCostos(V.lineas(pes, PROD, precios, 'c', 19), { insumos: INSUMOS, preciosInsumo: PRECIOS, recetas: [] }, PROD)).map(f => f.nombre), ['Dobladita', 'Hallulla', 'Marraqueta', 'Pan de completo']), 'faltanCostos lista los panes sin costo');

  console.log('6. Meses cerrados');
  const cierreExcel = { mes: '2026-10', origen: 'excel', cerrado: true, neto: 900000, lineas: [{ productoId: 'hal', nombre: 'Hallulla', unidad: 'kg', cantidad: 400, precio: 1300, neto: 520000 }, { productoId: 'marr', nombre: 'Marraqueta', unidad: 'kg', cantidad: 316.67, precio: 1200, neto: 380000 }] };
  const RE = C.resumenMes('2026-10', { cierre: cierreExcel, pesajes: [], productos: PROD, precios, clienteId: 'c', iva: 19, k: K2 });
  ok(RE.venta === 900000 && RE.estimado && RE.panes[0].costo === Math.round(A_MANO.hal * 400) && RE.panes[1].costo === Math.round(A_MANO.marr * 316.67), 'mes de Excel: venta del cierre e ingredientes ESTIMADOS con el costo vigente el último día del mes');
  const pesO = [pz('a', '2026-09-10', 'hal', 20), pz('b', '2026-09-11', 'hal', 10)];
  const cierreApp = { mes: '2026-09', origen: 'app', cerrado: true, neto: 39000, lineas: [{ productoId: 'hal', nombre: 'Hallulla', unidad: 'kg', cantidad: 30, precio: 1300, neto: 39000 }] };
  const RA = C.resumenMes('2026-09', { cierre: cierreApp, pesajes: pesO, productos: PROD, precios, clienteId: 'c', iva: 19, k: K });
  ok(RA.venta === 39000 && !RA.estimado && RA.costo === Math.round(A_MANO.hal * 20) + Math.round(A_MANO.hal * 10), 'mes cerrado con la app: venta del cierre e ingredientes de cada día (no estimados)');
  ok(RA.totalGastos === 0 && !RA.hayGastos && RA.resultado === RA.margen, 'sin gastos anotados, el resultado es el margen');

  console.log('7. Gastos del mes');
  ok(eq(C.filasGastos(null).map(f => f.nombre), C.SUGERIDOS.concat(['', ''])), 'sin gastos: las líneas sugeridas (gas, luz, sueldos, arriendo…) y dos libres');
  ok(C.filasGastos({ items: [{ nombre: 'Sueldos', monto: 900000 }, { nombre: 'Leña', monto: 5000 }] })[0].monto === 900000 && C.filasGastos({ items: [{ nombre: 'Leña', monto: 5000 }] }).some(f => f.nombre === 'Leña'), 'con gastos: las del mes primero, luego las sugeridas que falten');
  ok(eq(C.validarGastos([{ nombre: 'Gas', monto: '180.000' }, { nombre: 'Luz', monto: '' }, { nombre: 'Sueldos', monto: '900000' }]).items, [{ nombre: 'Gas', monto: 180000 }, { nombre: 'Sueldos', monto: 900000 }]), 'las líneas sin monto no se guardan; montos a la chilena');
  ok(/nombre/.test(C.validarGastos([{ nombre: '', monto: '5000' }]).error) && /dos veces/.test(C.validarGastos([{ nombre: 'Gas', monto: '1' }, { nombre: 'gas', monto: '2' }]).error) && /monto/.test(C.validarGastos([{ nombre: 'Gas', monto: 'mucho' }]).error), 'pide nombre, no repite y rechaza montos raros');
  ok(eq(C.documentoGastos('2026-11', [{ nombre: 'Gas', monto: 1 }], { por: 'u1', quien: 'Rosa' }), { mes: '2026-11', items: [{ nombre: 'Gas', monto: 1 }], por: 'u1', quien: 'Rosa' }), 'documento de gastos con quién lo guardó');

  console.log('8. Simulador de precio');
  const cu = A_MANO.marr;
  ok(cerca(C.simular(cu, 1200).margen, 1200 - cu) && cerca(C.simular(cu, 1000).pct, (1000 - cu) / 10), '«si el precio fuera»: margen en pesos y en %');
  ok(C.precioPara(700, 30) === 1000 && C.precioPara(cu, 30) === Math.round(cu / 0.7 * 100) / 100 && C.precioPara(700, 100) === null && C.precioPara(null, 30) === null, '«para ganar 30 %»: costo 700 → precio 1.000 (30 % del precio de venta)');
  ok(C.pctTexto(30) === '30 %' && C.pctTexto(17.94) === '17,9 %' && C.pctTexto(null) === '—', 'porcentajes con coma y un decimal');

  console.log('9. Excel del mes con costos (hoja «Resultado»)');
  const E = await import('../APP/js/core/excel.js'), X = await import('../APP/js/core/xlsx.js');
  const base = { desde: '2026-11-01', hasta: '2026-11-30', pesajes: pes, productos: PROD, trabajadores: [], precios, cliente: { id: 'c', nombre: 'Supermercado' }, iva: 19, ahora: Date.UTC(2026, 10, 30, 15) };
  const sin = E.libro(base), con = E.libro(Object.assign({}, base, { costos: { k: K, mes: '2026-11', gastos: { items: [{ nombre: 'Gas', monto: 180000 }, { nombre: 'Sueldos', monto: 900000 }] } } }));
  ok(sin.hojas.length === 6 && !sin.hojas.some(h => h.nombre === 'Resultado') && sin.hojas[1].filas[0].length === 13, 'sin la casilla de costos, el Excel sale igual que antes');
  const hV = con.hojas.find(h => h.nombre === 'Ventas'), hR = con.hojas.find(h => h.nombre === 'Resultado'), hP = con.hojas.find(h => h.nombre === 'Por pan'), nV = con.lineas.length;
  ok(con.hojas[1].nombre === 'Resultado' && hV.filas[0].map(x => x.v).slice(12, 16).join('|') === 'Costo ingredientes|Margen|Margen %|Observación', 'con costos: columnas Costo ingredientes, Margen y Margen % en «Ventas», y la hoja «Resultado»');
  const tot = hV.filas[nV + 1];
  ok(tot[12].f === 'SUM(M2:M' + (nV + 1) + ')' && tot[12].v === R.costo && tot[13].v === R.margen && tot[13].f === 'J' + (nV + 2) + '-M' + (nV + 2), 'la fila Total de «Ventas»: ingredientes = los de Costos → El mes; margen = neto − ingredientes');
  const fila = t => hR.filas.find(f => f[0] && (f[0].v || f[0]) === t);
  ok(fila('Venta neta')[1].f === 'Ventas!J' + (nV + 2) && fila('Ingredientes')[1].f === 'Ventas!M' + (nV + 2) && fila('Venta neta')[1].v === R.venta, '«Resultado» toma la venta y los ingredientes de los totales de «Ventas»');
  ok(fila('Total de gastos')[1].v === 1080000 && fila('Resultado del mes')[1].v === R.resultado && /^B\d+-B\d+$/.test(fila('Resultado del mes')[1].f), 'gastos del mes y resultado = margen − gastos (con fórmula)');
  const dobV = hV.filas.find(f => f[4] === 'Dobladita');
  ok(dobV[15] === 'Sin precio ese día: no suma' && dobV[12].v === Math.round(A_MANO.dob * 7.1) && dobV[13] === null, 'la fila sin precio tiene costo pero no margen');
  ok(hP.filas[0].length === 11 && hP.filas.find(f => f[0] === 'Hallulla')[8].v === hal.costo, '«Por pan» con el costo de cada pan');
  const otro = E.libro(Object.assign({}, base, { desde: '2026-11-02', hasta: '2026-11-03', costos: { k: K, mes: null, gastos: null } }));
  ok(!otro.hojas[1].filas.some(f => f[0] && (f[0].v || f[0]) === 'Total de gastos') && otro.hojas[1].filas.some(f => f[0] === 'Gastos del mes'), 'con otras fechas (no un mes) no van los gastos: se explica');
  const zip = E.bytes(con, new Date(Date.UTC(2026, 10, 30)));
  ok(zip instanceof Uint8Array && zip.length > 1000 && X.ESTILOS.pct === 12 && X.ESTILOS['b-pct'] === 13, 'el archivo se arma (estilo de porcentaje para el margen)');

  console.log(fails ? '\n' + fails + ' verificaciones fallaron' : '\nTodo bien');
  process.exit(fails ? 1 : 0);
})();
