#!/usr/bin/env node
/* Corre todas las pruebas, una tras otra, y avisa cuáles fallan. Uso: node tools/run-tests.js [filtro]
   No incluye las pruebas de reglas con el emulador de Firebase (desde la Fase 2: corren en GitHub Actions). */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = path.join(__dirname, '..', 'tests'), filtro = process.argv[2] || '';
const skip = new Set(['rules-emulator.js', 'reglas-casos.js']);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !skip.has(f) && !f.startsWith('shots-') && f.includes(filtro)).sort();
const failed = []; const t0 = Date.now();
for (const f of files) {
  const t = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || ''), bad = (out.match(/✗/g) || []).length;
  const good = r.status === 0 && bad === 0;
  console.log((good ? 'OK    ' : 'FALLA ') + f + '  (' + ((Date.now() - t) / 1000).toFixed(1) + ' s' + (bad ? ', ' + bad + ' verificaciones' : '') + ')');
  if (!good) { failed.push(f); const L = out.split('\n'); console.log(L.filter(l => /✗|Error|error:|waiting for|tests[\/\\]/.test(l)).slice(0, 14).join('\n')); console.log('--- últimas líneas ---\n' + L.filter(l => l.trim()).slice(-8).join('\n')); }
}
console.log('\n' + files.length + ' pruebas en ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s · ' + (failed.length ? 'FALLAN: ' + failed.join(', ') : 'todas bien'));
process.exit(failed.length ? 1 : 0);
