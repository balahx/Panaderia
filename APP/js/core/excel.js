/* Excel de ventas (PLAN §3.10): neto, IVA, total y cliente. Arma las hojas con core/ventas.js y las escribe con core/xlsx.js.
   Lógica pura: se prueba con Node (tests/ventas-unit.js). Hojas:
     Resumen   período, cliente, IVA, totales (con fórmula a la hoja Ventas) y los panes sin precio
     Ventas    una fila por pan y entrega de cada día: cantidad, canastos, precio neto, neto, IVA, total  ← el detalle
     Entregas  una fila por entrega · Por día · Por pan   (todas son sumas de las filas de «Ventas»: cuadran entre sí)
     Canastos  cada canasto pesado, también los anulados (marcados), con quién pesó, nota y cuándo se anotó */
import * as V from './ventas.js';
import { fechaTexto, diaChile } from './formato.js';
import * as X from './xlsx.js';

const C = (v, s) => ({ v, s }), B = v => ({ v, s: 'b' });
const unidadTexto = u => (u === 'un' ? 'unidades' : 'kg');
const cab = l => l.map(t => C(t, 'cab'));
/* Fila de totales con SUMA de Excel (y el resultado ya calculado, por si el programa no recalcula). */
const suma = (col, n, v, s) => ({ f: 'SUM(' + col + '2:' + col + (n + 1) + ')', v, s });
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };

export function nombreArchivo(desde, hasta) {
  const r = V.rangoMes(V.mesDe(desde));
  return 'ventas-' + (desde === r.desde && (hasta === r.hasta || V.mesDe(hasta) === V.mesDe(desde)) ? V.mesDe(desde) : desde + '_a_' + hasta) + '.xlsx';
}

/* d = { desde, hasta, pesajes, productos, trabajadores, precios, cliente, iva, quien, ahora (ms) }
   Devuelve { nombre, hojas, lineas, totales, faltan } (hojas para xlsx.crear). */
export function libro(d) {
  const cli = d.cliente || null, ls = V.lineas(d.pesajes, d.productos, d.precios, cli && cli.id, d.iva), T = V.totales(ls), faltan = V.faltanPrecios(ls);
  const ent = V.porEntrega(ls), dias = V.porDia(ls), panes = V.porPan(ls, d.productos), cliente = cli ? cli.nombre : '(sin cliente)';
  const nV = ls.length, nE = ent.length, nD = dias.length, nP = panes.length;
  const ahora = new Date(d.ahora || Date.now());

  const ventas = { nombre: 'Ventas', congelar: 1, filtro: nV + 1, columnas: [11, 5, 8, 16, 26, 10, 11, 9, 12, 13, 12, 13, 22],
    filas: [cab(['Fecha', 'Día', 'Entrega', 'Cliente', 'Pan', 'Unidad', 'Cantidad', 'Canastos', 'Precio neto', 'Neto', 'IVA', 'Total', 'Observación'])]
      .concat(ls.map(l => [C(l.fecha, 'fecha'), V.diaSemana(l.fecha), C(l.entregaN, 'entero'), cliente, l.nombre, unidadTexto(l.unidad), C(l.cantidad, l.unidad === 'un' ? 'entero' : 'kilos'), C(l.canastos, 'entero'),
        l.precio == null ? null : C(l.precio, 'precio'), l.neto == null ? null : C(l.neto, 'pesos'), l.iva == null ? null : C(l.iva, 'pesos'), l.total == null ? null : C(l.total, 'pesos'), l.neto == null ? 'Sin precio ese día: no suma' : '']))
      .concat(nV ? [[B('Total'), null, null, null, null, null, null, suma('H', nV, T.canastos, 'b-entero'), null, suma('J', nV, T.neto, 'b-pesos'), suma('K', nV, T.iva, 'b-pesos'), suma('L', nV, T.total, 'b-pesos')]] : []) };

  const entregas = { nombre: 'Entregas', congelar: 1, filtro: nE + 1, columnas: [11, 5, 8, 12, 9, 11, 11, 13, 12, 13],
    filas: [cab(['Fecha', 'Día', 'Entrega', 'Horario', 'Canastos', 'Kilos', 'Unidades', 'Neto', 'IVA', 'Total'])]
      .concat(ent.map(e => [C(e.fecha, 'fecha'), V.diaSemana(e.fecha), C(e.n, 'entero'), e.desde + (e.hasta && e.hasta !== e.desde ? '–' + e.hasta : ''), C(e.canastos, 'entero'), C(e.kg, 'kilos'), C(e.un, 'entero'), C(e.neto, 'pesos'), C(e.iva, 'pesos'), C(e.total, 'pesos')]))
      .concat(nE ? [[B('Total'), null, null, null, suma('E', nE, T.canastos, 'b-entero'), suma('F', nE, T.kg, 'b-kilos'), suma('G', nE, T.un, 'b-entero'), suma('H', nE, T.neto, 'b-pesos'), suma('I', nE, T.iva, 'b-pesos'), suma('J', nE, T.total, 'b-pesos')]] : []) };

  const porDia = { nombre: 'Por día', congelar: 1, filtro: nD + 1, columnas: [11, 5, 9, 9, 11, 11, 13, 12, 13],
    filas: [cab(['Fecha', 'Día', 'Entregas', 'Canastos', 'Kilos', 'Unidades', 'Neto', 'IVA', 'Total'])]
      .concat(dias.map(x => [C(x.fecha, 'fecha'), V.diaSemana(x.fecha), C(x.entregas, 'entero'), C(x.canastos, 'entero'), C(x.kg, 'kilos'), C(x.un, 'entero'), C(x.neto, 'pesos'), C(x.iva, 'pesos'), C(x.total, 'pesos')]))
      .concat(nD ? [[B('Total'), null, suma('C', nD, nE, 'b-entero'), suma('D', nD, T.canastos, 'b-entero'), suma('E', nD, T.kg, 'b-kilos'), suma('F', nD, T.un, 'b-entero'), suma('G', nD, T.neto, 'b-pesos'), suma('H', nD, T.iva, 'b-pesos'), suma('I', nD, T.total, 'b-pesos')]] : []) };

  const porPan = { nombre: 'Por pan', congelar: 1, filtro: nP + 1, columnas: [26, 10, 11, 9, 13, 12, 13, 14],
    filas: [cab(['Pan', 'Unidad', 'Cantidad', 'Canastos', 'Neto', 'IVA', 'Total', 'Precio promedio'])]
      .concat(panes.map(p => [p.nombre, unidadTexto(p.unidad), C(p.cantidad, p.unidad === 'un' ? 'entero' : 'kilos'), C(p.canastos, 'entero'), C(p.neto, 'pesos'), C(p.iva, 'pesos'), C(p.total, 'pesos'),
        p.sinPrecio || !p.cantidad ? null : C(Math.round(p.neto / p.cantidad * 100) / 100, 'precio')]))
      .concat(nP ? [[B('Total'), null, null, suma('D', nP, T.canastos, 'b-entero'), suma('E', nP, T.neto, 'b-pesos'), suma('F', nP, T.iva, 'b-pesos'), suma('G', nP, T.total, 'b-pesos')]] : []) };

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
      .concat([['Cómo se calcula', null, 'Cada fila de «Ventas» es un pan en una entrega: cantidad × precio neto vigente ese día.'], [null, null, 'El IVA de cada fila es su neto × IVA, en pesos. Todos los totales son sumas de esas filas.'],
        [null, null, 'Venta = lo pesado en la panadería (o anotado en fecha pasada), sin los canastos anulados.']]) };
  if (!nV) resumen.filas.splice(7, 0, ['Sin ventas en el período']);

  return { nombre: nombreArchivo(d.desde, d.hasta), hojas: [resumen, ventas, entregas, porDia, porPan, canastos], lineas: ls, totales: T, faltan, entregas: ent };
}
export const bytes = (lib, fecha) => X.crear(lib.hojas, fecha);
