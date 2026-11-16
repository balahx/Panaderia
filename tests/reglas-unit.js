/* Reglas por perfil, contra la COPIA A MANO (tests/fake-firebase/reglas.mjs) que usan las pruebas de pantalla.
   Los casos son los mismos que corre el emulador contra las reglas reales (tests/reglas-casos.js y tests/rules-emulator.js).
   También revisa que firestore.rules nombre las mismas colecciones y siga cerrado por defecto. Uso: node tests/reglas-unit.js */
const fs = require('fs'), path = require('path');
const { CUENTAS, semilla, casos } = require('./reglas-casos.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

(async () => {
  const R = await import('./fake-firebase/reglas.mjs');
  const AHORA = Date.now(), HOY = dia(AHORA), ANTES = dia(AHORA - 2 * 86400000);
  const ts = o => { const r = {}; for (const k in o) r[k] = o[k] === '@TS' ? R.TS : o[k]; return r; };
  const guardar = o => { const r = {}; for (const k in o) r[k] = o[k] && o[k].__ts ? AHORA : o[k]; return r; };
  const docs = {}; const S = semilla(HOY, ANTES); for (const p in S) docs[p] = guardar(ts(S[p]));
  const leer = p => (p in docs ? docs[p] : null);

  for (const c of casos(HOY, ANTES)) {
    if (c.t) { console.log(c.t); continue; }
    const q = CUENTAS[c.q], prev = leer(c.r);
    let op = c.op, datos = c.d ? ts(c.d) : null;
    if (op === 'set') op = prev ? 'update' : 'create';
    else if (op === 'update') datos = prev ? Object.assign({}, prev, datos) : null;
    else if (op === 'list') datos = c.f || {};
    let res = (c.op === 'update' && !prev) ? false : R.permitido(q, op, c.r, datos, prev, leer, AHORA);
    if (res && (op === 'create' || op === 'update')) docs[c.r] = guardar(datos);
    if (res && op === 'delete') delete docs[c.r];
    ok(res === c.ok, c.m + (res === c.ok ? '' : ' · ' + (res ? 'se permitió' : 'se rechazó')));
  }

  console.log('9. El día según la hora del servidor');
  const t = Date.UTC(2026, 10, 15, 2, 30);   // 15-nov 02:30 UTC = 14-nov 23:30 en Chile (UTC-3)
  ok(R.esHoy('2026-11-14', t) && !R.esHoy('2026-11-15', t) && !R.esHoy('2026-11-13', t), 'a las 23:30 de Chile el día sigue siendo el 14');
  const t2 = Date.UTC(2026, 6, 15, 3, 30);   // en invierno (UTC-4): 14-jul 23:30
  ok(R.esHoy('2026-07-14', t2) && R.esHoy('2026-07-15', t2), 'en la hora dudosa de la medianoche se aceptan los dos días (verano e invierno)');

  console.log('10. firestore.rules');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8').replace(/\/\/.*$/gm, '');
  const cols = [...new Set((rules.match(/match \/([a-z]+)\//g) || []).map(x => x.slice(7, -1)))].filter(x => x !== 'databases').sort();
  const esperadas = ['cambios', 'cierres', 'clientes', 'config', 'dias', 'miembros', 'pesajes', 'precios', 'productos', 'proyeccion', 'solicitudes', 'trabajadores'];
  ok(JSON.stringify(cols) === JSON.stringify(esperadas), 'las reglas cubren las colecciones del plan: ' + cols.join(', '));
  ok(!/\{document=\*\*\}/.test(rules) && !/allow[^;]*:\s*if true/.test(rules), 'sin comodines ni «if true»: lo no nombrado queda cerrado');
  const precios = (/match \/precios\/\{id\} \{([\s\S]*?)\n    \}/.exec(rules) || [])[1] || '';
  ok(/allow read: if esGestion\(\);/.test(precios) && !/esPesaje|conAcceso|sesion\(\)/.test(precios), 'los precios solo los lee gestión (dueños y externo)');
  for (const c of ['clientes', 'cierres', 'proyeccion', 'cambios']) {
    const b = (new RegExp('match \\/' + c + '\\/\\{[a-z]+\\} \\{([\\s\\S]*?)\\n    \\}').exec(rules) || [])[1] || '';
    ok(/allow read: if esGestion\(\);/.test(b), c + ': lectura solo de gestión');
  }
  ok((rules.match(/\{/g) || []).length === (rules.match(/\}/g) || []).length && (rules.match(/\(/g) || []).length === (rules.match(/\)/g) || []).length, 'llaves y paréntesis equilibrados');
  const sinPunto = rules.split('\n').map((l, i) => [i + 1, l.trim()]).filter(x => /^allow /.test(x[1])).filter(x => { let j = x[0] - 1, L = rules.split('\n'); while (j < L.length && !/;\s*$/.test(L[j])) { if (/^\s*(allow|match|function)\b/.test(L[j + 1] || '')) return true; j++; } return false; });
  ok(sinPunto.length === 0, 'cada «allow» termina en punto y coma' + (sinPunto.length ? ' · línea ' + sinPunto[0][0] : ''));
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
