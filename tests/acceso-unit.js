/* Parte pura del ingreso con Google (core/acceso.js) y del formato (core/formato.js). Uso: node tests/acceso-unit.js */
const path = require('path'), { pathToFileURL } = require('url');
const CORE = path.resolve(__dirname, '..', 'APP', 'js', 'core');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = d => b64({ alg: 'RS256' }) + '.' + b64(d) + '.firma';
(async () => {
  const A = await import(pathToFileURL(path.join(CORE, 'acceso.js'))), F = await import(pathToFileURL(path.join(CORE, 'formato.js')));
  console.log('1. Dirección de Google');
  const u = new URL(A.urlGoogle({ clientId: 'cli.apps.googleusercontent.com', redirectUri: 'https://pan.web.app/', state: 'S1', nonce: 'N1' }));
  ok(u.origin === 'https://accounts.google.com' && u.pathname === '/o/oauth2/v2/auth', 'va a accounts.google.com');
  ok(u.searchParams.get('response_type') === 'id_token' && u.searchParams.get('scope') === 'openid email profile', 'pide solo la identidad (id_token; nombre y correo)');
  ok(u.searchParams.get('client_id') === 'cli.apps.googleusercontent.com' && u.searchParams.get('redirect_uri') === 'https://pan.web.app/', 'cliente y dirección de retorno');
  ok(u.searchParams.get('state') === 'S1' && u.searchParams.get('nonce') === 'N1' && u.searchParams.get('prompt') === 'select_account', 'state, nonce y elección de cuenta');

  console.log('2. Respuesta de Google');
  ok(A.leerRespuesta('') === null && A.leerRespuesta('#seccion') === null && A.leerRespuesta(null) === null, 'una dirección normal no es una respuesta');
  const r = A.leerRespuesta('#state=S1&id_token=aaa.bbb.ccc&authuser=0&prompt=consent');
  ok(r && r.idToken === 'aaa.bbb.ccc' && r.state === 'S1' && r.error === '', 'lee id_token y state');
  ok(A.leerRespuesta('#error=access_denied&state=S1').error === 'access_denied', 'lee el error');
  const d = A.datosToken(token({ nonce: 'N1', email: 'ana@example.com', name: 'Ana Ñandú' }));
  ok(d && d.nonce === 'N1' && d.name === 'Ana Ñandú', 'lee el contenido del token (con tildes y ñ)');
  ok(A.datosToken('x') === null && A.datosToken('a.b.c') === null && A.datosToken('') === null, 'un texto que no es token da null');

  console.log('3. Validación');
  const g = { state: 'S1', nonce: 'N1', t: 1000 }, bien = { idToken: token({ nonce: 'N1' }), state: 'S1', error: '' };
  ok(A.validar(bien, g, 2000).ok === true && A.validar(bien, g, 2000).idToken === bien.idToken, 'respuesta correcta: se acepta');
  ok(A.validar({ ...bien, state: 'OTRO' }, g, 2000).error === 'estado', 'state distinto: se rechaza');
  ok(A.validar({ ...bien, state: '' }, g, 2000).error === 'estado', 'sin state: se rechaza');
  ok(A.validar({ ...bien, idToken: token({ nonce: 'OTRO' }) }, g, 2000).error === 'nonce', 'nonce distinto: se rechaza');
  ok(A.validar({ ...bien, idToken: 'basura' }, g, 2000).error === 'nonce', 'token ilegible: se rechaza');
  ok(A.validar(bien, null, 2000).error === 'sin-inicio' && A.validar(bien, {}, 2000).error === 'sin-inicio', 'sin ingreso comenzado en este equipo: se rechaza');
  ok(A.validar(bien, g, 1000 + 11 * 60000).error === 'vencido', 'pasados 10 minutos: se rechaza');
  ok(A.validar({ idToken: '', state: 'S1', error: 'access_denied' }, g, 2000).error === 'cancelado' && A.validar({ idToken: '', state: '', error: 'server_error' }, g, 2000).error === 'google', 'errores de Google');
  ok(Object.keys(A.MENSAJES).length >= 8 && ['cancelado', 'google', 'sin-inicio', 'vencido', 'estado', 'nonce', 'red', 'firebase'].every(k => A.MENSAJES[k]), 'cada error tiene su mensaje');

  console.log('4. Dirección oficial');
  ok(A.canonico({ hostname: 'pan-123.firebaseapp.com', pathname: '/index.html' }) === 'https://pan-123.web.app/index.html', 'firebaseapp.com lleva a web.app');
  ok(A.canonico({ hostname: 'pan-123.web.app', pathname: '/' }) === null && A.canonico({ hostname: 'localhost', pathname: '/' }) === null, 'web.app y localhost se quedan');

  console.log('5. Formato');
  ok(F.clp(1234567) === '$1.234.567' && F.clp(0) === '$0' && F.clp(999.6) === '$1.000' && F.clp(-2500) === '-$2.500', 'pesos sin decimales y con puntos');
  ok(F.kilos(12.5) === '12,50' && F.kilos(0) === '0,00' && F.kilos(1234.567) === '1.234,57' && F.kilos(19.999) === '20,00', 'kilos con 2 decimales');
  ok(F.fechaTexto('2026-11-05') === '5 nov 2026' && F.fechaTexto('') === '', 'fecha legible');
  ok(F.diaChile(new Date('2026-11-14T02:30:00Z')) === '2026-11-13' && F.diaChile(new Date('2026-07-01T03:59:00Z')) === '2026-06-30' && F.diaChile(new Date('2026-07-01T04:00:00Z')) === '2026-07-01', 'día calendario chileno (verano UTC−3, invierno UTC−4)');
  ok(F.esc('<a href="x">&\'') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;' && F.esc(null) === '', 'escape de HTML');
  ok(F.iniciales('Felipe González') === 'FG' && F.iniciales('ana') === 'A' && F.iniciales('') === '?', 'iniciales');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
