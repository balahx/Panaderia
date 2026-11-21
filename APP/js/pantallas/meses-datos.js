/* Datos de un mes para Indicadores y «Año y metas» (Fase 7), con la regla de la Fase 6: un mes CERRADO vale lo de su cierre
   (no se lee nada más); uno sin cerrar sale de sus pesajes con el precio vigente de cada día, igual que Entregas.
   Los pesajes llegan de dos maneras: el mes que la pantalla escucha en vivo (ctx.per, ver periodo() en indicadores.js) o, para los
   demás meses sin cerrar (el mes anterior, el del año pasado, la base de la proyección), una lectura única que queda guardada aquí
   10 minutos (nube.consultarRango: una lectura por canasto; sin conexión, la copia del equipo). Cerrar los meses ahorra lecturas.
   Fase 11: con `cliente` (el filtro de «El mes»), solo lo de ese cliente: sus canastos y, de un mes cerrado, sus líneas y sus totales.
   «Año y metas» no lo pasa: la proyección y las metas son del negocio entero. */
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as CI from '../core/cierres.js';
import * as I from '../core/indicadores.js';
import * as P from '../core/pesaje.js';
import { repintar } from '../core/ui.js';

const VIGENCIA = 10 * 60000, guardados = new Map();   // mes → { pesajes, cache, err, cargando, t }
export const olvidar = () => guardados.clear();
function pedir(mes) {
  const e = guardados.get(mes);
  if (e && (e.cargando || Date.now() - e.t < VIGENCIA)) return e;
  const n = { cargando: true, t: Date.now(), pesajes: e ? e.pesajes : null, cache: false, err: '' };
  guardados.set(mes, n);
  const r = V.rangoMes(mes);
  nube.consultarRango('pesajes', 'fecha', r.desde, r.hasta).then(x => { n.pesajes = x.filas; n.cache = x.cache; n.cargando = false; n.t = Date.now(); repintar(); },
    e2 => { n.err = String(e2 && (e2.code || e2.message) || 'error'); n.cargando = false; n.t = Date.now() - VIGENCIA + 30000; repintar(); });
  return n;
}
/* Resumen (core/indicadores.js, resumenMes) de un mes. Si aún no está: { mes, fuente: 'cargando' }; si falló: { fuente: 'error' };
   un mes que no llega: { fuente: 'futuro' }. `detalle`: también hace falta lo de cada día de un mes cerrado con la app. */
export function resumen(c, mes, detalle, cliente) {
  const k = c.cat, o0 = cat.clienteOriginal(k.clientes), cie = CI.cierreDeCliente(CI.cierreDe(c.cierres, mes), cliente, o0 && o0.id);
  const deCli = l => (cliente && l ? P.delCliente(l, cliente, o0 && o0.id) : l);
  const o = { cierre: cie, productos: k.productos, precios: k.precios, clientes: k.clientes, iva: cat.ivaDe(c.negocio), trabajadores: k.trabajadores, hoy: c.hoy };
  if (mes > V.mesDe(c.hoy)) return { mes, fuente: 'futuro', panes: [] };
  const per = c.per, vivo = per && per.pesajes && per.desde === V.rangoMes(mes).desde ? per.pesajes : null;
  if (vivo) return I.resumenMes(mes, Object.assign(o, { pesajes: deCli(vivo) }));
  const cerrado = cie && cie.cerrado === true;
  if (cerrado && (cie.origen === 'excel' || !detalle)) return I.resumenMes(mes, o);
  const e = pedir(mes);
  if (e.pesajes == null) return e.err ? { mes, fuente: 'error', err: e.err, panes: [] } : { mes, fuente: 'cargando', panes: [] };
  return Object.assign(I.resumenMes(mes, Object.assign(o, { pesajes: deCli(e.pesajes) })), e.cache ? { desdeEquipo: true } : {});
}
/* ¿Todavía falta algo? */
export const cargando = l => l.some(R => R && R.fuente === 'cargando');
/* Lista de catálogo y cierres lista para calcular (si no, la pantalla muestra el «cargando»). */
export const listos = c => !!(c.cat && c.cat.productos && c.cat.precios && c.cat.clientes && c.cat.trabajadores && c.cierres);
