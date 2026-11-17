/* Cierres mensuales (dueños y externo), desde «Más → Registros» (PLAN §3.7, Fase 6): cada mes del año con su estado (cerrado desde
   Excel o con la app, reabierto, sin cerrar, en curso), su detalle por pan, «Reabrir» (solo dueños) y la importación de los meses
   anteriores desde Excel (pantallas/cierres-importar.js). «Cerrar mes» con los datos de la app se hace en Entregas (cerrarMes, abajo),
   donde se ve el mes completo antes de cerrarlo. Un mes cerrado no se modifica: sus totales son los del cierre. */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { errorHTML, svg } from '../core/iconos.js';
import { ask, hoja, cerrarHoja, toast, repintar, descargar } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as P from '../core/pesaje.js';
import * as CI from '../core/cierres.js';
import { crear, MIME } from '../core/xlsx.js';
import { puede } from '../core/perfil.js';
import * as imp from './cierres-importar.js';

let anio = 0;   // año que se mira (0 = el de hoy)
const anioDe = c => anio || Number(c.hoy.slice(0, 4));
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const cuando = ms => (typeof ms === 'number' ? fechaTexto(diaChile(new Date(ms))) : '');
const motivo = e => { const m = String(e && (e.code || e.message) || e); return /unavailable|offline|network/i.test(m) ? 'sin conexión con el servidor' : /permission/.test(m) ? 'el servidor no lo permitió' : m; };
export const totalesTexto = x => P.textoTotales({ kg: x.kg, un: x.un });

/* ---------- Cerrar un mes con los datos de la app (lo llama Entregas) ---------- */
let cerrando = '';
export const cerrandoMes = () => cerrando;
export async function cerrarMes(c, mes) {
  if (cerrando) return;
  if (!CI.sePuedeCerrar(mes, c.hoy)) { toast('Un mes se cierra cuando termina.'); return; }
  if (navigator.onLine === false) { toast('Para cerrar el mes hace falta internet: así se cierra con todo lo anotado.'); return; }
  const k = c.cat || {}, cli = cat.clientePrincipal(k.clientes), ya = CI.cierreDe(c.cierres, mes), iva = cat.ivaDe(c.negocio);
  if (!k.productos || !k.precios) { toast('Espera a que cargue el catálogo.'); return; }
  if (ya && ya.cerrado) { toast('Ese mes ya está cerrado.'); return; }
  cerrando = mes; repintar();
  try {
    if (await nube.pendientes(1500)) { toast('Hay canastos anotados en este equipo que aún no llegan al servidor. Espera a que se envíen y vuelve a intentarlo.', 7000); return; }
    const r = V.rangoMes(mes), R = CI.desdeApp(mes, await nube.leerRango('pesajes', 'fecha', r.desde, r.hasta), k, cli, iva, { por: c.user.uid, quien: c.user.nombre, antes: ya });
    if (!R.L.length) { toast('Ese mes no tiene canastos en la app. Si se vendió, impórtalo desde Excel (Más → Cierres mensuales).', 7000); return; }
    const d = R.doc;
    const si = await ask({ title: '¿Cerrar ' + V.mesTexto(mes) + '?',
      text: 'Neto ' + cat.pesos(d.neto) + ' · IVA ' + cat.pesos(d.ivaMonto) + ' (' + cat.enCampo(iva) + ' % del neto del mes) · Total ' + cat.pesos(d.total) + ' · ' + totalesTexto(d) + '. ' +
        (R.faltan.length ? 'Ojo: ' + R.faltan.map(x => x.nombre).join(', ') + ' sin precio algún día (no suman). ' : '') +
        'Cerrado, en ese mes ya no se anota ni se corrige' + (puede(c.perfil, 'accesos') ? ' (puedes reabrirlo).' : '; solo un dueño puede reabrirlo.'),
      ok: 'Cerrar el mes' });
    if (!si) return;
    await nube.guardar('cierres/' + mes, d);
    toast(cap(V.mesTexto(mes)) + ' quedó cerrado');
  } catch (e) { toast('No se pudo cerrar el mes: ' + motivo(e) + '.'); }
  finally { cerrando = ''; repintar(); }
}

async function reabrir(c, mes) {
  if (!puede(c.perfil, 'accesos')) return;
  if (navigator.onLine === false) { toast('Para reabrir el mes hace falta internet.'); return; }
  const x = CI.cierreDe(c.cierres, mes);
  const si = await ask({ title: '¿Reabrir ' + V.mesTexto(mes) + '?', danger: true, ok: 'Reabrir',
    text: 'Se podrá volver a anotar y corregir en ese mes. Mientras esté reabierto, sus totales salen de lo anotado en la app' +
      (x && x.origen === 'excel' ? ' (este mes vino de Excel: quedará sin datos hasta que lo vuelvas a importar)' : '') + '. Queda constancia de que lo reabriste.' });
  if (!si) return;
  try { await nube.reabrir(mes, c.user.nombre); cerrarHoja(); toast(cap(V.mesTexto(mes)) + ' quedó reabierto'); }
  catch (e) { toast('No se pudo reabrir: ' + motivo(e) + '.'); }
}

/* ---------- Pantalla ---------- */
function fila(c, mes) {
  const x = CI.cierreDe(c.cierres, mes), e = CI.estadoMes(x, mes, c.hoy), nombre = cap(V.mesTexto(mes).replace(/ \d{4}$/, ''));
  const det = e === 'cerrado' ? 'Cerrado ' + CI.textoOrigen(x) + ' · ' + cat.pesos(x.neto) + ' neto'
    : e === 'reabierto' ? 'Reabierto' + (x.reabiertoQuien ? ' por ' + x.reabiertoQuien : '') + (x.reabiertoEn ? ' el ' + cuando(x.reabiertoEn) : '') + ' · ciérralo de nuevo'
    : e === 'en-curso' ? 'En curso · se cierra cuando termine' : 'Sin cerrar · se cierra en Entregas o se importa desde Excel';
  const badge = e === 'cerrado' ? '<span class="badge ok">Cerrado</span>' : e === 'en-curso' ? '' : '<span class="badge warn">' + (e === 'reabierto' ? 'Reabierto' : 'Sin cerrar') + '</span>';
  return '<button class="mrow" data-act="cie-ver" data-mes="' + mes + '">' + svg(e === 'cerrado' ? 'check' : 'file') + '<span class="mt"><b>' + esc(nombre) + '</b><small>' + esc(det) + '</small></span>' + badge + svg('chev', 'go') + '</button>';
}
export function html(c) {
  if (imp.activo()) return imp.html(c);
  const a = anioDe(c), ahora = V.mesDe(c.hoy), esteAnio = a >= Number(c.hoy.slice(0, 4));
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Cierres mensuales</span><h1>Cierres ' + a + '</h1>' +
    '<div class="dia-nav" role="group" aria-label="Cambiar de año"><button class="btn ghost sm" data-act="cie-anio" data-d="-1">‹ ' + (a - 1) + '</button>' +
    '<button class="btn ghost sm" data-act="cie-anio" data-d="1"' + (esteAnio ? ' disabled' : '') + '>' + (a + 1) + ' ›</button></div>';
  if (c.errCat) return cab + errorHTML('No se pudieron leer los datos (' + c.errCat + ').', { retry: 'recargar' });
  if (!c.cierres || !c.cat || !c.cat.productos) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const meses = []; for (let m = 1; m <= 12; m++) { const k = a + '-' + String(m).padStart(2, '0'); if (k <= ahora) meses.push(k); }
  const cerrados = meses.map(m => CI.cierreDe(c.cierres, m)).filter(x => x && x.cerrado);
  const neto = cerrados.reduce((t, x) => t + (x.neto || 0), 0);
  return cab + imp.resultado() +
    '<section class="card sec" id="cieImportar"><span class="eyebrow">Meses anteriores</span><h2>Importar desde Excel</h2>' +
    '<p class="muted">Elige uno o varios archivos .xlsx con los totales del mes por pan (kilos o unidades, precio y monto). Antes de guardar vas a revisar cada mes y emparejar los nombres con el catálogo.</p>' +
    '<label class="lab" for="cieArchivo">Archivos de Excel (.xlsx)</label><input class="txt archivo" type="file" id="cieArchivo" multiple accept=".xlsx,' + MIME + '">' +
    '<div class="actions"><button class="btn ghost sm" data-act="cie-plantilla">' + svg('bajar') + 'Descargar una plantilla</button></div></section>' +
    '<section class="sec" id="cieMeses"><h2>' + a + '</h2>' +
    (meses.length ? '<div class="stats"><div class="stat"><b>' + cerrados.length + ' de ' + meses.length + '</b><span>meses cerrados</span></div><div class="stat"><b>' + esc(cat.pesos(neto)) + '</b><span>neto de los cerrados</span></div></div>' +
      '<div class="mlist">' + meses.map(m => fila(c, m)).join('') + '</div>' : '<p class="muted">Ese año todavía no empieza.</p>') + '</section>' +
    '<p class="muted chico">El IVA de un cierre es el ' + esc(cat.enCampo(cat.ivaDe(c.negocio))) + ' % del neto del mes, calculado una vez. En un mes cerrado no se anota ni se corrige.</p>';
}

function verMes(c, mes) {
  const x = CI.cierreDe(c.cierres, mes), e = CI.estadoMes(x, mes, c.hoy), ir = '<button class="btn ghost" data-act="ir" data-tab="entregas" data-mes="' + mes + '">Ver en Entregas</button>';
  if (!x) {
    hoja(cap(V.mesTexto(mes)), '<div id="cieDetalle"><p>' + (e === 'en-curso' ? 'El mes está en curso: se cierra desde Entregas cuando termine.' : 'Este mes no está cerrado. Si se anotó en la app, revísalo y ciérralo en Entregas; si no, impórtalo desde Excel.') + '</p></div>' +
      '<div class="actions"><button class="btn" data-act="ir" data-tab="entregas" data-mes="' + mes + '">' + (e === 'en-curso' ? 'Ver en Entregas' : 'Revisar y cerrar en Entregas') + '</button></div>');
    return;
  }
  const pct = cat.enCampo(typeof x.iva === 'number' ? x.iva : cat.ivaDe(c.negocio));
  const panes = (x.lineas || []).map(l => '<div class="mrow fija"><span class="mt"><b>' + esc(l.nombre) + '</b><small>' + esc(P.textoCantidad(l.cantidad || 0, l.unidad)) +
    (l.precio != null ? ' · ' + esc(cat.pesos(l.precio)) + (l.unidad === 'un' ? ' c/u' : ' el kg') : '') + (l.nombreExcel && l.nombreExcel !== l.nombre ? ' · en el Excel: ' + esc(l.nombreExcel) : '') + '</small></span>' +
    '<span class="precio"><b>' + (l.sinPrecio && !l.neto ? 'Sin precio' : esc(cat.pesos(l.neto || 0))) + '</b><small>neto</small></span></div>').join('');
  hoja(cap(V.mesTexto(mes)), '<div id="cieDetalle">' +
    kv('Estado', e === 'cerrado' ? 'Cerrado ' + CI.textoOrigen(x) : 'Reabierto: sus totales salen de la app hasta que se cierre de nuevo') +
    (x.origen === 'excel' ? kv('Archivo', (x.archivo || '—') + (x.hoja ? ' · ' + x.hoja : '')) : kv('Canastos', (x.canastos || 0) + ' en ' + (x.dias || 0) + (x.dias === 1 ? ' día' : ' días'))) +
    kv('Cerrado por', (x.quien || '—') + (x.en ? ' · ' + cuando(x.en) : '')) + (x.reabiertoQuien ? kv('Reabierto por', x.reabiertoQuien + (x.reabiertoEn ? ' · ' + cuando(x.reabiertoEn) : '')) : '') +
    kv('Neto', cat.pesos(x.neto)) + kv('IVA (' + pct + ' % del neto)', cat.pesos(x.ivaMonto)) + kv('Total', cat.pesos(x.total), 'cieTotal') + kv('Cantidad', totalesTexto(x)) +
    (x.sinPrecio ? '<p class="warn-t">Al cerrar había ' + x.sinPrecio + (x.sinPrecio === 1 ? ' pan vendido' : ' panes vendidos') + ' sin precio: no suman.</p>' : '') +
    '<h3 class="reg-dia">Por pan</h3><div class="mlist">' + panes + '</div></div>' +
    '<div class="actions">' + ir + (e === 'cerrado' && puede(c.perfil, 'accesos') ? '<button class="btn ghost danger" data-act="cie-reabrir" data-mes="' + mes + '">Reabrir el mes</button>' : '') + '</div>' +
    (e === 'cerrado' && !puede(c.perfil, 'accesos') ? '<p class="muted chico">Solo un dueño puede reabrir un mes cerrado.</p>' : ''));
}

export function alActuar(act, el, c) {
  if (imp.activo()) { const r = imp.alActuar(act, el, c); if (r) return r; }
  if (act === 'recargar') { location.reload(); return true; }
  if (act === 'cie-anio') { anio = Math.min(Number(c.hoy.slice(0, 4)), anioDe(c) + Number(el.dataset.d)); return 'repintar'; }
  if (act === 'cie-ver') { verMes(c, el.dataset.mes); return true; }
  if (act === 'cie-reabrir') { reabrir(c, el.dataset.mes); return true; }
  if (act === 'cie-plantilla') { descargar('plantilla-cierres.xlsx', crear(CI.plantilla(c.cat && c.cat.productos)), MIME).catch(() => toast('No se pudo descargar la plantilla')); return true; }
  return false;
}
export function alEscribir(el, c) { return imp.alEscribir(el, c); }
