/* Con sesión pero todavía sin perfil: comprobando el acceso, pedirlo, esperar la aprobación, acceso quitado,
   o falta el primer paso de configuración (el documento de los dueños). Se actualiza sola cuando un dueño aprueba. */
import { esc } from '../core/formato.js';
import { svg, errorHTML } from '../core/iconos.js';
import { $, ask, toast } from '../core/ui.js';
import { hero } from './ingreso.js';
import * as nube from '../core/nube.js';
import * as perfil from '../core/perfil.js';
import { versionText } from '../core/actualizar.js';

let enviando = false;
const sinRed = () => navigator.onLine === false;
const cuenta = u => '<p class="legal">Cuenta: <b>' + esc(u.correo) + '</b> · <button class="lnk" data-act="salir">Cerrar sesión</button></p>';
const uidHTML = u => '<div class="kv"><span>Identificador (UID)</span><b id="miUid">' + esc(u.uid) + '</b></div><div class="actions"><button class="btn ghost sm" data-act="uid-copiar">Copiar identificador</button></div>';

function cuerpo(c) {
  const u = c.user, nombre = (u.nombre || '').split(' ')[0];
  if (c.estado === 'pedir') return '<div class="card" id="pedir"><p class="lead">Hola, ' + esc(nombre) + '. Para usar la app, uno de los dueños debe aprobar tu acceso.</p>' +
    '<label class="lab" for="solNombre">Tu nombre (así te verán los dueños)</label>' +
    '<input class="txt" id="solNombre" maxlength="60" autocomplete="name" data-enter="pedir" value="' + esc(perfil.limpiarNombre(u.nombre)) + '">' +
    '<p class="form-error" id="solError" role="alert" hidden></p>' +
    '<div class="actions"><button class="btn lg block" data-act="pedir">Pedir acceso</button></div></div>';
  if (c.estado === 'espera') return '<div class="card" id="espera"><div class="estado-ic" aria-hidden="true">' + svg('check') + '</div>' +
    '<p class="lead"><b>Solicitud enviada.</b> Avísale a uno de los dueños para que la apruebe en su app (Más → Accesos). Esta pantalla se actualiza sola.</p>' +
    '<div class="actions centro"><button class="lnk" data-act="retirar">Retirar la solicitud</button></div></div>';
  if (c.estado === 'sin-acceso') return '<div class="card" id="sinAcceso">' + errorHTML('Esta cuenta ya no tiene acceso a la app. Si crees que es un error, habla con los dueños.', { title: 'Acceso quitado' }) + '</div>';
  if (c.estado === 'sin-negocio') return '<div class="card" id="sinNegocio"><div class="note warn"><b>Falta el primer paso de configuración.</b> Aún no existe el documento que dice quiénes son los dueños ' +
    '(<code>config/negocio</code>). Se crea una sola vez, a mano, en la consola de Firebase: GUIA-FIREBASE.md, paso 14.</div>' + uidHTML(u) + '</div>';
  if (c.estado === 'error') return '<div class="card" id="sinDatos">' + errorHTML(sinRed() ? 'Sin conexión: conéctate a internet para comprobar tu acceso.'
    : 'No se pudo comprobar tu acceso (' + (c.error || 'error') + '). Si se repite, revisa que las reglas estén publicadas (GUIA-FIREBASE.md, paso 13).', { title: 'No se pudo comprobar', retry: 'recargar' }) + '</div>';
  return '<div id="comprobando"><div class="spin" role="status" aria-label="Cargando"></div><p class="lead">Comprobando tu acceso…</p>' +
    (c.lento || sinRed() ? '<div class="card"><div class="note warn">' + (sinRed() ? '<b>Sin conexión.</b> La primera vez se necesita internet para comprobar el acceso de esta cuenta.'
      : '<b>Está tardando.</b> Revisa la conexión a internet.') + '</div><button class="btn ghost block" data-act="recargar">Reintentar</button></div>' : '') + '</div>';
}
export function html(c) { return hero + cuerpo(c) + cuenta(c.user) + '<p class="ver-line">' + esc(versionText()) + '</p>'; }

function error(msg) { const e = $('#solError'); if (e) { e.textContent = msg; e.hidden = !msg; } }
export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (act === 'uid-copiar') {
    (navigator.clipboard ? navigator.clipboard.writeText(c.user.uid) : Promise.reject()).then(() => toast('Identificador copiado'), () => toast('No se pudo copiar: selecciónalo a mano'));
    return true;
  }
  if (act === 'pedir') {
    if (enviando) return true;
    const campo = $('#solNombre'), nombre = perfil.limpiarNombre(campo ? campo.value : '');
    if (!perfil.nombreValido(nombre)) { error('Escribe tu nombre (al menos 2 letras).'); return true; }
    if (sinRed()) { error('Sin conexión: conéctate a internet para pedir acceso.'); return true; }
    error(''); enviando = true; el.disabled = true;
    nube.pedirAcceso(nombre).then(() => { enviando = false; }, () => { enviando = false; el.disabled = false; error('No se pudo enviar la solicitud. Inténtalo de nuevo.'); });
    return true;
  }
  if (act === 'retirar') {
    ask({ title: '¿Retirar la solicitud?', text: 'Podrás volver a pedir acceso cuando quieras.', ok: 'Retirar', danger: true })
      .then(si => { if (si) nube.retirarSolicitud(c.user.uid).catch(() => toast('No se pudo retirar la solicitud')); });
    return true;
  }
  return false;
}
