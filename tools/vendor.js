#!/usr/bin/env node
/* Descarga el SDK de Firebase (módulos ES oficiales de Google) y lo deja DENTRO de la app, en APP/vendor/firebase/.
   Así la app abre sin internet y no carga scripts de otros sitios (PLAN §4 y §9).
   Uso:  node tools/vendor.js            descarga la versión fijada abajo
         node tools/vendor.js 12.15.0    descarga otra versión (y hay que probar la app antes de publicar)
   Cada archivo se guarda con sus «import» apuntando a la copia local, y se anota su huella (SHA-256) en VERSION.json. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const VERSION = process.argv[2] || '12.15.0';
const ARCHIVOS = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-app-check.js'];   // app y auth: Fase 1 · firestore y app-check: Fase 2
const BASE = 'https://www.gstatic.com/firebasejs/' + VERSION + '/';
const DEST = path.join(__dirname, '..', 'APP', 'vendor', 'firebase');

/* Deja los «import» apuntando a la carpeta local y quita la referencia al mapa de código. Exportada para las pruebas. */
function localizar(texto, version) {
  const base = 'https://www.gstatic.com/firebasejs/' + version + '/';
  return texto.split(base).join('./').replace(/\n?\/\/# sourceMappingURL=.*$/gm, '');
}
/* ¿Queda alguna carga desde otro sitio? (import o export … from "http…", import("http…")) */
const cargasExternas = texto => (texto.match(/(?:from|import)\s*\(?\s*["']https?:\/\/[^"']+["']/g) || []);

async function main() {
  if (!/^\d+\.\d+\.\d+$/.test(VERSION)) { console.error('Versión no válida: ' + VERSION); process.exit(1); }
  if (typeof fetch !== 'function') { console.error('Se necesita Node 18 o superior (node -v).'); process.exit(1); }
  fs.mkdirSync(DEST, { recursive: true });
  const info = { version: VERSION, origen: BASE, archivos: {} };
  for (const a of ARCHIVOS) {
    const res = await fetch(BASE + a);
    if (!res.ok) throw new Error('No se pudo descargar ' + a + ' (HTTP ' + res.status + '). ¿Existe la versión ' + VERSION + '?');
    const texto = localizar(await res.text(), VERSION), ext = cargasExternas(texto);
    if (ext.length) throw new Error(a + ' todavía carga archivos de otro sitio: ' + ext.slice(0, 3).join(' · '));
    fs.writeFileSync(path.join(DEST, a), texto);
    info.archivos[a] = { bytes: Buffer.byteLength(texto), sha256: crypto.createHash('sha256').update(texto).digest('hex') };
    console.log('  ✓ ' + a + '  (' + Math.round(info.archivos[a].bytes / 1024) + ' KB)');
  }
  fs.writeFileSync(path.join(DEST, 'VERSION.json'), JSON.stringify(info, null, 2) + '\n');
  console.log('SDK de Firebase ' + VERSION + ' guardado en APP/vendor/firebase');
}
if (require.main === module) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
module.exports = { localizar, cargasExternas, ARCHIVOS };
