/* Cobros y cotizaciones (Fase 12), sin navegador: APP/js/core/rut.js, cobros.js y cotizaciones.js, contra el cálculo a mano y contra
   Entregas (ventas.lineas con el filtro del cliente). Comprueba el «Listo cuando»: el cobro semanal y el mensual dan el mismo neto que
   Entregas con el filtro de ese cliente en esas fechas; total = neto − descuento + IVA, con el ajuste de redondeo a la vista (siempre de
   pocos pesos, también en 500 cobros al azar); el precio de cada día; un pan sin precio bloquea; lo antiguo sin `clienteId` es del
   supermercado; las ventas sueltas no se cobran; vencimiento, solape y «cambió desde que se emitió»; la cotización con y sin cantidades y
   el cliente que se crea desde ella; los documentos pasan la copia de las reglas (con el folio en la misma escritura). Uso: node tests/cobros-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const RUT = await import('../APP/js/core/rut.js'), CB = await import('../APP/js/core/cobros.js'), Q = await import('../APP/js/core/cotizaciones.js');
  const V = await import('../APP/js/core/ventas.js'), C = await import('../APP/js/core/catalogo.js'), R = await import('./fake-firebase/reglas.mjs');

  console.log('1. RUT');
  ok(RUT.esValido('12.345.678-5') && RUT.esValido('11111111-1') && RUT.esValido('1-9') && !RUT.esValido('12.345.678-4') && !RUT.esValido('0-0'), 'dígito verificador (módulo 11)');
  let k = 1; while (RUT.dv(String(k)) !== 'K') k++;
  ok(RUT.validar(k + '-k', true).rut === RUT.formatear(k + 'K') && /-K$/.test(RUT.formatear(k + 'k')), 'la K (también en minúscula): ' + RUT.formatear(k + 'K'));
  ok(RUT.validar(' 76123456' + RUT.dv('76123456'), true).rut === '76.123.456-' + RUT.dv('76123456'), 'se escribe con puntos y guion');
  ok(/dígito verificador/.test(RUT.validar('12.345.678-9', true).error) && /Escribe el RUT/.test(RUT.validar('', true).error) && RUT.validar('', false).rut === '' && !!RUT.validar('K12', false).error, 'errores claros; vacío solo si es opcional');

  console.log('2. Períodos');
  ok(JSON.stringify(CB.semanaDe('2026-11-12')) === '{"desde":"2026-11-09","hasta":"2026-11-15"}' && CB.semanaDe('2026-11-15').desde === '2026-11-09' && CB.semanaDe('2026-11-16').desde === '2026-11-16', 'semana de lunes a domingo');
  ok(JSON.stringify(CB.ultimoTerminado('semana', '2026-11-21')) === '{"desde":"2026-11-09","hasta":"2026-11-15"}' && CB.ultimoTerminado('semana', '2026-11-23').desde === '2026-11-16', '«Semana pasada»: la última semana terminada');
  ok(JSON.stringify(CB.ultimoTerminado('mes', '2026-12-03')) === '{"desde":"2026-11-01","hasta":"2026-11-30"}', '«Mes pasado»: el último mes terminado');
  ok(CB.periodoTexto('2026-11-10', '2026-11-16', 'semana') === 'Semana del 10 al 16 de noviembre de 2026' && CB.periodoTexto('2026-11-01', '2026-11-30', 'mes') === 'Noviembre de 2026'
    && CB.periodoTexto('2026-11-30', '2026-12-06', 'semana') === 'Semana del 30 de noviembre al 6 de diciembre de 2026' && CB.periodoTexto('2026-12-28', '2027-01-03', 'otro') === 'Del 28 de diciembre de 2026 al 3 de enero de 2027', 'textos del período');
  ok(/1 de noviembre de 2026/.test(CB.validarPeriodo('2026-10-26', '2026-11-01', '2026-11-21').error) && /62/.test(CB.validarPeriodo('2026-11-01', '2027-01-05', '2027-02-01').error) && /todavía no empieza/.test(CB.validarPeriodo('2026-11-25', '2026-11-30', '2026-11-21').error), 'desde el 1-nov-2026, hasta 62 días y no en el futuro');
  ok(/todavía no termina/.test(CB.validarPeriodo('2026-11-16', '2026-11-22', '2026-11-21').aviso) && CB.validarPeriodo('2026-11-09', '2026-11-15', '2026-11-21').aviso === '', 'un período sin terminar se puede cobrar, con aviso');

  /* Datos: el supermercado (original; lo antiguo sin clienteId), un almacén con su lista (la marraqueta sube el jueves 12) y ventas sueltas. */
  const prods = [{ id: 'mar', nombre: 'Marraqueta', unidad: 'kg', orden: 1, activo: true }, { id: 'hal', nombre: 'Hallulla', unidad: 'kg', orden: 2, activo: true }, { id: 'com', nombre: 'Pan de completo', unidad: 'un', orden: 3, activo: true }];
  const CLI = [{ id: 'c1', nombre: 'Supermercado', activo: true, en: 1 }, { id: 'c2', nombre: 'Almacén Rosa', activo: true, tipo: 'regular', en: 5 }, { id: 'cs', nombre: 'Ventas sueltas', activo: true, tipo: 'suelta', en: 6 }];
  const pr = (productoId, clienteId, neto, desde) => ({ id: C.idPrecio(productoId, clienteId, desde), productoId, clienteId, neto, desde });
  const precios = [pr('mar', 'c1', 1450, '2026-01-01'), pr('hal', 'c1', 1300, '2026-01-01'), pr('com', 'c1', 105, '2026-01-01'),
    pr('mar', 'c2', 1512.61, '2026-11-01'), pr('mar', 'c2', 1600, '2026-11-12'), pr('hal', 'c2', 1350, '2026-11-01'), pr('com', 'c2', 110, '2026-11-01'), pr('mar', 'cs', 2000, '2026-11-01')];
  let n = 0; const pz = (fecha, prod, cant, u, mas) => Object.assign({ id: 'p' + (++n), fecha, hora: '06:' + String(n % 60).padStart(2, '0'), entregaN: 1, productoId: prod, cantidad: cant, unidad: u, trabajadorId: 't1', anulado: false, en: n }, mas || {});
  const pes = [];
  for (let d = 2; d <= 28; d++) {
    const f = '2026-11-' + String(d).padStart(2, '0');
    pes.push(pz(f, 'mar', 18.35 + d / 10, 'kg', d < 5 ? {} : { clienteId: 'c1' }), pz(f, 'hal', 12.4, 'kg', { clienteId: 'c1', entregaN: 2 }));                   // antes del 5: sin cliente (= supermercado)
    pes.push(pz(f, 'mar', 7.25 + d / 20, 'kg', { clienteId: 'c2' }), pz(f, 'com', 40 + d, 'un', { clienteId: 'c2' }), pz(f, 'hal', 3.1, 'kg', { clienteId: 'c2', anulado: d === 11 }));
    pes.push(pz(f, 'mar', 1.5, 'kg', { clienteId: 'cs', nota: 'Sra. Marta' }));
  }
  pes.push(pz('2026-10-30', 'mar', 50, 'kg', { clienteId: 'c2' }));   // de octubre: no entra en ningún cobro de noviembre
  const ls = (cid, desde, hasta) => V.deCliente(V.lineas(pes.filter(p => p.fecha >= desde && p.fecha <= hasta), prods, precios, CLI, 19), cid);
  const armar = (cid, desde, hasta, d) => CB.armar(ls(cid, desde, hasta), { iva: 19, descuento: d || null, productos: prods });

  console.log('3. El cobro = Entregas con el filtro del cliente (Listo cuando)');
  const sem = armar('c2', '2026-11-09', '2026-11-15'), Tsem = V.totales(ls('c2', '2026-11-09', '2026-11-15'));
  ok(sem.neto === Tsem.neto && sem.neto > 0, 'semana del almacén: neto del cobro = neto de Entregas con el filtro (' + C.pesos(sem.neto) + ')');
  const mes = armar('c2', '2026-11-01', '2026-11-30'), Tmes = V.totales(ls('c2', '2026-11-01', '2026-11-30'));
  ok(mes.neto === Tmes.neto && mes.total === mes.netoFinal + mes.ivaMonto && mes.ivaMonto === V.ivaSobre(mes.netoFinal, 19), 'mes del almacén: mismo neto que Entregas; total = neto + IVA (el IVA del neto, una vez)');
  const sup = armar('c1', '2026-11-01', '2026-11-30');
  ok(sup.neto === V.totales(ls('c1', '2026-11-01', '2026-11-30')).neto && sup.anexo.length === 27 && sup.anexo[0].fecha === '2026-11-02', 'lo pesado sin cliente (antes de la 0.11.0) es del supermercado y entra en su cobro');
  ok(!ls('c2', '2026-11-01', '2026-11-30').some(l => l.suelta) && !sup.lineas.some(l => l.precio === 2000), 'las ventas sueltas no entran en ningún cobro');
  const marr = sem.lineas.filter(l => l.productoId === 'mar');
  ok(marr.length === 2 && marr[0].precio === 1512.61 && marr[0].desde === '2026-11-09' && marr[0].hasta === '2026-11-11' && marr[1].precio === 1600 && marr[1].desde === '2026-11-12', 'el precio de cada día: si cambia en el período, una línea por precio');
  ok(sem.lineas.every(l => l.monto === C.redondearPesos(l.neto * 1.19) && l.conIva === Math.round(l.precio * 1.19 * 100) / 100), 'cada línea con su precio con IVA y su monto con IVA (al peso)');
  ok(sem.anexo.length === 7 && sem.anexo.every(d => d.entregas === 1) && sem.anexo.find(d => d.fecha === '2026-11-10').items.find(i => i.productoId === 'hal').cantidad === 3.1 && !('neto' in sem.anexo[0]), 'anexo por día: panes, cantidades y entregas (sin montos)');
  ok(!sem.anexo.find(d => d.fecha === '2026-11-11').items.some(i => i.productoId === 'hal'), 'el canasto anulado no cuenta (el día 11 no tiene hallulla)');

  console.log('4. Descuento, IVA y ajuste contra el cálculo a mano');
  const mano = [{ fecha: '2026-11-10', entregaN: 1, productoId: 'mar', nombre: 'Marraqueta', unidad: 'kg', cantidad: 40, precio: 1600, neto: 64000 }, { fecha: '2026-11-10', entregaN: 1, productoId: 'com', nombre: 'Pan de completo', unidad: 'un', cantidad: 300, precio: 110, neto: 33000 }];
  const a1 = CB.armar(mano, { iva: 19, descuento: { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' }, productos: prods });
  ok(a1.neto === 97000 && a1.descuento.neto === 4850 && a1.netoFinal === 92150 && a1.ivaMonto === 17509 && a1.total === 109659, '5 %: neto 97.000 − 4.850 = 92.150; IVA 17.509; total 109.659');
  ok(a1.subtotal === 115430 && a1.descuento.conIva === 5772 && a1.ajuste === 1, 'subtotal con IVA 115.430 − descuento 5.772 = 109.658: ajuste por redondeo $1');
  const a2 = CB.armar(mano, { iva: 19, descuento: { tipo: 'monto', valor: 11900, texto: 'Rebaja' }, productos: prods });
  ok(a2.descuento.neto === 10000 && a2.netoFinal === 87000 && a2.ivaMonto === 16530 && a2.total === 103530 && a2.ajuste === 0, 'en $ con IVA: $11.900 = $10.000 neto; total 103.530, sin ajuste');
  ok(/superar el subtotal/.test(CB.armar(mano, { iva: 19, descuento: { tipo: 'monto', valor: 200000, texto: 'x' } }).error), 'el descuento no puede superar el subtotal');
  ok(CB.validarDescuento({ tipo: 'pct', valor: '5,5', texto: '' }).descuento.texto === 'Descuento 5,5 %' && !!CB.validarDescuento({ tipo: 'pct', valor: '120' }).error && !!CB.validarDescuento({ tipo: 'monto', valor: '10,5' }).error && CB.validarDescuento({ tipo: '' }).descuento === null, 'descuento: % hasta 100, $ sin decimales, texto por omisión');
  let peor = 0, malos = 0;
  for (let i = 0; i < 500; i++) {
    const L = Array.from({ length: 1 + (i % 12) }, (x, j) => { const precio = Math.round((50 + Math.random() * 3000) * 100) / 100, cantidad = j % 2 ? 1 + Math.floor(Math.random() * 900) : Math.round(Math.random() * 9000) / 100 + 0.01;
      return { fecha: '2026-11-10', entregaN: 1, productoId: 'x' + j, nombre: 'Pan ' + j, unidad: j % 2 ? 'un' : 'kg', cantidad, precio, neto: C.montos(precio, cantidad, 19).neto }; });
    const d = i % 3 === 0 ? null : i % 3 === 1 ? { tipo: 'pct', valor: Math.round(Math.random() * 3000) / 100 + 0.01, texto: 'x' } : { tipo: 'monto', valor: 1 + Math.floor(Math.random() * 5000), texto: 'x' };
    const a = CB.armar(L, { iva: 19, descuento: d });
    if (a.error) continue;
    peor = Math.max(peor, Math.abs(a.ajuste));
    if (a.total !== a.netoFinal + a.ivaMonto || a.netoFinal !== a.neto - (a.descuento ? a.descuento.neto : 0) || Math.abs(a.ajuste) > a.lineas.length / 2 + 1 || a.neto !== L.reduce((t, l) => t + l.neto, 0)) malos++;
  }
  ok(malos === 0, '500 cobros al azar: total = neto final + IVA y el ajuste siempre de pocos pesos (el mayor: $' + peor + ')');

  console.log('5. Lo que impide emitir, vencimiento, solape y «cambió»');
  const pesSin = pes.concat([pz('2026-11-10', 'hal', 5, 'kg', { clienteId: 'c2' })]), precSin = precios.filter(p => !(p.productoId === 'hal' && p.clienteId === 'c2'));
  const aSin = CB.armar(V.deCliente(V.lineas(pesSin.filter(p => p.fecha >= '2026-11-09' && p.fecha <= '2026-11-15'), prods, precSin, CLI, 19), 'c2'), { iva: 19, productos: prods });
  ok(/Falta el precio de Hallulla para Almacén Rosa desde el 9 nov 2026/.test(CB.bloqueo(aSin, 'Almacén Rosa')), 'un pan sin precio para ese cliente bloquea la emisión («Falta el precio de Hallulla…»)');
  ok(/no tiene entregas/.test(CB.bloqueo(armar('c2', '2026-12-01', '2026-12-07'), 'Almacén Rosa')) && CB.bloqueo(sem, 'Almacén Rosa') === '', 'sin entregas no hay cobro; con todo en orden, nada lo impide');
  ok(CB.vence('2026-11-21', 7) === '2026-11-28' && CB.vence('2026-11-28', 7) === '2026-12-05' && CB.vence('2026-11-21', 0) === '2026-11-21', 'vence = emisión + plazo del cliente');
  const cobros = [{ numero: 3, clienteId: 'c2', desde: '2026-11-09', hasta: '2026-11-15', anulado: null }, { numero: 4, clienteId: 'c2', desde: '2026-11-16', hasta: '2026-11-22', anulado: { motivo: 'x' } }, { numero: 5, clienteId: 'c1', desde: '2026-11-01', hasta: '2026-11-30', anulado: null }];
  const so = CB.solape(cobros, 'c2', '2026-11-12', '2026-11-18');
  ok(so.length === 1 && so[0].numero === 3 && so[0].desde === '2026-11-12' && so[0].hasta === '2026-11-15' && /El cobro N.º 0003 ya cubre del 12 nov 2026 al 15 nov 2026/.test(CB.solapeTexto(so)), 'aviso al cobrar dos veces las mismas fechas (los anulados y los de otro cliente no cuentan)');
  const doc = CB.documento({ numero: 7, clienteId: 'c2', cliente: CB.clienteFijo(CLI[1], null), emisor: CB.emisorFijo({ razonSocial: 'Panadería SpA', rut: '76.123.456-0' }), fecha: '2026-11-17', desde: '2026-11-09', hasta: '2026-11-15', periodo: 'semana', armado: sem, iva: 19, plazo: 7, por: 'rosa', quien: 'Rosa' });
  ok(CB.comparar(doc, ls('c2', '2026-11-09', '2026-11-15')).igual, 'recién emitido, el cobro cuadra con los canastos');
  const pes2 = pes.map(p => (p.fecha === '2026-11-10' && p.clienteId === 'c2' && p.productoId === 'mar' ? Object.assign({}, p, { cantidad: p.cantidad + 2 }) : p));
  const cmp = CB.comparar(doc, V.deCliente(V.lineas(pes2.filter(p => p.fecha >= '2026-11-09' && p.fecha <= '2026-11-15'), prods, precios, CLI, 19), 'c2'));
  ok(!cmp.igual && cmp.dif === CB.armar(V.deCliente(V.lineas(pes2.filter(p => p.fecha >= '2026-11-09' && p.fecha <= '2026-11-15'), prods, precios, CLI, 19), 'c2'), { iva: 19 }).total - doc.total && cmp.dif > 0, 'corregido un canasto, avisa que cambió y en cuánto (+' + C.pesos(cmp.dif || 0) + ')');
  ok(doc.vence === '2026-11-24' && doc.anulado === null && doc.factura === null && doc.lineas.length === sem.lineas.length && CB.nombreArchivo(doc) === 'cobro-0007-almacen-rosa-2026-11-09.pdf', 'el documento: vence, sin anular y el nombre del PDF');

  console.log('6. Cotizaciones');
  const base = Q.preciosBase(prods, precios, 'c1', '2026-11-21');
  ok(base.length === 3 && base[0].neto === 1450 && base[2].neto === 105, 'los precios parten de la lista de un cliente (el de hoy)');
  const L1 = Q.lineasDe([{ productoId: 'mar', neto: '1.550', cantidad: '40' }, { productoId: 'com', neto: 120, cantidad: '' }], prods, 19);
  const T1 = Q.totales(L1.lineas, null, 19);
  ok(L1.lineas[0].conIva === 1844.5 && T1.neto === 62000 && T1.ivaMonto === 11780 && T1.total === 73780 && T1.montos.get('com') === undefined, 'con cantidades estimadas: total estimado (solo los panes con cantidad), igual que el cobro');
  const T2 = Q.totales(Q.lineasDe([{ productoId: 'mar', neto: 1550 }], prods, 19).lineas, { tipo: 'pct', valor: 5, texto: 'x' }, 19);
  ok(T2.total === null && T2.neto === null, 'sin cantidades no hay total (solo los precios con IVA)');
  ok(/unidades enteras/.test(Q.lineasDe([{ productoId: 'com', neto: 120, cantidad: '10,5' }], prods, 19).error) && /Elige al menos un pan/.test(Q.lineasDe([], prods, 19).error) && /precio neto de Marraqueta/.test(Q.lineasDe([{ productoId: 'mar', neto: '' }], prods, 19).error), 'errores: unidades enteras, al menos un pan, el precio');
  const para = Q.validarPara({ nombre: ' Casino  Sur ', contacto: 'Ana · 9 1234 5678', rut: '' }).para;
  const cot = Q.documento({ numero: 1, para, baseClienteId: 'c1', cantidadesPor: 'semana', lineas: L1.lineas, totales: T1, iva: 19, fecha: '2026-11-21', emisor: CB.emisorFijo({ razonSocial: 'Panadería SpA', rut: '76.123.456-0' }), por: 'rosa', quien: 'Rosa' });
  ok(cot.validaHasta === '2026-12-06' && cot.estado === 'enviada' && para.nombre === 'Casino Sur' && cot.lineas[0].monto === 73780 && cot.lineas[1].monto === null && Q.nombreArchivo(cot) === 'cotizacion-0001-casino-sur.pdf', 'la cotización: válida por 15 días, enviada, y el nombre del PDF');
  ok(Q.vencida(cot, '2026-12-07') && !Q.vencida(cot, '2026-12-06') && Q.etiqueta(cot, '2026-12-07') === 'Vencida', 'después de la validez se ve «Vencida»');
  const nuevo = Q.clienteDesde(cot, 'cNEW', '2026-11-22', 'rosa');
  ok(nuevo.escrituras.length === 4 && nuevo.escrituras[0].datos.nombre === 'Casino Sur' && nuevo.escrituras[0].datos.tipo === 'regular' && nuevo.escrituras[1].ruta === 'clientesCobro/cNEW'
    && nuevo.escrituras[2].ruta === 'precios/mar_cNEW_2026-11-22' && nuevo.escrituras[2].datos.neto === 1550 && nuevo.escrituras[3].datos.neto === 120, '«Crear cliente con estos precios»: cliente regular, datos de cobro y su lista con los netos de la cotización');

  console.log('7. Los documentos pasan la copia de las reglas');
  const AHORA = Date.now(), rosa = { uid: 'rosa', email: 'rosa@example.com', email_verified: true, proveedor: 'google.com' }, tablet = { uid: 'tablet', email: 'tablet@example.com', email_verified: true, proveedor: 'google.com' };
  const db = { 'config/negocio': { duenos: ['rosa'] }, 'miembros/tablet': { perfil: 'pesaje', activo: true }, 'clientes/c2': CLI[1], 'clientes/c1': CLI[0] }, leer = r => (r in db ? db[r] : null);
  const ts = o => Object.assign({}, o, { en: R.TS });
  const emitir = (q, col, n, datos, f) => { const tras = { [col + '/' + CB.numeroTexto(n)]: ts(datos), 'config/folios': f }, despues = r => (r in tras ? tras[r] : leer(r));
    return R.permitido(q, 'create', col + '/' + CB.numeroTexto(n), ts(datos), null, leer, AHORA, despues) && R.permitido(q, leer('config/folios') ? 'update' : 'create', 'config/folios', f, leer('config/folios'), leer, AHORA, despues); };
  const d1 = Object.assign({}, doc, { numero: 1 });
  ok(emitir(rosa, 'cobros', 1, d1, { cobro: 1, cotizacion: 0 }), 'el cobro armado por la app se acepta con el folio + 1');
  ok(!emitir(rosa, 'cobros', 2, Object.assign({}, doc, { numero: 2 }), { cobro: 2, cotizacion: 0 }) && !emitir(tablet, 'cobros', 1, d1, { cobro: 1, cotizacion: 0 }), 'no si el folio salta; la tablet no emite');
  ok(emitir(rosa, 'cotizaciones', 1, cot, { cobro: 0, cotizacion: 1 }), 'la cotización armada por la app se acepta con su folio');
  const em = CB.validarEmpresa({ razonSocial: 'Panadería Familiar SpA', rut: '761234560', correo: 'hola@example.com', rutCuenta: '' });
  ok(!em.error && em.datos.rut === '76.123.456-0' && R.permitido(rosa, 'create', 'config/empresa', Object.assign(em.datos, { por: 'rosa', quien: 'Rosa', en: R.TS }), null, leer, AHORA), 'los datos de la panadería (revisados por la app) pasan las reglas');
  ok(/razón social/.test(CB.validarEmpresa({ rut: '76.123.456-0' }).error) && /dígito/.test(CB.validarEmpresa({ razonSocial: 'X', rut: '76.123.456-1' }).error) && /correo/.test(CB.validarEmpresa({ razonSocial: 'X', rut: '76.123.456-0', correo: 'sin-arroba' }).error), 'razón social y RUT obligatorios; correo con forma');
  const dc = CB.validarDatosCobro({ razonSocial: 'Comercial Rosa Ltda.', rut: '', direccion: '', contacto: 'Rosa', periodo: 'semana', plazo: '', descuento: { tipo: 'pct', valor: '5', texto: 'Familia' } });
  ok(!dc.error && dc.datos.plazo === 7 && R.permitido(rosa, 'create', 'clientesCobro/c2', Object.assign(dc.datos, { por: 'rosa', en: R.TS }), null, leer, AHORA), 'los datos de cobro (plazo 7 por omisión) pasan las reglas');
  ok(!!CB.validarDatosCobro({ periodo: 'semana', plazo: '91' }).error && !!CB.validarDatosCobro({ periodo: 'año', plazo: '7' }).error, 'plazo de 0 a 90 días; período semanal o mensual');
  const esc = nuevo.escrituras.map(x => ({ ruta: x.ruta, datos: ts(x.datos) })), tr = Object.fromEntries(esc.map(x => [x.ruta, x.datos])), desp = r => (r in tr ? tr[r] : leer(r));
  ok(esc.every(x => R.permitido(rosa, 'create', x.ruta, x.datos, null, leer, AHORA, desp)), 'las escrituras de «Crear cliente» pasan las reglas (juntas)');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
