/* Lógica del pesaje (APP/js/core/pesaje.js), sin navegador: teclado, cantidades, documento, entregas, totales del día,
   montos con el precio vigente y bitácora de correcciones. Uso: node tests/pesaje-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const P = await import('../APP/js/core/pesaje.js'), C = await import('../APP/js/core/catalogo.js');
  const teclas = (ks, u) => ks.reduce((t, k) => P.teclear(t, k, u), '');

  console.log('1. Teclado numérico');
  ok(teclas(['1', '2', ',', '3', '5'], 'kg') === '12,35', 'kilos con coma decimal: 1 2 , 3 5 → 12,35');
  ok(teclas(['1', '2', ',', '3', '5', '7'], 'kg') === '12,35', 'no más de 2 decimales');
  ok(teclas([',', '5'], 'kg') === '0,5', 'la coma al comienzo pone el cero');
  ok(teclas(['1', ',', ','], 'kg') === '1,', 'una sola coma');
  ok(teclas(['0', '0', '7'], 'kg') === '7', 'sin ceros a la izquierda');
  ok(teclas(['1', '2', '3', '4'], 'kg') === '123', 'kilos: hasta 3 cifras enteras');
  ok(teclas(['1', '2', ','], 'un') === '12', 'unidades: sin coma');
  ok(teclas(['9', '9', '9', '9', '9', '9'], 'un') === '99999', 'unidades: hasta 5 cifras');
  ok(P.teclear('12,3', 'borrar', 'kg') === '12,' && P.teclear('12,3', 'limpiar', 'kg') === '' && P.teclear('', 'borrar', 'kg') === '', 'borrar la última y limpiar todo');
  ok(P.textoTeclado('', 'kg') === '0 kg' && P.textoTeclado('120', 'un') === '120 un', 'lo que se ve mientras se teclea');

  console.log('2. Cantidades');
  const v = P.validarCantidad('12,35', 'kg');
  ok(v.cantidad === 12.35 && !v.aviso && !v.confirmar, '12,35 kg es válido y sin aviso');
  ok(P.validarCantidad('12,', 'kg').cantidad === 12, 'una coma al final no estorba');
  ok(/Escribe los kilos/.test(P.validarCantidad('', 'kg').error) && /Escribe los kilos/.test(P.validarCantidad('0', 'kg').error), 'vacío o cero: pide los kilos');
  ok(/unidades/.test(P.validarCantidad('', 'un').error), 'por unidad: pide cuántas');
  const v20 = P.validarCantidad('20,5', 'kg');
  ok(/Más de 20 kg/.test(v20.aviso) && !v20.confirmar && v20.cantidad === 20.5, 'sobre 20 kg avisa, pero no bloquea ni pregunta');
  ok(P.validarCantidad('20', 'kg').aviso === '', '20 kg justos no avisan');
  ok(P.validarCantidad('125', 'kg').confirmar === true, 'sobre 50 kg (casi seguro un error de tecleo) pide confirmar');
  ok(/sin decimales/.test(P.validarCantidad('12,5', 'un').error), 'por unidad no se aceptan decimales');
  ok(P.validarCantidad('3000', 'un').confirmar === true && P.validarCantidad('120', 'un').confirmar === false, 'muchas unidades piden confirmar');
  ok(P.validarCantidad('12.35', 'kg').cantidad === 12.35 && P.validarCantidad(7.456, 'kg').cantidad === 7.46, 'al corregir sirve el punto y se redondea a 2 decimales');
  ok(P.textoCantidad(12.5, 'kg') === '12,50 kg' && P.textoCantidad(1200, 'un') === '1.200 un', 'kilos con 2 decimales; unidades con punto de miles');

  console.log('3. Documento del canasto');
  const d = P.nuevoPesaje({ fecha: '2026-11-16', hora: '06:05', entregaN: 2, productoId: 'p1', cantidad: 12.35, unidad: 'kg', trabajadorId: 't1', nota: '  canasto   roto ', creadoPor: 'tablet' });
  ok(JSON.stringify(Object.keys(d).sort()) === JSON.stringify(['anulado', 'cantidad', 'creadoPor', 'entregaN', 'fecha', 'hora', 'nota', 'productoId', 'trabajadorId', 'unidad']), 'lleva justo los campos que piden las reglas');
  ok(d.nota === 'canasto roto' && d.anulado === false, 'la nota se limpia; nace sin anular');
  ok(!('nota' in P.nuevoPesaje({ fecha: 'x', nota: '   ' })), 'sin nota no se guarda el campo');
  ok(/^([01]\d|2[0-3]):[0-5]\d$/.test(P.horaChile(new Date())), 'la hora va como HH:MM');
  ok(P.horaChile(new Date(Date.UTC(2026, 10, 16, 9, 7))) === '06:07' && P.horaChile(new Date(Date.UTC(2026, 6, 16, 9, 7))) === '05:07', 'hora de Chile en verano (UTC-3) y en invierno (UTC-4)');
  ok(P.sumarDias('2026-03-01', -1) === '2026-02-28' && P.sumarDias('2026-12-31', 1) === '2027-01-01', 'días anterior y siguiente');
  const leido = Object.assign({ id: 'x1', en: 1794000000000, _pend: true }, d);
  ok(!('id' in P.soloPesaje(leido)) && !('en' in P.soloPesaje(leido)) && !('_pend' in P.soloPesaje(leido)), 'al reescribir no van el id, la hora ni las marcas de pantalla');

  console.log('4. Entregas');
  ok(P.entregaEnCurso(null) === 1 && P.entregaEnCurso(undefined) === 1, 'sin el documento del día, la entrega en curso es la n.º 1');
  ok(P.entregaEnCurso({ entregaN: 3 }) === 3 && P.entregaEnCurso({ entregaN: 0 }) === 1, 'si no, la que diga el día');
  const pes = (id, hora, n, prod, cant, unidad, trab, mas) => Object.assign({ id, fecha: '2026-11-16', hora, entregaN: n, productoId: prod, cantidad: cant, unidad, trabajadorId: trab, anulado: false, en: Number(hora.replace(':', '')) }, mas || {});
  const L = [pes('a', '05:10', 1, 'p1', 18.5, 'kg', 't1'), pes('b', '05:20', 1, 'p2', 120, 'un', 't2'), pes('c', '05:30', 1, 'p1', 19.25, 'kg', 't1'),
    pes('d', '08:00', 2, 'p1', 10, 'kg', 't2'), pes('e', '08:05', 2, 'p1', 99, 'kg', 't2', { anulado: true })];
  const prods = [{ id: 'p1', nombre: 'Marraqueta', unidad: 'kg', orden: 2 }, { id: 'p2', nombre: 'Pan de completo', unidad: 'un', orden: 1 }], trabs = [{ id: 't1', nombre: 'Luis' }, { id: 't2', nombre: 'Ana' }];
  const ea = P.entregaActual(L, { entregaN: 2 });
  ok(ea.n === 2 && ea.canastos === 1 && ea.kg === 10, 'la entrega en curso suma solo sus canastos vigentes');
  ok(P.entregaActual(L, { entregaN: 3 }).canastos === 0, 'una entrega recién abierta parte vacía');

  console.log('5. Totales del día');
  const R = P.resumen(L, prods, trabs);
  ok(R.canastos === 4 && R.kg === 47.75 && R.un === 120, 'los anulados no cuentan: 4 canastos, 47,75 kg y 120 un');
  ok(R.porPan.map(x => x.nombre).join() === 'Pan de completo,Marraqueta' && R.porPan[1].cantidad === 47.75 && R.porPan[0].cantidad === 120, 'por pan, en el orden del catálogo y en su unidad');
  ok(R.porEntrega.length === 2 && R.porEntrega[0].canastos === 3 && R.porEntrega[0].desde === '05:10' && R.porEntrega[0].hasta === '05:30', 'por entrega, con su primera y última hora');
  ok(R.porEntrega[0].items[0].id === 'c' && R.porEntrega[0].porPan.length === 2, 'cada entrega trae sus canastos (el más nuevo primero) y su total por pan');
  ok(R.porTrabajador.map(x => x.nombre + ':' + x.canastos).join() === 'Ana:2,Luis:2', 'por trabajador');
  ok(P.textoTotales(R) === '47,75 kg · 120 un' && P.textoTotales({ kg: 0, un: 0 }) === '—', 'texto de los totales');
  ok(P.resumen([], prods, trabs).canastos === 0 && P.resumen(null).porEntrega.length === 0, 'un día sin pesajes');
  ok(P.recientes([{ id: 'a', en: 2 }, { id: 'b', en: 5 }, { id: 'c', en: 3 }]).map(x => x.id).join('') === 'bca', 'la lista va del más nuevo al más antiguo');

  console.log('6. Montos del día (precio vigente de ese día, con core/ventas.js desde la Fase 5)');
  const V = await import('../APP/js/core/ventas.js');
  const precios = [{ productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2026-01-01' }, { productoId: 'p1', clienteId: 'c1', neto: 1500, desde: '2026-11-17' }];
  const LV = V.lineas(L, prods, precios, 'c1', 19), M = V.totales(LV), mar = V.porPan(LV, prods).find(x => x.productoId === 'p1');
  ok(mar.cantidad === 47.75 && mar.neto === 66850, 'Marraqueta: 47,75 kg × $1.400 = $66.850 (el precio del 17 aún no rige)');
  ok(V.faltanPrecios(LV).map(x => x.nombre).join() === 'Pan de completo' && LV.find(l => l.productoId === 'p2').neto === null, 'el pan sin precio queda señalado y no suma');
  ok(M.neto === 66850 && M.iva === 12702 && M.total === 79552, 'neto, IVA (19 %) y total en pesos enteros');
  ok(V.totales(V.lineas(L.map(x => Object.assign({}, x, { fecha: '2026-11-17' })), prods, precios, 'c1', 19)).neto === 71625, 'al día siguiente rige el precio nuevo');
  ok(V.totales(V.lineas(L, prods, precios, null, 19)).neto === 0, 'sin cliente no hay montos');
  ok(C.precioVigente(precios, 'p1', 'c1', '2026-11-16').neto === 1400, 'usa catalogo.precioVigente (la misma de la Fase 3)');

  console.log('7. Bitácora de correcciones');
  const antes = L[0], despues = Object.assign({}, antes, { cantidad: 18.75, nota: 'repesado' });
  const dif = P.diferencia(antes, despues);
  ok(JSON.stringify(dif) === JSON.stringify({ antes: { cantidad: 18.5 }, despues: { cantidad: 18.75, nota: 'repesado' } }), 'guarda solo lo que cambió, antes y después');
  ok(P.diferencia(antes, Object.assign({}, antes, { _pend: true, en: 9 })) === null, 'si no cambia nada no hay constancia');
  const k = P.constancia('corregir', antes, dif, 'tablet');
  ok(JSON.stringify(Object.keys(k).sort()) === JSON.stringify(['antes', 'despues', 'fecha', 'pesajeId', 'por', 'tipo']) && k.pesajeId === 'a' && k.fecha === '2026-11-16', 'la constancia lleva el pesaje, su día y quién la hizo');
  const kq = P.constancia('corregir', antes, dif, 'tablet', '  Tablet   Panadería ');
  ok(kq.quien === 'Tablet Panadería' && !('quien' in P.constancia('anular', antes, dif, 'x', '   ')), 'y el nombre de la cuenta, si lo tiene (Fase 5)');
  const D = P.describirCambio(Object.assign({}, kq, { antes: { cantidad: 18.5, productoId: 'p1', unidad: 'kg' }, despues: { cantidad: 7, productoId: 'p2', unidad: 'un' } }), prods, trabs, 'un');
  ok(D.titulo === 'Corregido' && D.detalle === 'pan: Marraqueta → Pan de completo · cantidad: 18,50 kg → 7 un', 'la bitácora se lee: ' + D.detalle);
  ok(P.describirCambio({ tipo: 'anular', antes: { anulado: false }, despues: { anulado: true } }).titulo === 'Anulado' && P.describirCambio({ tipo: 'anular', antes: {}, despues: {} }).detalle === '', 'anular y reactivar se nombran solos');
  ok(P.describirCambio({ tipo: 'corregir', antes: { trabajadorId: 't1', entregaN: 1, nota: 'x' }, despues: { trabajadorId: 't2', entregaN: 2 } }, prods, trabs).detalle === 'quién pesó: Luis → Ana · entrega: n.º 1 → n.º 2 · nota: x → —', 'persona, entrega y nota quitada');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
