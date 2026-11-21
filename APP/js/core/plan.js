/* Plan de producción del día (PLAN, Fase 10). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/plan-unit.js).
   Qué se planifica: por pan, el TOTAL del día (no por entrega), en kilos o unidades según el catálogo (como se pesa).
     planes/{AAAA-MM-DD} = { fecha, items: [{ productoId, cantidad, unidad, tandas }] (1 a 60), nota?, por, quien, en }
   `tandas` = cantidad ÷ rendimiento de la receta vigente ese día (Fase 9), con 1 decimal, o null si el pan no tiene receta. Se calcula
   y GUARDA al armar el plan: así la tablet ve las tandas sin leer recetas (no puede). Si después cambia la receta, el plan guardado
   conserva sus tandas hasta que se vuelva a guardar.
   Sugerencia: el promedio de lo pesado el MISMO DÍA DE LA SEMANA en las 4 semanas anteriores, contando solo los días con pesajes
   (un día cerrado o festivo no baja el promedio; en un día trabajado, un pan no pesado cuenta 0), redondeado HACIA ARRIBA a tandas
   completas (sin receta: al kilo entero o a la decena de unidades).
   Avance: pesado ÷ plan. Bajo 95 % normal («faltan 18 kg»), de 95 % a 110 % verde («cumplido»), sobre 110 % aviso («sobre el plan»).
   Solo informa: no bloquea nada. Lo pesado sale de los mismos canastos que «Pesado hoy» (core/pesaje.js), así los totales cuadran. */
import { numero, limpiar, esFecha, activos, ordenarProductos } from './catalogo.js';
import { vigentes, sumarDias, textoCantidad } from './pesaje.js';
import { recetaVigente } from './costos.js';

export const SEMANAS = 4, MAX_ITEMS = 60, VERDE = 95, SOBRE = 110;
export const MAX_KG = 99999.99, MAX_UN = 999999;
const r2 = n => Math.round(n * 100) / 100;
const r1 = n => Math.round(n * 10) / 10;
const enUnidad = (n, unidad) => (unidad === 'un' ? Math.round(n) : r2(n));
const finito = n => typeof n === 'number' && Number.isFinite(n);
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
/* El techo sin el error de los decimales del computador: 3,0000000001 tandas son 3, no 4. */
const techo = n => Math.ceil(Math.round(n * 1e6) / 1e6);

/* ---------- Fechas ---------- */
/* Días que se miran para sugerir el plan de una fecha: el mismo día de la semana, 1 a 4 semanas antes (del más cercano al más lejano). */
export const fechasMuestra = fecha => Array.from({ length: SEMANAS }, (x, i) => sumarDias(fecha, -7 * (i + 1)));
/* Se arma (y se cambia o se quita) solo el plan de hoy o de mañana; los días pasados solo se miran. */
export const editable = (fecha, hoy) => fecha === hoy || fecha === sumarDias(hoy, 1);

/* ---------- Cantidades ---------- */
/* Para mostrar: 120 kg · 18,5 kg · 1.200 un. Sin ceros de más («18,50» → «18,5»). */
export function texto(n, unidad) {
  if (!finito(n)) return '—';
  if (unidad === 'un') return textoCantidad(n, 'un');
  const c = Math.round(Math.abs(n) * 100), ent = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), dec = String(c % 100).padStart(2, '0').replace(/0+$/, '');
  return (n < 0 && c ? '-' : '') + ent + (dec ? ',' + dec : '') + ' kg';
}
/* En el campo: 18,5 · 1200 (sin separador de miles, para que se pueda corregir). */
export const enCampo = (n, unidad) => (finito(n) ? String(enUnidad(n, unidad)).replace('.', ',') : '');
/* Tandas: 4 → «4 tandas» · 3,4 → «3,4 tandas» · 1 → «1 tanda». */
export const textoTandas = t => (finito(t) ? String(r1(t)).replace('.', ',') + (r1(t) === 1 ? ' tanda' : ' tandas') : '');
/* Tandas de una cantidad con un rendimiento (kg o unidades que salen de una tanda), con 1 decimal. null si no hay receta. */
export const tandas = (cantidad, rendimiento) => (finito(cantidad) && finito(rendimiento) && rendimiento > 0 ? r1(cantidad / rendimiento) : null);
const rendimiento = (recetas, productoId, fecha) => { const r = recetaVigente(recetas, productoId, fecha); return r && finito(r.rendimiento) && r.rendimiento > 0 ? r.rendimiento : null; };

/* ---------- Lo pesado ---------- */
/* Cantidad pesada por pan en una lista de canastos (los anulados no cuentan): Map productoId → { cantidad, unidad }. */
export function pesadoPorPan(pesajes) {
  const m = new Map();
  for (const p of vigentes(pesajes)) {
    const x = m.get(p.productoId) || { cantidad: 0, unidad: p.unidad };
    x.cantidad = enUnidad(x.cantidad + p.cantidad, x.unidad); m.set(p.productoId, x);
  }
  return m;
}

/* ---------- Sugerencia ---------- */
/* Redondeo hacia arriba: con receta, a tandas completas; sin receta, al kilo entero o a la decena de unidades.
   → { cantidad, tandas } (tandas enteras, o null sin receta). Promedio 0 o sin datos → null (sin sugerencia). */
export function redondear(promedio, unidad, rend) {
  if (!finito(promedio) || promedio <= 0) return null;
  if (finito(rend) && rend > 0) { const t = techo(promedio / rend); return { cantidad: enUnidad(t * rend, unidad), tandas: t }; }
  return { cantidad: unidad === 'un' ? techo(promedio / 10) * 10 : techo(promedio), tandas: null };
}
/* muestras = [{ fecha, pesajes }] de los días de fechasMuestra (los que se pudieron leer). Para cada pan activo, en el orden del catálogo:
   { productoId, nombre, unidad, promedio, dias (días trabajados que cuentan), sugerida (cantidad o null), tandas, rendimiento }.
   Un día sin canastos vigentes no cuenta (cerrado o festivo); en uno trabajado, un pan que no se pesó cuenta 0. */
export function sugerencias(muestras, productos, recetas, fecha) {
  const trabajados = (muestras || []).filter(m => vigentes(m.pesajes).length).map(m => pesadoPorPan(m.pesajes)), n = trabajados.length;
  return ordenarProductos(activos(productos)).map(p => {
    const total = trabajados.reduce((s, m) => s + (m.has(p.id) && m.get(p.id).unidad === p.unidad ? m.get(p.id).cantidad : 0), 0);
    const promedio = n ? r2(total / n) : 0, rend = rendimiento(recetas, p.id, fecha), s = redondear(promedio, p.unidad, rend);
    return { productoId: p.id, nombre: p.nombre, unidad: p.unidad, promedio, dias: n, sugerida: s ? s.cantidad : null, tandas: s ? s.tandas : null, rendimiento: rend };
  });
}

/* ---------- Armar el plan ---------- */
/* Panes que van en el formulario: los activos, y los desactivados que ya estaban en el plan (para poder sacarlos). */
export function panesDelForm(productos, plan) {
  const en = new Set(((plan && plan.items) || []).map(i => i.productoId));
  return ordenarProductos((productos || []).filter(p => p.activo !== false || en.has(p.id)));
}
/* Lee una cantidad escrita (12,5 · 1.200 · 1200) en la unidad del pan. → número, o NaN si no se entiende o no corresponde. */
export function cantidad(txt, unidad) {
  const t = String(txt == null ? '' : txt).trim().replace(/\s*(kg|kilos?|un|unidades?)$/i, '');
  if (!t) return null;
  const n = numero(t);
  if (Number.isNaN(n) || n <= 0) return NaN;
  if (unidad === 'un') return Number.isInteger(n) && n <= MAX_UN ? n : NaN;
  return n <= MAX_KG ? r2(n) : NaN;
}
/* f = { cantidades: { productoId: texto }, nota } · panes = panesDelForm(…) · recetas (para las tandas) · fecha del plan.
   → { datos: { fecha, items, nota? } } o { error, campo }. En blanco = ese pan no va en el plan. */
export function validar(f, panes, recetas, fecha) {
  if (!esFecha(fecha)) return { error: 'Falta el día del plan.', campo: '' };
  const items = [];
  for (const p of panes || []) {
    const n = cantidad((f.cantidades || {})[p.id], p.unidad);
    if (n === null) continue;
    if (Number.isNaN(n)) return { error: p.unidad === 'un' ? 'Escribe las unidades de ' + p.nombre + ' sin decimales (por ejemplo 600).' : 'No se entienden los kilos de ' + p.nombre + ' (por ejemplo 120 o 17,5).', campo: 'pl-' + p.id };
    items.push({ productoId: p.id, cantidad: n, unidad: p.unidad, tandas: tandas(n, rendimiento(recetas, p.id, fecha)) });
  }
  if (!items.length) return { error: 'Anota al menos un pan, o toca «Quitar plan».', campo: '' };
  if (items.length > MAX_ITEMS) return { error: 'Un plan lleva hasta ' + MAX_ITEMS + ' panes.', campo: '' };
  const datos = { fecha, items }, nota = limpiar(f.nota, 200);
  if (nota) datos.nota = nota;
  return { datos };
}
/* Documento para guardar (la hora del servidor `en` la agrega nube.js). */
export const documento = (datos, uid, quien) => Object.assign({}, datos, { por: uid, quien: limpiar(quien, 60) || 'Sin nombre' });
/* Sugerencias para «Usar sugerencias»: solo los campos vacíos. valores = { productoId: texto } → { productoId: texto nuevo }. */
export function usarSugerencias(valores, sug) {
  const r = {};
  for (const s of sug || []) if (s.sugerida != null && !String((valores || {})[s.productoId] || '').trim()) r[s.productoId] = enCampo(s.sugerida, s.unidad);
  return r;
}

/* ---------- Comparar con lo pesado ---------- */
/* Estado de un pan: 'bajo' (menos de 95 %), 'cumplido' (95 % a 110 %, ambos incluidos), 'sobre' (más de 110 %).
   Se compara en números enteros (centésimos de kilo o unidades), sin dividir: 95 % exacto es verde aunque la división dé 94,99999… */
export function estado(pesado, plan, unidad) {
  const e = unidad === 'un' ? 1 : 100, W = Math.round((pesado || 0) * e), Q = Math.round((plan || 0) * e);
  if (!(Q > 0)) return 'bajo';
  return W * 100 < VERDE * Q ? 'bajo' : W * 100 <= SOBRE * Q ? 'cumplido' : 'sobre';
}
/* plan (planes/{fecha} o null) y los canastos de ese día. → { filas, fuera, totales } o null sin plan.
   filas: una por pan del plan, en el orden del catálogo: { productoId, nombre, unidad, plan, tandas, pesado, falta, exceso, pct, estado }.
   fuera: lo pesado de panes que no estaban en el plan. totales: { plan: { kg, un }, pesado: { kg, un } (del plan), fuera: { kg, un } }. */
export function avance(plan, pesajes, productos) {
  if (!plan || !Array.isArray(plan.items) || !plan.items.length) return null;
  const pes = pesadoPorPan(pesajes), orden = new Map(ordenarProductos(productos || []).map((p, i) => [p.id, i])), o = id => (orden.has(id) ? orden.get(id) : 1e9);
  const T = { plan: { kg: 0, un: 0 }, pesado: { kg: 0, un: 0 }, fuera: { kg: 0, un: 0 } }, suma = (t, n, u) => { if (u === 'un') t.un += n; else t.kg = r2(t.kg + n); };
  const enPlan = new Set();
  const filas = plan.items.map(it => {
    enPlan.add(it.productoId);
    const u = it.unidad, x = pes.get(it.productoId), pesado = x && x.unidad === u ? x.cantidad : 0, pct = it.cantidad > 0 ? pesado / it.cantidad * 100 : 0;
    suma(T.plan, it.cantidad, u); suma(T.pesado, pesado, u);
    return { productoId: it.productoId, nombre: nombreDe(productos, it.productoId), unidad: u, plan: it.cantidad, tandas: finito(it.tandas) ? it.tandas : null, pesado,
      falta: enUnidad(Math.max(0, it.cantidad - pesado), u), exceso: enUnidad(Math.max(0, pesado - it.cantidad), u), pct, estado: estado(pesado, it.cantidad, u) };
  }).sort((a, b) => o(a.productoId) - o(b.productoId) || a.nombre.localeCompare(b.nombre, 'es'));
  const fuera = [...pes.entries()].filter(e => !enPlan.has(e[0]) && e[1].cantidad > 0).map(([id, x]) => { suma(T.fuera, x.cantidad, x.unidad); return { productoId: id, nombre: nombreDe(productos, id), unidad: x.unidad, pesado: x.cantidad }; })
    .sort((a, b) => o(a.productoId) - o(b.productoId) || a.nombre.localeCompare(b.nombre, 'es'));
  return { filas, fuera, totales: T };
}
/* La línea corta de un pan: «faltan 18 kg» · «✓ cumplido» · «sobre el plan (+ 8 kg)». */
export function lineaCorta(f) {
  if (f.estado === 'cumplido') return '✓ cumplido';
  if (f.estado === 'sobre') return 'sobre el plan (+ ' + texto(f.exceso, f.unidad) + ')';
  return (f.unidad === 'un' && f.falta === 1 ? 'falta ' : 'faltan ') + texto(f.falta, f.unidad);
}
/* «82 %», sin decimales y hacia abajo (94,9 % se ve «94 %»: nunca parece cumplido sin estarlo). El estado va además en palabras. */
export const pctTexto = p => (finito(p) ? Math.floor(p + 1e-9) + ' %' : '—');
/* «120 kg y 600 un» (lo que haya). */
export const textoTotales = t => [t.kg ? texto(t.kg, 'kg') : '', t.un ? texto(t.un, 'un') : ''].filter(Boolean).join(' y ') || '—';
