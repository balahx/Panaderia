/* Ficha del cliente (Catálogo → Clientes e IVA), Fase 12: el bloque «Por cobrar» (saldo pendiente, vencido, saldo a favor y cuántos cobros
   con saldo) con «Nuevo cobro», «Anotar abono» y «Estado de cuenta» (llevan a Cobros), y la hoja «Datos de cobro»: razón social, RUT,
   dirección, contacto, período habitual (semanal o mensual), plazo de pago y descuento habitual. Se guardan en clientesCobro/{id}, aparte de
   clientes/{id} (que lee la tablet): así la tablet nunca ve RUT, descuentos ni montos. «Ventas sueltas» no tiene cobros. */
import { esc } from '../core/formato.js';
import { $, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as CB from '../core/cobros.js';
import * as A from '../core/abonos.js';
import { error } from './catalogo-producto.js';
import { campo, valor, campoDescuento, leerDescuento, enviar } from './cobros-comun.js';

const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const ir = (cl, que, t, prim) => '<button class="btn' + (prim ? '' : ' ghost') + '" data-act="ir" data-tab="cobros" data-cli="' + esc(cl.id) + '" data-abrir="' + que + '">' + t + '</button>';
export function resumenDatos(dc) {
  if (!dc) return 'Sin datos de cobro: el cobro saldrá con el nombre del cliente, mensual, a ' + CB.PLAZO + ' días.';
  return [dc.razonSocial, dc.rut ? 'RUT ' + dc.rut : '', CB.PERIODOS[dc.periodo], 'plazo ' + dc.plazo + (dc.plazo === 1 ? ' día' : ' días'), dc.descuento ? CB.textoDescuento(dc.descuento) : ''].filter(Boolean).join(' · ');
}
/* El bloque para la hoja del cliente. Vacío mientras no llegan los cobros. */
export function bloque(cl, c) {
  if (!cl) return '';
  if (cat.esSuelta(cl)) return '<p class="muted chico" id="cliSinCobros">Ventas sueltas no tiene cobros: se paga al momento.</p>';
  if (!Array.isArray(c.cobros) || !Array.isArray(c.abonos) || !Array.isArray(c.cliCobro)) return '';
  const cu = A.cuenta(c.cobros, c.abonos, cl.id, c.hoy), dc = CB.datosDe(c.cliCobro, cl.id);
  return '<section class="sec" id="cliCobro"><p class="eyebrow">Por cobrar</p>' + kv('Saldo pendiente', cat.pesos(cu.porCobrar), 'cliPorCobrar') + kv('Vencido', cat.pesos(cu.vencido), 'cliVencido') +
    kv('Saldo a favor', cat.pesos(cu.aFavor), 'cliAFavor') + kv('Cobros con saldo', cu.conSaldo + (cu.vencidos ? ' (' + cu.vencidos + (cu.vencidos === 1 ? ' vencido)' : ' vencidos)') : '')) +
    '<p class="muted chico" id="cliDatosCobro">' + esc(resumenDatos(dc)) + '</p>' +
    '<div class="actions">' + ir(cl, 'nuevo', 'Nuevo cobro', true) + ir(cl, 'abono', 'Anotar abono') + ir(cl, 'cuenta', 'Estado de cuenta') +
    '<button class="btn ghost" data-act="cc-datos" data-id="' + esc(cl.id) + '">Datos de cobro</button></div></section>';
}
function hojaDatos(cl, c) {
  const dc = CB.datosDe(c.cliCobro, cl.id) || {}, per = dc.periodo || 'mes';
  hoja('Datos de cobro · ' + cl.nombre, '<p class="muted">Van en los cobros de este cliente. Cada cobro copia los datos del momento en que se emite.</p>' +
    campo('ccRazon', 'Razón social', dc.razonSocial || '', { max: 100 }) + campo('ccRut', 'RUT', dc.rut || '', { max: 12, campo: 'rut' }) + campo('ccDireccion', 'Dirección', dc.direccion || '', { max: 150 }) +
    campo('ccContacto', 'Contacto', dc.contacto || '', { max: 100, ayuda: 'Nombre, teléfono o correo. Mejor el de la empresa que uno personal.' }) +
    '<fieldset class="radios"><legend class="lab">Se le cobra</legend>' + [['semana', 'Por semana'], ['mes', 'Por mes']].map(x => '<label class="radio"><input type="radio" name="ccPeriodo" value="' + x[0] + '"' + (per === x[0] ? ' checked' : '') + '><span>' + x[1] + '</span></label>').join('') + '</fieldset>' +
    campo('ccPlazo', 'Plazo de pago (días)', dc.plazo != null ? dc.plazo : CB.PLAZO, { modo: 'numeric', max: 2, campo: 'plazo' }) + campoDescuento('cc', dc.descuento) +
    '<p class="muted chico">El descuento habitual viene puesto en cada cobro nuevo, y ahí se puede cambiar o quitar.</p>' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="cc-guardar" data-id="' + esc(cl.id) + '">Guardar</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  $('#ccRazon').focus();
}
export function alActuar(act, el, c) {
  if (!act.startsWith('cc-')) return false;
  const cl = (c.cat.clientes || []).find(x => x.id === el.dataset.id); if (!cl) return true;
  if (act === 'cc-datos') hojaDatos(cl, c);
  else if (act === 'cc-guardar') {
    const p = document.querySelector('input[name="ccPeriodo"]:checked');
    const v = CB.validarDatosCobro({ razonSocial: valor('ccRazon'), rut: valor('ccRut'), direccion: valor('ccDireccion'), contacto: valor('ccContacto'), periodo: p ? p.value : '', plazo: valor('ccPlazo'), descuento: leerDescuento('cc') });
    if (v.error) { error(v.error, v.campo); return true; }
    enviar(() => nube.guardar('clientesCobro/' + cl.id, Object.assign(v.datos, { por: c.user.uid })), 'Datos de cobro de ' + cl.nombre + ' guardados', el);
  }
  return true;
}
