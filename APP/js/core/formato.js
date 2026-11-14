/* Formato de textos y números (PLAN T8): pesos chilenos sin decimales, kilos con 2 decimales, fechas es-CL. Sin DOM: se prueba con Node. */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const miles = n => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const clp = n => (n < 0 && Math.round(n) !== 0 ? '-' : '') + '$' + miles(n);
export function kilos(n) {
  const c = Math.round(Math.abs(n) * 100), ent = Math.floor(c / 100), dec = String(c % 100).padStart(2, '0');
  return (n < 0 && c !== 0 ? '-' : '') + miles(ent) + ',' + dec;
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/* '2026-11-05' → '5 nov 2026' */
export function fechaTexto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
  return Number(m[3]) + ' ' + MESES[Number(m[2]) - 1] + ' ' + m[1];
}
/* Día calendario chileno (America/Santiago) de un instante, como 'AAAA-MM-DD' */
export function diaChile(d) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d || new Date());
  const g = t => p.find(x => x.type === t).value;
  return g('year') + '-' + g('month') + '-' + g('day');
}
export const iniciales = nombre => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
