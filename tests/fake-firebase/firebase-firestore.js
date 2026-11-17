/* Doble de prueba de firebase-firestore.js: guarda los documentos en localStorage y aplica la COPIA A MANO de las reglas
   (reglas.mjs). Imita lo que usa core/nube.js: escuchas en vivo, escrituras, lotes, hora del servidor y la copia sin conexión.
   Estado inicial: «Rosa» (u-1001, la cuenta por defecto de google.js) es dueña, para que las pruebas de la Fase 1 entren directo.
   Sin conexión (fuera(true)) las escrituras quedan PENDIENTES en el equipo: se ven al instante con hasPendingWrites (como en Firestore),
   y al volver la conexión (fuera(false)) se envían en orden y pasan por las reglas con la hora de ESE momento.
   Para las pruebas:  window.__fakeDb = { poner, borrar, leer, todo, fuera, pedir, pendientes }  (poner y borrar NO pasan por las reglas). */
import { permitido, TS } from './reglas.mjs';
const L = localStorage, K = 'fake.db', KC = 'fake.cache', KF = 'fake.fuera', KP = 'fake.pend';
const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 } };
const todo = () => { try { return JSON.parse(L.getItem(K)) || Object.assign({}, SEMILLA); } catch (e) { return Object.assign({}, SEMILLA); } };
const guardar = d => L.setItem(K, JSON.stringify(d));
const cache = () => { try { return JSON.parse(L.getItem(KC)) || []; } catch (e) { return []; } };
const recordar = rutas => { const c = new Set(cache()); rutas.forEach(r => c.add(r)); L.setItem(KC, JSON.stringify([...c])); };
const fuera = () => L.getItem(KF) === '1';
const quien = () => { try { const u = JSON.parse(L.getItem('fake.sesion') || 'null'); return u ? { uid: u.uid, email: u.email, email_verified: !/^sinverificar/.test(u.email) } : null; } catch (e) { return null; } };
const leer = r => { const d = todo(); return r in d ? d[r] : null; };
const denegado = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const sellar = (o, t) => { const r = {}; for (const k in o) r[k] = o[k] && o[k].__ts ? (t || Date.now()) : o[k]; return r; };
const enCol = (d, col) => Object.keys(d).filter(r => r.startsWith(col + '/') && r.split('/').length === col.split('/').length + 1);

/* Escrituras pendientes (sin conexión): [{ id, ops: [{ op, ruta, datos }] }]. Sus promesas se cumplen al enviarse (si la página sigue abierta). */
const pend = () => { try { return JSON.parse(L.getItem(KP)) || []; } catch (e) { return []; } };
const esperando = new Map(); let nPend = 0;
/* Lo que ve el equipo: sin conexión, solo lo que ya tenía guardado más lo anotado aquí y aún no enviado. */
function vista() {
  const d = todo(), off = fuera(), c = off ? new Set(cache()) : null, v = {}, marcadas = new Set();
  for (const r in d) if (!off || c.has(r)) v[r] = d[r];
  for (const b of pend()) for (const o of b.ops) { marcadas.add(o.ruta); if (o.op === 'delete') delete v[o.ruta]; else v[o.ruta] = sellar(o.datos, b.est); }
  return { v, marcadas, off };
}
const cumple = (datos, filtro) => Object.keys(filtro || {}).every(k => datos && datos[k] === filtro[k]);

const escuchas = new Set();
function emitir(w) {
  const { v, marcadas, off } = vista(), d = todo();
  let snap, firma;
  if (w.ref.tipo === 'doc') {
    const r = w.ref.ruta, hay = r in v;
    if (!off && !permitido(quien(), 'get', r, null, d[r] || null, leer, Date.now())) { escuchas.delete(w); if (w.err) w.err(denegado()); return; }
    if (!off) recordar([r]);
    firma = JSON.stringify([hay ? v[r] : null, off, marcadas.has(r)]);
    snap = { id: r.split('/').pop(), exists: () => hay, data: () => (hay ? v[r] : undefined), metadata: { fromCache: off, hasPendingWrites: marcadas.has(r) } };
  } else {
    const col = w.ref.ruta, filtro = w.ref.filtro || {};
    if (!off && !permitido(quien(), 'list', col, filtro, null, leer, Date.now())) { escuchas.delete(w); if (w.err) w.err(denegado()); return; }
    const rutas = enCol(v, col).filter(r => cumple(v[r], filtro)).sort();
    if (!off) recordar(rutas.filter(r => r in d));
    firma = JSON.stringify([rutas.map(r => [r, v[r], marcadas.has(r)]), off]);
    snap = { docs: rutas.map(r => ({ id: r.split('/').pop(), data: () => v[r], metadata: { hasPendingWrites: marcadas.has(r), fromCache: off } })),
      metadata: { fromCache: off, hasPendingWrites: rutas.some(r => marcadas.has(r)) } };
  }
  if (firma === w.firma) return;
  w.firma = firma; w.next(snap);
}
const avisar = () => setTimeout(() => [...escuchas].forEach(emitir), 0);
addEventListener('storage', e => { if ([K, KF, KP, 'fake.sesion'].includes(e.key)) avisar(); });
setTimeout(vaciar, 0);   // si la página se abrió con conexión y quedaban escrituras de antes, se envían

export const persistentMultipleTabManager = () => ({ tipo: 'varias-pestañas' });
export const persistentLocalCache = o => ({ tipo: 'persistente', o });
export function initializeFirestore(app, o) { window.__fakeFs = { opciones: o }; return { app, tipo: 'firestore' }; }
export const getFirestore = app => ({ app, tipo: 'firestore' });
export const doc = (db, ruta) => ({ tipo: 'doc', ruta });
export const collection = (db, ruta) => ({ tipo: 'col', ruta });
/* Consultas: solo filtros de igualdad (lo que usa la app). */
export const where = (campo, op, valor) => ({ campo, op, valor });
export function query(ref, ...filtros) {
  const filtro = Object.assign({}, ref.filtro);
  filtros.forEach(f => { if (f.op !== '==') throw new Error('El doble de prueba solo entiende «=="»'); filtro[f.campo] = f.valor; });
  return Object.assign({}, ref, { filtro });
}
export const serverTimestamp = () => TS;
export function onSnapshot(ref, opciones, next, err) {
  const w = { ref, next, err, firma: null }; escuchas.add(w);
  setTimeout(() => { if (escuchas.has(w)) emitir(w); }, 0);
  return () => escuchas.delete(w);
}
/* Con conexión: pasa por las reglas y se guarda (o todo o nada). Sin conexión: queda pendiente y la promesa espera al envío. */
function enviar(ops) {
  const d = todo(), ahora = Date.now(), ver = r => (r in d ? d[r] : null);
  for (const o of ops) {
    const prev = ver(o.ruta), op = o.op === 'delete' ? 'delete' : prev ? 'update' : 'create';
    if (!permitido(quien(), op, o.ruta, o.datos, prev, ver, ahora)) return false;
  }
  for (const o of ops) { if (o.op === 'delete') delete d[o.ruta]; else d[o.ruta] = sellar(o.datos); }
  guardar(d); return true;
}
function aplicar(ops) {
  if (fuera()) {
    const id = Date.now() + '-' + (++nPend) + '-' + Math.random().toString(36).slice(2, 6);
    L.setItem(KP, JSON.stringify(pend().concat([{ id, ops, est: Date.now() }]))); avisar();
    return new Promise((res, rej) => esperando.set(id, { res, rej }));
  }
  if (!enviar(ops)) return Promise.reject(denegado());
  avisar(); return Promise.resolve();
}
/* Al volver la conexión: se envían en orden; las que las reglas rechazan se descartan (y su promesa falla). */
function vaciar() {
  const lista = pend(); if (!lista.length || fuera()) return;
  L.removeItem(KP);
  for (const b of lista) { const ok = enviar(b.ops), e = esperando.get(b.id); esperando.delete(b.id); if (e) { if (ok) e.res(); else e.rej(denegado()); } }
  avisar(); finEspera.splice(0).forEach(f => f());
}
const finEspera = [];
export const waitForPendingWrites = () => (pend().length ? new Promise(r => finEspera.push(r)) : Promise.resolve());
export const setDoc = (ref, datos) => aplicar([{ op: 'set', ruta: ref.ruta, datos }]);
/* updateDoc: cambia solo los campos dados; el documento debe existir. */
export const updateDoc = (ref, datos) => (leer(ref.ruta) ? aplicar([{ op: 'set', ruta: ref.ruta, datos: Object.assign({}, leer(ref.ruta), datos) }]) : Promise.reject(Object.assign(new Error('No document to update'), { code: 'not-found' })));
export const deleteDoc = ref => aplicar([{ op: 'delete', ruta: ref.ruta }]);
export function writeBatch() {
  const ops = [];
  return { set(ref, datos) { ops.push({ op: 'set', ruta: ref.ruta, datos }); }, delete(ref) { ops.push({ op: 'delete', ruta: ref.ruta }); }, commit: () => aplicar(ops) };
}
export async function terminate() { escuchas.clear(); window.__fakeFs.terminado = true; }
export async function clearIndexedDbPersistence() { L.removeItem(KC); L.removeItem(KP); window.__fakeFs.copiaBorrada = true; }

window.__fakeDb = {
  poner(ruta, datos) { const d = todo(); d[ruta] = datos; guardar(d); avisar(); },
  borrar(ruta) { const d = todo(); delete d[ruta]; guardar(d); avisar(); },
  leer, todo,
  fuera(si) { if (si) L.setItem(KF, '1'); else { L.removeItem(KF); vaciar(); } avisar(); },
  pendientes: () => pend(),
  /* Petición directa con la cuenta actual, como la haría alguien saltándose la app: true si las reglas la permiten. */
  pedir(op, ruta, datos) { const prev = leer(ruta); return permitido(quien(), op === 'set' ? (prev ? 'update' : 'create') : op, ruta, datos || (op === 'list' ? {} : null), prev, leer, Date.now()); },
  cache
};
