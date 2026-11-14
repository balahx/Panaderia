/* «Más»: la cuenta y su perfil, accesos (dueños), la versión y actualización, y el diagnóstico de instalación.
   «Cerrar sesión» lo atiende app.js (vale también en las pantallas de espera). */
import { esc, iniciales, fechaTexto } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { hoja, toast } from '../core/ui.js';
import * as actualizar from '../core/actualizar.js';
import * as nube from '../core/nube.js';
import * as perfil from '../core/perfil.js';
import { porRevisar } from './accesos.js';

const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const DATOS = { cache: 'Con copia sin conexión', memoria: 'Sin copia en este equipo (solo con internet)', 'sin-sdk': 'Falta el SDK' };
const APPCHECK = { activo: 'Activo', 'sin-configurar': 'Sin configurar', 'sin-sdk': 'Falta el SDK (node tools/vendor.js)', error: 'No se pudo iniciar' };
const kv = (k, v) => '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';

/* Datos para comprobar en cada equipo: instalada, abre sin conexión, sesión con Google */
export function diagnostico(ctx) {
  const ult = (() => { try { return localStorage.getItem('pan.ultimoIngreso') || ''; } catch (e) { return ''; } })();
  return [
    ['Modo', instalada() ? 'Instalada' : 'En el navegador'],
    ['Conexión', navigator.onLine === false ? 'Sin conexión' : 'Con conexión'],
    ['Copia sin conexión', navigator.serviceWorker && navigator.serviceWorker.controller ? 'Lista' : 'Aún no (vuelve a abrir la app)'],
    ['Sesión', ctx.user.correo || '—'],
    ['Perfil', perfil.nombrePerfil(ctx.perfil)],
    ['Identificador (UID)', ctx.user.uid],
    ['Datos', DATOS[nube.estado().datos] || '—'],
    ['App Check', APPCHECK[nube.estado().appCheck] || '—'],
    ['Ingreso', 'Google, por redirección' + (ult ? ' · ' + fechaTexto(ult.slice(0, 10)) : '')],
    ['Proyecto', nube.proyecto() || '—'],
    ['Bloqueos de seguridad', String((window.__csp || []).length)],
    ['Versión', actualizar.label(actualizar.current()) + ' (' + actualizar.current().v + ')']
  ];
}
export function html(ctx) {
  return '<span class="eyebrow">Más</span><h1>Cuenta y ajustes</h1>' +
    '<section class="card sec"><div class="more-head"><span class="av" aria-hidden="true">' + esc(iniciales(ctx.user.nombre)) + '</span>' +
    '<div class="who"><b>' + esc(ctx.user.nombre) + '</b><small>' + esc(ctx.user.correo) + '</small></div><span class="badge ok" id="miPerfil">' + esc(perfil.nombrePerfil(ctx.perfil)) + '</span></div></section>' +
    '<div class="mlist">' +
    (perfil.puede(ctx.perfil, 'accesos') ? '<button class="mrow" id="irAccesos" data-act="ir" data-tab="accesos">' + svg('team') + '<span class="mt"><b>Accesos</b><small>' +
      (porRevisar(ctx) ? porRevisar(ctx) + ' por revisar' : 'Aprobar, cambiar perfil o quitar accesos') + '</small></span>' + (porRevisar(ctx) ? '<span class="badge warn">' + porRevisar(ctx) + '</span>' : '') + svg('chev', 'go') + '</button>' : '') +
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
