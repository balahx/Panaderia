/* Diseño común de los documentos en PDF (Fase 12): el cobro, la cotización y el estado de cuenta. Hoja carta, encabezado con la hogaza,
   «Panadería» y los datos de la panadería; recuadro del número y las fechas; datos del cliente; tabla con los montos alineados a la derecha;
   totales; pie con «Página X de Y». Lógica pura sobre core/pdf.js (devuelve bytes): se prueba con Node (tests/pdf-unit.js).
   El cobro y la cotización traen los datos de la panadería y del cliente de cuando se emitieron (quedan fijos); lo abonado y el saldo
   se calculan al descargar (`info`), con los abonos de ese momento («Estado al …»). */
import * as P from './pdf.js';
import { clp, kilos } from './formato.js';
import { pesos } from './catalogo.js';
import { numeroTexto, periodoTexto, fechaCorta, PIE, textoDescuento } from './cobros.js';
import { MEDIOS } from './abonos.js';

const TINTA = '#3B2A1E', SUAVE = '#6E5A48', ORO = '#9A5B13', FONDO = '#F3E6D3', RAYA = '#D9C7AE', BLANCO = '#FFFFFF';
const IZ = 48, DE = 564, ANCHO = DE - IZ, LIM = 728;   // márgenes y dónde termina el cuerpo (el pie va debajo)
/* La hogaza del ícono de la app (24 × 24), en curvas. */
const HOGAZA = [['M', 4.5, 10.5], ['C', 4.5, 7.5, 7.6, 5.5, 12, 5.5], ['C', 16.4, 5.5, 19.5, 7.5, 19.5, 10.5], ['C', 19.5, 11.8, 18.7, 12.7, 17.7, 13.1], ['L', 17.7, 18],
  ['C', 17.7, 18.83, 17.03, 19.5, 16.2, 19.5], ['L', 7.8, 19.5], ['C', 6.97, 19.5, 6.3, 18.83, 6.3, 18], ['L', 6.3, 13.1], ['C', 5.3, 12.7, 4.5, 11.8, 4.5, 10.5], ['Z']];
const CORTES = [[['M', 9.3, 9.2], ['L', 10.8, 11.4]], [['M', 12.9, 8.7], ['L', 14.4, 10.9]]];
const cant = (n, u) => (u === 'un' ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' un' : kilos(n) + ' kg');
const por = u => (u === 'un' ? 'c/u' : 'el kg');

/* Hoja de trabajo: lleva el cursor (y) y abre páginas nuevas con el encabezado corto cuando no cabe lo que viene. */
function lienzo(meta, enc) {
  const doc = P.nuevo(meta), L = { doc, p: null, y: 0, n: 0 };
  L.nueva = () => { L.p = doc.pagina(); L.n++; L.y = enc(L.p, L.n === 1); return L; };
  L.cabe = h => { if (L.y + h > LIM) L.nueva(); return L; };
  return L.nueva();
}
function pie(L, texto) {
  const n = L.doc.paginas.length;
  L.doc.paginas.forEach((p, i) => { p.linea(IZ, 742, DE, 742, { color: RAYA }); p.texto(IZ, 756, texto, { tam: 8, color: SUAVE }); p.texto(DE, 756, 'Página ' + (i + 1) + ' de ' + n, { tam: 8, color: SUAVE, alinear: 'der' }); });
}
/* Encabezado: la hogaza, «Panadería» y los datos de la panadería; a la derecha el recuadro con el título, el número y las fechas. */
function encabezado(e, titulo, filas) {
  return (p, primera) => {
    if (!primera) {
      p.trazo(HOGAZA, IZ, 30, 0.9, { relleno: FONDO, borde: ORO, grosor: 1 });
      p.texto(IZ + 26, 47, 'Panadería · ' + titulo + ' (continuación)', { tam: 10, negrita: true, color: TINTA });
      p.linea(IZ, 58, DE, 58, { color: RAYA }); return 76;
    }
    p.trazo(HOGAZA, IZ - 4, 30, 2, { relleno: FONDO, borde: ORO, grosor: 1.6 }); CORTES.forEach(c => p.trazo(c, IZ - 4, 30, 2, { borde: ORO, grosor: 1.6 }));
    p.texto(IZ + 46, 62, 'Panadería', { tam: 22, negrita: true, color: TINTA });
    let y = 80; const dato = (t, o) => { if (!t) return; p.texto(IZ + 46, y, P.cortar(t, 270, 9, o && o.negrita), Object.assign({ tam: 9, color: o && o.negrita ? TINTA : SUAVE }, o)); y += 12; };
    dato(e.razonSocial, { negrita: true }); dato(e.rut ? 'RUT ' + e.rut : ''); dato(e.direccion); dato(e.correo);
    const bx = 372, bw = DE - bx, bh = 30 + filas.length * 14;
    p.rect(bx, 34, bw, bh, { relleno: FONDO, borde: RAYA });
    p.texto(bx + bw / 2, 54, titulo.toUpperCase(), { tam: 13, negrita: true, color: TINTA, alinear: 'centro' });
    filas.forEach((f, i) => { p.texto(bx + 12, 74 + i * 14, f[0], { tam: 9, color: SUAVE }); p.texto(DE - 12, 74 + i * 14, f[1], { tam: 9, negrita: true, color: TINTA, alinear: 'der' }); });
    return Math.max(y, 34 + bh) + 18;
  };
}
/* Recuadro de datos (cliente, para quién): título y líneas. */
function recuadro(L, titulo, lineas) {
  const ls = lineas.filter(x => x && x[1]); L.cabe(24 + ls.length * 13);
  const y0 = L.y; L.p.texto(IZ, y0, titulo, { tam: 8, negrita: true, color: ORO });
  let y = y0 + 14; ls.forEach(x => { L.p.texto(IZ, y, P.cortar(x[1], ANCHO, x[0] ? 10 : 9, x[0]), { tam: x[0] ? 10.5 : 9, negrita: x[0], color: x[0] ? TINTA : SUAVE }); y += 13; });
  L.y = y + 8;
}
/* Tabla: cols = [{ t, x (borde derecho si der), der }]. filas = [[textos]]. */
function tabla(L, cols, filas, o) {
  o = o || {};
  const cab = () => { L.p.rect(IZ, L.y, ANCHO, 18, { relleno: FONDO }); cols.forEach(c => L.p.texto(c.der ? c.x - 6 : c.x + 6, L.y + 12.5, c.t, { tam: 8.5, negrita: true, color: TINTA, alinear: c.der ? 'der' : 'izq' })); L.y += 18; };
  L.cabe(40); cab();
  filas.forEach(f => {
    const alto = o.alto ? o.alto(f) : 16;
    if (L.y + alto > LIM) { L.nueva(); cab(); }
    cols.forEach((c, i) => { const v = f[i]; if (v == null || v === '') return; const ls = Array.isArray(v) ? v : [v]; ls.forEach((t, k) => L.p.texto(c.der ? c.x - 6 : c.x + 6, L.y + 11 + k * 11, t, { tam: 9, color: TINTA, alinear: c.der ? 'der' : 'izq', negrita: !!(f.negrita && i === 0) })); });
    L.y += alto; L.p.linea(IZ, L.y, DE, L.y, { color: RAYA, grosor: 0.5 });
  });
  L.y += 10;
}
/* Filas de totales a la derecha: [texto, monto, { fuerte }]. */
function totales(L, filas) {
  filas = filas.filter(Boolean); L.cabe(filas.length * 15 + 10);
  filas.forEach(f => {
    const fuerte = f[2] && f[2].fuerte, tam = fuerte ? 11.5 : 9.5;
    if (fuerte) { L.p.rect(332, L.y - 2, DE - 332, 19, { relleno: FONDO }); }
    L.p.texto(342, L.y + 11, f[0], { tam, negrita: fuerte, color: TINTA }); L.p.texto(DE - 8, L.y + 11, f[1], { tam, negrita: fuerte, color: TINTA, alinear: 'der' });
    L.y += fuerte ? 21 : 15;
  });
  L.y += 6;
}
function parrafo(L, t, o) { o = o || {}; const tam = o.tam || 9, ls = P.ajustar(t, o.ancho || ANCHO, tam, o.negrita); L.cabe(ls.length * (tam + 3) + 4); ls.forEach(x => { L.p.texto(o.x || IZ, L.y + tam, x, { tam, negrita: o.negrita, color: o.color || TINTA }); L.y += tam + 3; }); L.y += 4; }
function titulo(L, t) { L.cabe(34); L.y += 6; L.p.texto(IZ, L.y + 10, t, { tam: 10.5, negrita: true, color: ORO }); L.y += 18; }
const desglose = (neto, iva, ivaMonto, total) => 'Neto ' + clp(neto) + ' · IVA ' + String(iva).replace('.', ',') + ' % ' + clp(ivaMonto) + ' · Total ' + clp(total);
function transferir(L, e) {
  const l = [e.banco && 'Banco: ' + e.banco, (e.tipoCuenta || e.cuenta) && [e.tipoCuenta, e.cuenta ? 'n.º ' + e.cuenta : ''].filter(Boolean).join(' '), e.rutCuenta && 'RUT: ' + e.rutCuenta,
    e.razonSocial && 'A nombre de: ' + e.razonSocial, e.correoAviso && 'Aviso del pago a: ' + e.correoAviso].filter(Boolean);
  if (!e.banco && !e.cuenta) return;
  titulo(L, 'Datos para transferir'); l.forEach(t => parrafo(L, t, { tam: 9 }));
}
const clienteLineas = c => [[true, c.razonSocial || c.nombre], [false, c.razonSocial && c.razonSocial !== c.nombre ? c.nombre : ''], [false, c.rut ? 'RUT ' + c.rut : ''], [false, c.direccion], [false, c.contacto]];

/* ---------- Cobro ---------- */
/* c = cobros/{n} · info = { hoy, estado (core/abonos.js, estado), pendientes: [{ numero, desde, hasta, periodo, saldo }] } */
export function cobro(c, info) {
  info = info || {};
  const n = numeroTexto(c.numero), e = c.emisor || {}, est = info.estado || null;
  const L = lienzo({ titulo: 'Cobro N.º ' + n, fecha: info.ahora }, encabezado(e, 'Cobro N.º ' + n, [['Emisión', fechaCorta(c.fecha)], ['Vence', fechaCorta(c.vence)]].concat(c.factura ? [['Factura SII', c.factura]] : [])));
  if (c.anulado) { L.p.rect(IZ, L.y - 6, ANCHO, 22, { relleno: '#F6D5CF' }); L.p.texto(IZ + 8, L.y + 9, 'ANULADO: ' + P.cortar(c.anulado.motivo || '', 420, 9.5, true), { tam: 9.5, negrita: true, color: '#7A1F12' }); L.y += 26; }
  recuadro(L, 'CLIENTE', clienteLineas(c.cliente || {}));
  parrafo(L, 'Período: ' + periodoTexto(c.desde, c.hasta, c.periodo) + (c.reemplaza ? ' · Reemplaza al cobro N.º ' + numeroTexto(c.reemplaza) : ''), { negrita: true, tam: 10 });
  const dos = new Set(c.lineas.filter((l, i) => c.lineas.findIndex(x => x.productoId === l.productoId) !== i).map(l => l.productoId));
  const nombre = l => (dos.has(l.productoId) ? l.nombre + ' (' + (l.desde === l.hasta ? fechaCorta(l.desde).slice(0, 5) : fechaCorta(l.desde).slice(0, 5) + ' al ' + fechaCorta(l.hasta).slice(0, 5)) + ')' : l.nombre);
  tabla(L, [{ t: 'Pan', x: IZ }, { t: 'Cantidad', x: 352, der: true }, { t: 'Precio con IVA', x: 462, der: true }, { t: 'Monto con IVA', x: DE, der: true }],
    c.lineas.map(l => [P.cortar(nombre(l), 220, 9), cant(l.cantidad, l.unidad), pesos(l.conIva) + ' ' + por(l.unidad), clp(l.monto)]));
  const sub = c.lineas.reduce((t, l) => t + l.monto, 0), d = c.descuento;
  totales(L, [['Subtotal', clp(sub)], d ? [P.cortar(d.texto, 150, 9.5), '-' + clp(d.conIva)] : null, c.ajuste ? ['Ajuste por redondeo', clp(c.ajuste)] : null, ['Total del cobro', clp(c.total), { fuerte: true }]]);
  parrafo(L, desglose(c.netoFinal, c.iva, c.ivaMonto, c.total), { tam: 8.5, color: SUAVE, x: 342, ancho: DE - 342 });
  if (est && !c.anulado && est.abonado > 0) {
    totales(L, [est.previo ? ['Saldo a favor anterior', '-' + clp(est.previo)] : null, est.abonado - est.previo > 0 ? ['Abonado', '-' + clp(est.abonado - est.previo)] : null, ['Saldo de este cobro', clp(est.saldo), { fuerte: true }]]);
    parrafo(L, 'Estado al ' + fechaCorta(info.hoy) + (est.saldo === 0 && est.pagadoEl ? ' · Pagado el ' + fechaCorta(est.pagadoEl) : ''), { tam: 8.5, color: SUAVE, x: 342, ancho: DE - 342 });
  }
  const pend = (info.pendientes || []).filter(x => x.numero !== c.numero);
  if (pend.length && !c.anulado) {
    titulo(L, 'Cobros anteriores pendientes');
    tabla(L, [{ t: 'N.º', x: IZ }, { t: 'Período', x: 100 }, { t: 'Saldo', x: DE, der: true }], pend.map(x => [numeroTexto(x.numero), P.cortar(periodoTexto(x.desde, x.hasta, x.periodo), 330, 9), clp(x.saldo)]));
    const saldo = est ? est.saldo : c.total;
    totales(L, [['Total adeudado', clp(saldo + pend.reduce((t, x) => t + x.saldo, 0)), { fuerte: true }]]);
  }
  transferir(L, e);
  parrafo(L, 'Plazo de pago: ' + c.plazo + (c.plazo === 1 ? ' día' : ' días') + ' (vence el ' + fechaCorta(c.vence) + ').' + (c.factura ? ' Factura SII n.º ' + c.factura + '.' : ''), { tam: 9 });
  /* Anexo por día, sin montos en dinero, en las páginas siguientes. */
  if ((c.anexo || []).length) {
    L.nueva(); titulo(L, 'Anexo · detalle por día (sin montos)');
    const nom = new Map(c.lineas.map(l => [l.productoId, l]));
    const filas = c.anexo.map(d => [fechaCorta(d.fecha), String(d.entregas), P.ajustar(d.items.map(i => { const l = nom.get(i.productoId) || {}; return (l.nombre || 'Pan') + ' ' + cant(i.cantidad, l.unidad); }).join(' · '), 380, 9)]);
    tabla(L, [{ t: 'Día', x: IZ }, { t: 'Entregas', x: 160, der: true }, { t: 'Panes y cantidades', x: 172 }], filas, { alto: f => 6 + f[2].length * 11 });
  }
  pie(L, PIE);
  return L.doc.bytes();
}

/* ---------- Cotización ---------- */
export function cotizacion(q) {
  const n = numeroTexto(q.numero), e = q.emisor || {}, porT = q.cantidadesPor === 'mes' ? 'por mes' : 'por semana';
  const L = lienzo({ titulo: 'Cotización N.º ' + n }, encabezado(e, 'Cotización N.º ' + n, [['Fecha', fechaCorta(q.fecha)], ['Válida hasta', fechaCorta(q.validaHasta)]]));
  recuadro(L, 'PARA', clienteLineas(Object.assign({}, q.para, { razonSocial: q.para.razonSocial || '' })));
  const conCant = q.lineas.some(l => l.cantidad != null);
  tabla(L, [{ t: 'Pan', x: IZ }, { t: 'Precio con IVA', x: conCant ? 330 : DE, der: true }].concat(conCant ? [{ t: 'Cantidad ' + porT, x: 450, der: true }, { t: 'Monto estimado', x: DE, der: true }] : []),
    q.lineas.map(l => [P.cortar(l.nombre, conCant ? 170 : 330, 9), pesos(l.conIva) + ' ' + por(l.unidad)].concat(conCant ? [l.cantidad == null ? '—' : cant(l.cantidad, l.unidad), l.monto == null ? '—' : clp(l.monto)] : [])));
  if (q.total != null) {
    const d = q.descuento;
    totales(L, [['Subtotal estimado', clp(q.lineas.reduce((t, l) => t + (l.monto || 0), 0))], d ? [P.cortar(d.texto, 150, 9.5), '-' + clp(d.conIva)] : null, q.ajuste ? ['Ajuste por redondeo', clp(q.ajuste)] : null, ['Total estimado ' + porT, clp(q.total), { fuerte: true }]]);
    parrafo(L, desglose(q.netoFinal, q.iva, q.ivaMonto, q.total), { tam: 8.5, color: SUAVE, x: 342, ancho: DE - 342 });
  } else if (q.descuento) parrafo(L, 'Descuento: ' + textoDescuento(q.descuento) + '.', { tam: 9 });
  parrafo(L, 'Precios con IVA (' + String(q.iva).replace('.', ',') + ' %) incluido. Cotización válida hasta el ' + fechaCorta(q.validaHasta) + '.' + (conCant ? ' Las cantidades son estimadas: se cobra lo que se entregue.' : ''), { tam: 9 });
  pie(L, 'Cotización. No es un documento tributario.');
  return L.doc.bytes();
}

/* ---------- Estado de cuenta ---------- */
/* ec = core/abonos.js, estadoCuenta · info = { cliente (nombre, razonSocial, rut, direccion, contacto), emisor, hoy } */
export function estadoCuenta(ec, info) {
  const L = lienzo({ titulo: 'Estado de cuenta' }, encabezado(info.emisor || {}, 'Estado de cuenta', [['Al', fechaCorta(info.hoy)], ['Desde', fechaCorta(ec.desde)], ['Hasta', fechaCorta(ec.hasta)]]));
  recuadro(L, 'CLIENTE', clienteLineas(info.cliente || {}));
  totales(L, [['Saldo anterior al ' + fechaCorta(ec.desde), clp(ec.saldoAnterior)]]);
  const s = v => (v < 0 ? '-' + clp(-v) : clp(v));
  if (ec.movimientos.length) tabla(L, [{ t: 'Fecha', x: IZ }, { t: 'Movimiento', x: 112 }, { t: 'Cargo', x: 412, der: true }, { t: 'Pago', x: 488, der: true }, { t: 'Saldo', x: DE, der: true }],
    ec.movimientos.map(m => [fechaCorta(m.fecha), P.cortar(m.texto, 225, 9), m.cargo ? clp(m.cargo) : '', m.pago ? clp(m.pago) : '', s(m.saldo)]));
  else parrafo(L, 'Sin cobros ni abonos en estas fechas.', { tam: 9, color: SUAVE });
  totales(L, [['Cargos', clp(ec.cargos)], ['Pagos', clp(ec.pagos)], [ec.saldoFinal < 0 ? 'Saldo a favor del cliente' : 'Saldo adeudado', clp(Math.abs(ec.saldoFinal)), { fuerte: true }]]);
  transferir(L, info.emisor || {});
  pie(L, PIE);
  return L.doc.bytes();
}
export const medioTexto = m => MEDIOS[m] || m;
