/* Cierres mensuales (APP/js/core/xlsx-leer.js y cierres.js), sin navegador: el lector de Excel comprimido, cómo se interpretan
   distintos formatos de planilla, el emparejamiento de nombres con el catálogo, el documento del cierre (pasa por la copia de las reglas),
   «Cerrar mes» con los datos de la app y el «Listo cuando» de la Fase 6: 10 meses importados coinciden con los totales de sus Excel.
   Los archivos de tests/fixtures/ los armaron openpyxl y LibreOffice (Excel de verdad: comprimidos, con textos compartidos y fechas).
   Uso: node tests/cierres-unit.js */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { abrirZip, crc32 } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n));
/* Vuelve a armar un .xlsx (sin comprimir, como los de la app) comprimiéndolo con deflate, como lo guarda Excel. */
function comprimir(bytes) {
  const a = abrirZip(bytes), partes = [], centro = []; let pos = 0;
  for (const [nombre, datos] of Object.entries(a)) {
    const nb = Buffer.from(nombre), comp = zlib.deflateRawSync(datos), crc = crc32(datos), loc = Buffer.alloc(30), cen = Buffer.alloc(46);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(datos.length, 22); loc.writeUInt16LE(nb.length, 26);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(datos.length, 24); cen.writeUInt16LE(nb.length, 28); cen.writeUInt32LE(pos, 42);
    partes.push(loc, nb, comp); centro.push(cen, nb); pos += 30 + nb.length + comp.length;
  }
  const c = Buffer.concat(centro), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(centro.length / 2, 8); fin.writeUInt16LE(centro.length / 2, 10); fin.writeUInt32LE(c.length, 12); fin.writeUInt32LE(pos, 16);
  return new Uint8Array(Buffer.concat(partes.concat([c, fin])));
}

(async () => {
  const XL = await import('../APP/js/core/xlsx-leer.js'), CI = await import('../APP/js/core/cierres.js'), X = await import('../APP/js/core/xlsx.js');
  const V = await import('../APP/js/core/ventas.js'), R = await import('./fake-firebase/reglas.mjs');
  const HOY = '2026-11-17';
  const prods = [{ id: 'p1', nombre: 'Marraqueta', unidad: 'kg', orden: 1 }, { id: 'p2', nombre: 'Hallulla', unidad: 'kg', orden: 2 }, { id: 'p3', nombre: 'Pan de completo', unidad: 'un', orden: 3 },
    { id: 'p4', nombre: 'Colisa', unidad: 'kg', orden: 4, activo: false }, { id: 'p5', nombre: 'Dobladita', unidad: 'kg', orden: 5 }, { id: 'p6', nombre: 'Amasado', unidad: 'kg', orden: 6 }];
  const libro = async n => XL.leer(new Uint8Array(fx(n)));

  console.log('1. Lector de Excel (archivos comprimidos de Excel y LibreOffice)');
  const oct = await libro('cierre-octubre-2026.xlsx'), f0 = oct.hojas[0].filas;
  ok(oct.hojas.length === 1 && f0[0][0] === 'Panadería · Cierre de octubre 2026' && f0[2].join('|') === 'Tipo de pan|Kilos|Unidades|Precio neto|Monto', 'lee textos compartidos (con tildes) y la fila de títulos');
  ok(f0[3][1] === 1234.5 && f0[3][4] === 1790025 && f0[7][0] === '  Dobladitas ' && f0[7][3] === 1612.61 && f0[9][4] === 3632570, 'lee números y el valor ya calculado de las fórmulas (SUMA)');
  const ene = await libro('Cierres 2026.xlsx');
  ok(ene.hojas.map(h => h.nombre).join() === 'Enero,Febrero,Notas' && ene.hojas[0].filas[1][1] === '2026-01-28', 'varias hojas, y una celda con formato de fecha sale como AAAA-MM-DD');
  const propio = X.crear([{ nombre: 'A & B', filas: [['Pan', 'Kilos'], ['Marraqueta', 12.35], [{ v: '2026-03-31', s: 'fecha' }]] }]);
  const p1 = await XL.leer(propio), p2 = await XL.leer(comprimir(propio));
  ok(p1.hojas[0].nombre === 'A & B' && p1.hojas[0].filas[1][1] === 12.35 && p1.hojas[0].filas[2][0] === '2026-03-31' && JSON.stringify(p1) === JSON.stringify(p2), 'lee los Excel que hace la app, sin comprimir y comprimidos (mismo resultado)');
  const malo = async (b, m) => { try { await XL.leer(b); ok(false, m + ' (no avisó)'); } catch (e) { ok(e.code === 'xlsx' && e.message.length > 5, m + ': «' + e.message + '»'); } };
  await malo(new TextEncoder().encode('Pan;Kilos\nMarraqueta;10'), 'un archivo que no es Excel');
  await malo(fx('marzo.xlsx').subarray(0, 2000), 'un Excel cortado a la mitad');
  const dañado = new Uint8Array(fx('marzo.xlsx')), hoja1 = Buffer.from(dañado).indexOf('xl/worksheets/sheet1.xml'); dañado[hoja1 + 60] ^= 0xff;
  await malo(dañado, 'un Excel con un byte cambiado (la firma CRC no cuadra)');
  await malo(new Uint8Array(0), 'un archivo vacío');
  ok(XL.fechaDeSerie(46342) === '2026-11-16' && XL.fechaDeSerie(-1) === null && XL.textoXml('a&amp;b &#241; &#x00F1;') === 'a&b ñ ñ', 'fechas de Excel y textos del XML');

  console.log('2. Textos de las planillas');
  ok(['2026-10', '10-2026', '31/10/2026', 'Octubre 2026', 'cierre_10_2026', 'OCT 2026'].every(t => CI.mesDeTexto(t, HOY) === '2026-10'), 'el mes escrito de muchas formas');
  ok(CI.mesDeTexto('marzo', HOY) === '2026-03' && CI.mesDeTexto('diciembre', HOY) === '2025-12' && CI.mesDeTexto('Hoja1', HOY) === '' && CI.mesDeTexto('Enero', HOY, 2027) === '2027-01', 'sin año: el de hoy, o el anterior si ese mes aún no llega');
  ok(CI.numeroDe('1.234,5') === 1234.5 && CI.numeroDe('$1.400') === 1400 && CI.numeroDe('1,234.50') === 1234.5 && CI.numeroDe('12,5 kg') === 12.5 && Number.isNaN(CI.numeroDe('abc')) && CI.numeroDe(7) === 7, 'números a la chilena, con $ o con «kg»');
  ok(CI.unidadDe('Kilos') === 'kg' && CI.unidadDe('UN') === 'un' && CI.unidadDe('c/u') === 'un' && CI.unidadDe('caja') === null, 'unidades');
  const cab = r => JSON.stringify(CI.encabezado(r));
  ok(cab(['Tipo de pan', 'Kilos', 'Unidades', 'Precio neto', 'Monto']) === '{"pan":0,"kg":1,"un":2,"precio":3,"neto":4}' && cab(['Pan', 'Cantidad', 'Unidad', 'Precio', 'Neto', 'IVA', 'Total']) === '{"pan":0,"cantidad":1,"unidad":2,"precio":3,"neto":4,"iva":5,"total":6}',
    'reconoce los títulos de las columnas');
  ok(cab(['Producto', 'Total kilos', 'Valor unitario', 'Total neto', 'Total con IVA']) === '{"pan":0,"kg":1,"precio":2,"neto":3,"total":4}' && cab(['Pan de completo', 2900, 'un']) === 'null' && cab(['Fecha de cierre', 'enero']) === 'null', '«Total kilos» es cantidad, «Total neto» es neto; una fila con números no es de títulos');

  console.log('3. Interpretar distintos formatos');
  const I1 = CI.interpretar(oct, 'cierre-octubre-2026.xlsx', HOY), m1 = I1.meses[0];
  ok(I1.meses.length === 1 && m1.mes === '2026-10' && m1.filas.length === 5 && m1.total && m1.total.neto === 3632570 && m1.total.kg === 2203 && m1.total.un === 3200, 'octubre: el mes sale del título; 5 panes y la fila TOTAL aparte');
  ok(m1.filas[2].un === 3200 && Number.isNaN(m1.filas[2].kg) && m1.filas[0].kg === 1234.5, 'kilos y unidades en columnas separadas');
  const I2 = CI.interpretar(ene, 'Cierres 2026.xlsx', HOY);
  ok(I2.meses.map(m => m.mes + ':' + m.filas.length).join() === '2026-01:3,2026-02:2' && I2.meses[0].total.neto === 2889060, 'una hoja por mes (el mes sale de la fecha del cierre), con IVA y total aparte');
  ok(I2.avisos.length === 0, 'una hoja solo con comentarios no molesta');
  const I3 = CI.interpretar(await libro('marzo.xlsx'), 'marzo.xlsx', HOY), m3 = I3.meses[0];
  ok(m3.mes === '2026-03' && m3.filas[0].kg === 1180.5 && m3.filas[0].neto === 1652700 && m3.total.neto === 2688063 && /Total/.test(m3.avisos[0]), 'marzo: mes del nombre del archivo, números escritos como texto y «Total» tomado como neto (con aviso)');
  const bruto = X.crear([{ nombre: 'Abril 2026', filas: [['Pan', 'Kilos', 'Precio', 'Total'], ['Marraqueta', 100, 1400, 166600], ['Hallulla', 50, 1500, 89250], ['Total', 150, null, 255850]] }]);
  const m4 = CI.interpretar(await XL.leer(bruto), 'abril.xlsx', HOY).meses[0];
  ok(m4.mes === '2026-04' && m4.filas[0].neto === 140000 && m4.filas[1].neto === 75000 && m4.total.neto === 215000 && /IVA/.test(m4.avisos[0]), 'si «Total» trae el IVA (precio × kilos × 1,19), se descuenta');
  const largo = X.crear([{ nombre: 'Cierres', filas: [['Mes', 'Pan', 'Unidad', 'Cantidad', 'Precio neto', 'Neto'], ['2026-05', 'Marraqueta', 'kg', 900, 1400, null], ['2026-05', 'Pan de completo', 'un', 2000, 120, 240000],
    ['2026-06', 'Marraqueta', 'kg', 950, 1400, 1330000], ['2026-06', 'Hallulla', 'kg', 10, 1500, null], ['2026-07', 'Hallulla', 'kg', null, null, null]] }]);
  const I5 = CI.interpretar(await XL.leer(largo), 'plantilla-cierres.xlsx', HOY);
  ok(I5.meses.map(m => m.mes + ':' + m.filas.length).join() === '2026-05:2,2026-06:2' && I5.meses[0].filas[0].neto === 1260000 && I5.meses[0].filas[0].netoCalculado, 'la plantilla: varios meses en una hoja, y el neto vacío se calcula (precio × cantidad)');
  const pl = CI.plantilla(prods), lp = await XL.leer(X.crear(pl));
  ok(lp.hojas[0].filas[0].join() === 'Mes,Pan,Unidad,Cantidad,Precio neto,Neto' && lp.hojas[0].filas.length === 6 && CI.interpretar(lp, 'plantilla-cierres.xlsx', HOY).meses.length === 0, 'la plantilla trae los panes activos del catálogo y, vacía, no importa nada');

  console.log('4. Emparejar con el catálogo');
  ok(CI.clave('Hallullas') === CI.clave('Hallulla') && CI.clave('Pan Marraqueta') === CI.clave('marraquetas') && CI.clave('  Dobladitas ') === CI.clave('Dobladita') && CI.clave('Pan de completo') === 'completo', 'sin tildes, mayúsculas, «pan de» ni plurales');
  ok(CI.emparejar('MARRAQUETA', prods).id === 'p1' && CI.emparejar('Coliza', prods).id === null && CI.emparejar('Coliza', prods).sugeridos[0].id === 'p4', 'empareja solo lo seguro; «Coliza» queda por elegir, con «Colisa» como parecido');
  let P = CI.preparar(m1, prods, new Map(), 19);
  ok(!P.listo && P.sinEmparejar.join() === 'Coliza' && P.lineas.length === 4 && P.cuadra === true && P.cuadraCant === true, 'octubre: falta elegir «Coliza»; la suma de las filas ya cuadra con el total del Excel');
  P = CI.preparar(m1, prods, new Map([['coliza', 'p4']]), 19);
  ok(P.listo && P.totales.neto === 3632570 && P.totales.kg === 2203 && P.totales.un === 3200 && P.totales.iva === Math.round(3632570 * 0.19) && P.totales.total === 3632570 + P.totales.iva, 'eligiendo «Colisa»: neto, kilos y unidades iguales al total del Excel; IVA = 19 % del neto del mes');
  const Pn = CI.preparar(m1, prods, new Map([['coliza', CI.NUEVO]]), 19);
  ok(Pn.listo && Pn.lineas.some(l => l.productoId === CI.NUEVO + ':coliza' && l.unidad === 'kg' && l.cantidad === 55.5), 'o se crea un pan nuevo con el nombre del Excel');
  const Pu = CI.preparar(I2.meses[0], prods, new Map([['completo', 'p1']]), 19);
  ok(Pu.avisos.some(a => /unidades/.test(a)) && Pu.lineas.find(l => l.productoId === 'p1').filas === 2, 'avisa si el Excel dice unidades y el pan se vende por kilo, y junta dos nombres en un mismo pan');
  const P3 = CI.preparar(m3, prods, new Map([['amasado', 'p6']]), 19);
  ok(P3.listo && P3.totales.neto === 2688063 && P3.cuadra && P3.cuadraCant, 'marzo: cuadra con su total');

  console.log('5. El documento del cierre (y la copia de las reglas lo acepta)');
  const quien = { uid: 'rosa', email: 'rosa@example.com', email_verified: true }, AHORA = Date.parse('2026-11-17T15:00:00Z');
  const base = { 'config/negocio': { duenos: ['rosa'], iva: 19 } }, leerDb = db => r => (r in db ? db[r] : null);
  const conTS = d => Object.assign({}, d, { en: R.TS });
  const d1 = CI.documento(P, { iva: 19, cliente: { id: 'c1', nombre: 'Supermercado' }, por: 'rosa', quien: 'Rosa', archivo: 'cierre-octubre-2026.xlsx', hoja: 'Hoja1' });
  ok(d1.mes === '2026-10' && d1.origen === 'excel' && d1.cerrado === true && d1.neto === 3632570 && d1.ivaMonto === 690188 && d1.total === 4322758 && d1.lineas.length === 5 && d1.lineas.find(l => l.productoId === 'p4').nombreExcel === 'Coliza', 'cierre de octubre: montos, por pan y el nombre que traía el Excel');
  ok(R.permitido(quien, 'create', 'cierres/2026-10', conTS(d1), null, leerDb(base), AHORA), 'las reglas aceptan el cierre importado');
  ok(!R.permitido(quien, 'create', 'cierres/2026-11', conTS(Object.assign({}, d1, { mes: '2026-11' })), null, leerDb(base), AHORA), 'pero no el del mes en curso');
  const pes = [['a', '2026-10-01', 1, 'p1', 20.5, 'kg'], ['b', '2026-10-01', 1, 'p1', 18.25, 'kg'], ['c', '2026-10-01', 2, 'p3', 300, 'un'], ['d', '2026-10-15', 1, 'p2', 12.4, 'kg'], ['e', '2026-10-15', 1, 'p5', 3, 'kg'], ['f', '2026-10-16', 1, 'p1', 99, 'kg', true]]
    .map(([id, fecha, entregaN, productoId, cantidad, unidad, anulado]) => ({ id, fecha, hora: '06:00', entregaN, productoId, cantidad, unidad, trabajadorId: 't1', anulado: !!anulado }));
  const precios = [{ productoId: 'p1', clienteId: 'c1', neto: 1450, desde: '2026-01-01' }, { productoId: 'p1', clienteId: 'c1', neto: 1512.61, desde: '2026-10-10' }, { productoId: 'p2', clienteId: 'c1', neto: 1500, desde: '2026-01-01' }, { productoId: 'p3', clienteId: 'c1', neto: 120, desde: '2026-01-01' }];
  const A = CI.desdeApp('2026-10', pes, { productos: prods, precios }, { id: 'c1', nombre: 'Supermercado' }, 19, { por: 'rosa', quien: 'Rosa' });
  const L = V.lineas(pes, prods, precios, 'c1', 19), netoL = L.reduce((t, l) => t + (l.neto || 0), 0);
  ok(A.doc.origen === 'app' && A.doc.neto === netoL && A.doc.ivaMonto === Math.round(netoL * 0.19) && A.doc.total === A.doc.neto + A.doc.ivaMonto && A.doc.kg === 54.15 && A.doc.un === 300 && A.doc.canastos === 5 && A.doc.dias === 2,
    '«Cerrar mes»: neto = suma de las líneas de venta, IVA = 19 % de ese neto, sin los anulados');
  ok(A.doc.sinPrecio === 1 && A.faltan[0].nombre === 'Dobladita' && A.doc.lineas.find(l => l.productoId === 'p5').sinPrecio === true && R.permitido(quien, 'create', 'cierres/2026-10', conTS(A.doc), null, leerDb(base), AHORA), 'marca los panes sin precio, y las reglas lo aceptan');
  const reab = { reabiertoPor: 'rosa', reabiertoQuien: 'Rosa', reabiertoEn: 1790000000000 };
  ok(CI.desdeApp('2026-10', pes, { productos: prods, precios }, null, 19, { por: 'rosa', quien: 'Rosa', antes: Object.assign({ cerrado: false }, reab) }).doc.reabiertoQuien === 'Rosa', 'al volver a cerrar un mes reabierto queda la constancia de la reapertura');
  ok(V.ivaSobre(3632570, 19) === 690188 && V.totales(L).iva === V.ivaSobre(netoL, 19) && V.totales(L).total === netoL + V.ivaSobre(netoL, 19), 'en la app, el IVA de un total es el 19 % de su neto (como el cierre)');

  console.log('6. Meses cerrados');
  const cierres = [{ id: '2026-10', cerrado: true, origen: 'excel' }, { id: '2026-09', cerrado: false, origen: 'app' }];
  ok(CI.cerradoEl(cierres, '2026-10-31') && !CI.cerradoEl(cierres, '2026-09-30') && !CI.cerradoEl(cierres, '2026-11-01') && !CI.cerradoEl(null, '2026-10-01'), 'qué días están en un mes cerrado');
  ok(['2026-10', '2026-09', '2026-08', '2026-11', '2026-12'].map(m => CI.estadoMes(CI.cierreDe(cierres, m), m, HOY)).join() === 'cerrado,reabierto,sin-cerrar,en-curso,futuro' && CI.sePuedeCerrar('2026-10', HOY) && !CI.sePuedeCerrar('2026-11', HOY), 'estado de cada mes; solo se cierran los que ya terminaron');

  console.log('7. «Listo cuando»: 10 meses importados coinciden con los totales de sus Excel');
  let semilla = 11; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre'];
  const formatos = [
    { cab: ['Producto', 'Kilos', 'Unidades', 'Precio', 'Monto'], fila: (n, k, u, p, m) => [n, k, u, p, m] },
    { cab: ['Pan', 'Cantidad', 'Unidad', 'Precio neto', 'Neto', 'IVA', 'Total'], fila: (n, k, u, p, m) => [n, k == null ? u : k, k == null ? 'un' : 'kg', p, m, Math.round(m * 0.19), m + Math.round(m * 0.19)] },
    { cab: ['Detalle', 'Kg', 'Valor', 'Venta'], fila: (n, k, u, p, m) => [n, String(k == null ? u : k).replace('.', ','), '$' + p, m.toLocaleString('de-DE')] }];
  let cuadran = 0, docsOk = 0;
  for (let i = 0; i < 10; i++) {
    const mes = '2026-' + String(i + 1).padStart(2, '0'), F = formatos[i % 3], filas = [], tot = { k: 0, u: 0, m: 0 };
    for (const p of prods) {
      if (azar() < 0.15) continue;
      const un = p.unidad === 'un', k = un ? null : Math.round(azar() * 150000) / 100, u = un ? 500 + Math.floor(azar() * 3000) : null, precio = un ? 100 + Math.floor(azar() * 50) : 1300 + Math.floor(azar() * 300);
      const m = Math.round((un ? u : k) * precio); tot.k += k || 0; tot.u += u || 0; tot.m += m;
      filas.push(F.fila((azar() < 0.3 ? p.nombre.toUpperCase() + 'S' : p.nombre), k, u, precio, m));
    }
    const titulo = i % 2 ? [['Cierre ' + NOMBRES[i] + ' 2026'], []] : [];
    const hojas = [{ nombre: i % 2 ? 'Hoja1' : NOMBRES[i], filas: titulo.concat([F.cab], filas, [[], ['TOTAL'].concat(F.cab.slice(1).map((c, j) => (/monto|neto|venta/i.test(c) ? tot.m : null)))]) }];
    const b = comprimir(X.crear(hojas)), I = CI.interpretar(await XL.leer(b), (i % 2 ? 'cierre-' + mes : 'Cierres 2026') + '.xlsx', HOY);
    const Pm = CI.preparar(I.meses[0], prods, new Map(), 19), d = Pm.listo && CI.documento(Pm, { iva: 19, por: 'rosa', quien: 'Rosa' });
    if (I.meses.length === 1 && I.meses[0].mes === mes && Pm.listo && Pm.cuadra && d.neto === tot.m && Math.abs(d.kg - Math.round(tot.k * 100) / 100) < 0.001 && d.un === tot.u) cuadran++;
    else console.log('    ' + mes + ': ' + JSON.stringify({ meses: I.meses.map(x => x.mes), listo: Pm.listo, sin: Pm.sinEmparejar, neto: d && d.neto, esperado: tot.m, kg: d && d.kg, k: tot.k }));
    if (d && R.permitido(quien, 'create', 'cierres/' + mes, conTS(d), null, leerDb(base), AHORA)) docsOk++;
  }
  ok(cuadran === 10, cuadran + ' de 10 meses (tres formatos distintos, comprimidos) dan el mismo neto, kilos y unidades que su Excel');
  ok(docsOk === 10, 'y los 10 cierres pasan las reglas');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
