/* Registro general (dueños y externo; PLAN §3.6), desde «Más»: todos los canastos de un período con filtros por pan, trabajador,
   entrega y estado, y la bitácora de correcciones (qué cambió, quién y cuándo). Tocar un canasto abre su ficha para corregirlo.
   Los datos llegan en vivo en ctx.per (app.js, vigilarPeriodo): pesajes y cambios con la fecha del canasto dentro del período. */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { emptyHTML, errorHTML } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as V from '../core/ventas.js';
import * as canasto from './pesaje-hoja.js';

const F = { desde: '', hasta: '', productoId: '', trabajadorId: '', entregaN: '', estado: 'vigentes', ver: 'canastos', limite: 100 };
const PASO = 100;
function rango(c) {
  const d = F.desde || V.rangoMes(V.mesDe(c.hoy)).desde, h = F.hasta || c.hoy, r = V.validarPeriodo(d, h, c.hoy);
  return r.error ? Object.assign(V.validarPeriodo(V.rangoMes(V.mesDe(c.hoy)).desde, c.hoy, c.hoy), { error: r.error }) : r;
}
export const periodo = c => { const r = rango(c); return { desde: r.desde, hasta: r.hasta, cambios: true }; };
const opcion = (v, t, sel) => '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(t) + '</option>';
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
const nombre = (l, id) => { const x = (l || []).find(y => y.id === id); return x ? x.nombre : '(sin nombre)'; };
const corto = f => V.diaSemana(f) + ' ' + fechaTexto(f).replace(/ \d{4}$/, '');
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const hora = ms => (typeof ms === 'number' ? new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)) : '');

function filtros(c, r, todos) {
  const k = c.cat, maxE = todos.reduce((m, p) => Math.max(m, p.entregaN || 1), 1), seg = (campo, v, t) => '<button data-act="reg-' + campo + '" data-v="' + v + '" aria-pressed="' + (F[campo] === v) + '">' + t + '</button>';
  return '<section class="card sec filtros" id="regFiltros"><div class="dos"><div><label class="lab" for="regDesde">Desde</label><input class="txt" type="date" id="regDesde" max="' + c.hoy + '" value="' + r.desde + '"></div>' +
    '<div><label class="lab" for="regHasta">Hasta</label><input class="txt" type="date" id="regHasta" max="' + c.hoy + '" value="' + r.hasta + '"></div></div>' +
    (r.error ? '<p class="form-error" role="alert">' + esc(r.error) + '</p>' : '') +
    (V.diasEntre(r.desde, r.hasta) > 62 ? '<p class="muted chico">Un período largo usa más lecturas de la cuota diaria gratuita.</p>' : '') +
    '<div class="dos"><div><label class="lab" for="regPan">Pan</label><select class="txt" id="regPan">' + opcion('', 'Todos') + cat.ordenarProductos(k.productos).map(p => opcion(p.id, p.nombre, F.productoId)).join('') + '</select></div>' +
    '<div><label class="lab" for="regQuien">Quién pesó</label><select class="txt" id="regQuien">' + opcion('', 'Todos') + cat.ordenarPersonas(k.trabajadores).map(p => opcion(p.id, p.nombre, F.trabajadorId)).join('') + '</select></div></div>' +
    '<label class="lab" for="regEntrega">Entrega</label><select class="txt" id="regEntrega">' + opcion('', 'Todas') + Array.from({ length: maxE }, (_, i) => opcion(i + 1, 'N.º ' + (i + 1), F.entregaN)).join('') + '</select>' +
    '<div class="seg seg-abajo" role="group" aria-label="Estado">' + seg('estado', 'vigentes', 'Vigentes') + seg('estado', 'anulados', 'Anulados') + seg('estado', 'todos', 'Todos') + '</div></section>';
}
function canastos(c, lista) {
  if (!lista.length) return emptyHTML('lista', 'Sin canastos con esos filtros', 'Cambia las fechas o los filtros.');
  const T = { kg: 0, un: 0 }; lista.filter(p => !p.anulado).forEach(p => { if (p.unidad === 'un') T.un += p.cantidad; else T.kg = Math.round((T.kg + p.cantidad) * 100) / 100; });
  const vis = lista.slice(0, F.limite), dias = [];
  vis.forEach(p => { if (!dias.length || dias[dias.length - 1].f !== p.fecha) dias.push({ f: p.fecha, l: [] }); dias[dias.length - 1].l.push(p); });
  return '<p class="muted" id="regResumen">' + plural(lista.length, 'canasto', 'canastos') + (F.estado === 'anulados' ? '' : ' · ' + esc(P.textoTotales(T))) + '</p>' +
    dias.map(d => '<h3 class="reg-dia">' + esc(cap(corto(d.f))) + '</h3><div class="mlist">' + d.l.map(p => canasto.filaCanasto(p, c, true)).join('') + '</div>').join('') +
    (lista.length > vis.length ? '<div class="actions centro"><button class="btn ghost" id="regMas" data-act="reg-mas">Mostrar ' + Math.min(PASO, lista.length - vis.length) + ' más (quedan ' + (lista.length - vis.length) + ')</button></div>' : '');
}
function bitacora(c, cambios, todos) {
  const k = c.cat, porId = new Map(todos.map(p => [p.id, p]));
  const l = (cambios || []).filter(x => { const p = porId.get(x.pesajeId); return (!F.productoId || (p && p.productoId === F.productoId) || (x.antes && x.antes.productoId === F.productoId) || (x.despues && x.despues.productoId === F.productoId))
    && (!F.trabajadorId || (p && p.trabajadorId === F.trabajadorId)); }).sort((a, b) => (b.en || 0) - (a.en || 0));
  if (!l.length) return emptyHTML('lista', 'Sin correcciones en el período', 'Cada corrección, anulación o reactivación de un canasto queda anotada aquí.');
  const miembro = uid => (c.miembros || []).find(m => m.id === uid);   // solo los dueños tienen la lista de miembros
  const quien = x => (x.por === c.user.uid ? 'Tú' : x.quien || (miembro(x.por) && miembro(x.por).nombre) || ((c.negocio && (c.negocio.duenos || []).includes(x.por)) ? 'Un dueño' : 'Otra cuenta'));
  return '<div class="mlist" id="regBitacora">' + l.map(x => {
    const p = porId.get(x.pesajeId), D = P.describirCambio(x, k.productos, k.trabajadores, p && p.unidad);
    const cuando = typeof x.en === 'number' ? fechaTexto(diaChile(new Date(x.en))).replace(/ \d{4}$/, '') + ' ' + hora(x.en) : '';
    return '<button class="mrow cambio" data-act="can-ver" data-id="' + esc(x.pesajeId) + '"' + (p ? '' : ' disabled') + '><span class="mt"><b>' + esc(D.titulo + ' · ' + (p ? nombre(k.productos, p.productoId) : 'canasto') + ' del ' + corto(x.fecha)) + '</b>' +
      (D.detalle ? '<small>' + esc(D.detalle) + '</small>' : '') + '<small>' + esc(quien(x) + (cuando ? ' · ' + cuando : '')) + '</small></span></button>';
  }).join('') + '</div>';
}

export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Registros</span><h1>Registro general</h1>';
  const per = c.per, k = c.cat, r = rango(c), err = c.errCat || (per && per.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!k || !k.productos || !k.trabajadores || !per || per.desde !== r.desde || per.hasta !== r.hasta || !per.pesajes || !per.cambios) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const todos = per.pesajes, lista = V.ordenRegistro(V.filtrar(todos, F)), nCambios = per.cambios.length;
  const ver = (v, t) => '<button data-act="reg-ver" data-v="' + v + '" aria-pressed="' + (F.ver === v) + '">' + t + '</button>';
  return cab + filtros(c, r, todos) +
    '<div class="seg" role="group" aria-label="Qué ver">' + ver('canastos', 'Canastos (' + lista.length + ')') + ver('bitacora', 'Correcciones (' + nCambios + ')') + '</div>' +
    '<section class="sec" id="regCuerpo" data-ver="' + F.ver + '">' + (F.ver === 'bitacora' ? bitacora(c, per.cambios, todos) : canastos(c, lista)) + '</section>';
}
export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (canasto.alActuar(act, el, c)) return true;
  if (act === 'reg-mas') { F.limite += PASO; return 'repintar'; }
  if (act === 'reg-estado') { F.estado = el.dataset.v; F.limite = PASO; return 'repintar'; }
  if (act === 'reg-ver') { F.ver = el.dataset.v === 'bitacora' ? 'bitacora' : 'canastos'; return 'repintar'; }
  return false;
}
const CAMPOS = { regPan: 'productoId', regQuien: 'trabajadorId', regEntrega: 'entregaN', regDesde: 'desde', regHasta: 'hasta' };
export function alEscribir(el) {
  const k = CAMPOS[el.id]; if (!k) return;
  F[k] = el.value; F.limite = PASO;
  return 'repintar';
}
