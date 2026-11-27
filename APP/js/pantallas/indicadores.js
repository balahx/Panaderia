/* Indicadores (dueños y externo, Fase 7, PLAN §3.8): los nueve indicadores de un mes —venta en pesos por pan, kilos por pan,
   participación, comparación con el mes anterior y con el mismo mes del año anterior, promedio diario, días de la semana más fuertes,
   kilos por trabajador y real contra proyectado (o contra la meta)—. «Año y metas» (pantallas/proyeccion.js) muestra el año mes a mes
   contra el anterior, la proyección con sus factores y las metas.
   Los totales de un mes cerrado son los de su cierre; los de un mes sin cerrar, los de Entregas (pantallas/meses-datos.js).
   Fase 11: indicador «Por cliente» (venta neta y participación de cada cliente, con la variación contra el mes anterior) y el filtro
   «Cliente» (pantallas/filtro-cliente.js): con un cliente elegido, todo el mes es solo suyo; la meta y la proyección son del negocio entero. */
import { esc } from '../core/formato.js';
import { emptyHTML, errorHTML } from '../core/iconos.js';
import * as cat from '../core/catalogo.js';
import * as P from '../core/pesaje.js';
import * as V from '../core/ventas.js';
import * as I from '../core/indicadores.js';
import * as D from './meses-datos.js';
import * as anio from './proyeccion.js';
import * as FC from './filtro-cliente.js';
import { navPeriodo } from './periodo-nav.js';

let mes = '', vista = 'mes';   // mes elegido ('' = el de hoy) · 'mes' | 'anio'
const mesSel = c => (mes && mes <= V.mesDe(c.hoy) ? mes : V.mesDe(c.hoy));
const rangoDe = (m, c) => { const r = V.rangoMes(m); return { desde: r.desde, hasta: r.hasta > c.hoy ? c.hoy : r.hasta }; };
/* Pesajes que se escuchan en vivo: los del mes elegido (o, en «Año y metas», los del mes en curso). */
export const periodo = c => rangoDe(vista === 'mes' ? mesSel(c) : V.mesDe(c.hoy), c);
/* Desde otra pantalla: data-mes abre ese mes; data-vista, la parte. */
export function abrir(ds, c) {
  if (ds.mes && V.esMes(ds.mes)) { mes = ds.mes >= V.mesDe(c.hoy) ? '' : ds.mes; vista = 'mes'; }
  if (ds.vista === 'anio' || ds.vista === 'mes') vista = ds.vista;
  D.olvidar();
}
export const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const kv = (k, v, id) => '<div class="kv"' + (id ? ' id="' + id + '"' : '') + '><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
/* Barra horizontal (SVG con atributos: la política de contenido no admite el atributo style). `f` entre 0 y 1. */
export function barra(f, cls) {
  const w = Math.max(0, Math.min(1, f || 0)) * 100;
  return '<svg class="barra ' + (cls || '') + '" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="barra-fondo" width="100" height="8" rx="2"/>' +
    (w ? '<rect class="barra-valor" width="' + w.toFixed(2) + '" height="8" rx="2"/>' : '') + '</svg>';
}
export const cantidadTexto = R => P.textoTotales({ kg: R.kg, un: R.un });
const flecha = p => (p == null ? '' : '<span class="var ' + (p > 0.05 ? 'sube' : p < -0.05 ? 'baja' : '') + '">' + (p > 0.05 ? '▲ ' : p < -0.05 ? '▼ ' : '') + esc(I.pctTexto(p)) + '</span>');
export const seg = v => '<div class="seg" role="group" aria-label="Qué ver"><button data-act="ind-vista" data-v="mes" aria-pressed="' + (v === 'mes') + '">El mes</button>' +
  '<button data-act="ind-vista" data-v="anio" aria-pressed="' + (v === 'anio') + '">Año y metas</button></div>';

function cabecera(c) {
  const m = mesSel(c), esteMes = m === V.mesDe(c.hoy);
  return '<span class="eyebrow">Indicadores</span><h1>' + esc(cap(V.mesTexto(m))) + '</h1>' + seg('mes') +
    navPeriodo({ act: 'ind-mes', aria: 'Cambiar de mes', volver: 'Este mes', enActual: esteMes,
      campo: '<label class="vh" for="indMes">Ir a otro mes</label><input class="txt" type="month" id="indMes" max="' + V.mesDe(c.hoy) + '" value="' + m + '">' });
}
function fuente(R, c) {
  const t = R.fuente === 'excel' ? 'Mes cerrado desde Excel: totales del cierre. El Excel no trae días ni trabajadores.'
    : R.cerrado ? 'Mes cerrado con los datos de la app: totales del cierre.'
    : R.enCurso ? 'En curso: lo pesado hasta hoy (día ' + Number(c.hoy.slice(8)) + ' de ' + R.diasMes + '), con el precio vigente de cada día.'
    : 'Sin cerrar: lo pesado en la app con el precio vigente de cada día, igual que en Entregas.';
  return '<p class="muted chico" id="indFuente">' + esc(t) + '</p>' +
    (R.cambio ? '<p class="warn-t">Lo anotado en la app ya no suma lo mismo que el cierre: valen los totales del cierre (el detalle por día y por trabajador sale de lo anotado).</p>' : '') +
    (R.sinPrecio ? '<p class="warn-t">' + plural(R.sinPrecio, 'pan vendido', 'panes vendidos') + ' sin precio algún día: no suman pesos.</p>' : '') +
    (R.desdeEquipo ? '<p class="warn-t">Sin conexión: se usa lo guardado en este equipo y puede faltar algo.</p>' : '');
}
function totales(R) {
  const pr = R.promedio;
  return '<div class="stats anchas" id="indTotales"><div class="stat"><b id="indNeto">' + esc(cat.pesos(R.neto)) + '</b><span>neto</span></div>' +
    '<div class="stat"><b>' + esc(P.textoCantidad(R.kg, 'kg').replace(' kg', '')) + '</b><span>kilos</span></div>' +
    (R.un ? '<div class="stat"><b>' + esc(P.textoCantidad(R.un, 'un').replace(' un', '')) + '</b><span>unidades</span></div>' : '') +
    (pr ? '<div class="stat" id="indPromedio"><b>' + esc(cat.pesos(pr.neto)) + '</b><span>' + (pr.por === 'dia-venta' ? 'por día con entregas (' + pr.dias + ')' : 'por día del mes') + '</span></div>' : '') + '</div>';
}
/* Real contra la meta (o la proyección, si el mes no tiene meta fijada). */
function meta(R, av, c, m) {
  const titulo = '<p class="eyebrow">' + (av && av.tipo === 'meta' ? 'Meta' : 'Real contra proyectado') + ' · ' + esc(V.mesTexto(m)) + '</p>';
  if (!av) return '<section class="card sec" id="indMeta">' + titulo + '<p class="muted">Este mes no tiene meta ni proyección (hace falta el mismo mes del año anterior, o escribir la meta).</p>' +
    '<div class="actions"><button class="btn ghost sm" data-act="ind-vista" data-v="anio">Ver «Año y metas»</button></div></section>';
  const nombre = av.tipo === 'meta' ? 'Meta' : 'Proyectado';
  return '<section class="card sec" id="indMeta">' + titulo + kv(nombre, cat.pesos(av.meta)) + kv(R.enCurso ? 'Real hasta hoy' : 'Real', cat.pesos(av.real)) +
    '<div class="avance"><span class="avance-pct" id="indMetaPct">' + esc(I.pctTexto(av.pct, false)) + '</span>' + barra(av.pct / 100, av.pct >= 100 ? 'ok' : '') + '</div>' +
    (R.enCurso ? (av.falta ? '<p class="chico">Faltan <b>' + esc(cat.pesos(av.falta)) + '</b>: ' + esc(cat.pesos(av.porDia)) + ' por día en ' + plural(av.quedan, 'día', 'días') + ' (contando hoy).</p>' : '<p class="chico ok-c">Ya se llegó a lo ' + (av.tipo === 'meta' ? 'pedido' : 'proyectado') + '.</p>') +
      (R.ritmo ? '<p class="muted chico" id="indRitmo">A este ritmo el mes cerraría en ' + esc(cat.pesos(R.ritmo.neto)) + ' (' + esc(I.pctTexto(av.ritmoPct, false)) + ' de lo ' + (av.tipo === 'meta' ? 'pedido' : 'proyectado') + ').</p>' : '')
      : '<p class="chico">' + (av.pct >= 100 ? 'Se cumplió: ' + esc(cat.pesos(av.real - av.meta)) + ' sobre lo ' : 'Faltaron ' + esc(cat.pesos(av.falta)) + ' para lo ') + (av.tipo === 'meta' ? 'pedido.' : 'proyectado.') + '</p>') +
    '</section>';
}
function contra(R, O, etiqueta, sinDatos) {
  const h = '<div class="comp"><h3 class="reg-dia">Contra ' + esc(etiqueta) + '</h3>';
  if (O.fuente === 'cargando') return h + '<p class="muted chico">Cargando…</p></div>';
  if (O.fuente === 'error') return h + '<p class="muted chico">No se pudo leer (' + esc(O.err) + ').</p></div>';
  const base = R.enCurso && R.ritmo ? R.ritmo : R, cmp = I.comparar(base, O);
  if (!cmp) return h + '<p class="muted chico">' + esc(sinDatos) + '</p></div>';
  const fila = (k, a, b, p) => '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(a) + ' <small class="muted">vs ' + esc(b) + '</small> ' + flecha(p) + '</b></div>';
  return h + (R.enCurso && R.ritmo ? '<p class="muted chico">El mes en curso se compara a su ritmo (lo que sumaría completo).</p>' : '') +
    fila('Neto', cat.pesos(cmp.neto.a), cat.pesos(cmp.neto.b), cmp.neto.pct) +
    (R.kg || O.kg ? fila('Kilos', P.textoCantidad(cmp.kg.a, 'kg'), P.textoCantidad(cmp.kg.b, 'kg'), cmp.kg.pct) : '') +
    (R.un || O.un ? fila('Unidades', P.textoCantidad(cmp.un.a, 'un'), P.textoCantidad(cmp.un.b, 'un'), cmp.un.pct) : '') + '</div>';
}
function panes(R, A) {
  const l = I.ranking(R.panes), max = Math.max(1, ...l.map(p => p.neto)), cmp = R.enCurso ? null : I.comparar(R, A);
  return '<section class="sec" id="indPanes"><h2>Por pan</h2><p class="muted chico">Venta neta, participación en el mes y cantidad' + (cmp ? '; la flecha compara con el mes anterior' : '') + '.</p><div class="mlist">' +
    l.map(p => { const o = cmp && cmp.pan(p.productoId);
      return '<div class="mrow fija ind-pan" data-pid="' + esc(p.productoId) + '"><span class="mt"><b>' + esc(p.nombre) + '</b><small>' + esc(P.textoCantidad(p.cantidad, p.unidad)) +
        (o ? ' ' + flecha(I.variacion(p.neto, o.neto)) : '') + '</small>' + barra(p.neto / max) + '</span>' +
        '<span class="precio"><b>' + (p.sinPrecio && !p.neto ? 'Sin precio' : esc(cat.pesos(p.neto))) + '</b><small>' + esc(I.pctTexto(p.pct, false)) + ' del mes</small></span></div>'; }).join('') + '</div></section>';
}
function clientes(R, A) {
  if ((R.clientes || []).length < 2) return '';
  const l = R.clientes.slice().sort((a, b) => b.neto - a.neto), max = Math.max(1, ...l.map(x => x.neto)), cmp = !R.enCurso && A && A.fuente !== 'cargando' && A.fuente !== 'error';
  return '<section class="sec" id="indClientes"><h2>Por cliente</h2><p class="muted chico">Venta neta y participación de cada cliente en el mes' + (cmp ? '; la flecha compara con el mes anterior' : '') + '.</p><div class="mlist">' +
    l.map(x => { const o = cmp && (A.clientes || []).find(y => y.clienteId === x.clienteId);
      return '<div class="mrow fija ind-cli" data-cliente="' + esc(x.clienteId || '') + '"><span class="mt"><b>' + esc(x.cliente || '—') + '</b><small>' + esc(P.textoTotales(x)) +
        (o ? ' ' + flecha(I.variacion(x.neto, o.neto)) : '') + '</small>' + barra(x.neto / max) + '</span>' +
        '<span class="precio"><b>' + esc(cat.pesos(x.neto)) + '</b><small>' + esc(I.pctTexto(x.pct, false)) + ' del mes</small></span></div>'; }).join('') + '</div></section>';
}
function semana(R) {
  if (!R.detalle) return '<section class="sec" id="indSemana"><h2>Días de la semana</h2><p class="muted">Se calcula con lo pesado en la app: un mes importado desde Excel no trae los días.</p></section>';
  const l = R.semana.filter(s => s.veces), max = Math.max(1, ...l.map(s => s.promNeto));
  return '<section class="sec" id="indSemana"><h2>Días de la semana</h2><p class="muted chico">Promedio de venta neta de cada día de la semana con entregas.</p><div class="mlist">' +
    l.map(s => '<div class="mrow fija" data-dia="' + s.dia + '"><span class="mt"><b>' + esc(cap(s.nombre)) + (s.lugar ? ' <span class="badge ok">' + (s.lugar === 1 ? 'Más fuerte' : '2.º') + '</span>' : '') + '</b>' +
      '<small>' + plural(s.veces, 'día', 'días') + ' · ' + esc(P.textoTotales({ kg: s.promKg, un: s.promUn })) + ' por día</small>' + barra(s.promNeto / max) + '</span>' +
      '<span class="precio"><b>' + esc(cat.pesos(s.promNeto)) + '</b><small>por día</small></span></div>').join('') + '</div></section>';
}
function trabajadores(R) {
  if (!R.detalle) return '<section class="sec" id="indTrabajadores"><h2>Kilos por trabajador</h2><p class="muted">Se calcula con lo pesado en la app: un mes importado desde Excel no lo trae.</p></section>';
  const l = R.trabajadores, max = Math.max(0.01, ...l.map(t => t.kg));
  return '<section class="sec" id="indTrabajadores"><h2>Kilos por trabajador</h2><p class="muted chico">Lo que pesó cada uno (canastos no anulados).</p><div class="mlist">' +
    l.map(t => '<div class="mrow fija"><span class="mt"><b>' + esc(t.nombre) + '</b><small>' + plural(t.canastos, 'canasto', 'canastos') + (t.un ? ' · ' + esc(P.textoCantidad(t.un, 'un')) : '') + '</small>' + barra(t.kg / max) + '</span>' +
      '<span class="precio"><b>' + esc(P.textoCantidad(t.kg, 'kg')) + '</b><small>' + esc(I.pctTexto(R.kg ? t.kg / R.kg * 100 : 0, false)) + ' de los kilos</small></span></div>').join('') + '</div></section>';
}

export function html(c) {
  if (vista === 'anio') return anio.html(c);
  const cab = cabecera(c), per = c.per, m = mesSel(c), r = rangoDe(m, c);
  const err = c.errCat || (per && per.err);
  if (err) return cab + errorHTML('No se pudieron leer los datos (' + err + ').', { retry: 'recargar' });
  if (!D.listos(c) || !c.proy || !per || per.desde !== r.desde || !per.pesajes) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const cli = FC.elegido(c), R = D.resumen(c, m, true, cli), A = D.resumen(c, V.sumarMeses(m, -1), false, cli), Y = D.resumen(c, V.sumarMeses(m, -12), false, cli), a = Number(m.slice(0, 4));
  const filtro = FC.selector(c, 'indCliente');
  if (R.fuente === 'sin-datos') return cab + filtro + emptyHTML('prog', 'Sin ventas en ' + V.mesTexto(m), 'Cuando haya canastos pesados o el mes se importe desde Excel, aquí aparecen sus indicadores.') +
    (m < V.mesDe(c.hoy) ? '<div class="actions centro"><button class="btn ghost" data-act="ir" data-tab="cierres">Importar desde Excel</button></div>' : '');
  const Pr = I.leerProyeccion((c.proy || []).find(x => x.id === String(a)), a), av = I.avance(R, I.objetivo(Pr, m, I.proyectarMes(Y, Pr)), c.hoy);
  const anterior = V.mesTexto(V.sumarMeses(m, -12));
  const metaHTML = cli ? '<p class="muted chico" id="indMetaCli">La meta y la proyección son del negocio entero: elige «Todos» para verlas.</p>' : meta(R, av, c, m);
  return cab + filtro + fuente(R, c) + totales(R) + metaHTML +
    '<section class="card sec" id="indComparar"><p class="eyebrow">Comparación</p>' +
    contra(R, A, V.mesTexto(V.sumarMeses(m, -1)), 'Sin datos de ' + V.mesTexto(V.sumarMeses(m, -1)) + '.') +
    contra(R, Y, anterior, 'Sin datos de ' + anterior + '. Si los tienes en Excel, impórtalos en Más → Cierres mensuales.') + '</section>' +
    (cli ? '' : clientes(R, A)) + panes(R, A) + semana(R) + trabajadores(R) +
    '<p class="muted chico">Montos netos (sin IVA). Un mes cerrado usa los totales de su cierre; uno sin cerrar, lo pesado con el precio vigente de cada día (lo mismo que Entregas).</p>';
}

export function alActuar(act, el, c) {
  if (act === 'recargar') { location.reload(); return true; }
  if (act === 'ind-vista') { vista = el.dataset.v === 'anio' ? 'anio' : 'mes'; return 'repintar'; }
  if (vista === 'anio') return anio.alActuar(act, el, c);
  if (act !== 'ind-mes') return false;
  const d = Number(el.dataset.d), m = V.sumarMeses(mesSel(c), d);
  mes = !d || m >= V.mesDe(c.hoy) ? '' : m;   // 0: «Este mes»
  return 'repintar';
}
export function alEscribir(el, c) {
  if (vista === 'anio') return anio.alEscribir(el, c);
  if (FC.alEscribir(el)) return 'repintar';
  if (el.id !== 'indMes' || !V.esMes(el.value)) return;
  mes = el.value >= V.mesDe(c.hoy) ? '' : el.value;
  return 'repintar';
}
/* «Ver el mes» desde «Año y metas». */
export function irAlMes(m, c) { mes = m >= V.mesDe(c.hoy) ? '' : m; vista = 'mes'; }
