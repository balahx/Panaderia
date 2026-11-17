/* Pesaje (PLAN §8): la pantalla de la tablet de la panadería, con letra grande. También la ven dueños y externo.
   Quién pesa (queda elegido en el equipo) → 1 Pan → 2 Kilos o unidades con el teclado propio → 3 Guardar canasto.
   El pan queda elegido para el canasto siguiente. Arriba, la entrega en curso con «Cerrar entrega»; abajo, lo pesado hoy.
   La pantalla se redibuja sola cuando cambian los datos (app.js): lo que se está tecleando vive aquí (st), no en la página.
   Sin conexión todo sigue igual: Firestore guarda en el equipo y envía al volver internet («Por enviar»). Nunca muestra precios. */
import { esc, fechaTexto } from '../core/formato.js';
import { svg, emptyHTML, errorHTML } from '../core/iconos.js';
import { $, ask, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as canasto from './pesaje-hoja.js';

const st = { prod: '', txt: '', nota: '', eligiendo: false };
const K_QUIEN = 'pan.pesador';
const pesador = () => { try { return localStorage.getItem(K_QUIEN) || ''; } catch (e) { return ''; } };
const fijarPesador = id => { try { localStorage.setItem(K_QUIEN, id); } catch (e) { /* sin almacenamiento: se pregunta cada vez */ } };
const productos = c => cat.ordenarProductos(cat.activos(c.cat && c.cat.productos));
const trabajadores = c => cat.ordenarPersonas(cat.activos(c.cat && c.cat.trabajadores));
const delDia = c => (c.dia && c.dia.fecha === c.hoy ? c.dia : null);
const pesajesHoy = c => { const d = delDia(c); return (d && d.pesajes) || []; };
const enCurso = c => { const d = delDia(c); return P.entregaEnCurso(d && d.dia); };

/* ---------- Partes de la pantalla ---------- */
function elegirQuien(trabs, actual) {
  return '<section class="card sec" id="pesQuien"><h2>¿Quién pesa?</h2><p class="muted">Toca tu nombre. Queda elegido en este equipo hasta que lo cambies.</p>' +
    '<div class="pes-grid">' + trabs.map(t => '<button class="pes-op" data-act="pes-quien" data-id="' + esc(t.id) + '"' + (actual && actual.id === t.id ? ' aria-pressed="true"' : '') + '><b>' + esc(t.nombre) + '</b></button>').join('') + '</div>' +
    (actual ? '<div class="actions"><button class="btn ghost" data-act="pes-quien" data-id="' + esc(actual.id) + '">Seguir como ' + esc(actual.nombre) + '</button></div>' : '') + '</section>';
}
function barraQuien(quien) {
  return '<div class="pes-quien" id="pesQuienActual"><span>' + svg('user') + 'Pesa: <b>' + esc(quien.nombre) + '</b></span><button class="btn ghost sm" data-act="pes-cambiar-quien">Cambiar</button></div>';
}
function entrega(c) {
  const ea = P.entregaActual(pesajesHoy(c), delDia(c) && delDia(c).dia), listo = !!delDia(c) && delDia(c).dia !== undefined;
  return '<section class="card sec pes-entrega" id="pesEntrega"><div class="pes-entrega-h"><div><p class="eyebrow">Entrega en curso</p><b class="pes-n" id="pesEntregaN">N.º ' + ea.n + '</b>' +
    '<small>' + (ea.canastos ? ea.canastos + (ea.canastos === 1 ? ' canasto · ' : ' canastos · ') + esc(P.textoTotales(ea)) : 'Sin canastos todavía') + '</small></div>' +
    '<button class="btn ghost" data-act="pes-cerrar-entrega"' + (!listo || !ea.canastos || ea.n >= P.MAX_ENTREGAS ? ' disabled' : '') + '>Cerrar entrega</button></div>' +
    (listo && !ea.canastos && ea.n > 1 ? '<button class="lnk" data-act="pes-reabrir">Volver a abrir la entrega n.º ' + (ea.n - 1) + '</button>' : '') + '</section>';
}
function panes(prods) {
  return '<section class="sec"><p class="eyebrow" id="pesPanesT">1 · Pan</p><div class="pes-grid" id="pesPanes" role="group" aria-labelledby="pesPanesT">' +
    prods.map(p => '<button class="pes-op" data-act="pes-pan" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === st.prod) + '"><b>' + esc(p.nombre) + '</b><small>' + (p.unidad === 'un' ? 'unidades' : 'kilos') + '</small></button>').join('') + '</div></section>';
}
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
function teclado(c) {
  const p = productos(c).find(x => x.id === st.prod);
  if (!p) return '<section class="sec pes-vacio" id="pesTeclado"><p class="muted">Elige el pan para anotar el canasto.</p></section>';
  const v = st.txt ? P.validarCantidad(st.txt, p.unidad) : {}, kg = p.unidad !== 'un';
  const tecla = (k, t, aria) => '<button class="pes-tecla" data-act="pes-tecla" data-k="' + k + '"' + (aria ? ' aria-label="' + aria + '"' : '') + '>' + t + '</button>';
  return '<section class="sec" id="pesTeclado"><p class="eyebrow">2 · ' + (kg ? 'Kilos' : 'Unidades') + ' de ' + esc(p.nombre) + '</p>' +
    '<div class="pes-display" id="pesValor" role="status" aria-live="polite">' + esc(P.textoTeclado(st.txt, p.unidad)) + '</div>' +
    (v.aviso ? '<p class="warn-t" id="pesAviso">' + esc(v.aviso) + '</p>' : '') +
    '<div class="pes-teclas">' + TECLAS.map(k => tecla(k, k)).join('') + (kg ? tecla(',', ',', 'Coma decimal') : tecla('limpiar', 'C', 'Borrar todo')) + tecla('0', '0') + tecla('borrar', '⌫', 'Borrar el último número') + '</div>' +
    '<div class="actions"><button class="btn ghost sm" data-act="pes-nota" id="pesNota">' + (st.nota ? 'Nota: ' + esc(st.nota.length > 24 ? st.nota.slice(0, 24) + '…' : st.nota) : 'Agregar nota') + '</button></div>' +
    '<button class="btn lg block pes-guardar" data-act="pes-guardar" id="pesGuardar"' + (st.txt && !v.error ? '' : ' disabled') + '>3 · Guardar canasto</button></section>';
}
function lista(c) {
  const todos = P.recientes(pesajesHoy(c)), R = P.resumen(todos, c.cat.productos, c.cat.trabajadores), pend = todos.filter(p => p._pend).length;
  return '<section class="sec" id="pesHoy"><h2>Pesado hoy</h2><p class="muted" id="pesTotales">' + (R.canastos ? R.canastos + (R.canastos === 1 ? ' canasto · ' : ' canastos · ') + esc(P.textoTotales(R)) : 'Todavía no hay canastos hoy.') + '</p>' +
    (pend ? '<p class="note warn" id="pesPendientes">' + pend + (pend === 1 ? ' registro guardado en este equipo se enviará' : ' registros guardados en este equipo se enviarán') + ' al volver internet. No cierres sesión mientras tanto.</p>' : '') +
    (R.porPan.length ? '<div class="mlist pes-tot">' + R.porPan.map(x => '<div class="kv"><span>' + esc(x.nombre) + '</span><b>' + esc(P.textoCantidad(x.cantidad, x.unidad)) + '</b></div>').join('') + '</div>' : '') +
    (todos.length ? '<div class="mlist" id="listaPesajes">' + todos.map(p => canasto.filaCanasto(p, c, true)).join('') + '</div><p class="muted chico">Toca un canasto para corregirlo o anularlo (solo los de hoy).</p>' : '') + '</section>';
}

export function html(c) {
  const cab = '<span class="eyebrow">Pesaje · ' + esc(fechaTexto(c.hoy)) + '</span><h1>Pesar pan</h1>';
  const err = c.errCat || (c.dia && c.dia.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!c.cat || !c.cat.productos || !c.cat.trabajadores || !delDia(c) || !delDia(c).pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const prods = productos(c), trabs = trabajadores(c);
  if (!prods.length) return cab + emptyHTML('pan', 'Sin productos', 'Un dueño debe agregar los tipos de pan en Más → Catálogo.');
  if (!trabs.length) return cab + emptyHTML('team', 'Sin trabajadores', 'Un dueño debe agregar los nombres de quienes pesan en Más → Catálogo → Trabajadores.');
  if (st.prod && !prods.some(p => p.id === st.prod)) { st.prod = ''; st.txt = ''; }
  const quien = trabs.find(t => t.id === pesador());
  if (!quien || st.eligiendo) return cab + elegirQuien(trabs, quien);
  return cab + barraQuien(quien) + entrega(c) + '<div class="pes-trabajo">' + panes(prods) + teclado(c) + '</div>' + lista(c);
}
const pintar = c => { $('#view').innerHTML = html(c); };
function pintarTeclado(c) { const t = $('#pesTeclado'); if (t) t.outerHTML = teclado(c); else pintar(c); }

/* ---------- Acciones ---------- */
function guardar(c) {
  const p = productos(c).find(x => x.id === st.prod); if (!p) return;
  const v = P.validarCantidad(st.txt, p.unidad);
  if (v.error) { toast(v.error); return; }
  const texto = P.textoCantidad(v.cantidad, p.unidad);
  const seguir = () => {
    const doc = P.nuevoPesaje({ fecha: c.hoy, hora: P.horaChile(new Date()), entregaN: enCurso(c), productoId: p.id, cantidad: v.cantidad, unidad: p.unidad,
      trabajadorId: pesador(), nota: st.nota, creadoPor: c.user.uid });
    nube.guardarVarios([{ ruta: 'pesajes/' + cat.nuevoId(), datos: doc }]).catch(canasto.rechazo('el canasto de ' + p.nombre + ' (' + texto + ')'));
    st.txt = ''; st.nota = '';
    toast('Guardado: ' + p.nombre + ' ' + texto + (navigator.onLine === false ? ' · se enviará al volver internet' : ''));
    pintar(c);
  };
  if (v.confirmar) ask({ title: '¿' + texto + ' en un canasto?', text: 'Es mucho más de lo normal. Revisa el número antes de guardar.', ok: 'Sí, guardar', cancel: 'Corregir' }).then(si => { if (si) seguir(); });
  else seguir();
}
function cambiarEntrega(c, n, titulo, texto, listo) {
  ask({ title: titulo, text: texto, ok: 'Sí' }).then(si => {
    if (!si) return;
    nube.guardarVarios([{ ruta: 'dias/' + c.hoy, datos: { entregaN: n, por: c.user.uid } }]).catch(canasto.rechazo('el cambio de entrega'));
    toast(listo + (navigator.onLine === false ? ' · se enviará al volver internet' : ''));
  });
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (canasto.alActuar(act, el, c)) return true;
  if (!act.startsWith('pes-') || !c.cat) return false;
  if (act === 'pes-quien') { const t = trabajadores(c).find(x => x.id === el.dataset.id); if (t) { fijarPesador(t.id); st.eligiendo = false; pintar(c); toast('Pesa: ' + t.nombre); } }
  else if (act === 'pes-cambiar-quien') { st.eligiendo = true; pintar(c); scrollTo(0, 0); }
  else if (act === 'pes-pan') { if (st.prod !== el.dataset.id) { st.prod = el.dataset.id; st.txt = ''; } pintar(c); const g = $('#pesGuardar'); if (g && g.scrollIntoView) g.scrollIntoView({ block: 'nearest' }); }
  else if (act === 'pes-tecla') { const p = productos(c).find(x => x.id === st.prod); if (p) { st.txt = P.teclear(st.txt, el.dataset.k, p.unidad); pintarTeclado(c); const b = $('#pesTeclado [data-k="' + el.dataset.k + '"]'); if (b) b.focus(); } }
  else if (act === 'pes-guardar') guardar(c);
  else if (act === 'pes-nota') canasto.hojaNota(st.nota);
  else if (act === 'pes-nota-guardar') { st.nota = P.limpiarNota($('#pNota') ? $('#pNota').value : ''); cerrarHoja(); pintarTeclado(c); }
  else if (act === 'pes-nota-quitar') { st.nota = ''; cerrarHoja(); pintarTeclado(c); }
  else if (act === 'pes-cerrar-entrega') {
    const ea = P.entregaActual(pesajesHoy(c), delDia(c) && delDia(c).dia);
    if (!ea.canastos) return true;
    cambiarEntrega(c, ea.n + 1, '¿Cerrar la entrega n.º ' + ea.n + '?', ea.canastos + (ea.canastos === 1 ? ' canasto' : ' canastos') + ' · ' + P.textoTotales(ea) + '. Los próximos canastos irán a la entrega n.º ' + (ea.n + 1) + '.',
      'Entrega n.º ' + ea.n + ' cerrada. Ahora va la n.º ' + (ea.n + 1));
  } else if (act === 'pes-reabrir') {
    const ea = P.entregaActual(pesajesHoy(c), delDia(c) && delDia(c).dia);
    if (ea.canastos || ea.n < 2) return true;
    cambiarEntrega(c, ea.n - 1, '¿Volver a abrir la entrega n.º ' + (ea.n - 1) + '?', 'Los próximos canastos se sumarán a esa entrega.', 'Entrega n.º ' + (ea.n - 1) + ' abierta de nuevo');
  }
  return true;
}
/* Teclado físico (computador o tablet con teclado): números, coma o punto, borrar y Enter para guardar. */
export function alTeclear(e, c) {
  if (!st.prod || e.ctrlKey || e.metaKey || e.altKey || (e.target && e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' '))) return false;
  const k = /^[0-9]$/.test(e.key) ? e.key : e.key === ',' || e.key === '.' ? ',' : e.key === 'Backspace' ? 'borrar' : e.key === 'Escape' ? 'limpiar' : e.key === 'Enter' ? 'guardar' : '';
  if (!k) return false;
  if (k === 'guardar') { if (st.txt) guardar(c); return true; }
  const p = productos(c).find(x => x.id === st.prod); if (!p) return false;
  st.txt = P.teclear(st.txt, k, p.unidad); pintarTeclado(c);
  return true;
}
