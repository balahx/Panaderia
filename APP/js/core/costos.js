/* Costos y margen por pan (PLAN, Fase 9). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/costos-unit.js).
   Margen de un pan = venta neta − ingredientes. Los ingredientes salen de la RECETA de una tanda (por kilos de masa) y de lo que
   «salen» (rendimiento: kilos de pan horneado, o unidades si el pan es por unidad). Margen % = sobre el precio de venta.
   Resultado del mes = venta neta − ingredientes − gastos del mes (gas, luz, sueldos, arriendo…). Los gastos NO se reparten entre panes.
   Todo es NETO: los insumos y los gastos con factura se anotan sin IVA.
     insumos/{id}                       = { nombre, unidad: 'kg' | 'l' | 'un', activo }
     preciosInsumo/{insumoId_desde}     = { insumoId, formato (cuánto trae lo comprado, en su unidad: 25 = saco de 25 kg), neto (del formato), desde }
     recetas/{productoId_desde}         = { productoId, desde, items: [{ insumoId, cantidad }], rendimiento, nota, por }
     gastos/{AAAA-MM}                   = { mes, items: [{ nombre, monto }], por, quien }
   Precios de insumos y recetas tienen FECHA DE VIGENCIA, como los precios de venta: un alza de la harina o una receta nueva rigen desde
   su fecha y los meses anteriores conservan su costo. El costo de una línea de venta (un pan en una entrega de un día) usa la receta y
   los precios vigentes ESE día; todo total es suma de líneas (igual que el neto: core/ventas.js), así el Excel cuadra con la pantalla. */
import { numero, limpiar, esFecha, redondearPesos, enCampo } from './catalogo.js';
import * as V from './ventas.js';
import { panesDeCierre } from './cierres.js';

const igual = (a, b) => limpiar(a).toLocaleLowerCase('es') === limpiar(b).toLocaleLowerCase('es');
const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es');
const desc = (a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0);
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
const finito = n => typeof n === 'number' && Number.isFinite(n);
const r2 = n => Math.round(n * 100) / 100;
export const MAX_ITEMS = 30, MAX_GASTOS = 30;
/* Fecha por omisión del PRIMER precio de un insumo y de la primera receta de un pan: desde el inicio de los datos (los cierres parten en
   enero de 2026), así los meses anteriores también tienen costo. Después, por omisión, cada cambio rige desde hoy. */
export const INICIO = '2026-01-01';

/* ---------- Insumos ---------- */
export const UNIDADES = { kg: { t: 'Kilos', c: 'kg', p: 'kilo' }, l: { t: 'Litros', c: 'l', p: 'litro' }, un: { t: 'Unidades', c: 'un', p: 'unidad' } };
export const ordenarInsumos = l => (l || []).slice().sort(porNombre);
export const activos = l => (l || []).filter(x => x.activo !== false);
export function validarInsumo(f, otros) {
  const nombre = limpiar(f.nombre);
  if (!nombre) return { error: 'Escribe el nombre del insumo (por ejemplo, Harina).', campo: 'nombre' };
  if ((otros || []).some(x => igual(x.nombre, nombre))) return { error: 'Ya hay un insumo con ese nombre.', campo: 'nombre' };
  if (!UNIDADES[f.unidad]) return { error: 'Elige si se mide en kilos, litros o unidades.', campo: 'unidad' };
  return { datos: { nombre, unidad: f.unidad, activo: f.activo !== false } };
}
export const soloInsumo = i => ({ nombre: i.nombre, unidad: i.unidad, activo: i.activo !== false });

/* ---------- Precios de insumos (con vigencia) ---------- */
export const idPrecio = (insumoId, desde) => insumoId + '_' + desde;
export const historial = (precios, insumoId) => (precios || []).filter(p => p.insumoId === insumoId).sort(desc);
export const precioVigente = (precios, insumoId, fecha) => historial(precios, insumoId).find(p => p.desde <= fecha) || null;
/* Pesos por kilo, litro o unidad (sin redondear: el redondeo se hace en el monto final). */
export const porUnidad = p => (p && finito(p.neto) && finito(p.formato) && p.formato > 0 ? p.neto / p.formato : null);
export function validarPrecio(f) {
  const formato = numero(f.formato), neto = numero(f.neto);
  if (Number.isNaN(formato) || formato <= 0 || formato > 100000) return { error: 'Escribe cuánto trae lo que se compra (por ejemplo 25 para un saco de 25 kg).', campo: 'formato' };
  if (Number.isNaN(neto) || neto < 0 || neto > 100000000) return { error: 'Escribe el precio neto de factura, sin IVA (por ejemplo 18.500).', campo: 'neto' };
  if (!esFecha(f.desde)) return { error: 'Elige desde qué fecha rige.', campo: 'desde' };
  return { datos: { formato: Math.round(formato * 1000) / 1000, neto: r2(neto), desde: f.desde } };
}

/* ---------- Cantidades de una receta ---------- */
/* Lo que se escribe en la receta: en la unidad del insumo, con coma o punto; en kilos o litros se aceptan gramos o mililitros
   escritos con su sigla («250 g», «250gr», «500 ml»). Devuelve NaN si no se entiende. */
export function cantidad(texto, unidad) {
  const t = String(texto == null ? '' : texto).trim().toLowerCase().replace(/\s+/g, '');
  const m = /^([\d.,]+)(g|gr|grs|gramos?|ml|cc|kg|k|kilos?|l|lt|lts|litros?|un|u|unidades?)?$/.exec(t);
  if (!m) return NaN;
  let n = numero(m[1]); const s = m[2] || '';
  if (Number.isNaN(n)) return NaN;
  if (/^(g|gr|grs|gramo|gramos)$/.test(s)) { if (unidad !== 'kg') return NaN; n /= 1000; }
  else if (/^(ml|cc)$/.test(s)) { if (unidad !== 'l') return NaN; n /= 1000; }
  else if (/^(kg|k|kilo|kilos)$/.test(s)) { if (unidad !== 'kg') return NaN; }
  else if (/^(l|lt|lts|litro|litros)$/.test(s)) { if (unidad !== 'l') return NaN; }
  else if (s && unidad !== 'un') return NaN;
  return Math.round(n * 1000) / 1000;
}
/* Cantidad para mostrar: 0,25 kg → «250 g»; 12,5 kg → «12,5 kg»; 7,5 l → «7,5 l»; 1 un → «1 un». */
export function textoCantidad(n, unidad) {
  if (!finito(n)) return '—';
  if ((unidad === 'kg' || unidad === 'l') && n < 1) return enCampo(Math.round(n * 1000 * 10) / 10) + (unidad === 'kg' ? ' g' : ' ml');
  return enCampo(Math.round(n * 1000) / 1000) + ' ' + (UNIDADES[unidad] ? UNIDADES[unidad].c : '');
}

/* ---------- Recetas (con vigencia) ---------- */
export const idReceta = (productoId, desde) => productoId + '_' + desde;
export const historialReceta = (recetas, productoId) => (recetas || []).filter(r => r.productoId === productoId).sort(desc);
export const recetaVigente = (recetas, productoId, fecha) => historialReceta(recetas, productoId).find(r => r.desde <= fecha) || null;
/* f = { cantidades: { insumoId: texto }, rendimiento: texto, desde, nota } · producto (su unidad decide qué es el rendimiento) */
export function validarReceta(f, producto, insumos) {
  const items = [];
  for (const i of insumos || []) {
    const t = String((f.cantidades || {})[i.id] == null ? '' : f.cantidades[i.id]).trim();
    if (!t) continue;
    const n = cantidad(t, i.unidad);
    if (Number.isNaN(n) || n <= 0 || n > 100000) return { error: 'No se entiende la cantidad de ' + i.nombre + ' (en ' + UNIDADES[i.unidad].t.toLowerCase() + (i.unidad === 'un' ? '' : '; también «250 g»') + ').', campo: 'c-' + i.id };
    items.push({ insumoId: i.id, cantidad: n });
  }
  if (!items.length) return { error: 'Anota al menos un ingrediente de la tanda.', campo: '' };
  if (items.length > MAX_ITEMS) return { error: 'Una receta lleva hasta ' + MAX_ITEMS + ' ingredientes.', campo: '' };
  const rend = numero(f.rendimiento), un = producto && producto.unidad === 'un';
  if (Number.isNaN(rend) || rend <= 0 || rend > 100000 || (un && !Number.isInteger(rend)))
    return { error: un ? 'Escribe cuántas unidades salen de la tanda (por ejemplo 192).' : 'Escribe cuántos kilos de pan horneado salen de la tanda (por ejemplo 17,5).', campo: 'rendimiento' };
  if (!esFecha(f.desde)) return { error: 'Elige desde qué fecha rige la receta.', campo: 'desde' };
  const nota = limpiar(f.nota, 200), datos = { productoId: producto.id, desde: f.desde, items, rendimiento: un ? rend : r2(rend) };
  if (nota) datos.nota = nota;
  return { datos };
}

/* Costo de una receta en una fecha, con los precios de los insumos vigentes ese día.
   → { tanda (pesos), unitario (pesos por kg o unidad, sin redondear), masa (kg + l), merma (% de masa que no queda en el pan, solo por kilo),
       items: [{ insumoId, nombre, unidad, cantidad, precio (por unidad del insumo), costo }], faltan: [nombres sin precio] }   ó null sin receta */
export function costoReceta(receta, insumos, precios, fecha, producto) {
  if (!receta) return null;
  const items = (receta.items || []).map(it => {
    const ins = (insumos || []).find(x => x.id === it.insumoId), pr = porUnidad(precioVigente(precios, it.insumoId, fecha));
    return { insumoId: it.insumoId, nombre: ins ? ins.nombre : '(insumo borrado)', unidad: ins ? ins.unidad : 'kg', cantidad: it.cantidad, precio: pr, costo: pr == null ? null : pr * it.cantidad };
  });
  const faltan = items.filter(i => i.costo == null).map(i => i.nombre), tanda = faltan.length ? null : items.reduce((s, i) => s + i.costo, 0);
  const masa = Math.round(items.filter(i => i.unidad !== 'un').reduce((s, i) => s + i.cantidad, 0) * 1000) / 1000;
  const porKilo = !producto || producto.unidad !== 'un';
  return { tanda: tanda == null ? null : r2(tanda), unitario: tanda == null || !(receta.rendimiento > 0) ? null : tanda / receta.rendimiento, rendimiento: receta.rendimiento,
    masa, merma: porKilo && masa > 0 && receta.rendimiento < masa ? Math.round((masa - receta.rendimiento) / masa * 1000) / 10 : null, items, faltan };
}
/* Costo por kg o unidad de un pan en un día (o null). k = { insumos, preciosInsumo, recetas }. */
export function costoUnitario(k, productoId, fecha, producto) {
  const c = costoReceta(recetaVigente(k.recetas, productoId, fecha), k.insumos, k.preciosInsumo, fecha, producto);
  return c ? c.unitario : null;
}
/* Por qué un pan no tiene costo en una fecha: 'receta' (no hay) · 'precio' (falta el precio de un insumo) · '' (sí tiene). */
export function faltaCosto(k, productoId, fecha) {
  const r = recetaVigente(k.recetas, productoId, fecha);
  if (!r) return 'receta';
  return costoReceta(r, k.insumos, k.preciosInsumo, fecha).faltan.length ? 'precio' : '';
}

/* ---------- Margen ---------- */
export const margenPct = (neto, costo) => (finito(neto) && finito(costo) && neto > 0 ? (neto - costo) / neto * 100 : null);
/* Las líneas de venta (core/ventas.js) con costo, margen y margen %. costo = costo unitario de ESE día × cantidad, en pesos enteros. */
export function conCostos(ls, k, productos) {
  const cache = new Map();
  return (ls || []).map(l => {
    const key = l.productoId + '|' + l.fecha;
    if (!cache.has(key)) cache.set(key, costoUnitario(k, l.productoId, l.fecha, (productos || []).find(p => p.id === l.productoId)));
    const u = cache.get(key), costo = u == null ? null : redondearPesos(u * l.cantidad);
    return Object.assign({}, l, { costoU: u, costo, margen: costo == null || l.neto == null ? null : l.neto - costo, margenPct: costo == null ? null : margenPct(l.neto, costo) });
  });
}
/* Suma de líneas con costo: venta (neto de las que tienen precio), ingredientes (las que tienen costo), margen = venta − ingredientes. */
export function totalesCosto(ls) {
  const t = { venta: 0, costo: 0, sinCosto: 0 };
  for (const l of ls || []) { if (l.neto != null) t.venta += l.neto; if (l.costo == null) t.sinCosto++; else t.costo += l.costo; }
  t.margen = t.venta - t.costo; t.pct = margenPct(t.venta, t.costo);
  return t;
}
/* Panes vendidos sin costo (sin receta o con un insumo sin precio), con los días. */
export function faltanCostos(ls) {
  const m = new Map();
  for (const l of ls || []) if (l.costo == null) { if (!m.has(l.productoId)) m.set(l.productoId, { productoId: l.productoId, nombre: l.nombre, fechas: [] }); const f = m.get(l.productoId).fechas; if (!f.includes(l.fecha)) f.push(l.fecha); }
  return [...m.values()].sort(porNombre);
}

/* ---------- Simulador (ficha del pan) ---------- */
/* Con un precio neto: margen en pesos y en %. */
export const simular = (costo, precio) => (finito(costo) && finito(precio) && precio > 0 ? { margen: precio - costo, pct: margenPct(precio, costo) } : null);
/* Precio neto para ganar `pct` % del precio de venta: costo / (1 − pct/100). null si pct ≥ 100 o sin costo. */
export const precioPara = (costo, pct) => (finito(costo) && finito(pct) && pct < 100 && pct > -1000 ? r2(costo / (1 - pct / 100)) : null);

/* ---------- Un mes: venta, ingredientes, margen por pan, gastos y resultado ---------- */
const ultimoDia = mes => V.rangoMes(mes).hasta;
/* o: { cierre, pesajes (los del mes), productos, precios, clienteId, iva, k (costos), gastos (documento del mes o null) }
   Regla de la Fase 6: un mes CERRADO vale lo de su cierre (venta y cantidades por pan). Los ingredientes salen de los pesajes del mes,
   con la receta y los precios de cada día; si el mes se importó desde Excel (no hay días), se ESTIMAN con la cantidad del mes × el costo
   vigente el último día del mes. */
export function resumenMes(mes, o) {
  o = o || {};
  const c = o.cierre && o.cierre.cerrado === true ? o.cierre : null, k = o.k || {};
  const L = Array.isArray(o.pesajes) && (!c || c.origen !== 'excel') ? conCostos(V.lineas(o.pesajes, o.productos, o.precios, o.clientes || o.clienteId, o.iva), k, o.productos) : [];
  const deLineas = new Map();
  for (const l of L) {
    if (!deLineas.has(l.productoId)) deLineas.set(l.productoId, { productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, cantidad: 0, neto: 0, costo: 0, sinCosto: false, sinPrecio: false });
    const p = deLineas.get(l.productoId);
    p.cantidad = l.unidad === 'un' ? p.cantidad + l.cantidad : r2(p.cantidad + l.cantidad);
    if (l.neto == null) p.sinPrecio = true; else p.neto += l.neto;
    if (l.costo == null) p.sinCosto = true; else p.costo += l.costo;
  }
  let panes, estimado = false;
  if (c) {
    panes = panesDeCierre(c).map(x => {
      const d = deLineas.get(x.productoId), base = { productoId: x.productoId, nombre: x.nombre, unidad: x.unidad, cantidad: x.cantidad || 0, neto: x.neto || 0, sinPrecio: !!x.sinPrecio };
      if (d) return Object.assign(base, { costo: d.sinCosto ? null : d.costo });
      const u = costoUnitario(k, x.productoId, ultimoDia(mes), (o.productos || []).find(p => p.id === x.productoId));
      if (base.cantidad) estimado = true;
      return Object.assign(base, { costo: u == null ? null : redondearPesos(u * base.cantidad), estimado: true });
    });
  } else panes = [...deLineas.values()].map(p => Object.assign(p, { costo: p.sinCosto ? null : p.costo }));
  panes.forEach(p => { p.margen = p.costo == null ? null : p.neto - p.costo; p.pct = p.costo == null ? null : margenPct(p.neto, p.costo); });
  panes.sort((a, b) => b.neto - a.neto || a.nombre.localeCompare(b.nombre, 'es'));
  const venta = c ? c.neto || 0 : panes.reduce((s, p) => s + p.neto, 0), costo = panes.reduce((s, p) => s + (p.costo || 0), 0);
  const G = totalGastos(o.gastos), margen = venta - costo;
  return { mes, cerrado: !!c, origen: c ? c.origen : null, estimado, hayDatos: panes.length > 0, venta, costo, margen, pct: margenPct(venta, costo), panes,
    sinCosto: panes.filter(p => p.costo == null && (p.cantidad || p.neto)), sinPrecio: panes.filter(p => p.sinPrecio), lineas: L,
    gastos: G.items, totalGastos: G.total, hayGastos: !!(o.gastos && Array.isArray(o.gastos.items)), resultado: margen - G.total, resultadoPct: venta > 0 ? (margen - G.total) / venta * 100 : null };
}

/* ---------- Gastos del mes ---------- */
export const SUGERIDOS = ['Gas', 'Luz', 'Sueldos', 'Arriendo', 'Agua', 'Transporte', 'Otros'];
export function totalGastos(doc) {
  const items = doc && Array.isArray(doc.items) ? doc.items.filter(x => x && Number.isInteger(x.monto)) : [];
  return { items, total: items.reduce((s, x) => s + x.monto, 0) };
}
/* Filas para el formulario: las del mes (o las sugeridas, si aún no hay) y espacio para dos más. */
export function filasGastos(doc) {
  const items = doc && Array.isArray(doc.items) ? doc.items : [];
  const l = items.map(x => ({ nombre: x.nombre, monto: x.monto }));
  for (const s of SUGERIDOS) if (!l.some(x => igual(x.nombre, s))) l.push({ nombre: s, monto: null });
  return l.concat([{ nombre: '', monto: null }, { nombre: '', monto: null }]).slice(0, MAX_GASTOS);
}
/* filas = [{ nombre: texto, monto: texto }] → { items } (pesos enteros; una fila sin monto no se guarda) o { error, fila } */
export function validarGastos(filas) {
  const items = [];
  for (let i = 0; i < (filas || []).length; i++) {
    const f = filas[i], nombre = limpiar(f.nombre, 40), t = String(f.monto == null ? '' : f.monto).trim();
    if (!t) continue;
    const n = numero(t);
    if (Number.isNaN(n) || n < 0 || n > 10000000000) return { error: 'No se entiende el monto' + (nombre ? ' de ' + nombre : '') + ' (en pesos, por ejemplo 450.000).', fila: i };
    if (!nombre) return { error: 'Falta el nombre del gasto de ' + Math.round(n) + ' pesos.', fila: i };
    if (items.some(x => igual(x.nombre, nombre))) return { error: nombre + ' está dos veces: júntalos en una línea.', fila: i };
    items.push({ nombre, monto: Math.round(n) });
  }
  if (items.length > MAX_GASTOS) return { error: 'Hasta ' + MAX_GASTOS + ' líneas de gastos por mes.', fila: -1 };
  return { items };
}
export const documentoGastos = (mes, items, o) => ({ mes, items, por: o.por, quien: String(o.quien || 'Sin nombre').slice(0, 60) || 'Sin nombre' });
export const pctTexto = p => (finito(p) ? enCampo(Math.round(p * 10) / 10) + ' %' : '—');
