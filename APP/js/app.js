/* Panadería — arranque: service worker, sesión, acceso por perfil, navegación y reparto de acciones a cada pantalla.
   Cada pantalla es un módulo en pantallas/ con  html(ctx)  y  alActuar(act, el, ctx). */
import { $, ask, cerrarHoja, toast } from './core/ui.js';
import { svg } from './core/iconos.js';
import * as nube from './core/nube.js';
import * as acceso from './core/acceso.js';
import * as perfil from './core/perfil.js';
import * as actualizar from './core/actualizar.js';
import * as ingreso from './pantallas/ingreso.js';
import * as espera from './pantallas/espera.js';
import * as inicio from './pantallas/inicio.js';
import * as accesos from './pantallas/accesos.js';
import * as catalogo from './pantallas/catalogo.js';
import * as mas from './pantallas/mas.js';

/* Secciones. `oculta`: no va en la barra (se llega desde «Más»). `permiso`: qué perfil la ve (core/perfil.js).
   `datos`: se vuelve a dibujar cuando cambia el catálogo (S.cat). */
const TABS = [
  { id: 'inicio', t: 'Inicio', ic: 'hoy', mod: inicio },
  { id: 'catalogo', t: 'Catálogo', ic: 'pan', mod: catalogo, oculta: true, permiso: 'gestion', datos: true },
  { id: 'accesos', t: 'Accesos', ic: 'team', mod: accesos, oculta: true, permiso: 'accesos' },
  { id: 'mas', t: 'Más', ic: 'more', mod: mas }
];
/* S.estado: un perfil ('dueno' | 'externo' | 'pesaje') o lo que falta para tenerlo (ver perfil.resolver). */
const S = { user: null, tab: 'inicio', gate: { tipo: 'cargando' }, estado: 'comprobando', acc: null, lento: false, sol: null, miem: null, errListas: '',
  cat: null, errCat: '', nivel: '' };   // cat: { productos, trabajadores, precios, clientes } (precios y clientes solo para gestión)
let escuchas = [], escuchasDueno = [], escuchasCat = [], tLento = 0;
const ctx = () => ({ user: S.user, perfil: S.estado, estado: S.estado, negocio: S.acc && S.acc.negocio, lento: S.lento, error: S.acc && S.acc.error,
  solicitudes: S.sol, miembros: S.miem, errListas: S.errListas, cat: S.cat, errCat: S.errCat });
const visible = t => !t.permiso || perfil.puede(S.estado, t.permiso);
const tabActual = () => TABS.find(t => t.id === S.tab && visible(t)) || TABS[0];

/* Registro de bloqueos de la política de contenido (se ve en «Diagnóstico»: debe quedar en 0) */
window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));

function pintarPuerta(html) {
  $('#appRoot').hidden = true; $('#view').innerHTML = ''; $('#nav').innerHTML = ''; $('#banner').innerHTML = '';   // fuera de la app no queda nada de la cuenta en la página
  const g = $('#gate'); g.hidden = false; g.innerHTML = html;
}
function pintarIngreso(estado) { if (estado) S.gate = estado; pintarPuerta(ingreso.html(S.gate)); }
function pintarApp() {
  const g = $('#gate'); g.hidden = true; g.innerHTML = ''; $('#appRoot').hidden = false;
  const act = tabActual(), enBarra = act.oculta ? 'mas' : act.id;
  $('#nav').innerHTML = TABS.filter(t => !t.oculta && visible(t)).map(t => '<button data-act="ir" data-tab="' + t.id + '"' + (t.id === enBarra ? ' aria-current="page"' : '') + '>' + svg(t.ic) + '<span>' + t.t + '</span></button>').join('');
  $('#banner').innerHTML = act.id === 'accesos' ? '' : accesos.aviso(ctx());
  const v = $('#view'); v.dataset.tab = act.id; v.innerHTML = act.mod.html(ctx());
  medirBarra(); pintarRed();
}
/* Dibuja lo que corresponde a la sesión y al perfil. */
function pintar() {
  if (!S.user) { pintarIngreso(); return; }
  if (perfil.esPerfil(S.estado)) pintarApp(); else pintarPuerta(espera.html(ctx()));
}
function medirBarra() { const b = $('#bar'); if (b) document.documentElement.style.setProperty('--barh', b.offsetHeight + 'px'); }
function pintarRed() {
  const el = $('#netBar'); if (!el) return;
  const off = navigator.onLine === false;
  el.hidden = !off;
  el.innerHTML = off ? svg('nonet') + '<div><b>Sin conexión</b>La app sigue abierta con lo que ya estaba guardado en este equipo.</div>' : '';
}

/* ---------- Acceso por perfil ---------- */
function soltar(lista) { lista.forEach(f => { try { f(); } catch (e) { /* */ } }); lista.length = 0; }
function dejarDeVigilar() { soltar(escuchas); soltar(escuchasDueno); soltar(escuchasCat); S.cat = null; S.errCat = ''; S.nivel = ''; clearTimeout(tLento); S.acc = null; S.sol = S.miem = null; S.errListas = ''; S.lento = false; S.estado = 'comprobando'; }
/* Al entrar: escucha quiénes son los dueños, la ficha de miembro y la solicitud de esta cuenta. Se actualiza solo. */
function vigilarAcceso(u) {
  dejarDeVigilar();
  const a = S.acc = { uid: u.uid, firme: {}, error: '' };
  const dato = k => (v, meta) => {
    if (S.acc !== a) return;
    if (!meta.cache) { a[k] = v; a.firme[k] = true; a.error = ''; }
    else if (v !== null) a[k] = v;     // desde la copia del equipo: «no existe» no cuenta hasta que lo diga el servidor
    evaluar(k);
  };
  const mal = cod => { if (S.acc !== a) return; a.error = cod; evaluar(); };
  escuchas.push(nube.vigilarDoc('config/negocio', dato('negocio'), mal));
  escuchas.push(nube.vigilarDoc('miembros/' + u.uid, dato('miembro'), mal));
  escuchas.push(nube.vigilarDoc('solicitudes/' + u.uid, dato('solicitud'), mal));
  tLento = setTimeout(() => { if (S.acc === a && S.estado === 'comprobando') { S.lento = true; pintar(); } }, 7000);
  pintar();
}
function evaluar(cambio) {
  const antes = S.estado; S.estado = perfil.resolver(S.acc);
  if (S.estado === 'dueno' && !escuchasDueno.length) {
    const lista = k => l => { S[k] = l; S.errListas = ''; if (S.estado === 'dueno') pintarApp(); };
    const mal = cod => { S.errListas = cod; if (S.estado === 'dueno') pintarApp(); };
    escuchasDueno.push(nube.vigilarCol('solicitudes', lista('sol'), mal));
    escuchasDueno.push(nube.vigilarCol('miembros', lista('miem'), mal));
  }
  if (S.estado !== 'dueno' && escuchasDueno.length) { soltar(escuchasDueno); S.sol = S.miem = null; }
  vigilarCatalogo();
  if (S.estado === antes) {         // misma pantalla: no se redibuja (no borra lo que se está escribiendo)…
    if (cambio === 'negocio' && perfil.esPerfil(S.estado) && tabActual().datos) pintarApp();   // …salvo si cambió el IVA y la pantalla muestra precios
    return;
  }
  cerrarHoja();
  if (perfil.esPerfil(S.estado) && !perfil.esPerfil(antes)) { S.tab = 'inicio'; if (antes === 'espera') toast('Tu acceso fue aprobado'); }
  pintar();
}
/* Catálogo en vivo según el perfil: productos y trabajadores para todos; precios y clientes solo para dueños y externo
   (la cuenta de pesaje ni los pide: las reglas se los negarían). */
function vigilarCatalogo() {
  const nivel = !perfil.esPerfil(S.estado) ? '' : perfil.puede(S.estado, 'gestion') ? 'gestion' : 'pesaje';
  if (nivel === S.nivel) return;
  soltar(escuchasCat); S.nivel = nivel; S.errCat = ''; S.cat = null;
  if (!nivel) return;
  const k = S.cat = { productos: null, trabajadores: null, precios: nivel === 'gestion' ? null : [], clientes: nivel === 'gestion' ? null : [] };
  const repintar = () => { if (S.cat === k && perfil.esPerfil(S.estado) && tabActual().datos) pintarApp(); };
  for (const col of Object.keys(k).filter(c => k[c] === null))
    escuchasCat.push(nube.vigilarCol(col, l => { if (S.cat !== k) return; k[col] = l; S.errCat = ''; repintar(); }, cod => { if (S.cat !== k) return; S.errCat = cod; repintar(); }));
}
function cerrarSesion() {
  ask({ title: '¿Cerrar sesión?', text: 'Para volver a entrar necesitarás internet y tu cuenta de Google.', ok: 'Cerrar sesión', danger: true })
    .then(si => { if (si) nube.salir().then(recargar => { if (recargar) location.reload(); }, () => toast('No se pudo cerrar la sesión')); });
}

document.addEventListener('click', e => {
  if (e.target.id === 'dlg') { cerrarHoja(); return; }   // toque fuera de la hoja
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'cerrar-hoja') { cerrarHoja(); return; }
  if (actualizar.onAct(act)) return;
  if (!S.user) { ingreso.alActuar(act, el, pintarIngreso); return; }
  if (act === 'salir') { cerrarSesion(); return; }
  if (!perfil.esPerfil(S.estado)) { espera.alActuar(act, el, ctx()); return; }
  if (act === 'ir') { const t = TABS.find(x => x.id === el.dataset.tab && visible(x)); if (t) { S.tab = t.id; pintarApp(); scrollTo(0, 0); } return; }
  if (!tabActual().mod.alActuar(act, el, ctx())) mas.alActuar(act, el, ctx());
});
/* «Enter» en un campo con data-enter="acción" equivale a tocar el botón de esa acción */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.enter) return;
  const b = document.querySelector('[data-act="' + e.target.dataset.enter + '"]'); if (b) { e.preventDefault(); b.click(); }
});
/* Mientras se escribe en un campo: la pantalla actual puede reaccionar (vista previa, campos que dependen de otro) */
document.addEventListener('input', e => {
  const m = S.user && perfil.esPerfil(S.estado) ? tabActual().mod : null;
  if (m && m.alEscribir) m.alEscribir(e.target, ctx());
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
  if (!nube.hayDatos()) { pintarIngreso({ tipo: 'sin-sdk' }); return; }
  const vuelta = await acceso.terminar(nube.entrarConIdToken);   // si se vuelve de Google, entra aquí
  let error = vuelta && !vuelta.ok ? vuelta.mensaje : '';
  nube.alCambiarSesion(u => {
    const antes = S.user; S.user = u;
    if (u) { if (!antes || antes.uid !== u.uid) { vigilarAcceso(u); if (vuelta && vuelta.ok && !antes) toast('Ingresaste como ' + u.nombre); } }
    else { dejarDeVigilar(); cerrarHoja(); pintarIngreso({ tipo: 'listo', error: error }); error = ''; }
  });
}
arrancar();
