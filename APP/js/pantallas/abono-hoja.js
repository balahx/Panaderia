/* Abonos (Fase 12): anotar un pago (total o parcial) de la cuenta de un cliente, repartirlo entre sus cobros con saldo (la app lo reparte sola
   desde el más antiguo; se puede cambiar a mano), ver un abono, cambiar su reparto (queda quién y cuándo) y anularlo (con motivo).
   Lo que sobra queda a favor del cliente y se aplica solo a su próximo cobro (core/abonos.js). Se guarda con internet. */
import { esc, fechaTexto } from '../core/formato.js';
import { $, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import { error } from './catalogo-producto.js';
import { hoyCl, opcionesCliente, nombreCli, campo, valor, enviar, motivoHTML, leerMotivo, quien } from './cobros-comun.js';

const B = { clienteId: '', id: '', auto: true, partes: [] };
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const montoDe = () => { const m = cat.numero(valor('abMonto')); return Number.isNaN(m) ? 0 : Math.round(m); };

/* Cobros con saldo del cliente (sin contar el abono que se edita), con su campo de monto. */
function repartoHTML(c) {
  const A0 = A.aplicados(c.abonos, B.id), cs = A.antiguos((c.cobros || []).filter(x => x.clienteId === B.clienteId && !x.anulado))
    .filter(x => A.saldoDe(x, A0) > 0 || B.partes.some(p => p.cobro === x.numero && p.monto > 0));
  if (!cs.length) return '<p class="muted chico" id="abSinCobros">Este cliente no tiene cobros con saldo: todo queda a favor y se aplica solo a su próximo cobro.</p>';
  return '<p class="eyebrow">A qué cobros va</p><div id="abPartes">' + cs.map(x => { const p = B.partes.find(y => y.cobro === x.numero);
    return campo('ab-p-' + x.numero, 'N.º ' + CB.numeroTexto(x.numero) + ' · ' + CB.periodoTexto(x.desde, x.hasta, x.periodo) + ' · saldo ' + cat.pesos(A.saldoDe(x, A0)), p ? String(p.monto) : '', { modo: 'numeric', max: 12 }); }).join('') + '</div>' +
    '<div class="actions"><button class="btn ghost sm" data-act="ab-auto">Repartir solo (del más antiguo)</button></div>';
}
const partesForm = () => [...document.querySelectorAll('#abPartes input')].map(i => ({ cobro: Number(i.id.slice(5)), monto: Math.round(cat.numero(i.value || '0')) || 0 }));
function resto(c) {
  const box = $('#abResto'); if (!box) return;
  const m = B.id ? (A.vigentes(c.abonos).find(a => a.id === B.id) || {}).monto || 0 : montoDe(), suma = partesForm().reduce((t, p) => t + p.monto, 0);
  box.textContent = suma > m ? 'El reparto suma ' + cat.pesos(suma) + ': más que el abono.' : 'Queda a favor del cliente: ' + cat.pesos(m - suma);
}
function llenarAuto(c, monto) {
  const r = A.repartir(c.cobros, c.abonos, B.clienteId, monto, B.id); B.partes = r.aplicado;
  document.querySelectorAll('#abPartes input').forEach(i => { const p = B.partes.find(x => x.cobro === Number(i.id.slice(5))); i.value = p ? String(p.monto) : ''; });
  resto(c);
}

/* Anotar abono. o = { clienteId, monto, partes } (desde «Pagar saldo»: el saldo exacto, a ese cobro). */
export function abrirNuevo(c, o) {
  o = o || {}; B.id = ''; B.clienteId = o.clienteId || B.clienteId || ''; B.auto = !o.partes; B.partes = o.partes || [];
  const regs = c.cat.clientes.filter(x => !cat.esSuelta(x)); if (!regs.some(x => x.id === B.clienteId)) B.clienteId = (cat.clientePrincipal(c.cat.clientes) || regs[0] || {}).id || '';
  if (B.auto && o.monto) B.partes = A.repartir(c.cobros, c.abonos, B.clienteId, o.monto).aplicado;
  hoja('Anotar abono', '<label class="lab" for="abCliente">Cliente</label><select class="txt" id="abCliente">' + opcionesCliente(c, B.clienteId) + '</select>' +
    '<div class="dos"><div>' + campo('abFecha', 'Fecha del pago', hoyCl(), { tipo: 'date', tope: hoyCl(), campo: 'fecha' }) + '</div><div>' + campo('abMonto', 'Monto (pesos)', o.monto ? String(o.monto) : '', { modo: 'numeric', max: 14, campo: 'monto' }) + '</div></div>' +
    '<fieldset class="radios"><legend class="lab">Cómo pagó</legend>' + Object.keys(A.MEDIOS).map((k, i) => '<label class="radio"><input type="radio" name="abMedio" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span>' + A.MEDIOS[k] + '</span></label>').join('') + '</fieldset>' +
    campo('abNota', 'Nota (opcional)', '', { max: 120, ayuda: 'Por ejemplo, el n.º de la transferencia o del cheque.' }) +
    '<div id="abReparto">' + repartoHTML(c) + '</div><p class="muted chico" id="abResto" aria-live="polite"></p>' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="ab-guardar">Guardar abono</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  resto(c); $('#abMonto').focus();
}
/* Ficha de un abono. */
export function ver(c, id) {
  const a = (c.abonos || []).find(x => x.id === id); if (!a) return;
  hoja('Abono · ' + fechaTexto(a.fecha), '<div id="abFicha" data-id="' + esc(a.id) + '">' + (a.anulado ? '<p class="note warn">Anulado: ' + esc(a.anulado.motivo) + ' (' + esc(a.anulado.quien || '') + '). No cuenta en los saldos.</p>' : '') +
    kv('Cliente', nombreCli(c, a.clienteId)) + kv('Monto', cat.pesos(a.monto), 'abFMonto') + kv('Cómo pagó', A.MEDIOS[a.medio] || a.medio) + (a.nota ? kv('Nota', a.nota) : '') +
    (a.aplicado || []).map(x => kv('Aplicado al N.º ' + CB.numeroTexto(x.cobro) + (x.previo ? ' (saldo a favor)' : ''), cat.pesos(x.monto))).join('') + kv('Quedó a favor', cat.pesos(a.aFavor || 0), 'abFAFavor') +
    kv('Anotado por', a.quien || '—') + (a.reparto ? kv('Reparto cambiado por', a.reparto.quien) : '') +
    (a.anulado ? '' : '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn ghost" data-act="ab-reparto" data-id="' + esc(a.id) + '">Cambiar reparto</button><button class="btn ghost" data-act="ab-anular" data-id="' + esc(a.id) + '">Anular abono</button></div>') + '</div>');
}
function hojaReparto(c, a) {
  B.id = a.id; B.clienteId = a.clienteId; B.auto = false; B.partes = (a.aplicado || []).map(x => ({ cobro: x.cobro, monto: x.monto }));
  hoja('Cambiar reparto · ' + cat.pesos(a.monto), '<p class="muted">Abono del ' + esc(fechaTexto(a.fecha)) + ' de ' + esc(nombreCli(c, a.clienteId)) + '. Lo que no se reparta queda a favor del cliente.</p>' +
    '<div id="abReparto">' + repartoHTML(c) + '</div><p class="muted chico" id="abResto" aria-live="polite"></p>' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="ab-reparto-ok" data-id="' + esc(a.id) + '">Guardar reparto</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  resto(c);
}

export function alActuar(act, el, c) {
  if (!act.startsWith('ab-')) return false;
  const a = (c.abonos || []).find(x => x.id === el.dataset.id);
  if (act === 'ab-nuevo') abrirNuevo(c, { clienteId: el.dataset.cli || '' });
  else if (act === 'ab-ver') ver(c, el.dataset.id);
  else if (act === 'ab-auto') llenarAuto(c, B.id ? (a || A.vigentes(c.abonos).find(x => x.id === B.id) || {}).monto || 0 : montoDe());
  else if (act === 'ab-guardar') {
    const md = document.querySelector('input[name="abMedio"]:checked');
    const v = A.validarAbono({ clienteId: B.clienteId, fecha: valor('abFecha'), monto: valor('abMonto'), medio: md ? md.value : '', nota: valor('abNota') }, hoyCl());
    if (v.error) { error(v.error, v.campo); return true; }
    const r = A.validarReparto(c.cobros, c.abonos, B.clienteId, v.datos.monto, partesForm()); if (r.error) { error(r.error); return true; }
    enviar(() => nube.guardar('abonos/' + cat.nuevoId(), A.documento(v.datos, r.aplicado, r.aFavor, c.user.uid, quien(c))),
      'Abono de ' + cat.pesos(v.datos.monto) + ' anotado' + (r.aFavor ? ' · ' + cat.pesos(r.aFavor) + ' a favor' : ''), el);
  } else if (act === 'ab-reparto' && a) hojaReparto(c, a);
  else if (act === 'ab-reparto-ok' && a) {
    const r = A.validarReparto(c.cobros, c.abonos, a.clienteId, a.monto, partesForm(), a.id); if (r.error) { error(r.error); return true; }
    enviar(() => nube.cambiar('abonos/' + a.id, { aplicado: r.aplicado, aFavor: r.aFavor, reparto: { por: c.user.uid, quien: quien(c), en: nube.ahora() } }), 'Reparto guardado', el);
  } else if (act === 'ab-anular' && a) { hoja('Anular abono de ' + cat.pesos(a.monto), motivoHTML('El abono deja de contar: los cobros a los que se aplicó vuelven a tener ese saldo.', 'ab-anular-ok', ' data-id="' + esc(a.id) + '"', 'Anular abono')); $('#motivo').focus(); }
  else if (act === 'ab-anular-ok' && a) { const m = leerMotivo(); if (m) enviar(() => nube.cambiar('abonos/' + a.id, { anulado: { motivo: m, por: c.user.uid, quien: quien(c), en: nube.ahora() } }), 'Abono anulado', el); }
  return true;
}
export function alEscribir(el, c) {
  if (el.id === 'abCliente') { B.clienteId = el.value; B.auto = true; B.partes = []; $('#abReparto').innerHTML = repartoHTML(c); llenarAuto(c, montoDe()); return true; }
  if (el.id === 'abMonto') { if (B.auto) llenarAuto(c, montoDe()); else resto(c); return true; }
  if (/^ab-p-/.test(el.id)) { B.auto = false; B.partes = partesForm(); resto(c); return true; }
  return /^ab/.test(el.id) || el.name === 'abMedio';
}
