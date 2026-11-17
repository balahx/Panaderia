/* Lector mínimo de los .xlsx que genera la app (APP/js/core/xlsx.js), para las pruebas: abre el ZIP (sin comprimir), revisa la
   firma CRC-32 de cada archivo y devuelve las hojas como filas de valores. No es un lector general de Excel. */
const zlib = require('zlib');
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; }
/* bytes → { 'ruta': Buffer }. Lanza un error si el ZIP está mal armado. */
function abrirZip(bytes) {
  const b = Buffer.from(bytes), out = {};
  const fin = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); if (fin < 0) throw new Error('sin directorio central');
  const n = b.readUInt16LE(fin + 10); let p = b.readUInt32LE(fin + 16);
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('directorio central dañado');
    const metodo = b.readUInt16LE(p + 10), crc = b.readUInt32LE(p + 16), tam = b.readUInt32LE(p + 20), largo = b.readUInt16LE(p + 28), extra = b.readUInt16LE(p + 30), com = b.readUInt16LE(p + 32), loc = b.readUInt32LE(p + 42);
    const nombre = b.slice(p + 46, p + 46 + largo).toString('utf8');
    if (b.readUInt32LE(loc) !== 0x04034b50) throw new Error('cabecera local dañada: ' + nombre);
    const ini = loc + 30 + b.readUInt16LE(loc + 26) + b.readUInt16LE(loc + 28);
    let datos = b.slice(ini, ini + tam); if (metodo === 8) datos = zlib.inflateRawSync(datos);
    if (crc32(datos) !== crc) throw new Error('CRC distinto en ' + nombre);
    out[nombre] = datos; p += 46 + largo + extra + com;
  }
  return out;
}
const desc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const col = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
/* bytes → { archivos, hojas: { nombre: { filas: [[valor…]], formulas: { 'J10': 'SUM(…)' } } }, orden: [nombres] } */
function leer(bytes) {
  const a = abrirZip(bytes), wb = a['xl/workbook.xml'].toString('utf8'), hojas = {}, orden = [];
  const nombres = [...wb.matchAll(/<sheet name="([^"]*)" sheetId="\d+" r:id="rId(\d+)"\/>/g)].map(m => [desc(m[1]), m[2]]);
  for (const [nombre, id] of nombres) {
    const x = a['xl/worksheets/sheet' + id + '.xml'].toString('utf8'), filas = [], formulas = {}, estilos = {};
    for (const r of x.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)) {
      const fila = []; filas[Number(r[1]) - 1] = fila;
      for (const c of r[2].matchAll(/<c r="([A-Z]+\d+)"( s="(\d+)")?( t="inlineStr")?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const i = col(c[1]), cuerpo = c[5] || ''; estilos[c[1]] = Number(c[3] || 0);
        const f = /<f>([\s\S]*?)<\/f>/.exec(cuerpo); if (f) formulas[c[1]] = desc(f[1]);
        if (c[4]) fila[i] = desc((/<t[^>]*>([\s\S]*?)<\/t>/.exec(cuerpo) || [])[1] || '');
        else { const v = /<v>([^<]*)<\/v>/.exec(cuerpo); fila[i] = v ? Number(v[1]) : null; }
      }
    }
    for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
    hojas[nombre] = { filas, formulas, estilos }; orden.push(nombre);
  }
  return { archivos: a, hojas, orden };
}
/* Suma de una columna (índice) entre filas (índices desde 0) */
const sumaCol = (filas, i, desde, hasta) => filas.slice(desde, hasta).reduce((t, f) => t + (typeof f[i] === 'number' ? f[i] : 0), 0);
module.exports = { abrirZip, leer, sumaCol, crc32 };
