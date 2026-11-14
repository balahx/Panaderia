/* Accesos (solo dueños): solicitudes por revisar, personas con acceso y su perfil, quitar o devolver el acceso.
   Las listas llegan en ctx (app.js las escucha en vivo); aquí se dibujan y se envían los cambios. Las reglas deciden. */
import { esc, iniciales, fechaTexto, diaChile } from '../core/formato.js';
import { svg, emptyHTML, errorHTML } from '../core/iconos.js';
import { ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as perfil from '../core/perfil.js';

const cuando = ms => (ms ? fechaTexto(diaChile(new Date(ms))) : '');
const pendientes = c => (c.perfil === 'dueno' && c.solicitudes ? c.solicitudes.length : 0);
const plural = n => n + (n === 1 ? ' solicitud de acceso por revisar' : ' solicitudes de acceso por revisar');
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const fila = (x, extra, botones) => '<div class="persona" data-uid="' + esc(x.id) + '"><span class="av" aria-hidden="true">' + esc(iniciales(x.nombre)) + '</span>' +
  '<div class="who"><b>' + esc(x.nombre) + '</b><small>' + esc(x.correo) + '</small>' + extra + '</div><div class="persona-b">' + botones + '</div></div>';

/* Aviso arriba de las demás pantallas cuando hay solicitudes (solo dueños) */
export function aviso(c) {
  const n = pendientes(c);
  return n ? '<button class="aviso" id="avisoAccesos" data-act="ir" data-tab="accesos">' + svg('team') + '<span>' + plural(n) + '</span>' + svg('chev', 'go') + '</button>' : '';
}
export const porRevisar = pendientes;

export function html(c) {
  const cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Accesos</span><h1>Quién usa la app</h1>';
  if (c.errListas) return cab + errorHTML('No se pudo leer la lista de accesos (' + c.errListas + ').', { retry: 'recargar' });
  if (!c.solicitudes || !c.miembros) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const sol = perfil.ordenarSolicitudes(c.solicitudes), mi = perfil.ordenarMiembros(c.miembros);
  const con = mi.filter(m => m.activo), sin = mi.filter(m => !m.activo), otros = ((c.negocio && c.negocio.duenos) || []).length - 1;
  return cab +
    '<section class="sec" id="secSolicitudes"><p class="eyebrow">Solicitudes' + (sol.length ? ' · ' + sol.length : '') + '</p>' +
    (sol.length ? '<div class="mlist">' + sol.map(s => fila(s, '<small>Pidió acceso' + (s.creado ? ' el ' + esc(cuando(s.creado)) : '') + '</small>',
      '<button class="btn sm" data-act="acc-elegir" data-id="' + esc(s.id) + '">Aprobar</button><button class="btn sm ghost" data-act="acc-rechazar" data-id="' + esc(s.id) + '">Rechazar</button>')).join('') + '</div>'
      : emptyHTML('team', 'Sin solicitudes', 'Cuando alguien entre con su cuenta de Google y pida acceso, aparecerá aquí.')) + '</section>' +
    '<section class="sec" id="secMiembros"><p class="eyebrow">Con acceso</p><div class="mlist">' +
    '<div class="persona"><span class="av" aria-hidden="true">' + esc(iniciales(c.user.nombre)) + '</span><div class="who"><b>' + esc(c.user.nombre) + ' (tú)</b><small>' + esc(c.user.correo) + '</small></div>' +
    '<div class="persona-b"><span class="badge ok">Dueño</span></div></div>' +
    con.map(m => fila(m, '', '<span class="badge">' + esc(perfil.nombrePerfil(m.perfil)) + '</span><button class="btn sm ghost" data-act="acc-ver" data-id="' + esc(m.id) + '">Cambiar</button>')).join('') + '</div>' +
    '<p class="muted chico">' + (otros > 0 ? 'Hay ' + otros + (otros === 1 ? ' dueño más' : ' dueños más') + '. ' : '') + 'Los dueños se definen en la consola de Firebase, no desde la app.</p></section>' +
    (sin.length ? '<section class="sec" id="secSinAcceso"><p class="eyebrow">Acceso quitado</p><div class="mlist">' +
      sin.map(m => fila(m, '<small>Antes: ' + esc(perfil.nombrePerfil(m.perfil)) + '</small>', '<button class="btn sm ghost" data-act="acc-ver" data-id="' + esc(m.id) + '">Ver</button>')).join('') + '</div></section>' : '');
}

const opcion = (act, id, p, actual) => '<button class="opcion" data-act="' + act + '" data-id="' + esc(id) + '" data-perfil="' + p + '"' + (actual ? ' disabled' : '') + '><b>' + esc(perfil.PERFILES[p].t) +
  (actual ? ' · perfil actual' : '') + '</b><small>' + esc(perfil.PERFILES[p].d) + '</small></button>';
/* Envía un cambio de accesos: exige conexión (los accesos no se cambian «para después») y avisa el resultado. */
function enviar(promesa, listo) {
  if (navigator.onLine === false) { toast('Sin conexión: los accesos se cambian con internet'); return; }
  cerrarHoja();
  promesa().then(() => toast(listo), e => toast(String(e && e.code).includes('permission') ? 'Solo los dueños pueden cambiar accesos' : 'No se pudo guardar. Inténtalo de nuevo.'));
}
export function alActuar(act, el, c) {
  if (!act.startsWith('acc-')) { if (act === 'recargar') { location.reload(); return true; } return false; }
  if (c.perfil !== 'dueno') return true;
  const id = el.dataset.id, s = buscar(c.solicitudes, id), m = buscar(c.miembros, id);
  if (act === 'acc-elegir' && s) {
    hoja('Aprobar a ' + s.nombre, '<p class="muted">' + esc(s.correo) + '</p><p>Elige qué podrá hacer:</p>' + perfil.ASIGNABLES.map(p => opcion('acc-aprobar', id, p)).join(''));
  } else if (act === 'acc-aprobar' && s) {
    const p = el.dataset.perfil;
    ask({ title: '¿Dar acceso a ' + s.nombre + '?', text: 'Perfil ' + perfil.nombrePerfil(p) + ': ' + perfil.PERFILES[p].d + '.', ok: 'Dar acceso' })
      .then(si => { if (si) enviar(() => nube.aprobar(s, p), s.nombre + ' ya tiene acceso (' + perfil.nombrePerfil(p) + ')'); });
  } else if (act === 'acc-rechazar' && s) {
    ask({ title: '¿Rechazar la solicitud?', text: s.nombre + ' (' + s.correo + ') no tendrá acceso. Podrá volver a pedirlo.', ok: 'Rechazar', danger: true })
      .then(si => { if (si) enviar(() => nube.retirarSolicitud(id), 'Solicitud rechazada'); });
  } else if (act === 'acc-ver' && m) {
    hoja(m.nombre, '<p class="muted">' + esc(m.correo) + '</p>' + (m.activo
      ? '<p>Perfil:</p>' + perfil.ASIGNABLES.map(p => opcion('acc-perfil', id, p, m.perfil === p)).join('') +
        '<div class="actions"><button class="btn danger" data-act="acc-quitar" data-id="' + esc(id) + '">Quitar acceso</button></div><p class="muted chico">Quitar el acceso no borra nada de lo que registró.</p>'
      : '<p>Esta persona ya no tiene acceso. Antes tenía el perfil ' + esc(perfil.nombrePerfil(m.perfil)) + '.</p><div class="actions"><button class="btn" data-act="acc-devolver" data-id="' + esc(id) + '">Devolver acceso</button>' +
        '<button class="btn ghost" data-act="acc-borrar" data-id="' + esc(id) + '">Borrar de la lista</button></div>'));
  } else if (act === 'acc-perfil' && m) {
    const p = el.dataset.perfil;
    ask({ title: '¿Cambiar el perfil de ' + m.nombre + '?', text: 'Pasará a ' + perfil.nombrePerfil(p) + ': ' + perfil.PERFILES[p].d + '.', ok: 'Cambiar' })
      .then(si => { if (si) enviar(() => nube.guardarMiembro(m, p, true), m.nombre + ' ahora es ' + perfil.nombrePerfil(p)); });
  } else if (act === 'acc-quitar' && m) {
    ask({ title: '¿Quitar el acceso a ' + m.nombre + '?', text: 'Dejará de ver la app de inmediato. Sus registros se conservan y puedes devolverle el acceso después.', ok: 'Quitar acceso', danger: true })
      .then(si => { if (si) enviar(() => nube.guardarMiembro(m, m.perfil, false), 'Se quitó el acceso a ' + m.nombre); });
  } else if (act === 'acc-devolver' && m) {
    enviar(() => nube.guardarMiembro(m, m.perfil, true), m.nombre + ' vuelve a tener acceso (' + perfil.nombrePerfil(m.perfil) + ')');
  } else if (act === 'acc-borrar' && m && !m.activo) {
    ask({ title: '¿Borrar a ' + m.nombre + ' de la lista?', text: 'Solo se borra su ficha de acceso; sus registros se conservan. Para volver a entrar tendrá que pedir acceso otra vez.', ok: 'Borrar', danger: true })
      .then(si => { if (si) enviar(() => nube.borrarMiembro(id), 'Ficha borrada'); });
  }
  return true;
}
