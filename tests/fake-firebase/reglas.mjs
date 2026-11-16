/* COPIA A MANO de firestore.rules, para las pruebas de pantalla (tests/fake-firebase/firebase-firestore.js) y para
   tests/reglas-unit.js. La verdad la dice el emulador (tests/rules-emulator.js, en GitHub Actions) con los MISMOS casos
   (tests/reglas-casos.js): si esta copia y las reglas reales se separan, una de las dos pruebas falla.
   permitido(quien, op, ruta, datos, previo, leer, ahora)
     quien: { uid, email, email_verified } o null · op: 'get' | 'list' | 'create' | 'update' | 'delete'
     datos: documento nuevo (create/update, ya combinado con el anterior) o el filtro de la consulta (list: { campo: valor })
     previo: documento actual (o null) · leer(ruta): documento guardado o null · ahora: milisegundos (hora del servidor)
   La hora del servidor se marca con  { __ts: true }  (lo que deja serverTimestamp() antes de guardarse). */
export const TS = { __ts: true };
const esTS = v => !!v && v.__ts === true;
const texto = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const num = v => typeof v === 'number' && !Number.isNaN(v);
const solo = (o, ks) => Object.keys(o).every(k => ks.includes(k));
const todas = (o, ks) => ks.every(k => k in o);
const dia = ms => new Date(ms).toISOString().slice(0, 10);
export const esHoy = (fecha, ahora) => fecha === dia(ahora - 3 * 3600000) || fecha === dia(ahora - 4 * 3600000);

export function permitido(quien, op, ruta, datos, previo, leer, ahora) {
  try { return !!evaluar(quien, op, ruta, datos || {}, previo || null, leer, ahora); }
  catch (e) { return false; }   // como en las reglas reales: un error al evaluar es un «no»
}
function evaluar(q, op, ruta, d, prev, leer, ahora) {
  if (!q) return false;
  const [col, id, ...resto] = ruta.split('/');
  if (resto.length) return false;
  const neg = leer('config/negocio'), yo = leer('miembros/' + q.uid);
  const dueno = !!neg && Array.isArray(neg.duenos) && neg.duenos.includes(q.uid);
  const perfil = p => !!yo && yo.activo === true && yo.perfil === p;
  const gestion = dueno || perfil('externo'), pesaje = perfil('pesaje'), acceso = gestion || pesaje;
  const leerOp = op === 'get' || op === 'list', escribir = op === 'create' || op === 'update';

  if (col === 'config') {
    if (id !== 'negocio') return false;
    if (leerOp) return true;
    if (op !== 'update') return false;
    const cambiadas = [...new Set(Object.keys(d).concat(Object.keys(prev || {})))].filter(k => JSON.stringify(d[k]) !== JSON.stringify((prev || {})[k]));
    return dueno && cambiadas.every(k => ['nombre', 'iva'].includes(k)) && texto(d.nombre, 1, 60) && num(d.iva) && d.iva >= 0 && d.iva <= 100;
  }
  if (col === 'solicitudes') {
    if (op === 'get') return q.uid === id || dueno;
    if (op === 'list') return dueno;
    if (op === 'delete') return q.uid === id || dueno;
    if (op !== 'create') return false;
    const K = ['nombre', 'correo', 'creado'];
    return q.uid === id && solo(d, K) && todas(d, K) && texto(d.nombre, 2, 60) && q.email_verified === true && d.correo === q.email && esTS(d.creado);
  }
  if (col === 'miembros') {
    if (op === 'get') return q.uid === id || dueno;
    if (op === 'list' || op === 'delete') return dueno;
    const K = ['nombre', 'correo', 'perfil', 'activo', 'por', 'en'];
    return dueno && solo(d, K) && todas(d, K) && texto(d.nombre, 2, 60) && texto(d.correo, 3, 200) && ['externo', 'pesaje'].includes(d.perfil)
      && typeof d.activo === 'boolean' && d.por === q.uid && esTS(d.en);
  }
  if (col === 'productos') {
    if (leerOp) return acceso;
    if (!escribir || !gestion) return false;
    const valido = solo(d, ['nombre', 'unidad', 'pesoRef', 'categoria', 'orden', 'activo', 'en']) && todas(d, ['nombre', 'unidad', 'activo', 'en']) && texto(d.nombre, 1, 60)
      && ['kg', 'un'].includes(d.unidad) && typeof d.activo === 'boolean'
      && (!('pesoRef' in d) || (d.unidad === 'un' && num(d.pesoRef) && d.pesoRef > 0 && d.pesoRef <= 100000))
      && (!('categoria' in d) || texto(d.categoria, 1, 40))
      && (!('orden' in d) || (num(d.orden) && d.orden >= 0 && d.orden <= 100000)) && esTS(d.en);
    return valido && (op === 'create' || d.unidad === prev.unidad);
  }
  if (col === 'precios') {
    if (leerOp || op === 'delete') return gestion;
    const K = ['productoId', 'clienteId', 'neto', 'desde', 'en'];
    return gestion && solo(d, K) && todas(d, K) && texto(d.productoId, 1, 60) && texto(d.clienteId, 1, 60) && num(d.neto) && d.neto > 0 && d.neto <= 100000000
      && typeof d.desde === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.desde) && id === d.productoId + '_' + d.clienteId + '_' + d.desde && esTS(d.en);
  }
  if (col === 'trabajadores' || col === 'clientes') {
    if (leerOp) return col === 'trabajadores' ? acceso : gestion;
    const K = ['nombre', 'activo', 'en'];
    return escribir && gestion && solo(d, K) && todas(d, K) && texto(d.nombre, 1, 60) && typeof d.activo === 'boolean' && esTS(d.en);
  }
  if (col === 'pesajes') {
    if (op === 'get') return gestion || (pesaje && esHoy(prev.fecha, ahora));
    if (op === 'list') return gestion || (pesaje && esHoy(d.fecha, ahora));   // d: el filtro de la consulta
    if (op === 'delete') return false;
    const valido = solo(d, ['fecha', 'hora', 'entregaN', 'productoId', 'cantidad', 'unidad', 'trabajadorId', 'nota', 'anulado', 'creadoPor', 'en'])
      && todas(d, ['fecha', 'productoId', 'cantidad', 'unidad', 'creadoPor', 'en']) && texto(d.fecha, 10, 10) && texto(d.productoId, 1, 60)
      && num(d.cantidad) && d.cantidad > 0 && d.cantidad <= 100000 && ['kg', 'un'].includes(d.unidad)
      && (!('nota' in d) || texto(d.nota, 0, 200)) && (!('anulado' in d) || typeof d.anulado === 'boolean') && esTS(d.en);
    if (op === 'create') return valido && d.creadoPor === q.uid && (gestion || (pesaje && esHoy(d.fecha, ahora)));
    return valido && d.creadoPor === prev.creadoPor && (gestion || (pesaje && esHoy(prev.fecha, ahora) && d.fecha === prev.fecha));
  }
  if (col === 'dias') {
    const hoy = op === 'list' ? false : esHoy(id, ahora);
    if (leerOp) return gestion || (pesaje && hoy);
    return escribir && (gestion || (pesaje && hoy)) && esTS(d.en);
  }
  if (col === 'cierres') {
    if (leerOp) return gestion;
    const cerrado = !!prev && prev.cerrado === true;
    if (op === 'create') return gestion && esTS(d.en);
    if (op === 'update') return gestion && !cerrado && esTS(d.en);
    return gestion && !cerrado;
  }
  if (col === 'proyeccion') {
    if (leerOp) return gestion;
    return escribir && gestion && esTS(d.en);
  }
  if (col === 'cambios') {
    if (leerOp) return gestion;
    return op === 'create' && acceso && d.por === q.uid && esTS(d.en);
  }
  return false;
}
