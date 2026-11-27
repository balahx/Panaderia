/* «Cotizaciones» (Fase 12, Más → Cobros; solo dueños y externo): la lista (número, para quién, fecha, total estimado y estado: Enviada,
   Aceptada, Rechazada o Vencida) y «Nueva cotización». Las hojas están en cotizacion-hoja.js. Llegan en vivo (app.js: ctx.cotizaciones). */
import { esc, fechaTexto } from '../core/formato.js';
import { svg, emptyHTML } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as CB from '../core/cobros.js';
import * as Q from '../core/cotizaciones.js';
import * as qh from './cotizacion-hoja.js';

/* Parte D: la insignia va en la columna del monto, debajo (en el teléfono el nombre tenía tres columnas a su lado) */
const fila = (c, q) => '<button class="mrow" data-act="qz-ver" data-n="' + q.numero + '"><span class="mt"><b>N.º ' + esc(CB.numeroTexto(q.numero)) + ' · ' + esc(q.para.nombre) + '</b><small>' +
  esc(fechaTexto(q.fecha) + ' · válida hasta ' + fechaTexto(q.validaHasta) + ' · ' + q.lineas.length + (q.lineas.length === 1 ? ' pan' : ' panes')) + '</small></span>' +
  '<span class="precio">' + (q.total != null ? '<b>' + esc(cat.pesos(q.total)) + '</b><small>por ' + esc(q.cantidadesPor) + '</small>' : '') +
  '<span class="badge' + (Q.vencida(q, c.hoy) ? ' warn' : q.estado === 'aceptada' ? ' ok' : '') + '">' + esc(Q.etiqueta(q, c.hoy)) + '</span></span></button>';
export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Cobros</span><h1>Cotizaciones</h1>';
  if (!Array.isArray(c.cotizaciones) || c.empresa === undefined || !c.cat || !c.cat.productos || !c.cat.precios || !c.cat.clientes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const l = c.cotizaciones.slice().sort((a, b) => b.numero - a.numero);
  return cab + '<p class="muted">Precios para un posible cliente, con IVA, en PDF. Si acepta, «Crear cliente con estos precios» lo agrega con su lista.</p>' +
    (CB.empresaLista(c.empresa) ? '' : '<p class="note warn" id="qzFaltaEmpresa">Antes de cotizar anota la razón social y el RUT de la panadería. <button class="lnk" data-act="ir" data-tab="empresa">Datos para documentos</button></p>') +
    '<div class="actions arriba"><button class="btn" data-act="qz-nueva">' + svg('file') + 'Nueva cotización</button></div>' +
    (l.length ? '<div class="mlist" id="listaCotizaciones">' + l.map(q => fila(c, q)).join('') + '</div>' : emptyHTML('file', 'Sin cotizaciones', 'Toca «Nueva cotización»: los precios parten de la lista de un cliente y se ajustan pan por pan.'));
}
export function alActuar(act, el, c) {
  if (act === 'qz-nueva') { qh.nueva(c); return true; }
  if (act === 'qz-ver') { qh.ver(c, el.dataset.n); return true; }
  return qh.alActuar(act, el, c);
}
export const alEscribir = (el, c) => { qh.alEscribir(el, c); };
