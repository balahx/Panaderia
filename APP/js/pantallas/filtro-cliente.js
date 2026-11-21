/* Filtro «Cliente: Todos ▾» (Fase 11), común a Hoy, Entregas, Registro y Números: el total del negocio o lo de un cliente.
   La elección es una sola para esas pantallas (se mantiene al cambiar de una a otra mientras la app esté abierta).
   Con un solo cliente el filtro no aparece y todo queda como antes. Lo pesado sin `clienteId` es del cliente original. */
import { esc } from '../core/formato.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';

let sel = '';
const todos = c => cat.ordenarClientes(c.cat && c.cat.clientes);
/* ¿Hay más de un cliente (activo o no)? Solo entonces se muestra el filtro y se nombra el cliente de cada cosa. */
export const varios = c => todos(c).length > 1;
/* Cliente elegido ('' = todos). Si el elegido ya no existe, vuelve a «Todos». */
export const elegido = c => (sel && varios(c) && todos(c).some(x => x.id === sel) ? sel : '');
export const cliente = c => { const id = elegido(c); return id ? todos(c).find(x => x.id === id) : null; };
export const original = c => { const o = cat.clienteOriginal(c.cat && c.cat.clientes); return o ? o.id : null; };
/* Los pesajes del cliente elegido (o todos). */
export const pesajes = (c, l) => { const id = elegido(c); return id ? P.delCliente(l, id, original(c)) : l || []; };
/* El selector (vacío si hay un solo cliente). `id`: el del campo, distinto en cada pantalla. */
export function selector(c, id) {
  if (!varios(c)) return '';
  const e = elegido(c);
  return '<div class="filtro-cliente"><label class="lab" for="' + id + '">Cliente</label><select class="txt" id="' + id + '" data-filtro-cliente="1">' +
    '<option value="">Todos (el negocio entero)</option>' + todos(c).map(x => '<option value="' + esc(x.id) + '"' + (x.id === e ? ' selected' : '') + '>' + esc(x.nombre + (x.activo === false ? ' (desactivado)' : '')) + '</option>').join('') + '</select></div>';
}
/* Si el campo es el filtro, guarda la elección y devuelve true (la pantalla se vuelve a dibujar). */
export function alEscribir(el) {
  if (!el || !el.dataset || !el.dataset.filtroCliente) return false;
  sel = el.value || ''; return true;
}
