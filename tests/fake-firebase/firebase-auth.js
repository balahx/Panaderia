/* Doble de prueba de firebase-auth.js: guarda la sesión en localStorage y acepta cualquier id_token bien formado.
   Si el token trae  "rechazar": true  simula que Firebase no lo acepta. */
const KEY = 'fake.sesion', subs = new Set();
let cur = null; try { cur = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { cur = null; }
const avisar = () => subs.forEach(cb => cb(cur));
const datos = t => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
export const indexedDBLocalPersistence = { type: 'LOCAL' }, browserLocalPersistence = { type: 'LOCAL' };
export function initializeAuth(app, o) { window.__fakeAuth = { opciones: o }; return { app, get currentUser() { return cur; } }; }
export function onAuthStateChanged(auth, cb) { subs.add(cb); Promise.resolve().then(() => cb(cur)); return () => subs.delete(cb); }
export const GoogleAuthProvider = { credential: idToken => ({ providerId: 'google.com', idToken }) };
export async function signInWithCredential(auth, cred) {
  const d = datos(cred.idToken);
  if (d.rechazar) { const e = new Error('Firebase: Error (auth/invalid-credential).'); e.code = 'auth/invalid-credential'; throw e; }
  cur = { uid: 'u-' + d.sub, email: d.email, displayName: d.name };
  localStorage.setItem(KEY, JSON.stringify(cur)); avisar();
  return { user: cur };
}
export async function signOut() { cur = null; localStorage.removeItem(KEY); avisar(); }
