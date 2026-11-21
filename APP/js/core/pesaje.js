/* Pesaje y entregas del día (PLAN §3.4 y §3.5). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/pesaje-unit.js).
   Lo mismo que aquí se valida lo exigen las reglas (firestore.rules).
   Pesaje (un canasto):  { fecha 'AAAA-MM-DD' (día chileno), hora 'HH:MM', entregaN, productoId, cantidad, unidad 'kg'|'un',
                           trabajadorId, nota?, anulado, creadoPor (UID de la cuenta), en (hora del servidor) }
   Día:                  dias/{fecha} = { entregaN (la entrega en curso), por, en }. Sin el documento, la entrega en curso es la n.º 1.
   Fase 11: el pesaje lleva `clienteId` (sin él = el cliente original). Cada cliente regular tiene su propia numeración de entregas:
   el original sigue en dias/{fecha} y los demás en dias/{fecha}_{clienteId} (rutaDia). «Ventas sueltas» no tiene entregas (entregaN 1).
   Los totales NO se guardan: se calculan aquí con los pesajes (así no hay dos verdades, ni choques entre equipos sin conexión). */
import { numero } from './catalogo.js';
import { kilos } from './formato.js';

export const AVISO_KG = 20;        // sobre esto: aviso, sin bloquear (a veces se supera)
export const CONFIRMA_KG = 50;     // sobre esto casi seguro es un error de tecleo: se pide confirmar
export const CONFIRMA_UN = 2000;
export const MAX_ENTREGAS = 50;

/* ---------- Teclado numérico propio ---------- */
/* Devuelve el texto tras tocar una tecla: '0'…'9', ',' (solo kilos), 'borrar' (la última) o 'limpiar'.
   Kilos: hasta 3 cifras y 2 decimales (999,99). Unidades: hasta 5 cifras, sin decimales. */
export function teclear(txt, k, unidad) {
  txt = String(txt || '');
  if (k === 'limpiar') return '';
  if (k === 'borrar') return txt.slice(0, -1);
  const kg = unidad !== 'un';
  if (k === ',') {
    if (!kg || txt.includes(',')) return txt;
    return (txt || '0') + ',';
  }
  if (!/^[0-9]$/.test(k)) return txt;
  const [ent, dec] = txt.split(',');
  if (dec !== undefined) return dec.length >= 2 ? txt : txt + k;
  if (ent === '0') return k;                              // sin ceros a la izquierda
  if (ent.length >= (kg ? 3 : 5)) return txt;
  return txt + k;
}
/* Texto del teclado a número: '12,35' → 12.35 · '12,' → 12 · '' → NaN */
export const valor = txt => numero(String(txt || '').replace(/,$/, ''));
export const redondear = (n, unidad) => (unidad === 'un' ? Math.round(n) : Math.round(n * 100) / 100);

/* Revisa una cantidad (del teclado o de un campo de corrección). Devuelve { error } o { cantidad, aviso, confirmar }. */
export function validarCantidad(txt, unidad) {
  const v = typeof txt === 'number' ? txt : valor(txt);
  if (Number.isNaN(v) || v <= 0) return { error: unidad === 'un' ? 'Escribe cuántas unidades.' : 'Escribe los kilos del canasto.' };
  if (unidad === 'un' && !Number.isInteger(v)) return { error: 'Las unidades van sin decimales.' };
  const cantidad = redondear(v, unidad);
  if (cantidad <= 0) return { error: 'Escribe los kilos del canasto.' };
  if (unidad === 'un') {
    if (cantidad > 99999) return { error: 'Son demasiadas unidades para un canasto.' };
    return { cantidad, aviso: '', confirmar: cantidad > CONFIRMA_UN };
  }
  if (cantidad > 999.99) return { error: 'Son demasiados kilos para un canasto.' };
  return { cantidad, aviso: cantidad > AVISO_KG ? 'Más de ' + AVISO_KG + ' kg: revisa que esté bien.' : '', confirmar: cantidad > CONFIRMA_KG };
}
export const textoCantidad = (n, unidad) => (unidad === 'un' ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' un' : kilos(n) + ' kg');
/* Lo que muestra la pantalla mientras se teclea: '12,3' → '12,3 kg' · '' → '0 kg' */
export const textoTeclado = (txt, unidad) => (txt || '0') + (unidad === 'un' ? ' un' : ' kg');
export function limpiarNota(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 200); }

/* ---------- Fechas y horas (Chile) ---------- */
/* Hora local chilena 'HH:MM' de un instante. */
export function horaChile(d) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d || new Date());
  const g = t => p.find(x => x.type === t).value;
  return g('hour') + ':' + g('minute');
}
/* '2026-11-16' + n días → 'AAAA-MM-DD' (sin horas: no le afecta el cambio de horario) */
export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------- Documentos ---------- */
/* Pesaje nuevo, listo para guardar (la hora del servidor `en` la agrega nube.js). */
export function nuevoPesaje(o) {
  const d = { fecha: o.fecha, hora: o.hora, entregaN: o.entregaN || 1, productoId: o.productoId, cantidad: o.cantidad, unidad: o.unidad,
    trabajadorId: o.trabajadorId, anulado: false, creadoPor: o.creadoPor };
  if (o.clienteId) d.clienteId = o.clienteId;
  const nota = limpiarNota(o.nota); if (nota) d.nota = nota;
  return d;
}
const CAMPOS = ['fecha', 'hora', 'entregaN', 'clienteId', 'productoId', 'cantidad', 'unidad', 'trabajadorId', 'nota', 'anulado', 'creadoPor'];
/* Documento para guardar a partir de uno ya leído (sin id, sin marcas de la pantalla, sin `en`). */
export function soloPesaje(p) {
  const d = {}; for (const k of CAMPOS) if (p[k] !== undefined && p[k] !== null && !(k === 'nota' && !p[k])) d[k] = p[k];
  d.anulado = p.anulado === true;
  return d;
}
/* Campos que cambian entre dos versiones de un pesaje (para la bitácora). null si no cambia nada. */
export function diferencia(antes, despues) {
  const a = soloPesaje(antes), b = soloPesaje(despues), A = {}, B = {};
  for (const k of CAMPOS) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { if (k in a) A[k] = a[k]; if (k in b) B[k] = b[k]; }
  return Object.keys(A).length || Object.keys(B).length ? { antes: A, despues: B } : null;
}
/* Registro de la bitácora (cambios/{id}) para una corrección, anulación o reactivación. */
/* `quien`: nombre de la cuenta que corrige (se muestra en el registro general; la cuenta de pesaje no puede leer los nombres de los miembros). */
export function constancia(tipo, p, dif, uid, quien) {
  const c = { tipo, pesajeId: p.id, fecha: p.fecha, antes: dif.antes, despues: dif.despues, por: uid };
  const q = String(quien == null ? '' : quien).replace(/\s+/g, ' ').trim().slice(0, 60); if (q) c.quien = q;
  return c;
}

/* ---------- Entregas ---------- */
/* Documento de la entrega en curso de un cliente un día: dias/{fecha} para el original (o si no se sabe), dias/{fecha}_{clienteId} para otro. */
export const rutaDia = (fecha, clienteId, originalId) => 'dias/' + fecha + (clienteId && clienteId !== originalId ? '_' + clienteId : '');
/* Documento de la entrega en curso de un cliente en ctx.dia (app.js): `dia` para el original (o sin cliente), `dias[id]` para otro.
   undefined = aún no llega · null = no existe (la entrega en curso es la n.º 1). */
export const diaDoc = (d, clienteId, originalId) => (!d ? undefined : !clienteId || clienteId === originalId ? d.dia : d.dias ? d.dias[clienteId] : undefined);
/* Los canastos de un cliente (sin `clienteId` = el original). */
export const delCliente = (pesajes, clienteId, originalId) => (pesajes || []).filter(p => (p.clienteId || originalId) === clienteId);
export const entregaEnCurso = dia => (dia && Number.isInteger(dia.entregaN) && dia.entregaN >= 1 ? dia.entregaN : 1);
export const vigentes = l => (l || []).filter(p => p.anulado !== true);
/* Del más nuevo al más antiguo: por la hora anotada y, en el mismo minuto, por la hora del servidor (estimada si aún no se envía). */
export const recientes = l => (l || []).slice().sort((a, b) => String(b.hora || '').localeCompare(String(a.hora || '')) || (b.en || 0) - (a.en || 0) || String(b.id).localeCompare(String(a.id)));

/* ---------- Totales del día ---------- */
const suma = () => ({ canastos: 0, kg: 0, un: 0 });
function sumar(t, p) { t.canastos++; if (p.unidad === 'un') t.un += p.cantidad; else t.kg = Math.round((t.kg + p.cantidad) * 100) / 100; }
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
/* Totales por pan, en el orden del catálogo. `cantidad` = kilos o unidades según el pan. */
export function porPan(pesajes, productos) {
  const orden = new Map((productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9])), panes = new Map();
  for (const p of vigentes(pesajes)) {
    if (!panes.has(p.productoId)) panes.set(p.productoId, Object.assign(suma(), { productoId: p.productoId, nombre: nombreDe(productos, p.productoId), unidad: p.unidad, cantidad: 0 }));
    const x = panes.get(p.productoId); sumar(x, p); x.cantidad = x.unidad === 'un' ? x.un : x.kg;
  }
  const o = id => (orden.has(id) ? orden.get(id) : 1e9);
  return [...panes.values()].sort((a, b) => o(a.productoId) - o(b.productoId) || a.nombre.localeCompare(b.nombre, 'es'));
}
/* Resumen de los pesajes de un día (los anulados no cuentan): totales, por pan, por entrega (con sus canastos) y por trabajador.
   Fase 11: `clientes` (lista, opcional): cada entrega es de un cliente (clienteId; las ventas sueltas van juntas con n = 0) y hay `porCliente`. */
export function resumen(pesajes, productos, trabajadores, clientes) {
  const v = vigentes(pesajes), total = suma(), entregas = new Map(), gente = new Map(), cls = Array.isArray(clientes) ? clientes : [];
  const orig = (cls.filter(c => c.tipo !== 'suelta').sort((a, b) => (a.en || 0) - (b.en || 0) || String(a.id).localeCompare(String(b.id)))[0] || {}).id || null;
  const suelta = id => cls.some(c => c.id === id && c.tipo === 'suelta');
  for (const p of v) {
    sumar(total, p);
    const cid = cls.length ? p.clienteId || orig : null, s = suelta(cid), n = s ? 0 : p.entregaN || 1, k = cid + '|' + n;   // sin la lista de clientes, como antes
    if (!entregas.has(k)) entregas.set(k, Object.assign(suma(), { n, clienteId: cid, suelta: s, items: [], desde: p.hora, hasta: p.hora }));
    const e = entregas.get(k); sumar(e, p); e.items.push(p);
    if (p.hora < e.desde) e.desde = p.hora;
    if (p.hora > e.hasta) e.hasta = p.hora;
    if (!gente.has(p.trabajadorId)) gente.set(p.trabajadorId, Object.assign(suma(), { trabajadorId: p.trabajadorId, nombre: nombreDe(trabajadores, p.trabajadorId) }));
    sumar(gente.get(p.trabajadorId), p);
  }
  const pos = id => { const i = cls.findIndex(c => c.id === id); return id === orig ? -1 : i < 0 ? 1e6 : i + (suelta(id) ? 1e5 : 0); };
  const porEntrega = [...entregas.values()].sort((a, b) => pos(a.clienteId) - pos(b.clienteId) || a.n - b.n);
  porEntrega.forEach(e => { e.cliente = cls.length ? nombreDe(cls, e.clienteId) : ''; e.porPan = porPan(e.items, productos); e.items = recientes(e.items); });
  const porCliente = [];
  for (const e of porEntrega) {
    let x = porCliente.find(y => y.clienteId === e.clienteId);
    if (!x) porCliente.push(x = Object.assign(suma(), { clienteId: e.clienteId, cliente: e.cliente, suelta: e.suelta, entregas: 0 }));
    x.canastos += e.canastos; x.kg = Math.round((x.kg + e.kg) * 100) / 100; x.un += e.un; if (!e.suelta) x.entregas++;
  }
  return Object.assign(total, { porPan: porPan(v, productos), porEntrega, porCliente, porTrabajador: [...gente.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) });
}
/* Lo que lleva la entrega en curso (para el botón «Cerrar entrega»). Con `clienteId`, solo la de ese cliente (Fase 11). */
export function entregaActual(pesajes, dia, clienteId, originalId) {
  const n = entregaEnCurso(dia), t = suma(), mios = clienteId ? delCliente(pesajes, clienteId, originalId) : pesajes;
  vigentes(mios).filter(p => (p.entregaN || 1) === n).forEach(p => sumar(t, p));
  return Object.assign(t, { n });
}
export const textoTotales = t => [t.kg ? kilos(t.kg) + ' kg' : '', t.un ? textoCantidad(t.un, 'un') : ''].filter(Boolean).join(' · ') || '—';

/* ---------- Bitácora legible ----------
   Texto de una constancia (cambios/{id}) para el registro general: { titulo, detalle }. Solo lo que cambió, con nombres. */
const NOMBRES = { clienteId: 'cliente', productoId: 'pan', cantidad: 'cantidad', trabajadorId: 'quién pesó', entregaN: 'entrega', nota: 'nota', fecha: 'día', hora: 'hora' };
export function describirCambio(c, productos, trabajadores, unidad, clientes) {
  const titulo = { corregir: 'Corregido', anular: 'Anulado', reactivar: 'Reactivado' }[c.tipo] || 'Cambio';
  const A = c.antes || {}, B = c.despues || {}, u = unidad || B.unidad || A.unidad;   // si la unidad no cambió, es la del canasto
  const orig = (clientes || []).filter(x => x.tipo !== 'suelta').sort((a, b) => (a.en || 0) - (b.en || 0) || String(a.id).localeCompare(String(b.id)))[0];
  const ver = (k, v, un) => {
    if (k === 'clienteId' && !v && orig) return orig.nombre;   // lo anotado antes de la Fase 11 (sin cliente) es del cliente original
    if (v === undefined || v === null || v === '') return '—';
    if (k === 'productoId') return nombreDe(productos, v);
    if (k === 'trabajadorId') return nombreDe(trabajadores, v);
    if (k === 'clienteId') return nombreDe(clientes, v);
    if (k === 'cantidad') return textoCantidad(v, un || u);
    if (k === 'entregaN') return 'n.º ' + v;
    return String(v);
  };
  const partes = Object.keys(NOMBRES).filter(k => k in A || k in B)
    .map(k => NOMBRES[k] + ': ' + ver(k, A[k], A.unidad) + ' → ' + ver(k, B[k], B.unidad));
  return { titulo, detalle: partes.join(' · ') };
}
