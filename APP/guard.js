/* Panadería — antimarcos: si alguien intenta mostrar la app dentro de otra página (para engañar con clics encima,
   «clickjacking»), la oculta. En Firebase Hosting además lo impiden las cabeceras (firebase.json); este archivo cubre
   cualquier otro lugar donde se abra, porque la política en <meta> no puede prohibir marcos. */
(function () {
  'use strict';
  let framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (framed) { document.documentElement.style.display = 'none'; try { window.top.location = window.self.location; } catch (e) { /* bloqueado: queda oculta */ } }
})();
