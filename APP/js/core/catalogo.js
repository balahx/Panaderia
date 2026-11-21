/* Catálogo (PLAN §3.1 a §3.3): productos, precios con vigencia, trabajadores, cliente e IVA. Lógica pura, sin pantalla ni Firebase:
   se prueba con Node (tests/catalogo-unit.js). Lo mismo que aquí se valida lo exigen las reglas (firestore.rules).
   Producto:  { nombre, unidad: 'kg' | 'un', pesoRef (gramos por unidad, solo 'un', opcional), categoria, orden, activo }
   Precio:    { productoId, clienteId, neto (por kg o por unidad, sin IVA), desde: 'AAAA-MM-DD' } · id = producto_cliente_desde
   Un precio rige desde su fecha hasta que empieza el siguiente: por eso un precio nuevo no cambia los días anteriores. */
export const UNIDADES = { kg: { t: 'Por kilo', c: 'kg' }, un: { t: 'Por unidad', c: 'unidad' } };
export const limpiar = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 60);
const igual = (a, b) => limpiar(a).toLocaleLowerCase('es') === limpiar(b).toLocaleLowerCase('es');
const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es');

/* Identificador nuevo (20 letras y números al azar), como los de Firestore. */
export function nuevoId() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return Array.from(b, x => A[x % A.length]).join('');
}

/* ---------- Números escritos a la chilena ---------- */
/* '1.450' → 1450 · '1.512,61' → 1512.61 · '0,5' → 0.5 · '1450.5' → 1450.5. Devuelve NaN si no es un número. */
export function numero(s) {
  let t = String(s == null ? '' : s).replace(/[\s$]/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return NaN;
  if (t.includes(',')) { if (!/^\d{1,3}(\.\d{3})*,\d+$|^\d+,\d+$/.test(t)) return NaN; t = t.replace(/\./g, '').replace(',', '.'); }
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');     // el punto separa miles
  else if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}
const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/* Precio en pesos: sin decimales si es entero ('$1.450'), con dos si no ('$1.512,61'). */
export function pesos(n) {
  const c = Math.round(Math.abs(n) * 100), ent = Math.floor(c / 100), dec = c % 100;
  return (n < 0 && c ? '-' : '') + '$' + miles(ent) + (dec ? ',' + String(dec).padStart(2, '0') : '');
}
/* Para volver a mostrar un número en un campo: 1512.61 → '1512,61' */
export const enCampo = n => (n == null || Number.isNaN(n) ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/* ---------- IVA y montos ---------- */
export const IVA_DEFECTO = 19;
export const ivaDe = negocio => (negocio && typeof negocio.iva === 'number' ? negocio.iva : IVA_DEFECTO);
export const conIva = (neto, iva) => neto * (1 + iva / 100);
/* Pesos enteros, redondeando la mitad hacia arriba. Antes se corrige el error de los decimales del computador:
   105 × 2,30 da 241,4999… y debe ser 242. Los precios y los kilos llevan hasta 2 decimales: el producto exacto, hasta 4. */
export const redondearPesos = x => Math.round(Math.round(x * 1e4) / 1e4);
/* Monto de una venta: neto, IVA y total en pesos enteros. */
export function montos(neto, cantidad, iva) {
  const n = redondearPesos(neto * cantidad), i = redondearPesos(n * iva / 100);
  return { neto: n, iva: i, total: n + i };
}
export function validarIva(texto) {
  const v = numero(texto);
  if (Number.isNaN(v) || v < 0 || v > 100) return { error: 'Escribe un porcentaje entre 0 y 100.' };
  return { iva: Math.round(v * 100) / 100 };
}

/* ---------- Productos ---------- */
export const ordenarProductos = l => l.slice().sort((a, b) => ((a.orden == null ? 1e9 : a.orden) - (b.orden == null ? 1e9 : b.orden)) || porNombre(a, b));
export const activos = l => (l || []).filter(x => x.activo !== false);
/* Revisa el formulario de un producto. `otros`: los demás productos (para no repetir nombres). Devuelve { error } o { datos }. */
export function validarProducto(f, otros) {
  const nombre = limpiar(f.nombre), categoria = limpiar(f.categoria, 40);
  if (!nombre) return { error: 'Escribe el nombre del pan.', campo: 'nombre' };
  if ((otros || []).some(p => igual(p.nombre, nombre))) return { error: 'Ya hay un producto con ese nombre.', campo: 'nombre' };
  if (!UNIDADES[f.unidad]) return { error: 'Elige si se vende por kilo o por unidad.', campo: 'unidad' };
  const datos = { nombre, unidad: f.unidad, activo: f.activo !== false };
  if (categoria) datos.categoria = categoria;
  if (typeof f.orden === 'number') datos.orden = f.orden;
  const peso = String(f.pesoRef == null ? '' : f.pesoRef).trim();
  if (f.unidad === 'un' && peso) {
    const g = numero(peso);
    if (Number.isNaN(g) || g <= 0 || g > 100000) return { error: 'El peso de referencia va en gramos (por ejemplo 100).', campo: 'pesoRef' };
    datos.pesoRef = Math.round(g * 10) / 10;
  }
  return { datos };
}
/* Documento para guardar a partir de uno ya leído (sin id ni campos de más). */
export function soloProducto(p) {
  const d = { nombre: p.nombre, unidad: p.unidad, activo: p.activo !== false };
  if (p.categoria) d.categoria = p.categoria;
  if (typeof p.orden === 'number') d.orden = p.orden;
  if (p.unidad === 'un' && typeof p.pesoRef === 'number') d.pesoRef = p.pesoRef;
  return d;
}
/* Mover un producto un lugar hacia arriba (-1) o abajo (+1) entre los activos. Devuelve los productos cuyo `orden` cambia
   (con el orden nuevo), o [] si no se puede mover. La lista queda numerada 1, 2, 3… */
export function mover(productos, id, dir) {
  const l = ordenarProductos(activos(productos)), i = l.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return [];
  [l[i], l[j]] = [l[j], l[i]];
  return l.map((p, k) => (p.orden === k + 1 ? null : Object.assign({}, p, { orden: k + 1 }))).filter(Boolean);
}
export const siguienteOrden = productos => activos(productos).reduce((m, p) => Math.max(m, typeof p.orden === 'number' ? p.orden : 0), 0) + 1;
export function detalleProducto(p) {
  return (p.unidad === 'un' ? 'Por unidad' + (p.pesoRef ? ' · ' + enCampo(p.pesoRef) + ' g c/u' : '') : 'Por kilo') + (p.categoria ? ' · ' + p.categoria : '');
}

/* ---------- Precios con vigencia ---------- */
export const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const idPrecio = (productoId, clienteId, desde) => productoId + '_' + clienteId + '_' + desde;
/* Historial de un producto para un cliente, del más nuevo al más antiguo. */
export const historial = (precios, productoId, clienteId) => (precios || []).filter(p => p.productoId === productoId && p.clienteId === clienteId)
  .sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0));
/* Precio que rige un día: el de fecha «desde» más reciente que no pase de ese día. null si ese día aún no había precio. */
export function precioVigente(precios, productoId, clienteId, fecha) {
  return historial(precios, productoId, clienteId).find(p => p.desde <= fecha) || null;
}
/* Próximo precio ya anotado para más adelante (o null). */
export function precioFuturo(precios, productoId, clienteId, fecha) {
  const f = historial(precios, productoId, clienteId).filter(p => p.desde > fecha);
  return f.length ? f[f.length - 1] : null;
}
export function validarPrecio(f) {
  const neto = numero(f.neto);
  if (Number.isNaN(neto) || neto <= 0 || neto > 100000000) return { error: 'Escribe el precio neto en pesos (por ejemplo 1.450).', campo: 'neto' };
  if (!esFecha(f.desde)) return { error: 'Elige desde qué fecha rige.', campo: 'desde' };
  return { datos: { neto: Math.round(neto * 100) / 100, desde: f.desde } };
}

/* ---------- Trabajadores y clientes ---------- */
export const ordenarPersonas = l => l.slice().sort(porNombre);
export function validarNombre(nombre, otros, que) {
  const n = limpiar(nombre);
  if (!n) return { error: 'Escribe el nombre.' };
  if ((otros || []).some(x => igual(x.nombre, n))) return { error: 'Ya hay ' + (que || 'alguien') + ' con ese nombre.' };
  return { nombre: n };
}
/* ---------- Clientes (Fase 11) ----------
   clientes/{id} = { nombre, activo, tipo?: 'regular' | 'suelta', en }  (sin `tipo` = regular). Nada se borra: se desactivan.
   · Cliente ORIGINAL = el regular más antiguo, esté activo o no (el supermercado). Lo pesado sin `clienteId` (antes de la versión 0.11.0)
     es suyo, aunque después se desactive: así lo antiguo nunca cambia de dueño. Su entrega en curso sigue en dias/{fecha}.
   · «Ventas sueltas» = un cliente fijo (tipo 'suelta', a lo más uno) para las ventas esporádicas: cada canasto es una venta, con la nota
     de quién compró; no tiene entregas.
   · Cada cliente tiene su propia lista de precios (precios/{producto_cliente_desde}). */
export const CLIENTE_INICIAL = 'Supermercado';
export const NOMBRE_SUELTAS = 'Ventas sueltas';
export const esSuelta = c => !!c && c.tipo === 'suelta';
const porAntiguedad = (a, b) => (a.en || 0) - (b.en || 0) || String(a.id).localeCompare(String(b.id));
/* El regular más antiguo, activo o no. null si no hay clientes. */
export function clienteOriginal(clientes) {
  const l = (clientes || []).filter(c => !esSuelta(c)).sort(porAntiguedad);
  return l[0] || null;
}
/* Cliente que se propone por omisión (precios, «Anotar canasto», la tablet): el original si está activo; si no, el regular activo más antiguo. */
export function clientePrincipal(clientes) {
  const o = clienteOriginal(clientes);
  if (o && o.activo !== false) return o;
  return activos(clientes).filter(c => !esSuelta(c)).sort(porAntiguedad)[0] || null;
}
/* Orden de las listas: el original primero, después los regulares por antigüedad y al final «Ventas sueltas». */
export function ordenarClientes(clientes) {
  const o = clienteOriginal(clientes);
  return (clientes || []).slice().sort((a, b) => (esSuelta(a) - esSuelta(b)) || ((o && b.id === o.id) - (o && a.id === o.id)) || porAntiguedad(a, b));
}
export const clientesActivos = clientes => ordenarClientes(activos(clientes));
export const clienteSuelto = clientes => (clientes || []).find(esSuelta) || null;
/* ¿Hay que elegir cliente? Solo si hay más de un cliente activo (contando «Ventas sueltas»). Con uno solo, todo queda como antes. */
export const variosClientes = clientes => clientesActivos(clientes).length > 1;
/* Cliente de un canasto: el suyo o, si no lo trae (anotado antes de la Fase 11), el original. */
export const clienteDe = (p, originalId) => (p && p.clienteId) || originalId || null;
export const nombreCliente = (clientes, id) => { const x = (clientes || []).find(c => c.id === id); return x ? x.nombre : id ? '(cliente sin nombre)' : '(sin cliente)'; };
/* Documento de un cliente para guardar (sin id ni campos de más). */
export function soloCliente(c) {
  const d = { nombre: c.nombre, activo: c.activo !== false };
  if (c.tipo === 'suelta' || c.tipo === 'regular') d.tipo = c.tipo;
  return d;
}
/* Precios para un cliente nuevo copiados de otro: los vigentes de `deId` el día `fecha`, que rigen para `aId` desde `desde`.
   Devuelve [{ id, datos: { productoId, clienteId, neto, desde } }] (solo productos activos; uno por pan). */
export function copiarPrecios(precios, productos, deId, aId, fecha, desde) {
  const out = [];
  for (const p of activos(productos)) {
    const v = precioVigente(precios, p.id, deId, fecha);
    if (v) out.push({ id: idPrecio(p.id, aId, desde), datos: { productoId: p.id, clienteId: aId, neto: v.neto, desde } });
  }
  return out;
}
