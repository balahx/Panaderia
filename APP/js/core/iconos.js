/* Íconos de línea (SVG en el propio código: sin archivos ni sitios externos) y bloques de estado vacío y de error. */
import { esc } from './formato.js';

export const IC = {
  pan: '<path d="M4.5 10.5C4.5 7.5 7.6 5.5 12 5.5s7.5 2 7.5 5c0 1.3-.8 2.2-1.8 2.6V18a1.5 1.5 0 01-1.5 1.5H7.8A1.5 1.5 0 016.3 18v-4.9c-1-.4-1.8-1.3-1.8-2.6z"/><path d="M9.3 9.2l1.5 2.2M12.9 8.7l1.5 2.2"/>',
  hoy: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloud: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
  nonet: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z"/><path d="M4 4l16 16"/>',
  out: '<path d="M10 4.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 19.5h4"/><path d="M15 8l4 4-4 4M19 12H9.5"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.3a3 3 0 010 5.4M18.5 14c1.6.7 2.8 2.3 2.8 4.5"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 9.5a4.5 4.5 0 017 0M12 14l2-3"/>',
  file: '<path d="M6.5 3h7l4.5 4.5V21h-11.5z"/><path d="M13.5 3v4.5H18M9.5 12.5h5M9.5 16h5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 11.5h.1M12 11.5h.1M15.5 11.5h.1M8.5 15h.1M12 15h.1M15.5 15v2.5M8.5 18h.1M12 18h.1"/>',
  prog: '<path d="M3 18l5.5-6 4 3.5L21 6"/><path d="M15 6h6v6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  pesa: '<path d="M7.6 9.2h8.8l2.6 10.3H5z"/><circle cx="12" cy="6.3" r="2.3"/>',
  warn: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  camion: '<path d="M3 6.5h11V16H3z"/><path d="M14 9.5h3.8l3.2 3.4V16h-7z"/><circle cx="7" cy="17.3" r="1.8"/><circle cx="17.2" cy="17.3" r="1.8"/>',
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1" fill="currentColor"/><circle cx="4.6" cy="12" r="1" fill="currentColor"/><circle cx="4.6" cy="17.5" r="1" fill="currentColor"/>',
  bajar: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.2"/><path d="M12 16.9v.1"/>',
  candado: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
  cobro: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  compartir: '<circle cx="17.5" cy="6" r="2.3"/><circle cx="6.5" cy="12" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="M8.6 10.9l6.8-3.8M8.6 13.1l6.8 3.8"/>',
  imprimir: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7.5" rx="1.5"/><path d="M7 14h10v6H7z"/>'
};
export function svg(n, c) {
  return '<svg class="ic ' + (c || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.dot) + '</svg>';
}
/* Estado vacío común: ícono, título, texto y (opcional) un botón. `text` y `action` son HTML ya escapado. */
export function emptyHTML(ico, title, text, action) {
  return '<div class="empty"><span class="empty-ic">' + svg(ico) + '</span><b>' + esc(title) + '</b>' + (text ? '<p>' + text + '</p>' : '') + (action || '') + '</div>';
}
/* Aviso de error: ícono, título, mensaje y (opcional) «Reintentar». `msg` es texto plano. */
export function errorHTML(msg, o) {
  o = o || {};
  return '<div class="errbox" role="alert"><span class="errbox-ic">' + svg('warn') + '</span><div><b>' + esc(o.title || 'No se pudo cargar') + '</b><p>' + esc(msg) + '</p>' +
    (o.retry ? '<button class="btn sm" data-act="' + esc(o.retry) + '">Reintentar</button>' : '') + '</div></div>';
}
