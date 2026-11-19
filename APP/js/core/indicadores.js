/* Indicadores, proyección y metas (PLAN §3.8 y §3.9, Fase 7). Lógica pura, sin pantalla ni Firebase: se prueba con Node
   (tests/indicadores-unit.js).
   De dónde sale cada mes (ESTADO.md, decisiones de la Fase 6):
     · mes CERRADO → sus totales son los del cierre (cierres/{AAAA-MM}: neto, kg, un y una línea por pan). Si se cerró con la app,
       los pesajes del mes dan además el detalle por día, por día de la semana y por trabajador; si vino de Excel, ese detalle no existe.
     · mes sin cerrar (o reabierto) → lo pesado no anulado con el precio vigente de cada día (core/ventas.js), igual que Entregas.
   Así los totales de los indicadores cuadran con Cierres y con Entregas (PLAN, Fase 7, «Listo cuando»). Todo en NETO (sin IVA).
   Proyección de un año A: el mismo mes de A − 1 × factor de crecimiento (general, o el de cada pan) × factor de precio.
     cantidad proyectada = cantidad base × crecimiento · neto proyectado = neto base × crecimiento × precio (pesos enteros, por pan)
   Metas: la proyección se fija como meta mes a mes (y cada meta se puede escribir a mano). Mientras un mes no tenga meta fijada,
   se compara con su proyección. proyeccion/{AAAA} = { anio, factor, factorPrecio, panes: { productoId: factor }, metas: [12 × pesos | null], por, quien, en } */
import * as V from './ventas.js';
import { redondearPesos, numero } from './catalogo.js';
import { vigentes } from './pesaje.js';

const kg2 = n => Math.round(n * 100) / 100;
const finito = n => typeof n === 'number' && Number.isFinite(n);
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];   // de lunes a domingo
const diaNum = f => new Date(f + 'T12:00:00Z').getUTCDay();
export const diasDelMes = mes => Number(V.rangoMes(mes).hasta.slice(8));
const nombreDe = (lista, id) => { const x = (lista || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };

/* ---------- Un mes ---------- */
/* o: { cierre, pesajes (los del mes, o null si no se leyeron), productos, precios, clienteId, iva, trabajadores, hoy }
   → { mes, fuente: 'excel' | 'app' | 'sin-datos', cerrado, neto, kg, un, sinPrecio, panes: [{ productoId, nombre, unidad, cantidad, neto, pct }],
       detalle (hay datos por día), dias, semana, trabajadores, promedio, enCurso, ritmo, cambio (lo anotado ya no suma lo del cierre) } */
export function resumenMes(mes, o) {
  o = o || {};
  const c = o.cierre && o.cierre.cerrado === true ? o.cierre : null, hoy = o.hoy || '';
  const R = { mes, cerrado: !!c, origen: c ? c.origen : null, fuente: 'sin-datos', neto: 0, kg: 0, un: 0, sinPrecio: 0, panes: [], detalle: false,
    dias: [], semana: [], trabajadores: [], promedio: null, diasMes: diasDelMes(mes), enCurso: !c && V.mesDe(hoy) === mes, ritmo: null, cambio: false };
  const L = Array.isArray(o.pesajes) && (!c || c.origen !== 'excel') ? V.lineas(o.pesajes, o.productos, o.precios, o.clienteId, o.iva) : [];
  if (c) {
    R.fuente = c.origen === 'excel' ? 'excel' : 'app';
    R.neto = c.neto || 0; R.kg = c.kg || 0; R.un = c.un || 0; R.sinPrecio = c.sinPrecio || 0;
    R.panes = (c.lineas || []).map(l => ({ productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, cantidad: l.cantidad || 0, neto: l.neto || 0, sinPrecio: !!l.sinPrecio }));
  } else if (L.length) {
    const T = V.totales(L);
    R.fuente = 'app'; R.neto = T.neto; R.kg = T.kg; R.un = T.un; R.sinPrecio = V.faltanPrecios(L).length;
    R.panes = V.porPan(L, o.productos).map(p => ({ productoId: p.productoId, nombre: p.nombre, unidad: p.unidad, cantidad: p.cantidad, neto: p.neto, sinPrecio: p.sinPrecio > 0 }));
  }
  R.panes.forEach(p => { p.pct = R.neto ? p.neto / R.neto * 100 : 0; });
  if (L.length) {
    R.detalle = true;
    R.dias = V.porDia(L).map(d => ({ fecha: d.fecha, neto: d.neto, kg: d.kg, un: d.un, canastos: d.canastos }));
    if (c) { const T = V.totales(L); R.cambio = T.neto !== c.neto || Math.abs(T.kg - (c.kg || 0)) > 0.001 || T.un !== (c.un || 0); }
    R.semana = porSemana(R.dias);
    R.trabajadores = porTrabajador(o.pesajes, o.trabajadores);
  }
  const n = R.detalle ? R.dias.length : R.neto || R.kg || R.un ? R.diasMes : 0;
  if (n) R.promedio = { por: R.detalle ? 'dia-venta' : 'dia-mes', dias: n, neto: redondearPesos(R.neto / n), kg: kg2(R.kg / n), un: Math.round(R.un / n) };
  if (R.enCurso && R.detalle) R.ritmo = ritmo(R, hoy);
  return R;
}
/* Al ritmo de los días ya terminados del mes en curso (sin contar hoy), ¿cuánto sumaría el mes completo? null el día 1. */
export function ritmo(R, hoy) {
  const hechos = Number(hoy.slice(8)) - 1;
  if (hechos < 1) return null;
  const ds = R.dias.filter(d => d.fecha < hoy), f = R.diasMes / hechos;
  const s = ds.reduce((t, d) => ({ neto: t.neto + d.neto, kg: t.kg + d.kg, un: t.un + d.un }), { neto: 0, kg: 0, un: 0 });
  return { dias: hechos, neto: redondearPesos(s.neto * f), kg: kg2(s.kg * f), un: Math.round(s.un * f) };
}
/* Promedio por día de la semana (solo días con entregas): la suma de todos los días es la del mes. De lunes a domingo. */
export function porSemana(dias) {
  const S = new Map(ORDEN_SEMANA.map(n => [n, { dia: n, nombre: DIAS[n], veces: 0, neto: 0, kg: 0, un: 0 }]));
  for (const d of dias || []) { const s = S.get(diaNum(d.fecha)); s.veces++; s.neto += d.neto; s.kg = kg2(s.kg + d.kg); s.un += d.un; }
  const l = [...S.values()].map(s => Object.assign(s, { promNeto: s.veces ? redondearPesos(s.neto / s.veces) : 0, promKg: s.veces ? kg2(s.kg / s.veces) : 0, promUn: s.veces ? Math.round(s.un / s.veces) : 0 }));
  const top = l.filter(s => s.veces).sort((a, b) => b.promNeto - a.promNeto || b.promKg - a.promKg);
  top.slice(0, 2).forEach((s, i) => { s.lugar = i + 1; });
  return l;
}
/* Kilos, unidades y canastos de cada trabajador (lo pesado no anulado), de más a menos kilos. */
export function porTrabajador(pesajes, trabajadores) {
  const m = new Map();
  for (const p of vigentes(pesajes)) {
    if (!m.has(p.trabajadorId)) m.set(p.trabajadorId, { trabajadorId: p.trabajadorId, nombre: nombreDe(trabajadores, p.trabajadorId), kg: 0, un: 0, canastos: 0 });
    const t = m.get(p.trabajadorId); t.canastos++;
    if (p.unidad === 'un') t.un += p.cantidad; else t.kg = kg2(t.kg + p.cantidad);
  }
  return [...m.values()].sort((a, b) => b.kg - a.kg || b.un - a.un || a.nombre.localeCompare(b.nombre, 'es'));
}
/* Panes de más a menos venta (y, sin venta, por cantidad). */
export const ranking = panes => (panes || []).slice().sort((a, b) => b.neto - a.neto || b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));

/* ---------- Comparaciones ---------- */
/* Variación porcentual de a respecto de b. null si no hay con qué comparar. */
export const variacion = (a, b) => (finito(a) && finito(b) && b !== 0 ? (a - b) / b * 100 : null);
const hayDatos = R => !!R && R.fuente !== 'sin-datos' && R.fuente !== 'cargando' && R.fuente !== 'error' && R.fuente !== 'futuro';
/* Un mes contra otro: { neto, kg, un } con { a, b, pct } y la variación de cada pan (por productoId). Del mes en curso se puede pasar
   su ritmo (lo que sumaría el mes completo) en vez de lo que lleva. */
export function comparar(act, otro) {
  if (!act || !hayDatos(otro)) return null;
  const k = x => ({ a: act[x], b: otro[x], pct: variacion(act[x], otro[x]) }), panes = new Map((otro.panes || []).map(p => [p.productoId, p]));
  return { neto: k('neto'), kg: k('kg'), un: k('un'), pan: id => { const p = panes.get(id); return p ? p : null; } };
}
/* '+5,2 %' · '−3 %' · '0 %' (una decimal si hace falta) */
export function pctTexto(p, signo) {
  if (!finito(p)) return '—';
  const a = Math.round(Math.abs(p) * 10) / 10, r = p < 0 ? -a : a, t = String(a).replace('.', ',');   // la mitad se aleja del 0 en ambos sentidos
  return (signo === false ? (r < 0 ? '−' : '') : r > 0 ? '+' : r < 0 ? '−' : '') + t + ' %';
}

/* ---------- Proyección y metas ---------- */
export const MIN_PCT = -90, MAX_PCT = 500;
/* Documento guardado (o null) → proyección con valores seguros. */
export function leerProyeccion(doc, anio) {
  const ok = f => finito(f) && f > 0 && f <= 10;
  const P = { anio: Number(anio), factor: 1, factorPrecio: 1, panes: {}, metas: Array(12).fill(null), existe: !!doc };
  if (!doc) return P;
  if (ok(doc.factor)) P.factor = doc.factor;
  if (ok(doc.factorPrecio)) P.factorPrecio = doc.factorPrecio;
  for (const k in doc.panes || {}) if (ok(doc.panes[k])) P.panes[k] = doc.panes[k];
  if (Array.isArray(doc.metas)) for (let i = 0; i < 12; i++) { const v = doc.metas[i]; if (Number.isInteger(v) && v >= 0) P.metas[i] = v; }
  return P;
}
export const factorDe = (P, productoId) => (P.panes && finito(P.panes[productoId]) ? P.panes[productoId] : P.factor);
/* Porcentaje escrito ('5', '+5', '-3', '−2,5', '') → { factor } (1,05) · { factor: null } si va vacío y se permite · { error } */
export function validarPct(texto, vacioOk) {
  let t = String(texto == null ? '' : texto).replace(/\s|%/g, '');
  if (!t) return vacioOk ? { factor: null } : { error: 'Escribe un porcentaje (0 si no cambia).' };
  let s = 1;
  if (/^[-−–]/.test(t)) { s = -1; t = t.slice(1); } else if (t[0] === '+') t = t.slice(1);
  const n = numero(t);
  if (Number.isNaN(n)) return { error: 'Escribe un porcentaje, por ejemplo 5 o −3.' };
  const p = s * n;
  if (p < MIN_PCT || p > MAX_PCT) return { error: 'Usa un porcentaje entre ' + MIN_PCT + ' y +' + MAX_PCT + '.' };
  return { factor: Math.round((1 + p / 100) * 10000) / 10000 };
}
/* 1,05 → '5' · 0,97 → '-3' (para volver a mostrarlo en un campo) */
export const pctCampo = f => (finito(f) ? String(Math.round((f - 1) * 10000) / 100).replace('.', ',') : '');
/* Un mes proyectado desde el mismo mes del año anterior (un resumenMes). null si la base no tiene datos o aún no termina. */
export function proyectarMes(base, P) {
  if (!hayDatos(base) || base.enCurso || !base.panes.length) return null;
  const panes = base.panes.map(p => {
    const f = factorDe(P, p.productoId);
    return { productoId: p.productoId, nombre: p.nombre, unidad: p.unidad, factor: f, cantidad: p.unidad === 'un' ? Math.round(p.cantidad * f) : kg2(p.cantidad * f), neto: redondearPesos(p.neto * f * P.factorPrecio) };
  });
  return { panes, neto: panes.reduce((t, p) => t + p.neto, 0), kg: kg2(panes.filter(p => p.unidad !== 'un').reduce((t, p) => t + p.cantidad, 0)), un: panes.filter(p => p.unidad === 'un').reduce((t, p) => t + p.cantidad, 0) };
}
/* Lo que se le pide a un mes: la meta fijada o, si no hay, la proyección. → { neto, tipo: 'meta' | 'proyeccion' } o null */
export function objetivo(P, mes, proy) {
  const i = Number(mes.slice(5)) - 1, m = P && P.metas ? P.metas[i] : null;
  if (Number.isInteger(m)) return { neto: m, tipo: 'meta' };
  return proy ? { neto: proy.neto, tipo: 'proyeccion' } : null;
}
/* Real contra lo pedido. Del mes en curso: cuánto falta, cuánto por día (contando hoy) y adónde llegaría a su ritmo. */
export function avance(R, obj, hoy) {
  if (!obj || !hayDatos(R) && !(R && R.enCurso)) return null;
  const real = R.neto || 0, r = { meta: obj.neto, tipo: obj.tipo, real, pct: obj.neto ? real / obj.neto * 100 : null, falta: Math.max(0, obj.neto - real) };
  if (R.enCurso) {
    const quedan = R.diasMes - Number(hoy.slice(8)) + 1;
    r.quedan = quedan; r.porDia = quedan > 0 ? Math.ceil(r.falta / quedan) : 0;
    r.ritmoPct = R.ritmo && obj.neto ? R.ritmo.neto / obj.neto * 100 : null;
  }
  return r;
}
/* Metas a partir de la proyección (los meses sin base quedan con la meta que tenían). */
export const metasDesde = (proys, antes) => proys.map((p, i) => (p ? p.neto : antes && Number.isInteger(antes[i]) ? antes[i] : null));
/* El año mes a mes: base (año anterior) y real (este año) son Map mes → resumenMes. */
export function tablaAnio(anio, base, real, P, hoy) {
  const ahora = V.mesDe(hoy), filas = [];
  for (let i = 1; i <= 12; i++) {
    const mes = anio + '-' + String(i).padStart(2, '0'), ant = base.get(V.sumarMeses(mes, -12)) || null, R = real.get(mes) || null;
    const estado = mes > ahora ? 'futuro' : mes === ahora ? 'en-curso' : 'pasado', proy = proyectarMes(ant, P), obj = objetivo(P, mes, proy);
    const conReal = estado !== 'futuro' && hayDatos(R);
    filas.push({ mes, estado, anterior: hayDatos(ant) ? ant : null, real: conReal ? R : null, cargando: [ant, R].some(x => x && (x.fuente === 'cargando')),
      proy, obj, pct: conReal && obj && obj.neto ? R.neto / obj.neto * 100 : null, varAnt: conReal && hayDatos(ant) && !R.enCurso ? variacion(R.neto, ant.neto) : null });
  }
  const suma = (l, f) => l.reduce((t, x) => t + f(x), 0), hechos = filas.filter(f => f.estado === 'pasado');
  const T = { anterior: suma(filas.filter(f => f.anterior), f => f.anterior.neto), real: suma(filas.filter(f => f.real), f => f.real.neto),
    objetivo: suma(filas.filter(f => f.obj), f => f.obj.neto), proy: suma(filas.filter(f => f.proy), f => f.proy.neto), metasFijadas: (P.metas || []).filter(m => Number.isInteger(m)).length };
  /* Acumulado de los meses ya terminados: real contra el año anterior y contra lo pedido, en los mismos meses. */
  const conAnt = hechos.filter(f => f.real && f.anterior), conObj = hechos.filter(f => f.real && f.obj);
  T.ac = { hasta: hechos.length ? hechos[hechos.length - 1].mes : '', real: suma(hechos.filter(f => f.real), f => f.real.neto),
    realVsAnt: suma(conAnt, f => f.real.neto), anterior: suma(conAnt, f => f.anterior.neto), realVsObj: suma(conObj, f => f.real.neto), objetivo: suma(conObj, f => f.obj.neto), meses: conAnt.length, mesesObj: conObj.length };
  T.ac.varAnt = conAnt.length ? variacion(T.ac.realVsAnt, T.ac.anterior) : null;
  T.ac.pctObj = conObj.length && T.ac.objetivo ? T.ac.realVsObj / T.ac.objetivo * 100 : null;
  return { anio, filas, T };
}
/* Documento para guardar (proyeccion/{AAAA}); `en` lo agrega nube.guardar. */
export function documentoProyeccion(P, o) {
  const panes = {};
  for (const k in P.panes || {}) if (finito(P.panes[k]) && P.panes[k] > 0 && P.panes[k] <= 10 && Object.keys(panes).length < 200) panes[k] = Math.round(P.panes[k] * 10000) / 10000;
  const metas = Array.from({ length: 12 }, (x, i) => (Number.isInteger(P.metas && P.metas[i]) && P.metas[i] >= 0 && P.metas[i] <= 1e11 ? P.metas[i] : null));
  return { anio: Number(P.anio), factor: Math.round(P.factor * 10000) / 10000, factorPrecio: Math.round(P.factorPrecio * 10000) / 10000, panes, metas, por: o.por, quien: String(o.quien || 'Sin nombre').slice(0, 60) || 'Sin nombre' };
}
/* Meta escrita a mano: '1.500.000' o '$1.500.000' → { neto } · '' → { neto: null } (quitarla) · { error } */
export function validarMeta(texto) {
  const t = String(texto == null ? '' : texto).replace(/[\s$]/g, '');
  if (!t) return { neto: null };
  const n = numero(t);
  if (Number.isNaN(n) || n < 0 || n > 1e11) return { error: 'Escribe la meta en pesos, por ejemplo 2.500.000.' };
  return { neto: Math.round(n) };
}
