/* Reglas por perfil, contra la COPIA A MANO (tests/fake-firebase/reglas.mjs) que usan las pruebas de pantalla.
   Los casos son los mismos que corre el emulador contra las reglas reales (tests/reglas-casos.js y tests/rules-emulator.js).
   También revisa que firestore.rules nombre las mismas colecciones y siga cerrado por defecto. Uso: node tests/reglas-unit.js */
const fs = require('fs'), path = require('path');
const { CUENTAS, semilla, casos } = require('./reglas-casos.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

(async () => {
  const R = await import('./fake-firebase/reglas.mjs');
  const AHORA = Date.now(), HOY = dia(AHORA), AYER = dia(AHORA - 86400000), ANTES = dia(AHORA - 3 * 86400000);
  /* '@TS' también dentro de los mapas (Fase 12: anulado.en, reparto.en); en las listas no va (Firestore no lo permite). */
  const plano = v => v && typeof v === 'object' && !Array.isArray(v);
  const ts = o => { const r = {}; for (const k in o) r[k] = o[k] === '@TS' ? R.TS : plano(o[k]) ? ts(o[k]) : o[k]; return r; };
  const guardar = o => { const r = {}; for (const k in o) r[k] = o[k] && o[k].__ts ? AHORA : plano(o[k]) ? guardar(o[k]) : o[k]; return r; };
  const docs = {}; const S = semilla(HOY, ANTES, AYER); for (const p in S) docs[p] = guardar(ts(S[p]));
  const leer = p => (p in docs ? docs[p] : null);

  for (const c of casos(HOY, ANTES, AYER)) {
    if (c.t) { console.log(c.t); continue; }
    const q = CUENTAS[c.q];
    if (c.op === 'batch') {   // Fase 12: varias escrituras juntas; getAfter = cómo queda todo si el lote se guarda
      const tras = {}, w = c.w.map(x => { const prev = x.r in tras ? tras[x.r] : leer(x.r), datos = x.op === 'delete' ? null : x.op === 'update' ? (prev ? Object.assign({}, prev, ts(x.d)) : null) : ts(x.d); tras[x.r] = datos; return Object.assign({}, x, { datos }); });
      const despues = r => (r in tras ? tras[r] : leer(r));
      const res = w.every(x => (x.op !== 'update' || x.datos) && R.permitido(q, x.op === 'delete' ? 'delete' : leer(x.r) ? 'update' : 'create', x.r, x.datos, leer(x.r), leer, AHORA, despues));
      if (res) w.forEach(x => { if (x.op === 'delete') delete docs[x.r]; else docs[x.r] = guardar(x.datos); });
      ok(res === c.ok, c.m + (res === c.ok ? '' : ' · ' + (res ? 'se permitió' : 'se rechazó'))); continue;
    }
    const prev = leer(c.r);
    let op = c.op, datos = c.d ? ts(c.d) : null;
    if (op === 'set') op = prev ? 'update' : 'create';
    else if (op === 'update') datos = prev ? Object.assign({}, prev, datos) : null;
    else if (op === 'list') datos = Object.fromEntries(Object.entries(c.f || {}).filter(e => !Array.isArray(e[1])));   // un rango no prueba «solo hoy»: queda fuera del filtro
    let res = (c.op === 'update' && !prev) ? false : R.permitido(q, op, c.r, datos, prev, leer, AHORA);
    if (res && (op === 'create' || op === 'update')) docs[c.r] = guardar(datos);
    if (res && op === 'delete') delete docs[c.r];
    ok(res === c.ok, c.m + (res === c.ok ? '' : ' · ' + (res ? 'se permitió' : 'se rechazó')));
  }

  console.log('17. El día según la hora del servidor');
  const t = Date.UTC(2026, 10, 15, 2, 30);   // 15-nov 02:30 UTC = 14-nov 23:30 en Chile (UTC-3)
  ok(R.esHoy('2026-11-14', t) && !R.esHoy('2026-11-15', t) && !R.esHoy('2026-11-13', t), 'a las 23:30 de Chile el día sigue siendo el 14');
  const t2 = Date.UTC(2026, 6, 15, 3, 30);   // en invierno (UTC-4): 14-jul 23:30
  ok(R.esHoy('2026-07-14', t2) && R.esHoy('2026-07-15', t2), 'en la hora dudosa de la medianoche se aceptan los dos días (verano e invierno)');
  ok(R.esAyer('2026-11-13', t) && !R.esAyer('2026-11-14', t) && !R.esAyer('2026-11-12', t), 'a las 23:30 del 14, «ayer» es el 13 (lo anotado sin conexión se acepta un día después)');
  const t3 = Date.UTC(2026, 10, 15, 3, 10);   // 15-nov 00:10 en Chile: lo pesado a las 23:50 del 14 llega a esta hora
  ok(R.esAyer('2026-11-14', t3) || R.esHoy('2026-11-14', t3), 'un canasto del 14 que llega pasada la medianoche todavía se acepta');

  ok(R.esManana('2026-11-15', t) && !R.esManana('2026-11-16', t) && !R.esManana('2026-11-14', t), 'a las 23:30 del 14, «mañana» es el 15 (plan de producción, Fase 10)');
  ok(R.esManana('2026-07-15', t2) && R.esManana('2026-07-16', t2), 'y en la hora dudosa de la medianoche se aceptan los dos días, como en «hoy»');

  console.log('18. firestore.rules');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8').replace(/\/\/.*$/gm, '');
  const cols = [...new Set((rules.match(/match \/([A-Za-z]+)\//g) || []).map(x => x.slice(7, -1)))].filter(x => x !== 'databases').sort();
  const esperadas = ['abonos', 'cambios', 'cierres', 'clientes', 'clientesCobro', 'cobros', 'config', 'cotizaciones', 'dias', 'gastos', 'insumos', 'miembros', 'pesajes', 'planes', 'precios', 'preciosInsumo', 'productos', 'proyeccion', 'recetas', 'solicitudes', 'trabajadores'];
  ok(JSON.stringify(cols) === JSON.stringify(esperadas), 'las reglas cubren las colecciones del plan: ' + cols.join(', '));
  ok(!/\{document=\*\*\}/.test(rules) && !/allow[^;]*:\s*if true/.test(rules), 'sin comodines ni «if true»: lo no nombrado queda cerrado');
  const precios = (/match \/precios\/\{id\} \{([\s\S]*?)\n    \}/.exec(rules) || [])[1] || '';
  ok(/allow read: if esGestion\(\);/.test(precios) && !/esPesaje|conAcceso|sesion\(\)/.test(precios), 'los precios solo los lee gestión (dueños y externo)');
  const clientes = (/match \/clientes\/\{id\} \{([\s\S]*?)\n    \}/.exec(rules) || [])[1] || '';
  ok(/allow read: if conAcceso\(\);/.test(clientes) && !/allow (create|update|delete)[^;]*(esPesaje|conAcceso)/.test(clientes) && /'suelta'/.test(clientes),
    'clientes (Fase 11): la tablet los lee (sin montos) y solo gestión los escribe; tipo regular o suelta');
  for (const c of ['cierres', 'proyeccion', 'cambios', 'insumos', 'preciosInsumo', 'recetas', 'gastos', 'clientesCobro', 'cobros', 'abonos', 'cotizaciones']) {
    const b = (new RegExp('match \\/' + c + '\\/\\{[a-z]+\\} \\{([\\s\\S]*?)\\n    \\}').exec(rules) || [])[1] || '';
    ok(/allow read(, delete)?: if esGestion\(\);/.test(b) && (c === 'cambios' || !/esPesaje|conAcceso|sesion\(\)/.test(b)), c + ': lectura solo de gestión');
  }
  const planes = (/match \/planes\/\{fecha\} \{([\s\S]*?)\n    \}/.exec(rules) || [])[1] || '';
  ok(/allow read: if esGestion\(\) \|\| \(esPesaje\(\) && esHoy\(fecha\)\);/.test(planes) && !/allow (create|update|delete)[^;]*esPesaje/.test(planes) && /hoyOManana\(fecha\)/.test(planes),
    'planes: la tablet solo lee el de hoy; escriben dueños y externo, solo hoy o mañana');
  const conf = c => (new RegExp('match \\/config\\/' + c + ' \\{([\\s\\S]*?)\\n    \\}').exec(rules) || [])[1] || '';
  ok(['empresa', 'folios'].every(c => /allow read: if esGestion\(\);/.test(conf(c)) && !/esPesaje|conAcceso|sesion\(\)/.test(conf(c))), 'config/empresa y config/folios (Fase 12): solo gestión');
  ok(/getAfter\(/.test(rules) && /existsAfter\(/.test(rules) && /allow delete: if false;/.test((/match \/cobros\/\{n\} \{([\s\S]*?)\n    \}/.exec(rules) || [])[1] || ''), 'cobros: el número sale del folio en la misma escritura (getAfter) y no se borran');
  ok((rules.match(/\{/g) || []).length === (rules.match(/\}/g) || []).length && (rules.match(/\(/g) || []).length === (rules.match(/\)/g) || []).length, 'llaves y paréntesis equilibrados');
  const sinPunto = rules.split('\n').map((l, i) => [i + 1, l.trim()]).filter(x => /^allow /.test(x[1])).filter(x => { let j = x[0] - 1, L = rules.split('\n'); while (j < L.length && !/;\s*$/.test(L[j])) { if (/^\s*(allow|match|function)\b/.test(L[j + 1] || '')) return true; j++; } return false; });
  ok(sinPunto.length === 0, 'cada «allow» termina en punto y coma' + (sinPunto.length ? ' · línea ' + sinPunto[0][0] : ''));
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
