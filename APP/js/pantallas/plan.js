/* Plan de producción del día (PLAN, Fase 10): cuánto pesar de cada pan (el total del día), comparado al momento con lo pesado.
   · bloqueHoy: el bloque «Plan del día» de Hoy (dueños y externo), con «Armar plan» / «Cambiar plan» y el aviso del plan de mañana.
   · bloqueTablet y lineaPan: el «Plan de hoy» de la tablet (letra grande) y la línea corta del botón de cada pan («faltan 18 kg»).
   · La hoja «Plan»: una fila por pan activo con su campo, la sugerencia (promedio del mismo día de la semana en las 4 semanas
     anteriores, a tandas completas hacia arriba) y las tandas en vivo; «Usar sugerencias», nota y «Quitar plan».
   Se arma solo para hoy o mañana; un día pasado se mira. Los cálculos están en core/plan.js. Nunca muestra precios ni costos. */
import { esc, fechaTexto } from '../core/formato.js';
import { $, ask, hoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as L from '../core/plan.js';
import { recetaVigente } from '../core/costos.js';
import { puede } from '../core/perfil.js';
import { barra } from './indicadores.js';
import { enviar, error, pieHoja } from './catalogo-producto.js';

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const diaSemana = f => DIAS[new Date(f + 'T12:00:00Z').getUTCDay()];
const corta = f => esc(fechaTexto(f).replace(/ \d{4}$/, ''));
const cuando = (f, c) => (f === c.hoy ? 'hoy' : f === P.sumarDias(c.hoy, 1) ? 'mañana' : 'el ' + fechaTexto(f));
const ETIQUETA = { cumplido: '<span class="badge ok">Cumplido</span>', sobre: '<span class="badge warn">Sobre el plan</span>', bajo: '' };
const conTandas = (n, unidad, t) => L.texto(n, unidad) + (t != null ? ' · ' + L.textoTandas(t) : '');

/* ---------- Comparación (Hoy y tablet) ---------- */
function filaAvance(f, grande) {
  return '<div class="plan-f est-' + f.estado + '" data-pan="' + esc(f.productoId) + '"><div class="plan-l"><b>' + esc(f.nombre) + '</b>' + ETIQUETA[f.estado] + '</div>' +
    '<div class="plan-n"><span>Plan <b>' + esc(conTandas(f.plan, f.unidad, f.tandas)) + '</b></span><span>Pesado <b>' + esc(L.texto(f.pesado, f.unidad)) + '</b></span>' +
    '<span class="plan-pct">' + esc(L.pctTexto(f.pct)) + '</span></div>' + barra(f.pct / 100, f.estado === 'cumplido' ? 'ok' : f.estado === 'sobre' ? 'sobre' : '') +
    '<p class="plan-falta' + (grande ? '' : ' chico') + '">' + esc(L.lineaCorta(f)) + '</p></div>';
}
function cuerpoAvance(A, grande) {
  const T = A.totales;
  return '<div class="plan-lista">' + A.filas.map(f => filaAvance(f, grande)).join('') + '</div>' +
    (A.fuera.length ? '<p class="eyebrow plan-fuera-t">Fuera del plan</p><div class="mlist pes-tot" id="planFuera">' + A.fuera.map(x => '<div class="kv"><span>' + esc(x.nombre) + '</span><b>' + esc(L.texto(x.pesado, x.unidad)) + '</b></div>').join('') + '</div>' : '') +
    '<div class="mlist pes-tot plan-tot" id="planTotales"><div class="kv"><span>Planificado</span><b>' + esc(L.textoTotales(T.plan)) + '</b></div>' +
    '<div class="kv"><span>Pesado del plan</span><b>' + esc(L.textoTotales(T.pesado)) + '</b></div>' +
    (A.fuera.length ? '<div class="kv"><span>Pesado fuera del plan</span><b>' + esc(L.textoTotales(T.fuera)) + '</b></div>' : '') + '</div>';
}
/* Bloque de Hoy para el día que se mira (f). d = ctx.dia de ese día. Un día pasado sin plan no muestra nada. */
export function bloqueHoy(c, f, d) {
  if (!d || d.plan === undefined) return '';
  const edita = L.editable(f, c.hoy), A = L.avance(d.plan, d.pesajes, c.cat.productos), man = f === c.hoy ? manana(c, d) : '';
  if (!A && !edita) return '';
  const boton = edita ? '<button class="btn ghost sm" id="planArmar" data-act="plan-armar" data-fecha="' + f + '">' + (A ? 'Cambiar plan' : 'Armar plan') + '</button>' : '';
  if (!A) return '<section class="card sec plan" id="hoyPlan"><div class="plan-h"><h2>Plan del día</h2>' + boton + '</div><p class="muted" id="planSin">Sin plan para ' + esc(cuando(f, c)) + '. Arma uno para comparar lo pesado con lo que se quiere hacer.</p>' + man + '</section>';
  return '<section class="card sec plan" id="hoyPlan"><div class="plan-h"><h2>Plan del día</h2>' + boton + '</div>' + cuerpoAvance(A, false) +
    (d.plan.nota ? '<p class="muted chico" id="planNota">Nota: ' + esc(d.plan.nota) + '</p>' : '') +
    '<p class="muted chico">' + (edita ? '' : 'Ese día ya pasó: el plan solo se mira. ') + 'Armado por ' + esc(d.plan.quien || 'Sin nombre') + '. Verde desde 95 %; sobre 110 %, aviso.</p>' + man + '</section>';
}
function manana(c, d) {
  const f = P.sumarDias(c.hoy, 1);
  if (d.planManana === undefined) return '';
  const p = d.planManana, n = p && p.items ? p.items.length : 0;
  return '<div class="plan-man" id="planManana"><span>Plan de mañana (' + corta(f) + '): <b>' + (n ? n + (n === 1 ? ' pan' : ' panes') : 'sin plan') + '</b></span>' +
    '<button class="btn ghost sm" data-act="plan-armar" data-fecha="' + f + '">' + (n ? 'Ver o cambiar' : 'Armar') + '</button></div>';
}
/* Tablet (y la pestaña Pesaje de gestión): el plan de hoy con tandas, lo pesado y lo que falta. Sin plan, nada. */
export function bloqueTablet(c) {
  const d = c.dia && c.dia.fecha === c.hoy ? c.dia : null, A = d ? L.avance(d.plan, d.pesajes, c.cat.productos) : null;
  if (!A) return '';
  return '<section class="sec plan pes-plan" id="pesPlan"><h2>Plan de hoy</h2>' + cuerpoAvance(A, true) + (d.plan.nota ? '<p class="muted" id="pesPlanNota">Nota: ' + esc(d.plan.nota) + '</p>' : '') + '</section>';
}
/* Línea corta del botón de un pan en la tablet: { texto, estado } o null si el pan no está en el plan de hoy (o no hay plan). */
export function lineaPan(c, productoId) {
  const d = c.dia && c.dia.fecha === c.hoy ? c.dia : null, A = d ? L.avance(d.plan, d.pesajes, c.cat.productos) : null;
  const f = A && A.filas.find(x => x.productoId === productoId);
  return f ? { texto: L.lineaCorta(f), estado: f.estado } : null;
}

/* ---------- Hoja «Plan» ---------- */
let sug = null;   // { fecha, lista, cache, err, t } sugerencias del último día abierto (se reusan 10 minutos)
const planDe = (f, c) => (c.dia && c.dia.fecha === c.hoy ? (f === c.hoy ? c.dia.plan : c.dia.planManana) : undefined);
function infoPan(p, valor, c, fecha) {
  const n = L.cantidad(valor, p.unidad), r = L.tandas(n, rend(c, p.id, fecha)), s = sug && sug.fecha === fecha && sug.lista ? sug.lista.find(x => x.productoId === p.id) : null;
  const ahora = n === null ? '' : Number.isNaN(n) ? 'No se entiende la cantidad.' : r != null ? '= ' + L.textoTandas(r) : 'Sin receta: sin tandas.';
  const su = !s ? '' : s.sugerida == null ? 'Sin sugerencia' : 'Sugerido: ' + conTandas(s.sugerida, s.unidad, s.tandas) + ' (promedio de ' + s.dias + (s.dias === 1 ? ' día: ' : ' días: ') + L.texto(s.promedio, s.unidad) + ')';
  return [ahora, su].filter(Boolean).join(' · ');
}
const rend = (c, id, fecha) => { const r = recetaVigente(c.cat.recetas, id, fecha); return r ? r.rendimiento : null; };
function hojaPlan(fecha, c) {
  const plan = planDe(fecha, c), panes = L.panesDelForm(c.cat.productos, plan), valor = id => { const x = plan && plan.items && plan.items.find(i => i.productoId === id); return x ? L.enCampo(x.cantidad, x.unidad) : ''; };
  if (!panes.length) { hoja('Plan', '<p class="note warn">Primero agrega los panes en Más → Catálogo.</p>'); return; }
  const ds = ' data-fecha="' + fecha + '"';
  hoja('Plan de ' + cuando(fecha, c) + (fecha === c.hoy ? '' : ' · ' + fechaTexto(fecha).replace(/ \d{4}$/, '')), '<p class="muted chico">Cuánto pesar de cada pan en el día (todas las entregas juntas). En blanco, ese pan no va en el plan.</p>' +
    '<p class="note" id="plSug" aria-live="polite">' + esc(textoSug(fecha)) + '</p>' +
    '<div class="actions"><button class="btn ghost" id="plUsar" data-act="plan-sugerir" aria-describedby="plSug"' + ds + (sug && sug.fecha === fecha && sug.lista ? '' : ' disabled') + '>Usar sugerencias</button></div>' +
    '<div id="plCampos">' + panes.map(p => '<div class="plan-campo"><label class="lab" for="pl-' + esc(p.id) + '">' + esc(p.nombre) + ' <span class="muted">(' + (p.unidad === 'un' ? 'unidades' : 'kilos') + ')</span></label>' +
      '<input class="txt" id="pl-' + esc(p.id) + '" data-campo="pl-' + esc(p.id) + '" data-pan="' + esc(p.id) + '" inputmode="' + (p.unidad === 'un' ? 'numeric' : 'decimal') + '" maxlength="10" autocomplete="off" data-enter="plan-guardar" value="' + esc(valor(p.id)) + '">' +
      '<p class="muted chico plan-info" id="plI-' + esc(p.id) + '" aria-live="polite">' + esc(infoPan(p, valor(p.id), c, fecha)) + '</p></div>').join('') + '</div>' +
    '<label class="lab" for="plNota">Nota (opcional)</label><input class="txt" id="plNota" maxlength="200" autocomplete="off" data-enter="plan-guardar" placeholder="Viernes: más hallulla" value="' + esc(plan && plan.nota ? plan.nota : '') + '">' +
    '<p class="muted chico">Las tandas salen de la receta vigente ese día (Más → Costos y margen) y quedan guardadas en el plan.</p>' +
    pieHoja('plan-guardar', 'Guardar plan', ds) + (plan ? '<div class="actions"><button class="btn ghost danger" data-act="plan-quitar"' + ds + '>Quitar plan</button></div>' : ''));
  cargarSugerencias(fecha, c);
}
function textoSug(fecha) {
  if (!sug || sug.fecha !== fecha || (!sug.lista && !sug.err)) return 'Calculando sugerencias con los 4 ' + diaSemana(fecha) + ' anteriores…';
  if (sug.err) return 'No se pudieron leer los días anteriores (' + sug.err + '): escribe las cantidades a mano.';
  const n = sug.lista.length ? sug.lista[0].dias : 0;
  if (!n) return 'Ninguno de los 4 ' + diaSemana(fecha) + ' anteriores tuvo pesajes: no hay sugerencia.';
  return 'Sugerencia: promedio de ' + n + (n === 1 ? ' ' + diaSemana(fecha).replace(/s$/, '') : ' ' + diaSemana(fecha)) + ' con pesajes (de los 4 anteriores), a tandas completas hacia arriba.' + (sug.cache ? ' Sin conexión: con lo guardado en este equipo.' : '');
}
/* Lee los 4 días de muestra (una consulta por fecha) y pone la sugerencia en la hoja abierta, sin tocar lo ya escrito. */
function cargarSugerencias(fecha, c) {
  if (sug && sug.fecha === fecha && sug.lista && Date.now() - sug.t < 600000) { sug.lista = L.sugerencias(sug.muestras, c.cat.productos, c.cat.recetas, fecha); pintarSug(fecha, c); return; }
  const k = sug = { fecha, lista: null, cache: false, err: '', t: Date.now() }, dias = L.fechasMuestra(fecha);
  Promise.all(dias.map(f => nube.consultarRango('pesajes', 'fecha', f, f))).then(r => {
    if (sug !== k) return;
    k.muestras = r.map((x, i) => ({ fecha: dias[i], pesajes: x.filas })); k.cache = r.some(x => x.cache);
    k.lista = L.sugerencias(k.muestras, c.cat.productos, c.cat.recetas, fecha); pintarSug(fecha, c);
  }, e => { if (sug !== k) return; k.err = String(e && (e.code || e.message) || 'error'); sug = null; pintarSug(fecha, c, k.err); });
}
function pintarSug(fecha, c, err) {
  if (!$('#dlg[open] [data-act="plan-guardar"][data-fecha="' + fecha + '"]')) return;
  $('#plSug').textContent = err ? 'No se pudieron leer los días anteriores (' + err + '): escribe las cantidades a mano.' : textoSug(fecha);
  const b = $('#plUsar'); if (b) b.disabled = !!err || !(sug && sug.lista && sug.lista.some(s => s.sugerida != null));
  document.querySelectorAll('#plCampos input[data-pan]').forEach(x => { const p = (c.cat.productos || []).find(y => y.id === x.dataset.pan), i = $('#plI-' + CSS.escape(x.dataset.pan)); if (p && i) i.textContent = infoPan(p, x.value, c, fecha); });
}
function leer() { const r = {}; document.querySelectorAll('#plCampos input[data-pan]').forEach(x => { r[x.dataset.pan] = x.value; }); return r; }
function guardar(fecha, c, el) {
  if (!L.editable(fecha, c.hoy)) { error('Ese día ya pasó: el plan solo se mira.'); return; }
  const v = L.validar({ cantidades: leer(), nota: $('#plNota') ? $('#plNota').value : '' }, L.panesDelForm(c.cat.productos, planDe(fecha, c)), c.cat.recetas, fecha);
  if (v.error) { error(v.error, v.campo); return; }
  enviar(() => nube.guardar('planes/' + fecha, L.documento(v.datos, c.user.uid, c.user.nombre)), 'Plan de ' + cuando(fecha, c) + ' guardado: ' + v.datos.items.length + (v.datos.items.length === 1 ? ' pan' : ' panes'), el);
}
function quitar(fecha, c, el) {
  if (!L.editable(fecha, c.hoy)) return;
  ask({ title: '¿Quitar el plan de ' + cuando(fecha, c) + '?', text: 'Lo pesado no cambia; solo deja de compararse con un plan.', ok: 'Quitar plan', danger: true })
    .then(si => { if (si) enviar(() => nube.borrar('planes/' + fecha), 'Plan quitado', el); });
}

export function alActuar(act, el, c) {
  if (!act.startsWith('plan-')) return false;
  if (!puede(c.perfil, 'gestion') || !c.cat || !c.cat.productos || !c.cat.recetas) return true;
  const fecha = el.dataset.fecha;
  if (!cat.esFecha(fecha) || !L.editable(fecha, c.hoy)) { toast('Ese día ya pasó: el plan solo se mira.'); return true; }
  if (act === 'plan-armar') hojaPlan(fecha, c);
  else if (act === 'plan-guardar') guardar(fecha, c, el);
  else if (act === 'plan-quitar') quitar(fecha, c, el);
  else if (act === 'plan-sugerir' && sug && sug.fecha === fecha && sug.lista) {
    const nuevos = L.usarSugerencias(leer(), sug.lista), ids = Object.keys(nuevos);
    ids.forEach(id => { const x = $('#pl-' + CSS.escape(id)); if (x) x.value = nuevos[id]; });
    pintarSug(fecha, c);
    toast(ids.length ? 'Sugerencia puesta en ' + ids.length + (ids.length === 1 ? ' pan' : ' panes') + '. Revisa antes de guardar.' : 'Los campos ya tienen cantidades: no se cambió nada.');
  }
  return true;
}
/* Mientras se escribe una cantidad: las tandas en vivo. Devuelve true si atendió el campo. */
export function alEscribir(el, c) {
  const b = $('#dlg[open] [data-act="plan-guardar"]');
  if (!b || !el.dataset || !el.dataset.pan) return false;
  const p = (c.cat.productos || []).find(y => y.id === el.dataset.pan), i = $('#plI-' + CSS.escape(el.dataset.pan));
  if (p && i) i.textContent = infoPan(p, el.value, c, b.dataset.fecha);
  return true;
}
