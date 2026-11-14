/* Panadería — arranque: service worker, sesión, navegación y reparto de acciones a cada pantalla.
   Cada pantalla es un módulo en pantallas/ con  html(ctx)  y  alActuar(act, el, ctx). */
import { $, cerrarHoja, toast } from './core/ui.js';
import { svg } from './core/iconos.js';
import * as nube from './core/nube.js';
import * as acceso from './core/acceso.js';
import * as actualizar from './core/actualizar.js';
import * as ingreso from './pantallas/ingreso.js';
import * as inicio from './pantallas/inicio.js';
import * as mas from './pantallas/mas.js';

/* Secciones de la barra. Desde la Fase 2 se filtran por perfil (dueño, externo, pesaje). */
const TABS = [
  { id: 'inicio', t: 'Inicio', ic: 'hoy', mod: inicio },
  { id: 'mas', t: 'Más', ic: 'more', mod: mas }
];
const S = { user: null, tab: 'inicio', gate: { tipo: 'cargando' } };
const ctx = () => ({ user: S.user });
const tabActual = () => TABS.find(t => t.id === S.tab) || TABS[0];

/* Registro de bloqueos de la política de contenido (se ve en «Diagnóstico»: debe quedar en 0) */
window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));

function pintarIngreso(estado) {
  if (estado) S.gate = estado;
  $('#appRoot').hidden = true;
  if (!S.user) { $('#view').innerHTML = ''; $('#nav').innerHTML = ''; }   // al salir no queda nada de la cuenta en la página
  const g = $('#gate'); g.hidden = false; g.innerHTML = ingreso.html(S.gate);
}
function pintarApp() {
  $('#gate').hidden = true; $('#appRoot').hidden = false;
  $('#nav').innerHTML = TABS.map(t => '<button data-act="ir" data-tab="' + t.id + '"' + (t.id === S.tab ? ' aria-current="page"' : '') + '>' + svg(t.ic) + '<span>' + t.t + '</span></button>').join('');
  const v = $('#view'); v.dataset.tab = S.tab; v.innerHTML = tabActual().mod.html(ctx());
  medirBarra(); pintarRed();
}
function medirBarra() { const b = $('#bar'); if (b) document.documentElement.style.setProperty('--barh', b.offsetHeight + 'px'); }
function pintarRed() {
  const el = $('#netBar'); if (!el) return;
  const off = navigator.onLine === false;
  el.hidden = !off;
  el.innerHTML = off ? svg('nonet') + '<div><b>Sin conexión</b>La app sigue abierta con lo que ya estaba guardado en este equipo.</div>' : '';
}

document.addEventListener('click', e => {
  if (e.target.id === 'dlg') { cerrarHoja(); return; }   // toque fuera de la hoja
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'ir') { S.tab = el.dataset.tab; pintarApp(); scrollTo(0, 0); return; }
  if (act === 'cerrar-hoja') { cerrarHoja(); return; }
  if (actualizar.onAct(act)) return;
  if (!S.user) { ingreso.alActuar(act, el, pintarIngreso); return; }
  if (!tabActual().mod.alActuar(act, el, ctx())) mas.alActuar(act, el, ctx());
});
addEventListener('online', pintarRed);
addEventListener('offline', pintarRed);
addEventListener('resize', medirBarra);

async function arrancar() {
  const otra = acceso.canonico(location);
  if (otra) { location.replace(otra); return; }   // una sola dirección oficial: la de web.app
  $('#mark').innerHTML = svg('pan'); $('#gear').innerHTML = svg('gear');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* sin copia sin conexión: la app funciona igual con internet */ });
  actualizar.checkSoon();
  pintarIngreso({ tipo: acceso.hayRespuesta() ? 'entrando' : 'cargando' });
  if (!nube.configurada()) { pintarIngreso({ tipo: 'sin-config' }); return; }
  try { await nube.iniciar(); }
  catch (e) { pintarIngreso({ tipo: 'sin-sdk' }); return; }
  const vuelta = await acceso.terminar(nube.entrarConIdToken);   // si se vuelve de Google, entra aquí
  let error = vuelta && !vuelta.ok ? vuelta.mensaje : '';
  nube.alCambiarSesion(u => {
    const antes = S.user; S.user = u;
    if (u) { if (!antes) S.tab = 'inicio'; pintarApp(); if (vuelta && vuelta.ok && !antes) toast('Ingresaste como ' + u.nombre); }
    else { cerrarHoja(); pintarIngreso({ tipo: 'listo', error: error }); error = ''; }
  });
}
arrancar();
