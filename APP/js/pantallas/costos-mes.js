/* Costos · «El mes» (PLAN, Fase 9): venta neta, ingredientes y margen de cada pan, gastos del mes y resultado.
     margen = venta − ingredientes (con la receta y los precios de cada día) · resultado = margen − gastos (los gastos no se reparten)
   La venta sigue la regla de la Fase 6 (mes cerrado → su cierre; si no, lo pesado). Un mes importado desde Excel no tiene días:
   sus ingredientes se ESTIMAN con el costo vigente el último día del mes (core/costos.js, resumenMes).
   Los pesajes del mes llegan en ctx.per (periodo, lo escucha app.js) y los gastos en ctx.gastos. */
import { esc, fechaTexto } from '../core/formato.js';
import { emptyHTML, errorHTML, svg } from '../core/iconos.js';
import { $, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as P from '../core/pesaje.js';
import * as K from '../core/costos.js';
import * as CI from '../core/cierres.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';
import { exportar, ocupado } from './datos.js';

let mes = '';   // mes elegido ('' = el de hoy)
const mesDe = c => (mes && mes <= V.mesDe(c.hoy) ? mes : V.mesDe(c.hoy));
const rango = c => { const r = V.rangoMes(mesDe(c)); return { desde: r.desde, hasta: r.hasta > c.hoy ? c.hoy : r.hasta }; };
export const periodo = c => rango(c);
export function abrir(ds, c) { if (ds.mes && V.esMes(ds.mes)) mes = ds.mes >= V.mesDe(c.hoy) ? '' : ds.mes; }
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const kv = (k, v, id, cls) => '<div class="kv' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const gastosDe = (c, m) => (c.gastos || []).find(g => g.id === m) || null;

/* Lo que hace falta para el mes que se mira: { R, cargando, err } */
export function datosMes(c) {
  const per = c.per, k = c.cat, r = rango(c), m = mesDe(c);
  if (c.errCat || (per && per.err)) return { err: c.errCat || per.err };
  if (!k || !k.productos || !k.precios || !k.clientes || !k.insumos || !k.preciosInsumo || !k.recetas || !per || per.desde !== r.desde || !per.pesajes || !c.cierres || !c.gastos) return { cargando: true };
  return { R: K.resumenMes(m, { cierre: CI.cierreDe(c.cierres, m), pesajes: per.pesajes, productos: k.productos, precios: k.precios, clientes: k.clientes, iva: cat.ivaDe(c.negocio),
    k: { insumos: k.insumos, preciosInsumo: k.preciosInsumo, recetas: k.recetas }, gastos: gastosDe(c, m) }) };
}

function cabecera(c) {
  const m = mesDe(c);
  return '<div class="dia-nav" role="group" aria-label="Cambiar de mes"><button class="btn ghost sm" data-act="cos-mes-nav" data-d="-1">‹ Anterior</button>' +
    '<label class="vh" for="cosMes">Ir a otro mes</label><input class="txt" type="month" id="cosMes" max="' + V.mesDe(c.hoy) + '" value="' + m + '">' +
    '<button class="btn ghost sm" data-act="cos-mes-nav" data-d="1"' + (m === V.mesDe(c.hoy) ? ' disabled' : '') + '>Siguiente ›</button></div>' +
    '<p class="eyebrow" id="cosMesNombre">' + esc(cap(V.mesTexto(m))) + (m === V.mesDe(c.hoy) ? ' · hasta hoy' : '') + '</p>';
}
function filaPan(p) {
  const det = P.textoCantidad(p.cantidad || 0, p.unidad) + ' · venta ' + cat.pesos(p.neto) + (p.costo == null ? '' : ' · ingredientes ' + cat.pesos(p.costo) + (p.estimado ? ' (estimado)' : ''));
  if (p.costo == null) return '<button class="mrow" data-act="rec-ver" data-id="' + esc(p.productoId) + '"><span class="mt"><b>' + esc(p.nombre) + '</b><small>' + esc(det) + '</small></span><span class="badge warn">Sin costo</span>' + svg('chev', 'go') + '</button>';
  return '<button class="mrow" data-act="rec-ver" data-id="' + esc(p.productoId) + '"><span class="mt"><b>' + esc(p.nombre) + '</b><small>' + esc(det) + '</small></span>' +
    '<span class="precio"><b>' + esc(cat.pesos(p.margen)) + '</b><small>margen ' + esc(K.pctTexto(p.pct)) + '</small></span>' + svg('chev', 'go') + '</button>';
}
function tarjetaVenta(R, c) {
  const fuente = R.cerrado ? (R.origen === 'excel' ? 'Mes cerrado desde Excel: la venta es la de su cierre y los ingredientes se estiman con el costo vigente el ' + fechaTexto(V.rangoMes(R.mes).hasta) + '.' : 'Mes cerrado: la venta es la de su cierre.') : '';
  return '<section class="card sec" id="cosVenta"><p class="eyebrow">Venta e ingredientes</p>' + kv('Venta neta', cat.pesos(R.venta), 'cosVentaNeta') +
    kv('Ingredientes' + (R.estimado ? ' (estimado)' : ''), cat.pesos(R.costo), 'cosIngredientes') + kv('Margen de los panes', cat.pesos(R.margen) + ' · ' + K.pctTexto(R.pct), 'cosMargen', 'fuerte') +
    (fuente ? '<p class="muted chico" id="cosFuente">' + esc(fuente) + '</p>' : '') +
    (R.sinCosto.length ? '<p class="warn-t" id="cosSinCosto">Sin costo (no descuentan ingredientes): ' + esc(R.sinCosto.map(p => p.nombre).join(', ')) + '. Anota su receta o el precio que falta de sus insumos.</p>' : '') +
    (R.sinPrecio.length ? '<p class="warn-t" id="cosSinPrecio">Vendido sin precio algún día (no suma venta): ' + esc(R.sinPrecio.map(p => p.nombre).join(', ')) + '.</p>' : '') + '</section>';
}
function tarjetaGastos(R, c) {
  return '<section class="card sec" id="cosGastos"><p class="eyebrow">Gastos del mes</p>' +
    (R.gastos.length ? R.gastos.map(g => kv(g.nombre, cat.pesos(g.monto))).join('') + kv('Total de gastos', cat.pesos(R.totalGastos), 'cosTotalGastos', 'fuerte')
      : '<p class="muted" id="cosSinGastos">' + (R.hayGastos ? 'Se anotaron sin montos.' : 'Aún no hay gastos anotados para este mes.') + '</p>') +
    '<div class="actions"><button class="btn ghost" id="cosAnotarGastos" data-act="gas-editar">' + (R.gastos.length ? 'Cambiar gastos' : 'Anotar gastos') + '</button></div>' +
    '<p class="muted chico">Gas, luz, sueldos, arriendo y otros fijos, netos de factura (los sueldos, por lo que se paga). No se reparten entre los panes.</p></section>';
}
function tarjetaResultado(R) {
  return '<section class="card sec" id="cosResultado"><p class="eyebrow">Resultado del mes</p>' + kv('Margen de los panes', cat.pesos(R.margen)) + kv('Gastos del mes', '− ' + cat.pesos(R.totalGastos)) +
    kv('Resultado', cat.pesos(R.resultado) + ' · ' + K.pctTexto(R.resultadoPct) + ' de la venta', 'cosResultadoTotal', 'fuerte') +
    (R.resultado < 0 ? '<p class="warn-t" id="cosPerdida">Este mes los ingredientes y los gastos superan la venta.</p>' : '') +
    (R.hayGastos ? '' : '<p class="muted chico">Sin gastos anotados, el resultado es solo el margen de los panes.</p>') + '</section>';
}
export function html(c) {
  const cab = cabecera(c), d = datosMes(c);
  if (d.err) return cab + errorHTML('No se pudieron leer los datos (' + d.err + ').', { retry: 'recargar' });
  if (d.cargando) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const R = d.R, m = mesDe(c);
  const vacio = !R.hayDatos ? emptyHTML('calc', 'Sin ventas en ' + V.mesTexto(m), 'Cuando haya lo pesado (o el cierre del mes), aquí se ve la venta, los ingredientes y el margen de cada pan.') : '';
  return cab + (vacio || tarjetaVenta(R, c) + '<section class="sec" id="cosPanes"><h2>Por pan</h2><div class="mlist">' + R.panes.map(filaPan).join('') + '</div>' +
    '<p class="muted chico">Margen = venta neta − ingredientes; el % es sobre la venta. Toca un pan para ver su receta.</p></section>') +
    tarjetaGastos(R, c) + (R.hayDatos ? tarjetaResultado(R) : '') +
    (R.lineas.length ? '<div class="actions"><button class="btn ghost" id="cosExcel" data-act="cos-mes-excel"' + (ocupado() ? ' disabled' : '') + '>' + svg('bajar') + (ocupado() ? 'Preparando…' : 'Descargar Excel del mes') + '</button></div>' : '');
}

/* ---------- Gastos: hoja para anotarlos ---------- */
let filas = [];
function hojaGastos(c, m, desde) {
  filas = K.filasGastos(desde !== undefined ? desde : gastosDe(c, m));
  hoja('Gastos de ' + V.mesTexto(m), '<p class="muted chico">En pesos, netos de factura (sin IVA). Deja en blanco lo que no corresponda.</p><div id="gasFilas">' +
    filas.map((f, i) => '<div class="gasto-f"><label class="vh" for="gN' + i + '">Gasto ' + (i + 1) + '</label><input class="txt" id="gN' + i + '" maxlength="40" autocomplete="off" placeholder="Otro gasto" value="' + esc(f.nombre) + '">' +
      '<label class="vh" for="gM' + i + '">Monto de ' + esc(f.nombre || 'gasto ' + (i + 1)) + '</label><input class="txt" id="gM' + i + '" data-campo="g' + i + '" inputmode="numeric" maxlength="16" autocomplete="off" data-enter="gas-guardar" value="' + esc(f.monto == null ? '' : cat.pesos(f.monto).replace('$', '')) + '"></div>').join('') +
    '</div><p class="muted" id="gasTotal" aria-live="polite">' + esc(textoTotal(filas.map(f => ({ monto: f.monto == null ? '' : String(f.monto) })))) + '</p>' +
    '<div class="actions"><button class="btn ghost sm" data-act="gas-copiar" data-mes="' + m + '">Copiar del mes anterior</button></div>' + pieHoja('gas-guardar', 'Guardar gastos', ' data-mes="' + m + '"'));
  const g = $('#gM0'); if (g) g.focus();
}
const leerFilas = () => filas.map((f, i) => ({ nombre: ($('#gN' + i) || {}).value || '', monto: ($('#gM' + i) || {}).value || '' }));
function textoTotal(lista) {
  const t = (lista || leerFilas()).reduce((s, f) => { const n = cat.numero(f.monto); return s + (Number.isNaN(n) ? 0 : n); }, 0);
  return 'Total: ' + cat.pesos(Math.round(t));
}

export function alActuar(act, el, c) {
  if (act === 'cos-mes-nav') { mes = V.sumarMeses(mesDe(c), Number(el.dataset.d) || 0); if (mes >= V.mesDe(c.hoy)) mes = ''; return true; }
  if (act === 'cos-mes-excel') { const r = rango(c); exportar(c, r.desde, r.hasta, true, ''); return true; }
  if (act === 'gas-editar') { hojaGastos(c, mesDe(c)); return true; }
  if (act === 'gas-copiar') {
    const antes = gastosDe(c, V.sumarMeses(el.dataset.mes, -1));
    if (!antes || !antes.items || !antes.items.length) { error('El mes anterior no tiene gastos anotados.'); return true; }
    hojaGastos(c, el.dataset.mes, antes); return true;
  }
  if (act === 'gas-guardar') {
    const v = K.validarGastos(leerFilas()), m = el.dataset.mes;
    if (v.error) { error(v.error, v.fila >= 0 ? 'g' + v.fila : ''); return true; }
    enviar(() => nube.guardar('gastos/' + m, K.documentoGastos(m, v.items, { por: c.user.uid, quien: c.user.nombre })), 'Gastos de ' + V.mesTexto(m) + ' guardados', el);
    return true;
  }
  return false;
}
export function alEscribir(el, c) {
  if (el.id === 'cosMes' && V.esMes(el.value)) { mes = el.value >= V.mesDe(c.hoy) ? '' : el.value; return 'repintar'; }
  if (/^g[NM]\d+$/.test(el.id)) { const s = $('#gasTotal'); if (s) s.textContent = textoTotal(); return 'listo'; }
  return '';
}
