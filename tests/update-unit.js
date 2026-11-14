/* Parte pura de la actualización: leer la versión publicada y compararla. Uso: node tests/update-unit.js */
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const APP = path.resolve(__dirname, '..', 'APP');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => {
  const V = require(path.join(APP, 'version.js'));
  const U = await import(pathToFileURL(path.join(APP, 'js', 'core', 'actualizar.js')));
  console.log('Versión y comparación');
  ok(/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(V.v), 'formato AAAA.MM.DD.n: ' + V.v);
  ok(/^\d+\.\d+\.\d+$/.test(V.n), 'la versión mostrada es X.Y.Z: ' + V.n);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(V.date) && V.v.startsWith(V.date.replace(/-/g, '.')), 'la fecha coincide con la versión');
  const p = U.parseVersion(fs.readFileSync(path.join(APP, 'version.js'), 'utf8'));
  ok(p && p.v === V.v && p.n === V.n && p.date === V.date, 'se lee la versión del texto de version.js sin ejecutarlo');
  ok(U.parseVersion('nada') === null && U.parseVersion('') === null && U.parseVersion(null) === null, 'un texto sin versión da null');
  ok(U.newer('2026.11.05.2', '2026.11.05.1') && U.newer('2026.11.06.1', '2026.11.05.9') && U.newer('2027.01.01.1', '2026.12.31.9'), 'detecta versiones más nuevas');
  ok(!U.newer('2026.11.05.1', '2026.11.05.1') && !U.newer('2026.11.04.9', '2026.11.05.1') && !U.newer('', '2026.11.05.1') && !U.newer('2026.11.05.1', ''), 'igual, anterior o vacía no son nuevas');
  ok(U.newer('2026.11.05.10', '2026.11.05.9'), 'compara números, no texto (10 > 9)');
  ok(U.dateText('2026-11-05') === '5 nov 2026' && U.dateText('x') === '', 'fecha legible');
  ok(U.isNewer({ n: '0.1.2', v: 'x' }, { n: '0.1.1', v: 'y' }) && !U.isNewer({ n: '0.1.1' }, { n: '0.1.1' }) && !U.isNewer({ n: '0.0.9' }, { n: '0.1.1' }) && U.isNewer({ n: '0.10.0' }, { n: '0.9.5' }) && U.isNewer({ n: '1.0.0' }, { n: '0.9.9' }), 'compara por número de versión');
  ok(U.isNewer({ n: null, v: '2026.11.07.1' }, { n: '0.1.1', v: '2026.11.06.4' }) && !U.isNewer({ n: null, v: '2026.11.06.4' }, { n: '0.1.1', v: '2026.11.06.4' }), 'sin número, compara el texto AAAA.MM.DD.n');
  ok(U.label({ n: '0.1.1', v: 'z' }) === '0.1.1' && U.label({ v: 'z' }) === 'z', 'la etiqueta muestra solo el número (X.Y.Z)');
  ok(U.versionText() === 'Versión ?' || /^Versión /.test(U.versionText()), 'texto «Versión …»');
  const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
  ok(/importScripts\('version\.js'\)/.test(sw) && sw.includes("'" + U.CACHE_PREFIX + "' + self.PAN_VERSION.v"), 'el service worker nombra su caché con la versión y el mismo prefijo que actualizar.js');
  ok(/'\.\/version\.js'/.test(sw) && /'\.\/js\/core\/actualizar\.js'/.test(sw), 'version.js y actualizar.js se guardan para abrir sin conexión');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
