/* Hojas de las cotizaciones (Fase 12): nueva (para quién, precios desde la lista de un cliente y ajustables pan por pan, cantidad estimada
   por semana o por mes, descuento, validez), ver (estado, PDF, «Copiar como nueva») y «Crear cliente con estos precios» (el cliente regular,
   sus datos de cobro y su lista de precios, en un solo lote; la cotización queda Aceptada y enlazada). Emitir necesita internet (folio). */
import { esc, fechaTexto } from '../core/formato.js';
import { $, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as CB from '../core/cobros.js';
import * as Q from '../core/cotizaciones.js';
import * as D from '../core/pdf-doc.js';
import { error } from './catalogo-producto.js';
import { hoyCl, opcionesCliente, campo, valor, campoDescuento, leerDescuento, botonesPdf, pdf, enviar, quien, motivo } from './cobros-comun.js';

const S = { base: '', por: 'semana', panes: [], para: {}, desc: null, dias: '15' };
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const PARA = [['nombre', 'Nombre (obligatorio)', 60], ['contacto', 'Contacto (nombre, teléfono o correo)', 100], ['razonSocial', 'Razón social (opcional)', 100], ['rut', 'RUT (opcional)', 12], ['direccion', 'Dirección (opcional)', 150]];

/* Panes de partida: los activos con el precio de hoy del cliente base. `copia`: los de una cotización anterior. */
function panesBase(c, copia) {
  return Q.preciosBase(c.cat.productos, c.cat.precios, S.base, c.hoy).map(p => {
    const x = copia && copia.find(e => e.productoId === p.productoId);
    return { productoId: p.productoId, nombre: p.nombre, unidad: p.unidad, incluir: copia ? !!x : p.neto != null, neto: x ? cat.enCampo(x.neto) : p.neto != null ? cat.enCampo(p.neto) : '', cantidad: x && x.cantidad != null ? cat.enCampo(x.cantidad) : '' };
  });
}
function panesHTML() {
  return S.panes.map(p => '<div class="qz-pan" data-id="' + esc(p.productoId) + '"><label class="check" for="qz-i-' + esc(p.productoId) + '"><input type="checkbox" id="qz-i-' + esc(p.productoId) + '"' + (p.incluir ? ' checked' : '') + '><span>' + esc(p.nombre) + '</span></label>' +
    '<div class="dos"><div>' + campo('qz-n-' + p.productoId, 'Precio neto ' + (p.unidad === 'un' ? 'c/u' : 'el kg'), p.neto, { modo: 'decimal', max: 12 }) + '</div><div>' + campo('qz-c-' + p.productoId, 'Cantidad ' + (p.unidad === 'un' ? '(un)' : '(kg)') + ' por ' + S.por, p.cantidad, { modo: 'decimal', max: 10 }) + '</div></div></div>').join('');
}
function leer() {
  S.para = Object.fromEntries(PARA.map(x => [x[0], valor('qz-' + x[0])]));
  S.panes.forEach(p => { const i = $('#qz-i-' + p.productoId); if (!i) return; p.incluir = i.checked; p.neto = valor('qz-n-' + p.productoId); p.cantidad = valor('qz-c-' + p.productoId); });
  const d = leerDescuento('qz'); S.desc = d.tipo ? d : null; S.dias = valor('qzDias');
}
/* Lo armado: { para, lineas, totales, dias } o { error } */
function armado(c) {
  const P = Q.validarPara(S.para); if (P.error) return P;
  const L = Q.lineasDe(S.panes.filter(p => p.incluir).map(p => ({ productoId: p.productoId, neto: p.neto, cantidad: p.cantidad })), c.cat.productos, cat.ivaDe(c.negocio)); if (L.error) return L;
  const Dd = CB.validarDescuento(S.desc || { tipo: '' }); if (Dd.error) return Dd;
  const V = Q.validarValidez(S.dias); if (V.error) return V;
  const T = Q.totales(L.lineas, Dd.descuento, cat.ivaDe(c.negocio)); if (T.error) return T;
  return { para: P.para, lineas: L.lineas, totales: T, dias: V.dias };
}
function previa(c) {
  const box = $('#qzPrevia'); if (!box) return;
  const X = armado(c);
  if (X.error) { box.innerHTML = '<p class="muted chico">' + esc(X.error) + '</p>'; return; }
  const T = X.totales;
  box.innerHTML = '<p class="eyebrow">Vista previa</p>' + X.lineas.map(l => kv(l.nombre, cat.pesos(l.conIva) + (l.unidad === 'un' ? ' c/u' : ' el kg') + ' con IVA')).join('') +
    (T.total != null ? (T.descuento ? kv(T.descuento.texto, '-' + cat.pesos(T.descuento.conIva)) : '') + kv('Total estimado por ' + S.por, cat.pesos(T.total), 'qzTotal') : '<p class="muted chico">Sin cantidades: la cotización muestra solo los precios con IVA.</p>') +
    '<p class="muted chico">Válida hasta el ' + esc(fechaTexto(Q.validaHasta(c.hoy, X.dias))) + '.</p>';
}
export function nueva(c, copia) {
  const base = copia ? copia.baseClienteId : '', principal = cat.clientePrincipal(c.cat.clientes);
  S.base = base && c.cat.clientes.some(x => x.id === base) ? base : principal ? principal.id : ''; S.por = copia ? copia.cantidadesPor : 'semana';
  S.para = copia ? copia.para : {}; S.desc = copia ? copia.descuento : null; S.dias = '15'; S.panes = panesBase(c, copia && copia.elegidos);
  pintarNueva(c);
}
function pintarNueva(c) {
  const seg = (v, t) => '<button data-act="qz-por" data-v="' + v + '" aria-pressed="' + (S.por === v) + '">' + t + '</button>';
  hoja('Nueva cotización', '<p class="eyebrow">Para</p>' + PARA.map(x => campo('qz-' + x[0], x[1], S.para[x[0]] || '', { max: x[2], campo: x[0] })).join('') +
    '<p class="eyebrow">Precios</p><label class="lab" for="qzBase">Partir de los precios de</label><select class="txt" id="qzBase">' + opcionesCliente(c, S.base) + '</select>' +
    '<div class="seg" role="group" aria-label="Cantidades estimadas por">' + seg('semana', 'Cantidades por semana') + seg('mes', 'Por mes') + '</div>' +
    '<div id="qzPanes">' + panesHTML() + '</div><p class="muted chico">Precios netos: el documento los muestra con IVA. La cantidad es opcional: si hay, sale un total estimado.</p>' +
    campoDescuento('qz', S.desc) + campo('qzDias', 'Válida por (días)', S.dias, { modo: 'numeric', max: 3 }) +
    '<div id="qzPrevia" aria-live="polite"></div><p class="form-error" role="alert" hidden></p>' +
    '<div class="actions"><button class="btn" data-act="qz-emitir">Emitir cotización</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  previa(c);
}
export function ver(c, n) {
  const q = (c.cotizaciones || []).find(x => x.numero === Number(n)); if (!q) return;
  const est = (v, t) => (q.estado === v ? '' : '<button class="btn ghost" data-act="qz-estado" data-v="' + v + '" data-n="' + q.numero + '">' + t + '</button>');
  hoja('Cotización N.º ' + CB.numeroTexto(q.numero), '<div id="qzFicha" data-n="' + q.numero + '"><p><span class="badge' + (Q.vencida(q, c.hoy) ? ' warn' : q.estado === 'aceptada' ? ' ok' : '') + '">' + esc(Q.etiqueta(q, c.hoy)) + '</span></p>' +
    kv('Para', q.para.nombre) + (q.para.contacto ? kv('Contacto', q.para.contacto) : '') + kv('Fecha', fechaTexto(q.fecha) + ' · ' + q.quien) + kv('Válida hasta', fechaTexto(q.validaHasta)) +
    q.lineas.map(l => kv(l.nombre, cat.pesos(l.conIva) + (l.cantidad != null ? ' · ' + cat.enCampo(l.cantidad) + (l.unidad === 'un' ? ' un' : ' kg') : ''))).join('') +
    (q.total != null ? kv('Total estimado por ' + q.cantidadesPor, cat.pesos(q.total)) : '') + (q.clienteId ? kv('Cliente creado', cat.nombreCliente(c.cat.clientes, q.clienteId)) : '') +
    botonesPdf('qz-pdf', ' data-n="' + q.numero + '"') + '<p class="form-error" role="alert" hidden></p><div class="actions">' +
    (q.clienteId ? '' : '<button class="btn ghost" data-act="qz-cliente" data-n="' + q.numero + '">Crear cliente con estos precios</button>' + est('aceptada', 'Marcar aceptada') + est('rechazada', 'Marcar rechazada') + est('enviada', 'Volver a «Enviada»')) +
    '<button class="btn ghost" data-act="qz-copiar" data-n="' + q.numero + '">Copiar como nueva</button></div></div>');
}
function hojaCliente(c, q) {
  hoja('Crear cliente: ' + q.para.nombre, '<p class="muted">Se crea el cliente regular «' + esc(q.para.nombre) + '» con sus datos de cobro y su lista de precios: ' + q.lineas.length + (q.lineas.length === 1 ? ' pan' : ' panes') + ' con los precios netos de la cotización. La cotización queda Aceptada.</p>' +
    campo('qzDesde', 'Los precios rigen desde', hoyCl(), { tipo: 'date' }) + '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="qz-cliente-ok" data-n="' + q.numero + '">Crear cliente</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
}
export function alActuar(act, el, c) {
  if (!act.startsWith('qz-')) return false;
  const q = (c.cotizaciones || []).find(x => x.numero === Number(el.dataset.n));
  if (act === 'qz-por') { leer(); S.por = el.dataset.v === 'mes' ? 'mes' : 'semana'; pintarNueva(c); }
  else if (act === 'qz-emitir') {
    leer(); const X = armado(c);
    if (X.error) { error(X.error, X.campo); return true; }
    if (!CB.empresaLista(c.empresa)) { error('Faltan la razón social y el RUT de la panadería (Más → Cobros → Datos para documentos).'); return true; }
    if (navigator.onLine === false) { error('Emitir una cotización necesita internet: el número no puede repetirse entre equipos.'); return true; }
    el.disabled = true;
    nube.conFolio('cotizacion', 'cotizaciones', n => ({ datos: Q.documento({ numero: n, para: X.para, baseClienteId: S.base, cantidadesPor: S.por, lineas: X.lineas, totales: X.totales, iva: cat.ivaDe(c.negocio), fecha: hoyCl(), dias: X.dias, emisor: CB.emisorFijo(c.empresa), por: c.user.uid, quien: quien(c) }) }))
      .then(n => { cerrarHoja(); toast('Cotización N.º ' + CB.numeroTexto(n) + ' emitida'); }, e => { el.disabled = false; error(/unavailable|offline/i.test(String(e && (e.code || e.message))) ? 'Emitir una cotización necesita internet: el número no puede repetirse entre equipos.' : motivo(e)); });
  } else if (act === 'qz-pdf' && q) pdf(el.dataset.modo, Q.nombreArchivo(q), () => D.cotizacion(q));
  else if (act === 'qz-estado' && q) enviar(() => nube.cambiar('cotizaciones/' + CB.numeroTexto(q.numero), { estado: el.dataset.v, cambio: { por: c.user.uid, quien: quien(c), en: nube.ahora() } }), 'Cotización: ' + Q.ESTADOS[el.dataset.v], el);
  else if (act === 'qz-copiar' && q) nueva(c, Q.copiar(q));
  else if (act === 'qz-cliente' && q) hojaCliente(c, q);
  else if (act === 'qz-cliente-ok' && q) {
    if (c.cat.clientes.some(x => cat.limpiar(x.nombre).toLocaleLowerCase('es') === q.para.nombre.toLocaleLowerCase('es'))) { error('Ya hay un cliente con ese nombre: cámbiale el nombre en Catálogo o copia la cotización con otro nombre.'); return true; }
    const id = cat.nuevoId(), r = Q.clienteDesde(q, id, valor('qzDesde'), c.user.uid); if (r.error) { error(r.error); return true; }
    enviar(() => nube.lote(r.escrituras.concat([{ ruta: 'cotizaciones/' + CB.numeroTexto(q.numero), cambio: true, datos: { estado: 'aceptada', clienteId: id, cambio: { por: c.user.uid, quien: quien(c), en: nube.ahora() } } }])),
      'Cliente creado: ' + q.para.nombre + ' con ' + q.lineas.length + (q.lineas.length === 1 ? ' precio' : ' precios'), el);
  }
  return true;
}
export function alEscribir(el, c) {
  if (!$('#qzPrevia')) return false;
  if (el.id === 'qzBase') { leer(); S.base = el.value; const viejos = S.panes; S.panes = panesBase(c).map(p => Object.assign(p, { cantidad: (viejos.find(x => x.productoId === p.productoId) || {}).cantidad || '' })); $('#qzPanes').innerHTML = panesHTML(); previa(c); return true; }
  leer(); previa(c); return true;
}
