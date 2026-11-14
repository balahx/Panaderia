/* Ingreso con Google por redirección de página completa (sin ventanas emergentes, sin marcos y sin scripts de Google).
   1. comenzar(): guarda un `state` y un `nonce` al azar y lleva la página a accounts.google.com.
   2. Google devuelve a la app con  #id_token=…&state=…  (o  #error=…).
   3. terminar(): comprueba `state` y `nonce`, limpia la dirección y entrega el id_token a Firebase (nube.entrarConIdToken).
   Así el ingreso funciona igual en el navegador y con la app instalada (iPhone, Android, Windows), y la política de
   contenido (CSP) no necesita admitir ningún sitio externo de scripts. La parte pura se prueba con Node: tests/acceso-unit.js */

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const CLAVE = 'pan.ingreso', VIGENCIA = 10 * 60000;

/* Dirección de Google para pedir solo la identidad (id_token): nombre y correo. */
export function urlGoogle(o) {
  const q = new URLSearchParams({
    client_id: o.clientId, redirect_uri: o.redirectUri, response_type: 'id_token',
    scope: 'openid email profile', nonce: o.nonce, state: o.state, prompt: 'select_account'
  });
  return GOOGLE_AUTH + '?' + q.toString();
}
/* Lee lo que Google deja después del # al volver. null si la dirección no trae una respuesta de ingreso. */
export function leerRespuesta(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (!/(^|&)(id_token|error)=/.test(h)) return null;
  const q = new URLSearchParams(h);
  return { idToken: q.get('id_token') || '', state: q.get('state') || '', error: q.get('error') || '' };
}
/* Contenido del id_token (sin verificar la firma: eso lo hace Firebase al recibirlo). null si no es un token. */
export function datosToken(idToken) {
  try {
    const p = String(idToken).split('.'); if (p.length !== 3) return null;
    const b = atob(p[1].replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    const d = JSON.parse(new TextDecoder().decode(u));
    return d && typeof d === 'object' ? d : null;
  } catch (e) { return null; }
}
/* Comprueba la respuesta contra lo que se guardó al comenzar. Devuelve { ok, idToken } o { ok: false, error }. */
export function validar(resp, guardado, ahora) {
  if (!resp) return { ok: false, error: 'sin-respuesta' };
  if (resp.error) return { ok: false, error: resp.error === 'access_denied' ? 'cancelado' : 'google' };
  if (!guardado || !guardado.state || !guardado.nonce) return { ok: false, error: 'sin-inicio' };
  if ((ahora || Date.now()) - (guardado.t || 0) > VIGENCIA) return { ok: false, error: 'vencido' };
  if (!resp.state || resp.state !== guardado.state) return { ok: false, error: 'estado' };
  const d = datosToken(resp.idToken);
  if (!d || d.nonce !== guardado.nonce) return { ok: false, error: 'nonce' };
  return { ok: true, idToken: resp.idToken };
}
export const MENSAJES = {
  cancelado: 'Se canceló el ingreso con Google.',
  google: 'Google no completó el ingreso. Inténtalo de nuevo.',
  'sin-inicio': 'El ingreso no comenzó en este equipo. Inténtalo de nuevo.',
  vencido: 'El ingreso tardó demasiado. Inténtalo de nuevo.',
  estado: 'La respuesta de Google no corresponde a este ingreso. Inténtalo de nuevo.',
  nonce: 'La respuesta de Google no corresponde a este ingreso. Inténtalo de nuevo.',
  red: 'Sin conexión: conéctate a internet para ingresar.',
  firebase: 'Firebase no aceptó el ingreso. Revisa la configuración (GUIA-FIREBASE.md, pasos 4 y 5).'
};
/* Dirección oficial de la app: la de web.app. Si se abre por firebaseapp.com, devuelve a dónde ir; si no, null. */
export function canonico(loc) {
  const m = /^(.+)\.firebaseapp\.com$/.exec(loc.hostname || '');
  return m ? 'https://' + m[1] + '.web.app' + (loc.pathname || '/') : null;
}

/* ---------- Navegador ---------- */
const azar = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
export const redirectUri = () => location.origin + '/';

export function comenzar(clientId) {
  const g = { state: azar(), nonce: azar(), t: Date.now() };
  localStorage.setItem(CLAVE, JSON.stringify(g));
  location.assign(urlGoogle({ clientId: clientId, redirectUri: redirectUri(), state: g.state, nonce: g.nonce }));
}
/* ¿La página se abrió volviendo de Google? */
export const hayRespuesta = () => !!leerRespuesta(location.hash);
/* Al abrir la app: si se vuelve de Google, valida y entra. `entrar(idToken)` es nube.entrarConIdToken.
   Devuelve null (no había respuesta), { ok: true } o { ok: false, error, mensaje }. */
export async function terminar(entrar) {
  const resp = leerRespuesta(location.hash);
  if (!resp) return null;
  history.replaceState(null, '', location.pathname + location.search);   // el token no queda en la dirección ni en el historial
  let g = null; try { g = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { /* */ }
  localStorage.removeItem(CLAVE);
  let r = validar(resp, g);
  if (r.ok) {
    try { await entrar(r.idToken); localStorage.setItem('pan.ultimoIngreso', new Date().toISOString()); }
    catch (e) { r = { ok: false, error: /network/i.test(String(e && (e.code || e.message))) ? 'red' : 'firebase', detalle: String(e && (e.code || e.message) || '') }; }
  }
  if (!r.ok) r.mensaje = MENSAJES[r.error] || MENSAJES.google;
  return r;
}
