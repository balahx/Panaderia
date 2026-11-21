/* Cierres mensuales (PLAN §3.7, Fase 6). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/cierres-unit.js).
   Un cierre deja fijo un mes: cierres/{AAAA-MM} = { mes, origen: 'excel' | 'app', cerrado: true, iva (%), lineas: [por pan],
   neto, ivaMonto, total, kg, un, … , por, quien, en }. Desde que un mes está cerrado, sus totales son los del cierre (no se recalculan).
     · IVA del cierre = IVA % × neto del mes, redondeado UNA vez (decisión de Felipe, Fase 6), no la suma del IVA de cada línea.
     · Importar: los Excel de enero a octubre de 2026 traen totales por pan (kilos o unidades, precio, monto). Se leen con
       core/xlsx-leer.js, se interpretan aquí (interpretar), se emparejan los nombres con el catálogo (preparar) y se guardan (documento).
     · «Cerrar mes» (desdeApp): los pesajes del mes con el precio vigente de cada día (core/ventas.js), una línea por pan. */
import * as cat from './catalogo.js';
import * as V from './ventas.js';

/* ---------- Textos ---------- */
const base = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = s => base(s).replace(/[^a-z0-9%$]+/g, ' ').trim();
const kg2 = n => Math.round(n * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const finito = n => typeof n === 'number' && Number.isFinite(n);

const MESES = { enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7,
  agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9, octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12 };
export const anioDe = s => { const m = /(?:^|\D)(20\d\d)(?:\D|$)/.exec(base(s)); return m ? Number(m[1]) : 0; };
/* Mes de un texto: '2026-10', '10-2026', '31/10/2026', 'Octubre 2026', 'oct', 'cierre_10_2026.xlsx'… → 'AAAA-MM' ('' si no hay).
   Sin año: el de `anio`, o si no, el de hoy (o el anterior si ese mes todavía no llega). */
export function mesDeTexto(v, hoy, anio) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return '';
  const s = base(v);
  let m = /(?:^|\D)(20\d\d)[-/._ ](0?[1-9]|1[0-2])(?:\D|$)/.exec(s);
  if (m) return m[1] + '-' + pad(m[2]);
  m = /(?:^|\D)(0?[1-9]|1[0-2])[-/._ ](20\d\d)(?:\D|$)/.exec(s);
  if (m) return m[2] + '-' + pad(m[1]);
  const n = s.split(/[^a-z0-9]+/).map(w => MESES[w]).find(Boolean);
  if (!n) return '';
  let a = anioDe(s) || anio || 0;
  if (!a) { const [ah, mh] = (hoy || '2026-01').split('-').map(Number); a = n <= mh ? ah : ah - 1; }
  return a + '-' + pad(n);
}
/* Número de una celda: los de Excel tal cual; los escritos como texto, a la chilena (1.234,5) o con coma de miles (1,234.50). */
export function numeroDe(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const t = v.replace(/\s+/g, '').replace(/^\$/, '').replace(/(kgs?|kilos?|unid(ades)?|un|u|\$)$/i, '');
  if (!t) return NaN;
  const n = cat.numero(t);
  if (!Number.isNaN(n)) return n;
  return /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? Number(t.replace(/,/g, '')) : NaN;
}
export function unidadDe(v) {
  const t = norm(v);
  if (/^(kg|kgs|k|kilo|kilos|kilogramos?|peso|x kg|por kilo|granel)$/.test(t)) return 'kg';
  if (/^(un|u|und|unid|unidad|unidades|uds|c u|cu|por unidad|piezas?)$/.test(t)) return 'un';
  return null;
}

/* ---------- Encabezados ---------- */
/* Qué dato trae una columna según su título. Kilos y unidades pueden venir en columnas separadas. */
export function campoDe(titulo) {
  const t = norm(titulo); if (!t) return null;
  const w = ' ' + t + ' ', tiene = (...l) => l.some(x => w.includes(' ' + x + ' '));
  const plata = tiene('precio', 'valor', '$', 'monto', 'neto', 'total', 'iva');
  if (['unidad', 'unidad de medida', 'um', 'u m', 'medida', 'tipo de unidad', 'tipo unidad', 'tipo de venta'].includes(t)) return { campo: 'unidad' };
  if (['mes', 'periodo', 'mes ano', 'mes y ano'].includes(t)) return { campo: 'mes' };
  if (['fecha', 'dia', 'fecha de venta'].includes(t)) return { campo: 'fecha' };
  if (tiene('kilos', 'kilo', 'kg', 'kgs', 'kilogramos', 'peso') && !tiene('precio', 'valor', '$')) return { campo: 'cantidad', unidad: 'kg' };
  if ((tiene('unidades', 'unids', 'unid', 'und', 'uds') || t === 'un' || t === 'u') && !plata) return { campo: 'cantidad', unidad: 'un' };
  if (tiene('cantidad', 'cant', 'vendido', 'vendidos', 'vendida', 'vendidas') && !plata) return { campo: 'cantidad' };
  if (tiene('precio', 'pu', 'p unitario', 'valor unitario', 'valor kg', 'valor kilo', 'valor unidad') || t === 'valor') return { campo: 'precio' };
  if (tiene('sin iva') || (tiene('neto', 'monto', 'venta', 'ventas', 'subtotal', 'importe', 'valor total', 'venta neta') && !tiene('iva'))) return { campo: 'neto' };
  if (t === 'iva' || t === 'monto iva' || /^iva \d+( %)?$/.test(t) || t === 'iva %') return { campo: 'iva' };
  if (tiene('total', 'bruto', 'con iva')) return { campo: 'total' };
  if (tiene('pan', 'panes', 'producto', 'productos', 'tipo', 'descripcion', 'detalle', 'articulo', 'item', 'nombre', 'variedad', 'glosa')) return { campo: 'pan' };
  return null;
}
/* Fila de encabezados: una columna de pan y al menos una de cantidad, precio o monto. → { pan, kg, un, cantidad, … } (índices) o null */
export function encabezado(fila) {
  const c = {};
  if ((fila || []).some(v => typeof v === 'number' || (typeof v === 'string' && Number.isFinite(numeroDe(v))))) return null;   // una fila con números es de datos
  (fila || []).forEach((v, i) => {
    if (typeof v !== 'string') return;
    const x = campoDe(v); if (!x) return;
    const k = x.campo === 'cantidad' ? (x.unidad || 'cantidad') : x.campo;
    if (!(k in c)) c[k] = i;
  });
  if (!('pan' in c) || !['kg', 'un', 'cantidad', 'neto', 'total', 'precio'].some(k => k in c)) return null;
  return c;
}

/* ---------- Interpretar un libro ---------- */
const textoCelda = v => (v == null ? '' : typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : String(v));
const esTotal = n => /^(total|totales|subtotal|suma|sumas|total general|total mes|total del mes)\b/.test(n);
/* libro (de xlsx-leer) → { meses: [{ clave, mes, archivo, hoja, fila, filas: [...], total, avisos }], avisos }
   Cada bloque (una tabla con su encabezado) es un mes; con una columna «Mes» o «Fecha», cada fila dice su mes. */
export function interpretar(libro, archivo, hoy) {
  const meses = [], avisos = (libro.avisos || []).slice(), nomArch = String(archivo || '').replace(/\.xlsx$/i, '');
  for (const h of libro.hojas || []) {
    let titulo = '', bloque = null, tablas = 0, conDatos = false;
    const cerrar = () => { if (bloque) agregar(meses, bloque, { titulo: bloque.titulo, hoja: h.nombre, archivo: nomArch, hoy }); bloque = null; };
    (h.filas || []).forEach((fila, r) => {
      if ((fila || []).some(v => finito(v))) conDatos = true;
      const cab = encabezado(fila);
      if (cab) { cerrar(); tablas++; bloque = { cab, inicio: r + 1, titulo, filas: [], total: null, vacias: 0, sinNumeros: 0 }; titulo = ''; return; }
      const m = (fila || []).filter(v => typeof v === 'string').map(v => mesDeTexto(v, hoy)).find(Boolean) || '';
      const numeros = (fila || []).filter(v => finito(v)).length;
      if (!bloque) { if (m) titulo = m; return; }
      if (m && !numeros && (fila || []).filter(v => v != null && v !== '').length <= 2 && !textoCelda(fila[bloque.cab.pan])) { titulo = m; return; }   // título de la tabla siguiente
      leerFila(bloque, fila, r, hoy);
    });
    cerrar();
    if (!tablas && conDatos) avisos.push('«' + (archivo || 'archivo') + '» · hoja «' + h.nombre + '»: no se encontró la fila de títulos (por ejemplo: Pan · Kilos · Precio · Monto).');
  }
  return { meses, avisos };
}
function leerFila(b, fila, r, hoy) {
  const c = b.cab, g = k => (k in c ? fila[c[k]] : null), n = k => numeroDe(g(k));
  const nombre = textoCelda(g('pan')), nn = norm(nombre);
  const f = { fila: r + 1, nombre, kg: n('kg'), un: n('un'), cantidad: n('cantidad'), precio: n('precio'), neto: n('neto'), iva: n('iva'), total: n('total'), unidad: unidadDe(g('unidad')) };
  f.mes = 'mes' in c ? (typeof g('mes') === 'string' ? mesDeTexto(g('mes'), hoy) : '') : 'fecha' in c && typeof g('fecha') === 'string' ? mesDeTexto(g('fecha'), hoy) : '';
  const hay = ['kg', 'un', 'cantidad', 'precio', 'neto', 'iva', 'total'].some(k => finito(f[k]) && f[k] !== 0);
  if (!nombre && !hay) { b.vacias++; return; }
  if (esTotal(nn) || (!nombre && b.filas.length)) { if (!b.total) b.total = f; return; }
  if (!nombre) return;
  if (!hay) { b.sinNumeros++; return; }
  b.filas.push(f);
}
/* Cierra un bloque: decide qué es «Total» si no hay columna de neto, completa los montos y lo reparte por mes. */
function agregar(meses, b, o) {
  const c = b.cab, avisos = [];
  if (!('neto' in c) && 'total' in c) {
    const con = b.filas.filter(f => finito(f.total) && finito(f.precio) && finito(cantidadDe(f)));
    const r = con.length ? con.reduce((t, f) => t + f.total, 0) / con.reduce((t, f) => t + f.precio * cantidadDe(f), 0) : NaN;
    const bruto = Math.abs(r - 1.19) < 0.006 && !('iva' in c);
    b.filas.concat(b.total ? [b.total] : []).forEach(f => { f.neto = bruto ? cat.redondearPesos(f.total / 1.19) : f.total; if (bruto) f.iva = f.total - f.neto; });
    avisos.push(bruto ? 'La columna «Total» trae el IVA (19 %): el neto se calculó quitándolo.' : 'No hay columna de neto o monto: se tomó «Total» como el neto (sin IVA)' + (con.length ? '.' : ', sin poder comprobarlo con el precio.'));
  }
  for (const f of b.filas) {
    if (!finito(f.neto) && finito(f.total) && finito(f.iva)) f.neto = f.total - f.iva;
    if (!finito(f.neto) && finito(f.precio) && finito(cantidadDe(f))) { f.neto = cat.redondearPesos(f.precio * cantidadDe(f)); f.netoCalculado = true; }
    if (!finito(f.precio) && finito(f.neto) && cantidadDe(f) > 0) f.precio = Math.round(f.neto / cantidadDe(f) * 100) / 100;
  }
  if (b.filas.some(f => f.netoCalculado)) avisos.push('Sin monto en algunas filas: se calculó precio × cantidad.');
  if (b.sinNumeros) avisos.push(b.sinNumeros + (b.sinNumeros === 1 ? ' fila con nombre pero sin números se omitió.' : ' filas con nombre pero sin números se omitieron.'));
  const anio = anioDe(b.titulo) || anioDe(o.hoja) || anioDe(o.archivo);
  const mesBloque = b.titulo || mesDeTexto(o.hoja, o.hoy, anio) || mesDeTexto(o.archivo, o.hoy, anio);
  const porFila = b.filas.some(f => f.mes);
  const grupos = new Map();
  for (const f of b.filas) { const m = (porFila ? f.mes : '') || mesBloque; if (!grupos.has(m)) grupos.set(m, []); grupos.get(m).push(f); }
  if (!grupos.size) return;
  for (const [mes, filas] of grupos) meses.push({ clave: o.archivo + '|' + o.hoja + '|' + b.inicio + '|' + mes, mes, archivo: o.archivo, hoja: o.hoja, fila: b.inicio,
    filas, total: grupos.size === 1 ? b.total : null, avisos: avisos.slice() });
}
const cantidadDe = (f, unidad) => (unidad === 'kg' && finito(f.kg) ? f.kg : unidad === 'un' && finito(f.un) ? f.un
  : finito(f.cantidad) ? f.cantidad : finito(f.kg) ? f.kg : finito(f.un) ? f.un : NaN);
const unidadFila = f => f.unidad || (finito(f.kg) && !finito(f.un) ? 'kg' : finito(f.un) && !finito(f.kg) ? 'un' : null);

/* ---------- Emparejar con el catálogo ---------- */
/* Clave para comparar nombres: sin tildes ni mayúsculas, sin «pan de» y en singular («Marraquetas» = «Pan marraqueta»). */
const singular = x => (x.length <= 3 ? x : /[aeiou]s$/.test(x) ? x.slice(0, -1) : /[^aeiou]es$/.test(x) ? x.slice(0, -2) : x);
export function clave(s) {
  const w = norm(s).split(' ').filter(Boolean).map(singular), sin = w.filter(x => !['pan', 'de', 'del', 'la', 'el', 'con', 'y'].includes(x));
  return (sin.length ? sin : w).join(' ');
}
/* Letras que hay que cambiar para pasar de una palabra a otra («coliza» → «colisa»: 1). */
function distancia(a, b) {
  let ant = Array.from({ length: b.length + 1 }, (x, j) => j);
  for (let i = 1; i <= a.length; i++) { const act = [i]; for (let j = 1; j <= b.length; j++) act[j] = Math.min(ant[j] + 1, act[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); ant = act; }
  return ant[b.length];
}
/* → { id, sugeridos: [productos] } · id solo si hay UN producto con la misma clave (se prefieren los activos). */
export function emparejar(nombre, productos) {
  const k = clave(nombre), l = productos || [], iguales = l.filter(p => clave(p.nombre) === k);
  const act = iguales.filter(p => p.activo !== false), uno = act.length === 1 ? act[0] : !act.length && iguales.length === 1 ? iguales[0] : null;
  const pal = k.split(' '), parecida = (a, b) => a === b || (a.length > 4 && b.length > 4 && distancia(a, b) <= (a.length > 7 ? 2 : 1));
  const sugeridos = l.map(p => [p, clave(p.nombre).split(' ').filter(x => pal.some(y => parecida(x, y))).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return { id: uno ? uno.id : null, sugeridos };
}
export const NUEVO = '+nuevo';
/* Un mes interpretado + catálogo + elecciones (Map clave → productoId | NUEVO | '') → lo que se va a guardar, con sus problemas. */
export function preparar(m, productos, elegidos, iva) {
  const filas = m.filas.map(f => {
    const k = clave(f.nombre), e = elegidos && elegidos.has(k) ? elegidos.get(k) : emparejar(f.nombre, productos).id || '';
    const p = e && e !== NUEVO ? (productos || []).find(x => x.id === e) : null;
    const unidad = p ? p.unidad : unidadFila(f) || 'kg', cant = cantidadDe(f, unidad);
    const aviso = p && unidadFila(f) && unidadFila(f) !== p.unidad ? '«' + f.nombre + '» viene en ' + (unidadFila(f) === 'un' ? 'unidades' : 'kilos') + ' y ' + p.nombre + ' se vende por ' + (p.unidad === 'un' ? 'unidad' : 'kilo') + '.' : '';
    return Object.assign({}, f, { clave: k, elegido: e, productoId: p ? p.id : e === NUEVO ? NUEVO + ':' + k : null, producto: p, unidadFinal: unidad, cantidadFinal: finito(cant) ? kg2(cant) : 0, aviso });
  });
  const lineas = new Map();
  for (const f of filas) {
    if (!f.productoId) continue;
    if (!lineas.has(f.productoId)) lineas.set(f.productoId, { productoId: f.productoId, nombre: f.producto ? f.producto.nombre : cat.limpiar(f.nombre), unidad: f.unidadFinal, cantidad: 0, neto: 0, exacto: 0, filas: 0, nombreExcel: [] });
    const l = lineas.get(f.productoId);
    l.cantidad = kg2(l.cantidad + f.cantidadFinal);
    l.exacto += finito(f.neto) ? f.neto : 0; l.neto += finito(f.neto) ? cat.redondearPesos(f.neto) : 0; l.filas++;
    if (!l.nombreExcel.includes(f.nombre)) l.nombreExcel.push(f.nombre);
    l.precio = l.filas === 1 && finito(f.precio) ? Math.round(f.precio * 100) / 100 : l.cantidad ? Math.round(l.neto / l.cantidad * 100) / 100 : null;
  }
  const ls = [...lineas.values()], orden = new Map((productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9]));
  ls.sort((a, b) => ((orden.get(a.productoId) ?? 1e9) - (orden.get(b.productoId) ?? 1e9)) || a.nombre.localeCompare(b.nombre, 'es'));
  const T = { neto: ls.reduce((t, l) => t + l.neto, 0), exacto: filas.reduce((t, f) => t + (finito(f.neto) ? f.neto : 0), 0),
    kg: kg2(ls.filter(l => l.unidad === 'kg').reduce((t, l) => t + l.cantidad, 0)), un: kg2(ls.filter(l => l.unidad === 'un').reduce((t, l) => t + l.cantidad, 0)) };
  T.iva = V.ivaSobre(T.neto, iva); T.total = T.neto + T.iva;
  const tot = m.total, suma = k => kg2(filas.reduce((t, f) => t + (finito(f[k]) ? f[k] : 0), 0));
  const excel = tot ? { neto: finito(tot.neto) ? tot.neto : null, iva: finito(tot.iva) ? tot.iva : null, total: finito(tot.total) ? tot.total : null,
    cant: ['kg', 'un', 'cantidad'].filter(k => finito(tot[k])).map(k => ({ k, excel: tot[k], filas: suma(k) })) } : null;
  const cuadra = excel && excel.neto != null ? Math.abs(T.exacto - excel.neto) < 1 : null;
  const cuadraCant = excel && excel.cant.length ? excel.cant.every(x => Math.abs(x.excel - x.filas) < 0.011) : null;
  const sinEmparejar = [...new Set(filas.filter(f => !f.productoId).map(f => f.nombre))];
  const repetidos = ls.filter(l => l.filas > 1 && l.nombreExcel.length > 1).map(l => l.nombre + ' (' + l.nombreExcel.join(' + ') + ')');
  return { mes: m.mes, filas, lineas: ls, totales: T, excel, cuadra, cuadraCant, sinEmparejar, repetidos, avisos: filas.map(f => f.aviso).filter(Boolean), listo: cat.esFecha((m.mes || '') + '-01') && !sinEmparejar.length && ls.length > 0 };
}

/* ---------- El documento del cierre ---------- */
const corto = (s, n) => cat.limpiar(s, n);
function base0(o, mes, origen, lineas, T, iva) {
  const d = { mes, origen, cerrado: true, iva, lineas, neto: T.neto, ivaMonto: V.ivaSobre(T.neto, iva), kg: kg2(T.kg), un: Math.round(T.un), por: o.por, quien: corto(o.quien || 'Sin nombre', 60) || 'Sin nombre' };
  d.total = d.neto + d.ivaMonto;
  if (o.cliente) { d.clienteId = o.cliente.id; d.cliente = corto(o.cliente.nombre, 60); }
  for (const k of ['reabiertoPor', 'reabiertoQuien', 'reabiertoEn']) if (o.antes && o.antes[k] != null) d[k] = o.antes[k];
  return d;
}
/* Desde un Excel ya preparado. `ids`: Map de NUEVO:clave → id del producto recién creado. */
export function documento(prep, o) {
  const lineas = prep.lineas.map(l => ({ productoId: (o.ids && o.ids.get(l.productoId)) || l.productoId, nombre: corto(l.nombre, 60), unidad: l.unidad, cantidad: l.cantidad, precio: l.precio == null ? null : l.precio, neto: l.neto,
    nombreExcel: corto(l.nombreExcel.join(' + '), 120) }));
  const d = base0(o, prep.mes, 'excel', lineas, prep.totales, o.iva);
  if (o.archivo) d.archivo = corto(o.archivo, 200);
  if (o.hoja) d.hoja = corto(o.hoja, 100);
  return d;
}
/* «Cerrar mes» desde los pesajes del mes: una línea por pan Y POR CLIENTE (Fase 11; cantidad y neto = suma de sus líneas de venta),
   y el resumen `clientes` (neto, kilos y unidades de cada uno). El IVA sigue siendo IVA % del neto del mes. Con un solo cliente,
   el documento queda como antes (más `clienteId` y `cliente` en cada línea). `k.clientes`: la lista de clientes (si no, solo `cliente`). */
export function desdeApp(mes, pesajes, k, cliente, iva, o) {
  const L = V.lineas(pesajes, k.productos, k.precios, Array.isArray(k.clientes) ? k.clientes : cliente && cliente.id, iva), T = V.totales(L), C = V.porCliente(L, k.clientes);
  const lineas = [];
  for (const g of C) for (const p of V.porPan(g.items, k.productos)) {
    const l = { productoId: p.productoId, nombre: corto(p.nombre, 60), unidad: p.unidad, cantidad: p.cantidad, precio: p.neto && p.cantidad ? Math.round(p.neto / p.cantidad * 100) / 100 : null, neto: p.neto,
      ...(p.sinPrecio ? { sinPrecio: true } : {}) };
    if (g.clienteId) { l.clienteId = g.clienteId; l.cliente = corto(g.cliente || (cliente && cliente.id === g.clienteId ? cliente.nombre : '') || 'Cliente', 60); }
    lineas.push(l);
  }
  const uno = C.length === 1 && C[0].clienteId ? { id: C[0].clienteId, nombre: lineas[0].cliente } : C.length ? null : cliente;
  const d = base0(Object.assign({}, o, { cliente: uno }), mes, 'app', lineas, T, iva);
  d.clientes = C.filter(g => g.clienteId).map(g => ({ clienteId: g.clienteId, cliente: corto(g.cliente || 'Cliente', 60), neto: g.neto, kg: kg2(g.kg), un: Math.round(g.un) }));
  d.canastos = T.canastos; d.dias = V.porDia(L).length;
  if (T.sinPrecio) d.sinPrecio = V.faltanPrecios(L).length;
  return { doc: d, L, T, faltan: V.faltanPrecios(L), clientes: C };
}
/* Las líneas de un cierre sumadas por pan (entre clientes): las que usan Indicadores, Costos y el detalle de Cierres. */
export function panesDeCierre(c) {
  const m = new Map();
  for (const l of (c && c.lineas) || []) {
    if (!m.has(l.productoId)) m.set(l.productoId, { productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, cantidad: 0, neto: 0, sinPrecio: false, nombreExcel: l.nombreExcel });
    const x = m.get(l.productoId);
    x.cantidad = x.unidad === 'un' ? x.cantidad + (l.cantidad || 0) : kg2(x.cantidad + (l.cantidad || 0));
    x.neto += l.neto || 0; if (l.sinPrecio) x.sinPrecio = true;
  }
  return [...m.values()].map(x => Object.assign(x, { precio: x.cantidad ? Math.round(x.neto / x.cantidad * 100) / 100 : null }));
}
/* Un cierre visto solo para un cliente (filtro «Cliente» de Números, Fase 11): sus líneas y sus totales (del resumen `clientes`).
   En los importados desde Excel todo es del cliente del cierre (o del original). Sin `clienteId`, el cierre tal cual. */
export function cierreDeCliente(c, clienteId, originalId) {
  if (!c || !clienteId) return c;
  const de = id => (id || c.clienteId || originalId) === clienteId, lineas = (c.lineas || []).filter(l => de(l.clienteId));
  const g = clientesDeCierre(c).find(x => de(x.clienteId));
  const kg = kg2(lineas.filter(l => l.unidad !== 'un').reduce((t, l) => t + (l.cantidad || 0), 0)), un = lineas.filter(l => l.unidad === 'un').reduce((t, l) => t + (l.cantidad || 0), 0);
  return Object.assign({}, c, { lineas, neto: g ? g.neto || 0 : lineas.reduce((t, l) => t + (l.neto || 0), 0), kg: g ? g.kg || 0 : kg, un: g ? g.un || 0 : un,
    clientes: g ? [g] : [], sinPrecio: lineas.filter(l => l.sinPrecio).length });
}
/* Lo de cada cliente en un cierre: `clientes` si lo trae (Fase 11), o todo del cliente del cierre (los importados desde Excel). */
export function clientesDeCierre(c) {
  if (!c) return [];
  if (Array.isArray(c.clientes) && c.clientes.length) return c.clientes.map(x => Object.assign({}, x));
  return [{ clienteId: c.clienteId || null, cliente: c.cliente || '', neto: c.neto || 0, kg: c.kg || 0, un: c.un || 0 }];
}
/* ---------- Estado de los meses ---------- */
export const cierreDe = (cierres, mes) => (cierres || []).find(x => x.id === mes || x.mes === mes) || null;
/* El cierre (cerrado) del mes de una fecha, o null. */
export const cerradoEl = (cierres, fecha) => { const c = cierreDe(cierres, V.mesDe(fecha)); return c && c.cerrado === true ? c : null; };
/* 'cerrado' | 'reabierto' | 'en-curso' | 'futuro' | 'sin-cerrar' */
export function estadoMes(cierre, mes, hoy) {
  if (cierre && cierre.cerrado === true) return 'cerrado';
  if (cierre) return 'reabierto';
  const ahora = V.mesDe(hoy);
  return mes === ahora ? 'en-curso' : mes > ahora ? 'futuro' : 'sin-cerrar';
}
export const sePuedeCerrar = (mes, hoy) => V.esMes(mes) && mes < V.mesDe(hoy);
export const textoOrigen = c => (c && c.origen === 'excel' ? 'desde Excel' : 'con los datos de la app');

/* Plantilla para quien prefiera pasar sus números a un formato conocido: una fila por pan y mes. */
export function plantilla(productos) {
  const C = (v, s) => ({ v, s }), ps = cat.ordenarProductos(cat.activos(productos));
  const filas = [['Mes', 'Pan', 'Unidad', 'Cantidad', 'Precio neto', 'Neto'].map(t => C(t, 'cab'))]
    .concat((ps.length ? ps : [{ nombre: 'Marraqueta', unidad: 'kg' }]).map(p => ['2026-01', p.nombre, p.unidad, null, null, null]));
  return [{ nombre: 'Cierres', congelar: 1, columnas: [10, 28, 9, 11, 12, 13], filas },
    { nombre: 'Cómo llenarla', columnas: [90], filas: [[C('Cierres mensuales · plantilla', 'titulo')], [], ['Una fila por pan y por mes. Mes: AAAA-MM (por ejemplo 2026-03). Se pueden poner varios meses en la misma hoja.'],
      ['Unidad: kg o un. Cantidad: kilos o unidades del mes. Precio neto: sin IVA. Neto: el monto del mes sin IVA (si se deja vacío, se calcula precio × cantidad).'],
      ['El IVA se calcula en la app: IVA % × neto del mes. Los nombres de los panes se emparejan con el catálogo al importar.']] }];
}
