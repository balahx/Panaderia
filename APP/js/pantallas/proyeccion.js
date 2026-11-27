/* «Año y metas» dentro de Indicadores (Fase 7, PLAN §3.9): el año mes a mes contra el anterior (gráfico y lista), la proyección
   (mismo mes del año anterior × crecimiento general o por pan × precio) y las metas mensuales con su seguimiento.
   proyeccion/{AAAA} la escriben dueños y externo (firestore.rules). La proyección cambia sola si cambian los factores o la base;
   las METAS quedan fijas hasta que se vuelvan a fijar («Usar la proyección como metas») o se escriban a mano en cada mes. */
import { esc } from '../core/formato.js';
import { errorHTML } from '../core/iconos.js';
import { ask, hoja, cerrarHoja, toast, $ } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as V from '../core/ventas.js';
import * as I from '../core/indicadores.js';
import * as D from './meses-datos.js';
import { seg, cap, barra, irAlMes } from './indicadores.js';
import { navPeriodo } from './periodo-nav.js';

let anioV = 0, guardando = false;   // año que se mira (0 = el de hoy)
const anioSel = c => anioV || Number(c.hoy.slice(0, 4));
const MAX_ANIO = c => Number(c.hoy.slice(0, 4)) + 1;
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const INI = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const corto = mes => cap(V.mesTexto(mes).replace(/ \d{4}$/, ''));
const proyDe = (c, a) => I.leerProyeccion((c.proy || []).find(x => x.id === String(a)), a);
const motivo = e => { const m = String(e && (e.code || e.message) || e); return /unavailable|offline|network/i.test(m) ? 'sin conexión con el servidor' : /permission/.test(m) ? 'el servidor no lo permitió' : m; };

/* Los dos años como Map mes → resumen (core/indicadores.js). */
function meses(c, a) {
  const base = new Map(), real = new Map();
  for (let i = 1; i <= 12; i++) { const m = a + '-' + String(i).padStart(2, '0'), b = V.sumarMeses(m, -12); base.set(b, D.resumen(c, b)); real.set(m, D.resumen(c, m)); }
  return { base, real };
}
const tabla = (c, a, Pr) => { const M = meses(c, a); return Object.assign(I.tablaAnio(a, M.base, M.real, Pr || proyDe(c, a), c.hoy), { M }); };

/* Gráfico: el año anterior y este, mes a mes (barras), con lo pedido (raya). La lista de abajo trae los mismos números. */
function grafico(t, a) {
  const W = 360, H = 172, base = 140, x0 = 6, g = (W - 12) / 12, bw = Math.min(11, g / 2 - 2);
  const vals = t.filas.flatMap(f => [f.anterior ? f.anterior.neto : 0, f.real ? f.real.neto : 0, f.obj ? f.obj.neto : 0]), max = Math.max(1, ...vals);
  const h = v => Math.max(v > 0 ? 1.5 : 0, v / max * 122), money = v => cat.pesos(v);
  const barras = t.filas.map((f, i) => {
    const cx = x0 + g * i + g / 2, ant = f.anterior ? f.anterior.neto : 0, re = f.real ? f.real.neto : 0;
    return (ant ? '<rect class="g-ant" x="' + (cx - bw - 1).toFixed(1) + '" y="' + (base - h(ant)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h(ant).toFixed(1) + '" rx="2"><title>' + esc(corto(f.mes) + ' ' + (a - 1) + ': ' + money(ant)) + '</title></rect>' : '') +
      (re ? '<rect class="g-real' + (f.estado === 'en-curso' ? ' curso' : '') + '" x="' + (cx + 1).toFixed(1) + '" y="' + (base - h(re)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h(re).toFixed(1) + '" rx="2"><title>' + esc(corto(f.mes) + ' ' + a + ': ' + money(re) + (f.estado === 'en-curso' ? ' (hasta hoy)' : '')) + '</title></rect>' : '') +
      (f.obj ? '<line class="g-meta" x1="' + (cx - bw - 2).toFixed(1) + '" x2="' + (cx + bw + 2).toFixed(1) + '" y1="' + (base - h(f.obj.neto)).toFixed(1) + '" y2="' + (base - h(f.obj.neto)).toFixed(1) + '"><title>' + esc((f.obj.tipo === 'meta' ? 'Meta ' : 'Proyectado ') + corto(f.mes) + ': ' + money(f.obj.neto)) + '</title></line>' : '') +
      '<text class="g-mes" x="' + cx.toFixed(1) + '" y="158" text-anchor="middle">' + INI[i] + '</text>';
  }).join('');
  return '<figure class="grafico" id="anioGrafico"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Venta neta mes a mes: ' + (a - 1) + ' contra ' + a + ', con la meta o proyección de cada mes. Los números están en la lista de abajo.">' +
    '<line class="g-base" x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '"/>' + barras + '</svg>' +
    '<figcaption class="leyenda"><span><i class="sw ant" aria-hidden="true"></i>' + (a - 1) + '</span><span><i class="sw real" aria-hidden="true"></i>' + a + '</span><span><i class="sw meta" aria-hidden="true"></i>Meta o proyección</span></figcaption></figure>';
}
function fila(f, a) {
  const ob = f.obj ? (f.obj.tipo === 'meta' ? 'Meta ' : 'Proy. ') + cat.pesos(f.obj.neto) : 'Sin meta';
  const der = f.real ? '<b>' + esc(cat.pesos(f.real.neto)) + '</b><small>' + (f.pct != null ? esc(I.pctTexto(f.pct, false)) + (f.estado === 'en-curso' ? ' hasta hoy' : ' de lo pedido') : f.estado === 'en-curso' ? 'hasta hoy' : '') + '</small>'
    : '<b>—</b><small>' + (f.estado === 'futuro' ? 'por venir' : f.cargando ? 'cargando…' : 'sin datos') + '</small>';
  return '<button class="mrow anio-fila" data-act="anio-mes" data-mes="' + f.mes + '"><span class="mt"><b>' + esc(corto(f.mes)) + (f.estado === 'en-curso' ? ' <span class="badge warn">En curso</span>' : '') + '</b>' +
    '<small>' + (a - 1) + ': ' + (f.anterior ? esc(cat.pesos(f.anterior.neto)) : '—') + (f.varAnt != null ? ' · ' + esc(I.pctTexto(f.varAnt)) + ' vs ' + (a - 1) : '') + '</small><small>' + esc(ob) + '</small>' +
    (f.real && f.obj ? barra(f.pct / 100, f.pct >= 100 ? 'ok' : '') : '') + '</span><span class="precio">' + der + '</span></button>';
}
function tarjetaProy(t, Pr, a) {
  const sinBase = t.filas.filter(f => !f.proy && !f.cargando).map(f => corto(f.mes)), propios = Object.keys(Pr.panes).length;
  return '<section class="card sec" id="anioProy"><p class="eyebrow">Proyección de ' + a + ' desde ' + (a - 1) + '</p>' +
    kv('Crecimiento (cantidad)', I.pctTexto((Pr.factor - 1) * 100) + (propios ? ' · ' + propios + (propios === 1 ? ' pan con el suyo' : ' panes con el suyo') : ''), 'anioFactor') +
    kv('Precio', I.pctTexto((Pr.factorPrecio - 1) * 100), 'anioPrecio') + kv('Proyectado ' + a, cat.pesos(t.T.proy), 'anioProyTotal') + kv('Metas fijadas', t.T.metasFijadas + ' de 12', 'anioMetasN') +
    (sinBase.length === 12 ? '<p class="warn-t" id="anioSinBase">' + (a - 1) + ' no tiene datos: no hay de dónde proyectar. Si tienes los cierres en Excel, impórtalos en Más → Cierres mensuales; o escribe las metas a mano tocando cada mes.</p>'
      : sinBase.length ? '<p class="muted chico" id="anioSinBase">Sin base en ' + (a - 1) + ': ' + esc(sinBase.join(', ')) + '. Esos meses no se proyectan; su meta se escribe a mano.</p>' : '') +
    '<div class="actions"><button class="btn ghost" data-act="anio-ajustar">Ajustar proyección</button><button class="btn" id="anioFijar" data-act="anio-fijar"' + (guardando || !t.T.proy ? ' disabled' : '') + (!t.T.proy && sinBase.length ? ' aria-describedby="anioSinBase"' : '') + '>Usar la proyección como metas</button></div>' +
    '<p class="muted chico">Neto proyectado = neto del mismo mes de ' + (a - 1) + ' × crecimiento × precio. Las metas quedan fijas aunque después cambies los factores.</p></section>';
}

export function html(c) {
  const a = anioSel(c), cur = V.rangoMes(V.mesDe(c.hoy)).desde, per = c.per;
  const cab = '<span class="eyebrow">Indicadores</span><h1>Año ' + a + '</h1>' + seg('anio') +
    navPeriodo({ act: 'anio-cambiar', aria: 'Cambiar de año', ultimo: a >= MAX_ANIO(c), antes: '‹ ' + (a - 1), despues: (a + 1) + ' ›' });
  const err = c.errCat || (per && per.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!D.listos(c) || !c.proy || !per || per.desde !== cur || !per.pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const Pr = proyDe(c, a), t = tabla(c, a, Pr), T = t.T, ac = T.ac;
  return cab +
    '<div class="stats anchas" id="anioResumen"><div class="stat"><b id="anioReal">' + esc(cat.pesos(T.real)) + '</b><span>' + a + (a === Number(c.hoy.slice(0, 4)) ? ' hasta hoy' : '') + '</span></div>' +
    '<div class="stat"><b>' + esc(cat.pesos(T.anterior)) + '</b><span>' + (a - 1) + '</span></div>' +
    (ac.varAnt != null ? '<div class="stat"><b id="anioVar">' + esc(I.pctTexto(ac.varAnt)) + '</b><span>vs ' + (a - 1) + ' (' + ac.meses + (ac.meses === 1 ? ' mes terminado' : ' meses terminados') + ')</span></div>' : '') +
    (ac.pctObj != null ? '<div class="stat"><b id="anioCumple">' + esc(I.pctTexto(ac.pctObj, false)) + '</b><span>de lo pedido (' + ac.mesesObj + (ac.mesesObj === 1 ? ' mes terminado' : ' meses terminados') + ')</span></div>' : '') + '</div>' +
    grafico(t, a) +
    '<section class="sec" id="anioMeses"><h2>Mes a mes</h2><p class="muted chico">Toca un mes para ver su detalle, escribir su meta o abrir sus indicadores.</p><div class="mlist">' + t.filas.map(f => fila(f, a)).join('') + '</div></section>' +
    tarjetaProy(t, Pr, a);
}

/* ---------- Hojas ---------- */
function verMes(c, mes) {
  const a = Number(mes.slice(0, 4)), Pr = proyDe(c, a), t = tabla(c, a, Pr), f = t.filas.find(x => x.mes === mes), i = Number(mes.slice(5)) - 1;
  hoja(cap(V.mesTexto(mes)), '<div id="anioDetalle">' + kv(String(a - 1), f.anterior ? cat.pesos(f.anterior.neto) : 'Sin datos') +
    kv(String(a) + (f.estado === 'en-curso' ? ' (hasta hoy)' : ''), f.real ? cat.pesos(f.real.neto) : f.estado === 'futuro' ? 'Por venir' : 'Sin datos') +
    kv('Proyectado', f.proy ? cat.pesos(f.proy.neto) : 'Sin base') + kv('Meta fijada', Number.isInteger(Pr.metas[i]) ? cat.pesos(Pr.metas[i]) : 'No (se usa la proyección)') + '</div>' +
    '<label class="lab" for="pyMeta">Meta de ' + esc(V.mesTexto(mes)) + ' (neto, en pesos)</label><input class="txt" id="pyMeta" inputmode="numeric" autocomplete="off" data-enter="anio-meta-guardar" value="' + (Number.isInteger(Pr.metas[i]) ? esc(cat.pesos(Pr.metas[i]).replace('$', '')) : '') + '" placeholder="' + (f.proy ? esc(cat.pesos(f.proy.neto).replace('$', '')) : 'Por ejemplo 2.500.000') + '">' +
    '<p class="muted chico">Déjala vacía para usar la proyección.</p><p class="form-error" id="pyMetaError" role="alert" hidden></p>' +
    '<div class="actions"><button class="btn" data-act="anio-meta-guardar" data-mes="' + mes + '">Guardar meta</button>' + (f.estado !== 'futuro' ? '<button class="btn ghost" data-act="anio-ver-mes" data-mes="' + mes + '">Ver indicadores del mes</button>' : '') + '</div>');
}
/* Panes de la base (el año anterior) y los activos del catálogo, para dar a cada uno su propio crecimiento. */
function panesDe(c, t) {
  const m = new Map();
  for (const R of t.M.base.values()) for (const p of R.panes || []) if (!m.has(p.productoId)) m.set(p.productoId, p.nombre);
  for (const p of cat.ordenarProductos(cat.activos(c.cat.productos))) if (!m.has(p.id)) m.set(p.id, p.nombre);
  return [...m.entries()];
}
function ajustar(c) {
  const a = anioSel(c), Pr = proyDe(c, a), t = tabla(c, a, Pr), l = panesDe(c, t);
  hoja('Proyección de ' + a, '<p class="muted">Cada mes de ' + a + ' = el mismo mes de ' + (a - 1) + ' × crecimiento × precio. Escribe porcentajes: 5 = sube 5 %, −3 = baja 3 %, 0 = igual.</p>' +
    '<div class="dos"><div><label class="lab" for="pyFactor">Crecimiento general (%)</label><input class="txt" id="pyFactor" inputmode="decimal" autocomplete="off" value="' + esc(I.pctCampo(Pr.factor)) + '"></div>' +
    '<div><label class="lab" for="pyPrecio">Precio (%)</label><input class="txt" id="pyPrecio" inputmode="decimal" autocomplete="off" value="' + esc(I.pctCampo(Pr.factorPrecio)) + '"></div></div>' +
    '<p class="eyebrow">Crecimiento por pan (vacío = el general)</p><div class="py-panes">' +
    l.map(([id, n], k) => '<div class="py-pan"><label class="lab" for="pyPan' + k + '">' + esc(n) + '</label><input class="txt" id="pyPan' + k + '" data-pid="' + esc(id) + '" inputmode="decimal" autocomplete="off" value="' + (id in Pr.panes ? esc(I.pctCampo(Pr.panes[id])) : '') + '"></div>').join('') + '</div>' +
    '<div class="precio-hoy" id="pyVista" aria-live="polite">' + vista(t.T.proy, t.T.anterior, a) + '</div><p class="form-error" id="pyError" role="alert" hidden></p>' +
    '<div class="actions"><button class="btn" data-act="anio-guardar">Guardar proyección</button></div>');
}
const vista = (proy, base, a) => '<b>' + esc(cat.pesos(proy)) + '</b><span>proyectado ' + a + '</span><small>Base ' + (a - 1) + ': ' + esc(cat.pesos(base)) + (base ? ' · ' + esc(I.pctTexto(I.variacion(proy, base))) : '') + '</small>';
/* Lee la hoja de ajustes: { P } o { error }. */
function leerHoja(c) {
  const a = anioSel(c), Pr = proyDe(c, a), f = I.validarPct($('#pyFactor').value), p = I.validarPct($('#pyPrecio').value);
  if (f.error) return { error: 'Crecimiento general: ' + f.error };
  if (p.error) return { error: 'Precio: ' + p.error };
  const panes = {};
  for (const el of document.querySelectorAll('#dlg [data-pid]')) {
    const x = I.validarPct(el.value, true);
    if (x.error) return { error: el.labels && el.labels[0] ? el.labels[0].textContent + ': ' + x.error : x.error };
    if (x.factor != null) panes[el.dataset.pid] = x.factor;
  }
  return { P: Object.assign({}, Pr, { factor: f.factor, factorPrecio: p.factor, panes }) };
}
async function guardar(c, P, texto) {
  if (guardando) return false;
  if (navigator.onLine === false) { toast('Para guardar hace falta internet.'); return false; }
  guardando = true;
  try { await nube.guardar('proyeccion/' + P.anio, I.documentoProyeccion(P, { por: c.user.uid, quien: c.user.nombre })); toast(texto); return true; }
  catch (e) { toast('No se pudo guardar: ' + motivo(e) + '.'); return false; }
  finally { guardando = false; }
}

export function alActuar(act, el, c) {
  if (act === 'anio-cambiar') { anioV = Math.min(MAX_ANIO(c), anioSel(c) + Number(el.dataset.d)); return 'repintar'; }
  if (act === 'anio-mes') { verMes(c, el.dataset.mes); return true; }
  if (act === 'anio-ver-mes') { cerrarHoja(); irAlMes(el.dataset.mes, c); return 'repintar'; }
  if (act === 'anio-ajustar') { ajustar(c); return true; }
  if (act === 'anio-guardar') {
    const r = leerHoja(c), e = $('#pyError');
    if (r.error) { e.textContent = r.error; e.hidden = false; return true; }
    guardar(c, r.P, 'Proyección guardada. Las metas fijadas no cambian hasta que las vuelvas a fijar.').then(ok => { if (ok) cerrarHoja(); });
    return true;
  }
  if (act === 'anio-meta-guardar') {
    const mes = el.dataset.mes || ($('#dlg [data-act="anio-meta-guardar"][data-mes]') || {}).dataset.mes, r = I.validarMeta($('#pyMeta').value), e = $('#pyMetaError');
    if (!mes) return true;
    if (r.error) { e.textContent = r.error; e.hidden = false; return true; }
    const a = Number(mes.slice(0, 4)), Pr = proyDe(c, a), metas = Pr.metas.slice(); metas[Number(mes.slice(5)) - 1] = r.neto;
    guardar(c, Object.assign({}, Pr, { metas }), r.neto == null ? 'Meta quitada: el mes se compara con la proyección.' : 'Meta de ' + V.mesTexto(mes) + ' guardada.').then(ok => { if (ok) cerrarHoja(); });
    return true;
  }
  if (act === 'anio-fijar') { fijar(c); return true; }
  return false;
}
async function fijar(c) {
  const a = anioSel(c), Pr = proyDe(c, a), t = tabla(c, a, Pr), metas = I.metasDesde(t.filas.map(f => f.proy), Pr.metas);
  if (t.filas.some(f => f.cargando)) { toast('Espera a que terminen de cargar los meses.'); return; }
  const n = t.filas.filter(f => f.proy).length;
  const si = await ask({ title: '¿Fijar las metas de ' + a + '?', ok: 'Fijar metas',
    text: n + (n === 1 ? ' mes queda' : ' meses quedan') + ' con su proyección como meta (en total ' + cat.pesos(t.T.proy) + ' neto). ' + (n < 12 ? 'Los meses sin base conservan la meta que tenían. ' : '') + 'Reemplaza las metas escritas a mano de esos meses.' });
  if (si) guardar(c, Object.assign({}, Pr, { metas }), 'Metas de ' + a + ' fijadas.');
}
/* Vista previa mientras se escriben los porcentajes. */
export function alEscribir(el, c) {
  if (!el.closest || !el.closest('#dlg') || !$('#pyVista') || !/^py(Factor|Precio|Pan)/.test(el.id)) return;
  const r = leerHoja(c), e = $('#pyError');
  if (r.error) { e.textContent = r.error; e.hidden = false; return; }
  e.hidden = true;
  const a = anioSel(c), t = tabla(c, a, r.P);
  $('#pyVista').innerHTML = vista(t.T.proy, t.T.anterior, a);
}
