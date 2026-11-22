/* Abonos y saldo pendiente (Fase 12), sin navegador: APP/js/core/abonos.js (y las hojas «Cobros» y «Abonos» de core/excel.js), contra el
   cálculo a mano. Comprueba: el reparto desde el cobro más antiguo y el reparto a mano; Pendiente → Abonado → Pagado (con la fecha del
   abono que completó) y Vencido; el pago de más queda a favor y se aplica solo al cobro siguiente (sin cambiar su neto ni su IVA);
   anular un abono devuelve el saldo; anular un cobro pasa lo abonado al que lo reemplaza o lo deja a favor; el estado de cuenta (saldo
   anterior + cargos − pagos = saldo final); 500 secuencias al azar donde siempre aplicado + a favor = monto y ningún saldo queda negativo;
   las hojas del Excel cuadran con «Por cobrar»; y los abonos pasan la copia de las reglas. Uso: node tests/abonos-unit.js */
const { leer, sumaCol } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const A = await import('../APP/js/core/abonos.js'), E = await import('../APP/js/core/excel.js'), X = await import('../APP/js/core/xlsx.js'), R = await import('./fake-firebase/reglas.mjs');
  const cobro = (numero, total, fecha, vence, mas) => Object.assign({ id: String(numero).padStart(4, '0'), numero, clienteId: 'c2', cliente: { nombre: 'Almacén Rosa' }, fecha, desde: fecha, hasta: fecha, periodo: 'semana',
    neto: Math.round(total / 1.19), descuento: null, netoFinal: Math.round(total / 1.19), ivaMonto: total - Math.round(total / 1.19), total, vence, factura: null, anulado: null, en: numero }, mas || {});
  let nA = 0; const abono = (fecha, monto, rep, mas) => Object.assign({ id: 'a' + (++nA), clienteId: 'c2', fecha, monto, medio: 'transferencia', nota: '', aplicado: rep.aplicado, aFavor: rep.aFavor, anulado: null, reparto: null, en: nA }, mas || {});
  const HOY = '2026-11-25';

  console.log('1. Reparto desde el cobro más antiguo');
  let cs = [cobro(1, 100000, '2026-11-09', '2026-11-16'), cobro(2, 80000, '2026-11-16', '2026-11-23'), cobro(3, 50000, '2026-11-23', '2026-11-30'), cobro(9, 30000, '2026-11-02', '2026-11-09', { clienteId: 'c1' })];
  let ab = [];
  const r1 = A.repartir(cs, ab, 'c2', 120000);
  ok(JSON.stringify(r1) === '{"aplicado":[{"cobro":1,"monto":100000},{"cobro":2,"monto":20000}],"aFavor":0}', '$120.000 → N.º 1 completo y $20.000 al N.º 2 (el de otro cliente no se toca)');
  ab.push(abono('2026-11-20', 120000, r1));
  const e1 = A.estado(cs[0], ab, HOY), e2 = A.estado(cs[1], ab, HOY), e3 = A.estado(cs[2], ab, HOY);
  ok(e1.estado === 'pagado' && e1.pagadoEl === '2026-11-20' && e1.saldo === 0 && !e1.vencido, 'N.º 1: Pagado el 20-nov (aunque venció el 16, ya no está vencido)');
  ok(e2.estado === 'abonado' && e2.abonado === 20000 && e2.saldo === 60000 && e2.vencido && A.etiqueta(e2) === 'Vencido', 'N.º 2: Abonado, saldo $60.000 y Vencido (venció el 23)');
  ok(e3.estado === 'pendiente' && e3.saldo === 50000 && !e3.vencido && A.etiqueta(e3) === 'Pendiente', 'N.º 3: Pendiente, sin vencer');
  const cu = A.cuenta(cs, ab, 'c2', HOY);
  ok(cu.porCobrar === 110000 && cu.vencido === 60000 && cu.conSaldo === 2 && cu.vencidos === 1 && cu.aFavor === 0, 'Por cobrar $110.000 · Vencido $60.000 (2 con saldo, 1 vencido)');
  const pendientes = A.pendientes(cs, ab, 'c2', 3);
  ok(pendientes.length === 1 && pendientes[0].numero === 2 && pendientes[0].saldo === 60000, '«Cobros anteriores pendientes» para el PDF del N.º 3: el N.º 2 con $60.000');

  console.log('2. Reparto a mano y pagar el saldo');
  const m1 = A.validarReparto(cs, ab, 'c2', 70000, [{ cobro: 3, monto: 50000 }, { cobro: 2, monto: 10000 }]);
  ok(!m1.error && m1.aFavor === 10000 && m1.aplicado.length === 2, 'a mano: $50.000 al N.º 3 y $10.000 al N.º 2; $10.000 a favor');
  ok(/le quedan 60000/.test(A.validarReparto(cs, ab, 'c2', 70000, [{ cobro: 2, monto: 60001 }]).error) && /suma más/.test(A.validarReparto(cs, ab, 'c2', 1000, [{ cobro: 3, monto: 2000 }]).error)
    && /no es de este cliente/.test(A.validarReparto(cs, ab, 'c2', 1000, [{ cobro: 9, monto: 100 }]).error), 'no más que el saldo de cada cobro, no más que el abono, solo cobros del cliente');
  ok(A.validarReparto(cs, ab, 'c2', 120000, [{ cobro: 1, monto: 100000 }], 'a1').aFavor === 20000, 'al cambiar el reparto de un abono, sus propios montos no cuentan como ya pagados');
  const ps = A.pagarSaldo(cs[1], ab);
  ok(ps.monto === 60000 && ps.aplicado[0].cobro === 2 && ps.aFavor === 0, '«Pagar saldo» del N.º 2: un abono por su saldo exacto, aplicado a ese cobro');
  ok(!!A.validarAbono({ fecha: '2026-11-26', monto: '1000', medio: 'efectivo' }, HOY).error && !!A.validarAbono({ fecha: HOY, monto: '10,5', medio: 'efectivo' }, HOY).error && !!A.validarAbono({ fecha: HOY, monto: '1.000', medio: 'tarjeta' }, HOY).error
    && A.validarAbono({ fecha: HOY, monto: '1.000', medio: 'efectivo', nota: ' boleta ' }, HOY).datos.monto === 1000, 'abono: fecha hoy o antes, pesos enteros, medio de la lista');

  console.log('3. Pago de más, saldo a favor y el cobro siguiente');
  ab.push(abono('2026-11-24', 200000, A.repartir(cs, ab, 'c2', 200000)));
  ok(ab[1].aplicado.length === 2 && ab[1].aFavor === 90000 && A.aFavor(ab, 'c2') === 90000 && A.cuenta(cs, ab, 'c2', HOY).porCobrar === 0, 'pagar $200.000 con $110.000 de saldo deja $90.000 a favor');
  cs.push(cobro(4, 70000, '2026-11-30', '2026-12-07'));
  const ab2 = A.aplicarAFavor(ab, 'c2', 4, 70000), dif = A.diferencias(ab, ab2);
  ok(dif.length === 1 && dif[0].aFavor === 20000 && dif[0].aplicado.some(x => x.cobro === 4 && x.monto === 70000 && x.previo), 'al emitir el N.º 4 ($70.000) el saldo a favor se aplica solo (marcado como «anterior»)');
  ab = ab2; const e4 = A.estado(cs[4], ab, HOY);
  ok(e4.estado === 'pagado' && e4.previo === 70000 && A.aFavor(ab, 'c2') === 20000 && cs[4].netoFinal + cs[4].ivaMonto === 70000, 'el N.º 4 queda Pagado con «Saldo a favor anterior»; su neto y su IVA no cambian; quedan $20.000 a favor');
  ok(A.vigentes(ab).every(A.cuadra), 'en cada abono: aplicado + a favor = monto');

  console.log('4. Anular un abono y anular un cobro');
  const antes = A.cuenta(cs, ab, 'c2', HOY);
  const abA = ab.map((a, i) => (i === 0 ? Object.assign({}, a, { anulado: { motivo: 'Mal anotado' } }) : a)), desp = A.cuenta(cs, abA, 'c2', HOY);
  ok(desp.porCobrar === antes.porCobrar + 120000 && A.estado(cs[0], abA, HOY).estado === 'pendiente', 'anular el abono de $120.000: los cobros vuelven a tener ese saldo (el N.º 1, Pendiente otra vez)');
  ab = abA;
  /* El N.º 2 (pagado por el abono 2) se anula y se reemplaza por el N.º 5, de $50.000: lo abonado pasa al nuevo y el resto queda a favor. */
  const ab3 = A.moverDeCobro(ab, 2, 5, 50000); cs = cs.map(c => (c.numero === 2 ? Object.assign({}, c, { anulado: { motivo: 'Corregido', reemplazo: 5 } }) : c)).concat([cobro(5, 50000, '2026-11-25', '2026-12-02', { reemplaza: 2 })]);
  ok(A.estado(cs.find(c => c.numero === 5), ab3, HOY).estado === 'pagado' && A.aFavor(ab3, 'c2') === 20000 + 10000 && A.estado(cs[1], ab3, HOY).estado === 'anulado', 'anular el N.º 2 ($60.000 abonados): $50.000 pasan al N.º 5 que lo reemplaza y $10.000 quedan a favor');
  const ab4 = A.moverDeCobro(ab3, 5, null, 0);
  ok(A.aFavor(ab4, 'c2') === 80000 && !A.vigentes(ab4).some(a => a.aplicado.some(x => x.cobro === 5)), 'anular sin reemplazo: todo lo abonado queda a favor');

  console.log('5. Estado de cuenta (contra el cálculo a mano)');
  const C2 = [cobro(1, 100000, '2026-11-09', '2026-11-16'), cobro(2, 80000, '2026-11-16', '2026-11-23'), cobro(3, 50000, '2026-11-23', '2026-11-30', { anulado: { motivo: 'x' } })];
  const A2 = [abono('2026-11-12', 30000, { aplicado: [{ cobro: 1, monto: 30000 }], aFavor: 0 }), abono('2026-11-20', 100000, { aplicado: [{ cobro: 1, monto: 70000 }, { cobro: 2, monto: 30000 }], aFavor: 0 }),
    abono('2026-11-21', 5000, { aplicado: [], aFavor: 5000 }, { anulado: { motivo: 'x' } })];
  const ec = A.estadoCuenta(C2, A2, 'c2', '2026-11-15', '2026-11-30');
  ok(ec.saldoAnterior === 70000 && ec.movimientos.length === 2 && ec.cargos === 80000 && ec.pagos === 100000 && ec.saldoFinal === 50000, 'saldo anterior $70.000 + cargos $80.000 − pagos $100.000 = $50.000 (los anulados no aparecen)');
  ok(ec.movimientos[0].saldo === 150000 && ec.movimientos[1].saldo === 50000 && /Cobro N.º 0002/.test(ec.movimientos[0].texto), 'con el saldo corrido');
  const todo = A.estadoCuenta(C2, A2, 'c2', '2026-01-01', '2026-12-31'), cu2 = A.cuenta(C2, A2, 'c2', HOY);
  ok(todo.saldoFinal === cu2.porCobrar - cu2.aFavor && todo.saldoFinal === 50000, 'de punta a punta: saldo final = Por cobrar − saldo a favor');
  ok(A.estadoCuenta([], [abono('2026-11-10', 9000, { aplicado: [], aFavor: 9000 })], 'c2', '2026-11-01', '2026-11-30').saldoFinal === -9000, 'un pago sin cobros queda como saldo a favor (negativo)');

  console.log('6. 500 secuencias al azar');
  let malas = 0, ultimo = '';
  const azar = n => Math.floor(Math.random() * n);
  for (let s = 0; s < 500; s++) {
    let C = [], B = [], num = 0;
    for (let paso = 0; paso < 25; paso++) {
      const op = azar(6), f = '2026-11-' + String(1 + azar(28)).padStart(2, '0');
      if (op === 0 || !C.length) { num++; const total = 1000 + azar(200000), c = cobro(num, total, f, '2026-12-0' + (1 + azar(9))); C.push(c); B = A.aplicarAFavor(B, 'c2', num, total); }
      else if (op === 1 || op === 2) { const m = 1 + azar(250000); B.push(abono(f, m, A.repartir(C, B, 'c2', m))); }
      else if (op === 3 && A.vigentes(B).length) { const a = A.vigentes(B)[azar(A.vigentes(B).length)]; B = B.map(x => (x.id === a.id ? Object.assign({}, x, { anulado: { motivo: 'x' } }) : x)); }
      else if (op === 4) { const v = C.filter(c => !c.anulado); if (!v.length) continue; const c = v[azar(v.length)];
        if (azar(2)) { num++; const total = 1000 + azar(150000); C = C.map(x => (x === c ? Object.assign({}, x, { anulado: { motivo: 'x', reemplazo: num } }) : x)).concat([cobro(num, total, f, '2026-12-05')]); B = A.aplicarAFavor(A.moverDeCobro(B, c.numero, num, total), 'c2', num, total - A.estado(C[C.length - 1], A.moverDeCobro(B, c.numero, num, total), HOY).abonado); }
        else { C = C.map(x => (x === c ? Object.assign({}, x, { anulado: { motivo: 'x' } }) : x)); B = A.moverDeCobro(B, c.numero, null, 0); } }
      else if (op === 5 && A.vigentes(B).length) { const a = A.vigentes(B)[azar(A.vigentes(B).length)], Am = A.aplicados(B, a.id);
        const partes = C.filter(c => !c.anulado).map(c => ({ cobro: c.numero, monto: azar(Math.max(1, Math.min(c.total - (Am.get(c.numero) || 0), a.monto) + 1)) }));
        const r = A.validarReparto(C, B, 'c2', a.monto, partes, a.id); if (!r.error) B = B.map(x => (x.id === a.id ? Object.assign({}, x, r) : x)); }
      const Am = A.aplicados(B), cu = A.cuenta(C, B, 'c2', HOY), ec = A.estadoCuenta(C, B, 'c2', '2026-01-01', '2026-12-31');
      const mal = !A.vigentes(B).every(A.cuadra) ? 'aplicado + a favor ≠ monto' : C.some(c => (Am.get(c.numero) || 0) > c.total && !c.anulado) ? 'saldo negativo'
        : A.vigentes(B).some(a => a.aplicado.some(x => (C.find(c => c.numero === x.cobro) || {}).anulado)) ? 'abono aplicado a un cobro anulado' : ec.saldoFinal !== cu.porCobrar - cu.aFavor ? 'estado de cuenta ≠ Por cobrar − a favor' : '';
      if (mal) { malas++; ultimo = mal; break; }
    }
  }
  ok(malas === 0, 'cobros, abonos, anulaciones y repartos al azar: siempre cuadran (aplicado + a favor = monto, ningún saldo negativo, nada aplicado a un anulado)' + (ultimo ? ' · ' + ultimo : ''));

  console.log('7. Excel: hojas «Cobros» y «Abonos»');
  const CLI = [{ id: 'c2', nombre: 'Almacén Rosa', activo: true, tipo: 'regular', en: 2 }, { id: 'c1', nombre: 'Supermercado', activo: true, en: 1 }];
  const CX = [cobro(1, 100000, '2026-11-09', '2026-11-16'), cobro(2, 80000, '2026-11-16', '2026-11-23'), cobro(3, 50000, '2026-11-23', '2026-11-30', { anulado: { motivo: 'Duplicado' } }), cobro(9, 30000, '2026-11-02', '2026-11-09', { clienteId: 'c1' })];
  const AX = [abono('2026-11-12', 30000, { aplicado: [{ cobro: 1, monto: 30000 }], aFavor: 0 }), abono('2026-11-20', 120000, { aplicado: [{ cobro: 1, monto: 70000 }, { cobro: 2, monto: 30000 }], aFavor: 20000 }), abono('2026-11-21', 5000, { aplicado: [], aFavor: 5000 }, { anulado: { motivo: 'Mal' } })];
  const lib = E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: [], productos: [], trabajadores: [], precios: [], clientes: CLI, iva: 19, cobros: CX, abonos: AX, hoy: HOY });
  const xl = leer(X.crear(lib.hojas, new Date('2026-11-25T12:00:00Z'))), hc = xl.hojas.Cobros.filas, ha = xl.hojas.Abonos.filas, cu3 = A.cuenta(CX, AX, '', HOY);
  ok(xl.orden.slice(-2).join(',') === 'Cobros,Abonos' && hc[0][9] === 'Saldo' && hc.length >= 5, 'el Excel del mes suma las hojas «Cobros» y «Abonos»');
  ok(sumaCol(hc, 9, 1, 4) === cu3.porCobrar && hc[4][9] === cu3.porCobrar && xl.hojas.Cobros.formulas.J5 === 'SUM(J2:J4)', 'la suma de «Saldo» = Por cobrar ($' + cu3.porCobrar + '), con fórmula');
  ok(hc[1][10] === 'Pagado' && hc[2][10] === 'Vencido' && /Anulado: Duplicado/.test(hc[7][10]) && hc[4][7] === 210000, 'estados al día de la descarga; el anulado va al final y no suma');
  ok(sumaCol(ha, 2, 1, 3) === 150000 && ha[3][2] === 150000 && ha[3][6] === 20000 && /N.º 0001: \$70\.000 · N.º 0002: \$30\.000/.test(ha[2][5]) && /Anulado/.test(ha[6][7]), '«Abonos»: montos, a qué cobros se aplicaron, lo que quedó a favor; el anulado al final');
  const uno = leer(X.crear(E.libro({ desde: '2026-11-01', hasta: '2026-11-30', pesajes: [], productos: [], trabajadores: [], precios: [], clientes: CLI, clienteId: 'c1', iva: 19, cobros: CX, abonos: AX, hoy: HOY }).hojas));
  ok(uno.hojas.Cobros.filas.length === 3 && uno.hojas.Cobros.filas[1][0] === '0009' && /Sin abonos/.test(uno.hojas.Abonos.filas[1][0]), 'el Excel de un cliente trae solo sus cobros y abonos');

  console.log('8. Los abonos pasan la copia de las reglas');
  const AHORA = Date.now(), rosa = { uid: 'rosa' }, db = { 'config/negocio': { duenos: ['rosa'] }, 'clientes/c2': CLI[0] }, leerDb = r => (r in db ? db[r] : null);
  const d = A.documento(A.validarAbono({ clienteId: 'c2', fecha: HOY, monto: '50.000', medio: 'cheque', nota: 'Cheque 123' }, HOY).datos, [{ cobro: 1, monto: 50000 }], 0, 'rosa', 'Rosa');
  ok(R.permitido(rosa, 'create', 'abonos/x1', Object.assign({}, d, { en: R.TS }), null, leerDb, AHORA), 'el abono armado por la app se acepta');
  const guardado = Object.assign({}, d, { en: AHORA });
  ok(R.permitido(rosa, 'update', 'abonos/x1', Object.assign({}, guardado, { aplicado: [], aFavor: 50000, reparto: { por: 'rosa', quien: 'Rosa', en: R.TS } }), guardado, leerDb, AHORA), 'cambiar el reparto (con quién y cuándo) se acepta');
  ok(R.permitido(rosa, 'update', 'abonos/x1', Object.assign({}, guardado, { anulado: { motivo: 'Mal anotado', por: 'rosa', quien: 'Rosa', en: R.TS } }), guardado, leerDb, AHORA)
    && !R.permitido(rosa, 'update', 'abonos/x1', Object.assign({}, guardado, { monto: 1 }), guardado, leerDb, AHORA), 'anular con motivo sí; cambiar el monto no');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
