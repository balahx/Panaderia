/* Hojas del pesaje, comunes a la tablet (Pesaje) y a dueños y externo (Hoy): ver un canasto, corregirlo, anularlo o reactivarlo
   (siempre con constancia en la bitácora `cambios`), y la nota del próximo canasto. La tablet solo corrige lo del día (las reglas lo exigen).
   Las escrituras no esperan al servidor: sin internet quedan en el equipo y se envían solas (nube.guardarVarios).
   Desde la Fase 5 también las usa el Registro general (canastos de cualquier día del período, en ctx.per). */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { $, ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import { puede } from '../core/perfil.js';
import { cerradoEl } from '../core/cierres.js';

const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const nombre = (lista, id) => { const x = buscar(lista, id); return x ? x.nombre : '(sin nombre)'; };
const kv = (k, v) => '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const errorForm = '<p class="form-error" role="alert" hidden></p>';
function error(msg, campo) {
  const e = $('#dlg[open] .form-error'); if (!e) { toast(msg); return; }
  e.textContent = msg; e.hidden = !msg;
  const c = campo && $('#dlg #' + campo); if (c) c.focus();
}
/* Si el servidor rechaza algo que ya se mostró como guardado, se avisa (la copia del equipo lo deshace sola). */
export function rechazo(que) {
  return e => toast('No se guardó ' + que + (String(e && e.code).includes('permission') ? ': el servidor no lo aceptó. Revisa la fecha y hora del equipo, o pide ayuda a un dueño.' : '. Inténtalo de nuevo.'), 9000);
}
const sinRed = () => (navigator.onLine === false ? ' · se enviará al volver internet' : '');
/* ¿Esta cuenta puede corregir este canasto? La tablet, solo los del día; nadie, los de un mes cerrado (Fase 6). */
export const corregible = (p, c) => (puede(c.perfil, 'gestion') || p.fecha === c.hoy) && !cerradoEl(c.cierres, p.fecha);
/* Día en que se anotó en la nube, si es posterior al día del canasto (anotado en fecha pasada, o llegado tarde sin conexión). '' si no. */
export function anotadoDespues(p) {
  if (typeof p.en !== 'number' || p._pend) return '';
  const d = diaChile(new Date(p.en)); return d > p.fecha ? d : '';
}
/* Canastos que la pantalla tiene a mano: los del día que se mira y los del período (Registro general). */
const conocidos = c => ((c.dia && c.dia.pesajes) || []).concat((c.per && c.per.pesajes) || []);

/* Fila de un canasto en una lista (la usan Pesaje y Hoy). */
export function filaCanasto(p, c, conEntrega) {
  const k = c.cat || {};
  return '<button class="mrow pes-fila' + (p.anulado ? ' anulado' : '') + '" data-act="can-ver" data-id="' + esc(p.id) + '">' +
    '<span class="pes-hora">' + esc(p.hora || '') + '</span><span class="mt"><b>' + esc(nombre(k.productos, p.productoId)) + '</b><small>' +
    esc(nombre(k.trabajadores, p.trabajadorId) + (conEntrega ? ' · Entrega ' + (p.entregaN || 1) : '') + (anotadoDespues(p) ? ' · anotado el ' + fechaTexto(anotadoDespues(p)) : '') + (p.nota ? ' · ' + p.nota : '')) + '</small></span>' +
    '<span class="pes-cant">' + esc(P.textoCantidad(p.cantidad, p.unidad)) + '</span>' +
    (p.anulado ? '<span class="badge">Anulado</span>' : p._pend ? '<span class="badge warn" title="Guardado en este equipo; falta enviarlo">Por enviar</span>' : '') + '</button>';
}

/* ---------- Ver un canasto ---------- */
function hojaCanasto(p, c) {
  const k = c.cat || {}, id = ' data-id="' + esc(p.id) + '"', puedo = corregible(p, c);
  hoja((p.anulado ? 'Anulado · ' : 'Canasto · ') + nombre(k.productos, p.productoId),
    '<div id="canDetalle">' + kv('Cantidad', P.textoCantidad(p.cantidad, p.unidad)) + kv('Pesó', nombre(k.trabajadores, p.trabajadorId)) +
    kv('Entrega', 'N.º ' + (p.entregaN || 1)) + kv('Día y hora', fechaTexto(p.fecha) + ' · ' + (p.hora || '')) + (anotadoDespues(p) ? kv('Anotado el', fechaTexto(anotadoDespues(p))) : '') + (p.nota ? kv('Nota', p.nota) : '') +
    kv('Estado', p.anulado ? 'Anulado (no cuenta en los totales)' : p._pend ? 'Guardado en este equipo, por enviar' : 'Guardado') + '</div>' +
    (puedo ? '<div class="actions">' + (p.anulado ? '<button class="btn" data-act="can-reactivar"' + id + '>Reactivar</button>'
      : '<button class="btn" data-act="can-corregir"' + id + '>Corregir</button><button class="btn ghost" data-act="can-anular"' + id + '>Anular</button>') + '</div>' +
      '<p class="muted chico">Cada corrección queda anotada (qué cambió, quién y cuándo).</p>'
      : cerradoEl(c.cierres, p.fecha) ? '<p class="muted chico" id="canCerrado">Ese mes está cerrado: no se corrige. Un dueño puede reabrirlo en Más → Cierres mensuales.</p>'
        : '<p class="muted chico">Desde la panadería solo se corrige lo del día. Si hay un error, avisa a un dueño.</p>'));
}

/* ---------- Corregir ---------- */
const opcion = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
function hojaCorregir(p, c) {
  const k = c.cat || {};
  const prods = cat.ordenarProductos(cat.activos(k.productos)); if (!buscar(prods, p.productoId) && buscar(k.productos, p.productoId)) prods.push(buscar(k.productos, p.productoId));
  const trabs = cat.ordenarPersonas(cat.activos(k.trabajadores)); if (!buscar(trabs, p.trabajadorId) && buscar(k.trabajadores, p.trabajadorId)) trabs.push(buscar(k.trabajadores, p.trabajadorId));
  const delDia = conocidos(c).filter(x => x.fecha === p.fecha).reduce((m, x) => Math.max(m, x.entregaN || 1), 1);
  const ult = Math.min(P.MAX_ENTREGAS, Math.max(p.entregaN || 1, delDia + (puede(c.perfil, 'gestion') ? 1 : 0), c.dia && c.dia.fecha === p.fecha ? P.entregaEnCurso(c.dia.dia) : 1));
  hoja('Corregir canasto',
    '<label class="lab" for="cPan">Pan</label><select class="txt" id="cPan">' + prods.map(x => opcion(x.id, x.nombre + (x.unidad === 'un' ? ' (unidades)' : ' (kg)'), x.id === p.productoId)).join('') + '</select>' +
    '<label class="lab" for="cCant">Cantidad (kilos o unidades, según el pan)</label><input class="txt" id="cCant" inputmode="decimal" maxlength="9" autocomplete="off" data-enter="can-guardar" value="' + esc(cat.enCampo(p.cantidad)) + '">' +
    '<label class="lab" for="cQuien">Quién pesó</label><select class="txt" id="cQuien">' + trabs.map(x => opcion(x.id, x.nombre, x.id === p.trabajadorId)).join('') + '</select>' +
    '<label class="lab" for="cEntrega">Entrega</label><select class="txt" id="cEntrega">' + Array.from({ length: ult }, (_, i) => opcion(i + 1, 'N.º ' + (i + 1), i + 1 === (p.entregaN || 1))).join('') + '</select>' +
    '<label class="lab" for="cNota">Nota (opcional)</label><input class="txt" id="cNota" maxlength="200" autocomplete="off" data-enter="can-guardar" value="' + esc(p.nota || '') + '">' +
    errorForm + '<div class="actions"><button class="btn" data-act="can-guardar" data-id="' + esc(p.id) + '">Guardar corrección</button><button class="btn ghost" data-act="cerrar-hoja">Cancelar</button></div>');
  $('#cCant').focus();
}
function guardarCorreccion(p, c) {
  const prod = buscar(c.cat.productos, $('#cPan').value); if (!prod) { error('Elige el pan.', 'cPan'); return; }
  const v = P.validarCantidad(String($('#cCant').value).replace(/\s/g, ''), prod.unidad); if (v.error) { error(v.error, 'cCant'); return; }
  const nuevo = Object.assign({}, p, { productoId: prod.id, unidad: prod.unidad, cantidad: v.cantidad, trabajadorId: $('#cQuien').value,
    entregaN: Number($('#cEntrega').value) || 1, nota: P.limpiarNota($('#cNota').value) });
  const dif = P.diferencia(p, nuevo);
  if (!dif) { cerrarHoja(); toast('Sin cambios'); return; }
  const seguir = () => escribir(p, nuevo, 'corregir', dif, c, 'Canasto corregido', 'la corrección');
  if (v.confirmar) ask({ title: '¿' + P.textoCantidad(v.cantidad, prod.unidad) + ' en un canasto?', text: 'Es mucho más de lo normal. Revisa el número.', ok: 'Sí, guardar', cancel: 'Revisar' }).then(si => { if (si) seguir(); });
  else seguir();
}
/* Pesaje y constancia juntos (o los dos o ninguno). */
function escribir(p, nuevo, tipo, dif, c, listo, que) {
  nube.guardarVarios([{ ruta: 'pesajes/' + p.id, datos: P.soloPesaje(nuevo) }, { ruta: 'cambios/' + cat.nuevoId(), datos: P.constancia(tipo, p, dif, c.user.uid, c.user.nombre) }]).catch(rechazo(que));
  cerrarHoja(); toast(listo + sinRed());
}
function anular(p, c, si) {
  const nuevo = Object.assign({}, p, { anulado: si }), dif = P.diferencia(p, nuevo);
  if (!dif) return;
  if (!si) { escribir(p, nuevo, 'reactivar', dif, c, 'Canasto reactivado', 'la reactivación'); return; }
  ask({ title: '¿Anular este canasto?', text: P.textoCantidad(p.cantidad, p.unidad) + ' de ' + nombre(c.cat.productos, p.productoId) + '. Deja de contar en los totales; queda en la lista como anulado y se puede reactivar.', ok: 'Anular', danger: true })
    .then(ok => { if (ok) escribir(p, nuevo, 'anular', dif, c, 'Canasto anulado', 'la anulación'); });
}

/* ---------- Nota del próximo canasto (no va a internet: se guarda con el canasto) ---------- */
export function hojaNota(nota) {
  hoja('Nota del canasto', '<label class="lab" for="pNota">Nota (opcional)</label><input class="txt" id="pNota" maxlength="200" autocomplete="off" data-enter="pes-nota-guardar" value="' + esc(nota || '') + '">' +
    '<p class="muted chico">Se guarda junto con el próximo canasto. Por ejemplo: «canasto chico» o «pan quemado».</p>' +
    '<div class="actions"><button class="btn" data-act="pes-nota-guardar">Listo</button>' + (nota ? '<button class="btn ghost" data-act="pes-nota-quitar">Quitar la nota</button>' : '<button class="btn ghost" data-act="cerrar-hoja">Cancelar</button>') + '</div>');
  $('#pNota').focus();
}

/* Acciones de las hojas de canasto (can-…). Devuelve true si las atendió. */
export function alActuar(act, el, c) {
  if (!act.startsWith('can-')) return false;
  const p = buscar(conocidos(c), el.dataset.id);
  if (!p || !c.cat) { cerrarHoja(); return true; }
  if (act === 'can-ver') { hojaCanasto(p, c); return true; }
  if (!corregible(p, c)) { toast('Desde la panadería solo se corrige lo del día.'); return true; }
  if (act === 'can-corregir') hojaCorregir(p, c);
  else if (act === 'can-guardar') guardarCorreccion(p, c);
  else if (act === 'can-anular') anular(p, c, true);
  else if (act === 'can-reactivar') anular(p, c, false);
  return true;
}
