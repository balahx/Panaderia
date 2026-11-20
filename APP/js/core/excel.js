/* Excel de ventas (PLAN §3.10): neto, IVA, total y cliente. Arma las hojas con core/ventas.js y las escribe con core/xlsx.js.
   Lógica pura: se prueba con Node (tests/ventas-unit.js). Hojas:
     Resumen   período, cliente, IVA, totales (con fórmula a la hoja Ventas) y los panes sin precio
     Ventas    una fila por pan y entrega de cada día: cantidad, canastos, precio neto, neto, IVA, total  ← el detalle
     Entregas  una fila por entrega · Por día · Por pan   (todas son sumas de las filas de «Ventas»: cuadran entre sí)
     Canastos  cada canasto pesado, también los anulados (marcados), con quién pesó, nota y cuándo se anotó
   Fase 9 (si se piden los costos, d.costos): «Ventas» y «Por pan» suman Costo ingredientes, Margen y Margen % (margen sobre la venta),
   y una hoja más, «Resultado»: venta, ingredientes, margen, gastos del mes (si el período es un mes) y resultado. */
import * as V from './ventas.js';
import * as K from './costos.js';
import { fechaTexto, diaChile } from './formato.js';
import * as X from './xlsx.js';

const C = (v, s) => ({ v, s }), B = v => ({ v, s: 'b' });
const unidadTexto = u => (u === 'un' ? 'unidades' : 'kg');
const cab = l => l.map(t => C(t, 'cab'));
/* Fila de totales con SUMA de Excel (y el resultado ya calculado, por si el programa no recalcula). */
const suma = (col, n, v, s) => ({ f: 'SUM(' + col + '2:' + col + (n + 1) + ')', v, s });
/* IVA y total de la fila de totales (fila n + 2): IVA = IVA % × neto total, redondeado una vez; total = neto + IVA (como el cierre). */
const col = c => String.fromCharCode(c.charCodeAt(0) + 1);
const ivaTotal = (neto, n, pct, T) => [{ f: 'ROUND(' + neto + (n + 2) + '*' + pct + '/100,0)', v: T.iva, s: 'b-pesos' }, { f: neto + (n + 2) + '+' + col(neto) + (n + 2), v: T.total, s: 'b-pesos' }];
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };

export function nombreArchivo(desde, hasta) {
  const r = V.rangoMes(V.mesDe(desde));
  return 'ventas-' + (desde === r.desde && (hasta === r.hasta || V.mesDe(hasta) === V.mesDe(desde)) ? V.mesDe(desde) : desde + '_a_' + hasta) + '.xlsx';
}

/* d = { desde, hasta, pesajes, productos, trabajadores, precios, cliente, iva, quien, ahora (ms) }
   Devuelve { nombre, hojas, lineas, totales, faltan } (hojas para xlsx.crear). */
export function libro(d) {
  const cli = d.cliente || null, co = d.costos || null, l0 = V.lineas(d.pesajes, d.productos, d.precios, cli && cli.id, d.iva), T = V.totales(l0), faltan = V.faltanPrecios(l0);
  const ls = co ? K.conCostos(l0, co.k, d.productos) : l0, TC = co ? K.totalesCosto(ls) : null, sinCosto = co ? K.faltanCostos(ls) : [];
  const ent = V.porEntrega(ls), dias = V.porDia(ls), panes = V.porPan(ls, d.productos), cliente = cli ? cli.nombre : '(sin cliente)';
  const nV = ls.length, nE = ent.length, nD = dias.length, nP = panes.length;
  const ahora = new Date(d.ahora || Date.now());

  /* Costo, margen y margen % de una fila (Fase 9); en la fila de totales, margen = neto − costo y % = margen ÷ neto (con su resultado). */
  const costoCeldas = l => (co ? [l.costo == null ? null : C(l.costo, 'pesos'), l.margen == null ? null : C(l.margen, 'pesos'), l.margenPct == null ? null : C(Math.round(l.margenPct * 100) / 10000, 'pct')] : []);
  const costoTotal = (cN, cC, n, costo, neto) => (co ? [suma(cC, n, costo, 'b-pesos'), { f: cN + (n + 2) + '-' + cC + (n + 2), v: neto - costo, s: 'b-pesos' },
    { f: 'IF(' + cN + (n + 2) + '=0,0,' + col(cC) + (n + 2) + '/' + cN + (n + 2) + ')', v: neto ? Math.round((neto - costo) / neto * 10000) / 10000 : 0, s: 'b-pct' }] : []);
  const obs = l => (l.neto == null ? 'Sin precio ese día: no suma' : co && l.costo == null ? 'Sin costo ese día (sin receta o un insumo sin precio)' : '');
  const ventas = { nombre: 'Ventas', congelar: 1, filtro: nV + 1, columnas: [11, 5, 8, 16, 26, 10, 11, 9, 12, 13, 12, 13].concat(co ? [13, 13, 10] : []).concat([22]),
    filas: [cab(['Fecha', 'Día', 'Entrega', 'Cliente', 'Pan', 'Unidad', 'Cantidad', 'Canastos', 'Precio neto', 'Neto', 'IVA', 'Total'].concat(co ? ['Costo ingredientes', 'Margen', 'Margen %'] : []).concat(['Observación']))]
      .concat(ls.map(l => [C(l.fecha, 'fecha'), V.diaSemana(l.fecha), C(l.entregaN, 'entero'), cliente, l.nombre, unidadTexto(l.unidad), C(l.cantidad, l.unidad === 'un' ? 'entero' : 'kilos'), C(l.canastos, 'entero'),
        l.precio == null ? null : C(l.precio, 'precio'), l.neto == null ? null : C(l.neto, 'pesos'), l.iva == null ? null : C(l.iva, 'pesos'), l.total == null ? null : C(l.total, 'pesos')].concat(costoCeldas(l)).concat([obs(l)])))
      .concat(nV ? [[B('Total'), null, null, null, null, null, null, suma('H', nV, T.canastos, 'b-entero'), null, suma('J', nV, T.neto, 'b-pesos')].concat(ivaTotal('J', nV, d.iva, T)).concat(costoTotal('J', 'M', nV, co ? TC.costo : 0, T.neto))] : []) };

  const entregas = { nombre: 'Entregas', congelar: 1, filtro: nE + 1, columnas: [11, 5, 8, 12, 9, 11, 11, 13, 12, 13],
    filas: [cab(['Fecha', 'Día', 'Entrega', 'Horario', 'Canastos', 'Kilos', 'Unidades', 'Neto', 'IVA', 'Total'])]
      .concat(ent.map(e => [C(e.fecha, 'fecha'), V.diaSemana(e.fecha), C(e.n, 'entero'), e.desde + (e.hasta && e.hasta !== e.desde ? '–' + e.hasta : ''), C(e.canastos, 'entero'), C(e.kg, 'kilos'), C(e.un, 'entero'), C(e.neto, 'pesos'), C(e.iva, 'pesos'), C(e.total, 'pesos')]))
      .concat(nE ? [[B('Total'), null, null, null, suma('E', nE, T.canastos, 'b-entero'), suma('F', nE, T.kg, 'b-kilos'), suma('G', nE, T.un, 'b-entero'), suma('H', nE, T.neto, 'b-pesos')].concat(ivaTotal('H', nE, d.iva, T))] : []) };

  const porDia = { nombre: 'Por día', congelar: 1, filtro: nD + 1, columnas: [11, 5, 9, 9, 11, 11, 13, 12, 13],
    filas: [cab(['Fecha', 'Día', 'Entregas', 'Canastos', 'Kilos', 'Unidades', 'Neto', 'IVA', 'Total'])]
      .concat(dias.map(x => [C(x.fecha, 'fecha'), V.diaSemana(x.fecha), C(x.entregas, 'entero'), C(x.canastos, 'entero'), C(x.kg, 'kilos'), C(x.un, 'entero'), C(x.neto, 'pesos'), C(x.iva, 'pesos'), C(x.total, 'pesos')]))
      .concat(nD ? [[B('Total'), null, suma('C', nD, nE, 'b-entero'), suma('D', nD, T.canastos, 'b-entero'), suma('E', nD, T.kg, 'b-kilos'), suma('F', nD, T.un, 'b-entero'), suma('G', nD, T.neto, 'b-pesos')].concat(ivaTotal('G', nD, d.iva, T))] : []) };

  /* Costo de cada pan = suma del costo de sus filas; si alguna fila no tiene costo, el pan queda sin costo (no suma). */
  const costoPan = id => { const f = ls.filter(l => l.productoId === id); return f.some(l => l.costo == null) ? null : f.reduce((s, l) => s + l.costo, 0); };
  const panC = p => { if (!co) return []; const c = costoPan(p.productoId); return c == null ? [null, null, null] : [C(c, 'pesos'), C(p.neto - c, 'pesos'), p.neto ? C(Math.round((p.neto - c) / p.neto * 10000) / 10000, 'pct') : null]; };
  const costoPanes = co ? panes.reduce((s, p) => s + (costoPan(p.productoId) || 0), 0) : 0;
  const porPan = { nombre: 'Por pan', congelar: 1, filtro: nP + 1, columnas: [26, 10, 11, 9, 13, 12, 13, 14].concat(co ? [13, 13, 10] : []),
    filas: [cab(['Pan', 'Unidad', 'Cantidad', 'Canastos', 'Neto', 'IVA', 'Total', 'Precio promedio'].concat(co ? ['Costo ingredientes', 'Margen', 'Margen %'] : []))]
      .concat(panes.map(p => [p.nombre, unidadTexto(p.unidad), C(p.cantidad, p.unidad === 'un' ? 'entero' : 'kilos'), C(p.canastos, 'entero'), C(p.neto, 'pesos'), C(p.iva, 'pesos'), C(p.total, 'pesos'),
        p.sinPrecio || !p.cantidad ? null : C(Math.round(p.neto / p.cantidad * 100) / 100, 'precio')].concat(panC(p))))
      .concat(nP ? [[B('Total'), null, null, suma('D', nP, T.canastos, 'b-entero'), suma('E', nP, T.neto, 'b-pesos')].concat(ivaTotal('E', nP, d.iva, T)).concat(co ? [null].concat(costoTotal('E', 'I', nP, costoPanes, T.neto)) : [])] : []) };

  const todos = V.ordenRegistro(d.pesajes).reverse(), nC = todos.length;
  const canastos = { nombre: 'Canastos', congelar: 1, filtro: true, columnas: [11, 7, 8, 26, 11, 10, 18, 30, 10, 12],
    filas: [cab(['Fecha', 'Hora', 'Entrega', 'Pan', 'Cantidad', 'Unidad', 'Pesó', 'Nota', 'Estado', 'Anotado el'])]
      .concat(todos.map(p => [C(p.fecha, 'fecha'), p.hora || '', C(p.entregaN || 1, 'entero'), nombreDe(d.productos, p.productoId), C(p.cantidad, p.unidad === 'un' ? 'entero' : 'kilos'), unidadTexto(p.unidad),
        nombreDe(d.trabajadores, p.trabajadorId), p.nota || '', p.anulado ? 'Anulado' : 'Vale', typeof p.en === 'number' ? C(diaChile(new Date(p.en)), 'fecha') : null])) };

  const ref = (col, n) => (n ? { f: 'Ventas!' + col + (n + 2) } : null);
  const resumen = { nombre: 'Resumen', columnas: [30, 18, 50],
    filas: [[C('Panadería · ventas', 'titulo')], [],
      ['Período', fechaTexto(d.desde) + ' a ' + fechaTexto(d.hasta)], ['Cliente', cliente], ['IVA', C(d.iva, 'kilos'), '%'],
      ['Descargado', fechaTexto(diaChile(ahora)) + ' ' + String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0') + (d.quien ? ' · ' + d.quien : '')], [],
      [B('Neto'), Object.assign({ v: T.neto, s: 'b-pesos' }, ref('J', nV))], [B('IVA'), Object.assign({ v: T.iva, s: 'b-pesos' }, ref('K', nV))], [B('Total'), Object.assign({ v: T.total, s: 'b-pesos' }, ref('L', nV))], [],
      ['Kilos', C(T.kg, 'kilos')], ['Unidades', C(T.un, 'entero')], ['Canastos', C(T.canastos, 'entero')], ['Días con venta', C(nD, 'entero')], ['Entregas', C(nE, 'entero')], []]
      .concat(faltan.length ? [[B('Vendido sin precio (no suma pesos)')]].concat(faltan.map(f => [f.nombre, f.fechas.length + (f.fechas.length === 1 ? ' día' : ' días'), f.fechas.map(fechaTexto).join(', ')])).concat([[]]) : [])
      .concat([['Cómo se calcula', null, 'Cada fila de «Ventas» es un pan en una entrega: cantidad × precio neto vigente ese día.'], [null, null, 'Los netos se suman. El IVA de un total es el IVA % de su neto, redondeado una vez (igual que el cierre del mes);'],
        [null, null, 'el IVA de cada fila es el de esa fila: sumados, pueden diferir en unos pesos del IVA del total.'],
        [null, null, 'Venta = lo pesado en la panadería (o anotado en fecha pasada), sin los canastos anulados.']]) };
  if (!nV) resumen.filas.splice(7, 0, ['Sin ventas en el período']);

  const hojas = [resumen, ventas, entregas, porDia, porPan, canastos];
  if (co) hojas.splice(1, 0, hojaResultado(d, co, TC, nV, sinCosto));
  return { nombre: nombreArchivo(d.desde, d.hasta), hojas, lineas: ls, totales: T, faltan, entregas: ent, costos: TC, sinCosto };
}
/* Hoja «Resultado» (Fase 9): venta neta e ingredientes enlazados a los totales de «Ventas», margen, gastos del mes y resultado.
   Los gastos van solo si el período es un mes (co.gastos = el documento de ese mes, o null). */
function hojaResultado(d, co, TC, nV, sinCosto) {
  const G = K.totalGastos(co.gastos), filas = [[C('Panadería · resultado', 'titulo')], [], ['Período', fechaTexto(d.desde) + ' a ' + fechaTexto(d.hasta)], []];
  const r = () => filas.length + 1;   // número de la próxima fila
  const ref = (c, v, s) => Object.assign({ v, s }, nV ? { f: 'Ventas!' + c + (nV + 2) } : {});
  const fVenta = r(); filas.push([B('Venta neta'), ref('J', TC.venta, 'b-pesos')]);
  const fCosto = r(); filas.push([B('Ingredientes'), ref('M', TC.costo, 'b-pesos')]);
  const fMargen = r(); filas.push([B('Margen de los panes'), { f: 'B' + fVenta + '-B' + fCosto, v: TC.margen, s: 'b-pesos' }]);
  filas.push(['Margen % (de la venta)', { f: 'IF(B' + fVenta + '=0,0,B' + fMargen + '/B' + fVenta + ')', v: TC.venta ? Math.round(TC.margen / TC.venta * 10000) / 10000 : 0, s: 'pct' }], []);
  let fGastos = 0;
  if (co.mes) {
    filas.push([B('Gastos de ' + V.mesTexto(co.mes))]);
    const g0 = r();
    G.items.forEach(g => filas.push([g.nombre, C(g.monto, 'pesos')]));
    if (!G.items.length) filas.push(['(sin gastos anotados)', C(0, 'pesos')]);
    const g1 = r() - 1; fGastos = r();
    filas.push([B('Total de gastos'), { f: 'SUM(B' + g0 + ':B' + g1 + ')', v: G.total, s: 'b-pesos' }], []);
    const fRes = r();
    filas.push([B('Resultado del mes'), { f: 'B' + fMargen + '-B' + fGastos, v: TC.margen - G.total, s: 'b-pesos' }]);
    filas.push(['Resultado % (de la venta)', { f: 'IF(B' + fVenta + '=0,0,B' + fRes + '/B' + fVenta + ')', v: TC.venta ? Math.round((TC.margen - G.total) / TC.venta * 10000) / 10000 : 0, s: 'pct' }], []);
  } else filas.push(['Gastos del mes', null, 'Se incluyen al descargar un mes completo (Más → Costos y margen → El mes).'], []);
  if (sinCosto.length) filas.push([B('Sin costo (no descuentan ingredientes)')], ...sinCosto.map(f => [f.nombre, f.fechas.length + (f.fechas.length === 1 ? ' día' : ' días'), f.fechas.map(fechaTexto).join(', ')]), []);
  filas.push(['Cómo se calcula', null, 'Ingredientes de cada fila de «Ventas» = cantidad × costo de la receta ese día (receta y precios de insumos vigentes ese día).'],
    [null, null, 'Margen = venta neta − ingredientes; el % es sobre la venta. Resultado = margen − gastos del mes (los gastos no se reparten entre los panes).'],
    [null, null, 'Todo neto, sin IVA.']);
  return { nombre: 'Resultado', columnas: [30, 16, 60], filas };
}
export const bytes = (lib, fecha) => X.crear(lib.hojas, fecha);
