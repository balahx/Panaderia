/* Prueba las reglas REALES de Firestore (firestore.rules) con el emulador de Firebase. Es la prueba que dice la verdad
   («la cuenta de pesaje no lee precios ni con peticiones directas»). Corre en GitHub Actions (.github/workflows/ci.yml) y,
   si el computador tiene Java, con  npm run reglas.  Necesita (sin guardarlos en package.json):
     npm i --no-save firebase@12.15.0 @firebase/rules-unit-testing@5.0.0
     npx firebase-tools@14 emulators:exec --only firestore --project demo-panaderia "node tests/rules-emulator.js"
   Los casos están en tests/reglas-casos.js (los mismos que tests/reglas-unit.js corre contra la copia a mano). */
const fs = require('fs'), path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app'); require('firebase/compat/firestore');
const { CUENTAS, semilla, casos } = require('./reglas-casos.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-panaderia', firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') } });
  await env.clearFirestore();
  const AHORA = Date.now(), HOY = dia(AHORA), ANTES = dia(AHORA - 2 * 86400000);
  const con = (o, valor) => { const r = {}; for (const k in o) r[k] = o[k] === '@TS' ? valor : o[k]; return r; };
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), S = semilla(HOY, ANTES);
    for (const p in S) await db.doc(p).set(con(S[p], new Date()));
  });
  const dbs = {};
  for (const n in CUENTAS) {
    const c = CUENTAS[n];
    dbs[n] = (c ? env.authenticatedContext(c.uid, { email: c.email, email_verified: c.email_verified }) : env.unauthenticatedContext()).firestore();
  }
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  for (const c of casos(HOY, ANTES)) {
    if (c.t) { console.log(c.t); continue; }
    const db = dbs[c.q], d = c.d ? con(c.d, TS()) : null;
    let p;
    if (c.op === 'get') p = db.doc(c.r).get();
    else if (c.op === 'list') { let q = db.collection(c.r); for (const k in (c.f || {})) q = q.where(k, '==', c.f[k]); p = q.get(); }
    else if (c.op === 'set') p = db.doc(c.r).set(d);
    else if (c.op === 'update') p = db.doc(c.r).update(d);
    else p = db.doc(c.r).delete();
    try { await (c.ok ? assertSucceeds(p) : assertFails(p)); ok(true, c.m); }
    catch (e) { ok(false, c.m + ' · ' + (c.ok ? String(e.message || e).slice(0, 140) : 'se permitió')); }
  }
  await env.cleanup();
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
