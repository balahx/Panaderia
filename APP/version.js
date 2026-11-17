/* Versión de la app. Se cambia en CADA publicación con  node tools/bump.js fix|feature|big
   n: lo que se muestra («Versión X.Y.Z»): Z arreglos, Y funciones nuevas, X cambios grandes.
   v (AAAA.MM.DD.n): nombra el caché del service worker; al cambiar, se renueva lo guardado sin conexión. */
(function (root) {
  'use strict';
  const V = { n: '0.5.0', v: '2026.11.16.2', date: '2026-11-16' };
  root.PAN_VERSION = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
})(typeof self !== 'undefined' ? self : globalThis);
