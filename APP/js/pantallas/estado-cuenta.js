/* Estado de cuenta de un cliente (Fase 12), desde Cobros y desde la ficha del cliente: un rango de fechas (por omisión, los últimos 3 meses),
   el saldo anterior, los cobros (cargos) y abonos (pagos) con el saldo corrido y, al final, el saldo adeudado o a favor. En PDF, con el mismo
   encabezado y pie que el cobro. Se arma en el equipo (también sin internet). */
import { esc } from '../core/formato.js';
import { $, hoja } from '../core/ui.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import * as D from '../core/pdf-doc.js';
import { opcionesCliente, campo, botonesPdf, pdf, regulares } from './cobros-comun.js';

const E = { clienteId: '', desde: '', hasta: '' };
const desdeDefecto = hoy => { const m = V.sumarMeses(V.mesDe(hoy), -3), d = m + '-' + hoy.slice(8, 10), fin = V.rangoMes(m).hasta; return d > fin ? fin : d; };
function calcular(c) { return A.estadoCuenta(c.cobros, c.abonos, E.clienteId, E.desde, E.hasta); }
function resumen(c) {
  const box = $('#ecResumen'); if (!box) return;
  if (!cat.esFecha(E.desde) || !cat.esFecha(E.hasta) || E.desde > E.hasta) { box.innerHTML = '<p class="form-error" role="alert">Elige las dos fechas («desde» antes que «hasta»).</p>'; return; }
  const ec = calcular(c), kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  box.innerHTML = kv('Saldo anterior', cat.pesos(ec.saldoAnterior)) + kv('Cobros (' + ec.movimientos.filter(m => m.tipo === 'cobro').length + ')', cat.pesos(ec.cargos)) + kv('Abonos (' + ec.movimientos.filter(m => m.tipo === 'abono').length + ')', cat.pesos(ec.pagos)) +
    kv(ec.saldoFinal < 0 ? 'Saldo a favor del cliente' : 'Saldo adeudado', cat.pesos(Math.abs(ec.saldoFinal)), 'ecSaldo');
}
export function abrir(c, clienteId) {
  E.clienteId = clienteId || E.clienteId; if (!regulares(c).some(x => x.id === E.clienteId)) E.clienteId = (regulares(c)[0] || {}).id || '';
  E.desde = desdeDefecto(c.hoy); E.hasta = c.hoy;
  hoja('Estado de cuenta', '<label class="lab" for="ecCliente">Cliente</label><select class="txt" id="ecCliente">' + opcionesCliente(c, E.clienteId) + '</select>' +
    '<div class="dos"><div>' + campo('ecDesde', 'Desde', E.desde, { tipo: 'date' }) + '</div><div>' + campo('ecHasta', 'Hasta', E.hasta, { tipo: 'date', tope: c.hoy }) + '</div></div>' +
    '<div id="ecResumen" aria-live="polite"></div><p class="muted chico">Los cobros cuentan el día en que se emitieron; los anulados no aparecen.</p>' + botonesPdf('ec-pdf'));
  resumen(c);
}
export function alActuar(act, el, c) {
  if (act !== 'ec-pdf') return false;
  if (!cat.esFecha(E.desde) || !cat.esFecha(E.hasta) || E.desde > E.hasta) return true;
  const cl = c.cat.clientes.find(x => x.id === E.clienteId) || { nombre: '' }, dc = CB.datosDe(c.cliCobro, E.clienteId);
  pdf(el.dataset.modo, A.nombreEstadoCuenta(cl.nombre, c.hoy, CB.slug), () => D.estadoCuenta(calcular(c), { cliente: CB.clienteFijo(cl, dc), emisor: CB.emisorFijo(c.empresa), hoy: c.hoy }));
  return true;
}
export function alEscribir(el, c) {
  if (el.id === 'ecCliente') E.clienteId = el.value; else if (el.id === 'ecDesde') E.desde = el.value; else if (el.id === 'ecHasta') E.hasta = el.value; else return false;
  resumen(c); return true;
}
