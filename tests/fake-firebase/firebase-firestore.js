/* Doble de prueba de firebase-firestore.js: guarda los documentos en localStorage y aplica la COPIA A MANO de las reglas
   (reglas.mjs). Imita lo que usa core/nube.js: escuchas en vivo, escrituras, lotes, hora del servidor y la copia sin conexión.
   Estado inicial: «Rosa» (u-1001, la cuenta por defecto de google.js) es dueña, para que las pruebas de la Fase 1 entren directo.
   Para las pruebas:  window.__fakeDb = { poner, borrar, leer, todo, fuera, pedir }  (poner y borrar NO pasan por las reglas). */
import { permitido, TS } from './reglas.mjs';
const L = localStorage, K = 'fake.db', KC = 'fake.cache', KF = 'fake.fuera';
const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 } };
const todo = () => { try { return JSON.parse(L.getItem(K)) || Object.assign({}, SEMILLA); } catch (e) { return Object.assign({}, SEMILLA); } };
const guardar = d => L.setItem(K, JSON.stringify(d));
const cache = () => { try { return JSON.parse(L.getItem(KC)) || []; } catch (e) { return []; } };
const recordar = rutas => { const c = new Set(cache()); rutas.forEach(r => c.add(r)); L.setItem(KC, JSON.stringify([...c])); };
const fuera = () => L.getItem(KF) === '1';
const quien = () => { try { const u = JSON.parse(L.getItem('fake.sesion') || 'null'); return u ? { uid: u.uid, email: u.email, email_verified: !/^sinverificar/.test(u.email) } : null; } catch (e) { return null; } };
const leer = r => { const d = todo(); return r in d ? d[r] : null; };
const denegado = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const sellar = o => { const r = {}; for (const k in o) r[k] = o[k] && o[k].__ts ? Date.now() : o[k]; return r; };
const enCol = (d, col) => Object.keys(d).filter(r => r.startsWith(col + '/') && r.split('/').length === col.split('/').length + 1);

const escuchas = new Set();
function emitir(w) {
  const d = todo(), off = fuera(), c = off ? new Set(cache()) : null;
  let snap, firma;
  if (w.ref.tipo === 'doc') {
    const r = w.ref.ruta, hay = r in d && (!off || c.has(r));
    if (!off && !permitido(quien(), 'get', r, null, d[r] || null, leer, Date.now())) { escuchas.delete(w); if (w.err) w.err(denegado()); return; }
    if (!off) recordar([r]);
    firma = JSON.stringify([hay ? d[r] : null, off]);
    snap = { id: r.split('/').pop(), exists: () => hay, data: () => (hay ? d[r] : undefined), metadata: { fromCache: off, hasPendingWrites: false } };
  } else {
    const col = w.ref.ruta;
    if (!off && !permitido(quien(), 'list', col, {}, null, leer, Date.now())) { escuchas.delete(w); if (w.err) w.err(denegado()); return; }
    const rutas = enCol(d, col).filter(r => !off || c.has(r));
    if (!off) recordar(rutas);
    firma = JSON.stringify([rutas.map(r => [r, d[r]]), off]);
    snap = { docs: rutas.map(r => ({ id: r.split('/').pop(), data: () => d[r] })), metadata: { fromCache: off, hasPendingWrites: false } };
  }
  if (firma === w.firma) return;
  w.firma = firma; w.next(snap);
}
const avisar = () => setTimeout(() => [...escuchas].forEach(emitir), 0);
addEventListener('storage', e => { if ([K, KF, 'fake.sesion'].includes(e.key)) avisar(); });

export const persistentMultipleTabManager = () => ({ tipo: 'varias-pestañas' });
export const persistentLocalCache = o => ({ tipo: 'persistente', o });
export function initializeFirestore(app, o) { window.__fakeFs = { opciones: o }; return { app, tipo: 'firestore' }; }
export const getFirestore = app => ({ app, tipo: 'firestore' });
export const doc = (db, ruta) => ({ tipo: 'doc', ruta });
export const collection = (db, ruta) => ({ tipo: 'col', ruta });
export const serverTimestamp = () => TS;
export function onSnapshot(ref, opciones, next, err) {
  const w = { ref, next, err, firma: null }; escuchas.add(w);
  setTimeout(() => { if (escuchas.has(w)) emitir(w); }, 0);
  return () => escuchas.delete(w);
}
/* Sin conexión, las escrituras quedan pendientes (la promesa no termina), como en Firestore. */
const pendiente = () => new Promise(() => {});
function aplicar(ops) {
  if (fuera()) return pendiente();
  const d = todo(), ahora = Date.now(), ver = r => (r in d ? d[r] : null);
  for (const o of ops) {
    const prev = ver(o.ruta), op = o.op === 'delete' ? 'delete' : prev ? 'update' : 'create';
    if (!permitido(quien(), op, o.ruta, o.datos, prev, ver, ahora)) return Promise.reject(denegado());
  }
  for (const o of ops) { if (o.op === 'delete') delete d[o.ruta]; else d[o.ruta] = sellar(o.datos); }
  guardar(d); avisar();
  return Promise.resolve();
}
export const setDoc = (ref, datos) => aplicar([{ op: 'set', ruta: ref.ruta, datos }]);
export const deleteDoc = ref => aplicar([{ op: 'delete', ruta: ref.ruta }]);
export function writeBatch() {
  const ops = [];
  return { set(ref, datos) { ops.push({ op: 'set', ruta: ref.ruta, datos }); }, delete(ref) { ops.push({ op: 'delete', ruta: ref.ruta }); }, commit: () => aplicar(ops) };
}
export async function terminate() { escuchas.clear(); window.__fakeFs.terminado = true; }
export async function clearIndexedDbPersistence() { L.removeItem(KC); window.__fakeFs.copiaBorrada = true; }

window.__fakeDb = {
  poner(ruta, datos) { const d = todo(); d[ruta] = datos; guardar(d); avisar(); },
  borrar(ruta) { const d = todo(); delete d[ruta]; guardar(d); avisar(); },
  leer, todo,
  fuera(si) { if (si) L.setItem(KF, '1'); else L.removeItem(KF); avisar(); },
  /* Petición directa con la cuenta actual, como la haría alguien saltándose la app: true si las reglas la permiten. */
  pedir(op, ruta, datos) { const prev = leer(ruta); return permitido(quien(), op === 'set' ? (prev ? 'update' : 'create') : op, ruta, datos || (op === 'list' ? {} : null), prev, leer, Date.now()); },
  cache
};
