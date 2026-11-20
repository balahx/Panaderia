/* Entregas (dueños y externo): revisión de un mes. Totales y venta del mes, y cada día con sus entregas (horario, canastos,
   kilos o unidades y venta). Las entregas se arman solas con los pesajes; para corregir, «Ver el día» abre ese día en «Hoy».
   «Descargar Excel» baja el mismo mes (pantallas/datos.js): sus totales son los mismos de esta pantalla (core/ventas.js).
   Fase 6: un mes ya terminado se cierra aquí («Cerrar mes», pantallas/cierres.js). Un mes cerrado muestra los totales de su cierre
   (los que valen desde entonces); si vino de Excel, por pan. El IVA del mes es el IVA % del neto del mes. */
import { esc, fechaTexto, kilos, diaChile } from '../core/formato.js';
import { emptyHTML, errorHTML, svg } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as V from '../core/ventas.js';
import { exportar, ocupado } from './datos.js';
import * as CI from '../core/cierres.js';
import { cerrarMes, cerrandoMes, totalesTexto } from './cierres.js';

let mes = '';   // mes elegido ('' = el mes de hoy)
const mesDe = c => (mes && mes <= V.mesDe(c.hoy) ? mes : V.mesDe(c.hoy));
const rango = c => { const r = V.rangoMes(mesDe(c)); return { desde: r.desde, hasta: r.hasta > c.hoy ? c.hoy : r.hasta }; };
export const periodo = c => rango(c);
/* Al llegar con un botón «ir» que trae data-mes (desde Cierres). */
export function abrir(ds, c) { if (ds.mes && V.esMes(ds.mes)) mes = ds.mes >= V.mesDe(c.hoy) ? '' : ds.mes; }
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

/* Tarjeta del cierre de un mes cerrado: sus totales son los que valen. */
function tarjetaCierre(x, c, L, T) {
  const pct = cat.enCampo(typeof x.iva === 'number' ? x.iva : cat.ivaDe(c.negocio)), cambio = L.length && (T.neto !== x.neto || Math.abs(T.kg - x.kg) > 0.001 || T.un !== x.un);
  return '<section class="card sec" id="entCierre"><p class="eyebrow">' + esc(cap(V.mesTexto(x.mes || mesDe(c)))) + ' · cerrado ' + esc(CI.textoOrigen(x)) + '</p>' +
    kv('Neto', cat.pesos(x.neto)) + kv('IVA (' + pct + ' % del neto)', cat.pesos(x.ivaMonto)) + kv('Total', cat.pesos(x.total), 'entCierreTotal') + kv('Cantidad', totalesTexto(x)) +
    '<p class="muted chico">Cerrado por ' + esc(x.quien || '—') + (typeof x.en === 'number' ? ' el ' + esc(fechaTexto(diaChile(new Date(x.en)))) : '') + '. En este mes ya no se anota ni se corrige.</p>' +
    (cambio ? '<p class="warn-t" id="entCambio">Lo anotado en la app suma hoy ' + esc(cat.pesos(T.neto)) + ' neto (' + esc(P.textoTotales(T)) + '): cambió después del cierre. El cierre no cambia; un dueño puede reabrir el mes y cerrarlo de nuevo.</p>' : '') +
    (x.origen === 'excel' ? '<div class="mlist">' + (x.lineas || []).map(l => '<div class="mrow fija"><span class="mt"><b>' + esc(l.nombre) + '</b><small>' + esc(P.textoCantidad(l.cantidad || 0, l.unidad)) + '</small></span><span class="precio"><b>' + esc(cat.pesos(l.neto || 0)) + '</b><small>neto</small></span></div>').join('') + '</div>' : '') +
    '<div class="actions">' + (L.length ? '<button class="btn ghost" id="entExcel" data-act="ent-excel"' + (ocupado() ? ' disabled' : '') + '>' + svg('bajar') + (ocupado() ? 'Preparando…' : 'Descargar Excel del mes') + '</button>' : '') +
    '<button class="btn ghost" data-act="ir" data-tab="cierres">Ver los cierres</button></div></section>';
}
/* Debajo de la venta de un mes sin cerrar: «Cerrar mes» si ya terminó; si no, cuándo se podrá. */
function pieCierre(c, m) {
  const x = CI.cierreDe(c.cierres, m), re = x && !x.cerrado ? '<p class="muted chico" id="entReabierto">Reabierto' + (x.reabiertoQuien ? ' por ' + esc(x.reabiertoQuien) : '') + ': ciérralo de nuevo cuando esté listo.</p>' : '';
  if (!CI.sePuedeCerrar(m, c.hoy)) return '<p class="muted chico" id="entCerrarCuando">El mes se cierra cuando termine (desde el 1 de ' + esc(V.mesTexto(V.sumarMeses(m, 1))) + ').</p>';
  return re + '<div class="actions"><button class="btn" id="entCerrar" data-act="ent-cerrar"' + (cerrandoMes() ? ' disabled' : '') + '>' + svg('check') + (cerrandoMes() === m ? 'Cerrando…' : 'Cerrar ' + esc(V.mesTexto(m))) + '</button></div>' +
    '<p class="muted chico">Al cerrar, el mes queda fijo con estos totales (IVA = ' + esc(cat.enCampo(cat.ivaDe(c.negocio))) + ' % del neto del mes) y ya no se anota ni se corrige en él.</p>';
}

export function html(c) {
  const cab = cabecera(c), per = c.per, k = c.cat, r = rango(c);
  const err = c.errCat || (per && per.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!k || !k.productos || !k.precios || !k.clientes || !per || per.desde !== r.desde || !per.pesajes || !c.cierres) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const cli = cat.clientePrincipal(k.clientes), iva = cat.ivaDe(c.negocio), m = mesDe(c), cie = CI.cierreDe(c.cierres, m), cerrado = cie && cie.cerrado === true ? cie : null;
  const L = V.lineas(per.pesajes, k.productos, k.precios, cli && cli.id, iva), T = V.totales(L);
  if (!L.length) return cab + (cerrado ? tarjetaCierre(cerrado, c, L, T) + (cerrado.origen === 'excel' ? '<p class="muted" id="entDeExcel">Este mes se importó desde Excel: no tiene entregas anotadas en la app.</p>' : '')
    : emptyHTML('camion', 'Sin entregas en ' + V.mesTexto(m), 'Lo pesado en la panadería, o anotado en fecha pasada desde «Hoy», aparece aquí agrupado por día y entrega.') +
      (CI.sePuedeCerrar(m, c.hoy) ? '<div class="actions centro"><button class="btn ghost" id="entImportar" data-act="ir" data-tab="cierres">Importar este mes desde Excel</button></div>' : ''));
  const ent = V.porEntrega(L), dias = V.porDia(L).map(d => Object.assign(d, { ent: ent.filter(e => e.fecha === d.fecha) })).reverse();
  return cab +
    '<div class="stats" id="entTotales"><div class="stat"><b>' + dias.length + '</b><span>' + (dias.length === 1 ? 'día' : 'días') + '</span></div>' +
    '<div class="stat"><b>' + ent.length + '</b><span>' + (ent.length === 1 ? 'entrega' : 'entregas') + '</span></div>' +
    '<div class="stat"><b>' + esc(kilos(T.kg)) + '</b><span>kilos</span></div>' + (T.un ? '<div class="stat"><b>' + esc(P.textoCantidad(T.un, 'un').replace(' un', '')) + '</b><span>unidades</span></div>' : '') + '</div>' +
    (cerrado ? tarjetaCierre(cerrado, c, L, T) : cli ? '<section class="card sec" id="entMonto"><p class="eyebrow">Venta de ' + esc(V.mesTexto(mesDe(c))) + ' a ' + esc(cli.nombre) + (r.hasta === c.hoy ? ' (hasta hoy)' : '') + '</p>' +
      kv('Neto', cat.pesos(T.neto)) + kv('IVA (' + cat.enCampo(iva) + ' % del neto)', cat.pesos(T.iva)) + kv('Total', cat.pesos(T.total), 'entTotal') +
      (T.sinPrecio ? '<p class="warn-t" id="entSinPrecio">Hay panes vendidos sin precio: no suman. ' + esc(V.faltanPrecios(L).map(x => x.nombre).join(', ')) + '.</p>' : '') +
      '<div class="actions"><button class="btn ghost" id="entExcel" data-act="ent-excel"' + (ocupado() ? ' disabled' : '') + '>' + svg('bajar') + (ocupado() ? 'Preparando…' : 'Descargar Excel del mes') + '</button></div>' + pieCierre(c, m) + '</section>'
      : '<p class="note warn" id="entMonto">Para ver la venta falta el cliente y sus precios (Más → Catálogo).</p>') +
    '<section class="sec" id="entDias"><h2>Por día</h2>' + dias.map(dia).join('') + '</section>';
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (act === 'ent-excel') { const r = rango(c); exportar(c, r.desde, r.hasta, false); return 'repintar'; }   // sin costos: es el de la contadora (Fase 9)
  if (act === 'ent-cerrar') { cerrarMes(c, mesDe(c)); return true; }
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
