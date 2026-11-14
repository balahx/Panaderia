/* Versión y caché sin conexión: version.js tiene el formato esperado, tools/bump.js sube bien los números y el service worker
   guarda todos los archivos de la app (si falta uno, la app no abre sin conexión). Uso: node tests/version-unit.js */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..'), APP = path.join(ROOT, 'APP');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

console.log('1. version.js');
const V = require(path.join(APP, 'version.js'));
ok(/^\d+\.\d+\.\d+$/.test(V.n) && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(V.v) && /^\d{4}-\d{2}-\d{2}$/.test(V.date), 'formato: n=' + V.n + ' v=' + V.v + ' date=' + V.date);
ok(V.v.slice(0, 10).replace(/\./g, '-') === V.date, 'v empieza con la misma fecha que date');
ok(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name === 'panaderia', 'package.json del proyecto');

console.log('2. tools/bump.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-')), vf = path.join(tmp, 'version.js');
fs.writeFileSync(vf, "const V = { n: '4.3.9', v: '2026.11.06.10', date: '2026-11-06' };\n");
const bump = path.join(ROOT, 'tools', 'bump.js'), env = Object.assign({}, process.env, { PAN_VERSION_FILE: vf });
const run = (k, d) => { cp.execFileSync(process.execPath, [bump, k].concat(d ? [d] : []), { stdio: 'pipe', env }); return fs.readFileSync(vf, 'utf8'); };
let t = run('fix', '2026-11-06'); ok(/n: '4\.3\.10', v: '2026\.11\.06\.11'/.test(t), 'arreglo: 4.3.9 → 4.3.10 y el mismo día suma 1 al caché');
t = run('feature', '2026-11-07'); ok(/n: '4\.4\.0', v: '2026\.11\.07\.1', date: '2026-11-07'/.test(t), 'función nueva: 4.3.10 → 4.4.0, día nuevo reinicia el caché en 1');
t = run('big', '2026-11-07'); ok(/n: '5\.0\.0', v: '2026\.11\.07\.2'/.test(t), 'cambio grande: 4.4.0 → 5.0.0');
let bad = false; try { cp.execFileSync(process.execPath, [bump, 'otra'], { stdio: 'pipe', env }); } catch (e) { bad = true; } ok(bad, 'un tipo desconocido se rechaza');
ok(/n: '\d+\.\d+\.\d+', v: '\d{4}\.\d{2}\.\d{2}\.\d+', date: '\d{4}-\d{2}-\d{2}'/.test(fs.readFileSync(path.join(APP, 'version.js'), 'utf8')), 'APP/version.js tiene el formato que bump.js sabe cambiar');

console.log('3. Caché del service worker');
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8'), html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const lista = n => ((new RegExp('const ' + n + ' = \\[([\\s\\S]*?)\\];').exec(sw) || [])[1] || '').match(/'\.\/[^']*'/g) || [];
const assets = lista('ASSETS').map(x => x.slice(3, -1)), vendor = lista('VENDOR').map(x => x.slice(3, -1));
const missing = assets.filter(a => a && !fs.existsSync(path.join(APP, a.split('?')[0])));
ok(assets.length > 20 && missing.length === 0, assets.length + ' archivos en la caché, todos existen' + (missing.length ? ' · faltan: ' + missing.join(', ') : ''));
const used = (html.match(/(?:src|href)="([^"#]+)"/g) || []).map(x => x.replace(/^(src|href)="/, '').slice(0, -1)).filter(x => !/^https?:/.test(x)).map(x => x.split('?')[0]);
const notCached = used.filter(u => !assets.includes(u));
ok(used.length >= 8 && notCached.length === 0, 'todo lo que carga index.html está en la caché' + (notCached.length ? ' · falta: ' + notCached.join(', ') : ''));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(APP, f).split(path.sep).join('/');
const code = walk(APP).map(rel).filter(f => /\.(js|css)$/.test(f) && f !== 'sw.js' && !f.startsWith('vendor/'));
const fuera = code.filter(f => !assets.includes(f));
ok(fuera.length === 0, 'ningún .js o .css de la app queda fuera de la caché' + (fuera.length ? ': ' + fuera.join(', ') : ''));
ok(vendor.includes('vendor/firebase/firebase-app.js') && vendor.includes('vendor/firebase/firebase-auth.js'), 'el SDK local se guarda para abrir sin conexión');
const imports = code.filter(f => f.endsWith('.js')).flatMap(f => (fs.readFileSync(path.join(APP, f), 'utf8').match(/from '(\.[^']+)'/g) || []).map(x => path.posix.normalize(path.posix.join(path.posix.dirname(f), x.slice(6, -1)))));
const sinArchivo = [...new Set(imports)].filter(i => !fs.existsSync(path.join(APP, i)));
ok(imports.length > 10 && sinArchivo.length === 0, 'todos los módulos importados existen' + (sinArchivo.length ? ' · faltan: ' + sinArchivo.join(', ') : ''));

console.log('4. Tamaño de los módulos (PLAN: un archivo por pantalla, ≤ ~300 líneas)');
const largos = code.filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(APP, f), 'utf8').split('\n').length]).filter(x => x[1] > 320);
ok(largos.length === 0, 'ningún módulo pasa de 320 líneas' + (largos.length ? ': ' + largos.map(x => x.join(' ')).join(', ') : ''));
console.log(fails ? 'FALLAS: ' + fails : 'Todo bien'); process.exit(fails ? 1 : 0);
