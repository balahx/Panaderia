/* Importar cierres mensuales desde Excel (Fase 6): subir → revisar → confirmar. Lo abre la pantalla Cierres (pantallas/cierres.js).
   Los archivos se leen en el equipo (core/xlsx-leer.js) y se interpretan con core/cierres.js: cada tabla es un mes. En la revisión
   se elige o corrige el mes, se empareja cada nombre del Excel con un pan del catálogo (o se crea, desactivado) y se ve si la suma
   cuadra con el total del propio Excel. Al confirmar se guarda un cierre por mes, uno tras otro (cierres/{AAAA-MM}, origen 'excel').
   Las elecciones de nombres se recuerdan en este equipo (localStorage `pan.importarNombres`) para los archivos siguientes. */
import { esc } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { ask, toast, repintar } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as P from '../core/pesaje.js';
import * as CI from '../core/cierres.js';
import * as XL from '../core/xlsx-leer.js';
import { MIME } from '../core/xlsx.js';

const LS = 'pan.importarNombres';
const nuevo = () => ({ on: false, leyendo: false, meses: [], avisos: [], archivos: [], mesDe: new Map(), quitar: new Set(), conApp: new Set(), revisados: new Set(), importando: false, msg: '' });
let I = nuevo(), hechos = null, elegidos = null;
export const activo = () => I.on;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const num = n => typeof n === 'number' && Number.isFinite(n);
const motivo = e => { const m = String(e && (e.code || e.message) || e); return /unavailable|offline|network/i.test(m) ? 'sin conexión con el servidor' : /permission/.test(m) ? 'el servidor no lo permitió' : m; };

/* Elecciones de nombres: Map clave → productoId | CI.NUEVO. Las de productos que ya no existen no cuentan. */
function memoria(productos) {
  if (!elegidos) { elegidos = new Map(); try { Object.entries(JSON.parse(localStorage.getItem(LS) || '{}')).forEach(([k, v]) => elegidos.set(k, v)); } catch (e) { /* */ } }
  const ids = new Set((productos || []).map(p => p.id));
  return new Map([...elegidos].filter(([k, v]) => v === CI.NUEVO || ids.has(v)));
}
function recordar(k, v) {
  if (!elegidos) elegidos = new Map();
  if (v) elegidos.set(k, v); else elegidos.delete(k);
  try { localStorage.setItem(LS, JSON.stringify(Object.fromEntries([...elegidos].filter(([, x]) => x !== CI.NUEVO)))); } catch (e) { /* sin almacenamiento: solo en esta visita */ }
}

/* ---------- Leer archivos ---------- */
async function leer(archivos, c) {
  const lista = [...(archivos || [])];
  if (!lista.length) return;
  I.on = true; I.leyendo = true; hechos = null; repintar();
  for (const f of lista) {
    if (/\.xls$/i.test(f.name)) { I.avisos.push('«' + f.name + '» es del formato antiguo (.xls): ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)».'); continue; }
    try {
      const r = CI.interpretar(await XL.leer(new Uint8Array(await f.arrayBuffer())), f.name, c.hoy);
      r.meses.forEach(m => { m.clave += '|' + I.meses.length; I.meses.push(m); });
      I.avisos.push(...r.avisos); I.archivos.push(f.name);
      if (!r.meses.length && !r.avisos.length) I.avisos.push('«' + f.name + '»: no se encontró ninguna tabla con panes y cantidades.');
    } catch (e) { I.avisos.push('«' + f.name + '»: ' + (e && e.code === 'xlsx' ? e.message : 'no se pudo leer (' + motivo(e) + ').')); }
  }
  I.leyendo = false; repintar();
  revisarApp(c);
}
/* ¿Algún mes a importar ya tiene canastos en la app? Una lectura por mes (solo con internet); se avisa en ese mes. */
async function revisarApp(c) {
  if (navigator.onLine === false) return;
  const meses = [...new Set(I.meses.map(m => mesDe(m)).filter(V.esMes))].filter(m => !I.revisados.has(m));
  for (const m of meses) {
    I.revisados.add(m);
    try { const r = V.rangoMes(m); if (await nube.hayEnRango('pesajes', 'fecha', r.desde, r.hasta)) { I.conApp.add(m); repintar(); } } catch (e) { /* sin aviso: no es indispensable */ }
  }
}

/* ---------- Revisión ---------- */
const mesDe = m => (I.mesDe.has(m.clave) ? I.mesDe.get(m.clave) : m.mes);
function revisar(c) {
  const k = c.cat || {}, iva = cat.ivaDe(c.negocio), elig = memoria(k.productos);
  const R = I.meses.map((m, i) => {
    const mes = mesDe(m), P0 = CI.preparar(Object.assign({}, m, { mes }), k.productos, elig, iva), ya = CI.cierreDe(c.cierres, mes), problemas = [];
    if (!V.esMes(mes)) problemas.push('Elige de qué mes es esta tabla.');
    else if (!CI.sePuedeCerrar(mes, c.hoy)) problemas.push(cap(V.mesTexto(mes)) + ' todavía no termina: ese mes se cierra en Entregas cuando termine.');
    else if (ya && ya.cerrado) problemas.push(cap(V.mesTexto(mes)) + ' ya está cerrado (' + CI.textoOrigen(ya) + '). Para reemplazarlo, un dueño debe reabrirlo en Cierres.');
    if (P0.sinEmparejar.length) problemas.push('Falta elegir el pan del catálogo para: ' + P0.sinEmparejar.join(', ') + '.');
    else if (!P0.lineas.length) problemas.push('La tabla no tiene panes con cantidad o monto.');
    return { m, i, mes, P: P0, ya, problemas, incluido: !I.quitar.has(m.clave) };
  });
  const usados = new Map();
  R.filter(r => r.incluido && V.esMes(r.mes)).forEach(r => usados.set(r.mes, (usados.get(r.mes) || 0) + 1));
  R.forEach(r => { if (r.incluido && usados.get(r.mes) > 1) r.problemas.push('Hay otra tabla para el mismo mes: deja solo una (o corrige el mes).'); });
  return R;
}
function opciones(f, productos) {
  const o = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
  const val = f.elegido || '', todos = cat.ordenarProductos(productos || []), act = todos.filter(p => p.activo !== false), des = todos.filter(p => p.activo === false);
  const par = !f.productoId ? CI.emparejar(f.nombre, productos).sugeridos.slice(0, 4) : [];
  return o('', '— Elegir pan del catálogo —', !val) +
    (par.length ? '<optgroup label="Parecidos">' + par.map(p => o(p.id, p.nombre + (p.activo === false ? ' (desactivado)' : ''), false)).join('') + '</optgroup>' : '') +
    '<optgroup label="Catálogo">' + act.map(p => o(p.id, p.nombre, val === p.id && !par.includes(p))).join('') + '</optgroup>' +
    (des.length ? '<optgroup label="Desactivados">' + des.map(p => o(p.id, p.nombre + ' (desactivado)', val === p.id && !par.includes(p))).join('') + '</optgroup>' : '') +
    o(CI.NUEVO, '＋ Crear «' + nombreNuevo(f.nombre) + '» en el catálogo', val === CI.NUEVO);
}
const detalle = f => [num(f.cantidadFinal) ? P.textoCantidad(f.cantidadFinal, f.unidadFinal) : '', num(f.precio) ? cat.pesos(f.precio) : '', num(f.neto) ? cat.pesos(cat.redondearPesos(f.neto)) + ' neto' + (f.netoCalculado ? ' (calculado)' : '') : 'sin monto'].filter(Boolean).join(' · ');
function tarjeta(r, c) {
  const { m, i, P: X } = r, k = c.cat || {}, T = X.totales, pct = cat.enCampo(cat.ivaDe(c.negocio));
  const filas = X.filas.map((f, j) => '<div class="imp-fila"><div class="mt"><b>' + esc(f.nombre) + '</b><small>' + esc(detalle(f)) + ' · fila ' + f.fila + '</small></div>' +
    '<label class="vh" for="impPan' + i + '_' + j + '">Pan del catálogo para «' + esc(f.nombre) + '»</label><select class="txt" id="impPan' + i + '_' + j + '" data-imp="pan" data-clave="' + esc(f.clave) + '">' + opciones(f, k.productos) + '</select>' +
    (f.aviso ? '<small class="warn-t">' + esc(f.aviso) + '</small>' : '') + '</div>').join('');
  const ex = X.excel, comp = ex && ex.neto != null ? '<p class="' + (X.cuadra ? 'ok-t' : 'warn-t') + '" id="impCuadra' + i + '">' + (X.cuadra ? '✓ La suma de las filas (' + cat.pesos(cat.redondearPesos(T.exacto)) + ') es igual al total del Excel.'
    : '✗ La suma de las filas (' + cat.pesos(cat.redondearPesos(T.exacto)) + ') no es igual al total del Excel (' + cat.pesos(cat.redondearPesos(ex.neto)) + '). Revisa si falta o sobra una fila.') + '</p>' : '<p class="muted chico">El Excel no trae una fila de total para comparar.</p>';
  const compCant = ex && X.cuadraCant === false ? '<p class="warn-t">La suma de las cantidades no es igual a la del total del Excel.</p>' : '';
  const ivaEx = ex && ex.iva != null && Math.abs(cat.redondearPesos(ex.iva) - T.iva) >= 1 ? '<p class="muted chico">El Excel trae un IVA de ' + esc(cat.pesos(cat.redondearPesos(ex.iva))) + '; en la app el IVA del cierre es el ' + esc(pct) + ' % del neto del mes.</p>' : '';
  const avisos = m.avisos.concat(X.repetidos.length ? ['Se juntaron filas en un mismo pan: ' + X.repetidos.join('; ') + '.'] : [], I.conApp.has(r.mes) ? ['Este mes ya tiene canastos anotados en la app: al importarlo, manda el cierre del Excel (y ya no se anota ni se corrige en ese mes).'] : []);
  return '<section class="card sec imp-mes' + (r.incluido ? '' : ' quitado') + '" data-i="' + i + '"><div class="imp-cab"><div><span class="eyebrow">' + esc(m.archivo + ' · ' + m.hoja) + '</span><h2>' + esc(V.esMes(r.mes) ? cap(V.mesTexto(r.mes)) : 'Mes sin elegir') + '</h2></div>' +
    '<button class="btn ghost sm" data-act="imp-quitar" data-i="' + i + '" aria-pressed="' + !r.incluido + '">' + (r.incluido ? 'No importar' : 'Importar este mes') + '</button></div>' +
    (!r.incluido ? '<p class="muted chico">Este mes no se va a importar.</p></section>' :
      '<label class="lab" for="impMes' + i + '">Mes de esta tabla</label><input class="txt" type="month" id="impMes' + i + '" data-imp="mes" data-i="' + i + '" max="' + V.sumarMeses(V.mesDe(c.hoy), -1) + '" value="' + esc(r.mes) + '">' +
      r.problemas.map(p => '<p class="warn-t">' + esc(p) + '</p>').join('') +
      '<div class="imp-filas">' + filas + '</div>' + comp + compCant +
      kv(X.sinEmparejar.length ? 'Neto (sin los panes por elegir)' : 'Neto del mes', cat.pesos(T.neto)) + kv('IVA (' + pct + ' % del neto)', cat.pesos(T.iva)) + kv('Total', cat.pesos(T.total), 'impTotal' + i) + kv('Cantidad', P.textoTotales({ kg: T.kg, un: T.un })) + ivaEx +
      (avisos.length ? '<ul class="imp-avisos">' + avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') + '</section>');
}
export function html(c) {
  const cab = '<button class="lnk volver" data-act="imp-cancelar">‹ Cierres</button><span class="eyebrow">Importar desde Excel</span><h1>Revisar la importación</h1>';
  if (I.leyendo) return cab + '<p class="muted" role="status">Leyendo los archivos…</p><div class="spin" role="status" aria-label="Leyendo"></div>';
  if (!c.cat || !c.cat.productos || !c.cierres) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const R = revisar(c), listos = R.filter(r => r.incluido && !r.problemas.length), neto = listos.reduce((t, r) => t + r.P.totales.neto, 0);
  return cab + '<p class="muted">' + I.archivos.length + (I.archivos.length === 1 ? ' archivo' : ' archivos') + ' · ' + R.length + (R.length === 1 ? ' tabla' : ' tablas') +
    '. Revisa cada mes, elige el pan del catálogo para cada nombre del Excel y toca «Importar». Cada mes queda cerrado.</p>' +
    (I.avisos.length ? '<div class="note warn" id="impAvisos"><ul class="imp-avisos">' + I.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>' : '') +
    R.map(r => tarjeta(r, c)).join('') +
    '<section class="card sec" id="impResumen"><p class="eyebrow">Listo para importar</p>' + kv('Meses', String(listos.length) + ' de ' + R.length) + kv('Neto de esos meses', cat.pesos(neto)) +
    (I.msg ? '<p class="muted" role="status">' + esc(I.msg) + '</p>' : '') +
    '<div class="actions"><button class="btn" id="impConfirmar" data-act="imp-importar"' + (!listos.length || I.importando ? ' disabled' : '') + '>' + svg('check') + (I.importando ? 'Importando…' : 'Importar ' + listos.length + (listos.length === 1 ? ' mes' : ' meses')) + '</button>' +
    '<button class="btn ghost" data-act="imp-cancelar"' + (I.importando ? ' disabled' : '') + '>Cancelar</button></div>' +
    '<label class="lab" for="impMas">Agregar otros archivos</label><input class="txt archivo" type="file" id="impMas" multiple accept=".xlsx,' + MIME + '"></section>';
}
/* Resultado de la última importación, para la pantalla Cierres. */
export function resultado() {
  if (!hechos) return '';
  return '<p class="note' + (hechos.fallos.length ? ' warn' : '') + '" id="cieResultado">' + (hechos.ok.length ? esc('Importado: ' + hechos.ok.map(m => V.mesTexto(m)).join(', ') + '.') : '') +
    (hechos.fallos.length ? ' ' + esc('No se pudo: ' + hechos.fallos.join('; ') + '.') : '') + '</p>';
}

/* ---------- Importar ---------- */
const nombreNuevo = s => { const t = cat.limpiar(s, 60); return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t.charAt(0).toUpperCase() + t.slice(1); };
async function importar(c) {
  if (I.importando) return;
  if (navigator.onLine === false) { toast('Para importar hace falta internet.'); return; }
  const k = c.cat || {}, iva = cat.ivaDe(c.negocio), cliente = cat.clienteOriginal(k.clientes), listos = revisar(c).filter(r => r.incluido && !r.problemas.length);
  if (!listos.length) return;
  const conApp = listos.filter(r => I.conApp.has(r.mes)).map(r => V.mesTexto(r.mes));
  const si = await ask({ title: '¿Importar ' + listos.length + (listos.length === 1 ? ' mes' : ' meses') + '?', ok: 'Importar',
    text: listos.map(r => cap(V.mesTexto(r.mes))).join(', ') + '. Neto: ' + cat.pesos(listos.reduce((t, r) => t + r.P.totales.neto, 0)) + '. Cada mes queda cerrado: no se modifica (un dueño puede reabrirlo).' +
      (conApp.length ? ' Ojo: ' + conApp.join(', ') + ' ya ' + (conApp.length === 1 ? 'tiene' : 'tienen') + ' canastos en la app; manda el Excel.' : '') });
  if (!si) return;
  I.importando = true; I.msg = 'Preparando…'; repintar();
  const ok = [], fallos = [], ids = new Map(), otros = (k.productos || []).slice();
  try {
    for (const l of [...new Map(listos.flatMap(r => r.P.lineas).filter(l => l.productoId.startsWith(CI.NUEVO)).map(l => [l.productoId, l])).values()]) {
      const v = cat.validarProducto({ nombre: nombreNuevo(l.nombre), unidad: l.unidad, activo: false }, otros);
      const igual = v.error && otros.find(p => CI.clave(p.nombre) === CI.clave(l.nombre));
      if (igual) { ids.set(l.productoId, igual.id); continue; }
      if (v.error) throw new Error(l.nombre + ': ' + v.error);
      const id = cat.nuevoId(); I.msg = 'Creando «' + v.datos.nombre + '» en el catálogo…'; repintar();
      await nube.guardar('productos/' + id, v.datos); ids.set(l.productoId, id); otros.push(Object.assign({ id }, v.datos));
      recordar(l.productoId.slice(CI.NUEVO.length + 1), id);
    }
  } catch (e) { I.importando = false; I.msg = ''; toast('No se pudo crear un pan en el catálogo: ' + motivo(e) + '. No se importó nada.'); repintar(); return; }
  for (const r of listos) {
    I.msg = 'Guardando ' + V.mesTexto(r.mes) + ' (' + (ok.length + fallos.length + 1) + ' de ' + listos.length + ')…'; repintar();
    try {
      await nube.guardar('cierres/' + r.mes, CI.documento(r.P, { iva, cliente, por: c.user.uid, quien: c.user.nombre, archivo: r.m.archivo + '.xlsx', hoja: r.m.hoja, ids, antes: r.ya }));
      ok.push(r.mes); I.quitar.add(r.m.clave);
    } catch (e) { fallos.push(V.mesTexto(r.mes) + ' (' + motivo(e) + ')'); }
  }
  hechos = { ok, fallos };
  if (!fallos.length) I = nuevo();
  else { I.importando = false; I.msg = ''; }
  toast(fallos.length ? 'Se importaron ' + ok.length + ' de ' + listos.length + ' meses.' : (ok.length === 1 ? 'Mes importado y cerrado' : ok.length + ' meses importados y cerrados'), 6000);
  repintar();
}

export function alActuar(act, el, c) {
  if (!act.startsWith('imp-')) return false;
  if (act === 'imp-cancelar') { if (!I.importando) I = nuevo(); return 'repintar'; }
  if (act === 'imp-importar') { importar(c); return true; }
  if (act === 'imp-quitar') { const m = I.meses[Number(el.dataset.i)]; if (m) { if (I.quitar.has(m.clave)) I.quitar.delete(m.clave); else I.quitar.add(m.clave); } return 'repintar'; }
  return true;
}
export function alEscribir(el, c) {
  if (el.type === 'file' && (el.id === 'cieArchivo' || el.id === 'impMas')) { const f = [...(el.files || [])]; el.value = ''; leer(f, c); return; }
  if (el.dataset.imp === 'pan') { recordar(el.dataset.clave, el.value); return 'repintar'; }
  if (el.dataset.imp === 'mes') { const m = I.meses[Number(el.dataset.i)]; if (m && (V.esMes(el.value) || !el.value)) { I.mesDe.set(m.clave, el.value); revisarApp(c); return 'repintar'; } }
}
