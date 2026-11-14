/* Único punto de contacto con Firebase. El SDK se carga desde la copia local (vendor/, la descarga tools/vendor.js):
   nada viene de otros sitios. En la Fase 1 solo hay ingreso; Firestore se agrega en la Fase 2. */
import { firebaseConfig, googleClientId } from '../../firebase-config.js';

const SDK = '../../vendor/firebase/';
let app = null, auth = null, A = null;

const lleno = v => typeof v === 'string' && v.length > 0 && !/^PEGAR/i.test(v);
/* ¿Ya se pegaron los datos del proyecto en firebase-config.js? */
export const configurada = () => lleno(firebaseConfig.apiKey) && lleno(firebaseConfig.projectId) && lleno(firebaseConfig.appId) && lleno(googleClientId);
export const clienteGoogle = () => googleClientId;
export const proyecto = () => lleno(firebaseConfig.projectId) ? firebaseConfig.projectId : '';

/* Carga el SDK y prepara la sesión. La sesión se guarda en el equipo: al reabrir (también sin internet) sigue iniciada. */
export async function iniciar() {
  if (auth) return;
  let F;
  try { [F, A] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]); }
  catch (e) { const err = new Error('Falta la copia local del SDK de Firebase (APP/vendor/firebase).'); err.code = 'sin-sdk'; throw err; }
  app = F.initializeApp(firebaseConfig);
  /* Sin «popupRedirectResolver»: el SDK no carga marcos ni scripts de Google (el ingreso lo hace core/acceso.js). */
  auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
}
const persona = u => u ? { uid: u.uid, nombre: u.displayName || (u.email || '').split('@')[0] || 'Sin nombre', correo: u.email || '' } : null;
/* Avisa cada vez que cambia la sesión: cb(persona) o cb(null). Devuelve la función para dejar de escuchar. */
export const alCambiarSesion = cb => A.onAuthStateChanged(auth, u => cb(persona(u)));
export const usuario = () => persona(auth && auth.currentUser);
export const entrarConIdToken = idToken => A.signInWithCredential(auth, A.GoogleAuthProvider.credential(idToken));
export const salir = () => A.signOut(auth);
