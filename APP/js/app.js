/* Panadería — arranque: service worker, sesión, acceso por perfil, datos en vivo, navegación y reparto de acciones a cada pantalla.
   Cada pantalla es un módulo en pantallas/ con  html(ctx)  y  alActuar(act, el, ctx)  (y si quiere  alEscribir  y  alTeclear). */
import { $, ask, cerrarHoja, toast } from './core/ui.js';
import { svg } from './core/iconos.js';
import { diaChile } from './core/formato.js';
import * as nube from './core/nube.js';
import * as acceso from './core/acceso.js';
import * as perfil from './core/perfil.js';
import * as actualizar from './core/actualizar.js';
import * as ingreso from './pantallas/ingreso.js';
import * as espera from './pantallas/espera.js';
import * as inicio from './pantallas/inicio.js';
import * as entregas from './pantallas/entregas.js';
import * as pesaje from './pantallas/pesaje.js';
import * as registro from './pantallas/registro.js';
import * as datos from './pantallas/datos.js';
import * as cierres from './pantallas/cierres.js';
import * as avisos from './pantallas/avisos.js';
import * as accesos from './pantallas/accesos.js';
import * as catalogo from './pantallas/catalogo.js';
import * as mas from './pantallas/mas.js';

/* Secciones. `oculta`: no va en la barra (se llega desde «Más»). `permiso`: qué perfil la ve (core/perfil.js).
   `datos`: se vuelve a dibujar cuando cambia el catálogo (S.cat), lo pesado (S.dia) o el período (S.per). `grande`: letra grande (la panadería).
   La primera que el perfil puede ver es la de entrada: «Hoy» para dueños y externo, «Pesaje» para la tablet.
   Un módulo puede exportar fecha(ctx) (qué día escuchar), periodo(ctx) (qué rango de días) y abrir(dataset) (al llegar desde un botón «ir»). */
const TABS = [
  { id: 'inicio', t: 'Hoy', ic: 'hoy', mod: inicio, permiso: 'gestion', datos: true },
  { id: 'entregas', t: 'Entregas', ic: 'camion', mod: entregas, permiso: 'gestion', datos: true },
  { id: 'pesaje', t: 'Pesaje', ic: 'pesa', mod: pesaje, permiso: 'pesaje', datos: true, grande: true },
  { id: 'registro', t: 'Registro', ic: 'lista', mod: registro, oculta: true, permiso: 'gestion', datos: true },
  { id: 'datos', t: 'Datos', ic: 'bajar', mod: datos, oculta: true, permiso: 'gestion', datos: true },
  { id: 'cierres', t: 'Cierres', ic: 'file', mod: cierres, oculta: true, permiso: 'gestion', datos: true },
  { id: 'catalogo', t: 'Catálogo', ic: 'pan', mod: catalogo, oculta: true, permiso: 'gestion', datos: true },
  { id: 'accesos', t: 'Accesos', ic: 'team', mod: accesos, oculta: true, permiso: 'accesos' },
  { id: 'mas', t: 'Más', ic: 'more', mod: mas }
];
/* S.estado: un perfil ('dueno' | 'externo' | 'pesaje') o lo que falta para tenerlo (ver perfil.resolver). */
const S = { user: null, tab: 'inicio', gate: { tipo: 'cargando' }, estado: 'comprobando', acc: null, lento: false, sol: null, miem: null, errListas: '',
  cat: null, errCat: '', nivel: '',     // cat: { productos, trabajadores, precios, clientes } (precios y clientes solo para gestión)
  dia: null,                            // dia: { fecha, pesajes, dia (entrega en curso), err } (core/pesaje.js)
  per: null,                            // per: { desde, hasta, pesajes, cambios, err } (Entregas y Registro; solo gestión)
  respaldo: undefined,                  // config/respaldo: undefined = aún no se sabe · null = nunca hubo (core/respaldo.js)
  cierres: null };                      // cierres mensuales [{ id: 'AAAA-MM', … }] (Fase 6; solo gestión) · null = aún no llegan
let escuchas = [], escuchasDueno = [], escuchasCat = [], escuchasDia = [], escuchasPer = [], escuchasGes = [], tLento = 0;
const ctx = () => ({ user: S.user, perfil: S.estado, estado: S.estado, negocio: S.acc && S.acc.negocio, lento: S.lento, error: S.acc && S.acc.error,
  solicitudes: S.sol, miembros: S.miem, errListas: S.errListas, cat: S.cat, errCat: S.errCat, dia: S.dia, per: S.per, respaldo: S.respaldo, cierres: S.cierres, hoy: diaChile(new Date()) });
const visible = t => !t.permiso || perfil.puede(S.estado, t.permiso);
const tabActual = () => TABS.find(t => t.id === S.tab && visible(t)) || TABS.find(visible);

/* Registro de bloqueos de la política de contenido (se ve en «Diagnóstico»: debe quedar en 0) */
window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));

function pintarPuerta(html) {
  delete document.documentElement.dataset.escala;
  $('#appRoot').hidden = true; $('#view').innerHTML = ''; $('#nav').innerHTML = ''; $('#banner').innerHTML = '';   // fuera de la app no queda nada de la cuenta en la página
  const g = $('#gate'); g.hidden = false; g.innerHTML = html;
}
function pintarIngreso(estado) { if (estado) S.gate = estado; pintarPuerta(ingreso.html(S.gate)); }
function pintarApp() {
  const g = $('#gate'); g.hidden = true; g.innerHTML = ''; $('#appRoot').hidden = false;
  const act = tabActual(), enBarra = act.oculta ? 'mas' : act.id;
  vigilarDia(); vigilarPeriodo();
  if (act.grande || S.estado === 'pesaje') document.documentElement.dataset.escala = 'grande'; else delete document.documentElement.dataset.escala;
  $('#nav').innerHTML = TABS.filter(t => !t.oculta && visible(t)).map(t => '<button data-act="ir" data-tab="' + t.id + '"' + (t.id === enBarra ? ' aria-current="page"' : '') + '>' + svg(t.ic) + '<span>' + t.t + '</span></button>').join('');
  pintarBanner();
  const v = $('#view'); v.dataset.tab = act.id; v.innerHTML = act.mod.html(ctx());
  medirBarra(); pintarRed();
}
/* Dibuja lo que corresponde a la sesión y al perfil. */
function pintar() {
  if (!S.user) { pintarIngreso(); return; }
  if (perfil.esPerfil(S.estado)) pintarApp(); else pintarPuerta(espera.html(ctx()));
}
/* Franjas de aviso sobre la pantalla: accesos por revisar, ventas sin precio y respaldo semanal (pantallas/avisos.js). */
function pintarBanner() { const b = $('#banner'); if (b && perfil.esPerfil(S.estado)) b.innerHTML = avisos.html(ctx(), tabActual().id); }
function medirBarra() { const b = $('#bar'); if (b) document.documentElement.style.setProperty('--barh', b.offsetHeight + 'px'); }
function pintarRed() {
  const el = $('#netBar'); if (!el) return;
  const off = navigator.onLine === false;
  el.hidden = !off;
  el.innerHTML = off ? svg('nonet') + '<div><b>Sin conexión</b>La app sigue abierta con lo que ya estaba guardado en este equipo.</div>' : '';
}

/* ---------- Acceso por perfil ---------- */
function soltar(lista) { lista.forEach(f => { try { f(); } catch (e) { /* */ } }); lista.length = 0; }
function dejarDeVigilar() { soltar(escuchas); soltar(escuchasDueno); soltar(escuchasCat); soltar(escuchasDia); soltar(escuchasPer); soltar(escuchasGes); S.dia = null; S.per = null; S.respaldo = undefined; S.cierres = null; S.cat = null; S.errCat = ''; S.nivel = ''; clearTimeout(tLento); S.acc = null; S.sol = S.miem = null; S.errListas = ''; S.lento = false; S.estado = 'comprobando'; }
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
  /* Dueños y externo: la marca del último respaldo (para la franja semanal). Cambia poco: se redibuja la franja, y la pantalla
     solo si es la de Datos (que la muestra). */
  if (perfil.puede(S.estado, 'gestion') && !escuchasGes.length) {
    escuchasGes.push(nube.vigilarDoc('config/respaldo', (d, meta) => {
      if (d === null && meta.cache) return;
      S.respaldo = d; if (!perfil.puede(S.estado, 'gestion')) return;
      if (tabActual().id === 'datos') pintarApp(); else pintarBanner();
    }, () => { S.respaldo = undefined; }));
    /* Cierres mensuales (Fase 6): unos pocos documentos al año. Deciden qué meses están cerrados (Hoy, Entregas, Registro y Cierres). */
    escuchasGes.push(nube.vigilarCol('cierres', l => { S.cierres = l; if (perfil.puede(S.estado, 'gestion') && tabActual().datos) pintarApp(); }, () => { S.cierres = S.cierres || []; }));
  }
  if (!perfil.puede(S.estado, 'gestion') && escuchasGes.length) { soltar(escuchasGes); S.respaldo = undefined; S.cierres = null; }
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
/* Pesajes de un día y su entrega en curso, en vivo. El día lo decide la pantalla: «Hoy» puede mirar otro; el pesaje, siempre hoy.
   Se piden con un filtro por fecha (la tablet solo puede leer lo de hoy). Al cambiar el día se escucha el nuevo. */
function fechaQuerida() {
  if (!perfil.esPerfil(S.estado) || !S.user) return '';
  const t = tabActual();
  return t && t.mod.fecha ? t.mod.fecha(ctx()) : diaChile(new Date());
}
function vigilarDia() {
  const f = fechaQuerida();
  if (S.dia && S.dia.fecha === f) return;
  soltar(escuchasDia); S.dia = null;
  if (!f) return;
  const k = S.dia = { fecha: f, pesajes: null, dia: undefined, err: '' };
  const repintar = () => { if (S.dia === k && perfil.esPerfil(S.estado) && tabActual().datos) pintarApp(); };
  escuchasDia.push(nube.vigilarDonde('pesajes', 'fecha', f, l => { if (S.dia !== k) return; k.pesajes = l; k.err = ''; repintar(); }, cod => { if (S.dia !== k) return; k.err = cod; repintar(); }));
  escuchasDia.push(nube.vigilarDoc('dias/' + f, d => { if (S.dia !== k) return; k.dia = d; repintar(); }, cod => { if (S.dia !== k) return; k.err = cod; repintar(); }));
}
/* Pesajes de un período (y su bitácora, si la pantalla la pide), en vivo, mientras se mira Entregas o el Registro general.
   Solo dueños y externo. Cuesta una lectura por documento al abrir: por eso se escucha solo en esas pantallas. */
function vigilarPeriodo() {
  const t = tabActual(), q = S.user && perfil.puede(S.estado, 'gestion') && t && t.mod.periodo ? t.mod.periodo(ctx()) : null;
  const clave = q ? q.desde + '|' + q.hasta + '|' + (q.cambios ? 1 : 0) : '';
  if ((S.per ? S.per.clave : '') === clave) return;
  soltar(escuchasPer); S.per = null;
  if (!q) return;
  const k = S.per = { clave, desde: q.desde, hasta: q.hasta, pesajes: null, cambios: q.cambios ? null : [], err: '' };
  const repintar = () => { if (S.per === k && perfil.esPerfil(S.estado) && tabActual().datos) pintarApp(); };
  escuchasPer.push(nube.vigilarRango('pesajes', 'fecha', q.desde, q.hasta, l => { if (S.per !== k) return; k.pesajes = l; k.err = ''; repintar(); }, cod => { if (S.per !== k) return; k.err = cod; repintar(); }));
  if (q.cambios) escuchasPer.push(nube.vigilarRango('cambios', 'fecha', q.desde, q.hasta, l => { if (S.per !== k) return; k.cambios = l; repintar(); }, cod => { if (S.per !== k) return; k.err = cod; repintar(); }));
}
/* A medianoche cambia el día: la pantalla que muestra «hoy» pasa sola al día nuevo. */
let ultimoDia = diaChile(new Date());
setInterval(() => { const d = diaChile(new Date()); if (d !== ultimoDia) { ultimoDia = d; if (S.user && perfil.esPerfil(S.estado)) pintarApp(); } }, 30000);

/* Cerrar sesión borra la copia del equipo: si hay pesajes sin enviar (sin internet), se perderían. Se avisa antes. */
async function cerrarSesion() {
  const pend = await nube.pendientes(1500);
  const si = await ask(pend
    ? { title: 'Hay datos sin enviar', text: 'Lo anotado sin internet se envía solo al volver la conexión. Si cierras sesión ahora, se pierde. Conecta el equipo y espera un momento.', ok: 'Cerrar igual y perderlos', cancel: 'Esperar', danger: true }
    : { title: '¿Cerrar sesión?', text: 'Para volver a entrar necesitarás internet y tu cuenta de Google.', ok: 'Cerrar sesión', danger: true });
  if (si) nube.salir().then(recargar => { if (recargar) location.reload(); }, () => toast('No se pudo cerrar la sesión'));
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
  if (act === 'ir') { const t = TABS.find(x => x.id === el.dataset.tab && visible(x)); if (t) { cerrarHoja(); if (t.mod.abrir) t.mod.abrir(el.dataset, ctx()); S.tab = t.id; pintarApp(); scrollTo(0, 0); } return; }
  if (avisos.alActuar(act, el, ctx())) { pintarBanner(); return; }
  const r = tabActual().mod.alActuar(act, el, ctx());
  if (r === 'repintar') pintarApp();          // la pantalla cambió algo que decide qué datos escuchar (por ejemplo, el día)
  else if (!r) mas.alActuar(act, el, ctx());
});
/* «Enter» en un campo con data-enter="acción" equivale a tocar el botón de esa acción. Fuera de los campos, la pantalla actual
   puede atender el teclado (el pesaje acepta números desde un teclado físico). */
document.addEventListener('keydown', e => {
  if (!(e.target.dataset && e.target.dataset.enter)) {
    const m = S.user && perfil.esPerfil(S.estado) ? tabActual().mod : null;
    if (m && m.alTeclear && !document.querySelector('dialog[open]') && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && m.alTeclear(e, ctx())) e.preventDefault();
    return;
  }
  if (e.key !== 'Enter') return;
  const b = document.querySelector('[data-act="' + e.target.dataset.enter + '"]'); if (b) { e.preventDefault(); b.click(); }
});
/* Mientras se escribe en un campo: la pantalla actual puede reaccionar (vista previa, campos que dependen de otro) */
document.addEventListener('input', e => {
  if (e.target.type === 'file') return;   // los archivos se atienden con «change» (abajo), una sola vez
  const m = S.user && perfil.esPerfil(S.estado) ? tabActual().mod : null;
  if (m && m.alEscribir && m.alEscribir(e.target, ctx()) === 'repintar') pintarApp();
});
/* Elegir archivos (importar cierres): «change» llega en todos los navegadores, también en iPhone. */
document.addEventListener('change', e => {
  if (e.target.type !== 'file') return;
  const m = S.user && perfil.esPerfil(S.estado) ? tabActual().mod : null;
  if (m && m.alEscribir && m.alEscribir(e.target, ctx()) === 'repintar') pintarApp();
});
document.addEventListener('pan:repintar', () => { if (S.user && perfil.esPerfil(S.estado)) pintarApp(); });
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
