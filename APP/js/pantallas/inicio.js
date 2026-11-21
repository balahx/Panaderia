/* Hoy (dueños y externo): lo pesado en un día, al momento. Totales, venta del día con el precio vigente de ESE día, por pan,
   entregas (cada una con sus canastos y su venta; se arman solas con los pesajes), por trabajador y anulados. Se puede mirar otro día.
   Tocar un canasto abre su ficha para corregirlo o anularlo (con constancia en la bitácora). «＋ Anotar canasto» agrega uno en el día
   que se mira (fecha pasada, Fase 5). Los montos salen de core/ventas.js: los mismos del Excel y de Entregas.
   Fase 10: el bloque «Plan del día» (pantallas/plan.js) compara lo pesado con el plan, al momento; hoy se arma o cambia, y se ve el de mañana.
   Fase 11: con varios clientes, el total del negocio y el filtro «Cliente» (pantallas/filtro-cliente.js). Con «Todos», la venta dice cuánto
   es de cada cliente y las entregas van agrupadas por cliente (cada uno con su numeración; las ventas sueltas, una por una). El plan del día
   cuenta siempre a todos los clientes. */
import { esc, fechaTexto, kilos } from '../core/formato.js';
import { emptyHTML, errorHTML, svg } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as V from '../core/ventas.js';
import * as canasto from './pesaje-hoja.js';
import * as anotar from './anotar.js';
import { cerradoEl, textoOrigen } from '../core/cierres.js';
import * as plan from './plan.js';
import * as FC from './filtro-cliente.js';

let sel = '';   // día elegido ('' = seguir el día de hoy, también pasada la medianoche)
export const fecha = c => (sel && sel <= c.hoy ? sel : c.hoy);
/* Al llegar con un botón «ir» que trae data-dia (desde Entregas, el Registro o «Más → Anotar en fecha pasada»). */
export function abrir(ds, c) { if (ds.dia && cat.esFecha(ds.dia)) sel = ds.dia >= c.hoy ? '' : ds.dia; }
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

function cabecera(c, f) {
  const esHoy = f === c.hoy;
  return '<span class="eyebrow" id="hoySaludo">' + (esHoy ? 'Hola, ' + esc((c.user.nombre || '').split(' ')[0]) + ' · ' : '') + esc(fechaTexto(f)) + '</span><h1>' + (esHoy ? 'Pesado hoy' : 'Pesado el ' + esc(fechaTexto(f))) + '</h1>' +
    '<div class="dia-nav" role="group" aria-label="Cambiar de día"><button class="btn ghost sm" data-act="hoy-dia" data-d="-1">‹ Anterior</button>' +
    '<label class="vh" for="hoyFecha">Ir a otro día</label><input class="txt" type="date" id="hoyFecha" max="' + c.hoy + '" value="' + f + '">' +
    (esHoy ? '' : '<button class="btn ghost sm" data-act="hoy-dia" data-d="0">Hoy</button>') +
    '<button class="btn ghost sm" data-act="hoy-dia" data-d="1"' + (esHoy ? ' disabled' : '') + '>Siguiente ›</button></div>';
}
/* Venta del día: líneas de venta (un pan en una entrega de un cliente) con el precio vigente ese día para ese cliente. null si no hay clientes. */
function venta(c, todos) {
  const k = c.cat; if (!(k.clientes || []).length) return null;
  const L = V.deCliente(V.lineas(todos, k.productos, k.precios, k.clientes, cat.ivaDe(c.negocio)), FC.elegido(c));
  return { cliente: FC.cliente(c) || (FC.varios(c) ? null : cat.clienteOriginal(k.clientes)), L, T: V.totales(L), panes: new Map(V.porPan(L).map(x => [x.productoId, x])),
    entregas: new Map(V.porEntrega(L).map(e => [e.clienteId + '|' + e.n, e])), clientes: V.porCliente(L, k.clientes), faltan: V.faltanPrecios(L) };
}
function montos(c, M) {
  const iva = cat.ivaDe(c.negocio);
  if (!M) return '<p class="note warn" id="hoyMontos">Para ver la venta del día falta el cliente y sus precios (Más → Catálogo).</p>';
  const porCli = !FC.elegido(c) && M.clientes.length > 1 ? '<div class="mlist" id="hoyPorCliente">' + M.clientes.map(g => kv(g.cliente || '—', cat.pesos(g.neto) + ' neto')).join('') + '</div>' : '';
  return '<section class="card sec" id="hoyMontos"><p class="eyebrow">Venta del día' + (M.cliente ? ' a ' + esc(M.cliente.nombre) : FC.varios(c) ? ' · todos los clientes' : '') + '</p>' +
    kv('Neto', cat.pesos(M.T.neto)) + kv('IVA (' + cat.enCampo(iva) + ' %)', cat.pesos(M.T.iva)) + kv('Total', cat.pesos(M.T.total), 'hoyTotal') + porCli +
    (M.faltan.length ? '<p class="warn-t" id="hoySinPrecio">Sin precio ese día (no suman): ' + esc(M.faltan.map(x => x.nombre).join(', ')) + '.</p>' : '') +
    '<p class="muted chico">Con el precio vigente de ese día' + (FC.varios(c) ? ' para cada cliente' : '') + '. Los canastos anulados no cuentan.</p></section>';
}
function porPan(c, R, M) {
  return '<section class="sec" id="hoyPorPan"><h2>Por pan</h2><div class="mlist">' + R.porPan.map(x => {
    const v = M && M.panes.get(x.productoId), conPrecio = v && !v.sinPrecio;
    return '<div class="mrow fija"><span class="mt"><b>' + esc(x.nombre) + '</b><small>' + plural(x.canastos, 'canasto', 'canastos') + '</small></span><span class="precio"><b>' +
      esc(P.textoCantidad(x.cantidad, x.unidad)) + '</b><small>' + (conPrecio ? esc(cat.pesos(v.neto)) + ' neto' : 'Sin precio') + '</small></span></div>';
  }).join('') + '</div></section>';
}
function tarjetaEntrega(c, f, e, M, o, varios) {
  const doc = f === c.hoy && c.dia ? P.diaDoc(c.dia, e.clienteId, o) : null, enCurso = f === c.hoy && c.dia ? P.entregaEnCurso(doc) : 0, v = M && M.entregas.get(e.clienteId + '|' + e.n);
  if (e.suelta) return '<div class="card entrega" data-cliente="' + esc(e.clienteId || '') + '" data-n="0"><div class="entrega-h"><b>' + esc(e.cliente || 'Ventas sueltas') + '</b><span class="badge">' + plural(e.canastos, 'venta', 'ventas') + '</span></div>' +
    '<p class="muted chico">' + esc(P.textoTotales(e)) + (v ? ' · ' + esc(cat.pesos(v.neto)) + ' neto' : '') + '</p><div class="mlist">' + e.items.map(p => canasto.filaCanasto(p, c, false, true)).join('') + '</div></div>';
  return '<div class="card entrega" data-cliente="' + esc(e.clienteId || '') + '" data-n="' + e.n + '"><div class="entrega-h"><b>Entrega n.º ' + e.n + (varios && e.cliente ? ' · ' + esc(e.cliente) : '') + '</b>' + (e.n === enCurso ? '<span class="badge warn">En curso</span>' : '<span class="badge ok">Cerrada</span>') + '</div>' +
    '<p class="muted chico">' + esc(e.desde + (e.hasta !== e.desde ? '–' + e.hasta : '')) + ' · ' + plural(e.canastos, 'canasto', 'canastos') + ' · ' + esc(P.textoTotales(e)) +
      (v ? ' · ' + esc(cat.pesos(v.neto)) + ' neto' : '') + '</p>' +
    e.porPan.map(x => kv(x.nombre, P.textoCantidad(x.cantidad, x.unidad))).join('') +
    '<details><summary>Ver ' + plural(e.canastos, 'canasto', 'canastos') + '</summary><div class="mlist">' + e.items.map(p => canasto.filaCanasto(p, c, false, true)).join('') + '</div></details></div>';
}
function entregas(c, f, R, todos, M) {
  const k = c.cat, o = FC.original(c), varios = FC.varios(c), sel = FC.elegido(c);
  /* Entrega en curso sin canastos todavía: la de cada cliente regular que se mira (con «Todos», los activos). */
  const regulares = sel ? [FC.cliente(c)].filter(x => x && !cat.esSuelta(x)) : cat.clientesActivos(k.clientes).filter(x => !cat.esSuelta(x));
  const nuevas = f !== c.hoy || !c.dia ? [] : (regulares.length ? regulares : [{ id: o, nombre: '' }]).map(x => ({ x, n: P.entregaEnCurso(P.diaDoc(c.dia, x.id, o)) }))
    .filter(y => !R.porEntrega.some(e => e.n === y.n && (e.clienteId || o) === (y.x.id || o)) && (y.n > 1 || R.porEntrega.some(e => (e.clienteId || o) === (y.x.id || o))));
  const nueva = nuevas.map((y, i) => '<p class="muted"' + (i ? '' : ' id="hoyEntregaNueva"') + '>Entrega n.º ' + y.n + (varios && y.x.nombre ? ' de ' + esc(y.x.nombre) : '') + ' en curso: todavía sin canastos.</p>').join('');
  let cuerpo = '';
  if (varios && !sel) {   // agrupadas por cliente
    const grupos = []; for (const e of R.porEntrega) { const g = grupos.find(x => x.id === e.clienteId); if (g) g.l.push(e); else grupos.push({ id: e.clienteId, nombre: e.cliente, l: [e] }); }
    cuerpo = grupos.map(g => '<h3 class="reg-dia hoy-cli" data-cliente="' + esc(g.id || '') + '">' + esc(g.nombre || '—') + '</h3>' + g.l.map(e => tarjetaEntrega(c, f, e, M, o, false)).join('')).join('');
  } else cuerpo = R.porEntrega.map(e => tarjetaEntrega(c, f, e, M, o, false)).join('');
  return '<section class="sec" id="hoyEntregas"><h2>Entregas</h2>' + cuerpo + nueva + '</section>' +
    (R.porTrabajador.length ? '<section class="sec" id="hoyPorTrabajador"><h2>Por trabajador</h2><div class="mlist pes-tot">' + R.porTrabajador.map(t => kv(t.nombre, plural(t.canastos, 'canasto', 'canastos') + ' · ' + P.textoTotales(t))).join('') + '</div></section>' : '') +
    (todos.some(p => p.anulado) ? '<section class="sec" id="hoyAnulados"><h2>Anulados</h2><div class="mlist">' + P.recientes(todos.filter(p => p.anulado)).map(p => canasto.filaCanasto(p, c, true)).join('') + '</div></section>' : '');
}

/* Un día de un mes cerrado (Fase 6) no se anota ni se corrige: en vez del botón, el aviso. */
const avisoCerrado = (f, c) => { const x = cerradoEl(c.cierres, f); return x ? '<p class="note" id="hoyCerrado">' + esc(cap(V.mesTexto(V.mesDe(f)))) + ' está cerrado (' + esc(textoOrigen(x)) + '): no se anota ni se corrige. Un dueño puede reabrirlo en Más → Cierres mensuales.</p>' : ''; };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const botonAnotar = (f, c, donde) => avisoCerrado(f, c) || '<div class="actions ' + donde + '"><button class="btn ghost" id="hoyAnotar" data-act="anotar" data-fecha="' + f + '"' + (FC.elegido(c) ? ' data-cliente="' + esc(FC.elegido(c)) + '"' : '') + '>' + svg('mas') + (f === c.hoy ? 'Anotar canasto' : 'Anotar canasto el ' + esc(fechaTexto(f).replace(/ \d{4}$/, ''))) + '</button></div>';

export function html(c) {
  const f = fecha(c), cab = cabecera(c, f), d = c.dia && c.dia.fecha === f ? c.dia : null;
  const err = c.errCat || (d && d.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  const k = c.cat;
  if (!k || !k.productos || !k.trabajadores || !k.precios || !k.clientes || !d || !d.pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const todos = FC.pesajes(c, d.pesajes), R = P.resumen(todos, k.productos, k.trabajadores, k.clientes), pend = todos.filter(p => p._pend).length;
  const filtro = FC.selector(c, 'hoyCliente');
  const avisoPend = pend ? '<p class="note warn" id="hoyPendientes">' + plural(pend, 'registro anotado en este equipo falta', 'registros anotados en este equipo faltan') + ' por enviar.</p>' : '';
  if (!todos.length) {
    return cab + filtro + emptyHTML('pesa', f === c.hoy ? 'Sin pesajes todavía' : 'Sin pesajes ese día', f === c.hoy ? 'Lo que se pese en la panadería aparece aquí al momento, sin recargar.' : 'Ese día no se registraron canastos. Si se vendió, anótalo aquí.') +
      (cat.activos(k.productos).length ? botonAnotar(f, c, 'centro') + plan.bloqueHoy(c, f, d) : '<div class="actions centro"><button class="btn" id="inicioCatalogo" data-act="ir" data-tab="catalogo">Abrir el catálogo</button></div>');
  }
  const M = venta(c, todos);
  return cab + filtro + avisoPend + botonAnotar(f, c, 'arriba') +
    '<div class="stats" id="hoyTotales"><div class="stat"><b>' + R.canastos + '</b><span>' + (R.canastos === 1 ? 'canasto' : 'canastos') + '</span></div>' +
    '<div class="stat"><b>' + esc(kilos(R.kg)) + '</b><span>kilos</span></div>' + (R.un ? '<div class="stat"><b>' + esc(P.textoCantidad(R.un, 'un').replace(' un', '')) + '</b><span>unidades</span></div>' : '') + '</div>' +
    plan.bloqueHoy(c, f, d) + (R.canastos ? montos(c, M) + porPan(c, R, M) : '') + entregas(c, f, R, todos, M);
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (canasto.alActuar(act, el, c) || anotar.alActuar(act, el, c) || plan.alActuar(act, el, c)) return true;
  if (act !== 'hoy-dia') return false;
  const n = Number(el.dataset.d), f = fecha(c);
  sel = n === 0 ? '' : P.sumarDias(f, n);
  if (sel >= c.hoy) sel = '';
  return 'repintar';
}
export function alEscribir(el, c) {
  if (FC.alEscribir(el)) return 'repintar';
  if (anotar.alEscribir(el, c)) return;
  if (plan.alEscribir(el, c)) return;
  if (el.id !== 'hoyFecha' || !cat.esFecha(el.value)) return;
  sel = el.value >= c.hoy ? '' : el.value;
  return 'repintar';
}
