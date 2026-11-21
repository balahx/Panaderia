/* Pesaje (PLAN §8): la pantalla de la tablet de la panadería, con letra grande. También la ven dueños y externo.
   Quién pesa (queda elegido en el equipo) → 1 Pan → 2 Kilos o unidades con el teclado propio → 3 Guardar canasto.
   El pan queda elegido para el canasto siguiente. Arriba, la entrega en curso con «Cerrar entrega»; abajo, lo pesado hoy.
   La pantalla se redibuja sola cuando cambian los datos (app.js): lo que se está tecleando vive aquí (st), no en la página.
   Sin conexión todo sigue igual: Firestore guarda en el equipo y envía al volver internet («Por enviar»). Nunca muestra precios.
   Fase 10: con plan de hoy, cada pan del plan dice en su botón cuánto falta («faltan 18 kg», «✓ cumplido») y abajo va el «Plan de hoy».
   Fase 11: con más de un cliente activo, arriba va «Para:» (el cliente elegido queda en el equipo, `pan.cliente`; por omisión el supermercado).
   La entrega en curso y «Cerrar entrega» son las del cliente elegido. «Ventas sueltas» no tiene entregas: al guardar pide «¿Quién compró?»
   (opcional, queda en la nota). Con un solo cliente la pantalla queda igual que antes. Nunca muestra precios. */
import { esc, fechaTexto } from '../core/formato.js';
import { svg, emptyHTML, errorHTML } from '../core/iconos.js';
import { $, ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as canasto from './pesaje-hoja.js';
import * as plan from './plan.js';

const st = { prod: '', txt: '', nota: '', eligiendo: false };
const K_QUIEN = 'pan.pesador', K_CLIENTE = 'pan.cliente';
const pesador = () => { try { return localStorage.getItem(K_QUIEN) || ''; } catch (e) { return ''; } };
const fijarPesador = id => { try { localStorage.setItem(K_QUIEN, id); } catch (e) { /* sin almacenamiento: se pregunta cada vez */ } };
const guardado = () => { try { return localStorage.getItem(K_CLIENTE) || ''; } catch (e) { return ''; } };
const fijarCliente = id => { try { localStorage.setItem(K_CLIENTE, id); } catch (e) { /* sin almacenamiento: vuelve al supermercado */ } };
const clientes = c => cat.clientesActivos(c.cat && c.cat.clientes);
const original = c => { const o = cat.clienteOriginal(c.cat && c.cat.clientes); return o ? o.id : null; };
/* Cliente elegido: el guardado en el equipo si sigue activo; si no, el supermercado (o el primero activo). null si no hay clientes. */
export function clienteElegido(c) {
  const l = clientes(c), g = l.find(x => x.id === guardado());
  return g || cat.clientePrincipal(c.cat && c.cat.clientes) || l[0] || null;
}
const productos = c => cat.ordenarProductos(cat.activos(c.cat && c.cat.productos));
const trabajadores = c => cat.ordenarPersonas(cat.activos(c.cat && c.cat.trabajadores));
const delDia = c => (c.dia && c.dia.fecha === c.hoy ? c.dia : null);
const pesajesHoy = c => { const d = delDia(c); return (d && d.pesajes) || []; };
const diaCli = c => { const cl = clienteElegido(c); return P.diaDoc(delDia(c), cl && cl.id, original(c)); };
const enCurso = c => P.entregaEnCurso(diaCli(c));
const ventaSuelta = c => cat.esSuelta(clienteElegido(c));

/* ---------- Partes de la pantalla ---------- */
function elegirQuien(trabs, actual) {
  return '<section class="card sec" id="pesQuien"><h2>¿Quién pesa?</h2><p class="muted">Toca tu nombre. Queda elegido en este equipo hasta que lo cambies.</p>' +
    '<div class="pes-grid">' + trabs.map(t => '<button class="pes-op" data-act="pes-quien" data-id="' + esc(t.id) + '"' + (actual && actual.id === t.id ? ' aria-pressed="true"' : '') + '><b>' + esc(t.nombre) + '</b></button>').join('') + '</div>' +
    (actual ? '<div class="actions"><button class="btn ghost" data-act="pes-quien" data-id="' + esc(actual.id) + '">Seguir como ' + esc(actual.nombre) + '</button></div>' : '') + '</section>';
}
function barraQuien(quien) {
  return '<div class="pes-quien" id="pesQuienActual"><span>' + svg('user') + 'Pesa: <b>' + esc(quien.nombre) + '</b></span><button class="btn ghost sm" data-act="pes-cambiar-quien">Cambiar</button></div>';
}
/* «Para:» (Fase 11): solo con más de un cliente activo. Hasta 3, botones grandes; si son más, uno que abre la hoja de clientes. */
function barraCliente(c) {
  const l = clientes(c), sel = clienteElegido(c);
  if (l.length < 2 || !sel) return '';
  if (l.length > 3) return '<section class="sec pes-para" id="pesPara"><p class="eyebrow">Para</p><button class="pes-op pes-para-b" data-act="pes-clientes" aria-haspopup="dialog"><b>' + esc(sel.nombre) + '</b><small>Cambiar cliente</small></button></section>';
  return '<section class="sec pes-para" id="pesPara"><p class="eyebrow" id="pesParaT">Para</p><div class="pes-grid" role="group" aria-labelledby="pesParaT">' +
    l.map(x => '<button class="pes-op" data-act="pes-cliente" data-id="' + esc(x.id) + '" aria-pressed="' + (x.id === sel.id) + '"><b>' + esc(x.nombre) + '</b></button>').join('') + '</div></section>';
}
function hojaClientes(c) {
  const sel = clienteElegido(c);
  hoja('¿Para quién?', '<div class="pes-grid" id="pesClientes">' + clientes(c).map(x => '<button class="pes-op" data-act="pes-cliente" data-id="' + esc(x.id) + '" aria-pressed="' + (!!sel && x.id === sel.id) + '"><b>' + esc(x.nombre) + '</b></button>').join('') + '</div>' +
    '<p class="muted chico">Queda elegido en este equipo hasta que lo cambies.</p>');
}
function entrega(c) {
  const cl = clienteElegido(c), varios = clientes(c).length > 1;
  if (cat.esSuelta(cl)) return '<section class="card sec pes-entrega" id="pesEntrega"><p class="eyebrow">' + esc(cl.nombre) + '</p><b class="pes-n">Sin entregas</b><small>Cada canasto es una venta. Al guardar puedes anotar quién compró.</small></section>';
  const doc = diaCli(c), ea = P.entregaActual(pesajesHoy(c), doc, cl && cl.id, original(c)), listo = !!delDia(c) && doc !== undefined, de = varios && cl ? ' de ' + cl.nombre : '';
  return '<section class="card sec pes-entrega" id="pesEntrega"><div class="pes-entrega-h"><div><p class="eyebrow">Entrega en curso' + esc(de) + '</p><b class="pes-n" id="pesEntregaN">N.º ' + ea.n + '</b>' +
    '<small>' + (ea.canastos ? ea.canastos + (ea.canastos === 1 ? ' canasto · ' : ' canastos · ') + esc(P.textoTotales(ea)) : 'Sin canastos todavía') + '</small></div>' +
    '<button class="btn ghost" data-act="pes-cerrar-entrega"' + (!listo || !ea.canastos || ea.n >= P.MAX_ENTREGAS ? ' disabled' : '') + '>Cerrar entrega</button></div>' +
    (listo && !ea.canastos && ea.n > 1 ? '<button class="lnk" data-act="pes-reabrir">Volver a abrir la entrega n.º ' + (ea.n - 1) + esc(de) + '</button>' : '') + '</section>';
}
function panes(prods, c) {
  const linea = p => { const x = plan.lineaPan(c, p.id); return x ? '<small class="pes-plan-l est-' + x.estado + '">' + esc(x.texto) + '</small>' : '<small>' + (p.unidad === 'un' ? 'unidades' : 'kilos') + '</small>'; };
  return '<section class="sec"><p class="eyebrow" id="pesPanesT">1 · Pan</p><div class="pes-grid" id="pesPanes" role="group" aria-labelledby="pesPanesT">' +
    prods.map(p => '<button class="pes-op" data-act="pes-pan" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === st.prod) + '"><b>' + esc(p.nombre) + '</b>' + linea(p) + '</button>').join('') + '</div></section>';
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
  if (!c.cat || !c.cat.productos || !c.cat.trabajadores || !c.cat.clientes || !delDia(c) || !delDia(c).pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const prods = productos(c), trabs = trabajadores(c);
  if (!prods.length) return cab + emptyHTML('pan', 'Sin productos', 'Un dueño debe agregar los tipos de pan en Más → Catálogo.');
  if (!trabs.length) return cab + emptyHTML('team', 'Sin trabajadores', 'Un dueño debe agregar los nombres de quienes pesan en Más → Catálogo → Trabajadores.');
  if (st.prod && !prods.some(p => p.id === st.prod)) { st.prod = ''; st.txt = ''; }
  const quien = trabs.find(t => t.id === pesador());
  if (!quien || st.eligiendo) return cab + elegirQuien(trabs, quien);
  return cab + barraQuien(quien) + barraCliente(c) + entrega(c) + '<div class="pes-trabajo">' + panes(prods, c) + teclado(c) + '</div>' + plan.bloqueTablet(c) + lista(c);
}
const pintar = c => { $('#view').innerHTML = html(c); };
function pintarTeclado(c) { const t = $('#pesTeclado'); if (t) t.outerHTML = teclado(c); else pintar(c); }

/* ---------- Acciones ---------- */
function guardar(c, comprador) {
  const p = productos(c).find(x => x.id === st.prod); if (!p) return;
  const v = P.validarCantidad(st.txt, p.unidad);
  if (v.error) { toast(v.error); return; }
  const texto = P.textoCantidad(v.cantidad, p.unidad), cl = clienteElegido(c), suelta = cat.esSuelta(cl);
  if (suelta && comprador === undefined) { hojaComprador(st.nota); return; }   // primero «¿Quién compró?» (opcional)
  const varios = clientes(c).length > 1;
  const seguir = () => {
    const doc = P.nuevoPesaje({ fecha: c.hoy, hora: P.horaChile(new Date()), entregaN: suelta ? 1 : enCurso(c), clienteId: cl && cl.id, productoId: p.id, cantidad: v.cantidad, unidad: p.unidad,
      trabajadorId: pesador(), nota: suelta ? comprador : st.nota, creadoPor: c.user.uid });
    nube.guardarVarios([{ ruta: 'pesajes/' + cat.nuevoId(), datos: doc }]).catch(canasto.rechazo('el canasto de ' + p.nombre + ' (' + texto + ')'));
    st.txt = ''; st.nota = '';
    toast((suelta ? 'Venta suelta: ' : 'Guardado: ') + p.nombre + ' ' + texto + (varios && !suelta ? ' para ' + cl.nombre : '') + (suelta && comprador ? ' · ' + comprador : '') + (navigator.onLine === false ? ' · se enviará al volver internet' : ''));
    pintar(c);
  };
  if (v.confirmar) ask({ title: '¿' + texto + ' en un canasto?', text: 'Es mucho más de lo normal. Revisa el número antes de guardar.', ok: 'Sí, guardar', cancel: 'Corregir' }).then(si => { if (si) seguir(); });
  else seguir();
}
/* Venta suelta: quién compró (opcional; se recomienda solo el nombre de pila). Queda en la nota del canasto. */
function hojaComprador(nota) {
  hoja('¿Quién compró?', '<label class="lab" for="pComprador">Nombre (opcional)</label><input class="txt" id="pComprador" maxlength="200" autocomplete="off" data-enter="pes-suelta-guardar" value="' + esc(nota || '') + '">' +
    '<p class="muted chico">Por ejemplo «Sra. Marta». Basta el nombre de pila.</p>' +
    '<div class="actions"><button class="btn" data-act="pes-suelta-guardar">Guardar venta</button><button class="btn ghost" data-act="pes-suelta-sin">Guardar sin nombre</button></div>');
  $('#pComprador').focus();
}
function cambiarEntrega(c, n, titulo, texto, listo) {
  const cl = clienteElegido(c), ruta = P.rutaDia(c.hoy, cl && cl.id, original(c));
  ask({ title: titulo, text: texto, ok: 'Sí' }).then(si => {
    if (!si) return;
    nube.guardarVarios([{ ruta, datos: { entregaN: n, por: c.user.uid } }]).catch(canasto.rechazo('el cambio de entrega'));
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
  else if (act === 'pes-cliente') { const x = clientes(c).find(y => y.id === el.dataset.id); if (x) { fijarCliente(x.id); cerrarHoja(); pintar(c); toast('Para: ' + x.nombre); } }
  else if (act === 'pes-clientes') hojaClientes(c);
  else if (act === 'pes-suelta-guardar' || act === 'pes-suelta-sin') { const n = act === 'pes-suelta-sin' ? '' : P.limpiarNota($('#pComprador') ? $('#pComprador').value : ''); cerrarHoja(); guardar(c, n); }
  else if (act === 'pes-nota') canasto.hojaNota(st.nota);
  else if (act === 'pes-nota-guardar') { st.nota = P.limpiarNota($('#pNota') ? $('#pNota').value : ''); cerrarHoja(); pintarTeclado(c); }
  else if (act === 'pes-nota-quitar') { st.nota = ''; cerrarHoja(); pintarTeclado(c); }
  else if (act === 'pes-cerrar-entrega' || act === 'pes-reabrir') {
    const cl = clienteElegido(c); if (cat.esSuelta(cl)) return true;
    const ea = P.entregaActual(pesajesHoy(c), diaCli(c), cl && cl.id, original(c)), de = clientes(c).length > 1 && cl ? ' de ' + cl.nombre : '';
    if (act === 'pes-cerrar-entrega') {
      if (!ea.canastos) return true;
      cambiarEntrega(c, ea.n + 1, '¿Cerrar la entrega n.º ' + ea.n + de + '?', ea.canastos + (ea.canastos === 1 ? ' canasto' : ' canastos') + ' · ' + P.textoTotales(ea) + '. Los próximos canastos' + (de ? ' para ' + cl.nombre : '') + ' irán a la entrega n.º ' + (ea.n + 1) + '.',
        'Entrega n.º ' + ea.n + de + ' cerrada. Ahora va la n.º ' + (ea.n + 1));
    } else {
      if (ea.canastos || ea.n < 2) return true;
      cambiarEntrega(c, ea.n - 1, '¿Volver a abrir la entrega n.º ' + (ea.n - 1) + de + '?', 'Los próximos canastos se sumarán a esa entrega.', 'Entrega n.º ' + (ea.n - 1) + de + ' abierta de nuevo');
    }
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
