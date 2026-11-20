/* Costos · receta y simulador de un pan (PLAN, Fase 9). Se abren desde la ficha del pan (Catálogo) y desde Costos → El mes.
   Receta = ingredientes de UNA tanda (por kilos de masa) y lo que sale (kilos de pan horneado, o unidades). Tiene fecha de vigencia:
   cambiarla crea una versión nueva desde una fecha y los días anteriores conservan su costo (core/costos.js).
   Simulador: con el costo de hoy, «si el precio fuera ___ → margen» y «para ganar ___ % → precio» (margen sobre el precio de venta). */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { $, ask, hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as K from '../core/costos.js';
import { puede } from '../core/perfil.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';

const hoy = () => diaChile(new Date());
const buscar = (lista, id) => (lista || []).find(x => x.id === id);
const por = p => (p.unidad === 'un' ? 'por unidad' : 'por kg');
const listo = k => !!(k && k.insumos && k.preciosInsumo && k.recetas);
const kc = k => ({ insumos: k.insumos, preciosInsumo: k.preciosInsumo, recetas: k.recetas });
const pesos2 = n => cat.pesos(Math.round(n * 100) / 100);
const precioHoy = (p, c) => { const cl = cat.clientePrincipal(c.cat.clientes), pr = cl ? cat.precioVigente(c.cat.precios, p.id, cl.id, hoy()) : null; return pr ? pr.neto : null; };
const conIva = (neto, c) => cat.pesos(Math.round(cat.conIva(neto, cat.ivaDe(c.negocio))));
const costoHoy = (p, c) => K.costoReceta(K.recetaVigente(c.cat.recetas, p.id, hoy()), c.cat.insumos, c.cat.preciosInsumo, hoy(), p);

/* Bloque «Costo» de la ficha del pan: costo de hoy, margen con el precio de hoy, y los botones de la receta y el simulador. */
export function resumenFicha(p, c) {
  const k = c.cat;
  if (!listo(k)) return '';
  const C = costoHoy(p, c), id = ' data-id="' + esc(p.id) + '"', precio = precioHoy(p, c);
  if (!C) return '<section class="sec" id="fichaCosto"><p class="eyebrow">Costo y margen</p><p class="muted" id="sinReceta">Sin receta: no se calcula el costo de este pan.</p>' +
    '<div class="actions"><button class="btn ghost" data-act="rec-form"' + id + '>Anotar receta</button></div></section>';
  const s = C.unitario == null ? null : K.simular(C.unitario, precio);
  return '<section class="sec" id="fichaCosto"><p class="eyebrow">Costo y margen</p>' +
    (C.unitario == null ? '<p class="warn-t" id="costoFalta">Falta el precio de: ' + esc(C.faltan.join(', ')) + ' (Más → Costos y margen → Insumos).</p>'
      : '<div class="costo-hoy" id="costoHoy"><b>' + esc(pesos2(C.unitario)) + '</b><span>ingredientes ' + por(p) + ' (receta desde el ' + esc(fechaTexto(K.recetaVigente(k.recetas, p.id, hoy()).desde)) + ')</span>' +
        '<small>' + (s ? 'Margen con el precio de hoy: ' + esc(pesos2(s.margen)) + ' (' + esc(K.pctTexto(s.pct)) + ' del precio)' : 'Sin precio de venta para hoy: no hay margen.') + '</small></div>') +
    '<div class="actions"><button class="btn ghost" data-act="rec-ver"' + id + '>Ver receta</button>' + (C.unitario == null ? '' : '<button class="btn ghost" data-act="rec-sim"' + id + '>Simular precio</button>') + '</div></section>';
}

/* ---------- Receta vigente, con su costo y su historial ---------- */
function hojaReceta(p, c) {
  const k = c.cat, r = K.recetaVigente(k.recetas, p.id, hoy()), h = K.historialReceta(k.recetas, p.id), id = ' data-id="' + esc(p.id) + '"';
  const futura = h.find(x => x.desde > hoy());
  if (!r && !h.length) { hojaForm(p, c); return; }
  const C = r ? K.costoReceta(r, k.insumos, k.preciosInsumo, hoy(), p) : null, u = p.unidad === 'un' ? 'unidades' : 'kg de pan';
  hoja('Receta de ' + p.nombre, (C ? '<p class="muted">Una tanda · rige desde el ' + esc(fechaTexto(r.desde)) + '</p>' +
    '<div class="mlist" id="recItems">' + C.items.map(i => '<div class="mrow fija"><span class="mt"><b>' + esc(i.nombre) + '</b><small>' + esc(K.textoCantidad(i.cantidad, i.unidad)) +
      (i.precio == null ? '' : ' · ' + pesos2(i.precio) + ' / ' + K.UNIDADES[i.unidad].c) + '</small></span><span class="precio"><b>' + (i.costo == null ? 'Sin precio' : esc(pesos2(i.costo))) + '</b></span></div>').join('') + '</div>' +
    '<div class="kv"><span>Salen</span><b id="recSalen">' + esc(cat.enCampo(r.rendimiento) + ' ' + u) + '</b></div>' +
    (C.masa ? '<div class="kv"><span>Masa (kilos y litros)</span><b>' + esc(cat.enCampo(C.masa)) + ' kg</b></div>' : '') +
    (C.merma != null ? '<div class="kv"><span>Se pierde al hornear</span><b>' + esc(K.pctTexto(C.merma)) + '</b></div>' : '') +
    '<div class="kv"><span>Costo de la tanda</span><b id="recTanda">' + (C.tanda == null ? '—' : esc(pesos2(C.tanda))) + '</b></div>' +
    '<div class="kv fuerte"><span>Costo ' + por(p) + '</span><b id="recUnitario">' + (C.unitario == null ? '—' : esc(pesos2(C.unitario))) + '</b></div>' +
    (C.faltan.length ? '<p class="warn-t" id="recFalta">Falta el precio de: ' + esc(C.faltan.join(', ')) + '.</p>' : '') +
    (r.nota ? '<p class="muted chico" id="recNota">Nota: ' + esc(r.nota) + '</p>' : '') : '<p class="note warn">La receta anotada rige recién desde el ' + esc(fechaTexto(h[h.length - 1].desde)) + '.</p>') +
    (futura ? '<p class="muted chico" id="recFutura">Desde el ' + esc(fechaTexto(futura.desde)) + ' regirá otra versión.</p>' : '') +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="rec-form"' + id + '>Cambiar receta</button>' +
    (C && C.unitario != null ? '<button class="btn ghost" data-act="rec-sim"' + id + '>Simular precio</button>' : '') + '<button class="btn ghost" data-act="cat-prod"' + id + '>Ficha del pan</button></div>' +
    '<p class="eyebrow">Versiones</p><div class="hist" id="recHistorial">' + h.map(x => '<div class="hist-f"><div><b>Desde el ' + esc(fechaTexto(x.desde)) + '</b><small>' + x.items.length + ' ingredientes · salen ' + esc(cat.enCampo(x.rendimiento)) +
      (p.unidad === 'un' ? ' un' : ' kg') + (r && x.id === r.id ? ' · vigente' : x.desde > hoy() ? ' · aún no rige' : '') + '</small></div><button class="btn sm ghost" data-act="rec-quitar"' + id + ' data-rid="' + esc(x.id) + '" aria-label="Quitar la versión del ' + esc(fechaTexto(x.desde)) + '">Quitar</button></div>').join('') + '</div>');
}

/* ---------- Formulario: una fila por insumo activo (en blanco = no lo lleva) ---------- */
const enCampoCant = (n, u) => ((u === 'kg' || u === 'l') && n < 1 ? cat.enCampo(Math.round(n * 1000 * 10) / 10) + (u === 'kg' ? ' g' : ' ml') : cat.enCampo(n));
function insumosDelForm(k, r) { return K.ordenarInsumos((k.insumos || []).filter(i => i.activo !== false || (r && r.items.some(x => x.insumoId === i.id)))); }
function hojaForm(p, c) {
  const k = c.cat, r = K.recetaVigente(k.recetas, p.id, hoy()) || K.historialReceta(k.recetas, p.id)[0] || null, ins = insumosDelForm(k, r), primera = !r;
  if (!ins.length) {
    hoja('Receta de ' + p.nombre, '<p class="note warn" id="recSinInsumos">Primero agrega los insumos (harina, margarina, sal…) con su precio de factura.</p>' +
      '<div class="actions"><button class="btn" data-act="ir" data-tab="costos" data-sub="insumos">Ir a los insumos</button></div>');
    return;
  }
  const cant = id => { const x = r && r.items.find(y => y.insumoId === id); return x ? x.cantidad : null; }, un = p.unidad === 'un';
  hoja((r ? 'Cambiar receta de ' : 'Receta de ') + p.nombre, '<p class="muted chico">Lo que lleva UNA tanda. En kilos o litros puedes escribir «250 g» o «500 ml». En blanco, no lo lleva.</p>' +
    '<div id="recCampos">' + ins.map(i => '<div class="rec-f"><label class="lab" for="rc-' + esc(i.id) + '">' + esc(i.nombre) + ' <span class="muted">(' + esc(K.UNIDADES[i.unidad].t.toLowerCase()) + ')</span></label>' +
      '<input class="txt" id="rc-' + esc(i.id) + '" data-campo="c-' + esc(i.id) + '" data-ins="' + esc(i.id) + '" inputmode="decimal" maxlength="12" autocomplete="off" data-enter="rec-guardar" value="' + esc(cant(i.id) == null ? '' : enCampoCant(cant(i.id), i.unidad)) + '"></div>').join('') + '</div>' +
    '<label class="lab" for="recRend">' + (un ? 'Unidades que salen de la tanda' : 'Kilos de pan horneado que salen de la tanda') + '</label>' +
    '<input class="txt" id="recRend" data-campo="rendimiento" inputmode="decimal" maxlength="10" autocomplete="off" data-enter="rec-guardar" value="' + esc(r ? cat.enCampo(r.rendimiento) : '') + '">' +
    '<p class="muted" id="recVista" aria-live="polite">' + esc(vista(p, c)) + '</p>' +
    '<label class="lab" for="recDesde">Rige desde</label><input class="txt" type="date" id="recDesde" data-campo="desde" data-enter="rec-guardar" value="' + (primera ? K.INICIO : hoy()) + '">' +
    (primera ? '<p class="muted chico" id="recPrimera">Es la primera receta: por omisión rige desde el ' + esc(fechaTexto(K.INICIO)) + ', así los meses anteriores también tienen costo.</p>' : '') +
    '<label class="lab" for="recNotaC">Nota (opcional)</label><input class="txt" id="recNotaC" maxlength="200" autocomplete="off" data-enter="rec-guardar" placeholder="Levadura: invierno 130 g, verano 100 g" value="' + esc(r && r.nota ? r.nota : '') + '">' +
    '<p class="muted chico">Los días anteriores a esa fecha conservan la receta que tenían.</p>' + pieHoja('rec-guardar', 'Guardar receta', ' data-id="' + esc(p.id) + '"'));
  const f = $('#recCampos input'); if (f) f.focus();
}
function leerForm(p, c) {
  const cantidades = {};
  document.querySelectorAll('#recCampos input[data-ins]').forEach(x => { cantidades[x.dataset.ins] = x.value; });
  return K.validarReceta({ cantidades, rendimiento: $('#recRend').value, desde: $('#recDesde').value, nota: $('#recNotaC').value }, p, K.ordenarInsumos(c.cat.insumos));
}
/* Vista previa mientras se escribe: costo de la tanda y por kg o unidad, con los precios de hoy. */
function vista(p, c) {
  if (!$('#recRend')) return 'Costo: —';
  const v = leerForm(p, c);
  if (v.error) return 'Costo: —';
  const C = K.costoReceta(v.datos, c.cat.insumos, c.cat.preciosInsumo, hoy(), p);
  if (C.unitario == null) return 'Falta el precio de: ' + C.faltan.join(', ') + '.';
  return 'Con los precios de hoy: la tanda cuesta ' + pesos2(C.tanda) + ' → ' + pesos2(C.unitario) + ' ' + por(p) + '.';
}
function guardarReceta(p, c, el) {
  const v = leerForm(p, c);
  if (v.error) { error(v.error, v.campo); return; }
  const d = Object.assign(v.datos, { por: c.user.uid }), guardar = () => enviar(() => nube.guardar('recetas/' + K.idReceta(p.id, d.desde), d), 'Receta de ' + p.nombre + ' desde el ' + fechaTexto(d.desde), el);
  const ya = K.historialReceta(c.cat.recetas, p.id).some(x => x.desde === d.desde);
  if (d.desde >= hoy() || ya || !K.historialReceta(c.cat.recetas, p.id).length) { guardar(); return; }   // la primera receta no cambia nada anterior
  ask({ title: '¿Receta desde una fecha pasada?', text: 'Regirá desde el ' + fechaTexto(d.desde) + ': cambia el costo de ' + p.nombre + ' desde ese día. Los días anteriores no cambian.', ok: 'Guardar receta' }).then(si => { if (si) guardar(); });
}
function quitarReceta(p, c, el) {
  const h = K.historialReceta(c.cat.recetas, p.id), n = h.findIndex(x => x.id === el.dataset.rid);
  if (n < 0) return;
  const x = h[n], previa = h[n + 1];
  ask({ title: '¿Quitar la receta del ' + fechaTexto(x.desde) + '?', text: 'Desde esa fecha ' + (previa ? 'volverá a regir la del ' + fechaTexto(previa.desde) + '.' : p.nombre + ' quedará sin receta (sin costo).') + ' Los días anteriores no cambian.', ok: 'Quitar', danger: true })
    .then(si => { if (si) enviar(() => nube.borrar('recetas/' + x.id), 'Receta quitada', el); });
}

/* ---------- Simulador de precio ---------- */
function hojaSimular(p, c) {
  const C = costoHoy(p, c), precio = precioHoy(p, c);
  if (!C || C.unitario == null) { hojaReceta(p, c); return; }
  const s = K.simular(C.unitario, precio);
  hoja('Simular precio de ' + p.nombre, '<div class="kv"><span>Ingredientes ' + por(p) + ' (hoy)</span><b id="simCosto" data-costo="' + C.unitario + '">' + esc(pesos2(C.unitario)) + '</b></div>' +
    '<div class="kv"><span>Precio neto de hoy</span><b>' + (precio == null ? 'Sin precio' : esc(cat.pesos(precio))) + '</b></div>' +
    (s ? '<div class="kv"><span>Margen de hoy</span><b id="simHoy">' + esc(pesos2(s.margen) + ' · ' + K.pctTexto(s.pct)) + '</b></div>' : '') +
    '<label class="lab" for="simPrecio">Si el precio neto ' + por(p) + ' fuera</label><input class="txt" id="simPrecio" inputmode="decimal" maxlength="12" autocomplete="off" value="' + esc(precio == null ? '' : cat.enCampo(precio)) + '">' +
    '<p class="note" id="simRes1" aria-live="polite">' + esc(textoSim1(C.unitario, precio == null ? '' : cat.enCampo(precio), c)) + '</p>' +
    '<label class="lab" for="simPct">Para ganar este % del precio de venta</label><input class="txt" id="simPct" inputmode="decimal" maxlength="6" autocomplete="off" value="30">' +
    '<p class="note" id="simRes2" aria-live="polite">' + esc(textoSim2(C.unitario, '30', c)) + '</p>' +
    '<p class="muted chico">Margen sobre el precio de venta: (precio − ingredientes) ÷ precio. No incluye los gastos del mes (gas, luz, sueldos…). Nada de esto cambia el precio: para eso, «Cambiar precio» en la ficha del pan.</p>' +
    '<div class="actions"><button class="btn ghost" data-act="cat-prod" data-id="' + esc(p.id) + '">Ficha del pan</button></div>');
  $('#simPrecio').focus();
}
function textoSim1(costo, t, c) {
  const n = cat.numero(t), s = Number.isNaN(n) ? null : K.simular(costo, n);
  return s ? 'Margen: ' + pesos2(s.margen) + ' (' + K.pctTexto(s.pct) + ') · con IVA el precio es ' + conIva(n, c) + '.' : 'Escribe un precio neto para ver el margen.';
}
function textoSim2(costo, t, c) {
  const n = cat.numero(String(t).replace('%', '').trim()), pr = Number.isNaN(n) ? null : K.precioPara(costo, n);
  return pr ? 'Precio neto: ' + pesos2(pr) + ' (' + conIva(pr, c) + ' con IVA).' : 'Escribe un porcentaje menor que 100.';
}

export function alActuar(act, el, c) {
  if (!act.startsWith('rec-')) return false;
  if (!puede(c.perfil, 'gestion') || !c.cat || !listo(c.cat)) return true;
  const p = buscar(c.cat.productos, el.dataset.id);
  if (!p) return true;
  if (act === 'rec-ver') hojaReceta(p, c);
  else if (act === 'rec-form') hojaForm(p, c);
  else if (act === 'rec-guardar') guardarReceta(p, c, el);
  else if (act === 'rec-quitar') quitarReceta(p, c, el);
  else if (act === 'rec-sim') hojaSimular(p, c);
  return true;
}
/* Devuelve true si atendió el campo. */
export function alEscribir(el, c) {
  const b = $('#dlg [data-act="rec-guardar"]'), sim = $('#simCosto');
  if (b && (el.dataset.ins || el.id === 'recRend')) { const p = buscar(c.cat.productos, b.dataset.id), s = $('#recVista'); if (p && s) s.textContent = vista(p, c); return true; }
  if (sim && (el.id === 'simPrecio' || el.id === 'simPct')) {
    const costo = Number(sim.dataset.costo);
    if (el.id === 'simPrecio') $('#simRes1').textContent = textoSim1(costo, el.value, c); else $('#simRes2').textContent = textoSim2(costo, el.value, c);
    return true;
  }
  return false;
}
