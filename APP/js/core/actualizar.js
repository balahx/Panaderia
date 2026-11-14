/* Panadería — versión de la app y «Buscar actualización».
   Compara la versión que corre con la publicada (version.js, siempre pedida a la red). Si hay una nueva, «Actualizar ahora»
   renueva el service worker y recarga: la sesión y los datos guardados se conservan (no hay que ingresar otra vez).
   Al abrir la app (y al volver a ella tras un rato) se comprueba sola: si hay versión nueva aparece un aviso arriba (#updBar).
   Parte pura (parseVersion, newer, isNewer) probada con Node: node tests/update-unit.js */
import { esc, fechaTexto } from './formato.js';

const root = typeof globalThis !== 'undefined' ? globalThis : self;
const hasDom = typeof document !== 'undefined';
export const CACHE_PREFIX = 'panaderia-';

/* Lee { n, v, date } del texto de version.js (sin ejecutarlo) */
export function parseVersion(text) {
  const v = /v:\s*'([^']+)'/.exec(text || ''), d = /date:\s*'([^']+)'/.exec(text || ''), n = /\bn:\s*'(\d+(?:\.\d+)*)'/.exec(text || '');
  return v ? { n: n ? n[1] : null, v: v[1], date: d ? d[1] : '' } : null;
}
/* ¿`remote` es más nueva que `local`? Compara cada parte como número: 0.10.0 > 0.9.0; 2026.11.05.2 > 2026.11.05.1 */
export function newer(remote, local) {
  if (!remote || !local) return false;
  const a = String(remote).split('.').map(Number), b = String(local).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y; }
  return false;
}
const hasN = x => !!x && x.n != null && /^\d+(\.\d+)*$/.test(String(x.n));
/* Por número de versión; si alguna no lo trae, por el texto AAAA.MM.DD.n */
export function isNewer(remote, local) {
  if (!remote || !local) return false;
  return hasN(remote) && hasN(local) ? newer(remote.n, local.n) : newer(remote.v, local.v);
}
export const dateText = fechaTexto;
export const current = () => root.PAN_VERSION || { n: null, v: '?', date: '' };
export const label = x => hasN(x) ? String(x.n) : (x && x.v) || '?';
export const versionText = () => 'Versión ' + label(current());

/* ---------- Estado y acciones (solo navegador) ---------- */
export const state = { state: 'idle', remote: null, at: 0, msg: '', later: false };   // idle | checking | latest | new | applying | error
const U = state;

export async function check(force) {
  if (U.state === 'checking' || U.state === 'applying') return;
  if (!force && U.at && Date.now() - U.at < 60000) return;
  U.state = 'checking'; U.msg = ''; paint();
  try {
    const res = await fetch('version.js?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const r = parseVersion(await res.text());
    if (!r) throw new Error('respuesta inesperada');
    U.remote = r; U.at = Date.now();
    U.state = isNewer(r, current()) ? 'new' : 'latest';
  } catch (e) {
    U.state = 'error';
    U.msg = navigator.onLine === false ? 'Sin conexión: conéctate a internet para buscar actualizaciones.' : 'No se pudo comprobar ahora. Inténtalo de nuevo en un rato.';
  }
  flag(); paint();
}
/* Renueva el service worker, borra los cachés anteriores y recarga. La cuenta sigue abierta. */
export async function apply() {
  if (U.state === 'applying') return;
  U.state = 'applying'; paint();
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        try { await reg.update(); } catch (e) { /* sin red: se sigue con la recarga */ }
        const w = reg.installing || reg.waiting;
        if (w && w.state !== 'activated') await new Promise(res => { const t = setTimeout(res, 4000); w.addEventListener('statechange', () => { if (w.state === 'activated') { clearTimeout(t); res(); } }); });
      }
    }
    if (root.caches) {
      const keys = await caches.keys(), cur = CACHE_PREFIX + (U.remote ? U.remote.v : current().v);
      await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== cur).map(k => caches.delete(k)));
    }
  } catch (e) { /* aun así se recarga */ }
  location.reload();
}
function flag() { if (hasDom) document.documentElement.toggleAttribute('data-upd', U.state === 'new'); }

function body() {
  switch (U.state) {
    case 'checking': return '<p class="muted" role="status">Buscando…</p>';
    case 'applying': return '<p class="muted" role="status">Actualizando… la app se reinicia sola. No necesitas volver a entrar.</p>';
    case 'latest': return '<p class="upd-ok" role="status">Ya tienes la última versión.</p>';
    case 'new': return '<p class="upd-new" role="status">Hay una versión nueva: <b>Versión ' + esc(label(U.remote)) + '</b>. Tus datos y tu cuenta se conservan.</p>';
    case 'error': return '<p class="warn-t" role="status">' + esc(U.msg) + '</p>';
    default: return '<p class="muted">Si te avisaron de cambios, búscalos aquí. No hace falta cerrar la sesión.</p>';
  }
}
function button() {
  if (U.state === 'new') return '<button class="btn block" data-act="upd-apply">Actualizar ahora</button>';
  const busy = U.state === 'checking' || U.state === 'applying';
  return '<button class="btn ghost block" data-act="upd-check"' + (busy ? ' disabled' : '') + '>' + (U.state === 'checking' ? 'Buscando…' : 'Buscar actualización') + '</button>';
}
function inner() {
  const d = dateText(current().date);
  return '<p class="upd-ver">' + esc(versionText()) + (d ? ' <span class="muted">· ' + esc(d) + '</span>' : '') + '</p>' + body() + button();
}
/* Tarjeta para «Más» (se vuelve a pintar sola al cambiar el estado) */
export function card() {
  if (hasDom && !U.at && U.state === 'idle') setTimeout(() => check(false), 0);
  return '<p class="eyebrow">Aplicación</p><div id="updCard" class="upd">' + inner() + '</div>';
}
export function footer() { return '<p class="ver-line">' + esc(versionText()) + ' · Created &amp; Developed by Felipe González</p>'; }
function paint() { if (!hasDom) return; const el = document.getElementById('updCard'); if (el) el.innerHTML = inner(); paintBar(); }
/* Aviso arriba de la pantalla cuando hay una versión nueva (sin entrar a «Más») */
function paintBar() {
  const el = hasDom && document.getElementById('updBar'); if (!el) return;
  const show = U.state === 'applying' || (U.state === 'new' && !U.later);
  el.hidden = !show;
  el.innerHTML = !show ? '' : U.state === 'applying' ? '<div><b>Actualizando…</b>La app se reinicia sola. No necesitas volver a entrar.</div>'
    : '<div><b>Hay una versión nueva: Versión ' + esc(label(U.remote)) + '</b>Tus datos y tu cuenta se conservan.</div>' +
      '<button class="btn sm" data-act="upd-apply">Actualizar ahora</button><button class="lnk" data-act="upd-later">Más tarde</button>';
}
export function onAct(act) {
  if (act === 'upd-check') { check(true); return true; }
  if (act === 'upd-apply') { apply(); return true; }
  if (act === 'upd-later') { U.later = true; paintBar(); return true; }
  return false;
}
/* Comprobación al abrir la app y al volver a ella si pasaron 15 min desde la última. */
const AGAIN = 15 * 60000;
let watching = false;
export function checkSoon() {
  if (!hasDom) return;
  setTimeout(() => check(false), 1500);
  if (watching) return; watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && U.state !== 'new' && (!U.at || Date.now() - U.at > AGAIN)) check(true);
  });
}
