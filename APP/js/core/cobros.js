/* Cobros (Fase 12). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/cobros-unit.js).
   Un COBRO es un documento interno (no tributario) a un cliente regular por las entregas de un período (semana de lunes a domingo, mes
   calendario u «otras fechas»), desde el 1-nov-2026. El monto sale solo de las líneas de venta del cliente en esas fechas (ventas.lineas:
   el precio vigente de cada día para ese cliente), así el cobro da el mismo neto que Entregas con el filtro de ese cliente.
     Línea del cobro = un pan a un precio (si el precio cambió en el período, una línea por precio): cantidad, precio neto, neto (suma de los
       netos de sus líneas de venta), precio con IVA y monto con IVA (neto × (1 + IVA), al peso).
     neto final = neto − descuento (en neto) · IVA = IVA % × neto final (una vez, como los cierres) · total = neto final + IVA.
     Ajuste por redondeo = total − (suma de los montos con IVA − descuento con IVA): unos pocos pesos.
   El cobro emitido queda fijo (documento): si los canastos cambian después, `comparar` lo nota. Lo abonado y el saldo NO se guardan en el
   cobro: se calculan con los abonos (core/abonos.js). */
import { redondearPesos, numero, enCampo, limpiar, esFecha, pesos } from './catalogo.js';
import * as V from './ventas.js';
import { sumarDias } from './pesaje.js';
import { fechaTexto } from './formato.js';
import * as RUT from './rut.js';

export const INICIO = '2026-11-01';                    // antes solo hay cierres del Excel, sin días
export const MAX_DIAS = 62, MAX_LINEAS = 60, PLAZO = 7, PLAZO_MAX = 90;
export const PERIODOS = { semana: 'Semanal', mes: 'Mensual', otro: 'Otras fechas' };
export const PIE = 'Documento de cobro. No válido como factura.';
export const numeroTexto = n => String(n).padStart(4, '0');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const r2 = n => Math.round(n * 100) / 100;
export const slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';

/* ---------- Períodos ---------- */
const diaSem = f => new Date(f + 'T12:00:00Z').getUTCDay();   // 0 = domingo
/* Semana (lunes a domingo) que contiene una fecha. */
export function semanaDe(f) { const desde = sumarDias(f, -((diaSem(f) + 6) % 7)); return { desde, hasta: sumarDias(desde, 6) }; }
/* Último período terminado del tipo: «Semana pasada» o «Mes pasado». */
export const ultimoTerminado = (tipo, hoy) => (tipo === 'semana' ? semanaDe(sumarDias(semanaDe(hoy).desde, -1)) : V.rangoMes(V.sumarMeses(V.mesDe(hoy), -1)));
const partes = f => { const [a, m, d] = f.split('-').map(Number); return { a, m, d }; };
/* «Semana del 10 al 16 de noviembre de 2026» · «Noviembre de 2026» · «Del 28 de octubre al 3 de noviembre de 2026» */
export function periodoTexto(desde, hasta, tipo) {
  const A = partes(desde), B = partes(hasta), r = V.rangoMes(V.mesDe(desde));
  if (desde === r.desde && hasta === r.hasta) { const t = MESES[A.m - 1] + ' de ' + A.a; return t[0].toUpperCase() + t.slice(1); }
  if (desde === hasta) return 'El ' + A.d + ' de ' + MESES[A.m - 1] + ' de ' + A.a;
  const pre = tipo === 'semana' ? 'Semana del ' : 'Del ';
  if (A.a === B.a && A.m === B.m) return pre + A.d + ' al ' + B.d + ' de ' + MESES[B.m - 1] + ' de ' + B.a;
  if (A.a === B.a) return pre + A.d + ' de ' + MESES[A.m - 1] + ' al ' + B.d + ' de ' + MESES[B.m - 1] + ' de ' + B.a;
  return pre + A.d + ' de ' + MESES[A.m - 1] + ' de ' + A.a + ' al ' + B.d + ' de ' + MESES[B.m - 1] + ' de ' + B.a;
}
export const fechaLarga = f => { const A = partes(f); return A.d + ' de ' + MESES[A.m - 1] + ' de ' + A.a; };
export const fechaCorta = f => { const A = partes(f); return String(A.d).padStart(2, '0') + '-' + String(A.m).padStart(2, '0') + '-' + A.a; };
/* Revisa un período: { desde, hasta, aviso } o { error }. Se puede cobrar un período que no ha terminado (con aviso). */
export function validarPeriodo(desde, hasta, hoy) {
  if (!esFecha(desde) || !esFecha(hasta)) return { error: 'Elige las fechas del cobro.' };
  if (desde > hasta) return { error: 'La fecha «desde» va antes que «hasta».' };
  if (desde < INICIO) return { error: 'Los cobros parten el 1 de noviembre de 2026: antes solo hay cierres del Excel, sin días.' };
  if (desde > hoy) return { error: 'Ese período todavía no empieza.' };
  if (V.diasEntre(desde, hasta) > MAX_DIAS) return { error: 'Un cobro abarca como máximo ' + MAX_DIAS + ' días.' };
  return { desde, hasta, aviso: hasta >= hoy ? 'Ese período todavía no termina: lo que se pese después no entra en este cobro.' : '' };
}

/* ---------- Descuento ---------- */
/* Formulario { tipo: '' | 'pct' | 'monto', valor (texto), texto } → { descuento: null | { tipo, valor, texto } } o { error }.
   pct: porcentaje del neto · monto: pesos CON IVA incluido. */
export function validarDescuento(f) {
  if (!f || !f.tipo) return { descuento: null };
  if (f.tipo !== 'pct' && f.tipo !== 'monto') return { error: 'Elige el tipo de descuento.' };
  const v = numero(f.valor);
  if (f.tipo === 'pct' && (Number.isNaN(v) || v <= 0 || v > 100)) return { error: 'El descuento en % va entre 0 y 100.', campo: 'dValor' };
  if (f.tipo === 'monto' && (Number.isNaN(v) || v < 1 || v > 1e9 || Math.round(v) !== v)) return { error: 'El descuento en pesos va sin decimales (con IVA incluido).', campo: 'dValor' };
  const valor = f.tipo === 'pct' ? r2(v) : v;
  return { descuento: { tipo: f.tipo, valor, texto: limpiar(f.texto, 60) || (f.tipo === 'pct' ? 'Descuento ' + enCampo(valor) + ' %' : 'Descuento') } };
}
export const descuentoNeto = (d, neto, iva) => (!d ? 0 : d.tipo === 'pct' ? redondearPesos(neto * d.valor / 100) : redondearPesos(d.valor / (1 + iva / 100)));
export const textoDescuento = d => (!d ? 'Sin descuento' : d.texto + (d.tipo === 'pct' ? '' : ' (' + pesos(d.valor) + ' con IVA)'));
/* Totales de unas líneas con neto y monto con IVA (cobro o cotización). */
export function totalesDe(lineas, descuento, iva) {
  const neto = lineas.reduce((t, l) => t + l.neto, 0), subtotal = lineas.reduce((t, l) => t + l.monto, 0), dn = descuentoNeto(descuento, neto, iva);
  if (dn > neto) return { error: 'El descuento no puede superar el subtotal.' };
  const dIva = !descuento ? 0 : descuento.tipo === 'monto' ? Math.round(descuento.valor) : redondearPesos(dn * (1 + iva / 100));
  const netoFinal = neto - dn, ivaMonto = V.ivaSobre(netoFinal, iva), total = netoFinal + ivaMonto;
  return { neto, subtotal, descuento: descuento ? Object.assign({}, descuento, { neto: dn, conIva: dIva }) : null, netoFinal, iva, ivaMonto, total, ajuste: total - (subtotal - dIva) };
}
export const lineaConIva = (l, iva) => Object.assign(l, { conIva: r2(l.precio * (1 + iva / 100)), monto: redondearPesos(l.neto * (1 + iva / 100)) });

/* ---------- Armar un cobro ---------- */
/* ls: líneas de venta del cliente en el período (ventas.lineas → deCliente, sin ventas sueltas). o = { iva, descuento, productos }.
   Devuelve { lineas, anexo, faltan, neto, subtotal, descuento, netoFinal, ivaMonto, total, ajuste } (o con `error` si el descuento no cabe). */
export function armar(ls, o) {
  const orden = new Map((o.productos || []).map(p => [p.id, typeof p.orden === 'number' ? p.orden : 1e9])), m = new Map(), dias = new Map();
  for (const l of ls || []) {
    if (!dias.has(l.fecha)) dias.set(l.fecha, { fecha: l.fecha, ent: new Set(), items: new Map() });
    const d = dias.get(l.fecha); d.ent.add(l.entregaN); d.items.set(l.productoId, r2((d.items.get(l.productoId) || 0) + l.cantidad));
    if (l.neto == null) continue;
    const k = l.productoId + '|' + l.precio;
    if (!m.has(k)) m.set(k, { productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, cantidad: 0, precio: l.precio, neto: 0, desde: l.fecha, hasta: l.fecha });
    const x = m.get(k); x.cantidad = l.unidad === 'un' ? x.cantidad + l.cantidad : r2(x.cantidad + l.cantidad); x.neto += l.neto;
    if (l.fecha < x.desde) x.desde = l.fecha; if (l.fecha > x.hasta) x.hasta = l.fecha;
  }
  const lineas = [...m.values()].map(l => lineaConIva(l, o.iva)).sort((a, b) => ((orden.get(a.productoId) || 1e9) - (orden.get(b.productoId) || 1e9)) || a.nombre.localeCompare(b.nombre, 'es') || (a.desde < b.desde ? -1 : 1));
  const anexo = [...dias.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map(d => ({ fecha: d.fecha, entregas: d.ent.size, items: [...d.items].map(([productoId, cantidad]) => ({ productoId, cantidad })) }));
  return Object.assign({ lineas, anexo, faltan: V.faltanPrecios(ls) }, totalesDe(lineas, o.descuento, o.iva));
}
/* «Falta el precio de Marraqueta para Almacén Rosa desde el 3 nov 2026» */
export const faltanTexto = (faltan, cliente) => faltan.map(f => 'Falta el precio de ' + f.nombre + ' para ' + cliente + ' desde el ' + fechaTexto(f.fechas[0])).join(' · ');
/* Lo que impide emitir (o ''): sin entregas, panes sin precio, descuento que no cabe, demasiadas líneas. */
export function bloqueo(a, cliente) {
  if (a.error) return a.error;
  if (a.faltan.length) return faltanTexto(a.faltan, cliente) + '. Ponlo en Catálogo para emitir.';
  if (!a.lineas.length) return 'Ese cliente no tiene entregas en esas fechas: no hay nada que cobrar.';
  if (a.lineas.length > MAX_LINEAS || a.anexo.length > MAX_DIAS) return 'Son demasiadas líneas para un cobro: elige menos días.';
  return '';
}

/* ---------- Otros cobros del cliente ---------- */
/* Cobros no anulados del mismo cliente que ya tocan alguna de esas fechas: [{ numero, desde, hasta }] (lo que se repite). */
export function solape(cobros, clienteId, desde, hasta, excepto) {
  return (cobros || []).filter(c => c.clienteId === clienteId && !c.anulado && c.numero !== excepto && c.desde <= hasta && c.hasta >= desde)
    .sort((a, b) => a.numero - b.numero).map(c => ({ numero: c.numero, desde: c.desde > desde ? c.desde : desde, hasta: c.hasta < hasta ? c.hasta : hasta }));
}
export const solapeTexto = s => s.map(x => 'El cobro N.º ' + numeroTexto(x.numero) + ' ya cubre ' + (x.desde === x.hasta ? 'el ' + fechaTexto(x.desde) : 'del ' + fechaTexto(x.desde) + ' al ' + fechaTexto(x.hasta))).join(' · ');
/* ¿Cambió desde que se emitió? Se arma de nuevo con los canastos de hoy (y el mismo descuento e IVA del cobro). */
export function comparar(cobro, ls) {
  const a = armar(ls, { iva: cobro.iva, descuento: cobro.descuento ? { tipo: cobro.descuento.tipo, valor: cobro.descuento.valor, texto: cobro.descuento.texto } : null });
  const firma = l => l.map(x => x.productoId + '|' + x.precio + '|' + x.cantidad + '|' + x.neto).sort().join(';');
  const igual = !a.faltan.length && !a.error && firma(a.lineas) === firma(cobro.lineas || []) && a.neto === cobro.neto;
  return { igual, ahora: a.error ? null : a.total, dif: a.error ? null : a.total - cobro.total, faltan: a.faltan };
}
export const vence = (fecha, plazo) => sumarDias(fecha, plazo);

/* ---------- Datos de la panadería y del cliente ---------- */
const largo = (v, max) => limpiar(v, max);
const correo = v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
/* config/empresa: razón social y RUT obligatorios; lo demás, si falta, no aparece en el PDF. */
export const CAMPOS_EMPRESA = ['razonSocial', 'rut', 'direccion', 'correo', 'banco', 'tipoCuenta', 'cuenta', 'rutCuenta', 'correoAviso'];
export function validarEmpresa(f) {
  const d = { razonSocial: largo(f.razonSocial, 100), direccion: largo(f.direccion, 150), correo: largo(f.correo, 100), banco: largo(f.banco, 60), tipoCuenta: largo(f.tipoCuenta, 40), cuenta: largo(f.cuenta, 30), correoAviso: largo(f.correoAviso, 100) };
  if (!d.razonSocial) return { error: 'Escribe la razón social de la panadería.', campo: 'razonSocial' };
  const r = RUT.validar(f.rut, true); if (r.error) return { error: r.error, campo: 'rut' };
  const rc = RUT.validar(f.rutCuenta, false); if (rc.error) return { error: 'RUT de la cuenta: ' + rc.error, campo: 'rutCuenta' };
  if (!correo(d.correo)) return { error: 'El correo no se entiende (debe llevar @ y un punto).', campo: 'correo' };
  if (!correo(d.correoAviso)) return { error: 'El correo de aviso no se entiende (debe llevar @ y un punto).', campo: 'correoAviso' };
  return { datos: Object.assign(d, { rut: r.rut, rutCuenta: rc.rut }) };
}
export const empresaLista = e => !!(e && e.razonSocial && e.rut);
/* Lo que falta en los datos de la panadería (la vista previa lo avisa). */
export const faltaEmpresa = e => (!e ? CAMPOS_EMPRESA : CAMPOS_EMPRESA.filter(k => !e[k]));
/* clientesCobro/{clienteId}: datos de cobro del cliente. Todo opcional salvo el período y el plazo. */
export function validarDatosCobro(f) {
  const r = RUT.validar(f.rut, false); if (r.error) return { error: r.error, campo: 'rut' };
  const plazo = Number(String(f.plazo == null ? '' : f.plazo).trim() || PLAZO);
  if (!Number.isInteger(plazo) || plazo < 0 || plazo > PLAZO_MAX) return { error: 'El plazo de pago va en días, de 0 a ' + PLAZO_MAX + '.', campo: 'plazo' };
  if (f.periodo !== 'semana' && f.periodo !== 'mes') return { error: 'Elige si se le cobra por semana o por mes.' };
  const D = validarDescuento(f.descuento); if (D.error) return D;
  return { datos: { razonSocial: largo(f.razonSocial, 100), rut: r.rut, direccion: largo(f.direccion, 150), contacto: largo(f.contacto, 100), periodo: f.periodo, plazo, descuento: D.descuento } };
}
export const datosDe = (lista, clienteId) => (lista || []).find(x => x.id === clienteId) || null;
/* Cliente tal como queda en el cobro (fijo): el nombre de la app y sus datos de cobro de ese momento. */
export const clienteFijo = (cl, dc) => ({ nombre: cl ? cl.nombre : '(sin nombre)', razonSocial: (dc && dc.razonSocial) || '', rut: (dc && dc.rut) || '', direccion: (dc && dc.direccion) || '', contacto: (dc && dc.contacto) || '' });
export const emisorFijo = e => Object.fromEntries(CAMPOS_EMPRESA.map(k => [k, (e && e[k]) || '']));
export const validarFactura = s => limpiar(s, 30);
export function validarPlazo(s) { const p = Number(String(s == null ? '' : s).trim()); return Number.isInteger(p) && p >= 0 && p <= PLAZO_MAX ? { plazo: p } : { error: 'El plazo va en días, de 0 a ' + PLAZO_MAX + '.' }; }

/* ---------- El documento ---------- */
/* cobros/{0001}. o = { numero, clienteId, cliente, emisor, fecha (emisión), desde, hasta, periodo, armado, iva, plazo, factura, reemplaza, por, quien } */
export function documento(o) {
  const a = o.armado;
  return { numero: o.numero, clienteId: o.clienteId, cliente: o.cliente, emisor: o.emisor, fecha: o.fecha, desde: o.desde, hasta: o.hasta, periodo: o.periodo,
    lineas: a.lineas.map(l => ({ productoId: l.productoId, nombre: l.nombre, unidad: l.unidad, cantidad: l.cantidad, precio: l.precio, neto: l.neto, conIva: l.conIva, monto: l.monto, desde: l.desde, hasta: l.hasta })),
    anexo: a.anexo, neto: a.neto, descuento: a.descuento, netoFinal: a.netoFinal, iva: o.iva, ivaMonto: a.ivaMonto, total: a.total, ajuste: a.ajuste,
    plazo: o.plazo, vence: vence(o.fecha, o.plazo), factura: o.factura || null, anulado: null, reemplaza: o.reemplaza || null, por: o.por, quien: limpiar(o.quien, 60) || 'Sin nombre' };
}
export const nombreArchivo = c => 'cobro-' + numeroTexto(c.numero) + '-' + slug(c.cliente && c.cliente.nombre) + '-' + c.desde + '.pdf';
