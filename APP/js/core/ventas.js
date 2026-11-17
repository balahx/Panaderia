/* Ventas (PLAN §3.5, §3.6 y §3.10). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/ventas-unit.js).
   Venta = lo pesado no anulado (kilos o unidades), confirmado por Felipe en la Fase 5: los dueños no ajustan nada aparte.
   Una LÍNEA de venta = un pan en una entrega de un día: cantidad (suma de sus canastos) × precio vigente ESE día.
     neto = precio × cantidad, en pesos · IVA = neto × IVA % , en pesos · total = neto + IVA   (catalogo.montos)
   TODOS los totales (entrega, día, pan, mes, cada hoja del Excel) son sumas de líneas: por eso el Excel de un mes cuadra
   con la suma de sus entregas (PLAN, Fase 5, «Listo cuando»), y «Hoy» muestra lo mismo que el Excel para ese día.
   Una línea sin precio vigente ese día se registra igual (cantidad), sin montos: no suma pesos y se avisa (faltanPrecios). */
import { precioVigente, montos } from './catalogo.js';
import { vigentes } from './pesaje.js';

const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
const kg2 = n => Math.round(n * 100) / 100;

/* Líneas de venta de un conjunto de pesajes (de un día o de un período), ordenadas por fecha, entrega y orden del catálogo. */
export function lineas(pesajes, productos, precios, clienteId, iva) {
  const orden = new Map((productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9])), m = new Map();
  for (const p of vigentes(pesajes)) {
    const n = p.entregaN || 1, k = p.fecha + '|' + n + '|' + p.productoId;
    if (!m.has(k)) m.set(k, { fecha: p.fecha, entregaN: n, productoId: p.productoId, nombre: nombreDe(productos, p.productoId), unidad: p.unidad, cantidad: 0, canastos: 0, desde: p.hora || '', hasta: p.hora || '' });
    const l = m.get(k);
    l.canastos++; l.cantidad = l.unidad === 'un' ? l.cantidad + p.cantidad : kg2(l.cantidad + p.cantidad);
    if (p.hora && (!l.desde || p.hora < l.desde)) l.desde = p.hora;
    if (p.hora && p.hora > l.hasta) l.hasta = p.hora;
  }
  const o = id => (orden.has(id) ? orden.get(id) : 1e9);
  return [...m.values()].map(l => {
    const pr = clienteId ? precioVigente(precios, l.productoId, clienteId, l.fecha) : null;
    if (!pr) return Object.assign(l, { precio: null, neto: null, iva: null, total: null });
    return Object.assign(l, { precio: pr.neto }, montos(pr.neto, l.cantidad, iva));
  }).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || a.entregaN - b.entregaN || o(a.productoId) - o(b.productoId) || a.nombre.localeCompare(b.nombre, 'es'));
}

/* Suma de líneas: canastos, kilos, unidades y pesos (solo las que tienen precio). */
export function totales(ls) {
  const t = { lineas: 0, canastos: 0, kg: 0, un: 0, neto: 0, iva: 0, total: 0, sinPrecio: 0, desde: '', hasta: '' };
  for (const l of ls || []) {
    t.lineas++; t.canastos += l.canastos;
    if (l.unidad === 'un') t.un += l.cantidad; else t.kg = kg2(t.kg + l.cantidad);
    if (l.neto == null) t.sinPrecio++; else { t.neto += l.neto; t.iva += l.iva; t.total += l.total; }
    if (l.desde && (!t.desde || l.desde < t.desde)) t.desde = l.desde;
    if (l.hasta && l.hasta > t.hasta) t.hasta = l.hasta;
  }
  return t;
}
function agrupar(ls, clave, base) {
  const m = new Map();
  for (const l of ls || []) { const k = clave(l); if (!m.has(k)) m.set(k, { base: base(l), ls: [] }); m.get(k).ls.push(l); }
  return [...m.values()].map(g => Object.assign(g.base, totales(g.ls), { items: g.ls }));
}
/* Una fila por entrega de cada día (fecha, n). */
export const porEntrega = ls => agrupar(ls, l => l.fecha + '|' + l.entregaN, l => ({ fecha: l.fecha, n: l.entregaN }));
/* Una fila por día, con cuántas entregas tuvo. */
export const porDia = ls => agrupar(ls, l => l.fecha, l => ({ fecha: l.fecha })).map(d => Object.assign(d, { entregas: new Set(d.items.map(l => l.entregaN)).size }));
/* Una fila por pan (en el orden en que aparecen las líneas, o sea, el del catálogo dentro de cada entrega). */
export function porPan(ls, productos) {
  const orden = new Map((productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9]));
  return agrupar(ls, l => l.productoId, l => ({ productoId: l.productoId, nombre: l.nombre, unidad: l.unidad }))
    .map(p => Object.assign(p, { cantidad: p.unidad === 'un' ? p.un : p.kg }))
    .sort((a, b) => ((orden.get(a.productoId) || 1e9) - (orden.get(b.productoId) || 1e9)) || a.nombre.localeCompare(b.nombre, 'es'));
}
/* Panes vendidos sin precio vigente, con los días en que pasó: [{ productoId, nombre, fechas: ['AAAA-MM-DD', …] }]. */
export function faltanPrecios(ls) {
  const m = new Map();
  for (const l of ls || []) if (l.neto == null) {
    if (!m.has(l.productoId)) m.set(l.productoId, { productoId: l.productoId, nombre: l.nombre, fechas: [] });
    const f = m.get(l.productoId).fechas; if (!f.includes(l.fecha)) f.push(l.fecha);
  }
  return [...m.values()].map(x => Object.assign(x, { fechas: x.fechas.sort() }));
}
/* Junta dos listas de faltanPrecios (por ejemplo, la del día que se mira y la del mes). */
export function juntarFaltan(a, b) {
  const m = new Map();
  for (const x of (a || []).concat(b || [])) {
    if (!m.has(x.productoId)) m.set(x.productoId, { productoId: x.productoId, nombre: x.nombre, fechas: [] });
    const f = m.get(x.productoId).fechas; x.fechas.forEach(d => { if (!f.includes(d)) f.push(d); });
  }
  return [...m.values()].map(x => Object.assign(x, { fechas: x.fechas.sort() }));
}

/* ---------- Meses y períodos ---------- */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const esMes = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
export const mesDe = fecha => String(fecha || '').slice(0, 7);
/* '2026-11' → { desde: '2026-11-01', hasta: '2026-11-30' } */
export function rangoMes(mes) {
  const [a, m] = mes.split('-').map(Number), ult = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: mes + '-01', hasta: mes + '-' + String(ult).padStart(2, '0') };
}
export function sumarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number), d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}
export const mesTexto = mes => { const [a, m] = mes.split('-').map(Number); return MESES[m - 1] + ' ' + a; };
export const diaSemana = fecha => DIAS[new Date(fecha + 'T12:00:00Z').getUTCDay()];
/* Días entre dos fechas, contando ambas: '2026-11-01'…'2026-11-30' → 30 */
export const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000) + 1;
export const MAX_DIAS = 366;
/* Revisa un período elegido a mano. Devuelve { error } o { desde, hasta } (nunca más allá de hoy). */
export function validarPeriodo(desde, hasta, hoy) {
  const f = /^\d{4}-\d{2}-\d{2}$/;
  if (!f.test(desde || '') || !f.test(hasta || '') || Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) return { error: 'Elige las dos fechas.' };
  if (desde > hasta) return { error: 'La fecha «desde» va antes que «hasta».' };
  if (desde > hoy) return { error: 'Ese período todavía no empieza.' };
  const h = hasta > hoy ? hoy : hasta;
  if (diasEntre(desde, h) > MAX_DIAS) return { error: 'Elige como máximo un año (' + MAX_DIAS + ' días).' };
  return { desde, hasta: h };
}

/* ---------- Registro general ---------- */
/* Filtra pesajes: { productoId, trabajadorId, entregaN, estado: 'vigentes' | 'anulados' | 'todos' } ('' = todos). */
export function filtrar(pesajes, f) {
  f = f || {};
  return (pesajes || []).filter(p => (!f.productoId || p.productoId === f.productoId) && (!f.trabajadorId || p.trabajadorId === f.trabajadorId)
    && (!f.entregaN || (p.entregaN || 1) === Number(f.entregaN))
    && (f.estado === 'todos' || (f.estado === 'anulados' ? p.anulado === true : p.anulado !== true)));
}
/* Del más nuevo al más antiguo: por fecha, hora y hora del servidor. */
export const ordenRegistro = l => (l || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0) || String(b.hora || '').localeCompare(String(a.hora || '')) || (b.en || 0) - (a.en || 0));
