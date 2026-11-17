/* Escritor de Excel propio (APP/js/core/xlsx.js), sin navegador: ZIP válido (firmas CRC), XML bien escapado, fechas, estilos,
   fórmulas con su resultado, texto que nunca se vuelve fórmula y nombres de hoja válidos. Uso: node tests/xlsx-unit.js
   (Al hacerse se abrió además con LibreOffice y openpyxl: abre y recalcula los totales iguales.) */
const { leer, crc32 } = require('./leer-xlsx.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const X = await import('../APP/js/core/xlsx.js');

  console.log('1. Piezas');
  ok(X.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926 && crc32(Buffer.from('123456789')) === 0xCBF43926, 'CRC-32 correcto (valor de referencia CBF43926)');
  ok(X.columna(0) === 'A' && X.columna(25) === 'Z' && X.columna(26) === 'AA' && X.columna(701) === 'ZZ' && X.columna(702) === 'AAA', 'letras de columna: A, Z, AA, ZZ, AAA');
  ok(X.serieFecha('2026-11-16') === 46342 && X.serieFecha('2028-02-29') === 46812 && X.serieFecha('1900-03-01') === 61, 'fechas como número de serie de Excel');
  ok(X.escXml('a<b>&"c"\u0001\u0008x') === 'a&lt;b&gt;&amp;&quot;c&quot;x', 'escapa & < > " y quita caracteres de control que XML no admite');
  ok(X.nombreHoja('Ventas: nov/dic [2026]?') === 'Ventas  nov dic  2026' && X.nombreHoja('x'.repeat(40)).length === 31 && X.nombreHoja('') === 'Hoja', 'nombres de hoja válidos (sin : / ? * [ ], hasta 31 letras)');

  console.log('2. Un libro de prueba');
  const hojas = [
    { nombre: 'Ventas', congelar: 1, filtro: 3, columnas: [11, 20, 12], filas: [
      [{ v: 'Fecha', s: 'cab' }, { v: 'Pan', s: 'cab' }, { v: 'Neto', s: 'cab' }],
      [{ v: '2026-11-16', s: 'fecha' }, 'Marraqueta', { v: 29120, s: 'pesos' }],
      [{ v: '2026-11-17', s: 'fecha' }, '=HYPERLINK("http://malo")', { v: 30000, s: 'pesos' }],
      [{ v: 'Total', s: 'b' }, null, { f: 'SUM(C2:C3)', v: 59120, s: 'b-pesos' }]] },
    { nombre: 'Ventas', filas: [['otra con el mismo nombre'], [1.5, null, { v: 12.35, s: 'kilos' }]] },
    { nombre: 'Vacía', filas: [] }
  ];
  const bytes = X.crear(hojas, new Date(2026, 10, 16, 10, 30));
  ok(bytes instanceof Uint8Array && bytes[0] === 0x50 && bytes[1] === 0x4b, 'es un ZIP (empieza con PK)');
  let L = null; try { L = leer(bytes); } catch (e) { console.log('    ' + e.message); }
  ok(!!L, 'se abre y cada archivo trae su firma CRC correcta');
  const A = L.archivos;
  ok(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml'].every(n => A[n]), 'trae las partes que pide el formato');
  ok(L.orden.join() === 'Ventas,Ventas 2,Vacía', 'dos hojas con el mismo nombre no chocan');
  const v = L.hojas.Ventas;
  ok(v.filas[1][0] === 46342 && v.estilos.A2 === X.ESTILOS.fecha, 'la fecha queda como fecha de Excel (número con formato de fecha)');
  ok(v.filas[2][1] === '=HYPERLINK("http://malo")' && !v.formulas.B3, 'un texto que empieza con «=» queda como texto, no como fórmula');
  ok(v.formulas.C4 === 'SUM(C2:C3)' && v.filas[3][2] === 59120, 'la fila de total lleva la fórmula SUMA y su resultado ya calculado');
  ok(v.estilos.C2 === X.ESTILOS.pesos && v.estilos.C4 === X.ESTILOS['b-pesos'] && v.estilos.A1 === X.ESTILOS.cab, 'estilos: pesos, total en negrita y encabezado');
  const s1 = A['xl/worksheets/sheet1.xml'].toString();
  ok(/<pane ySplit="1" topLeftCell="A2"[^>]*state="frozen"/.test(s1) && /<autoFilter ref="A1:C3"\/>/.test(s1) && /<col min="2" max="2" width="20" customWidth="1"\/>/.test(s1), 'encabezado fijo, filtro hasta la última fila de datos (sin el total) y anchos de columna');
  ok(/_xlnm\._FilterDatabase" localSheetId="0" hidden="1">'Ventas'!\$A\$1:\$C\$3</.test(A['xl/workbook.xml'].toString()) && /fullCalcOnLoad="1"/.test(A['xl/workbook.xml'].toString()), 'el libro declara el filtro y pide recalcular al abrir');
  const st = A['xl/styles.xml'].toString();
  ok(/formatCode="&quot;\$&quot;#,##0"/.test(st) && /formatCode="dd\\-mm\\-yyyy"/.test(st) && (st.match(/<xf numFmtId/g) || []).length === Object.keys(X.ESTILOS).length + 1, 'formatos de pesos y fecha, y un estilo por cada nombre');
  ok(L.hojas['Ventas 2'].filas[1][0] === 1.5 && L.hojas['Ventas 2'].filas[1][1] === undefined && L.hojas['Ventas 2'].filas[1][2] === 12.35, 'números con decimales y celdas vacías');
  ok(L.hojas['Vacía'].filas.length === 0 && /<sheetData><\/sheetData>/.test(A['xl/worksheets/sheet3.xml'].toString()), 'una hoja vacía también es válida');
  const xmls = Object.keys(A).filter(n => /\.xml$|\.rels$/.test(n));
  ok(xmls.every(n => A[n].toString().startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')), 'cada parte XML declara UTF-8');
  const ñ = leer(X.crear([{ nombre: 'Año', filas: [['Panadería · ñandú «€»']] }]));
  ok(ñ.orden[0] === 'Año' && ñ.hojas['Año'].filas[0][0] === 'Panadería · ñandú «€»', 'tildes, ñ y símbolos se guardan bien (UTF-8)');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
