/* Configuración web de Firebase. Estos valores NO son secretos: identifican el proyecto y viajan en toda app web.
   La protección real está en las reglas de Firestore, en la restricción de la clave y en App Check (PLAN §9).
   Cómo llenarlos: GUIA-FIREBASE.md, pasos 3 y 5. Mientras digan «PEGAR…», la app abre pero no deja ingresar. */
export const firebaseConfig = {
  apiKey: 'AIzaSyCpIx337hcaYd6kPOBhNJS0KF8m6TunKco',
  authDomain: 'panaderia-e2871.firebaseapp.com',
  projectId: 'panaderia-e2871',
  appId: '1:790218080343:web:82cee4d0a6dbccbca92312'
};
/* ID de cliente web de Google (termina en .apps.googleusercontent.com). Tampoco es secreto. */
export const googleClientId = '790218080343-sqp3v83ucnhsmv4q9pbphs3r6faur0uo.apps.googleusercontent.com';
