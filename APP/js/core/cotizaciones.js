/* Cotizaciones (Fase 12) a posibles clientes. Lógica pura: se prueba con Node (tests/cobros-unit.js).
   cotizaciones/{0001} = { numero, para: { nombre, contacto, razonSocial, rut, direccion }, baseClienteId, cantidadesPor: 'semana' | 'mes',
     lineas: [{ productoId, nombre, unidad, neto, conIva, cantidad (o null), monto (o null) }], descuento, neto, netoFinal, ivaMonto, total (null sin
     cantidades), ajuste, iva, fecha, validaHasta, estado: 'enviada' | 'aceptada' | 'rechazada', clienteId, cambio, emisor, por, quien, en }
   Los precios parten de la lista de un cliente (por omisión el principal) y se ajustan pan por pan. Si hay cantidades estimadas, sale un
   total estimado con el mismo cálculo y redondeo que el cobro. Queda fija al emitirla; «Copiar como nueva» sirve para cambiarla.
   «Crear cliente con estos precios»: el cliente regular, sus datos de cobro y su lista de precios con los netos de la cotización. */
import { numero, limpiar, precioVigente, activos, ordenarProductos, idPrecio, esFecha, redondearPesos } from './catalogo.js';
import { totalesDe, lineaConIva, numeroTexto, slug, PLAZO } from './cobros.js';
import { sumarDias } from './pesaje.js';
import * as RUT from './rut.js';

export const VALIDEZ = 15, MAX_LINEAS = 60;
export const ESTADOS = { enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada' };
const r2 = n => Math.round(n * 100) / 100;

/* Precios de partida: los vigentes hoy del cliente base para cada pan activo ({ productoId, nombre, unidad, neto o null }). */
export const preciosBase = (productos, precios, clienteId, fecha) => ordenarProductos(activos(productos)).map(p => {
  const v = clienteId ? precioVigente(precios, p.id, clienteId, fecha) : null;
  return { productoId: p.id, nombre: p.nombre, unidad: p.unidad, neto: v ? v.neto : null };
});
/* Revisa el posible cliente: el nombre es obligatorio (será el nombre del cliente si acepta). */
export function validarPara(f) {
  const nombre = limpiar(f.nombre, 60);
  if (!nombre) return { error: 'Escribe a quién va la cotización.', campo: 'nombre' };
  const r = RUT.validar(f.rut, false); if (r.error) return { error: r.error, campo: 'rut' };
  return { para: { nombre, contacto: limpiar(f.contacto, 100), razonSocial: limpiar(f.razonSocial, 100), rut: r.rut, direccion: limpiar(f.direccion, 150) } };
}
/* Panes elegidos: [{ productoId, neto (texto o número), cantidad (texto, opcional) }] → líneas con precio con IVA (y monto si hay cantidad). */
export function lineasDe(elegidos, productos, iva) {
  const out = [];
  for (const e of elegidos || []) {
    const p = (productos || []).find(x => x.id === e.productoId); if (!p) continue;
    const neto = typeof e.neto === 'number' ? e.neto : numero(e.neto);
    if (Number.isNaN(neto) || neto <= 0 || neto > 1e8) return { error: 'Escribe el precio neto de ' + p.nombre + '.', productoId: p.id };
    const t = String(e.cantidad == null ? '' : e.cantidad).trim(), c = t ? numero(t) : null;
    if (t && (Number.isNaN(c) || c <= 0 || c > 1e6 || (p.unidad === 'un' && Math.round(c) !== c))) return { error: 'La cantidad estimada de ' + p.nombre + ' no se entiende' + (p.unidad === 'un' ? ' (en unidades enteras).' : '.'), productoId: p.id };
    const cantidad = c == null ? null : p.unidad === 'un' ? c : r2(c), precio = r2(neto);
    out.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, precio, cantidad, conIva: r2(precio * (1 + iva / 100)) });
  }
  if (!out.length) return { error: 'Elige al menos un pan.' };
  if (out.length > MAX_LINEAS) return { error: 'Son demasiados panes para una cotización.' };
  return { lineas: out };
}
/* Totales estimados (solo con las líneas que tienen cantidad): igual que el cobro. Sin cantidades, total = null. */
export function totales(lineas, descuento, iva) {
  const con = lineas.filter(l => l.cantidad != null).map(l => lineaConIva(Object.assign({}, l, { neto: redondearPesos(l.precio * l.cantidad) }), iva));
  if (!con.length) return { neto: null, subtotal: null, descuento: descuento ? Object.assign({}, descuento, { neto: null, conIva: null }) : null, netoFinal: null, ivaMonto: null, total: null, ajuste: 0, montos: new Map() };
  const T = totalesDe(con, descuento, iva);
  return Object.assign(T, { montos: new Map(con.map(l => [l.productoId, { neto: l.neto, monto: l.monto }])) });
}
export const validaHasta = (fecha, dias) => sumarDias(fecha, dias == null ? VALIDEZ : dias);
export function validarValidez(s) { const d = Number(String(s == null ? '' : s).trim()); return Number.isInteger(d) && d >= 1 && d <= 120 ? { dias: d } : { error: 'La validez va en días, de 1 a 120.' }; }
/* El documento para guardar (sin `en`). */
export function documento(o) {
  const T = o.totales;
  return { numero: o.numero, para: o.para, baseClienteId: o.baseClienteId || null, cantidadesPor: o.cantidadesPor === 'mes' ? 'mes' : 'semana',
    lineas: o.lineas.map(l => { const m = T.montos.get(l.productoId); return { productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, neto: l.precio, conIva: l.conIva, cantidad: l.cantidad, monto: m ? m.monto : null }; }),
    descuento: T.descuento, neto: T.neto, netoFinal: T.netoFinal, iva: o.iva, ivaMonto: T.ivaMonto, total: T.total, ajuste: T.ajuste || 0,
    fecha: o.fecha, validaHasta: validaHasta(o.fecha, o.dias), estado: 'enviada', clienteId: null, cambio: null, emisor: o.emisor, por: o.por, quien: limpiar(o.quien, 60) || 'Sin nombre' };
}
export const vencida = (c, hoy) => c.estado === 'enviada' && c.validaHasta < hoy;
export const etiqueta = (c, hoy) => (vencida(c, hoy) ? 'Vencida' : ESTADOS[c.estado] || c.estado);
/* «Copiar como nueva»: lo que se vuelve a poner en el formulario. */
export const copiar = c => ({ para: Object.assign({}, c.para), baseClienteId: c.baseClienteId, cantidadesPor: c.cantidadesPor, descuento: c.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, texto: c.descuento.texto } : null,
  elegidos: c.lineas.map(l => ({ productoId: l.productoId, neto: l.neto, cantidad: l.cantidad })) });
/* «Crear cliente con estos precios»: las escrituras del lote (cliente, datos de cobro, precios) con el id nuevo `id`, desde `desde`. */
export function clienteDesde(c, id, desde, uid, periodo) {
  if (!esFecha(desde)) return { error: 'Elige desde qué fecha rigen los precios.' };
  const datos = { razonSocial: c.para.razonSocial || '', rut: c.para.rut || '', direccion: c.para.direccion || '', contacto: c.para.contacto || '', periodo: periodo || (c.cantidadesPor === 'mes' ? 'mes' : 'semana'), plazo: PLAZO, descuento: c.descuento ? { tipo: c.descuento.tipo, valor: c.descuento.valor, texto: c.descuento.texto } : null, por: uid };
  return { escrituras: [{ ruta: 'clientes/' + id, datos: { nombre: c.para.nombre, activo: true, tipo: 'regular' } }, { ruta: 'clientesCobro/' + id, datos }]
    .concat(c.lineas.map(l => ({ ruta: 'precios/' + idPrecio(l.productoId, id, desde), datos: { productoId: l.productoId, clienteId: id, neto: l.neto, desde } }))) };
}
export const nombreArchivo = c => 'cotizacion-' + numeroTexto(c.numero) + '-' + slug(c.para && c.para.nombre) + '.pdf';
