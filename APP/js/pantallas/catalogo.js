/* Catálogo (dueños y externo; cuelga de «Más»): productos con su precio, trabajadores, cliente e IVA.
   Las listas llegan en ctx.cat (app.js las escucha en vivo). Aquí van las listas y las hojas de trabajadores, cliente e IVA;
   las hojas de producto y de precios están en catalogo-producto.js. Las reglas de Firestore deciden qué se guarda. */
import { esc, diaChile } from '../core/formato.js';
import { svg, emptyHTML, errorHTML } from '../core/iconos.js';
import { $, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import { puede } from '../core/perfil.js';
import * as producto from './catalogo-producto.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';

const SUBS = [['productos', 'Productos'], ['trabajadores', 'Trabajadores'], ['negocio', 'Cliente e IVA']];
let sub = 'productos';
const hoy = () => diaChile(new Date());
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const pct = iva => cat.enCampo(iva) + ' %';

/* ---------- Listas ---------- */
function filaProducto(p, c, cliente) {
  const pr = cliente ? cat.precioVigente(c.cat.precios, p.id, cliente.id, hoy()) : null;
  return '<button class="mrow prod" data-act="cat-prod" data-id="' + esc(p.id) + '"><span class="mt"><b>' + esc(p.nombre) + '</b><small>' + esc(cat.detalleProducto(p)) + '</small></span>' +
    (p.activo === false ? '' : pr ? '<span class="precio"><b>' + esc(cat.pesos(pr.neto)) + '</b><small>' + esc(cat.pesos(Math.round(cat.conIva(pr.neto, cat.ivaDe(c.negocio))))) + ' con IVA</small></span>'
      : '<span class="badge warn">Sin precio</span>') + svg('chev', 'go') + '</button>';
}
function listaProductos(c) {
  const todos = cat.ordenarProductos(c.cat.productos), act = cat.activos(todos), des = todos.filter(p => p.activo === false), cliente = cat.clientePrincipal(c.cat.clientes);
  return (cliente ? '' : '<div class="note warn" id="faltaCliente">Para anotar precios falta el cliente al que se le vende. <button class="lnk" data-act="cat-sub" data-sub="negocio">Crear el cliente</button></div>') +
    '<div class="actions arriba"><button class="btn" data-act="cat-nuevo">Agregar producto</button></div>' +
    (act.length ? '<div class="mlist" id="listaProductos">' + act.map(p => filaProducto(p, c, cliente)).join('') + '</div>' +
      '<p class="muted chico">Precios netos, por kilo o por unidad. La app les suma el IVA (' + esc(pct(cat.ivaDe(c.negocio))) + ').</p>'
      : emptyHTML('pan', 'Sin productos', 'Agrega los tipos de pan que se entregan: marraqueta, hallulla…')) +
    (des.length ? '<section class="sec" id="prodDesactivados"><p class="eyebrow">Desactivados</p><div class="mlist">' + des.map(p => filaProducto(p, c, cliente)).join('') + '</div></section>' : '');
}
const filaPersona = t => '<button class="mrow" data-act="cat-trab" data-id="' + esc(t.id) + '"><span class="mt"><b>' + esc(t.nombre) + '</b></span>' + svg('chev', 'go') + '</button>';
function listaTrabajadores(c) {
  const todos = cat.ordenarPersonas(c.cat.trabajadores), act = cat.activos(todos), des = todos.filter(t => t.activo === false);
  return '<div class="actions arriba"><button class="btn" data-act="cat-trab-nuevo">Agregar trabajador</button></div>' +
    (act.length ? '<div class="mlist" id="listaTrabajadores">' + act.map(filaPersona).join('') + '</div><p class="muted chico">Son los nombres que aparecerán en la pantalla de pesaje.</p>'
      : emptyHTML('team', 'Sin trabajadores', 'Agrega a quienes pesan el pan en la panadería.')) +
    (des.length ? '<section class="sec" id="trabDesactivados"><p class="eyebrow">Desactivados</p><div class="mlist">' + des.map(filaPersona).join('') + '</div></section>' : '');
}
function negocio(c) {
  const cliente = cat.clientePrincipal(c.cat.clientes), dueno = puede(c.perfil, 'accesos');
  return '<section class="card sec" id="tarjetaCliente"><p class="eyebrow">Cliente</p>' + (cliente
    ? '<div class="kv"><span>Se le vende a</span><b>' + esc(cliente.nombre) + '</b></div><div class="actions"><button class="btn ghost" data-act="cat-cliente">Cambiar nombre</button></div>'
    : '<p>Todavía no está anotado el cliente al que se le entrega el pan.</p><div class="actions"><button class="btn" data-act="cat-cliente">Crear el cliente</button></div>') + '</section>' +
    '<section class="card sec" id="tarjetaIva"><p class="eyebrow">IVA</p><div class="kv"><span>Se suma a los precios netos</span><b id="ivaActual">' + esc(pct(cat.ivaDe(c.negocio))) + '</b></div>' +
    (dueno ? '<div class="actions"><button class="btn ghost" data-act="cat-iva">Cambiar</button></div>' : '<p class="muted chico">Solo los dueños cambian el IVA.</p>') + '</section>';
}
export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Catálogo</span><h1>Productos y precios</h1>' +
    '<div class="seg" role="group" aria-label="Partes del catálogo">' + SUBS.map(s => '<button data-act="cat-sub" data-sub="' + s[0] + '" aria-pressed="' + (s[0] === sub) + '">' + s[1] + '</button>').join('') + '</div>';
  if (c.errCat) return cab + errorHTML('No se pudo leer el catálogo (' + c.errCat + ').', { retry: 'recargar' });
  const k = c.cat;
  if (!k || !k.productos || !k.trabajadores || !k.precios || !k.clientes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  return cab + '<div id="catCuerpo" data-sub="' + sub + '">' + (sub === 'trabajadores' ? listaTrabajadores(c) : sub === 'negocio' ? negocio(c) : listaProductos(c)) + '</div>';
}

/* ---------- Hojas: trabajador, cliente e IVA ---------- */
const campoNombre = (id, valor, enter, etiqueta) => '<label class="lab" for="' + id + '">' + etiqueta + '</label><input class="txt" id="' + id + '" data-campo="nombre" maxlength="60" autocomplete="off" data-enter="' + enter + '" value="' + esc(valor) + '">';
function hojaTrabajador(t) {
  hoja(t ? t.nombre : 'Agregar trabajador', campoNombre('tNombre', t ? t.nombre : '', 'cat-trab-guardar', 'Nombre') +
    pieHoja('cat-trab-guardar', 'Guardar', t ? ' data-id="' + esc(t.id) + '"' : '') +
    (t ? '<div class="actions"><button class="btn ghost" data-act="cat-trab-activar" data-id="' + esc(t.id) + '">' + (t.activo === false ? 'Volver a activar' : 'Desactivar') + '</button></div>' +
      '<p class="muted chico">' + (t.activo === false ? 'Está desactivado: no aparece en la pantalla de pesaje.' : 'Desactivar no borra lo que ya pesó; solo deja de aparecer para elegir.') + '</p>' : ''));
  $('#tNombre').focus();
}
function hojaCliente(cl) {
  hoja(cl ? 'Cliente' : 'Crear el cliente', campoNombre('cNombre', cl ? cl.nombre : cat.CLIENTE_INICIAL, 'cat-cliente-guardar', 'Nombre del cliente') +
    '<p class="muted chico">Es a quien se le entrega y se le cobra el pan. Los precios quedan anotados para este cliente.</p>' + pieHoja('cat-cliente-guardar', 'Guardar'));
  $('#cNombre').focus();
}
function hojaIva(c) {
  hoja('IVA', '<label class="lab" for="ivaNuevo">Porcentaje de IVA</label><input class="txt" id="ivaNuevo" data-campo="iva" inputmode="decimal" maxlength="6" autocomplete="off" data-enter="cat-iva-guardar" value="' + esc(cat.enCampo(cat.ivaDe(c.negocio))) + '">' +
    '<p class="muted chico">Se aplica a todos los montos que la app calcula con los precios netos.</p>' + pieHoja('cat-iva-guardar', 'Guardar'));
  $('#ivaNuevo').focus();
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (!act.startsWith('cat-')) return false;
  if (!puede(c.perfil, 'gestion') || !c.cat) return true;
  if (act === 'cat-sub') { sub = SUBS.some(s => s[0] === el.dataset.sub) ? el.dataset.sub : 'productos'; $('#view').innerHTML = html(c); return true; }
  if (producto.alActuar(act, el, c)) return true;
  const id = el.dataset.id, k = c.cat;
  if (act === 'cat-trab-nuevo') hojaTrabajador(null);
  else if (act === 'cat-trab') { const t = buscar(k.trabajadores, id); if (t) hojaTrabajador(t); }
  else if (act === 'cat-trab-guardar') {
    const t = buscar(k.trabajadores, id), v = cat.validarNombre($('#tNombre').value, (k.trabajadores || []).filter(x => x.id !== id), 'un trabajador');
    if (v.error) { error(v.error, 'nombre'); return true; }
    enviar(() => nube.guardar('trabajadores/' + (t ? t.id : cat.nuevoId()), { nombre: v.nombre, activo: t ? t.activo !== false : true }), t ? 'Nombre guardado' : v.nombre + ' quedó en la lista', el);
  } else if (act === 'cat-trab-activar') {
    const t = buscar(k.trabajadores, id); if (!t) return true;
    const activo = t.activo === false;
    enviar(() => nube.guardar('trabajadores/' + t.id, { nombre: t.nombre, activo }), t.nombre + (activo ? ' vuelve a estar en la lista' : ' ya no aparece para elegir'), el);
  } else if (act === 'cat-cliente') hojaCliente(cat.clientePrincipal(k.clientes));
  else if (act === 'cat-cliente-guardar') {
    const cl = cat.clientePrincipal(k.clientes), v = cat.validarNombre($('#cNombre').value);
    if (v.error) { error(v.error, 'nombre'); return true; }
    enviar(() => nube.guardar('clientes/' + (cl ? cl.id : cat.nuevoId()), { nombre: v.nombre, activo: true }), cl ? 'Nombre del cliente guardado' : 'Cliente creado: ' + v.nombre, el);
  } else if (act === 'cat-iva' && puede(c.perfil, 'accesos')) hojaIva(c);
  else if (act === 'cat-iva-guardar' && puede(c.perfil, 'accesos')) {
    const v = cat.validarIva($('#ivaNuevo').value);
    if (v.error) { error(v.error, 'iva'); return true; }
    enviar(() => nube.ajustarNegocio({ iva: v.iva }), 'IVA: ' + pct(v.iva), el);
  }
  return true;
}
/* Mientras se escribe en una hoja del catálogo (vista previa del precio con IVA, peso de referencia según la unidad). */
export const alEscribir = (el, c) => producto.alEscribir(el, c);
