/* Inicio (provisional): confirma el perfil de la cuenta y muestra lo que viene. Las pantallas del día a día llegan desde la Fase 4. */
import { esc } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { nombrePerfil, puede } from '../core/perfil.js';

const PASOS = [
  ['Base instalable, sin conexión y actualización', true],
  ['Ingreso con Google', true],
  ['Perfiles y accesos (dueños, externo, pesaje)', true],
  ['Catálogo: productos, precios y trabajadores', true],
  ['Pesaje y entregas del día', false],
  ['Ventas, cierres mensuales e indicadores', false]
];
export function html(ctx) {
  const nombre = (ctx.user.nombre || '').split(' ')[0];
  return '<span class="eyebrow">Inicio</span><h1>Hola, ' + esc(nombre) + '</h1>' +
    '<p class="muted" id="inicioPerfil">Entraste con el perfil <b>' + esc(nombrePerfil(ctx.perfil)) + '</b>. ' + (ctx.perfil === 'pesaje'
      ? 'Esta cuenta es solo para registrar el pesaje en la panadería; la pantalla de pesaje llegará en una próxima versión.'
      : 'El catálogo ya está disponible; las demás secciones aparecerán aquí a medida que avance el proyecto.') + '</p>' +
    (puede(ctx.perfil, 'gestion') ? '<div class="actions arriba"><button class="btn" id="inicioCatalogo" data-act="ir" data-tab="catalogo">Abrir el catálogo</button></div>' : '') +
    '<section class="card sec"><p class="eyebrow">Avance</p><ul class="steps">' +
    PASOS.map(p => '<li' + (p[1] ? ' class="done"' : '') + '>' + svg(p[1] ? 'check' : 'dot') + '<span>' + esc(p[0]) + (p[1] ? '' : ' <span class="muted">· pendiente</span>') + '</span></li>').join('') +
    '</ul></section>';
}
export function alActuar() { return false; }
