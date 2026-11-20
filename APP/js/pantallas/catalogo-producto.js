/* Catálogo · hojas de un producto: ficha con su precio, su costo y margen (Fase 9, pantallas/costos-receta.js) y el historial, formulario (nuevo o editar), precio con vigencia,
   orden en la lista y activar o desactivar. También las ayudas comunes de las hojas del catálogo (enviar, error, pieHoja).
   Un precio nuevo rige desde su fecha: los días anteriores conservan el precio que tenían (core/catalogo.js, precioVigente). */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { $, ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import { resumenFicha } from './costos-receta.js';

const hoy = () => diaChile(new Date());
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const por = p => (p.unidad === 'un' ? 'por unidad' : 'por kilo');
const conIva = (neto, c) => cat.pesos(Math.round(cat.conIva(neto, cat.ivaDe(c.negocio))));

/* Envía un cambio del catálogo. Exige conexión (igual que los accesos) y deja la hoja abierta hasta saber el resultado.
   o.abierta: no cierra la hoja al terminar (para subir o bajar varias veces seguidas). */
export function enviar(promesa, listo, boton, o) {
  if (navigator.onLine === false) { error('Sin conexión: el catálogo se cambia con internet.'); return; }
  if (boton) boton.disabled = true;
  promesa().then(() => { if (o && o.abierta) { if (boton) boton.disabled = false; } else cerrarHoja(); toast(listo); }, e => {
    if (boton) boton.disabled = false;
    error(String(e && e.code).includes('permission') ? 'Esta cuenta no puede cambiar el catálogo.' : 'No se pudo guardar. Inténtalo de nuevo.');
  });
}
/* Muestra un error en la hoja abierta (o como aviso breve si no hay dónde) y lleva el cursor al campo. */
export function error(msg, campo) {
  const e = $('#dlg[open] .form-error');
  if (!e) { toast(msg); return; }
  e.textContent = msg; e.hidden = !msg;
  const c = campo && $('#dlg [data-campo="' + campo + '"]'); if (c) c.focus();
}
export const pieHoja = (act, texto, extra) => '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="' + act + '"' + (extra || '') + '>' + esc(texto) + '</button>' +
  '<button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>';

/* ---------- Ficha del producto ---------- */
function hojaProducto(p, c) {
  const k = c.cat, cliente = cat.clientePrincipal(k.clientes), id = ' data-id="' + esc(p.id) + '"';
  const h = cliente ? cat.historial(k.precios, p.id, cliente.id) : [], vig = cliente ? cat.precioVigente(k.precios, p.id, cliente.id, hoy()) : null;
  const fut = cliente ? cat.precioFuturo(k.precios, p.id, cliente.id, hoy()) : null, activo = p.activo !== false;
  hoja(p.nombre, '<p class="muted">' + esc(cat.detalleProducto(p)) + (activo ? '' : ' · <b>Desactivado</b>') + '</p>' +
    (vig ? '<div class="precio-hoy" id="precioHoy"><b>' + esc(cat.pesos(vig.neto)) + '</b><span>neto ' + por(p) + ' · ' + esc(conIva(vig.neto, c)) + ' con IVA</span><small>Rige desde el ' + esc(fechaTexto(vig.desde)) + '</small></div>'
      : '<div class="note warn" id="precioHoy">' + (cliente ? 'Este producto no tiene precio para hoy.' : 'Para anotar precios primero crea el cliente (Catálogo → Cliente e IVA).') + '</div>') +
    (fut ? '<p class="muted chico" id="precioFuturo">Desde el ' + esc(fechaTexto(fut.desde)) + ' regirá ' + esc(cat.pesos(fut.neto)) + ' neto.</p>' : '') +
    resumenFicha(p, c) +
    '<p class="form-error" role="alert" hidden></p><div class="actions">' +
    (cliente ? '<button class="btn" data-act="cat-precio"' + id + '>' + (h.length ? 'Cambiar precio' : 'Poner precio') + '</button>' : '') +
    '<button class="btn ghost" data-act="cat-editar"' + id + '>Editar</button>' +
    (activo ? '<button class="btn ghost" data-act="cat-mover" data-dir="-1"' + id + '>Subir</button><button class="btn ghost" data-act="cat-mover" data-dir="1"' + id + '>Bajar</button>' : '') +
    '<button class="btn ghost" data-act="cat-activar"' + id + '>' + (activo ? 'Desactivar' : 'Volver a activar') + '</button></div>' +
    '<p class="muted chico">' + (activo ? '«Subir» y «Bajar» cambian su lugar en la lista. Desactivar no borra nada de lo ya registrado.' : 'Desactivado: no aparece para pesar. Lo ya registrado se conserva.') + '</p>' +
    (h.length ? '<p class="eyebrow">Historial de precios</p><div class="hist" id="historial">' + h.map(x => '<div class="hist-f"><div><b>' + esc(cat.pesos(x.neto)) + '</b><small>Desde el ' + esc(fechaTexto(x.desde)) +
      (vig && x.id === vig.id ? ' · vigente' : x.desde > hoy() ? ' · aún no rige' : '') + '</small></div><button class="btn sm ghost" data-act="cat-precio-quitar" data-id="' + esc(p.id) + '" data-pid="' + esc(x.id) + '" aria-label="Quitar el precio del ' + esc(fechaTexto(x.desde)) + '">Quitar</button></div>').join('') + '</div>' : ''));
}

/* ---------- Formulario: producto nuevo o editar ---------- */
function hojaForm(p, c) {
  const cats = [...new Set((c.cat.productos || []).map(x => x.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const un = p && p.unidad === 'un';
  hoja(p ? 'Editar ' + p.nombre : 'Agregar producto',
    '<label class="lab" for="pNombre">Nombre del pan</label><input class="txt" id="pNombre" data-campo="nombre" maxlength="60" autocomplete="off" data-enter="cat-guardar" value="' + esc(p ? p.nombre : '') + '">' +
    (p ? '<p class="lab">Se vende</p><p id="pUnidadFija">' + esc(cat.UNIDADES[p.unidad].t.toLowerCase()) + '. <span class="muted chico">No se puede cambiar: si hace falta, desactiva este producto y crea otro.</span></p>'
      : '<fieldset class="radios"><legend class="lab">Se vende</legend>' + Object.keys(cat.UNIDADES).map((u, i) => '<label class="radio"><input type="radio" name="pUnidad" data-campo="unidad" value="' + u + '"' + (i ? '' : ' checked') + '><span>' + esc(cat.UNIDADES[u].t) + '</span></label>').join('') + '</fieldset>') +
    '<div id="pPesoCaja"' + (un ? '' : ' hidden') + '><label class="lab" for="pPeso">Peso de referencia de cada unidad, en gramos (opcional)</label>' +
    '<input class="txt" id="pPeso" data-campo="pesoRef" inputmode="decimal" maxlength="8" autocomplete="off" data-enter="cat-guardar" value="' + esc(un && p.pesoRef ? cat.enCampo(p.pesoRef) : '') + '"></div>' +
    '<label class="lab" for="pCategoria">Categoría (opcional)</label><input class="txt" id="pCategoria" maxlength="40" autocomplete="off" list="pCategorias" data-enter="cat-guardar" value="' + esc(p && p.categoria ? p.categoria : '') + '">' +
    '<datalist id="pCategorias">' + cats.map(x => '<option value="' + esc(x) + '"></option>').join('') + '</datalist>' +
    pieHoja('cat-guardar', p ? 'Guardar' : 'Agregar', p ? ' data-id="' + esc(p.id) + '"' : ''));
  $('#pNombre').focus();
}
function guardarProducto(p, c, el) {
  const marcada = $('#dlg input[name="pUnidad"]:checked'), todos = c.cat.productos || [];
  const v = cat.validarProducto({ nombre: $('#pNombre').value, unidad: p ? p.unidad : marcada ? marcada.value : '', pesoRef: $('#pPeso').value, categoria: $('#pCategoria').value,
    orden: p ? p.orden : cat.siguienteOrden(todos), activo: p ? p.activo : true }, cat.activos(todos).filter(x => !p || x.id !== p.id));
  if (v.error) { error(v.error, v.campo); return; }
  enviar(() => nube.guardar('productos/' + (p ? p.id : cat.nuevoId()), v.datos), p ? 'Producto guardado' : v.datos.nombre + ' quedó en el catálogo', el);
}

/* ---------- Precio con vigencia ---------- */
function hojaPrecio(p, c) {
  const cliente = cat.clientePrincipal(c.cat.clientes), vig = cat.precioVigente(c.cat.precios, p.id, cliente.id, hoy());
  hoja('Precio de ' + p.nombre, '<label class="lab" for="prNeto">Precio neto ' + por(p) + ', sin IVA</label>' +
    '<input class="txt" id="prNeto" data-campo="neto" inputmode="decimal" maxlength="14" autocomplete="off" data-enter="cat-precio-guardar" value="' + esc(vig ? cat.enCampo(vig.neto) : '') + '">' +
    '<p class="muted" id="prConIva" aria-live="polite">' + esc(textoConIva(vig ? cat.enCampo(vig.neto) : '', c)) + '</p>' +
    '<label class="lab" for="prDesde">Rige desde</label><input class="txt" type="date" id="prDesde" data-campo="desde" data-enter="cat-precio-guardar" value="' + hoy() + '">' +
    '<p class="muted chico">Los días anteriores a esa fecha conservan el precio que tenían. Para ' + esc(cliente.nombre) + '.</p>' +
    pieHoja('cat-precio-guardar', 'Guardar precio', ' data-id="' + esc(p.id) + '"'));
  $('#prNeto').focus();
}
function textoConIva(texto, c) {
  const n = cat.numero(texto), iva = cat.ivaDe(c.negocio);
  return 'Con IVA (' + cat.enCampo(iva) + ' %): ' + (Number.isNaN(n) || n <= 0 ? '—' : conIva(n, c));
}
function guardarPrecio(p, c, el) {
  const cliente = cat.clientePrincipal(c.cat.clientes), v = cat.validarPrecio({ neto: $('#prNeto').value, desde: $('#prDesde').value });
  if (v.error) { error(v.error, v.campo); return; }
  const d = v.datos, guardar = () => enviar(() => nube.guardar('precios/' + cat.idPrecio(p.id, cliente.id, d.desde), { productoId: p.id, clienteId: cliente.id, neto: d.neto, desde: d.desde }),
    p.nombre + ': ' + cat.pesos(d.neto) + ' desde el ' + fechaTexto(d.desde), el);
  if (d.desde >= hoy()) { guardar(); return; }
  ask({ title: '¿Precio desde una fecha pasada?', text: 'Regirá desde el ' + fechaTexto(d.desde) + ': cambia los montos de ese día en adelante. Los días anteriores no cambian.', ok: 'Guardar precio' })
    .then(si => { if (si) guardar(); });
}
function quitarPrecio(p, c, el) {
  const cliente = cat.clientePrincipal(c.cat.clientes), h = cat.historial(c.cat.precios, p.id, cliente.id), i = h.findIndex(x => x.id === el.dataset.pid);
  if (i < 0) return;
  const x = h[i], previo = h[i + 1];
  ask({ title: '¿Quitar el precio del ' + fechaTexto(x.desde) + '?', text: 'Desde esa fecha ' + (previo ? 'volverá a regir el anterior (' + cat.pesos(previo.neto) + ').' : 'el producto quedará sin precio.') + ' Los días anteriores no cambian.', ok: 'Quitar', danger: true })
    .then(si => { if (si) enviar(() => nube.borrar('precios/' + x.id), 'Precio quitado', el); });
}

export function alActuar(act, el, c) {
  const k = c.cat, p = buscar(k.productos, el.dataset.id);
  if (act === 'cat-nuevo') hojaForm(null, c);
  else if (act === 'cat-guardar') guardarProducto(p || null, c, el);
  else if (!['cat-prod', 'cat-editar', 'cat-precio', 'cat-precio-guardar', 'cat-precio-quitar', 'cat-mover', 'cat-activar'].includes(act)) return false;
  else if (!p) cerrarHoja();
  else if (act === 'cat-prod') hojaProducto(p, c);
  else if (act === 'cat-editar') hojaForm(p, c);
  else if (act === 'cat-activar') {
    const activo = p.activo === false;
    enviar(() => nube.guardar('productos/' + p.id, Object.assign(cat.soloProducto(p), { activo }, activo ? { orden: cat.siguienteOrden(k.productos) } : {})), p.nombre + (activo ? ' vuelve al catálogo' : ' quedó desactivado'), el);
  } else if (act === 'cat-mover') {
    const cambios = cat.mover(k.productos, p.id, Number(el.dataset.dir));
    if (!cambios.length) { toast(Number(el.dataset.dir) < 0 ? 'Ya es el primero de la lista' : 'Ya es el último de la lista'); return true; }
    enviar(() => nube.guardarVarios(cambios.map(x => ({ ruta: 'productos/' + x.id, datos: cat.soloProducto(x) }))), p.nombre + (Number(el.dataset.dir) < 0 ? ' subió un lugar' : ' bajó un lugar'), el, { abierta: true });
  } else if (!cat.clientePrincipal(k.clientes)) error('Primero crea el cliente (Catálogo → Cliente e IVA).');
  else if (act === 'cat-precio') hojaPrecio(p, c);
  else if (act === 'cat-precio-guardar') guardarPrecio(p, c, el);
  else if (act === 'cat-precio-quitar') quitarPrecio(p, c, el);
  return true;
}
/* Mientras se escribe: el precio con IVA al lado del neto, y el peso de referencia solo para lo que se vende por unidad. */
export function alEscribir(el, c) {
  if (el.id === 'prNeto') { const s = $('#prConIva'); if (s) s.textContent = textoConIva(el.value, c); }
  else if (el.name === 'pUnidad') { const caja = $('#pPesoCaja'); if (caja) caja.hidden = el.value !== 'un'; }
}
