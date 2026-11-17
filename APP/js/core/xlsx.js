/* Escritor de planillas Excel (.xlsx) propio, sin librerías: la app no carga nada de otros sitios y no tiene compilación.
   Un .xlsx es un ZIP con archivos XML (formato Office Open XML). Aquí se guarda sin comprimir (método «stored»):
   Excel, LibreOffice, Numbers y Google Sheets lo abren igual, y un mes de ventas pesa unos cientos de KB.
   Lógica pura (devuelve bytes): se prueba con Node (tests/xlsx-unit.js).
   Las direcciones «http://schemas…» de abajo son NOMBRES obligatorios del formato (espacios de nombres XML): no se conecta a ellos.

   crear(hojas) → Uint8Array
     hoja  = { nombre, columnas: [anchos], filas: [[celda, …], …], congelar: filas fijas arriba, filtro: true (filtro en la fila 1) }
     celda = null | 'texto' | número | { v, s, f }
             v: valor (una fecha 'AAAA-MM-DD' con s: 'fecha' se guarda como fecha de Excel) · f: fórmula sin «=» (con v como resultado)
             s: estilo: 'cab' 'titulo' 'b' 'fecha' 'entero' 'kilos' 'pesos' 'precio' 'b-entero' 'b-kilos' 'b-pesos'
   El texto siempre va como texto (nunca como fórmula): un nombre que empiece con «=» no se ejecuta. */
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/', XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
export const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/* Estilos: índice en cellXfs. Formatos: 3 = #,##0 · 4 = #,##0.00 (de Excel) · 164 fecha · 165 pesos · 166 precio con decimales */
export const ESTILOS = { '': 0, cab: 1, fecha: 2, entero: 3, kilos: 4, pesos: 5, precio: 6, b: 7, 'b-entero': 8, 'b-kilos': 9, 'b-pesos': 10, titulo: 11 };
const XF = [[0, 0, 0], [0, 1, 2], [164, 0, 0], [3, 0, 0], [4, 0, 0], [165, 0, 0], [166, 0, 0], [0, 1, 0], [3, 1, 0], [4, 1, 0], [165, 1, 0], [0, 2, 0]];   // [formato, letra, relleno]
function estilos() {
  const xf = XF.map(([n, f, r]) => '<xf numFmtId="' + n + '" fontId="' + f + '" fillId="' + r + '" borderId="0" xfId="0"' + (n ? ' applyNumberFormat="1"' : '') + (f ? ' applyFont="1"' : '') + (r ? ' applyFill="1"' : '') + '/>').join('');
  return XML + '<styleSheet xmlns="' + NS + '">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0"/><numFmt numFmtId="166" formatCode="&quot;$&quot;#,##0.00"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E6D3"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + XF.length + '">' + xf + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

/* Texto seguro para XML: sin caracteres de control (XML no los admite) y con & < > " escapados. */
export const escXml = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Columna 0 → A, 25 → Z, 26 → AA */
export function columna(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
/* 'AAAA-MM-DD' → número de serie de Excel (días desde el 30-dic-1899) */
export const serieFecha = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000);
/* Nombre de hoja válido: hasta 31 caracteres, sin : \ / ? * [ ] */
export const nombreHoja = s => (String(s || 'Hoja').replace(/[:\\/?*[\]]/g, ' ').trim() || 'Hoja').slice(0, 31);

function celda(c, ref) {
  if (c == null || c === '') return '';
  const o = typeof c === 'object' ? c : { v: c }, s = ESTILOS[o.s || ''] || 0, st = s ? ' s="' + s + '"' : '';
  let v = o.v;
  if (o.s === 'fecha' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = serieFecha(v);
  if (o.f) return '<c r="' + ref + '"' + st + '><f>' + escXml(o.f) + '</f>' + (typeof v === 'number' && Number.isFinite(v) ? '<v>' + v + '</v>' : '') + '</c>';
  if (typeof v === 'number') return Number.isFinite(v) ? '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>' : '';
  if (v == null || v === '') return s ? '<c r="' + ref + '"' + st + '/>' : '';
  return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + escXml(v) + '</t></is></c>';
}
function hojaXml(h) {
  const filas = h.filas || [], ancho = Math.max(1, ...filas.map(f => f.length)), ult = columna(ancho - 1) + Math.max(1, filas.length);
  const vista = h.congelar ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + h.congelar + '" topLeftCell="A' + (h.congelar + 1) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = (h.columnas || []).length ? '<cols>' + h.columnas.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
  const datos = filas.map((f, r) => '<row r="' + (r + 1) + '">' + f.map((c, i) => celda(c, columna(i) + (r + 1))).join('') + '</row>').join('');
  const filtro = h.filtro && filas.length > 1 ? '<autoFilter ref="A1:' + columna(ancho - 1) + (h.filtro === true ? filas.length : h.filtro) + '"/>' : '';
  return { xml: XML + '<worksheet xmlns="' + NS + '" xmlns:r="' + NSR + '">' + vista + '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + datos + '</sheetData>' + filtro + '</worksheet>', ult, ancho, filas: filas.length };
}

export function archivos(hojas) {
  const H = hojas.map(h => Object.assign({ nombre: nombreHoja(h.nombre) }, hojaXml(h), { h }));
  const nombres = new Set(); H.forEach((x, i) => { let n = x.nombre, k = 2; while (nombres.has(n.toLowerCase())) n = x.nombre.slice(0, 28) + ' ' + k++; nombres.add(n.toLowerCase()); x.nombre = n; });
  const filtros = H.map((x, i) => x.h.filtro && x.filas > 1 ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + escXml(x.nombre.replace(/'/g, "''")) + '\'!$A$1:$' + columna(x.ancho - 1) + '$' + (x.h.filtro === true ? x.filas : x.h.filtro) + '</definedName>' : '').join('');
  return [
    ['[Content_Types].xml', XML + '<Types xmlns="' + PKG + 'content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      H.map((x, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', XML + '<Relationships xmlns="' + PKG + 'relationships"><Relationship Id="rId1" Type="' + NSR + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', XML + '<workbook xmlns="' + NS + '" xmlns:r="' + NSR + '"><bookViews><workbookView/></bookViews><sheets>' +
      H.map((x, i) => '<sheet name="' + escXml(x.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' + (filtros ? '<definedNames>' + filtros + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
    ['xl/_rels/workbook.xml.rels', XML + '<Relationships xmlns="' + PKG + 'relationships">' + H.map((x, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + NSR + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (H.length + 1) + '" Type="' + NSR + '/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', estilos()]
  ].concat(H.map((x, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', x.xml]));
}

/* ---------- ZIP sin comprimir ---------- */
let TABLA = null;
export function crc32(b) {
  if (!TABLA) { TABLA = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function zip(entradas, fecha) {
  const enc = new TextEncoder(), d = fecha || new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const partes = [], centro = []; let pos = 0;
  const cab = (n, campos) => { const b = new Uint8Array(n), v = new DataView(b.buffer); campos.forEach(([o, x, t]) => (t === 4 ? v.setUint32(o, x, true) : v.setUint16(o, x, true))); return b; };
  for (const [nombre, texto] of entradas) {
    const nb = enc.encode(nombre), datos = typeof texto === 'string' ? enc.encode(texto) : texto, crc = crc32(datos);
    const local = cab(30, [[0, 0x04034b50, 4], [4, 20], [6, 0x0800], [8, 0], [10, hora], [12, dia], [14, crc, 4], [18, datos.length, 4], [22, datos.length, 4], [26, nb.length], [28, 0]]);
    centro.push([cab(46, [[0, 0x02014b50, 4], [4, 20], [6, 20], [8, 0x0800], [10, 0], [12, hora], [14, dia], [16, crc, 4], [20, datos.length, 4], [24, datos.length, 4], [28, nb.length], [30, 0], [32, 0], [34, 0], [36, 0], [38, 0, 4], [42, pos, 4]]), nb]);
    partes.push(local, nb, datos); pos += 30 + nb.length + datos.length;
  }
  const inicio = pos; let largo = 0;
  for (const [c, nb] of centro) { partes.push(c, nb); largo += c.length + nb.length; }
  partes.push(cab(22, [[0, 0x06054b50, 4], [4, 0], [6, 0], [8, centro.length], [10, centro.length], [12, largo, 4], [16, inicio, 4], [20, 0]]));
  const out = new Uint8Array(partes.reduce((t, p) => t + p.length, 0)); let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
export const crear = (hojas, fecha) => zip(archivos(hojas), fecha);
