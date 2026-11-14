#!/usr/bin/env node
/* Sube la versión en APP/version.js. Uso:  node tools/bump.js fix | feature | big  [AAAA-MM-DD]
   fix → +0.0.1 (arreglo) · feature → +0.1.0 (función nueva) · big → +1.0.0 (cambio grande).
   Actualiza n (lo que se ve en «Más»), v (AAAA.MM.DD.n: nombra el caché del service worker) y date.
   La fecha por defecto es la de Chile (America/Santiago). */
const fs = require('fs'), path = require('path');
const file = process.env.PAN_VERSION_FILE || path.join(__dirname, '..', 'APP', 'version.js');
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const kind = process.argv[2], today = process.argv[3] || hoyChile();
if (!['fix', 'feature', 'big'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) { console.error('Uso: node tools/bump.js fix|feature|big [AAAA-MM-DD]'); process.exit(1); }
const src = fs.readFileSync(file, 'utf8');
const m = /n: '(\d+)\.(\d+)\.(\d+)', v: '(\d{4})\.(\d{2})\.(\d{2})\.(\d+)', date: '(\d{4}-\d{2}-\d{2})'/.exec(src);
if (!m) { console.error('No se reconoce el formato de version.js'); process.exit(1); }
let [x, y, z] = [+m[1], +m[2], +m[3]];
if (kind === 'fix') z++; else if (kind === 'feature') { y++; z = 0; } else { x++; y = 0; z = 0; }
const sameDay = m[4] + '-' + m[5] + '-' + m[6] === today, n = sameDay ? +m[7] + 1 : 1;
const v = today.replace(/-/g, '.') + '.' + n, ver = x + '.' + y + '.' + z;
fs.writeFileSync(file, src.replace(m[0], "n: '" + ver + "', v: '" + v + "', date: '" + today + "'"));
console.log('Versión ' + m[1] + '.' + m[2] + '.' + m[3] + ' → ' + ver + '  (caché ' + v + ')');
