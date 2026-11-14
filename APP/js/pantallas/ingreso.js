/* Pantalla de ingreso: marca, botón «Ingresar con Google» y avisos de configuración pendiente.
   estado.tipo: 'cargando' | 'listo' | 'entrando' | 'sin-config' | 'sin-sdk' ; estado.error: texto a mostrar. */
import { esc } from '../core/formato.js';
import { svg, errorHTML } from '../core/iconos.js';
import * as acceso from '../core/acceso.js';
import * as nube from '../core/nube.js';
import { versionText } from '../core/actualizar.js';

const hero = '<div class="hero"><span class="mk" aria-hidden="true">' + svg('pan') + '</span><h1 class="nm">Panadería</h1><span class="sl">Pesaje, entregas y ventas</span></div>';

function cuerpo(e) {
  if (e.tipo === 'cargando' || e.tipo === 'entrando') return '<div class="spin" role="status" aria-label="Cargando"></div><p class="lead">' + (e.tipo === 'entrando' ? 'Ingresando…' : 'Abriendo…') + '</p>';
  if (e.tipo === 'sin-config') return '<div class="card"><div class="note warn" id="sinConfig"><b>Falta conectar la app con Firebase.</b> Pega los datos del proyecto en <code>APP/firebase-config.js</code> (GUIA-FIREBASE.md, pasos 3 y 5) y vuelve a abrir.</div>' +
    '<button class="btn lg block" disabled>' + svg('user') + 'Ingresar con Google</button></div>';
  if (e.tipo === 'sin-sdk') return '<div class="card">' + errorHTML('Falta la copia local del SDK de Firebase. Ejecuta «node tools/vendor.js» (GUIA-FIREBASE.md, paso 2) y vuelve a publicar.', { title: 'La app está incompleta', retry: 'recargar' }) + '</div>';
  return '<div class="card"><p class="lead">Entra con tu cuenta de Google.</p>' +
    '<button class="btn lg block" id="btnGoogle" data-act="entrar">' + svg('user') + 'Ingresar con Google</button>' +
    (e.error ? '<p class="form-error" role="alert">' + esc(e.error) + '</p>' : '') + '</div>' +
    '<p class="legal">Solo se usa tu nombre y tu correo de Google para identificarte. El acceso a la información lo aprueban los dueños.</p>';
}
export function html(e) { return hero + cuerpo(e || { tipo: 'cargando' }) + '<p class="ver-line">' + esc(versionText()) + '</p>'; }

/* Devuelve true si atendió la acción. `pintar(estado)` vuelve a dibujar la pantalla. */
export function alActuar(act, el, pintar) {
  if (act === 'recargar') { location.reload(); return true; }
  if (act !== 'entrar') return false;
  if (navigator.onLine === false) { pintar({ tipo: 'listo', error: acceso.MENSAJES.red }); return true; }
  pintar({ tipo: 'entrando' });
  acceso.comenzar(nube.clienteGoogle());
  return true;
}
