/* Datos (dueños y externo), desde «Más»: exportar las ventas a Excel (PLAN §3.10) y descargar el respaldo (PLAN §3.11).
   Los dos leen DEL SERVIDOR (nube.leerRango, leerCol, leerDoc): sin conexión no se hacen, para no entregar un archivo incompleto.
   Los archivos se arman en el equipo (core/excel.js + core/xlsx.js, core/respaldo.js) y se descargan sin pasar por otro sitio. */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { toast, descargar, repintar } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as excel from '../core/excel.js';
import { MIME } from '../core/xlsx.js';
import * as R from '../core/respaldo.js';
import * as actualizar from '../core/actualizar.js';

const X = { modo: 'mes', mes: '', desde: '', hasta: '', ocupado: false, msg: '', err: '', ultimo: '', costos: true, cliente: '' };   // cliente: '' = todos (Fase 11)   // Excel · costos: con costo y margen (Fase 9)
const B = { ocupado: false, msg: '', err: '', ultimo: '', anio: '' };                                   // respaldo · anio: '' = el actual · 'todo'
export const ocupado = () => X.ocupado;
const mesDe = c => (X.mes && X.mes <= V.mesDe(c.hoy) ? X.mes : V.mesDe(c.hoy));
const motivo = e => { const m = String(e && (e.code || e.message) || e); return /unavailable|offline|network/i.test(m) ? 'sin conexión con el servidor' : /permission/.test(m) ? 'el servidor no lo permitió' : m; };

/* Descarga el Excel de ventas de un período. Lo usan esta pantalla (con la casilla de costos), Entregas (sin costos: es el de la contadora)
   y Costos → El mes (con costos). `conCostos`: true / false; sin indicarlo, lo que diga la casilla. `clienteId` (Fase 11): solo ese cliente;
   sin indicarlo, el elegido aquí ('' = todos). */
export async function exportar(c, desde, hasta, conCostos, clienteId) {
  if (X.ocupado) return;
  if (navigator.onLine === false) { toast('Para descargar el Excel hace falta internet: así sale completo.'); return; }
  const k = c.cat || {}, uno = clienteId === undefined ? X.cliente : clienteId;
  if (!k.productos || !k.precios || !k.clientes) { toast('Espera a que cargue el catálogo.'); return; }
  X.ocupado = true; X.err = ''; X.msg = 'Leyendo las ventas…'; repintar();
  try {
    const pesajes = await nube.leerRango('pesajes', 'fecha', desde, hasta);
    const lib = excel.libro({ desde, hasta, pesajes, productos: k.productos, trabajadores: k.trabajadores, precios: k.precios, clientes: k.clientes, clienteId: uno || null, iva: cat.ivaDe(c.negocio), quien: c.user.nombre, costos: costosDe(c, desde, hasta, conCostos === undefined ? X.costos : conCostos) });
    await descargar(lib.nombre, excel.bytes(lib), MIME);
    X.ultimo = lib.nombre + ' · ' + lib.lineas.length + (lib.lineas.length === 1 ? ' fila' : ' filas') + ' · total ' + cat.pesos(lib.totales.total);
    toast(lib.faltan.length ? 'Excel descargado. Ojo: ' + lib.faltan.map(f => f.nombre).join(', ') + ' sin precio algún día (no suma).' : 'Excel descargado', lib.faltan.length ? 8000 : 3500);
  } catch (e) { X.err = 'No se pudo preparar el Excel: ' + motivo(e) + '.'; toast(X.err); }
  X.ocupado = false; X.msg = ''; repintar();
}

/* Costos para el Excel (Fase 9), si la casilla está marcada y ya cargaron: insumos, sus precios y las recetas; y los gastos del mes,
   si el período es un mes completo (o el mes en curso hasta hoy). Sin la casilla, el Excel sale como antes (sin costos). */
function costosDe(c, desde, hasta, si) {
  const k = c.cat || {};
  if (!si || !k.insumos || !k.preciosInsumo || !k.recetas) return null;
  const m = V.mesDe(desde), r = V.rangoMes(m), unMes = desde === r.desde && V.mesDe(hasta) === m && (hasta === r.hasta || hasta === c.hoy);
  return { k: { insumos: k.insumos, preciosInsumo: k.preciosInsumo, recetas: k.recetas }, mes: unMes ? m : null, gastos: unMes ? (c.gastos || []).find(g => g.id === m) || null : null };
}

/* Respaldo completo (lo que esta cuenta puede leer) y marca en config/respaldo para la franja semanal. */
async function respaldar(c) {
  if (B.ocupado) return;
  if (navigator.onLine === false) { toast('Para el respaldo hace falta internet: así sale completo.'); return; }
  B.ocupado = true; B.err = ''; B.msg = 'Preparando…'; repintar();
  try {
    const anio = anioRespaldo(c);
    const got = await R.reunir({ doc: nube.leerDoc, col: nube.leerCol, rango: nube.leerRango }, c.perfil, t => { B.msg = t; repintar(); }, anio);
    const hoy = diaChile(new Date()), arch = R.armar(got.datos, { por: { uid: c.user.uid, nombre: c.user.nombre, correo: c.user.correo }, perfil: c.perfil, lecturas: got.lecturas, version: actualizar.current().n, proyecto: nube.proyecto(), anio });
    await descargar(R.nombreArchivo(hoy, anio), JSON.stringify(arch, null, 1), 'application/json');
    B.ultimo = 'Esta descarga: ' + R.resumen(arch.conteos) + ' · ' + got.lecturas + ' lecturas.';
    nube.guardar('config/respaldo', R.marcaNueva(c.user.uid, c.user.nombre, arch.conteos, got.lecturas)).catch(() => { /* la marca es un recordatorio: el archivo ya está descargado */ });
    toast('Respaldo descargado');
  } catch (e) { B.err = 'No se pudo completar el respaldo: ' + motivo(e) + '. No se descargó nada.'; toast(B.err); }
  B.ocupado = false; B.msg = ''; repintar();
}

/* Año del respaldo: null = todo. Por omisión, el año actual. */
const anioRespaldo = c => (B.anio === 'todo' ? null : Number(B.anio) || R.anios(c.hoy)[0]);
function periodoElegido(c) {
  if (X.modo === 'mes') { const r = V.rangoMes(mesDe(c)); return { desde: r.desde, hasta: r.hasta > c.hoy ? c.hoy : r.hasta }; }
  return V.validarPeriodo(X.desde || V.rangoMes(V.mesDe(c.hoy)).desde, X.hasta || c.hoy, c.hoy);
}
function tarjetaExcel(c) {
  const p = periodoElegido(c), seg = (v, t) => '<button data-act="dat-modo" data-v="' + v + '" aria-pressed="' + (X.modo === v) + '">' + t + '</button>';
  return '<section class="card sec" id="secExcel"><span class="eyebrow">Ventas en Excel</span><h2>Exportar a Excel</h2>' +
    '<p class="muted">Neto, IVA, total y cliente de cada pan en cada entrega, más hojas por entrega, por día, por pan, por cliente y cada canasto. Los totales cuadran con «Entregas».</p>' +
    '<div class="seg" role="group" aria-label="Período">' + seg('mes', 'Un mes') + seg('rango', 'Otras fechas') + '</div>' +
    (X.modo === 'mes' ? '<label class="lab" for="datMes">Mes</label><input class="txt" type="month" id="datMes" max="' + V.mesDe(c.hoy) + '" value="' + mesDe(c) + '">'
      : '<div class="dos"><div><label class="lab" for="datDesde">Desde</label><input class="txt" type="date" id="datDesde" max="' + c.hoy + '" value="' + esc(X.desde || V.rangoMes(V.mesDe(c.hoy)).desde) + '"></div>' +
        '<div><label class="lab" for="datHasta">Hasta</label><input class="txt" type="date" id="datHasta" max="' + c.hoy + '" value="' + esc(X.hasta || c.hoy) + '"></div></div>') +
    (p.error ? '<p class="form-error" role="alert">' + esc(p.error) + '</p>' : '<p class="muted chico" id="datPeriodo">Del ' + esc(fechaTexto(p.desde)) + ' al ' + esc(fechaTexto(p.hasta)) + '.</p>') +
    selectorCliente(c) +
    '<label class="check" for="datCostos"><input type="checkbox" id="datCostos"' + (X.costos ? ' checked' : '') + '><span>Incluir costos y margen (columnas de costo y la hoja «Resultado», con los gastos si es un mes)</span></label>' +
    '<p class="muted chico">Desmárcala si el Excel es para otra persona (por ejemplo, la contadora). El de «Entregas» sale siempre sin costos; el de «Costos → El mes», con costos.</p>' +
    (X.err ? '<p class="form-error" role="alert">' + esc(X.err) + '</p>' : '') + (X.ocupado ? '<p class="muted" role="status">' + esc(X.msg) + '</p>' : X.ultimo ? '<p class="muted chico" id="datXlUltimo">' + esc(X.ultimo) + '</p>' : '') +
    '<div class="actions"><button class="btn" id="datExcel" data-act="dat-excel"' + (X.ocupado || p.error ? ' disabled' : '') + '>' + svg('bajar') + (X.ocupado ? 'Preparando…' : 'Descargar Excel') + '</button></div></section>';
}
/* Todos o un cliente (Fase 11; por si la contadora necesita uno solo). Con un solo cliente no aparece. */
function selectorCliente(c) {
  const l = cat.ordenarClientes(c.cat && c.cat.clientes); if (l.length < 2) return '';
  if (X.cliente && !l.some(x => x.id === X.cliente)) X.cliente = '';
  return '<label class="lab" for="datCliente">Cliente</label><select class="txt" id="datCliente"><option value="">Todos (con la hoja «Por cliente»)</option>' +
    l.map(x => '<option value="' + esc(x.id) + '"' + (x.id === X.cliente ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') + '</select>';
}
function tarjetaRespaldo(c) {
  const marca = c.respaldo, viejo = R.toca(marca);
  return '<section class="card sec" id="secRespaldo"><span class="eyebrow">Copia de seguridad</span><h2>Respaldo</h2>' +
    '<p class="muted">Un archivo con todos los datos: catálogo, precios, canastos, entregas, correcciones y costos (insumos, recetas y gastos)' + (c.perfil === 'dueno' ? ', y los accesos' : '') + '. ' +
    'Firebase gratis no guarda copias solo: descárgalo cada semana y guárdalo en un lugar privado (tiene precios y ventas). Cada descarga usa una lectura por registro de la cuota diaria gratuita.</p>' +
    '<label class="lab" for="datBkAnio">Canastos y correcciones de</label><select class="txt" id="datBkAnio">' +
    R.anios(c.hoy).map((a, i) => '<option value="' + a + '"' + (anioRespaldo(c) === a ? ' selected' : '') + '>' + a + (i === 0 ? ' (este año, lo recomendado)' : '') + '</option>').join('') +
    '<option value="todo"' + (anioRespaldo(c) === null ? ' selected' : '') + '>Todos los años (usa más lecturas)</option></select>' +
    '<p class="muted chico" id="datBkAlcance">El catálogo, los precios, los cierres, las metas y los costos van siempre completos. Los años anteriores ya quedaron en sus respaldos.</p>' +
    (marca !== undefined ? '<p class="' + (viejo ? 'note warn' : 'muted') + '" id="datMarca">' + esc(R.textoMarca(marca)) + '</p>' : '') +
    (B.err ? '<p class="form-error" role="alert">' + esc(B.err) + '</p>' : '') + (B.ocupado ? '<p class="muted" role="status">' + esc(B.msg) + '</p>' : B.ultimo ? '<p class="muted chico" id="datBkUltimo">' + esc(B.ultimo) + '</p>' : '') +
    '<div class="actions"><button class="btn" id="datRespaldo" data-act="dat-respaldo"' + (B.ocupado ? ' disabled' : '') + '>' + svg('bajar') + (B.ocupado ? 'Descargando…' : 'Descargar respaldo') + '</button></div></section>';
}
export function html(c) {
  return '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Datos</span><h1>Excel y respaldo</h1>' +
    (navigator.onLine === false ? '<p class="note warn">Sin conexión: el Excel y el respaldo necesitan internet para salir completos.</p>' : '') +
    tarjetaExcel(c) + tarjetaRespaldo(c);
}
export function alActuar(act, el, c) {
  if (act === 'dat-modo') { X.modo = el.dataset.v === 'rango' ? 'rango' : 'mes'; return 'repintar'; }
  if (act === 'dat-excel') { const p = periodoElegido(c); if (!p.error) exportar(c, p.desde, p.hasta); return true; }
  if (act === 'dat-respaldo') { respaldar(c); return true; }
  return false;
}
export function alEscribir(el, c) {
  if (el.id === 'datMes' && V.esMes(el.value)) { X.mes = el.value >= V.mesDe(c.hoy) ? '' : el.value; return 'repintar'; }
  if (el.id === 'datDesde' || el.id === 'datHasta') { X[el.id === 'datDesde' ? 'desde' : 'hasta'] = el.value; return 'repintar'; }
  if (el.id === 'datBkAnio') { B.anio = el.value; return 'repintar'; }
  if (el.id === 'datCostos') { X.costos = el.checked; return ''; }
  if (el.id === 'datCliente') { X.cliente = el.value; return ''; }
}
