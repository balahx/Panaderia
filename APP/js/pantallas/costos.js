/* Costos y margen (dueños y externo; cuelga de «Más», PLAN Fase 9). Dos partes:
     Insumos  harina, margarina, sal… con el precio neto de factura (formato de compra + precio, con fecha de vigencia)
     El mes   venta, ingredientes y margen por pan, gastos del mes y resultado (pantallas/costos-mes.js)
   Las recetas y el simulador de precio se abren desde la ficha de cada pan (pantallas/costos-receta.js), también desde aquí.
   Los datos llegan en vivo en ctx.cat (insumos, preciosInsumo, recetas) y ctx.gastos (app.js). Las reglas deciden qué se guarda. */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { emptyHTML, errorHTML, svg } from '../core/iconos.js';
import { $, ask, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as K from '../core/costos.js';
import { puede } from '../core/perfil.js';
import * as producto from './catalogo-producto.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';
import * as mesV from './costos-mes.js';
import * as receta from './costos-receta.js';

let sub = 'insumos';
const hoy = () => diaChile(new Date());
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const U = u => K.UNIDADES[u] || K.UNIDADES.kg;
export const periodo = c => (sub === 'mes' ? mesV.periodo(c) : null);
/* Desde otra pantalla: data-sub elige la parte; data-mes, el mes. */
export function abrir(ds, c) { if (ds.sub === 'mes' || ds.sub === 'insumos') sub = ds.sub; if (ds.mes) mesV.abrir(ds, c); }

/* ---------- Insumos ---------- */
const precioTexto = (pr, u) => cat.pesos(Math.round(K.porUnidad(pr) * 100) / 100) + ' / ' + U(u).c;
const formatoTexto = (pr, u) => K.textoCantidad(pr.formato, u) + ' a ' + cat.pesos(pr.neto) + ' neto';
function filaInsumo(i, c) {
  const pr = K.precioVigente(c.cat.preciosInsumo, i.id, hoy());
  return '<button class="mrow" data-act="cos-ins" data-id="' + esc(i.id) + '"><span class="mt"><b>' + esc(i.nombre) + '</b><small>' + esc(U(i.unidad).t + (pr ? ' · ' + formatoTexto(pr, i.unidad) : '')) + '</small></span>' +
    (i.activo === false ? '' : pr ? '<span class="precio"><b>' + esc(precioTexto(pr, i.unidad)) + '</b><small>desde el ' + esc(fechaTexto(pr.desde)) + '</small></span>' : '<span class="badge warn">Sin precio</span>') + svg('chev', 'go') + '</button>';
}
function listaInsumos(c) {
  const todos = K.ordenarInsumos(c.cat.insumos), act = K.activos(todos), des = todos.filter(i => i.activo === false);
  return '<div class="actions arriba"><button class="btn" data-act="cos-ins-nuevo">Agregar insumo</button></div>' +
    (act.length ? '<div class="mlist" id="listaInsumos">' + act.map(i => filaInsumo(i, c)).join('') + '</div>' +
      '<p class="muted chico">Precios netos de factura, sin IVA. Las recetas se anotan en la ficha de cada pan (Catálogo) o desde «El mes».</p>'
      : emptyHTML('calc', 'Sin insumos', 'Agrega lo que lleva el pan: harina, margarina, sal, azúcar, levadura… con el precio de la factura.')) +
    (des.length ? '<section class="sec" id="insDesactivados"><p class="eyebrow">Desactivados</p><div class="mlist">' + des.map(i => filaInsumo(i, c)).join('') + '</div></section>' : '');
}
/* Ficha de un insumo: precio vigente, en qué recetas está, historial de precios. */
function hojaInsumo(i, c) {
  const k = c.cat, h = K.historial(k.preciosInsumo, i.id), vig = K.precioVigente(k.preciosInsumo, i.id, hoy()), id = ' data-id="' + esc(i.id) + '"';
  const usan = (k.productos || []).filter(p => { const r = K.recetaVigente(k.recetas, p.id, hoy()); return r && r.items.some(x => x.insumoId === i.id); }).map(p => p.nombre);
  hoja(i.nombre, '<p class="muted">' + esc(U(i.unidad).t) + (i.activo === false ? ' · <b>Desactivado</b>' : '') + '</p>' +
    (vig ? '<div class="precio-hoy" id="insPrecioHoy"><b>' + esc(precioTexto(vig, i.unidad)) + '</b><span>' + esc(formatoTexto(vig, i.unidad)) + '</span><small>Rige desde el ' + esc(fechaTexto(vig.desde)) + '</small></div>'
      : '<div class="note warn" id="insPrecioHoy">Sin precio para hoy: las recetas que lo llevan no tienen costo.</div>') +
    '<p class="muted chico" id="insUsan">' + (usan.length ? 'Lo llevan: ' + esc(usan.join(', ')) + '.' : 'Todavía no está en ninguna receta vigente.') + '</p>' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="cos-ins-precio"' + id + '>' + (h.length ? 'Cambiar precio' : 'Poner precio') + '</button>' +
    '<button class="btn ghost" data-act="cos-ins-editar"' + id + '>Cambiar nombre</button>' +
    '<button class="btn ghost" data-act="cos-ins-activar"' + id + '>' + (i.activo === false ? 'Volver a activar' : 'Desactivar') + '</button></div>' +
    (h.length ? '<p class="eyebrow">Historial de precios</p><div class="hist" id="insHistorial">' + h.map(x => '<div class="hist-f"><div><b>' + esc(precioTexto(x, i.unidad)) + '</b><small>' + esc(formatoTexto(x, i.unidad)) + ' · desde el ' + esc(fechaTexto(x.desde)) +
      (vig && x.id === vig.id ? ' · vigente' : x.desde > hoy() ? ' · aún no rige' : '') + '</small></div><button class="btn sm ghost" data-act="cos-ins-quitar"' + id + ' data-pid="' + esc(x.id) + '" aria-label="Quitar el precio del ' + esc(fechaTexto(x.desde)) + '">Quitar</button></div>').join('') + '</div>' : ''));
}
const camposPrecio = (u, vig, primero) => '<label class="lab" for="ipFormato">Cada compra trae (en ' + esc(U(u).t.toLowerCase()) + ')</label>' +
  '<input class="txt" id="ipFormato" data-campo="formato" inputmode="decimal" maxlength="10" autocomplete="off" data-enter="cos-guardar" value="' + esc(vig ? cat.enCampo(vig.formato) : '') + '" placeholder="' + (u === 'kg' ? '25' : u === 'l' ? '5' : '30') + '">' +
  '<label class="lab" for="ipNeto">Precio neto de factura, sin IVA</label><input class="txt" id="ipNeto" data-campo="neto" inputmode="decimal" maxlength="14" autocomplete="off" data-enter="cos-guardar" value="' + esc(vig ? cat.enCampo(vig.neto) : '') + '">' +
  '<p class="muted" id="ipPorUnidad" aria-live="polite">' + esc(textoPorUnidad(vig ? cat.enCampo(vig.formato) : '', vig ? cat.enCampo(vig.neto) : '', u)) + '</p>' +
  '<label class="lab" for="ipDesde">Rige desde</label><input class="txt" type="date" id="ipDesde" data-campo="desde" data-enter="cos-guardar" value="' + (primero ? K.INICIO : hoy()) + '">' +
  (primero ? '<p class="muted chico" id="ipPrimero">Es el primer precio: por omisión rige desde el ' + esc(fechaTexto(K.INICIO)) + ', así los meses anteriores también tienen costo.</p>' : '');
function textoPorUnidad(formato, neto, u) {
  const f = cat.numero(formato), n = cat.numero(neto);
  return 'Por ' + U(u).p + ': ' + (Number.isNaN(f) || Number.isNaN(n) || f <= 0 || n < 0 ? '—' : cat.pesos(Math.round(n / f * 100) / 100));
}
/* Formulario de un insumo nuevo (con su primer precio, opcional) o de su nombre. */
function hojaFormInsumo(i) {
  hoja(i ? 'Nombre de ' + i.nombre : 'Agregar insumo', '<label class="lab" for="iNombre">Nombre</label><input class="txt" id="iNombre" data-campo="nombre" maxlength="60" autocomplete="off" data-enter="cos-guardar" value="' + esc(i ? i.nombre : '') + '">' +
    (i ? '<p class="muted chico" id="iUnidadFija">Se mide en ' + esc(U(i.unidad).t.toLowerCase()) + '. No se puede cambiar: si hace falta, desactívalo y crea otro.</p>'
      : '<fieldset class="radios"><legend class="lab">Se mide en</legend>' + Object.keys(K.UNIDADES).map((u, n) => '<label class="radio"><input type="radio" name="iUnidad" data-campo="unidad" value="' + u + '"' + (n ? '' : ' checked') + '><span>' + esc(K.UNIDADES[u].t) + '</span></label>').join('') + '</fieldset>' +
        '<p class="eyebrow">Precio (opcional)</p><div id="iPrecio">' + camposPrecio('kg', null, true) + '</div><p class="muted chico">Si lo dejas en blanco, el precio se pone después en la ficha del insumo.</p>') +
    pieHoja('cos-guardar', i ? 'Guardar' : 'Agregar', (i ? ' data-id="' + esc(i.id) + '"' : '') + ' data-que="insumo"'));
  $('#iNombre').focus();
}
function guardarInsumo(i, c, el) {
  const k = c.cat, marcada = $('#dlg input[name="iUnidad"]:checked');
  const v = K.validarInsumo({ nombre: $('#iNombre').value, unidad: i ? i.unidad : marcada ? marcada.value : '', activo: i ? i.activo : true }, K.activos(k.insumos).filter(x => !i || x.id !== i.id));
  if (v.error) { error(v.error, v.campo); return; }
  if (i) { enviar(() => nube.guardar('insumos/' + i.id, v.datos), 'Nombre guardado', el); return; }
  const id = cat.nuevoId(), lote = [{ ruta: 'insumos/' + id, datos: v.datos }], f = $('#ipFormato').value.trim(), n = $('#ipNeto').value.trim();
  if (f || n) {
    const p = K.validarPrecio({ formato: f, neto: n, desde: $('#ipDesde').value });
    if (p.error) { error(p.error, p.campo); return; }
    lote.push({ ruta: 'preciosInsumo/' + K.idPrecio(id, p.datos.desde), datos: Object.assign({ insumoId: id }, p.datos) });
  }
  enviar(() => nube.guardarVarios(lote), v.datos.nombre + ' quedó en los insumos', el);
}
function hojaPrecio(i, c) {
  const h = K.historial(c.cat.preciosInsumo, i.id);
  hoja('Precio de ' + i.nombre, camposPrecio(i.unidad, K.precioVigente(c.cat.preciosInsumo, i.id, hoy()) || h[0] || null, !h.length) +
    '<p class="muted chico">Desde esa fecha cambia el costo de las recetas que lo llevan; los días anteriores conservan el suyo.</p>' + pieHoja('cos-guardar', 'Guardar precio', ' data-id="' + esc(i.id) + '" data-que="precio"'));
  $('#ipNeto').focus();
}
function guardarPrecio(i, c, el) {
  const v = K.validarPrecio({ formato: $('#ipFormato').value, neto: $('#ipNeto').value, desde: $('#ipDesde').value });
  if (v.error) { error(v.error, v.campo); return; }
  const d = v.datos, guardar = () => enviar(() => nube.guardar('preciosInsumo/' + K.idPrecio(i.id, d.desde), Object.assign({ insumoId: i.id }, d)), i.nombre + ': ' + precioTexto(d, i.unidad) + ' desde el ' + fechaTexto(d.desde), el);
  if (d.desde >= hoy() || !K.historial(c.cat.preciosInsumo, i.id).length) { guardar(); return; }   // el primer precio no cambia nada anterior
  ask({ title: '¿Precio desde una fecha pasada?', text: 'Regirá desde el ' + fechaTexto(d.desde) + ': cambia el costo de los panes que lo llevan desde ese día. Los días anteriores no cambian.', ok: 'Guardar precio' }).then(si => { if (si) guardar(); });
}
function quitarPrecio(i, c, el) {
  const h = K.historial(c.cat.preciosInsumo, i.id), n = h.findIndex(x => x.id === el.dataset.pid);
  if (n < 0) return;
  const x = h[n], previo = h[n + 1];
  ask({ title: '¿Quitar el precio del ' + fechaTexto(x.desde) + '?', text: 'Desde esa fecha ' + (previo ? 'volverá a regir el anterior (' + precioTexto(previo, i.unidad) + ').' : 'el insumo quedará sin precio.') + ' Los días anteriores no cambian.', ok: 'Quitar', danger: true })
    .then(si => { if (si) enviar(() => nube.borrar('preciosInsumo/' + x.id), 'Precio quitado', el); });
}

export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Costos y margen</span><h1>' + (sub === 'mes' ? 'Resultado del mes' : 'Insumos') + '</h1>' +
    '<div class="seg" role="group" aria-label="Partes de costos"><button data-act="cos-sub" data-sub="insumos" aria-pressed="' + (sub === 'insumos') + '">Insumos</button>' +
    '<button data-act="cos-sub" data-sub="mes" aria-pressed="' + (sub === 'mes') + '">El mes</button></div>';
  if (c.errCat) return cab + errorHTML('No se pudieron leer los datos (' + c.errCat + ').', { retry: 'recargar' });
  const k = c.cat;
  if (!k || !k.productos || !k.insumos || !k.preciosInsumo || !k.recetas) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  return cab + '<div id="cosCuerpo" data-sub="' + sub + '">' + (sub === 'mes' ? mesV.html(c) : listaInsumos(c)) + '</div>';
}
export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (receta.alActuar(act, el, c)) return true;
  if (act.startsWith('cat-') && c.cat && c.cat.productos && producto.alActuar(act, el, c)) return true;   // «Ficha del pan» desde una receta
  if (mesV.alActuar(act, el, c)) return act.startsWith('cos-mes') ? 'repintar' : true;
  if (!act.startsWith('cos-')) return false;
  if (!puede(c.perfil, 'gestion') || !c.cat) return true;
  if (act === 'cos-sub') { sub = el.dataset.sub === 'mes' ? 'mes' : 'insumos'; return 'repintar'; }
  const i = buscar(c.cat.insumos, el.dataset.id);
  if (act === 'cos-ins-nuevo') hojaFormInsumo(null);
  else if (act === 'cos-guardar' && el.dataset.que === 'insumo') guardarInsumo(i || null, c, el);
  else if (!i) return true;
  else if (act === 'cos-ins') hojaInsumo(i, c);
  else if (act === 'cos-ins-editar') hojaFormInsumo(i);
  else if (act === 'cos-ins-precio') hojaPrecio(i, c);
  else if (act === 'cos-guardar' && el.dataset.que === 'precio') guardarPrecio(i, c, el);
  else if (act === 'cos-ins-quitar') quitarPrecio(i, c, el);
  else if (act === 'cos-ins-activar') enviar(() => nube.guardar('insumos/' + i.id, Object.assign(K.soloInsumo(i), { activo: i.activo === false })), i.nombre + (i.activo === false ? ' vuelve a los insumos' : ' quedó desactivado'), el);
  return true;
}
/* Mientras se escribe: el precio por kilo, litro o unidad; la unidad del insumo nuevo; la receta y el simulador. */
export function alEscribir(el, c) {
  if (receta.alEscribir(el, c)) return;
  if (el.id === 'prNeto' || el.name === 'pUnidad') { producto.alEscribir(el, c); return; }
  const r = mesV.alEscribir(el, c); if (r === 'repintar') return r; if (r) return;
  if (el.name === 'iUnidad') { const caja = $('#iPrecio'); if (caja) { const f = $('#ipFormato').value, n = $('#ipNeto').value; caja.innerHTML = camposPrecio(el.value, null, true); $('#ipFormato').value = f; $('#ipNeto').value = n; } }
  if (el.id === 'ipFormato' || el.id === 'ipNeto') {
    const i = buscar(c.cat && c.cat.insumos, ($('#dlg [data-act="cos-guardar"]') || {}).dataset && $('#dlg [data-act="cos-guardar"]').dataset.id), m = $('#dlg input[name="iUnidad"]:checked');
    const s = $('#ipPorUnidad'); if (s) s.textContent = textoPorUnidad($('#ipFormato').value, $('#ipNeto').value, i ? i.unidad : m ? m.value : 'kg');
  }
}
