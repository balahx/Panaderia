/* Único punto de contacto con Firebase. El SDK se carga desde la copia local (vendor/, la descarga tools/vendor.js):
   nada viene de otros sitios. Fase 1: sesión. Fase 2: Firestore con caché sin conexión, accesos y App Check (opcional). */
import * as cfg from '../../firebase-config.js';

const SDK = '../../vendor/firebase/';
const firebaseConfig = cfg.firebaseConfig || {}, googleClientId = cfg.googleClientId || '';
let app = null, auth = null, A = null, db = null, F = null;
const E = { datos: 'sin-iniciar', appCheck: 'sin-configurar' };

const lleno = v => typeof v === 'string' && v.length > 0 && !/^PEGAR/i.test(v);
/* ¿Ya se pegaron los datos del proyecto en firebase-config.js? */
export const configurada = () => lleno(firebaseConfig.apiKey) && lleno(firebaseConfig.projectId) && lleno(firebaseConfig.appId) && lleno(googleClientId);
export const clienteGoogle = () => googleClientId;
export const proyecto = () => lleno(firebaseConfig.projectId) ? firebaseConfig.projectId : '';
/* Para «Diagnóstico»: datos = 'cache' (guarda copia sin conexión) | 'memoria' | 'sin-sdk' · appCheck = 'activo' | 'sin-configurar' | 'sin-sdk' | 'error' */
export const estado = () => Object.assign({}, E);

/* Carga el SDK y prepara la sesión. La sesión se guarda en el equipo: al reabrir (también sin internet) sigue iniciada. */
export async function iniciar() {
  if (auth) return;
  let B;
  try { [B, A] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]); }
  catch (e) { const err = new Error('Falta la copia local del SDK de Firebase (APP/vendor/firebase).'); err.code = 'sin-sdk'; throw err; }
  app = B.initializeApp(firebaseConfig);
  await appCheck();
  /* Sin «popupRedirectResolver»: el SDK no carga marcos ni scripts de Google (el ingreso lo hace core/acceso.js). */
  auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
  await datos();
}
/* App Check (PLAN §9): solo si hay clave de reCAPTCHA en firebase-config.js. Se activa con GUIA-FIREBASE.md, paso 16
   (ahí se abre la política de contenido para reCAPTCHA). Si falla, la app sigue: en modo supervisar Firebase no lo exige. */
async function appCheck() {
  if (!lleno(cfg.appCheckSiteKey)) return;
  let C;
  try { C = await import(SDK + 'firebase-app-check.js'); } catch (e) { E.appCheck = 'sin-sdk'; return; }
  try { C.initializeAppCheck(app, { provider: new C.ReCaptchaV3Provider(cfg.appCheckSiteKey), isTokenAutoRefreshEnabled: true }); E.appCheck = 'activo'; }
  catch (e) { E.appCheck = 'error'; }
}
/* Firestore con su caché propia sin conexión (decisión del plan): lo leído queda en el equipo y lo escrito sin internet
   se envía solo al volver la conexión. Si el navegador no deja guardar (modo privado), funciona en memoria. */
async function datos() {
  try { F = await import(SDK + 'firebase-firestore.js'); } catch (e) { E.datos = 'sin-sdk'; return; }
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); E.datos = 'cache'; }
  catch (e) { db = F.getFirestore(app); E.datos = 'memoria'; }
}
const persona = u => u ? { uid: u.uid, nombre: u.displayName || (u.email || '').split('@')[0] || 'Sin nombre', correo: u.email || '' } : null;
/* Avisa cada vez que cambia la sesión: cb(persona) o cb(null). Devuelve la función para dejar de escuchar. */
export const alCambiarSesion = cb => A.onAuthStateChanged(auth, u => cb(persona(u)));
export const usuario = () => persona(auth && auth.currentUser);
export const entrarConIdToken = idToken => A.signInWithCredential(auth, A.GoogleAuthProvider.credential(idToken));
/* Cierra la sesión y borra la copia sin conexión de los datos: en un equipo compartido no debe quedar nada de la cuenta anterior.
   Devuelve true si hay que recargar la página (la conexión con los datos quedó cerrada). */
export async function salir() {
  await A.signOut(auth);
  if (!db) return false;
  try { await F.terminate(db); await F.clearIndexedDbPersistence(db); } catch (e) { /* otra pestaña abierta: la copia se renueva al entrar */ }
  db = null;
  return true;
}

/* ---------- Datos ---------- */
export const hayDatos = () => !!db;
/* Las fechas de Firestore pasan a milisegundos; lo demás queda igual. */
function plano(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (Array.isArray(v)) return v.map(plano);
  if (v && typeof v === 'object') { const r = {}; for (const k in v) r[k] = plano(v[k]); return r; }
  return v;
}
const fallo = (e, alFallar) => { if (alFallar) alFallar(String(e && (e.code || e.message) || 'error')); };
/* Escucha un documento: cb(datos o null, { cache }). `cache: true` = viene de la copia del equipo (sin confirmar con el servidor). */
export function vigilarDoc(ruta, cb, alFallar) {
  return F.onSnapshot(F.doc(db, ruta), { includeMetadataChanges: true },
    s => cb(s.exists() ? plano(s.data()) : null, { cache: s.metadata.fromCache }), e => fallo(e, alFallar));
}
/* Escucha una colección completa: cb([{ id, …datos }], { cache }). */
export function vigilarCol(ruta, cb, alFallar) {
  return F.onSnapshot(F.collection(db, ruta), { includeMetadataChanges: true },
    s => cb(s.docs.map(d => Object.assign({ id: d.id }, plano(d.data()))), { cache: s.metadata.fromCache }), e => fallo(e, alFallar));
}

/* ---------- Accesos (PLAN §2 y §7). Las reglas de Firestore deciden; aquí solo se envía ---------- */
export function pedirAcceso(nombre) {
  const u = usuario();
  return F.setDoc(F.doc(db, 'solicitudes/' + u.uid), { nombre: nombre, correo: u.correo, creado: F.serverTimestamp() });
}
export const retirarSolicitud = uid => F.deleteDoc(F.doc(db, 'solicitudes/' + uid));
const ficha = (s, perfil, activo) => ({ nombre: s.nombre, correo: s.correo, perfil: perfil, activo: activo, por: usuario().uid, en: F.serverTimestamp() });
/* Aprobar: crea la ficha de miembro y borra la solicitud, juntas (o las dos o ninguna). */
export function aprobar(s, perfil) {
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'miembros/' + s.id), ficha(s, perfil, true));
  b.delete(F.doc(db, 'solicitudes/' + s.id));
  return b.commit();
}
/* Cambiar perfil, quitar o devolver el acceso: se reescribe la ficha completa, a nombre de quien lo hace. */
export const guardarMiembro = (m, perfil, activo) => F.setDoc(F.doc(db, 'miembros/' + m.id), ficha(m, perfil, activo));
export const borrarMiembro = uid => F.deleteDoc(F.doc(db, 'miembros/' + uid));
