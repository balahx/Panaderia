/* Inicio (Fase 1): confirma que la base funciona y muestra lo que viene. Las pantallas reales llegan desde la Fase 3. */
import { esc } from '../core/formato.js';
import { svg } from '../core/iconos.js';

const PASOS = [
  ['Base instalable, sin conexión y actualización', true],
  ['Ingreso con Google', true],
  ['Perfiles y accesos (dueños, externo, pesaje)', false],
  ['Catálogo: productos, precios y trabajadores', false],
  ['Pesaje y entregas del día', false],
  ['Ventas, cierres mensuales e indicadores', false]
];
export function html(ctx) {
  const nombre = (ctx.user.nombre || '').split(' ')[0];
  return '<span class="eyebrow">Inicio</span><h1>Hola, ' + esc(nombre) + '</h1>' +
    '<p class="muted">La app ya está instalada y conectada. Las secciones aparecerán aquí a medida que avance el proyecto.</p>' +
    '<section class="card sec"><p class="eyebrow">Avance</p><ul class="steps">' +
    PASOS.map(p => '<li' + (p[1] ? ' class="done"' : '') + '>' + svg(p[1] ? 'check' : 'dot') + '<span>' + esc(p[0]) + (p[1] ? '' : ' <span class="muted">· pendiente</span>') + '</span></li>').join('') +
    '</ul></section>';
}
export function alActuar() { return false; }
