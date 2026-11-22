/* Abonos y saldo pendiente (Fase 12). Lógica pura: se prueba con Node (tests/abonos-unit.js).
   Un ABONO es un pago (total o parcial) de la CUENTA del cliente: abonos/{id} = { clienteId, fecha, monto, medio, nota, aplicado: [{ cobro: n,
   monto, previo? }], aFavor, anulado, reparto, por, quien, en }. Siempre: suma de `aplicado` + `aFavor` = `monto`.
     · La app lo reparte sola desde el cobro más antiguo con saldo (por vencimiento y número); el reparto se puede cambiar a mano.
     · Lo que sobra queda a favor del cliente; al emitir su próximo cobro, ese saldo a favor se aplica solo (`previo: true`: así el PDF lo
       muestra como «Saldo a favor anterior»). Es un pago, no un descuento: no cambia el neto ni el IVA.
     · Un abono anulado deja de contar (no se borra). Al anular un cobro, lo abonado a él pasa al cobro que lo reemplaza o queda a favor.
   Saldo de un cobro = total − lo aplicado a él por abonos no anulados. Estados (calculados, no se guardan): Pendiente (sin abonos) →
   Abonado (en parte) → Pagado (saldo 0; pagado el día del abono que lo completó). Vencido = con saldo y el vencimiento ya pasado. */
import { numero, limpiar, esFecha } from './catalogo.js';
import { periodoTexto, numeroTexto } from './cobros.js';

export const MEDIOS = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro' };
export const ESTADOS = { pendiente: 'Pendiente', abonado: 'Abonado', pagado: 'Pagado', anulado: 'Anulado' };
export const MAX_APLICADO = 30;
export const vigentes = l => (l || []).filter(a => !a.anulado);
const delCliente = (l, id) => (l || []).filter(x => x.clienteId === id);
const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || (a.en || 0) - (b.en || 0) || String(a.id).localeCompare(String(b.id));
/* Del más antiguo al más nuevo: por vencimiento y número. */
export const antiguos = l => (l || []).slice().sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0) || a.numero - b.numero);

/* ---------- Saldos ---------- */
/* Lo aplicado a cada cobro por los abonos no anulados (sin el abono `excepto`): Map número → pesos. */
export function aplicados(abonos, excepto) {
  const m = new Map();
  for (const a of vigentes(abonos)) if (a.id !== excepto) for (const x of a.aplicado || []) m.set(x.cobro, (m.get(x.cobro) || 0) + x.monto);
  return m;
}
export const saldoDe = (c, A) => (c.anulado ? 0 : Math.max(0, c.total - (A.get(c.numero) || 0)));
/* Estado de un cobro: { estado, vencido, abonado, saldo, pagadoEl, previo (lo abonado con saldo a favor anterior) } */
export function estado(c, abonos, hoy) {
  if (c.anulado) return { estado: 'anulado', vencido: false, abonado: 0, saldo: 0, pagadoEl: '', previo: 0 };
  const parte = vigentes(abonos).map(a => ({ a, m: (a.aplicado || []).filter(x => x.cobro === c.numero) })).filter(x => x.m.length).sort((x, y) => porFecha(x.a, y.a));
  let abonado = 0, previo = 0, pagadoEl = '';
  for (const x of parte) for (const y of x.m) { abonado += y.monto; if (y.previo) previo += y.monto; if (!pagadoEl && abonado >= c.total) pagadoEl = x.a.fecha; }
  const saldo = Math.max(0, c.total - abonado), est = saldo === 0 ? 'pagado' : abonado > 0 ? 'abonado' : 'pendiente';
  return { estado: est, vencido: saldo > 0 && !!hoy && c.vence < hoy, abonado, saldo, pagadoEl: saldo === 0 ? pagadoEl : '', previo };
}
export const etiqueta = e => (e.vencido ? 'Vencido' : ESTADOS[e.estado]);
/* Saldo a favor del cliente: lo no aplicado de sus abonos no anulados. */
export const aFavor = (abonos, clienteId) => vigentes(delCliente(abonos, clienteId)).reduce((t, a) => t + (a.aFavor || 0), 0);
/* Resumen de la cuenta de un cliente (o de todos con clienteId = ''): Por cobrar, Vencido, Saldo a favor y cuántos cobros. */
export function cuenta(cobros, abonos, clienteId, hoy) {
  const cs = (cobros || []).filter(c => !clienteId || c.clienteId === clienteId), r = { porCobrar: 0, vencido: 0, aFavor: 0, conSaldo: 0, vencidos: 0 };
  for (const c of cs) { const e = estado(c, abonos, hoy); if (e.saldo > 0) { r.porCobrar += e.saldo; r.conSaldo++; } if (e.vencido) { r.vencido += e.saldo; r.vencidos++; } }
  r.aFavor = vigentes(abonos).filter(a => !clienteId || a.clienteId === clienteId).reduce((t, a) => t + (a.aFavor || 0), 0);
  return r;
}
/* Otros cobros del cliente con saldo (para el recuadro «Cobros anteriores pendientes» del PDF): [{ numero, periodo, saldo }] */
export function pendientes(cobros, abonos, clienteId, excepto) {
  const A = aplicados(abonos);
  return antiguos(delCliente(cobros, clienteId)).filter(c => c.numero !== excepto && saldoDe(c, A) > 0).map(c => ({ numero: c.numero, desde: c.desde, hasta: c.hasta, periodo: c.periodo, saldo: saldoDe(c, A), vence: c.vence }));
}

/* ---------- Anotar y repartir ---------- */
export function validarAbono(f, hoy) {
  if (!esFecha(f.fecha) || f.fecha > hoy) return { error: 'Elige la fecha del pago (hoy o antes).', campo: 'fecha' };
  const m = numero(f.monto);
  if (Number.isNaN(m) || m < 1 || Math.round(m) !== m || m > 1e10) return { error: 'Escribe el monto en pesos, sin decimales.', campo: 'monto' };
  if (!MEDIOS[f.medio]) return { error: 'Elige cómo pagó.' };
  return { datos: { clienteId: f.clienteId, fecha: f.fecha, monto: m, medio: f.medio, nota: limpiar(f.nota, 120) } };
}
/* Reparto automático de `monto` desde el cobro más antiguo con saldo del cliente: { aplicado, aFavor }. */
export function repartir(cobros, abonos, clienteId, monto, excepto) {
  const A = aplicados(abonos, excepto), aplicado = []; let resto = monto;
  for (const c of antiguos(delCliente(cobros, clienteId))) {
    if (resto <= 0 || aplicado.length >= MAX_APLICADO) break;
    const s = saldoDe(c, A); if (s <= 0) continue;
    const m = Math.min(resto, s); aplicado.push({ cobro: c.numero, monto: m }); resto -= m;
  }
  return { aplicado, aFavor: resto };
}
/* Un abono que paga exactamente el saldo de un cobro. */
export function pagarSaldo(c, abonos) { const s = saldoDe(c, aplicados(abonos)); return { monto: s, aplicado: s ? [{ cobro: c.numero, monto: s }] : [], aFavor: 0 }; }
/* Reparto a mano: `partes` = [{ cobro, monto }] (montos en pesos enteros). Cada uno, como máximo el saldo de ese cobro (sin contar este abono). */
export function validarReparto(cobros, abonos, clienteId, monto, partes, excepto) {
  const A = aplicados(abonos, excepto), aplicado = [];
  for (const p of partes || []) {
    if (!p.monto) continue;
    const c = (cobros || []).find(x => x.numero === p.cobro && x.clienteId === clienteId && !x.anulado);
    if (!c) return { error: 'Ese cobro no es de este cliente o está anulado.' };
    if (!Number.isInteger(p.monto) || p.monto < 0) return { error: 'Los montos del reparto van en pesos, sin decimales.' };
    if (p.monto > saldoDe(c, A)) return { error: 'Al cobro N.º ' + numeroTexto(c.numero) + ' le quedan ' + saldoDe(c, A) + ' pesos: no se le puede aplicar más.' };
    aplicado.push({ cobro: c.numero, monto: p.monto });
  }
  const suma = aplicado.reduce((t, x) => t + x.monto, 0);
  if (suma > monto) return { error: 'El reparto suma más que el abono.' };
  if (aplicado.length > MAX_APLICADO) return { error: 'Un abono se reparte en ' + MAX_APLICADO + ' cobros como máximo.' };
  return { aplicado, aFavor: monto - suma };
}
const sumaA = a => (a.aplicado || []).reduce((t, x) => t + x.monto, 0);
export const cuadra = a => Number.isInteger(a.aFavor) && a.aFavor >= 0 && sumaA(a) + a.aFavor === a.monto && (a.aplicado || []).every(x => Number.isInteger(x.monto) && x.monto > 0);

/* ---------- Mover lo abonado (devuelven la lista de abonos NUEVA; `diferencias` dice qué guardar) ---------- */
const copiar = a => Object.assign({}, a, { aplicado: (a.aplicado || []).map(x => Object.assign({}, x)) });
const sumar = (a, cobro, m, previo) => { const x = a.aplicado.find(y => y.cobro === cobro && !!y.previo === !!previo); if (x) x.monto += m; else a.aplicado.push(Object.assign({ cobro, monto: m }, previo ? { previo: true } : {})); };
/* El saldo a favor del cliente se aplica al cobro `numero` (hasta `capacidad` pesos), del abono más antiguo al más nuevo. */
export function aplicarAFavor(abonos, clienteId, numero, capacidad) {
  let resto = capacidad;
  return (abonos || []).slice().sort(porFecha).map(a0 => {
    if (resto <= 0 || a0.anulado || a0.clienteId !== clienteId || !(a0.aFavor > 0)) return a0;
    const a = copiar(a0);
    if (a.aplicado.length >= MAX_APLICADO && !a.aplicado.some(y => y.cobro === numero && y.previo)) return a0;
    const m = Math.min(a.aFavor, resto); sumar(a, numero, m, true); a.aFavor -= m; resto -= m; return a;
  });
}
/* Al anular el cobro `numero`: lo abonado a él pasa al cobro `destino` (hasta `capacidad` pesos) o queda a favor. */
export function moverDeCobro(abonos, numero, destino, capacidad) {
  let resto = destino ? capacidad : 0;
  return (abonos || []).slice().sort(porFecha).map(a0 => {
    if (a0.anulado || !(a0.aplicado || []).some(x => x.cobro === numero)) return a0;
    const a = copiar(a0), m = a.aplicado.filter(x => x.cobro === numero).reduce((t, x) => t + x.monto, 0);
    a.aplicado = a.aplicado.filter(x => x.cobro !== numero);
    const va = Math.min(m, resto); if (va > 0) { sumar(a, destino, va, false); resto -= va; }
    a.aFavor = (a.aFavor || 0) + m - va; return a;
  });
}
/* Qué abonos cambiaron entre dos listas: [{ id, aplicado, aFavor }]. */
export function diferencias(antes, despues) {
  const m = new Map((antes || []).map(a => [a.id, a]));
  return (despues || []).filter(a => { const b = m.get(a.id); return b && (b.aFavor !== a.aFavor || JSON.stringify(b.aplicado) !== JSON.stringify(a.aplicado)); }).map(a => ({ id: a.id, aplicado: a.aplicado, aFavor: a.aFavor }));
}

/* ---------- Estado de cuenta ---------- */
/* Movimientos del cliente en un rango (cobros como cargo, en su fecha de emisión; abonos como pago), con el saldo corrido.
   saldo > 0 = adeudado · saldo < 0 = a favor. Los anulados no aparecen. */
export function estadoCuenta(cobros, abonos, clienteId, desde, hasta) {
  const mov = delCliente(cobros, clienteId).filter(c => !c.anulado).map(c => ({ fecha: c.fecha, en: c.en || 0, tipo: 'cobro', numero: c.numero, texto: 'Cobro N.º ' + numeroTexto(c.numero) + ' · ' + periodoTexto(c.desde, c.hasta, c.periodo), cargo: c.total, pago: 0 }))
    .concat(vigentes(delCliente(abonos, clienteId)).map(a => ({ fecha: a.fecha, en: a.en || 0, tipo: 'abono', id: a.id, texto: 'Abono · ' + (MEDIOS[a.medio] || a.medio) + (a.nota ? ' · ' + a.nota : ''), cargo: 0, pago: a.monto })))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) || (a.tipo === b.tipo ? a.en - b.en : a.tipo === 'cobro' ? -1 : 1));
  let saldo = 0; const antes = mov.filter(m => m.fecha < desde); antes.forEach(m => { saldo += m.cargo - m.pago; });
  const saldoAnterior = saldo, en = mov.filter(m => m.fecha >= desde && m.fecha <= hasta).map(m => { saldo += m.cargo - m.pago; return Object.assign(m, { saldo }); });
  return { desde, hasta, saldoAnterior, movimientos: en, cargos: en.reduce((t, m) => t + m.cargo, 0), pagos: en.reduce((t, m) => t + m.pago, 0), saldoFinal: saldo };
}
export const nombreEstadoCuenta = (cliente, hoy, slug) => 'estado-de-cuenta-' + slug(cliente) + '-' + hoy + '.pdf';

/* ---------- Documentos ---------- */
export const documento = (d, aplicado, aFavor, uid, quien) => Object.assign({}, d, { aplicado, aFavor, anulado: null, reparto: null, por: uid, quien: limpiar(quien, 60) || 'Sin nombre' });
export const textoAplicado = a => (a.aplicado || []).map(x => 'N.º ' + numeroTexto(x.cobro) + ': ' + x.monto).join(', ');
