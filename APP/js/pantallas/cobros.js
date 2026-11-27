/* «Cobros» (Fase 12, Más → Cobros; solo dueños y externo): arriba Por cobrar, Vencido y Saldo a favor; filtros por cliente y estado
   (Pendientes, Abonados, Vencidos, Pagados, Anulados, Todos); la lista de cobros (número, cliente, período, total, saldo y estado) y los
   últimos abonos; «Nuevo cobro», «Anotar abono» y «Estado de cuenta». Las hojas están en cobro-nuevo.js, cobro-ficha.js, abono-hoja.js y
   estado-cuenta.js. Los cobros y abonos llegan en vivo (app.js: ctx.cobros, ctx.abonos, ctx.cliCobro, ctx.empresa). */
import { esc, fechaTexto } from '../core/formato.js';
import { svg, emptyHTML } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import * as nuevo from './cobro-nuevo.js';
import * as ficha from './cobro-ficha.js';
import * as abono from './abono-hoja.js';
import * as cuenta from './estado-cuenta.js';
import { listo, regulares, nombreCli, badge } from './cobros-comun.js';

const L = { cliente: '', estado: 'todos', abrir: null }, MAX = 80;
let visto = 0, ultimo = null;   // ultimo: el contexto del último dibujo (lo que se abre después usa los datos más nuevos)
const ESTADOS = [['todos', 'Todos'], ['pendiente', 'Pendientes'], ['abonado', 'Abonados'], ['vencido', 'Vencidos'], ['pagado', 'Pagados'], ['anulado', 'Anulados']];
const pasa = e => L.estado === 'todos' || (L.estado === 'vencido' ? e.vencido : e.estado === L.estado);

/* Al llegar desde un botón (ficha del cliente, franja de vencidos): data-cli, data-estado, data-abrir = 'nuevo' | 'abono' | 'cuenta'. */
export function abrir(ds) {
  if (ds.cli !== undefined) L.cliente = ds.cli || '';
  if (ds.estado) L.estado = ds.estado;
  L.abrir = ds.abrir ? { que: ds.abrir, cli: ds.cli || '' } : null;
}
function pendiente(c) {
  const x = L.abrir; L.abrir = null;
  setTimeout(() => { c = ultimo || c; if (x.que === 'nuevo') nuevo.abrir(c, { clienteId: x.cli }); else if (x.que === 'abono') abono.abrirNuevo(c, { clienteId: x.cli }); else if (x.que === 'cuenta') cuenta.abrir(c, x.cli); }, 0);
}
const stat = (id, t, v, w) => '<div class="stat' + (w ? ' alerta' : '') + '" id="' + id + '"><span>' + t + '</span><b>' + esc(cat.pesos(v)) + '</b></div>';
/* Parte D: la insignia del estado va en la columna del monto, debajo del saldo (en el teléfono el nombre tenía tres columnas a su lado) */
function filaCobro(c, x) {
  const e = A.estado(x, c.abonos, c.hoy);
  return '<button class="mrow" data-act="cob-ver" data-n="' + x.numero + '"><span class="mt"><b>N.º ' + esc(CB.numeroTexto(x.numero)) + ' · ' + esc(nombreCli(c, x.clienteId) || x.cliente.nombre) + '</b><small>' +
    esc(CB.periodoTexto(x.desde, x.hasta, x.periodo) + (x.anulado ? '' : ' · vence ' + fechaTexto(x.vence))) + '</small></span><span class="precio"><b>' + esc(cat.pesos(x.total)) + '</b><small>' +
    (x.anulado ? 'no suma' : e.saldo ? 'saldo ' + esc(cat.pesos(e.saldo)) : 'sin saldo') + '</small>' + badge(e) + '</span></button>';
}
const filaAbono = (c, a) => '<button class="mrow" data-act="ab-ver" data-id="' + esc(a.id) + '"><span class="mt"><b>' + esc(cat.pesos(a.monto)) + ' · ' + esc(nombreCli(c, a.clienteId)) + '</b><small>' +
  esc(fechaTexto(a.fecha) + ' · ' + (A.MEDIOS[a.medio] || a.medio) + (a.aFavor ? ' · ' + cat.pesos(a.aFavor) + ' a favor' : '') + (a.anulado ? ' · anulado' : '')) + '</small></span>' + svg('chev', 'go') + '</button>';

export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Cobros</span><h1>Cobros</h1>';
  if (!listo(c)) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  ultimo = c;
  if (L.abrir) pendiente(c);
  if (document.querySelector('#dlg[open] #cfFicha')) setTimeout(() => { if (document.querySelector('#dlg[open] #cfFicha')) ficha.pintar(ultimo); }, 0);   // llegaron datos: la ficha abierta se pone al día
  if (nuevo.emitido && nuevo.emitido !== visto && c.cobros.some(x => x.numero === nuevo.emitido)) { visto = nuevo.emitido; const n = visto; setTimeout(() => { if (!document.querySelector('#dlg[open]')) ficha.abrir(ultimo, n); }, 30); }
  const regs = regulares(c); if (L.cliente && !regs.some(x => x.id === L.cliente)) L.cliente = '';
  const cu = A.cuenta(c.cobros, c.abonos, L.cliente, c.hoy);
  const lista = c.cobros.filter(x => !L.cliente || x.clienteId === L.cliente).filter(x => pasa(A.estado(x, c.abonos, c.hoy))).sort((a, b) => b.numero - a.numero);
  const abonos = (c.abonos || []).filter(a => !L.cliente || a.clienteId === L.cliente).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.en || 0) - (a.en || 0))).slice(0, 15);
  return cab + (CB.empresaLista(c.empresa) ? '' : '<p class="note warn" id="cobFaltaEmpresa">Antes del primer cobro anota la razón social y el RUT de la panadería. <button class="lnk" data-act="ir" data-tab="empresa">Datos para documentos</button></p>') +
    '<div class="stats" id="cobResumen">' + stat('cobPorCobrar', 'Por cobrar', cu.porCobrar) + stat("cobVencido", "Vencido", cu.vencido, cu.vencido > 0) + stat('cobAFavor', 'Saldo a favor', cu.aFavor) + '</div>' +
    '<div class="dos"><div><label class="lab" for="cobCliente">Cliente</label><select class="txt" id="cobCliente"><option value="">Todos los clientes</option>' +
    regs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === L.cliente ? ' selected' : '') + '>' + esc(x.nombre + (x.activo === false ? ' (desactivado)' : '')) + '</option>').join('') + '</select></div>' +
    '<div><label class="lab" for="cobEstado">Estado</label><select class="txt" id="cobEstado">' + ESTADOS.map(e => '<option value="' + e[0] + '"' + (e[0] === L.estado ? ' selected' : '') + '>' + e[1] + '</option>').join('') + '</select></div></div>' +
    '<div class="actions arriba"><button class="btn" data-act="cob-nuevo">' + svg('cobro') + 'Nuevo cobro</button><button class="btn ghost" data-act="cob-abono">Anotar abono</button><button class="btn ghost" data-act="cob-cuenta">Estado de cuenta</button></div>' +
    (lista.length ? '<div class="mlist" id="listaCobros">' + lista.slice(0, MAX).map(x => filaCobro(c, x)).join('') + '</div>' + (lista.length > MAX ? '<p class="muted chico">Se muestran los ' + MAX + ' más nuevos: elige un cliente o un estado para ver otros.</p>' : '')
      : emptyHTML('cobro', c.cobros.length ? 'Ningún cobro con ese filtro' : 'Sin cobros todavía', c.cobros.length ? 'Cambia el cliente o el estado.' : 'Toca «Nuevo cobro»: se arma solo con las entregas del cliente (desde el 1 de noviembre de 2026).',
        c.cobros.length ? '<button class="lnk" data-act="cob-todos" id="cobVerTodos">Ver todos los cobros</button>' : '')) +   // parte D: salir del filtro sin buscarlo arriba
    (abonos.length ? '<section class="sec" id="cobAbonos"><p class="eyebrow">Últimos abonos</p><div class="mlist">' + abonos.map(a => filaAbono(c, a)).join('') + '</div></section>' : '') +
    '<p class="muted chico">Documento interno de cobro (no es factura). Ventas sueltas no tiene cobros: se paga al momento.</p>';
}
export function alActuar(act, el, c) {
  if (!listo(c) && /^(cob|cn|cf|ab|ec)-/.test(act)) return true;
  if (act === 'cob-nuevo') { nuevo.abrir(c, { clienteId: L.cliente }); return true; }
  if (act === 'cob-abono') { abono.abrirNuevo(c, { clienteId: L.cliente }); return true; }
  if (act === 'cob-cuenta') { cuenta.abrir(c, L.cliente); return true; }
  if (act === 'cob-ver') { ficha.abrir(c, el.dataset.n); return true; }
  if (act === 'cob-todos') { L.cliente = ''; L.estado = 'todos'; return 'repintar'; }
  return ficha.alActuar(act, el, c) || abono.alActuar(act, el, c) || nuevo.alActuar(act, el, c) || cuenta.alActuar(act, el, c);
}
export function alEscribir(el, c) {
  if (el.id === 'cobCliente') { L.cliente = el.value; return 'repintar'; }
  if (el.id === 'cobEstado') { L.estado = el.value; return 'repintar'; }
  if (!listo(c)) return;
  if (nuevo.alEscribir(el, c) || abono.alEscribir(el, c)) return;
  cuenta.alEscribir(el, c);
}
