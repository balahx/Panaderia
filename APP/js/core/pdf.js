/* Escritor de PDF propio (Fase 12), sin librerías, como el de Excel (core/xlsx.js): la app no carga nada de otros sitios y funciona sin
   internet. PDF 1.4, hoja carta (612 × 792 puntos), letras Helvetica y Helvetica-Bold que trae todo lector de PDF (con la codificación
   WinAnsi: tildes, ñ, ¿ ¡ °), texto, rectángulos, líneas y trazos de curvas (la hogaza). Sin comprimir: un cobro pesa unos pocos KB.
   Coordenadas desde ARRIBA a la izquierda (y hacia abajo), en puntos; aquí se pasan a las del PDF (desde abajo).
   Lógica pura (devuelve bytes): se prueba con Node (tests/pdf-unit.js, con un lector propio).
     const doc = nuevo({ titulo }); const p = doc.pagina(); p.texto(50, 60, 'Hola', { tam: 12, negrita: true }); doc.bytes() → Uint8Array */
export const CARTA = { ancho: 612, alto: 792 };
export const MIME = 'application/pdf';

/* Anchos de Helvetica y Helvetica-Bold (milésimas del tamaño), de la tabla de métricas de Adobe, para los caracteres 32 a 126. */
const N = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
/* Caracteres de WinAnsi fuera del ASCII que no son una letra con tilde: código y anchos [normal, negrita]. */
const EXTRA = { '€': [0x80, 556, 556], '‚': [0x82, 222, 278], '„': [0x84, 333, 500], '…': [0x85, 1000, 1000], '‘': [0x91, 222, 278], '’': [0x92, 222, 278], '“': [0x93, 333, 500],
  '”': [0x94, 333, 500], '•': [0x95, 350, 350], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '™': [0x99, 1000, 1000], '¡': [0xA1, 333, 333], '¢': [0xA2, 556, 556], '£': [0xA3, 556, 556],
  '§': [0xA7, 556, 556], '©': [0xA9, 737, 737], 'ª': [0xAA, 370, 370], '«': [0xAB, 556, 556], '°': [0xB0, 400, 400], '±': [0xB1, 584, 584], '·': [0xB7, 278, 278], 'º': [0xBA, 365, 365],
  '»': [0xBB, 556, 556], '¿': [0xBF, 611, 611], '×': [0xD7, 584, 584], '÷': [0xF7, 584, 584], 'ß': [0xDF, 611, 611], ' ': [0xA0, 278, 278] };
/* Un carácter → [código WinAnsi, ancho normal, ancho negrita]. Las letras con tilde (Latin-1) usan el ancho de su letra base. */
function glifo(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return [c, N[c - 32], B[c - 32]];
  if (EXTRA[ch]) return EXTRA[ch];
  if (c >= 0xC0 && c <= 0xFF) { const b = ch.normalize('NFD')[0], k = b.charCodeAt(0); if (k >= 32 && k <= 126) return [c, N[k - 32], B[k - 32]]; return [c, 556, 611]; }
  if (ch === '\t') return glifo(' ');
  const b = ch.normalize('NFD')[0];
  if (b !== ch && b.charCodeAt(0) <= 126) return glifo(b);   // otra letra con tilde: sin ella
  return [63, 556, 611];                                       // lo que la letra no trae: «?»
}
export const codificar = s => Array.from(String(s == null ? '' : s).replace(/[\r\n]+/g, ' '), ch => glifo(ch)[0]);
/* Ancho de un texto en puntos. */
export const ancho = (s, tam, negrita) => Array.from(String(s == null ? '' : s), ch => glifo(ch)[negrita ? 2 : 1]).reduce((t, w) => t + w, 0) * (tam || 10) / 1000;
/* Corta un texto en líneas que caben en `max` puntos (por palabras; una palabra muy larga se parte). */
export function ajustar(s, max, tam, negrita) {
  const out = []; let linea = '';
  for (const p of String(s == null ? '' : s).split(/\s+/).filter(Boolean)) {
    let pal = p;
    while (ancho(pal, tam, negrita) > max) { let i = pal.length - 1; while (i > 1 && ancho(pal.slice(0, i), tam, negrita) > max) i--; if (linea) { out.push(linea); linea = ''; } out.push(pal.slice(0, i)); pal = pal.slice(i); }
    const prueba = linea ? linea + ' ' + pal : pal;
    if (ancho(prueba, tam, negrita) <= max) linea = prueba; else { if (linea) out.push(linea); linea = pal; }
  }
  if (linea) out.push(linea);
  return out.length ? out : [''];
}
/* Recorta un texto con «…» para que quepa en una línea. */
export function cortar(s, max, tam, negrita) {
  s = String(s == null ? '' : s); if (ancho(s, tam, negrita) <= max) return s;
  while (s.length > 1 && ancho(s + '…', tam, negrita) > max) s = s.slice(0, -1);
  return s + '…';
}
const cadena = s => '(' + codificar(s).map(c => (c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c))).join('') + ')';
const num = n => (Math.round(n * 100) / 100).toString();
const color = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || '#000000'); return [1, 2, 3].map(i => num(parseInt(m[i], 16) / 255)).join(' '); };

function pagina(alto) {
  const ops = [], Y = y => num(alto - y);
  return {
    ops,
    /* texto en (x, y = línea base desde arriba). o = { tam, negrita, color, alinear: 'izq' | 'der' | 'centro' } */
    texto(x, y, t, o) {
      o = o || {}; const tam = o.tam || 10, w = o.alinear === 'der' ? ancho(t, tam, o.negrita) : o.alinear === 'centro' ? ancho(t, tam, o.negrita) / 2 : 0;
      ops.push('BT /' + (o.negrita ? 'F2' : 'F1') + ' ' + num(tam) + ' Tf ' + color(o.color) + ' rg 1 0 0 1 ' + num(x - w) + ' ' + Y(y) + ' Tm ' + cadena(t) + ' Tj ET');
    },
    /* rectángulo con esquina superior izquierda en (x, y). o = { relleno, borde, grosor } */
    rect(x, y, w, h, o) {
      o = o || {};
      ops.push('q ' + (o.relleno ? color(o.relleno) + ' rg ' : '') + (o.borde ? color(o.borde) + ' RG ' + num(o.grosor || 0.75) + ' w ' : '') + num(x) + ' ' + Y(y + h) + ' ' + num(w) + ' ' + num(h) + ' re ' + (o.relleno && o.borde ? 'B' : o.relleno ? 'f' : 'S') + ' Q');
    },
    linea(x1, y1, x2, y2, o) { o = o || {}; ops.push('q ' + color(o.color || '#000000') + ' RG ' + num(o.grosor || 0.75) + ' w ' + num(x1) + ' ' + Y(y1) + ' m ' + num(x2) + ' ' + Y(y2) + ' l S Q'); },
    /* Trazo: lista de ['M', x, y] · ['L', x, y] · ['C', x1, y1, x2, y2, x, y] · ['Z'], en unidades que se multiplican por `escala` y se
       mueven a (x0, y0). o = { relleno, borde, grosor } */
    trazo(cmds, x0, y0, escala, o) {
      o = o || {}; const P = (x, y) => num(x0 + x * escala) + ' ' + Y(y0 + y * escala);
      const d = cmds.map(c => (c[0] === 'M' ? P(c[1], c[2]) + ' m' : c[0] === 'L' ? P(c[1], c[2]) + ' l' : c[0] === 'C' ? P(c[1], c[2]) + ' ' + P(c[3], c[4]) + ' ' + P(c[5], c[6]) + ' c' : 'h')).join(' ');
      ops.push('q 1 J 1 j ' + (o.relleno ? color(o.relleno) + ' rg ' : '') + (o.borde ? color(o.borde) + ' RG ' + num(o.grosor || 1) + ' w ' : '') + d + ' ' + (o.relleno && o.borde ? 'B' : o.relleno ? 'f' : 'S') + ' Q');
    }
  };
}

/* Documento: { pagina() → página nueva, paginas, bytes() → Uint8Array }. meta = { titulo, autor, fecha (Date) } */
export function nuevo(meta) {
  meta = meta || {}; const paginas = [], T = CARTA;
  return {
    ancho: T.ancho, alto: T.alto, paginas,
    pagina() { const p = pagina(T.alto); paginas.push(p); return p; },
    bytes() { return crear(paginas.map(p => p.ops.join('\n')), T, meta); }
  };
}
const fechaPdf = d => { const z = n => String(n).padStart(2, '0'); return 'D:' + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z'; };
/* El archivo: catálogo, páginas, dos letras, una página y su contenido por cada hoja, información y la tabla xref con la posición exacta
   de cada objeto (en bytes: todo el archivo va en Latin-1, un byte por carácter). */
export function crear(contenidos, T, meta) {
  T = T || CARTA; meta = meta || {};
  const objs = [], n = contenidos.length, pid = i => 5 + i * 2;   // 1 catálogo · 2 páginas · 3 y 4 letras · 5… páginas y contenidos · al final la información
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('<< /Type /Pages /Kids [' + contenidos.map((c, i) => pid(i) + ' 0 R').join(' ') + '] /Count ' + n + ' >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  contenidos.forEach((c, i) => {
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + T.ancho + ' ' + T.alto + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (pid(i) + 1) + ' 0 R >>');
    objs.push('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
  });
  objs.push('<< /Title ' + cadena(meta.titulo || 'Documento') + ' /Author ' + cadena(meta.autor || 'Panadería') + ' /Producer (Panaderia) /CreationDate (' + fechaPdf(meta.fecha || new Date()) + ') >>');
  let out = '%PDF-1.4\n%âãÏÓ\n'; const pos = [];
  objs.forEach((o, i) => { pos.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + objs.length + ' 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 0xFF;
  return b;
}
