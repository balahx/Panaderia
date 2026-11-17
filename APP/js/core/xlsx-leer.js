/* Lector de planillas Excel (.xlsx) propio, sin librerías (Fase 6: importar los cierres mensuales).
   Un .xlsx es un ZIP con archivos XML. Excel, LibreOffice y Google Sheets lo guardan COMPRIMIDO (método «deflate»):
   se abre con DecompressionStream('deflate-raw'), que traen los navegadores (y Node 18+, para las pruebas). Nada se carga de otros sitios.
   Lógica pura (recibe bytes, devuelve datos): se prueba con Node (tests/cierres-unit.js).

   leer(bytes) → Promise<{ hojas: [{ nombre, filas: [[valor, …], …] }], avisos: [] }>
     valor = número · texto · fecha 'AAAA-MM-DD' (celda con formato de fecha) · true/false · null (vacía o con error)
   Solo lee valores (no fórmulas ni formatos). Un archivo dañado o que no es .xlsx lanza un Error con un mensaje para mostrar.
   Límites por seguridad (un archivo puede estar armado para agotar la memoria): tamaño del archivo, de lo descomprimido y de las hojas. */
import { crc32 } from './xlsx.js';

export const MAX_ARCHIVO = 15 * 1024 * 1024, MAX_DESCOMPRIMIDO = 40 * 1024 * 1024, MAX_FILAS = 5000, MAX_COLUMNAS = 60;
const falla = m => Object.assign(new Error(m), { code: 'xlsx' });

/* ---------- ZIP ---------- */
async function inflar(datos, max) {
  const lector = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), partes = [];
  let total = 0;
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > max) { try { await lector.cancel(); } catch (e) { /* */ } throw falla('El archivo es demasiado grande por dentro.'); }
    partes.push(value);
  }
  const out = new Uint8Array(total); let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
/* bytes → Map(ruta → Uint8Array) solo con las rutas pedidas (las demás no se descomprimen). */
async function abrirZip(bytes, querer) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 22 || v.getUint32(0, true) !== 0x04034b50) throw falla('No es un archivo de Excel (.xlsx).');
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw falla('El archivo está incompleto o dañado.');
  const n = v.getUint16(fin + 10, true), dec = new TextDecoder(), out = new Map();
  let p = v.getUint32(fin + 16, true), usado = 0;
  for (let i = 0; i < n; i++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw falla('El archivo está dañado.');
    const metodo = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), comp = v.getUint32(p + 20, true), tam = v.getUint32(p + 24, true);
    const largo = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), com = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
    const nombre = dec.decode(b.subarray(p + 46, p + 46 + largo));
    p += 46 + largo + extra + com;
    if (!querer(nombre)) continue;
    if (comp === 0xFFFFFFFF || loc + 30 > b.length || v.getUint32(loc, true) !== 0x04034b50) throw falla('El archivo está dañado (' + nombre + ').');
    if ((usado += tam) > MAX_DESCOMPRIMIDO) throw falla('El archivo es demasiado grande por dentro.');
    const ini = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), crudo = b.subarray(ini, ini + comp);
    let datos;
    if (metodo === 0) datos = crudo;
    else if (metodo === 8) datos = await inflar(crudo, Math.min(tam + 1024, MAX_DESCOMPRIMIDO)).catch(e => { throw e && e.code === 'xlsx' ? e : falla('El archivo está dañado (' + nombre + ').'); });
    else throw falla('El archivo usa una compresión que no se puede abrir.');
    if (crc32(datos) !== crc) throw falla('El archivo está dañado (' + nombre + ').');
    out.set(nombre, datos);
  }
  return out;
}

/* ---------- XML (solo lo necesario, con expresiones; las etiquetas pueden traer prefijo, como <x:c>) ---------- */
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
export const textoXml = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
  if (e[0] !== '#') return ENT[e.toLowerCase()];
  const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '';
});
const atributos = s => { const a = {}; for (const m of String(s).matchAll(/([\w:]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) a[m[1].replace(/^\w+:/, '')] = textoXml(m[3] != null ? m[3] : m[4]); return a; };
const etiquetas = (xml, tag) => [...xml.matchAll(new RegExp('<(?:\\w+:)?' + tag + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?' + tag + '>)', 'g'))].map(m => ({ a: atributos(m[1]), cuerpo: m[2] || '' }));
/* Texto de un <si> o un <is>: todos sus <t> (también los de cada tramo con formato), sin la fonética <rPh>. */
const textoRico = cuerpo => cuerpo.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '').replace(/<(?:\w+:)?t\b[^>]*\/>/g, '').match(/<(?:\w+:)?t\b[^>]*>[\s\S]*?<\/(?:\w+:)?t>/g)?.map(t => textoXml(t.replace(/^<[^>]*>|<[^>]*>$/g, ''))).join('') || '';

/* Formatos de fecha: los de Excel 14 a 22 y 45 a 47, y los propios cuyo código tiene d, m o y (sin contar lo que va entre comillas o corchetes). */
const esFormatoFecha = (id, codigo) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (codigo != null && /[dmy]/i.test(String(codigo).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) && !/^(general|0|#)/i.test(codigo));
function estilosFecha(xml) {
  if (!xml) return [];
  const propios = {}; etiquetas(xml, 'numFmt').forEach(f => { propios[f.a.numFmtId] = f.a.formatCode; });
  const xfs = (/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml) || [])[1] || '';
  return etiquetas(xfs, 'xf').map(x => { const id = Number(x.a.numFmtId || 0); return esFormatoFecha(id, propios[id]); });
}
/* Número de serie de Excel → 'AAAA-MM-DD' (desde el 30-dic-1899, como Excel en Windows) */
export function fechaDeSerie(n) {
  if (!(n > 0 && n < 2958466)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000).toISOString().slice(0, 10);
}
const colDe = ref => { let n = 0; for (const ch of String(ref).replace(/\d+$/, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

function hoja(xml, compartidos, fechas, avisos, nombre) {
  const filas = []; let cortada = false, fAuto = 0;
  const datos = (/<(?:\w+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/.exec(xml) || [])[1] || '';
  for (const r of etiquetas(datos, 'row')) {
    const fi = r.a.r ? Number(r.a.r) - 1 : fAuto; fAuto = fi + 1;
    if (fi >= MAX_FILAS) { cortada = true; break; }
    const fila = []; let cAuto = 0;
    for (const c of etiquetas(r.cuerpo, 'c')) {
      const ci = c.a.r ? colDe(c.a.r) : cAuto; cAuto = ci + 1;
      if (ci >= MAX_COLUMNAS) continue;
      const t = c.a.t || 'n', v = (/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(c.cuerpo) || [])[1];
      let val = null;
      if (t === 's') val = v != null ? (compartidos[Number(v)] ?? null) : null;
      else if (t === 'inlineStr') val = textoRico(c.cuerpo);
      else if (t === 'str') val = v != null ? textoXml(v) : null;
      else if (t === 'b') val = v === '1';
      else if (t === 'e') val = null;
      else if (v != null && v.trim() !== '') {
        const num = Number(v);
        val = Number.isFinite(num) ? (fechas[Number(c.a.s || 0)] ? fechaDeSerie(num) || num : num) : null;
      }
      if (typeof val === 'string') val = val.replace(/\u00a0/g, ' ');
      fila[ci] = val === '' ? null : val;
    }
    for (let i = 0; i < fila.length; i++) if (fila[i] === undefined) fila[i] = null;
    filas[fi] = fila;
  }
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
  if (cortada) avisos.push('La hoja «' + nombre + '» tiene más de ' + MAX_FILAS + ' filas: se leyeron las primeras.');
  return filas;
}

export async function leer(bytes) {
  const largo = bytes && (bytes.byteLength != null ? bytes.byteLength : bytes.length);
  if (!largo) throw falla('El archivo está vacío.');
  if (largo > MAX_ARCHIVO) throw falla('El archivo pesa más de 15 MB.');
  const dec = new TextDecoder(), avisos = [];
  const z = await abrirZip(bytes, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
  const txt = n => { for (const [k, v] of z) if (k.toLowerCase() === n.toLowerCase()) return dec.decode(v); return ''; };
  const wb = txt('xl/workbook.xml');
  if (!wb) throw falla('No es una planilla de Excel (.xlsx).');
  const rels = {}; etiquetas(txt('xl/_rels/workbook.xml.rels'), 'Relationship').forEach(r => { rels[r.a.Id] = r.a.Target; });
  const compartidos = etiquetas(txt('xl/sharedStrings.xml'), 'si').map(s => textoRico(s.cuerpo));
  const fechas = estilosFecha(txt('xl/styles.xml'));
  const hojas = [];
  for (const s of etiquetas(wb, 'sheet')) {
    if (s.a.state === 'hidden' || s.a.state === 'veryHidden') continue;
    let destino = rels[s.a.id] || '';
    destino = destino.startsWith('/') ? destino.slice(1) : 'xl/' + destino.replace(/^\.\//, '');
    const xml = txt(destino);
    if (!xml) continue;
    hojas.push({ nombre: s.a.name || 'Hoja', filas: hoja(xml, compartidos, fechas, avisos, s.a.name) });
  }
  if (!hojas.length) throw falla('La planilla no tiene hojas con datos.');
  return { hojas, avisos };
}
