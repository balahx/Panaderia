/* «Más»: la cuenta y su perfil; para dueños y externo, los submenús del PLAN §8: Catálogo, Registros (registro general y fecha pasada)
   y Datos (Excel y respaldo); Catálogo incluye Costos y margen (Fase 9); Registros incluye los cierres mensuales (Fase 6); Accesos (dueños); la versión y actualización, y el diagnóstico de instalación.
   Fase 8: Ayuda (todos los perfiles), Aviso de privacidad (lo abre app.js), y el diagnóstico dice si App Check entrega su comprobante,
   qué se bloqueó (si algo) y cuánto tardan la apertura y las pantallas (window.__pan, lo mide app.js).
   Fase 12: grupo «Cobros» con Cobros (lo que se debe, con el total por cobrar), Cotizaciones y Datos para documentos.
   Fase 13, parte C: el diagnóstico muestra el tamaño de la pantalla (ancho × alto en px, orientación y densidad).
   «Cerrar sesión» lo atiende app.js (vale también en las pantallas de espera). */
import { esc, iniciales, fechaTexto } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { hoja, toast } from '../core/ui.js';
import * as actualizar from '../core/actualizar.js';
import * as nube from '../core/nube.js';
import * as perfil from '../core/perfil.js';
import { porRevisar } from './accesos.js';
import { sumarDias } from '../core/pesaje.js';
import * as R from '../core/respaldo.js';
import * as A from '../core/abonos.js';
import * as CB from '../core/cobros.js';
import * as cat from '../core/catalogo.js';

const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const DATOS = { cache: 'Con copia sin conexión', memoria: 'Sin copia en este equipo (solo con internet)', 'sin-sdk': 'Falta el SDK' };
const APPCHECK = { activo: 'Activo', 'sin-configurar': 'Sin configurar', 'sin-sdk': 'Falta el SDK (node tools/vendor.js)', error: 'No se pudo iniciar' };
const TOKEN = { ok: ' · comprobante recibido', esperando: ' · esperando el comprobante', lento: ' · el comprobante no llega' };
/* App Check: si está activo, si llegó el comprobante de reCAPTCHA (sin él, con App Check obligatorio, Firebase rechaza todo). */
export function textoAppCheck(e) {
  const base = APPCHECK[e.appCheck] || '—';
  if (e.appCheck !== 'activo') return base;
  if (e.appCheckToken === 'error') return base + ' · sin comprobante (' + (navigator.onLine === false ? 'sin conexión' : e.appCheckError || 'error') + ')';
  return base + (TOKEN[e.appCheckToken] || '');
}
const seg = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
/* Rendimiento medido en este equipo: apertura (desde que se pidió la página hasta ver la app) y la pantalla que más tardó en dibujarse. */
export function textoRendimiento(m) {
  m = m || {};
  const lenta = Object.keys(m.dibujo || {}).sort((a, b) => m.dibujo[b] - m.dibujo[a])[0];
  return [m.apertura ? seg(m.apertura) : '—', lenta ? (m.nombres && m.nombres[lenta] || lenta) + ' · ' + Math.round(m.dibujo[lenta]) + ' ms' : '—'];
}
const kv = (k, v) => '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';

/* Datos para comprobar en cada equipo: instalada, abre sin conexión, sesión con Google */
/* Fase 13, parte C: el tamaño de la pantalla que usa la app (en px de CSS, los que miden el diseño), su orientación y la densidad.
   Sirve para confirmar la tablet real (la Tab S6 en horizontal debería dar unos 1280 × 800, menos las barras de Android). */
export function pantalla() {
  const w = Math.round(window.innerWidth), h = Math.round(window.innerHeight), d = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  return w + ' × ' + h + ' px · ' + (w >= h ? 'horizontal' : 'vertical') + ' · densidad ' + String(d).replace('.', ',');
}
export function diagnostico(ctx) {
  const ult = (() => { try { return localStorage.getItem('pan.ultimoIngreso') || ''; } catch (e) { return ''; } })(), rend = textoRendimiento(window.__pan);
  return [
    ['Modo', instalada() ? 'Instalada' : 'En el navegador'],
    ['Conexión', navigator.onLine === false ? 'Sin conexión' : 'Con conexión'],
    ['Pantalla', pantalla()],
    ['Copia sin conexión', navigator.serviceWorker && navigator.serviceWorker.controller ? 'Lista' : 'Aún no (vuelve a abrir la app)'],
    ['Sesión', ctx.user.correo || '—'],
    ['Perfil', perfil.nombrePerfil(ctx.perfil)],
    ['Identificador (UID)', ctx.user.uid],
    ['Datos', DATOS[nube.estado().datos] || '—'],
    ['App Check', textoAppCheck(nube.estado())],
    ['Ingreso', 'Google, por redirección' + (ult ? ' · ' + fechaTexto(ult.slice(0, 10)) : '')],
    ['Proyecto', nube.proyecto() || '—'],
    ['Bloqueos de seguridad', String((window.__csp || []).length)]
  ].concat((window.__csp || []).length ? [['Qué se bloqueó', [...new Set(window.__csp)].slice(0, 4).join(' · ')]] : []).concat([
    ['Apertura de la app', rend[0]],
    ['Pantalla más lenta', rend[1]],
    ['Versión', actualizar.label(actualizar.current()) + ' (' + actualizar.current().v + ')']
  ]);
}
const fila = (id, ic, t, d, extra) => '<button class="mrow" id="' + id + '" data-act="ir" ' + extra + '>' + svg(ic) + '<span class="mt"><b>' + esc(t) + '</b><small>' + esc(d) + '</small></span>' + svg('chev', 'go') + '</button>';
function gestion(ctx) {
  const marca = R.textoMarca(ctx.respaldo);
  return '<p class="eyebrow mas-grupo">Catálogo</p><div class="mlist">' + fila('irCatalogo', 'pan', 'Catálogo', 'Productos, precios, trabajadores, cliente e IVA', 'data-tab="catalogo"') +
    fila('irCostos', 'calc', 'Costos y margen', 'Insumos, recetas, gastos del mes y resultado', 'data-tab="costos"') + '</div>' +
    '<p class="eyebrow mas-grupo">Registros</p><div class="mlist">' + fila('irRegistro', 'lista', 'Registro general', 'Todos los canastos con filtros, y las correcciones', 'data-tab="registro"') +
    fila('irFechaPasada', 'mas', 'Anotar en fecha pasada', 'Abre «Hoy» en el día de ayer; con ‹ › eliges otro', 'data-tab="inicio" data-dia="' + sumarDias(ctx.hoy, -1) + '"') +
    fila('irCierres', 'file', 'Cierres mensuales', 'Cerrar meses e importar los anteriores desde Excel', 'data-tab="cierres"') + '</div>' +
    cobranza(ctx) +
    '<p class="eyebrow mas-grupo">Datos</p><div class="mlist">' + fila('irDatos', 'bajar', 'Exportar a Excel y respaldo', marca || 'Ventas con neto, IVA y total; copia de todos los datos', 'data-tab="datos"') + '</div>' +
    '<p class="eyebrow mas-grupo">Cuenta</p>';
}
/* Fase 12: el grupo «Cobros». */
function cobranza(ctx) {
  const cu = Array.isArray(ctx.cobros) && Array.isArray(ctx.abonos) ? A.cuenta(ctx.cobros, ctx.abonos, '', ctx.hoy) : null;
  return '<p class="eyebrow mas-grupo">Cobros</p><div class="mlist">' +
    fila('irCobros', 'cobro', 'Cobros', cu ? (cu.porCobrar ? 'Por cobrar ' + cat.pesos(cu.porCobrar) + (cu.vencido ? ' · vencido ' + cat.pesos(cu.vencido) : '') : 'Nada por cobrar') + ' · abonos y estado de cuenta' : 'Cobros a clientes, abonos y estado de cuenta', 'data-tab="cobros"') +
    fila('irCotizaciones', 'file', 'Cotizaciones', 'Precios con IVA para posibles clientes', 'data-tab="cotizaciones"') +
    fila('irEmpresa', 'info', 'Datos para documentos', ctx.empresa === undefined || CB.empresaLista(ctx.empresa) ? 'Razón social, RUT y datos para transferir' : 'Faltan la razón social y el RUT', 'data-tab="empresa"') + '</div>';
}
export function html(ctx) {
  return '<span class="eyebrow">Más</span><h1>Cuenta y ajustes</h1>' +
    '<section class="card sec"><div class="more-head"><span class="av" aria-hidden="true">' + esc(iniciales(ctx.user.nombre)) + '</span>' +
    '<div class="who"><b>' + esc(ctx.user.nombre) + '</b><small>' + esc(ctx.user.correo) + '</small></div><span class="badge ok" id="miPerfil">' + esc(perfil.nombrePerfil(ctx.perfil)) + '</span></div></section>' +
    (perfil.puede(ctx.perfil, 'gestion') ? gestion(ctx) : '') +
    '<div class="mlist">' +
    (perfil.puede(ctx.perfil, 'accesos') ? '<button class="mrow" id="irAccesos" data-act="ir" data-tab="accesos">' + svg('team') + '<span class="mt"><b>Accesos</b><small>' +
      (porRevisar(ctx) ? porRevisar(ctx) + ' por revisar' : 'Aprobar, cambiar perfil o quitar accesos') + '</small></span>' + (porRevisar(ctx) ? '<span class="badge warn">' + porRevisar(ctx) + '</span>' : '') + svg('chev', 'go') + '</button>' : '') +
    '<button class="mrow" id="irAyuda" data-act="ir" data-tab="ayuda">' + svg('ayuda') + '<span class="mt"><b>Ayuda</b><small>' + (perfil.puede(ctx.perfil, 'gestion') ? 'Cómo se usa cada parte de la app' : 'Cómo pesar, corregir y cerrar la entrega') + '</small></span>' + svg('chev', 'go') + '</button>' +
    '<button class="mrow" id="irPrivacidad" data-act="privacidad">' + svg('candado') + '<span class="mt"><b>Aviso de privacidad</b><small>Qué datos usa la app y quién los ve</small></span>' + svg('chev', 'go') + '</button>' +
    '<button class="mrow" data-act="diag">' + svg('info') + '<span class="mt"><b>Diagnóstico de instalación</b><small>Instalada, sin conexión e ingreso en este equipo</small></span>' + svg('chev', 'go') + '</button>' +
    '<button class="mrow" data-act="salir">' + svg('out') + '<span class="mt"><b>Cerrar sesión</b><small>En este equipo</small></span>' + svg('chev', 'go') + '</button>' +
    '</div>' + actualizar.card() + actualizar.footer();
}
export function alActuar(act, el, ctx) {
  if (act === 'diag') {
    const d = diagnostico(ctx);
    hoja('Diagnóstico', '<div id="diag">' + d.map(x => kv(x[0], x[1])).join('') + '</div><div class="actions"><button class="btn ghost" data-act="diag-copiar">Copiar</button></div>');
    return true;
  }
  if (act === 'diag-copiar') {
    const t = diagnostico(ctx).map(x => x[0] + ': ' + x[1]).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Diagnóstico copiado'), () => toast('No se pudo copiar'));
    return true;
  }
  return false;
}
