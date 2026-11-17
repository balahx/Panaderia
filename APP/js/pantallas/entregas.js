/* Entregas (dueños y externo): revisión de un mes. Totales y venta del mes, y cada día con sus entregas (horario, canastos,
   kilos o unidades y venta). Las entregas se arman solas con los pesajes; para corregir, «Ver el día» abre ese día en «Hoy».
   «Descargar Excel» baja el mismo mes (pantallas/datos.js): sus totales son los mismos de esta pantalla (core/ventas.js). */
import { esc, fechaTexto, kilos } from '../core/formato.js';
import { emptyHTML, errorHTML, svg } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as V from '../core/ventas.js';
import { exportar, ocupado } from './datos.js';

let mes = '';   // mes elegido ('' = el mes de hoy)
const mesDe = c => (mes && mes <= V.mesDe(c.hoy) ? mes : V.mesDe(c.hoy));
const rango = c => { const r = V.rangoMes(mesDe(c)); return { desde: r.desde, hasta: r.hasta > c.hoy ? c.hoy : r.hasta }; };
export const periodo = c => rango(c);
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const corto = f => V.diaSemana(f) + ' ' + fechaTexto(f).replace(/ \d{4}$/, '');

function cabecera(c) {
  const m = mesDe(c), esteMes = m === V.mesDe(c.hoy);
  return '<span class="eyebrow">Entregas</span><h1>' + esc(cap(V.mesTexto(m))) + '</h1>' +
    '<div class="dia-nav" role="group" aria-label="Cambiar de mes"><button class="btn ghost sm" data-act="ent-mes" data-d="-1">‹ Anterior</button>' +
    '<label class="vh" for="entMes">Ir a otro mes</label><input class="txt" type="month" id="entMes" max="' + V.mesDe(c.hoy) + '" value="' + m + '">' +
    '<button class="btn ghost sm" data-act="ent-mes" data-d="1"' + (esteMes ? ' disabled' : '') + '>Siguiente ›</button></div>';
}
function dia(d) {
  return '<div class="card ent-dia" data-fecha="' + d.fecha + '"><div class="entrega-h"><b>' + esc(cap(corto(d.fecha))) + '</b><span class="ent-monto">' + esc(cat.pesos(d.total)) + '</span></div>' +
    '<p class="muted chico">' + plural(d.entregas, 'entrega', 'entregas') + ' · ' + plural(d.canastos, 'canasto', 'canastos') + ' · ' + esc(P.textoTotales(d)) + (d.sinPrecio ? ' · ' + plural(d.sinPrecio, 'pan sin precio', 'panes sin precio') : '') + '</p>' +
    '<div class="mlist">' + d.ent.map(e => '<div class="mrow fija"><span class="mt"><b>N.º ' + e.n + '</b><small>' + esc((e.desde || '') + (e.hasta && e.hasta !== e.desde ? '–' + e.hasta : '')) + ' · ' + plural(e.canastos, 'canasto', 'canastos') + '</small></span>' +
      '<span class="precio"><b>' + esc(P.textoTotales(e)) + '</b><small>' + (e.lineas === e.sinPrecio ? 'Sin precio' : esc(cat.pesos(e.neto)) + ' neto') + '</small></span></div>').join('') + '</div>' +
    '<div class="actions"><button class="btn ghost sm" data-act="ir" data-tab="inicio" data-dia="' + d.fecha + '">Ver el día y corregir</button></div></div>';
}

export function html(c) {
  const cab = cabecera(c), per = c.per, k = c.cat, r = rango(c);
  const err = c.errCat || (per && per.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!k || !k.productos || !k.precios || !k.clientes || !per || per.desde !== r.desde || !per.pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const cli = cat.clientePrincipal(k.clientes), iva = cat.ivaDe(c.negocio);
  const L = V.lineas(per.pesajes, k.productos, k.precios, cli && cli.id, iva), T = V.totales(L);
  if (!L.length) return cab + emptyHTML('camion', 'Sin entregas en ' + V.mesTexto(mesDe(c)), 'Lo pesado en la panadería, o anotado en fecha pasada desde «Hoy», aparece aquí agrupado por día y entrega.');
  const ent = V.porEntrega(L), dias = V.porDia(L).map(d => Object.assign(d, { ent: ent.filter(e => e.fecha === d.fecha) })).reverse();
  return cab +
    '<div class="stats" id="entTotales"><div class="stat"><b>' + dias.length + '</b><span>' + (dias.length === 1 ? 'día' : 'días') + '</span></div>' +
    '<div class="stat"><b>' + ent.length + '</b><span>' + (ent.length === 1 ? 'entrega' : 'entregas') + '</span></div>' +
    '<div class="stat"><b>' + esc(kilos(T.kg)) + '</b><span>kilos</span></div>' + (T.un ? '<div class="stat"><b>' + esc(P.textoCantidad(T.un, 'un').replace(' un', '')) + '</b><span>unidades</span></div>' : '') + '</div>' +
    (cli ? '<section class="card sec" id="entMonto"><p class="eyebrow">Venta de ' + esc(V.mesTexto(mesDe(c))) + ' a ' + esc(cli.nombre) + (r.hasta === c.hoy ? ' (hasta hoy)' : '') + '</p>' +
      kv('Neto', cat.pesos(T.neto)) + kv('IVA (' + cat.enCampo(iva) + ' %)', cat.pesos(T.iva)) + kv('Total', cat.pesos(T.total), 'entTotal') +
      (T.sinPrecio ? '<p class="warn-t" id="entSinPrecio">Hay panes vendidos sin precio: no suman. ' + esc(V.faltanPrecios(L).map(x => x.nombre).join(', ')) + '.</p>' : '') +
      '<div class="actions"><button class="btn" id="entExcel" data-act="ent-excel"' + (ocupado() ? ' disabled' : '') + '>' + svg('bajar') + (ocupado() ? 'Preparando…' : 'Descargar Excel del mes') + '</button></div></section>'
      : '<p class="note warn" id="entMonto">Para ver la venta falta el cliente y sus precios (Más → Catálogo).</p>') +
    '<section class="sec" id="entDias"><h2>Por día</h2>' + dias.map(dia).join('') + '</section>';
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (act === 'ent-excel') { const r = rango(c); exportar(c, r.desde, r.hasta); return 'repintar'; }
  if (act !== 'ent-mes') return false;
  const m = V.sumarMeses(mesDe(c), Number(el.dataset.d));
  mes = m >= V.mesDe(c.hoy) ? '' : m;
  return 'repintar';
}
export function alEscribir(el, c) {
  if (el.id !== 'entMes' || !V.esMes(el.value)) return;
  mes = el.value >= V.mesDe(c.hoy) ? '' : el.value;
  return 'repintar';
}
