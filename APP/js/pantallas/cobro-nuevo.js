/* Hoja «Nuevo cobro» (Fase 12): cliente regular → período (semana de lunes a domingo, mes calendario u otras fechas; por omisión el último
   terminado del tipo habitual del cliente) → vista previa armada con los canastos del cliente en esas fechas (la misma cuenta que Entregas
   con su filtro), descuento (el habitual, que se puede cambiar o quitar), plazo y n.º de factura SII → «Emitir cobro».
   El borrador se arma sin internet (con la copia del equipo); emitir necesita internet: el número sale del folio en una transacción
   (nube.conFolio). Al emitir se aplica solo el saldo a favor del cliente. «Anular y emitir de nuevo» abre esta hoja con `reemplaza`. */
import { esc, fechaTexto } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { $, ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import { kilos } from '../core/formato.js';
import { error } from './catalogo-producto.js';
import { hoyCl, opcionesCliente, campo, valor, campoDescuento, leerDescuento, quien, motivo } from './cobros-comun.js';

const N = { clienteId: '', tipo: 'mes', desde: '', hasta: '', desc: null, plazo: '7', factura: '', reemplaza: null, motivo: '', pes: null, cache: false, clave: '', err: '' };
const SIN_RED = 'Emitir un cobro necesita internet: el número no puede repetirse entre equipos. El borrador queda aquí.';
export let emitido = 0;   // último número emitido en este equipo (cobros.js abre su ficha cuando llega)
const cant = (n, u) => (u === 'un' ? String(Math.round(n)) + ' un' : kilos(n) + ' kg');

/* Abre la hoja. o = { clienteId, tipo, desde, hasta, descuento, plazo, factura, reemplaza, motivo } */
export function abrir(c, o) {
  o = o || {};
  Object.assign(N, { clienteId: o.clienteId || '', reemplaza: o.reemplaza || null, motivo: o.motivo || '', pes: null, clave: '', err: '' });
  if (!N.clienteId) { const p = cat.clientePrincipal(c.cat.clientes); N.clienteId = p ? p.id : ''; }
  habitual(c, o);
  pintar(c);
}
/* El período, el descuento y el plazo habituales del cliente (o los que se pasan). */
function habitual(c, o) {
  const dc = CB.datosDe(c.cliCobro, N.clienteId);
  N.tipo = o.tipo || (dc && dc.periodo) || 'mes';
  let r = o.desde ? { desde: o.desde, hasta: o.hasta } : CB.ultimoTerminado(N.tipo, c.hoy);
  if (!o.desde && r.hasta < CB.INICIO) r = N.tipo === 'semana' ? CB.semanaDe(c.hoy) : V.rangoMes(V.mesDe(c.hoy));   // antes del 1-nov-2026 no hay qué cobrar: el período en curso
  N.desde = r.desde < CB.INICIO ? CB.INICIO : r.desde; N.hasta = r.hasta < N.desde ? N.desde : r.hasta;
  N.desc = o.descuento !== undefined ? o.descuento : dc ? dc.descuento : null;
  N.plazo = String(o.plazo != null ? o.plazo : dc ? dc.plazo : CB.PLAZO); N.factura = o.factura || '';
}
function periodoCampos(c) {
  const seg = (v, t) => '<button data-act="cn-tipo" data-v="' + v + '" aria-pressed="' + (N.tipo === v) + '">' + t + '</button>';
  return '<div class="seg" role="group" aria-label="Período">' + seg('semana', 'Semanal') + seg('mes', 'Mensual') + seg('otro', 'Otras fechas') + '</div>' +
    (N.tipo === 'semana' ? campo('cnSemana', 'Un día de la semana (de lunes a domingo)', N.desde, { tipo: 'date', tope: c.hoy })
      : N.tipo === 'mes' ? campo('cnMes', 'Mes', V.mesDe(N.desde), { tipo: 'month', tope: V.mesDe(c.hoy) })
        : '<div class="dos"><div>' + campo('cnDesde', 'Desde', N.desde, { tipo: 'date', tope: c.hoy }) + '</div><div>' + campo('cnHasta', 'Hasta', N.hasta, { tipo: 'date' }) + '</div></div>');
}
function pintar(c) {
  hoja(N.reemplaza ? 'Emitir de nuevo el N.º ' + CB.numeroTexto(N.reemplaza) : 'Nuevo cobro',
    (N.reemplaza ? '<p class="note" id="cnReemplaza">El cobro N.º ' + esc(CB.numeroTexto(N.reemplaza)) + ' se anula y este lo reemplaza. Lo abonado a ese cobro pasa a este.</p>' : '') +
    '<label class="lab" for="cnCliente">Cliente</label><select class="txt" id="cnCliente"' + (N.reemplaza ? ' disabled' : '') + '>' + opcionesCliente(c, N.clienteId) + '</select>' +
    periodoCampos(c) + '<p class="muted chico" id="cnPeriodo"></p>' +
    campoDescuento('cn', N.desc) +
    '<div class="dos"><div>' + campo('cnPlazo', 'Plazo de pago (días)', N.plazo, { modo: 'numeric', max: 2, campo: 'plazo' }) + '</div><div>' + campo('cnFactura', 'N.º de factura SII (opcional)', N.factura, { max: 30 }) + '</div></div>' +
    '<div id="cnPrevia" aria-live="polite"></div>' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" id="cnEmitir" data-act="cn-emitir" disabled>' + svg('cobro') + 'Emitir cobro</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  previa(c); cargar(c);
}
/* Los canastos del período (del servidor o, sin conexión, de la copia del equipo). */
async function cargar(c) {
  const P = CB.validarPeriodo(N.desde, N.hasta, c.hoy), clave = N.desde + '|' + N.hasta;
  if (P.error || clave === N.clave) return;
  N.clave = clave; N.pes = null; previa(c);
  try { const r = await nube.consultarRango('pesajes', 'fecha', N.desde, N.hasta); if (N.clave !== clave) return; N.pes = r.filas; N.cache = r.cache; N.err = ''; }
  catch (e) { if (N.clave !== clave) return; N.pes = null; N.err = motivo(e); }
  previa(c);
}
/* Lo armado con lo que hay en la hoja: { a, descuento, plazo, bloqueo, cl } */
function armado(c) {
  const k = c.cat, cl = (k.clientes || []).find(x => x.id === N.clienteId), P = CB.validarPeriodo(N.desde, N.hasta, c.hoy);
  if (!cl) return { bloqueo: 'Elige el cliente.' };
  if (P.error) return { bloqueo: P.error, cl };
  const D = CB.validarDescuento(N.desc ? N.desc : { tipo: '' }); if (D.error) return { bloqueo: D.error, cl, P };
  const pl = CB.validarPlazo(N.plazo); if (pl.error) return { bloqueo: pl.error, cl, P };
  if (!N.pes) return { cargando: true, cl, P };
  const iva = cat.ivaDe(c.negocio), ls = V.deCliente(V.lineas(N.pes, k.productos, k.precios, k.clientes, iva), cl.id);
  const a = CB.armar(ls, { iva, descuento: D.descuento, productos: k.productos });
  return { a, cl, P, iva, descuento: D.descuento, plazo: pl.plazo, bloqueo: CB.bloqueo(a, cl.nombre) || (CB.empresaLista(c.empresa) ? '' : 'Faltan la razón social y el RUT de la panadería (Más → Cobros → Datos para documentos).') };
}
function previa(c) {
  const box = $('#cnPrevia'); if (!box) return;
  const X = armado(c), p = $('#cnPeriodo'), btn = $('#cnEmitir');
  if (p) p.textContent = X.P ? CB.periodoTexto(N.desde, N.hasta, N.tipo) + (X.P.aviso ? '. ' + X.P.aviso : '') : '';
  if (btn) { btn.disabled = !X.a || !!X.bloqueo; if (X.bloqueo) btn.setAttribute('aria-describedby', 'cnBloqueo'); else btn.removeAttribute('aria-describedby'); }
  if (N.err) { box.innerHTML = '<p class="note warn">' + esc(N.err) + '</p>'; return; }
  if (X.cargando) { box.innerHTML = '<div class="spin" role="status" aria-label="Leyendo los canastos"></div>'; return; }
  if (!X.a) { box.innerHTML = X.bloqueo ? '<p class="note warn" id="cnBloqueo">' + esc(X.bloqueo) + '</p>' : ''; return; }
  const a = X.a, af = A.aFavor(c.abonos, X.cl.id), so = CB.solape(c.cobros, X.cl.id, N.desde, N.hasta, N.reemplaza), falta = CB.faltaEmpresa(c.empresa).filter(k => !['razonSocial', 'rut'].includes(k));
  const dos = new Set(a.lineas.filter((l, i) => a.lineas.findIndex(x => x.productoId === l.productoId) !== i).map(l => l.productoId));
  box.innerHTML = '<p class="eyebrow">Vista previa</p>' +
    (a.lineas.length ? '<div class="hist" id="cnLineas">' + a.lineas.map(l => '<div class="hist-f"><span><b>' + esc(l.nombre) + '</b><small>' + esc(cant(l.cantidad, l.unidad) + ' × ' + cat.pesos(l.conIva) + ' con IVA' + (dos.has(l.productoId) ? ' · ' + fechaTexto(l.desde) + ' al ' + fechaTexto(l.hasta) : '')) + '</small></span><b>' + esc(cat.pesos(l.monto)) + '</b></div>').join('') + '</div>' : '') +
    (a.lineas.length ? '<div id="cnTotales">' + [['Subtotal', a.subtotal], a.descuento ? [a.descuento.texto, -a.descuento.conIva] : null, a.ajuste ? ['Ajuste por redondeo', a.ajuste] : null].filter(Boolean).map(x => '<div class="kv"><span>' + esc(x[0]) + '</span><b>' + esc(cat.pesos(x[1])) + '</b></div>').join('') +
      '<div class="kv"><span><b>Total del cobro</b></span><b id="cnTotal">' + esc(cat.pesos(a.total)) + '</b></div><p class="muted chico">Neto ' + esc(cat.pesos(a.netoFinal)) + ' · IVA ' + esc(cat.enCampo(X.iva)) + ' % ' + esc(cat.pesos(a.ivaMonto)) + ' · ' + a.anexo.length + (a.anexo.length === 1 ? ' día' : ' días') + ' con entregas · vence el ' + esc(fechaTexto(CB.vence(c.hoy, X.plazo))) + '</p></div>' : '') +
    (af > 0 && a.total ? '<p class="note" id="cnAFavor">Se aplica el saldo a favor del cliente: ' + esc(cat.pesos(Math.min(af, a.total))) + '. El cobro queda con saldo ' + esc(cat.pesos(Math.max(0, a.total - af))) + '.</p>' : '') +
    (so.length ? '<p class="note warn" id="cnSolape">' + esc(CB.solapeTexto(so)) + '.</p>' : '') +
    (N.cache ? '<p class="muted chico">Sin conexión: armado con lo guardado en este equipo.</p>' : '') +
    (X.bloqueo ? '<p class="note warn" id="cnBloqueo">' + esc(X.bloqueo) + '</p>' : falta.length ? '<p class="muted chico" id="cnFaltaEmp">Faltan datos de la panadería (' + falta.length + '): el PDF sale sin ellos.</p>' : '');
}

async function emitir(c, el) {
  const X = armado(c);
  if (!X.a || X.bloqueo) { error(X.bloqueo || 'Espera la vista previa.'); return; }
  if (navigator.onLine === false) { error(SIN_RED); return; }
  const so = CB.solape(c.cobros, X.cl.id, N.desde, N.hasta, N.reemplaza);
  if (so.length && !(await ask({ title: '¿Emitir igual?', text: CB.solapeTexto(so) + '.', ok: 'Emitir igual' }))) return;
  const fecha = hoyCl(), dc = CB.datosDe(c.cliCobro, X.cl.id), uid = c.user.uid, nombre = quien(c), orig = c.abonos || [];
  const armarDoc = n => {
    const datos = CB.documento({ numero: n, clienteId: X.cl.id, cliente: CB.clienteFijo(X.cl, dc), emisor: CB.emisorFijo(c.empresa), fecha, desde: N.desde, hasta: N.hasta, periodo: N.tipo, armado: X.a, iva: X.iva, plazo: X.plazo, factura: CB.validarFactura(valor('cnFactura')), reemplaza: N.reemplaza, por: uid, quien: nombre });
    let l = orig; if (N.reemplaza) l = A.moverDeCobro(l, N.reemplaza, n, datos.total);
    const ya = A.aplicados(l).get(n) || 0; l = A.aplicarAFavor(l, X.cl.id, n, Math.max(0, datos.total - ya));
    const cambios = A.diferencias(orig, l).map(d => ({ ruta: 'abonos/' + d.id, datos: { aplicado: d.aplicado, aFavor: d.aFavor } }));
    if (N.reemplaza) cambios.push({ ruta: 'cobros/' + CB.numeroTexto(N.reemplaza), datos: { anulado: { motivo: N.motivo || 'Reemplazado por el cobro N.º ' + CB.numeroTexto(n), reemplazo: n, por: uid, quien: nombre, en: nube.ahora() } } });
    return { datos, cambios };
  };
  const tocados = armarDoc(0).cambios.filter(x => x.ruta.startsWith('abonos/')).map(x => orig.find(a => 'abonos/' + a.id === x.ruta));
  const igual = a => d => !d.anulado && d.aFavor === a.aFavor && JSON.stringify((d.aplicado || []).map(x => [x.cobro, x.monto, !!x.previo])) === JSON.stringify((a.aplicado || []).map(x => [x.cobro, x.monto, !!x.previo]));
  el.disabled = true;
  try {
    const n = await nube.conFolio('cobro', 'cobros', armarDoc, tocados.map(a => ({ ruta: 'abonos/' + a.id, igual: igual(a) })));
    emitido = n; cerrarHoja(); toast('Cobro N.º ' + CB.numeroTexto(n) + ' emitido' + (N.reemplaza ? ' (reemplaza al N.º ' + CB.numeroTexto(N.reemplaza) + ')' : ''));
    document.dispatchEvent(new Event('pan:repintar'));
  } catch (e) { el.disabled = false; error(/unavailable|offline/i.test(String(e && (e.code || e.message))) ? SIN_RED : motivo(e)); }
}

export function alActuar(act, el, c) {
  if (act === 'cn-tipo') { N.tipo = el.dataset.v; let r = N.tipo === 'otro' ? { desde: N.desde, hasta: N.hasta } : CB.ultimoTerminado(N.tipo, c.hoy);
    if (r.hasta < CB.INICIO) r = N.tipo === 'semana' ? CB.semanaDe(c.hoy) : V.rangoMes(V.mesDe(c.hoy)); N.desde = r.desde < CB.INICIO ? CB.INICIO : r.desde; N.hasta = r.hasta; leerFormulario(); pintar(c); return true; }
  if (act === 'cn-emitir') { leerFormulario(); emitir(c, el); return true; }
  return false;
}
function leerFormulario() { if (!$('#cnPlazo')) return; const d = leerDescuento('cn'); N.desc = d.tipo ? d : null; N.plazo = valor('cnPlazo'); N.factura = valor('cnFactura'); }
export function alEscribir(el, c) {
  if (!el.closest || !el.closest('#dlg') || !$('#cnPrevia')) return false;
  if (el.id === 'cnCliente') { N.clienteId = el.value; N.clave = ''; habitual(c, {}); pintar(c); return true; }
  if (el.id === 'cnSemana' && cat.esFecha(el.value)) { const s = CB.semanaDe(el.value); N.desde = s.desde; N.hasta = s.hasta; leerFormulario(); pintar(c); return true; }
  if (el.id === 'cnMes' && V.esMes(el.value)) { const r = V.rangoMes(el.value); N.desde = r.desde; N.hasta = r.hasta; leerFormulario(); pintar(c); return true; }
  if ((el.id === 'cnDesde' || el.id === 'cnHasta') && cat.esFecha(el.value)) { N[el.id === 'cnDesde' ? 'desde' : 'hasta'] = el.value; previa(c); cargar(c); return true; }
  leerFormulario(); previa(c); return true;
}
