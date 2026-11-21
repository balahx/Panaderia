/* Franjas de aviso sobre cada pantalla (#banner):
   · accesos por revisar (solo dueños, pantallas/accesos.js)
   · ventas sin precio (dueños y externo): un pan pesado un día sin precio vigente se registra igual, pero no suma pesos
     hasta que se anote su precio. Se revisa lo que la app ya tiene a mano: el día que se mira y el período de Entregas o Registro.
   · respaldo semanal (dueños y externo): si pasó una semana sin descargar uno. «Más tarde» lo calla hasta mañana en este equipo. */
import { esc, fechaTexto } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { puede } from '../core/perfil.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as R from '../core/respaldo.js';
import { aviso as avisoAccesos } from './accesos.js';

const LUEGO = 'pan.respaldoLuego';
const leer = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };

/* Panes vendidos sin precio en lo que se tiene cargado (o [] si falta algo para saberlo). */
export function faltan(c) {
  const k = c.cat; if (!k || !k.productos || !k.precios || !k.clientes) return [];
  if (!k.clientes.length) return [];
  const iva = cat.ivaDe(c.negocio), de = l => (l ? V.faltanPrecios(V.lineas(l, k.productos, k.precios, k.clientes, iva)) : []);   // cada línea con el precio de su cliente (Fase 11)
  return V.juntarFaltan(de(c.dia && c.dia.pesajes), de(c.per && c.per.pesajes));
}
function sinPrecio(c, tab) {
  const f = faltan(c); if (!f.length) return '';
  const fechas = x => x.fechas.slice(0, 3).map(fechaTexto).map(t => t.replace(/ \d{4}$/, '')).join(', ') + (x.fechas.length > 3 ? '…' : '');
  const txt = f.slice(0, 3).map(x => x.nombre + ' (' + fechas(x) + ')').join(' · ') + (f.length > 3 ? ' y ' + (f.length - 3) + ' más' : '');
  const t = svg('warn') + '<span>Vendido sin precio: ' + esc(txt) + '. No suma pesos hasta que anotes el precio' + (tab === 'catalogo' ? ' (con «desde» en ese día o antes)' : '') + '.</span>';
  return tab === 'catalogo' ? '<div class="aviso franja" id="avisoSinPrecio" role="status">' + t + '</div>'
    : '<button class="aviso" id="avisoSinPrecio" data-act="ir" data-tab="catalogo">' + t + svg('chev', 'go') + '</button>';
}
function respaldo(c, tab) {
  if (tab === 'datos' || !R.toca(c.respaldo) || leer(LUEGO) === c.hoy) return '';
  const d = R.diasDesde(c.respaldo);
  return '<div class="aviso franja" id="avisoRespaldo" role="status">' + svg('cloud') + '<span>' + (d === null ? 'Todavía no hay ningún respaldo de los datos.' : 'Último respaldo hace ' + d + ' días.') + ' Conviene descargar uno cada semana.</span>' +
    '<span class="franja-b"><button class="btn sm" data-act="ir" data-tab="datos">Descargar</button><button class="btn ghost sm" data-act="aviso-luego">Más tarde</button></span></div>';
}
export function html(c, tab) {
  const a = tab === 'accesos' ? '' : avisoAccesos(c);
  if (!puede(c.perfil, 'gestion')) return a;
  return a + sinPrecio(c, tab) + respaldo(c, tab);
}
export function alActuar(act, el, c) {
  if (act !== 'aviso-luego') return false;
  try { localStorage.setItem(LUEGO, c.hoy); } catch (e) { /* sin almacenamiento: la franja vuelve a salir */ }
  return true;
}
