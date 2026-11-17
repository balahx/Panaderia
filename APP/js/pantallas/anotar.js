/* Anotar un canasto (o el total de un pan) en un día ya pasado o en el de hoy, desde «Hoy» (dueños y externo; PLAN §3.6).
   Sirve para completar noviembre de 2026 y para lo que no se pesó en la tablet. El día es el que se mira en «Hoy».
   Queda igual que un pesaje de la tablet (creadoPor = esta cuenta); el registro general muestra que se anotó después.
   «Guardar y anotar otro» deja la hoja abierta con el mismo pan, persona, entrega y hora. Sin internet queda en el equipo y se envía solo. */
import { esc, fechaTexto } from '../core/formato.js';
import { $, ask, hoja, cerrarHoja, toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import { rechazo } from './pesaje-hoja.js';

const U = { pan: '', quien: '', entrega: 0, hora: '', fecha: '' };   // lo último elegido (para «anotar otro»)
const opcion = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
function error(msg, campo) {
  const e = $('#dlg[open] .form-error'); if (!e) { toast(msg); return; }
  e.textContent = msg; e.hidden = !msg;
  const c = campo && $('#dlg #' + campo); if (c) c.focus();
}
/* Entregas que se pueden elegir ese día: las que ya tienen canastos y una más (o la en curso, si es hoy). */
function entregas(c, fecha) {
  const pes = c.dia && c.dia.fecha === fecha ? c.dia.pesajes || [] : [];
  const max = pes.reduce((m, p) => Math.max(m, p.entregaN || 1), 0), enCurso = fecha === c.hoy && c.dia && c.dia.fecha === fecha ? P.entregaEnCurso(c.dia.dia) : 0;
  return { hasta: Math.min(P.MAX_ENTREGAS, Math.max(max + 1, enCurso, 1)), defecto: enCurso || max || 1 };
}

export function abrirHoja(c, fecha) {
  const k = c.cat || {}, prods = cat.ordenarProductos(cat.activos(k.productos)), trabs = cat.ordenarPersonas(cat.activos(k.trabajadores));
  if (!prods.length || !trabs.length) { toast('Primero agrega panes y trabajadores en Más → Catálogo.'); return; }
  if (U.fecha !== fecha) { U.fecha = fecha; U.entrega = 0; U.hora = ''; }
  const E = entregas(c, fecha), ent = U.entrega && U.entrega <= E.hasta ? U.entrega : E.defecto;
  const hora = U.hora || (fecha === c.hoy ? P.horaChile(new Date()) : '12:00');
  hoja(fecha === c.hoy ? 'Anotar canasto de hoy' : 'Anotar en fecha pasada',
    '<p class="muted" id="anDia">Día: <b>' + esc(fechaTexto(fecha)) + '</b>. Para otro día, cámbialo en «Hoy» con ‹ ›.</p>' +
    '<label class="lab" for="anPan">Pan</label><select class="txt" id="anPan">' + prods.map(x => opcion(x.id, x.nombre + (x.unidad === 'un' ? ' (unidades)' : ' (kg)'), x.id === U.pan)).join('') + '</select>' +
    '<label class="lab" for="anCant">Cantidad (kilos o unidades, según el pan)</label><input class="txt" id="anCant" inputmode="decimal" maxlength="9" autocomplete="off" data-enter="anotar-guardar">' +
    '<p class="muted chico">Puede ser un canasto o el total del día de ese pan (por ejemplo, desde el cierre del supermercado).</p>' +
    '<label class="lab" for="anQuien">Quién pesó</label><select class="txt" id="anQuien">' + trabs.map(x => opcion(x.id, x.nombre, x.id === U.quien)).join('') + '</select>' +
    '<div class="dos"><div><label class="lab" for="anEntrega">Entrega</label><select class="txt" id="anEntrega">' + Array.from({ length: E.hasta }, (_, i) => opcion(i + 1, 'N.º ' + (i + 1), i + 1 === ent)).join('') + '</select></div>' +
    '<div><label class="lab" for="anHora">Hora</label><input class="txt" type="time" id="anHora" value="' + esc(hora) + '"></div></div>' +
    '<label class="lab" for="anNota">Nota (opcional)</label><input class="txt" id="anNota" maxlength="200" autocomplete="off" data-enter="anotar-guardar">' +
    '<p class="form-error" role="alert" hidden></p><div class="actions"><button class="btn" data-act="anotar-guardar" data-fecha="' + esc(fecha) + '">Guardar</button>' +
    '<button class="btn ghost" data-act="anotar-otro" data-fecha="' + esc(fecha) + '">Guardar y anotar otro</button></div>');
  $('#anCant').focus();
}

function guardar(c, fecha, otro) {
  const prod = (c.cat.productos || []).find(x => x.id === $('#anPan').value); if (!prod) { error('Elige el pan.', 'anPan'); return; }
  const v = P.validarCantidad(String($('#anCant').value).replace(/\s/g, ''), prod.unidad); if (v.error) { error(v.error, 'anCant'); return; }
  const hora = $('#anHora').value; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) { error('Escribe la hora (por ejemplo 07:30).', 'anHora'); return; }
  if (fecha > c.hoy) { error('No se anota en días que aún no llegan.'); return; }
  const quien = $('#anQuien').value, entregaN = Number($('#anEntrega').value) || 1, nota = $('#anNota').value;
  const seguir = () => {
    const p = P.nuevoPesaje({ fecha, hora, entregaN, productoId: prod.id, cantidad: v.cantidad, unidad: prod.unidad, trabajadorId: quien, nota, creadoPor: c.user.uid });
    nube.guardarVarios([{ ruta: 'pesajes/' + cat.nuevoId(), datos: p }]).catch(rechazo('lo anotado'));
    Object.assign(U, { pan: prod.id, quien, entrega: entregaN, hora });
    const cli = cat.clientePrincipal(c.cat.clientes), sin = !cli || !cat.precioVigente(c.cat.precios, prod.id, cli.id, fecha);
    toast('Anotado: ' + prod.nombre + ' ' + P.textoCantidad(v.cantidad, prod.unidad) + (fecha === c.hoy ? '' : ' el ' + fechaTexto(fecha)) + (sin ? ' · sin precio ese día' : '') + (navigator.onLine === false ? ' · se enviará al volver internet' : ''));
    if (!otro) { cerrarHoja(); return; }
    $('#anCant').value = ''; $('#anNota').value = ''; error(''); $('#anCant').focus();
  };
  if (v.confirmar) ask({ title: '¿' + P.textoCantidad(v.cantidad, prod.unidad) + ' de una vez?', text: 'Es mucho para un canasto. Si es el total del día, está bien.', ok: 'Sí, guardar', cancel: 'Revisar' }).then(si => { if (si) seguir(); });
  else seguir();
}

/* Acciones de la hoja (anotar-…). Devuelve true si las atendió. */
export function alActuar(act, el, c) {
  if (!act.startsWith('anotar')) return false;
  if (!c.cat) return true;
  if (act === 'anotar') abrirHoja(c, el.dataset.fecha);
  else if (act === 'anotar-guardar' || act === 'anotar-otro') guardar(c, el.dataset.fecha, act === 'anotar-otro');
  return true;
}
