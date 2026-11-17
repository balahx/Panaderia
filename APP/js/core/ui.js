/* Utilidades de interfaz: buscar elementos, aviso breve (toast), confirmación (ask), hojas y descarga de archivos. */
import { esc } from './formato.js';
import { svg } from './iconos.js';

export const $ = (s, r) => (r || document).querySelector(s);

let tT = 0;
export function toast(msg, ms) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  try { if (!t.matches(':popover-open')) t.showPopover(); } catch (e) { /* navegador sin popover: queda visible igual */ }
  clearTimeout(tT);
  tT = setTimeout(() => { try { t.hidePopover(); } catch (e) { /* */ } t.hidden = true; }, ms || 3500);
}

/* Pregunta de sí o no al centro de la pantalla. Devuelve una promesa con true (aceptó) o false. */
export function ask(o) {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'cfm'; d.setAttribute('aria-label', o.title);
    d.innerHTML = '<div class="cfm-in"><h2>' + esc(o.title) + '</h2>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<div class="cfm-b"><button class="btn ghost" data-r="0">' + esc(o.cancel || 'Cancelar') + '</button>' +
      '<button class="btn' + (o.danger ? ' danger' : '') + '" data-r="1">' + esc(o.ok || 'Aceptar') + '</button></div></div>';
    let r = false;
    d.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { r = b.dataset.r === '1'; d.close(); } });
    d.addEventListener('close', () => { d.remove(); res(r); });
    document.body.appendChild(d); d.showModal();
  });
}

/* Hoja (panel) con título y contenido HTML ya escapado. Se cierra con la X, con Esc o tocando fuera. */
export function hoja(titulo, html) {
  const d = $('#dlg');
  d.setAttribute('aria-label', titulo);
  d.innerHTML = '<div class="sheet-h"><h2>' + esc(titulo) + '</h2><button class="icon-btn" data-act="cerrar-hoja" aria-label="Cerrar">' + svg('close') + '</button></div><div class="sheet-b">' + html + '</div>';
  if (!d.open) d.showModal();
}
export function cerrarHoja() { const d = $('#dlg'); if (d && d.open) d.close(); }

/* Descarga un archivo hecho en el equipo (Excel o respaldo): no pasa por internet. `datos`: texto o bytes.
   En la app instalada en iPhone o iPad (navigator.standalone) se ofrece el menú Compartir («Guardar en Archivos», correo…), porque ahí
   una descarga común puede quedar en una vista previa sin salida; si Compartir no se puede, se descarga igual. */
export async function descargar(nombre, datos, tipo) {
  const blob = new Blob([datos], { type: tipo || 'application/octet-stream' });
  if (navigator.standalone === true && navigator.canShare) {
    try { const f = new File([blob], nombre, { type: blob.type }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nombre }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; /* otro error: se descarga como siempre */ }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener'; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/* Pide a la app que vuelva a dibujar la pantalla actual (cuando termina algo que tomó un rato: un Excel, un respaldo). */
export const repintar = () => document.dispatchEvent(new Event('pan:repintar'));
