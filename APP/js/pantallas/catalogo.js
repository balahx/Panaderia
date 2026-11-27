/* Catálogo (dueños y externo; cuelga de «Más»): productos con su precio, trabajadores, clientes e IVA.
   Las listas llegan en ctx.cat (app.js las escucha en vivo). Aquí van las listas y las hojas de trabajadores, clientes e IVA;
   las hojas de producto y de precios están en catalogo-producto.js. Las reglas de Firestore deciden qué se guarda.
   Fase 11: «Clientes e IVA» con la lista de clientes (crear, cambiar nombre, desactivar o reactivar, copiar los precios de otro) y el
   cliente fijo «Ventas sueltas» (se activa con un botón). Con varios clientes, Productos muestra los precios del cliente que se elija.
   Fase 12: la ficha de cada cliente regular suma «Por cobrar» y sus datos de cobro (pantallas/cliente-cobro.js). */
import { esc, diaChile, fechaTexto } from '../core/formato.js';
import { svg, emptyHTML, errorHTML } from '../core/iconos.js';
import { $, ask, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import { puede } from '../core/perfil.js';
import * as producto from './catalogo-producto.js';
import * as receta from './costos-receta.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';
import * as clienteCobro from './cliente-cobro.js';

const SUBS = [['productos', 'Productos'], ['trabajadores', 'Trabajadores'], ['negocio', 'Clientes e IVA']];
let sub = 'productos', lista = '';   // lista: cliente cuyos precios muestra Productos ('' = el principal)
export const clienteLista = c => cat.clientesActivos(c.cat.clientes).find(x => x.id === lista) || cat.clientePrincipal(c.cat.clientes) || cat.clientesActivos(c.cat.clientes)[0] || null;
const hoy = () => diaChile(new Date());
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const pct = iva => cat.enCampo(iva) + ' %';

/* ---------- Listas ---------- */
function filaProducto(p, c, cliente) {
  const pr = cliente ? cat.precioVigente(c.cat.precios, p.id, cliente.id, hoy()) : null;
  return '<button class="mrow prod" data-act="cat-prod" data-id="' + esc(p.id) + '"' + (cliente ? ' data-cli="' + esc(cliente.id) + '"' : '') + '><span class="mt"><b>' + esc(p.nombre) + '</b><small>' + esc(cat.detalleProducto(p)) + '</small></span>' +
    (p.activo === false ? '' : pr ? '<span class="precio"><b>' + esc(cat.pesos(pr.neto)) + '</b><small>' + esc(cat.pesos(Math.round(cat.conIva(pr.neto, cat.ivaDe(c.negocio))))) + ' con IVA</small></span>'
      : '<span class="badge warn">Sin precio</span>') + svg('chev', 'go') + '</button>';
}
function listaProductos(c) {
  const todos = cat.ordenarProductos(c.cat.productos), act = cat.activos(todos), des = todos.filter(p => p.activo === false), cliente = clienteLista(c), clis = cat.clientesActivos(c.cat.clientes);
  return (cliente ? '' : '<p class="note warn" id="faltaCliente">Para anotar precios falta el cliente al que se le vende. <button class="lnk" data-act="cat-sub" data-sub="negocio">Crear el cliente</button></p>') +
    (clis.length > 1 ? '<label class="lab" for="catLista">Precios de</label><select class="txt" id="catLista">' + clis.map(x => '<option value="' + esc(x.id) + '"' + (cliente && x.id === cliente.id ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') + '</select>' : '') +
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
const filaCliente = (x, o) => '<button class="mrow" data-act="cat-cli" data-id="' + esc(x.id) + '"><span class="mt"><b>' + esc(x.nombre) + '</b><small>' +
  esc(cat.esSuelta(x) ? 'Ventas esporádicas, con quién compró' : o && x.id === o.id ? 'Cliente original' : 'Cliente regular') + '</small></span>' + svg('chev', 'go') + '</button>';
function negocio(c) {
  const k = c.cat, todos = cat.ordenarClientes(k.clientes), act = todos.filter(x => x.activo !== false), des = todos.filter(x => x.activo === false), o = cat.clienteOriginal(k.clientes);
  const suelto = cat.clienteSuelto(k.clientes), dueno = puede(c.perfil, 'accesos');
  return '<section class="card sec" id="tarjetaCliente"><p class="eyebrow">Clientes</p>' + (todos.length
    ? '<div class="mlist" id="listaClientes">' + act.map(x => filaCliente(x, o)).join('') + '</div>' +
      '<p class="muted chico">Cada cliente tiene su propia lista de precios. Con más de un cliente, en la panadería se elige «Para:» antes de pesar.</p>' +
      '<div class="actions"><button class="btn" data-act="cat-cli-nuevo">Agregar cliente</button>' +
      (!suelto ? '<button class="btn ghost" data-act="cat-sueltas">Activar ventas sueltas</button>' : '') + '</div>' +
      (des.length ? '<p class="eyebrow">Desactivados</p><div class="mlist" id="clientesDesactivados">' + des.map(x => filaCliente(x, o)).join('') + '</div>' : '')
    : '<p>Todavía no está anotado el cliente al que se le entrega el pan.</p><div class="actions"><button class="btn" data-act="cat-cli-nuevo">Crear el cliente</button></div>') + '</section>' +
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
/* Cliente: nuevo (con «copiar precios de») o uno que ya existe (nombre, activar o desactivar, copiar precios). */
function opcionesCopiar(c, menos) {
  const l = cat.clientesActivos(c.cat.clientes).filter(x => x.id !== menos);
  return '<option value="">No copiar (los anoto después)</option>' + l.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nombre) + '</option>').join('');
}
function hojaCliente(cl, c) {
  const k = c.cat, primero = !(k.clientes || []).length, suelta = cat.esSuelta(cl), hay = cat.clientesActivos(k.clientes).filter(x => !cl || x.id !== cl.id).length;
  const copiar = hay ? '<label class="lab" for="cCopiar">Copiar los precios de</label><select class="txt" id="cCopiar">' + opcionesCopiar(c, cl && cl.id) + '</select>' +
    '<label class="lab" for="cDesde">Rigen desde</label><input class="txt" type="date" id="cDesde" value="' + hoy() + '">' +
    '<p class="muted chico">Se copian los precios de hoy de ese cliente, uno por pan. Después se ajusta cada uno en la ficha del pan.</p>' : '';
  if (!cl) {
    hoja(primero ? 'Crear el cliente' : 'Agregar cliente', campoNombre('cNombre', primero ? cat.CLIENTE_INICIAL : '', 'cat-cliente-guardar', 'Nombre del cliente') +
      '<p class="muted chico">' + (primero ? 'Es a quien se le entrega y se le cobra el pan. Los precios quedan anotados para este cliente.' : 'Por ejemplo un almacén, otro supermercado o un casino. Tendrá su propia lista de precios y sus propias entregas.') + '</p>' +
      copiar + pieHoja('cat-cliente-guardar', primero ? 'Guardar' : 'Agregar'));
    $('#cNombre').focus(); return;
  }
  const o = cat.clienteOriginal(k.clientes), n = (k.precios || []).filter(x => x.clienteId === cl.id).length;
  hoja(cl.nombre, campoNombre('cNombre', cl.nombre, 'cat-cliente-guardar', 'Nombre del cliente') +
    '<p class="muted chico">' + esc(suelta ? 'Ventas sueltas: cada canasto es una venta, con la nota de quién compró. No tiene entregas.' : o && o.id === cl.id ? 'Cliente original: lo pesado antes de que hubiera varios clientes es suyo.' : 'Cliente regular, con sus propias entregas.') +
    ' ' + n + (n === 1 ? ' precio anotado.' : ' precios anotados.') + '</p>' +
    pieHoja('cat-cliente-guardar', 'Guardar nombre', ' data-id="' + esc(cl.id) + '"') + clienteCobro.bloque(cl, c) +
    (cl.activo !== false && hay ? '<details class="sec" id="cCopiarCaja"><summary>Copiar precios de otro cliente</summary>' + copiar +
      '<div class="actions"><button class="btn ghost" data-act="cat-cli-copiar" data-id="' + esc(cl.id) + '">Copiar precios</button></div></details>' : '') +
    '<div class="actions"><button class="btn ghost" data-act="cat-cli-activar" data-id="' + esc(cl.id) + '">' + (cl.activo === false ? 'Volver a activar' : 'Desactivar') + '</button></div>' +
    '<p class="muted chico">' + (cl.activo === false ? 'Está desactivado: no aparece para elegir. Lo ya vendido se conserva.' : 'Desactivar no borra nada de lo ya vendido; solo deja de aparecer para elegir.') + '</p>');
  $('#cNombre').focus();
}
/* Precios copiados (core/catalogo.js, copiarPrecios), listos para guardar junto con el cliente. Pide confirmar si pisa precios ya anotados. */
function preciosCopiados(c, aId) {
  const de = $('#cCopiar') ? $('#cCopiar').value : '', desde = $('#cDesde') ? $('#cDesde').value : hoy();
  if (!de) return { lista: [] };
  if (!cat.esFecha(desde)) return { error: 'Elige desde qué fecha rigen los precios.' };
  const lista = cat.copiarPrecios(c.cat.precios, c.cat.productos, de, aId, hoy(), desde);
  if (!lista.length) return { error: 'Ese cliente no tiene precios para hoy: no hay nada que copiar.' };
  return { lista, de: cat.nombreCliente(c.cat.clientes, de), desde, pisa: lista.filter(x => (c.cat.precios || []).some(p => p.id === x.id)).length };
}
function hojaIva(c) {
  hoja('IVA', '<label class="lab" for="ivaNuevo">Porcentaje de IVA</label><input class="txt" id="ivaNuevo" data-campo="iva" inputmode="decimal" maxlength="6" autocomplete="off" data-enter="cat-iva-guardar" value="' + esc(cat.enCampo(cat.ivaDe(c.negocio))) + '">' +
    '<p class="muted chico">Se aplica a todos los montos que la app calcula con los precios netos.</p>' + pieHoja('cat-iva-guardar', 'Guardar'));
  $('#ivaNuevo').focus();
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (receta.alActuar(act, el, c)) return true;   // receta y simulador desde la ficha del pan (Fase 9)
  if (puede(c.perfil, 'gestion') && c.cat && clienteCobro.alActuar(act, el, c)) return true;   // datos de cobro del cliente (Fase 12)
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
  } else if (act === 'cat-cliente' || act === 'cat-cli-nuevo') hojaCliente(null, c);
  else if (act === 'cat-cli') { const cl = buscar(k.clientes, id); if (cl) hojaCliente(cl, c); }
  else if (act === 'cat-cliente-guardar') {
    const cl = buscar(k.clientes, id), v = cat.validarNombre($('#cNombre').value, (k.clientes || []).filter(x => !cl || x.id !== cl.id), 'un cliente');
    if (v.error) { error(v.error, 'nombre'); return true; }
    if (cl) { enviar(() => nube.guardar('clientes/' + cl.id, Object.assign(cat.soloCliente(cl), { nombre: v.nombre })), 'Nombre del cliente guardado', el); return true; }
    const nid = cat.nuevoId(), P = preciosCopiados(c, nid), primero = !(k.clientes || []).length;
    if (P.error) { error(P.error); return true; }
    const datos = primero ? { nombre: v.nombre, activo: true } : { nombre: v.nombre, activo: true, tipo: 'regular' };
    enviar(() => nube.guardarVarios([{ ruta: 'clientes/' + nid, datos }].concat(P.lista.map(x => ({ ruta: 'precios/' + x.id, datos: x.datos })))),
      'Cliente creado: ' + v.nombre + (P.lista.length ? ' · ' + P.lista.length + (P.lista.length === 1 ? ' precio copiado' : ' precios copiados') + ' de ' + P.de : ''), el);
  } else if (act === 'cat-cli-copiar') {
    const cl = buscar(k.clientes, id); if (!cl) return true;
    const P = preciosCopiados(c, cl.id);
    if (P.error || !P.lista.length) { error(P.error || 'Elige de qué cliente copiar.'); return true; }
    const seguir = () => enviar(() => nube.guardarVarios(P.lista.map(x => ({ ruta: 'precios/' + x.id, datos: x.datos }))), P.lista.length + (P.lista.length === 1 ? ' precio copiado' : ' precios copiados') + ' de ' + P.de + ' a ' + cl.nombre, el);
    if (!P.pisa && P.desde >= hoy()) { seguir(); return true; }
    ask({ title: '¿Copiar ' + P.lista.length + ' precios a ' + cl.nombre + '?', text: (P.pisa ? P.pisa + (P.pisa === 1 ? ' precio de ese mismo día se reemplaza. ' : ' precios de ese mismo día se reemplazan. ') : '') +
      (P.desde < hoy() ? 'Rigen desde una fecha pasada: cambian los montos desde el ' + fechaTexto(P.desde) + '. ' : '') + 'Los días anteriores no cambian.', ok: 'Copiar' }).then(si => { if (si) seguir(); });
  } else if (act === 'cat-cli-activar') {
    const cl = buscar(k.clientes, id); if (!cl) return true;
    const activo = cl.activo === false;
    if (!activo && !cat.esSuelta(cl) && cat.clientesActivos(k.clientes).filter(x => !cat.esSuelta(x) && x.id !== cl.id).length === 0) { error('Debe quedar al menos un cliente regular activo.'); return true; }
    enviar(() => nube.guardar('clientes/' + cl.id, Object.assign(cat.soloCliente(cl), { activo })), cl.nombre + (activo ? ' vuelve a estar en la lista' : ' ya no aparece para elegir'), el);
  } else if (act === 'cat-sueltas') {
    const ya = cat.clienteSuelto(k.clientes);
    if (ya) { hojaCliente(ya, c); return true; }
    enviar(() => nube.guardar('clientes/' + cat.nuevoId(), { nombre: cat.NOMBRE_SUELTAS, activo: true, tipo: 'suelta' }), 'Ventas sueltas activadas: ponles precios en la ficha de cada pan', el);
  } else if (act === 'cat-iva' && puede(c.perfil, 'accesos')) hojaIva(c);
  else if (act === 'cat-iva-guardar' && puede(c.perfil, 'accesos')) {
    const v = cat.validarIva($('#ivaNuevo').value);
    if (v.error) { error(v.error, 'iva'); return true; }
    enviar(() => nube.ajustarNegocio({ iva: v.iva }), 'IVA: ' + pct(v.iva), el);
  }
  return true;
}
/* Mientras se escribe en una hoja del catálogo (vista previa del precio con IVA, peso de referencia según la unidad). */
export const alEscribir = (el, c) => {
  if (el.id === 'catLista') { lista = el.value; return 'repintar'; }   // precios de otro cliente (Fase 11)
  if (!receta.alEscribir(el, c)) producto.alEscribir(el, c);
};
