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
export const esAyer = (fecha, ahora) => fecha === dia(ahora - 27 * 3600000) || fecha === dia(ahora - 28 * 3600000);
export const esManana = (fecha, ahora) => fecha === dia(ahora + 21 * 3600000) || fecha === dia(ahora + 20 * 3600000);   // Fase 10
const fechaValida = f => typeof f === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(f);
const mapa = v => !!v && typeof v === 'object' && !Array.isArray(v) && !esTS(v);
const entero = v => Number.isInteger(v);
/* Fase 6: el mes de una fecha está cerrado si cierres/{AAAA-MM} tiene cerrado == true. */
const mesAbierto = (f, leer) => { const c = leer('cierres/' + String(f).slice(0, 7)); return !c || c.cerrado !== true; };
const mesTerminado = (mes, ahora) => mes + '-31' < dia(ahora - 3 * 3600000);
const CIERRE = ['mes', 'origen', 'cerrado', 'clienteId', 'cliente', 'clientes', 'iva', 'lineas', 'neto', 'ivaMonto', 'total', 'kg', 'un', 'canastos', 'dias', 'sinPrecio', 'archivo', 'hoja',
  'reabiertoPor', 'reabiertoQuien', 'reabiertoEn', 'por', 'quien', 'en'];
function cierreValido(id, d, q, ahora) {
  return /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(id) && mesTerminado(id, ahora) && solo(d, CIERRE)
    && todas(d, ['mes', 'origen', 'cerrado', 'iva', 'lineas', 'neto', 'ivaMonto', 'total', 'kg', 'un', 'por', 'quien', 'en']) && d.mes === id
    && ['excel', 'app'].includes(d.origen) && d.cerrado === true && num(d.iva) && d.iva >= 0 && d.iva <= 100
    && Array.isArray(d.lineas) && d.lineas.length >= 1 && d.lineas.length <= 600 && (!('clientes' in d) || (Array.isArray(d.clientes) && d.clientes.length <= 50)) && entero(d.neto) && d.neto >= 0 && entero(d.ivaMonto) && d.ivaMonto >= 0
    && d.total === d.neto + d.ivaMonto && num(d.kg) && d.kg >= 0 && entero(d.un) && d.un >= 0
    && (!('clienteId' in d) || texto(d.clienteId, 1, 60)) && (!('cliente' in d) || texto(d.cliente, 1, 60))
    && (!('archivo' in d) || texto(d.archivo, 1, 200)) && (!('hoja' in d) || texto(d.hoja, 1, 100)) && d.por === q.uid && texto(d.quien, 1, 60) && esTS(d.en);
}
function reapertura(d, prev, q) {
  const cambiadas = [...new Set(Object.keys(d).concat(Object.keys(prev || {})))].filter(k => JSON.stringify(d[k]) !== JSON.stringify((prev || {})[k]));
  return cambiadas.every(k => ['cerrado', 'reabiertoPor', 'reabiertoQuien', 'reabiertoEn', 'en'].includes(k)) && d.cerrado === false && d.reabiertoPor === q.uid
    && texto(d.reabiertoQuien, 1, 60) && esTS(d.reabiertoEn) && esTS(d.en);
}

/* Fase 7: proyeccion/{AAAA} = { anio, factor, factorPrecio, panes, metas (12 × pesos enteros o null), por, quien, en } */
const factorValido = f => num(f) && f > 0 && f <= 10;
const metaValida = v => v === null || (entero(v) && v >= 0 && v <= 100000000000);
const PROY = ['anio', 'factor', 'factorPrecio', 'panes', 'metas', 'por', 'quien', 'en'];
function proyeccionValida(id, d, q) {
  return /^20[0-9]{2}$/.test(id) && solo(d, PROY) && todas(d, PROY) && entero(d.anio) && d.anio === Number(id) && factorValido(d.factor) && factorValido(d.factorPrecio)
    && mapa(d.panes) && Object.keys(d.panes).length <= 200 && Array.isArray(d.metas) && d.metas.length === 12 && d.metas.every(metaValida)
    && d.por === q.uid && texto(d.quien, 1, 60) && esTS(d.en);
}

/* Fase 9: costos. insumos/{id} · preciosInsumo/{insumo_fecha} · recetas/{producto_fecha} · gastos/{AAAA-MM} */
const mesValido = m => /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(m);
function costos(col, id, op, d, prev, q, gestion) {
  const leerOp = op === 'get' || op === 'list', escribir = op === 'create' || op === 'update';
  if (col === 'insumos') {
    if (leerOp) return gestion;
    const K = ['nombre', 'unidad', 'activo', 'en'];
    return escribir && gestion && solo(d, K) && todas(d, K) && texto(d.nombre, 1, 60) && ['kg', 'l', 'un'].includes(d.unidad) && typeof d.activo === 'boolean' && esTS(d.en)
      && (!prev || d.unidad === prev.unidad);
  }
  if (col === 'preciosInsumo') {
    if (leerOp || op === 'delete') return gestion;
    const K = ['insumoId', 'formato', 'neto', 'desde', 'en'];
    return gestion && solo(d, K) && todas(d, K) && texto(d.insumoId, 1, 60) && num(d.formato) && d.formato > 0 && d.formato <= 100000
      && num(d.neto) && d.neto >= 0 && d.neto <= 100000000 && fechaValida(d.desde) && id === d.insumoId + '_' + d.desde && esTS(d.en);
  }
  if (col === 'recetas') {
    if (leerOp || op === 'delete') return gestion;
    return gestion && solo(d, ['productoId', 'desde', 'items', 'rendimiento', 'nota', 'por', 'en']) && todas(d, ['productoId', 'desde', 'items', 'rendimiento', 'por', 'en'])
      && texto(d.productoId, 1, 60) && fechaValida(d.desde) && id === d.productoId + '_' + d.desde && Array.isArray(d.items) && d.items.length >= 1 && d.items.length <= 30
      && num(d.rendimiento) && d.rendimiento > 0 && d.rendimiento <= 100000 && (!('nota' in d) || texto(d.nota, 1, 200)) && d.por === q.uid && esTS(d.en);
  }
  if (col === 'gastos') {
    if (leerOp) return gestion;
    const K = ['mes', 'items', 'por', 'quien', 'en'];
    return escribir && gestion && mesValido(id) && solo(d, K) && todas(d, K) && d.mes === id && Array.isArray(d.items) && d.items.length <= 30
      && d.por === q.uid && texto(d.quien, 1, 60) && esTS(d.en);
  }
  return null;
}

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
    if (id === 'respaldo') {
      if (leerOp) return gestion;
      const K = ['por', 'quien', 'conteos', 'lecturas', 'en'];
      return escribir && gestion && solo(d, K) && todas(d, K) && d.por === q.uid && texto(d.quien, 1, 60) && mapa(d.conteos)
        && Number.isInteger(d.lecturas) && d.lecturas >= 0 && esTS(d.en);
    }
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
  if (col === 'trabajadores') {
    if (leerOp) return acceso;
    const K = ['nombre', 'activo', 'en'];
    return escribir && gestion && solo(d, K) && todas(d, K) && texto(d.nombre, 1, 60) && typeof d.activo === 'boolean' && esTS(d.en);
  }
  if (col === 'clientes') {   // Fase 11: la tablet los lee; `tipo` opcional ('regular' o 'suelta')
    if (leerOp) return acceso;
    return escribir && gestion && solo(d, ['nombre', 'activo', 'tipo', 'en']) && todas(d, ['nombre', 'activo', 'en']) && texto(d.nombre, 1, 60) && typeof d.activo === 'boolean'
      && (!('tipo' in d) || ['regular', 'suelta'].includes(d.tipo)) && esTS(d.en);
  }
  if (col === 'pesajes') {
    if (op === 'get') return gestion || (pesaje && esHoy(prev.fecha, ahora));
    if (op === 'list') return gestion || (pesaje && esHoy(d.fecha, ahora));   // d: el filtro de la consulta
    if (op === 'delete') return false;
    const prod = leer('productos/' + d.productoId);
    const valido = solo(d, ['fecha', 'hora', 'entregaN', 'clienteId', 'productoId', 'cantidad', 'unidad', 'trabajadorId', 'nota', 'anulado', 'creadoPor', 'en'])
      && todas(d, ['fecha', 'hora', 'entregaN', 'productoId', 'cantidad', 'unidad', 'trabajadorId', 'anulado', 'creadoPor', 'en']) && fechaValida(d.fecha)
      && typeof d.hora === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(d.hora)
      && Number.isInteger(d.entregaN) && d.entregaN >= 1 && d.entregaN <= 50
      && texto(d.productoId, 1, 60) && texto(d.trabajadorId, 1, 60)
      && num(d.cantidad) && d.cantidad > 0 && d.cantidad <= 100000 && ['kg', 'un'].includes(d.unidad) && (d.unidad === 'kg' || Number.isInteger(d.cantidad))
      && (!('nota' in d) || texto(d.nota, 1, 200)) && (!('clienteId' in d) || texto(d.clienteId, 1, 60)) && typeof d.anulado === 'boolean' && esTS(d.en)
      && !!prod && prod.unidad === d.unidad && !!leer('trabajadores/' + d.trabajadorId);
    const activo = cid => { const x = leer('clientes/' + cid); return !!x && x.activo === true; };   // Fase 11
    if (op === 'create') return valido && (!('clienteId' in d) || activo(d.clienteId)) && d.creadoPor === q.uid && ((gestion && mesAbierto(d.fecha, leer)) || (pesaje && (esHoy(d.fecha, ahora) || esAyer(d.fecha, ahora))));
    return valido && (!('clienteId' in d) || d.clienteId === (prev.clienteId || '') || activo(d.clienteId)) && d.creadoPor === prev.creadoPor && ((gestion && mesAbierto(prev.fecha, leer) && mesAbierto(d.fecha, leer)) || (pesaje && esHoy(prev.fecha, ahora) && d.fecha === prev.fecha));
  }
  if (col === 'dias') {   // Fase 11: dias/{fecha} (cliente original) o dias/{fecha}_{clienteId} (otro cliente, que debe existir)
    const partes = String(id || '').split('_'), f = partes[0];
    if (leerOp) return gestion || (pesaje && op === 'get' && esHoy(f, ahora));
    if (!escribir) return false;
    const idOk = fechaValida(f) && ((partes.length === 1 && id.length === 10) || (partes.length === 2 && texto(partes[1], 1, 60) && !!leer('clientes/' + partes[1])));
    const valido = idOk && solo(d, ['entregaN', 'por', 'en']) && todas(d, ['entregaN', 'por', 'en'])
      && Number.isInteger(d.entregaN) && d.entregaN >= 1 && d.entregaN <= 50 && d.por === q.uid && esTS(d.en);
    const suDia = pesaje && (esHoy(f, ahora) || esAyer(f, ahora));
    if (op === 'create') return valido && (gestion || (suDia && d.entregaN <= 2));
    return valido && (gestion || (suDia && (d.entregaN === prev.entregaN + 1 || d.entregaN === prev.entregaN - 1)));
  }
  if (col === 'cierres') {
    if (leerOp) return gestion;
    const cerrado = !!prev && prev.cerrado === true;
    if (op === 'create') return gestion && cierreValido(id, d, q, ahora);
    if (op === 'update') return (gestion && !cerrado && cierreValido(id, d, q, ahora)) || (dueno && cerrado && reapertura(d, prev, q));
    return op === 'delete' && gestion && !cerrado;
  }
  if (col === 'proyeccion') {
    if (leerOp) return gestion;
    return escribir && gestion && proyeccionValida(id, d, q);
  }
  if (col === 'planes') {   // Fase 10: plan de producción del día
    if (leerOp) return gestion || (pesaje && op === 'get' && esHoy(id, ahora));
    const hoyOManana = esHoy(id, ahora) || esManana(id, ahora);
    if (op === 'delete') return gestion && hoyOManana;
    const K = ['fecha', 'items', 'nota', 'por', 'quien', 'en'];
    return escribir && gestion && hoyOManana && fechaValida(id) && solo(d, K) && todas(d, ['fecha', 'items', 'por', 'quien', 'en']) && d.fecha === id
      && Array.isArray(d.items) && d.items.length >= 1 && d.items.length <= 60 && (!('nota' in d) || texto(d.nota, 1, 200))
      && d.por === q.uid && texto(d.quien, 1, 60) && esTS(d.en);
  }
  const co = costos(col, id, op, d, prev, q, gestion);
  if (co !== null) return co;
  if (col === 'cambios') {
    if (leerOp) return gestion;
    const K = ['tipo', 'pesajeId', 'fecha', 'antes', 'despues', 'por', 'en'];
    return op === 'create' && acceso && solo(d, K.concat(['quien'])) && todas(d, K) && ['corregir', 'anular', 'reactivar'].includes(d.tipo) && texto(d.pesajeId, 1, 60)
      && fechaValida(d.fecha) && mapa(d.antes) && mapa(d.despues) && d.por === q.uid && (!('quien' in d) || texto(d.quien, 1, 60)) && esTS(d.en) && (gestion || esHoy(d.fecha, ahora));
  }
  return false;
}
