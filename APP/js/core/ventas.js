/* Ventas (PLAN §3.5, §3.6 y §3.10). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/ventas-unit.js).
   Venta = lo pesado no anulado (kilos o unidades), confirmado por Felipe en la Fase 5: los dueños no ajustan nada aparte.
   Una LÍNEA de venta = un pan en una entrega de un día: cantidad (suma de sus canastos) × precio vigente ESE día.
     neto = precio × cantidad, en pesos · IVA = neto × IVA % , en pesos · total = neto + IVA   (catalogo.montos)
   Todo NETO de un grupo (entrega, día, pan, mes, cada hoja del Excel) es la suma de los netos de sus líneas: por eso el Excel
   de un mes cuadra con la suma de sus entregas (PLAN, Fase 5, «Listo cuando»), y «Hoy» muestra lo mismo que el Excel para ese día.
   El IVA de un grupo es el IVA % de SU neto, redondeado una vez (decisión de Felipe en la Fase 6: «el IVA se calcula sobre el neto
   del mes, o sobre el neto que se lleve»); el total es neto + IVA. El IVA de cada línea queda solo como referencia de esa fila.
   Una línea sin precio vigente ese día se registra igual (cantidad), sin montos: no suma pesos y se avisa (faltanPrecios).
   Fase 11 (varios clientes): una línea = un pan en una entrega de UN CLIENTE en un día, con el precio vigente ese día PARA ESE CLIENTE.
   Lo pesado sin `clienteId` es del cliente original (catalogo.clienteOriginal). «Ventas sueltas» no tiene entregas: cada canasto es
   una línea (con su hora y la nota de quién compró). El total del negocio sigue siendo la suma de las líneas = la suma por cliente. */
import { precioVigente, montos, redondearPesos, clienteOriginal, ordenarClientes, esSuelta } from './catalogo.js';
import { vigentes } from './pesaje.js';

const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
const kg2 = n => Math.round(n * 100) / 100;
/* IVA de un neto (de un grupo de líneas o de un mes): IVA % × neto, en pesos enteros. */
export const ivaSobre = (neto, iva) => redondearPesos(neto * (typeof iva === 'number' ? iva : 0) / 100);

/* Clientes para las líneas: la lista de clientes (Fase 11), o solo el id del cliente original (como antes de la Fase 11), o nada (sin montos). */
function quienes(clientes) {
  if (Array.isArray(clientes)) {
    const o = clienteOriginal(clientes), orden = new Map(ordenarClientes(clientes).map((c, i) => [c.id, i]));
    return { original: o ? o.id : null, de: id => clientes.find(c => c.id === id) || null, orden: id => (orden.has(id) ? orden.get(id) : 1e6) };
  }
  return { original: clientes || null, sin: !clientes, de: () => null, orden: () => 0 };
}
/* Líneas de venta de un conjunto de pesajes (de un día o de un período), ordenadas por fecha, cliente, entrega y orden del catálogo.
   `clientes`: la lista de clientes (o el id del cliente original, o null). */
export function lineas(pesajes, productos, precios, clientes, iva) {
  const orden = new Map((productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9])), m = new Map(), Q = quienes(clientes);
  for (const p of vigentes(pesajes)) {
    const cid = p.clienteId || Q.original, cl = Q.de(cid), suelta = esSuelta(cl), n = suelta ? 0 : p.entregaN || 1;
    const k = p.fecha + '|' + cid + '|' + (suelta ? 's|' + p.id : n + '|' + p.productoId);
    if (!m.has(k)) m.set(k, Object.assign({ fecha: p.fecha, clienteId: cid, cliente: cl ? cl.nombre : '', suelta, entregaN: n, productoId: p.productoId, nombre: nombreDe(productos, p.productoId), unidad: p.unidad, cantidad: 0, canastos: 0, desde: p.hora || '', hasta: p.hora || '' },
      suelta ? { pesajeId: p.id, hora: p.hora || '', comprador: p.nota || '' } : {}));
    const l = m.get(k);
    l.canastos++; l.cantidad = l.unidad === 'un' ? l.cantidad + p.cantidad : kg2(l.cantidad + p.cantidad);
    if (p.hora && (!l.desde || p.hora < l.desde)) l.desde = p.hora;
    if (p.hora && p.hora > l.hasta) l.hasta = p.hora;
  }
  const o = id => (orden.has(id) ? orden.get(id) : 1e9);
  return [...m.values()].map(l => {
    const pr = l.clienteId && !Q.sin ? precioVigente(precios, l.productoId, l.clienteId, l.fecha) : null;
    if (!pr) return Object.assign(l, { pct: iva, precio: null, neto: null, iva: null, total: null });
    return Object.assign(l, { pct: iva, precio: pr.neto }, montos(pr.neto, l.cantidad, iva));
  }).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || Q.orden(a.clienteId) - Q.orden(b.clienteId) || String(a.clienteId).localeCompare(String(b.clienteId))
    || a.entregaN - b.entregaN || String(a.hora || '').localeCompare(String(b.hora || '')) || o(a.productoId) - o(b.productoId) || a.nombre.localeCompare(b.nombre, 'es'));
}
/* Solo las líneas de un cliente ('' o null = todas). */
export const deCliente = (ls, clienteId) => (clienteId ? (ls || []).filter(l => l.clienteId === clienteId) : ls || []);

/* Suma de líneas: canastos, kilos, unidades y neto (solo las que tienen precio); IVA = IVA % de ese neto (ver arriba). */
export function totales(ls) {
  const t = { lineas: 0, canastos: 0, kg: 0, un: 0, neto: 0, iva: 0, total: 0, sinPrecio: 0, desde: '', hasta: '' };
  let pct = null;
  for (const l of ls || []) {
    t.lineas++; t.canastos += l.canastos;
    if (typeof l.pct === 'number') pct = l.pct;
    if (l.unidad === 'un') t.un += l.cantidad; else t.kg = kg2(t.kg + l.cantidad);
    if (l.neto == null) t.sinPrecio++; else { t.neto += l.neto; t.iva += l.iva; }
    if (l.desde && (!t.desde || l.desde < t.desde)) t.desde = l.desde;
    if (l.hasta && l.hasta > t.hasta) t.hasta = l.hasta;
  }
  if (pct != null) t.iva = ivaSobre(t.neto, pct);   // sin `pct` (líneas armadas a mano): la suma del IVA de las líneas
  t.total = t.neto + t.iva;
  return t;
}
function agrupar(ls, clave, base) {
  const m = new Map();
  for (const l of ls || []) { const k = clave(l); if (!m.has(k)) m.set(k, { base: base(l), ls: [] }); m.get(k).ls.push(l); }
  return [...m.values()].map(g => Object.assign(g.base, totales(g.ls), { items: g.ls }));
}
/* Una fila por entrega de cada día y cliente (fecha, cliente, n). Las ventas sueltas de un día van juntas en una fila con n = 0. */
export const porEntrega = ls => agrupar(ls, l => l.fecha + '|' + l.clienteId + '|' + l.entregaN, l => ({ fecha: l.fecha, n: l.entregaN, clienteId: l.clienteId, cliente: l.cliente, suelta: l.suelta }));
/* Entregas de verdad (sin las ventas sueltas). */
export const soloEntregas = es => (es || []).filter(e => !e.suelta);
/* Una fila por día, con cuántas entregas tuvo (de todos los clientes; las ventas sueltas no son entregas) y cuántas ventas sueltas. */
export const porDia = ls => agrupar(ls, l => l.fecha, l => ({ fecha: l.fecha })).map(d => Object.assign(d, {
  entregas: new Set(d.items.filter(l => !l.suelta).map(l => l.clienteId + '|' + l.entregaN)).size, sueltas: d.items.filter(l => l.suelta).length }));
/* Una fila por cliente, en el orden de la lista de clientes: totales y participación en el neto (pct, de 0 a 100). */
export function porCliente(ls, clientes) {
  const Q = quienes(clientes), G = agrupar(ls, l => l.clienteId, l => ({ clienteId: l.clienteId, cliente: l.cliente, suelta: l.suelta }));
  const neto = G.reduce((t, g) => t + g.neto, 0);
  return G.map(g => Object.assign(g, { pct: neto ? g.neto / neto * 100 : 0, entregas: g.suelta ? 0 : new Set(g.items.map(l => l.fecha + '|' + l.entregaN)).size, ventas: g.suelta ? g.items.length : 0 }))
    .sort((a, b) => Q.orden(a.clienteId) - Q.orden(b.clienteId) || String(a.cliente).localeCompare(String(b.cliente), 'es'));
}
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
/* Filtra pesajes: { productoId, trabajadorId, entregaN, clienteId (con `original`: el de lo pesado sin cliente), estado: 'vigentes' | 'anulados' | 'todos' } ('' = todos). */
export function filtrar(pesajes, f) {
  f = f || {};
  return (pesajes || []).filter(p => (!f.productoId || p.productoId === f.productoId) && (!f.trabajadorId || p.trabajadorId === f.trabajadorId)
    && (!f.clienteId || (p.clienteId || f.original) === f.clienteId)
    && (!f.entregaN || (p.entregaN || 1) === Number(f.entregaN))
    && (f.estado === 'todos' || (f.estado === 'anulados' ? p.anulado === true : p.anulado !== true)));
}
/* Del más nuevo al más antiguo: por fecha, hora y hora del servidor. */
export const ordenRegistro = l => (l || []).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0) || String(b.hora || '').localeCompare(String(a.hora || '')) || (b.en || 0) - (a.en || 0));
