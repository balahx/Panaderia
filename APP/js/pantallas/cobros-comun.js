/* Ayudas comunes de las pantallas de cobros (Fase 12): clientes que se cobran, enviar con internet, el PDF (descargar, compartir, imprimir),
   la etiqueta del estado de un cobro, campos de formulario y la hoja de «motivo» para anular. */
import { esc, diaChile } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { toast, cerrarHoja, descargar, compartir, abrirEnVisor } from '../core/ui.js';
import * as cat from '../core/catalogo.js';
import * as A from '../core/abonos.js';
import { MIME } from '../core/pdf.js';
import { error } from './catalogo-producto.js';

export const hoyCl = () => diaChile(new Date());
/* Clientes que se cobran: los regulares (activos y desactivados, para cobrar lo que quedó pendiente). «Ventas sueltas» se paga al momento. */
export const regulares = c => cat.ordenarClientes((c.cat && c.cat.clientes) || []).filter(x => !cat.esSuelta(x));
export const nombreCli = (c, id) => cat.nombreCliente(c.cat && c.cat.clientes, id);
export const opcionesCliente = (c, sel, vacio) => (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') +
  regulares(c).map(x => '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.nombre + (x.activo === false ? ' (desactivado)' : '')) + '</option>').join('');
export const listo = c => Array.isArray(c.cobros) && Array.isArray(c.abonos) && Array.isArray(c.cliCobro) && c.empresa !== undefined && !!c.cat && Array.isArray(c.cat.clientes);
export const quien = c => (c.user && c.user.nombre) || 'Sin nombre';

/* Envía un cambio que necesita internet (emitir, abonos, datos). Deja la hoja abierta hasta saber el resultado. */
export function motivo(e) {
  const m = String(e && (e.code || e.message) || e);
  if (/cambio/.test(m)) return 'Los abonos de este cliente cambiaron en otro equipo. Revisa y vuelve a intentarlo.';
  if (/unavailable|offline|network/i.test(m)) return 'Sin conexión con el servidor: inténtalo con internet.';
  if (/permission/.test(m)) return 'El servidor no lo permitió (revisa los datos o el acceso de esta cuenta).';
  if (/aborted/.test(m)) return 'Otro equipo estaba emitiendo al mismo tiempo. Vuelve a intentarlo.';
  return 'No se pudo guardar. Inténtalo de nuevo.';
}
export function enviar(promesa, hecho, boton, o) {
  if (navigator.onLine === false) { error('Sin conexión: esto se guarda con internet.'); return; }
  if (boton) boton.disabled = true;
  return promesa().then(r => { if (!(o && o.abierta)) cerrarHoja(); if (hecho) toast(typeof hecho === 'function' ? hecho(r) : hecho); if (o && o.luego) o.luego(r); return r; },
    e => { if (boton) boton.disabled = false; error(motivo(e)); });
}

/* PDF: 'bajar' | 'compartir' | 'imprimir'. `armar()` devuelve los bytes (se arma en el equipo: funciona sin internet). */
export async function pdf(modo, nombre, armar) {
  let b; try { b = armar(); } catch (e) { toast('No se pudo armar el PDF.'); return; }
  if (modo === 'compartir') { const r = await compartir(nombre, b, MIME); if (r === 'descargado') toast('Este equipo no comparte archivos: se descargó el PDF.'); }
  else if (modo === 'imprimir') { const r = await abrirEnVisor(nombre, b, MIME); if (r === 'descargado') toast('Se descargó el PDF: ábrelo para imprimirlo.'); }
  else { await descargar(nombre, b, MIME); toast('PDF descargado'); }
}
/* secundario (Fase 13, parte B): el PDF no es la acción principal de esa hoja (por ejemplo, la ficha de un cobro con saldo: «Pagar saldo») */
export const botonesPdf = (act, extra, secundario) => '<div class="actions pdf-b"><button class="btn' + (secundario ? ' ghost' : '') + '" data-act="' + act + '" data-modo="bajar"' + (extra || '') + '>' + svg('bajar') + 'Descargar PDF</button>' +
  '<button class="btn ghost" data-act="' + act + '" data-modo="compartir"' + (extra || '') + '>' + svg('compartir') + 'Compartir</button>' +
  '<button class="btn ghost" data-act="' + act + '" data-modo="imprimir"' + (extra || '') + '>' + svg('imprimir') + 'Imprimir</button></div>';

/* Estado de un cobro (core/abonos.js, estado) como etiqueta. */
export const badge = e => '<span class="badge ' + (e.estado === 'anulado' ? '' : e.vencido ? 'warn' : e.estado === 'pagado' ? 'ok' : '') + '">' + esc(A.etiqueta(e)) + '</span>';
/* Campo con etiqueta. o = { tipo, max, modo (inputmode), ayuda, campo (data-campo), enter } */
export function campo(id, etiqueta, valor, o) {
  o = o || {};
  return '<label class="lab" for="' + id + '">' + esc(etiqueta) + '</label><input class="txt" id="' + id + '"' + (o.tipo ? ' type="' + o.tipo + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
    (o.modo ? ' inputmode="' + o.modo + '"' : '') + (o.campo ? ' data-campo="' + o.campo + '"' : '') + (o.enter ? ' data-enter="' + o.enter + '"' : '') + (o.tope ? ' max="' + o.tope + '"' : '') + ' autocomplete="off" value="' + esc(valor == null ? '' : valor) + '">' +
    (o.ayuda ? '<p class="muted chico">' + esc(o.ayuda) + '</p>' : '');
}
export const valor = id => { const e = document.getElementById(id); return e ? e.value : ''; };
/* Descuento: tipo, valor y texto (lo usan los datos de cobro, el cobro y la cotización). */
export function campoDescuento(pre, d) {
  d = d || {};
  return '<fieldset class="radios" id="' + pre + 'Tipo"><legend class="lab">Descuento</legend>' +
    [['', 'Sin descuento'], ['pct', 'En %'], ['monto', 'En $ con IVA']].map(x => '<label class="radio"><input type="radio" name="' + pre + 'Tipo" value="' + x[0] + '"' + ((d.tipo || '') === x[0] ? ' checked' : '') + '><span>' + x[1] + '</span></label>').join('') + '</fieldset>' +
    '<div class="dos"><div>' + campo(pre + 'Valor', 'Cuánto', d.valor != null ? cat.enCampo(d.valor) : '', { modo: 'decimal', max: 12, campo: 'dValor' }) + '</div><div>' + campo(pre + 'Texto', 'Texto en el documento', d.texto || '', { max: 60 }) + '</div></div>';
}
export const leerDescuento = pre => { const t = document.querySelector('input[name="' + pre + 'Tipo"]:checked'); return { tipo: t ? t.value : '', valor: valor(pre + 'Valor'), texto: valor(pre + 'Texto') }; };
/* Hoja para escribir el motivo de una anulación (obligatorio). */
export const motivoHTML = (texto, act, extra, boton) => '<p>' + esc(texto) + '</p><label class="lab" for="motivo">Motivo</label><input class="txt" id="motivo" data-campo="motivo" maxlength="200" autocomplete="off">' +
  '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn danger" data-act="' + act + '"' + (extra || '') + '>' + esc(boton || 'Anular') + '</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>';
export function leerMotivo() { const m = cat.limpiar(valor('motivo'), 200); if (m.length < 3) { error('Escribe el motivo (lo verán los dueños y el externo).', 'motivo'); return ''; } return m; }
