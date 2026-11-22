/* Hoja de un cobro (Fase 12): su estado (Pendiente, Abonado, Pagado, Vencido o Anulado, calculado con los abonos), los montos, lo abonado y
   el saldo, el PDF (Descargar, Compartir, Imprimir: se arma en el equipo, también sin internet), los abonos aplicados, «Pagar saldo»,
   «Anotar abono», el n.º de factura SII, anular (con motivo; lo abonado queda a favor del cliente) y el aviso «Cambió desde que se emitió»
   (se arma de nuevo con los canastos de hoy) con «Anular y emitir de nuevo». */
import { esc, fechaTexto } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { $, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import * as D from '../core/pdf-doc.js';
import * as nuevo from './cobro-nuevo.js';
import * as abono from './abono-hoja.js';
import { error } from './catalogo-producto.js';
import { badge, botonesPdf, pdf, enviar, campo, valor, motivoHTML, leerMotivo, quien, nombreCli } from './cobros-comun.js';

const F = { n: 0, cmp: null };
const cobroDe = c => (c.cobros || []).find(x => x.numero === F.n) || null;
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const lineaAbono = (a, n) => { const m = a.aplicado.filter(x => x.cobro === n).reduce((t, x) => t + x.monto, 0), previo = a.aplicado.some(x => x.cobro === n && x.previo);
  return '<button class="mrow" data-act="ab-ver" data-id="' + esc(a.id) + '"><span class="mt"><b>' + esc(cat.pesos(m)) + '</b><small>' + esc(fechaTexto(a.fecha) + ' · ' + (A.MEDIOS[a.medio] || a.medio) + (previo ? ' · saldo a favor anterior' : '') + (a.nota ? ' · ' + a.nota : '')) + '</small></span>' + svg('chev', 'go') + '</button>'; };

export function abrir(c, n) { F.n = Number(n); F.cmp = null; pintar(c); revisar(c); }
export function pintar(c) {
  const cb = cobroDe(c);
  if (!cb) { hoja('Cobro', '<p class="muted">Este cobro todavía no llega a este equipo.</p>'); return; }
  const e = A.estado(cb, c.abonos, c.hoy), ab = A.vigentes(c.abonos).filter(a => (a.aplicado || []).some(x => x.cobro === cb.numero)), n = CB.numeroTexto(cb.numero);
  hoja('Cobro N.º ' + n, '<div id="cfFicha" data-n="' + cb.numero + '"><p class="cf-est">' + badge(e) + ' <span class="muted">' + esc(CB.periodoTexto(cb.desde, cb.hasta, cb.periodo)) + '</span></p>' +
    (cb.anulado ? '<p class="note warn" id="cfAnulado">Anulado: ' + esc(cb.anulado.motivo) + (cb.anulado.quien ? ' (' + esc(cb.anulado.quien) + ')' : '') + (cb.anulado.reemplazo ? '. Lo reemplaza el N.º ' + esc(CB.numeroTexto(cb.anulado.reemplazo)) + '.' : '.') + '</p>' : '') +
    kv('Cliente', nombreCli(c, cb.clienteId) || cb.cliente.nombre) + kv('Emisión', fechaTexto(cb.fecha) + ' · ' + cb.quien) + kv('Vence', fechaTexto(cb.vence) + (e.vencido ? ' (vencido)' : '')) +
    (cb.reemplaza ? kv('Reemplaza al', 'N.º ' + CB.numeroTexto(cb.reemplaza)) : '') +
    kv('Total del cobro', cat.pesos(cb.total), 'cfTotal') + (cb.descuento ? kv(cb.descuento.texto, '-' + cat.pesos(cb.descuento.conIva)) : '') +
    (cb.anulado ? '' : kv('Abonado', cat.pesos(e.abonado) + (e.previo ? ' (con ' + cat.pesos(e.previo) + ' a favor)' : ''), 'cfAbonado') + kv('Saldo', cat.pesos(e.saldo), 'cfSaldo') + (e.pagadoEl ? kv('Pagado el', fechaTexto(e.pagadoEl)) : '')) +
    kv('Factura SII', cb.factura || '—', 'cfFactura') +
    '<div id="cfCambio">' + cambioHTML(cb) + '</div>' + botonesPdf('cf-pdf') +
    (ab.length ? '<p class="eyebrow">Abonos</p><div class="mlist" id="cfAbonos">' + ab.map(a => lineaAbono(a, cb.numero)).join('') + '</div>' : '') +
    '<p class="form-error" role="alert" hidden></p>' +
    (cb.anulado ? '' : '<div class="actions">' + (e.saldo > 0 ? '<button class="btn" data-act="cf-pagar">Pagar saldo</button>' : '') + '<button class="btn ghost" data-act="ab-nuevo" data-cli="' + esc(cb.clienteId) + '">Anotar abono</button>' +
      '<button class="btn ghost" data-act="cf-factura">' + (cb.factura ? 'Cambiar factura' : 'N.º de factura SII') + '</button><button class="btn ghost" data-act="cf-anular">Anular</button></div>') + '</div>');
}
function cambioHTML(cb) {
  if (cb.anulado || !F.cmp || F.cmp.igual) return '';
  return '<p class="note warn">Cambió desde que se emitió: ' + (F.cmp.faltan.length ? 'ahora hay panes sin precio en esas fechas.' : 'hoy esas entregas suman ' + esc(cat.pesos(F.cmp.ahora)) + ' (' + (F.cmp.dif > 0 ? '+' : '') + esc(cat.pesos(F.cmp.dif)) + ').') +
    ' Un canasto se corrigió, se anuló o se anotó después.</p><div class="actions"><button class="btn" data-act="cf-reemitir">Anular y emitir de nuevo</button></div>';
}
/* Vuelve a armar el período con los canastos de hoy (con la copia del equipo si no hay internet) y avisa si no cuadra. */
async function revisar(c) {
  const cb = cobroDe(c); if (!cb || cb.anulado) return;
  try {
    const r = await nube.consultarRango('pesajes', 'fecha', cb.desde, cb.hasta), k = c.cat;
    F.cmp = CB.comparar(cb, V.deCliente(V.lineas(r.filas, k.productos, k.precios, k.clientes, cb.iva), cb.clienteId));
    const box = $('#cfFicha[data-n="' + cb.numero + '"] #cfCambio'); if (box) box.innerHTML = cambioHTML(cb);
  } catch (e) { /* sin datos para comparar: no se avisa */ }
}

export function alActuar(act, el, c) {
  const cb = cobroDe(c); if (!cb) return act.startsWith('cf-');
  if (act === 'cf-pdf') { pdf(el.dataset.modo, CB.nombreArchivo(cb), () => D.cobro(cb, { hoy: c.hoy, estado: A.estado(cb, c.abonos, c.hoy), pendientes: A.pendientes(c.cobros, c.abonos, cb.clienteId, cb.numero), ahora: new Date() })); return true; }
  if (act === 'cf-pagar') { const p = A.pagarSaldo(cb, c.abonos); abono.abrirNuevo(c, { clienteId: cb.clienteId, monto: p.monto, partes: p.aplicado }); return true; }
  if (act === 'cf-reemitir') {
    nuevo.abrir(c, { clienteId: cb.clienteId, tipo: cb.periodo, desde: cb.desde, hasta: cb.hasta, descuento: cb.descuento ? { tipo: cb.descuento.tipo, valor: cb.descuento.valor, texto: cb.descuento.texto } : null,
      plazo: cb.plazo, factura: cb.factura || '', reemplaza: cb.numero, motivo: 'Canastos cambiados después de emitir' });
    return true;
  }
  if (act === 'cf-factura') {
    hoja('Factura SII · cobro N.º ' + CB.numeroTexto(cb.numero), campo('cfFacturaNum', 'N.º de factura SII', cb.factura || '', { max: 30, enter: 'cf-factura-ok', ayuda: 'La factura se hace aparte (en el SII). Déjalo en blanco para quitarlo.' }) +
      '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="cf-factura-ok">Guardar</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
    $('#cfFacturaNum').focus(); return true;
  }
  if (act === 'cf-factura-ok') { const f = CB.validarFactura(valor('cfFacturaNum')) || null; enviar(() => nube.cambiar('cobros/' + CB.numeroTexto(cb.numero), { factura: f }), f ? 'Factura SII anotada: ' + f : 'Factura SII quitada', el); return true; }
  if (act === 'cf-anular') {
    const e = A.estado(cb, c.abonos, c.hoy);
    hoja('Anular el cobro N.º ' + CB.numeroTexto(cb.numero), motivoHTML('El número no se vuelve a usar y el cobro deja de sumar en «Por cobrar».' + (e.abonado ? ' Lo abonado (' + cat.pesos(e.abonado) + ') queda a favor del cliente y se aplica solo a su próximo cobro.' : ''), 'cf-anular-ok', '', 'Anular cobro'));
    $('#motivo').focus(); return true;
  }
  if (act === 'cf-anular-ok') {
    const m = leerMotivo(); if (!m) return true;
    const orig = c.abonos || [], dif = A.diferencias(orig, A.moverDeCobro(orig, cb.numero, null, 0));
    const lote = [{ ruta: 'cobros/' + CB.numeroTexto(cb.numero), cambio: true, datos: { anulado: { motivo: m, reemplazo: null, por: c.user.uid, quien: quien(c), en: nube.ahora() } } }]
      .concat(dif.map(d => ({ ruta: 'abonos/' + d.id, cambio: true, datos: { aplicado: d.aplicado, aFavor: d.aFavor } })));
    enviar(() => nube.lote(lote), 'Cobro N.º ' + CB.numeroTexto(cb.numero) + ' anulado' + (dif.length ? ': lo abonado quedó a favor del cliente' : ''), el);
    return true;
  }
  if (act.startsWith('cf-')) { error('No se reconoce la acción.'); return true; }
  return false;
}
