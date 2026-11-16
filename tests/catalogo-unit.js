/* Catálogo sin navegador (APP/js/core/catalogo.js): números a la chilena, IVA y montos, productos, orden, trabajadores, cliente
   y, sobre todo, la vigencia de los precios: «un cambio de precio no altera los montos de días anteriores» (PLAN, Fase 3).
   Uso: node tests/catalogo-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const C = await import('../APP/js/core/catalogo.js');

  console.log('1. Números y pesos');
  ok(C.numero('1.450') === 1450 && C.numero('1450') === 1450 && C.numero('$ 1.450') === 1450 && C.numero('12.345.678') === 12345678, 'el punto separa miles: 1.450 es mil cuatrocientos cincuenta');
  ok(C.numero('1.512,61') === 1512.61 && C.numero('0,5') === 0.5 && C.numero('1512,61') === 1512.61 && C.numero('1450.5') === 1450.5, 'la coma (o un punto con decimales) marca los decimales');
  ok([C.numero(''), C.numero('abc'), C.numero('1,2,3'), C.numero('-5'), C.numero('1.45,2'), C.numero(null)].every(Number.isNaN), 'lo que no es un número se rechaza');
  ok(C.pesos(1450) === '$1.450' && C.pesos(1512.61) === '$1.512,61' && C.pesos(0) === '$0' && C.pesos(1234567.5) === '$1.234.567,50', 'los precios se muestran con punto de miles y, si hace falta, dos decimales');
  ok(C.enCampo(1512.61) === '1512,61' && C.enCampo(19) === '19' && C.enCampo(null) === '', 'un número vuelve al campo con coma decimal');

  console.log('2. IVA y montos');
  ok(C.ivaDe({ iva: 19 }) === 19 && C.ivaDe(null) === 19 && C.ivaDe({ iva: 0 }) === 0, 'el IVA sale de la configuración del negocio (19 % si falta)');
  ok(Math.round(C.conIva(1450, 19)) === 1726 && eq(C.montos(1450, 18.5, 19), { neto: 26825, iva: 5097, total: 31922 }), 'neto + IVA = total, en pesos enteros');
  ok(C.validarIva('19').iva === 19 && C.validarIva('19,5').iva === 19.5 && !!C.validarIva('150').error && !!C.validarIva('').error, 'el IVA va entre 0 y 100');

  console.log('3. Productos');
  const otros = [{ id: 'a', nombre: 'Marraqueta', unidad: 'kg', activo: true }];
  ok(eq(C.validarProducto({ nombre: '  Hallulla   especial ', unidad: 'kg', categoria: ' Corriente ', orden: 2 }, otros).datos, { nombre: 'Hallulla especial', unidad: 'kg', activo: true, categoria: 'Corriente', orden: 2 }), 'limpia espacios y arma el documento');
  ok(/nombre/.test(C.validarProducto({ nombre: ' ', unidad: 'kg' }, otros).error) && /Ya hay/.test(C.validarProducto({ nombre: 'MARRAQUETA', unidad: 'kg' }, otros).error), 'pide nombre y no deja repetirlo (sin importar mayúsculas)');
  ok(/kilo o por unidad/.test(C.validarProducto({ nombre: 'Pan', unidad: '' }, []).error), 'pide la unidad');
  ok(C.validarProducto({ nombre: 'Pan de completo', unidad: 'un', pesoRef: '100' }, []).datos.pesoRef === 100 && !('pesoRef' in C.validarProducto({ nombre: 'Pan', unidad: 'un', pesoRef: '' }, []).datos), 'por unidad: peso de referencia en gramos, opcional');
  ok(!('pesoRef' in C.validarProducto({ nombre: 'Pan', unidad: 'kg', pesoRef: '100' }, []).datos) && /gramos/.test(C.validarProducto({ nombre: 'Pan', unidad: 'un', pesoRef: 'cien' }, []).error), 'por kilo no lleva peso; un peso mal escrito se avisa');
  ok(C.detalleProducto({ unidad: 'un', pesoRef: 100, categoria: 'Especiales' }) === 'Por unidad · 100 g c/u · Especiales' && C.detalleProducto({ unidad: 'kg' }) === 'Por kilo', 'el detalle se lee de corrido');
  ok(eq(C.soloProducto({ id: 'x', nombre: 'Pan', unidad: 'kg', activo: true, en: 5, pesoRef: 3, orden: 1 }), { nombre: 'Pan', unidad: 'kg', activo: true, orden: 1 }), 'al reescribir un producto no viajan el id ni campos de más');
  ok(/^[A-Za-z0-9]{20}$/.test(C.nuevoId()) && C.nuevoId() !== C.nuevoId(), 'los identificadores nuevos tienen 20 letras y números al azar');

  console.log('4. Orden de la lista');
  const L = [{ id: 'c', nombre: 'Colisa', activo: true }, { id: 'a', nombre: 'Marraqueta', orden: 1, activo: true }, { id: 'b', nombre: 'Hallulla', orden: 2, activo: true }, { id: 'z', nombre: 'Antiguo', orden: 0, activo: false }];
  ok(eq(C.ordenarProductos(C.activos(L)).map(p => p.id), ['a', 'b', 'c']), 'por orden, y sin orden al final por nombre');
  ok(eq(C.mover(L, 'b', -1).map(p => [p.id, p.orden]), [['b', 1], ['a', 2], ['c', 3]]), 'subir cambia de lugar con el anterior y deja la lista numerada');
  ok(C.mover(L, 'a', -1).length === 0 && C.mover(L, 'c', 1).length === 0 && C.mover(L, 'z', 1).length === 0, 'el primero no sube, el último no baja y un desactivado no se mueve');
  ok(C.siguienteOrden(L) === 3, 'uno nuevo va al final');

  console.log('5. Precios con vigencia: un cambio de precio no altera los días anteriores');
  const P = [{ id: 'm_s_2026-01-01', productoId: 'm', clienteId: 's', neto: 1400, desde: '2026-01-01' }, { id: 'h_s_2026-01-01', productoId: 'h', clienteId: 's', neto: 1500, desde: '2026-01-01' }];
  const monto = (precios, fecha, kilos) => { const p = C.precioVigente(precios, 'm', 's', fecha); return p ? C.montos(p.neto, kilos, 19) : null; };
  const DIAS = ['2026-01-01', '2026-06-30', '2026-11-14'], antes = DIAS.map(d => monto(P, d, 120.5));
  const P2 = P.concat([{ id: 'm_s_2026-11-15', productoId: 'm', clienteId: 's', neto: 1550, desde: '2026-11-15' }]);
  ok(eq(DIAS.map(d => monto(P2, d, 120.5)), antes) && antes[0].neto === 168700, 'tras subir el precio el 15-nov, los montos de enero, junio y el 14-nov quedan iguales');
  ok(monto(P2, '2026-11-15', 120.5).neto === 186775 && monto(P2, '2027-03-01', 10).neto === 15500, 'y desde el 15-nov se cobra el precio nuevo');
  ok(C.precioVigente(P2, 'h', 's', '2026-12-01').neto === 1500, 'el precio de otro producto no cambia');
  ok(C.precioVigente(P2, 'm', 's', '2025-12-31') === null && C.precioVigente(P2, 'm', 'otro', '2026-12-01') === null, 'antes del primer precio (o para otro cliente) no hay precio');
  const P3 = P2.concat([{ id: 'm_s_2027-01-01', productoId: 'm', clienteId: 's', neto: 1600, desde: '2027-01-01' }]);
  ok(C.precioVigente(P3, 'm', 's', '2026-12-31').neto === 1550 && C.precioFuturo(P3, 'm', 's', '2026-11-20').neto === 1600 && C.precioFuturo(P2, 'm', 's', '2026-11-20') === null, 'un precio anotado para más adelante aún no rige y se anuncia');
  ok(eq(C.historial(P3, 'm', 's').map(p => p.desde), ['2027-01-01', '2026-11-15', '2026-01-01']), 'el historial va del más nuevo al más antiguo');
  ok(eq(DIAS.map(d => monto(P3.filter(p => p.id !== 'm_s_2026-11-15'), d, 120.5)), antes), 'quitar un precio tampoco cambia los días anteriores a su fecha');
  ok(C.idPrecio('m', 's', '2026-11-15') === 'm_s_2026-11-15', 'un solo precio por producto, cliente y fecha (mismo identificador)');
  ok(eq(C.validarPrecio({ neto: '1.550', desde: '2026-11-15' }).datos, { neto: 1550, desde: '2026-11-15' }) && C.validarPrecio({ neto: '1512,614', desde: '2026-11-15' }).datos.neto === 1512.61, 'el precio se lee a la chilena, con hasta dos decimales');
  ok(!!C.validarPrecio({ neto: '0', desde: '2026-11-15' }).error && !!C.validarPrecio({ neto: 'mil', desde: '2026-11-15' }).error && !!C.validarPrecio({ neto: '1500', desde: '' }).error && !!C.validarPrecio({ neto: '1500', desde: '2026-02-30' }).error, 'precio en cero, mal escrito, sin fecha o con una fecha que no existe: se rechaza');

  console.log('6. Trabajadores y cliente');
  ok(C.validarNombre('  Luis   Soto ', []).nombre === 'Luis Soto' && !!C.validarNombre('', []).error && /Ya hay un trabajador/.test(C.validarNombre('luis soto', [{ nombre: 'Luis Soto' }], 'un trabajador').error), 'nombre limpio, obligatorio y sin repetir');
  ok(eq(C.ordenarPersonas([{ nombre: 'Óscar' }, { nombre: 'Ana' }, { nombre: 'Marta' }]).map(x => x.nombre), ['Ana', 'Marta', 'Óscar']), 'la lista va por nombre');
  ok(C.clientePrincipal([{ id: 'b', nombre: 'Nuevo', activo: true, en: 9 }, { id: 'a', nombre: 'Supermercado', activo: true, en: 1 }, { id: 'c', nombre: 'Viejo', activo: false, en: 0 }]).id === 'a' && C.clientePrincipal([]) === null && C.clientePrincipal(null) === null, 'el cliente de los precios es el activo más antiguo');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
