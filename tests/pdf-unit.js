/* PDF (Fase 12), sin navegador: APP/js/core/pdf.js (el escritor) y pdf-doc.js (el cobro, la cotización y el estado de cuenta).
   Lo abre un lector propio de las pruebas: revisa la estructura (cada objeto donde dice la tabla xref, startxref, la cantidad de páginas),
   saca el texto de cada página (con tildes y ñ, en la codificación WinAnsi de la letra) y comprueba que los montos quedan alineados a la
   derecha, que un cobro largo pasa a varias páginas con «Página X de Y» y que el anexo por día no tiene montos en dinero.
   Uso: node tests/pdf-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

/* ---------- Lector mínimo de los PDF que genera la app ---------- */
const W = { 0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—' };
const texto = b => Array.from(b, c => W[c] || String.fromCharCode(c)).join('');
function abrir(bytes) {
  const s = Buffer.from(bytes).toString('latin1'), err = [];
  if (!s.startsWith('%PDF-1.4\n')) err.push('sin cabecera');
  const sx = Number((/startxref\n(\d+)\n%%EOF\n$/.exec(s) || [])[1]);
  if (s.slice(sx, sx + 4) !== 'xref') err.push('startxref no apunta a la tabla');
  const m = /^xref\n0 (\d+)\n/.exec(s.slice(sx)), n = Number(m && m[1]), filas = s.slice(sx).split('\n').slice(2, 2 + n);
  const objs = {};
  filas.forEach((f, i) => { if (!i) return; const pos = Number(f.slice(0, 10)); if (!s.startsWith(i + ' 0 obj\n', pos)) err.push('el objeto ' + i + ' no está donde dice la tabla');
    objs[i] = s.slice(pos, s.indexOf('\nendobj\n', pos)); });
  const trailer = /trailer\n<< \/Size (\d+) \/Root (\d+) 0 R \/Info (\d+) 0 R >>/.exec(s);
  if (!trailer || Number(trailer[1]) !== n) err.push('trailer');
  const paginas = Number((/\/Count (\d+)/.exec(objs[2]) || [])[1]);
  const kids = ((/\/Kids \[([^\]]*)\]/.exec(objs[2]) || [])[1] || '').match(/\d+ 0 R/g) || [];
  const contenido = kids.map(k => { const o = objs[Number(k.split(' ')[0])], c = Number(/\/Contents (\d+) 0 R/.exec(o)[1]), x = objs[c];
    const L = Number(/\/Length (\d+)/.exec(x)[1]), ini = x.indexOf('stream\n') + 7, st = x.slice(ini, ini + L);
    if (x.slice(ini + L, ini + L + 10) !== '\nendstream') err.push('largo del contenido mal');
    return st; });
  /* Texto de cada página: [{ x, y, t, tam, negrita }] en el orden en que se escribió. */
  const textos = contenido.map(st => [...st.matchAll(/BT \/(F[12]) ([\d.]+) Tf [\d. ]+ rg 1 0 0 1 ([\d.-]+) ([\d.-]+) Tm \(((?:\\.|[^\\)])*)\) Tj ET/g)].map(m => {
    const raw = m[5].replace(/\\([0-7]{3}|.)/g, (z, e) => (e.length === 3 ? String.fromCharCode(parseInt(e, 8)) : e)), b = Array.from(raw, ch => ch.charCodeAt(0));
    return { negrita: m[1] === 'F2', tam: Number(m[2]), x: Number(m[3]), y: Number(m[4]), t: texto(b) };
  }));
  return { err, paginas, kids: kids.length, textos, todo: textos.map(p => p.map(x => x.t).join('\n')), objs, bytes: s.length, ascii: !/[^\x00-\x7F]/.test(s.slice(15)) };
}

(async () => {
  const P = await import('../APP/js/core/pdf.js'), D = await import('../APP/js/core/pdf-doc.js'), CB = await import('../APP/js/core/cobros.js'), A = await import('../APP/js/core/abonos.js');

  console.log('1. El escritor');
  const doc = P.nuevo({ titulo: 'Prueba Ñandú' }); const p1 = doc.pagina();
  p1.texto(50, 60, 'Panadería: pan, ñoquis, ¿qué tal? ¡Sí! 25 °C · «hola» – Ü', { tam: 12, negrita: true }); p1.rect(50, 80, 100, 20, { relleno: '#F3E6D3', borde: '#9A5B13' }); p1.linea(50, 120, 300, 120);
  p1.texto(300, 140, '(paréntesis) y \\ barra', {}); doc.pagina().texto(50, 60, 'Segunda');
  const r = abrir(doc.bytes());
  ok(r.err.length === 0, 'estructura: cabecera, cada objeto donde dice la tabla xref, startxref y trailer' + (r.err.length ? ' · ' + r.err.join(', ') : ''));
  ok(r.paginas === 2 && r.kids === 2 && /MediaBox \[0 0 612 792\]/.test(r.objs[5]), 'dos páginas tamaño carta (612 × 792 puntos)');
  ok(r.textos[0][0].t === 'Panadería: pan, ñoquis, ¿qué tal? ¡Sí! 25 °C · «hola» – Ü' && r.textos[0][0].negrita && r.textos[0][1].t === '(paréntesis) y \\ barra', 'tildes, ñ, ¿ ¡ ° « » – y los paréntesis y la barra se leen tal cual');
  ok(r.ascii && /\/Encoding \/WinAnsiEncoding/.test(r.objs[3]) && /Helvetica-Bold/.test(r.objs[4]), 'el archivo queda en ASCII (lo demás en octal) con Helvetica y Helvetica-Bold en WinAnsi');
  ok(r.textos[0][0].y === 732 && r.textos[0][0].x === 50, 'las coordenadas desde arriba pasan a las del PDF (y = 792 − 60)');
  ok(Math.abs(P.ancho('Hola', 10) - (722 + 556 + 222 + 556) / 100) < 1e-9 && P.ancho('á', 10) === P.ancho('a', 10) && P.ancho('M', 10, true) === 8.33, 'anchos de Helvetica (las letras con tilde miden como su letra)');
  ok(P.ajustar('uno dos tres cuatro cinco seis siete', 60, 10).length >= 3 && P.ajustar('uno dos tres cuatro cinco seis siete', 60, 10).every(l => P.ancho(l, 10) <= 60) && P.ajustar('x'.repeat(80), 60, 10).every(l => P.ancho(l, 10) <= 60), 'cortar en líneas que caben (también una palabra larguísima)');
  ok(P.cortar('Un nombre de pan bastante largo', 80, 10).endsWith('…') && P.ancho(P.cortar('Un nombre de pan bastante largo', 80, 10), 10) <= 80, 'recortar con «…»');
  const der = P.nuevo(); const pd = der.pagina(); pd.texto(500, 100, '$1.234', { alinear: 'der' }); pd.texto(500, 120, '$99', { alinear: 'der' });
  const rd = abrir(der.bytes()).textos[0];
  ok(Math.abs(rd[0].x + P.ancho('$1.234', 10) - 500) < 0.02 && Math.abs(rd[1].x + P.ancho('$99', 10) - 500) < 0.02, 'alineados a la derecha: terminan en el mismo punto');

  console.log('2. El cobro');
  const emisor = CB.emisorFijo({ razonSocial: 'Panadería Familiar SpA', rut: '76.123.456-0', direccion: 'Av. Ñuñoa 123', correo: 'hola@example.com', banco: 'Banco Estado', tipoCuenta: 'Cuenta corriente', cuenta: '123456789', rutCuenta: '76.123.456-0', correoAviso: 'pagos@example.com' });
  const lineas = [{ fecha: '2026-11-10', entregaN: 1, productoId: 'mar', nombre: 'Marraqueta', unidad: 'kg', cantidad: 40, precio: 1600, neto: 64000 }, { fecha: '2026-11-11', entregaN: 1, productoId: 'com', nombre: 'Pan de completo', unidad: 'un', cantidad: 300, precio: 110, neto: 33000 }];
  const armado = CB.armar(lineas, { iva: 19, descuento: { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' } });
  const cobro = CB.documento({ numero: 12, clienteId: 'c2', cliente: { nombre: 'Almacén Rosa', razonSocial: 'Comercial Rosa Ltda.', rut: '77.888.999-K', direccion: 'Calle Ñuble 45', contacto: 'Rosa' }, emisor, fecha: '2026-11-17', desde: '2026-11-10', hasta: '2026-11-16', periodo: 'semana', armado, iva: 19, plazo: 7, factura: '4521', por: 'rosa', quien: 'Rosa' });
  const abonos = [{ id: 'a', clienteId: 'c2', fecha: '2026-11-19', monto: 9659, aplicado: [{ cobro: 12, monto: 9659, previo: true }], aFavor: 0 }, { id: 'b', clienteId: 'c2', fecha: '2026-11-20', monto: 50000, aplicado: [{ cobro: 12, monto: 50000 }], aFavor: 0 }];
  const rc = abrir(D.cobro(cobro, { hoy: '2026-11-21', estado: A.estado(cobro, abonos, '2026-11-21'), pendientes: [{ numero: 11, desde: '2026-11-03', hasta: '2026-11-09', periodo: 'semana', saldo: 12345 }] })), t1 = rc.todo[0];
  ok(rc.err.length === 0 && rc.paginas === 2, 'se abre: una página de cobro y otra del anexo');
  ok(/COBRO N.º 0012/.test(t1) && /Panadería Familiar SpA/.test(t1) && /RUT 76.123.456-0/.test(t1) && /Av. Ñuñoa 123/.test(t1) && /17-11-2026/.test(t1) && /24-11-2026/.test(t1) && /Factura SII\n4521/.test(t1), 'encabezado: número, datos de la panadería, emisión, vencimiento y factura');
  ok(/Comercial Rosa Ltda\.\nAlmacén Rosa\nRUT 77.888.999-K\nCalle Ñuble 45/.test(t1) && /Semana del 10 al 16 de noviembre de 2026/.test(t1), 'cliente (razón social, nombre, RUT, dirección) y período');
  ok(/Marraqueta\n40,00 kg\n\$1\.904 el kg\n\$76\.160/.test(t1) && /Pan de completo\n300 un\n\$130,90 c\/u\n\$39\.270/.test(t1), 'una línea por pan: cantidad, precio con IVA y monto con IVA');
  ok(/Subtotal\n\$115\.430\nDescuento familia 5 %\n-\$5\.772\nAjuste por redondeo\n\$1\nTotal del cobro\n\$109\.659/.test(t1) && /Neto \$92\.150 · IVA 19 % \$17\.509 · Total \$109\.659/.test(t1), 'subtotal, descuento, ajuste por redondeo, total y el desglose neto · IVA · total');
  ok(/Saldo a favor anterior\n-\$9\.659\nAbonado\n-\$50\.000\nSaldo de este cobro\n\$50\.000/.test(t1) && /Estado al 21-11-2026/.test(t1), 'lo abonado (con el saldo a favor anterior aparte) y el saldo de este cobro, al día de la descarga');
  ok(/Cobros anteriores pendientes/.test(t1) && /0011\nSemana del 3 al 9 de noviembre de 2026\n\$12\.345/.test(t1) && /Total adeudado\n\$62\.345/.test(t1), 'cobros anteriores pendientes y el total adeudado');
  ok(/Datos para transferir/.test(t1) && /Banco: Banco Estado/.test(t1) && /Cuenta corriente n.º 123456789/.test(t1) && /Aviso del pago a: pagos@example.com/.test(t1) && /Plazo de pago: 7 días/.test(t1), 'datos para transferir y plazo');
  ok(/Documento de cobro\. No válido como factura\.\nPágina 1 de 2/.test(t1) && /Página 2 de 2/.test(rc.todo[1]), 'el pie en cada página: «No válido como factura» y «Página X de Y»');
  const montos = rc.textos[0].filter(x => /^-?\$[\d.]+$/.test(x.t) && x.x > 500);
  const fin = x => Math.round((x.x + P.ancho(x.t, x.tam, x.negrita)) * 10) / 10;
  ok(montos.length >= 8 && montos.every(x => fin(x) === 556 || fin(x) === 558), 'los montos de la tabla y de los totales terminan en el mismo borde derecho');
  ok(/Anexo · detalle por día \(sin montos\)/.test(rc.todo[1]) && /10-11-2026\n1\nMarraqueta 40,00 kg/.test(rc.todo[1]) && !/\$/.test(rc.todo[1].replace(/Página.*$/, '')), 'anexo por día: panes y cantidades, sin dinero');
  const anulado = abrir(D.cobro(Object.assign({}, cobro, { anulado: { motivo: 'Canastos corregidos' } }), { hoy: '2026-11-21' })).todo[0];
  ok(/ANULADO: Canastos corregidos/.test(anulado) && !/Cobros anteriores/.test(anulado), 'un cobro anulado lo dice arriba');
  /* Un cobro largo: 60 líneas y 62 días. */
  const largo = Array.from({ length: 60 }, (x, i) => ({ fecha: '2026-11-' + String(1 + (i % 28)).padStart(2, '0'), entregaN: 1, productoId: 'p' + i, nombre: 'Pan número ' + i + ' con nombre largo', unidad: i % 2 ? 'un' : 'kg', cantidad: 10 + i, precio: 1000 + i, neto: (10 + i) * (1000 + i) }));
  const aL = CB.armar(largo, { iva: 19 }), cL = CB.documento({ numero: 13, clienteId: 'c1', cliente: { nombre: 'Supermercado' }, emisor, fecha: '2026-12-01', desde: '2026-11-01', hasta: '2026-11-30', periodo: 'mes', armado: aL, iva: 19, plazo: 30, por: 'r', quien: 'R' });
  const rl = abrir(D.cobro(cL, { hoy: '2026-12-01' }));
  ok(rl.err.length === 0 && rl.paginas >= 3 && rl.todo.every((t, i) => t.includes('Página ' + (i + 1) + ' de ' + rl.paginas)) && /continuación/.test(rl.todo[1]), 'un cobro largo pasa a varias páginas (' + rl.paginas + '), con encabezado corto y «Página X de Y»');
  ok(rl.textos.every(p => p.every(x => x.y > 40 || /Página|Documento/.test(x.t))), 'nada se escribe sobre el pie');

  console.log('3. La cotización y el estado de cuenta');
  const cot = { numero: 3, para: { nombre: 'Casino Sur', contacto: 'Ana', razonSocial: '', rut: '', direccion: '' }, cantidadesPor: 'semana', lineas: [{ productoId: 'mar', nombre: 'Marraqueta', unidad: 'kg', neto: 1550, conIva: 1844.5, cantidad: 40, monto: 73780 }, { productoId: 'com', nombre: 'Pan de completo', unidad: 'un', neto: 120, conIva: 142.8, cantidad: null, monto: null }],
    descuento: null, neto: 62000, netoFinal: 62000, iva: 19, ivaMonto: 11780, total: 73780, ajuste: 0, fecha: '2026-11-21', validaHasta: '2026-12-06', emisor };
  const rq = abrir(D.cotizacion(cot)), tq = rq.todo[0];
  ok(rq.err.length === 0 && /COTIZACIÓN N.º 0003/.test(tq) && /Válida hasta\n06-12-2026/.test(tq) && /Casino Sur/.test(tq) && /\$1\.844,50 el kg\n40,00 kg\n\$73\.780/.test(tq) && /Total estimado por semana\n\$73\.780/.test(tq), 'cotización: número, validez, para quién, precios con IVA, cantidades y total estimado');
  ok(/No es un documento tributario/.test(tq) && /Las cantidades son estimadas/.test(tq), 'con su propio pie');
  const ec = A.estadoCuenta([Object.assign({}, cobro, { en: 1 })], abonos, 'c2', '2026-11-01', '2026-11-30');
  const re = abrir(D.estadoCuenta(ec, { cliente: cobro.cliente, emisor, hoy: '2026-11-21' })), te = re.todo[0];
  ok(re.err.length === 0 && /ESTADO DE CUENTA/.test(te) && /Saldo anterior al 01-11-2026\n\$0/.test(te) && /17-11-2026\nCobro N.º 0012/.test(te) && /Saldo adeudado\n\$50\.000/.test(te), 'estado de cuenta: saldo anterior, movimientos con saldo corrido y saldo adeudado');
  ok(CB.nombreArchivo(cobro) === 'cobro-0012-almacen-rosa-2026-11-10.pdf' && A.nombreEstadoCuenta('Almacén Rosa', '2026-11-21', CB.slug) === 'estado-de-cuenta-almacen-rosa-2026-11-21.pdf', 'nombres de archivo');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
