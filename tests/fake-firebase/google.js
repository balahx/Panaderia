/* Doble de prueba de Google: intercepta la ida a accounts.google.com y devuelve a la app como lo haría Google,
   con un id_token de mentira (o con un error). Opciones: sub (cambia la cuenta: uid = 'u-' + sub), email, name, state, nonce (para forzar respuestas falsas),
   error, rechazar (Firebase no acepta el token), visto(url). */
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = d => b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64(d) + '.firma-de-prueba';
async function fakeGoogle(target, o) {
  o = o || {};
  await target.unroute('https://accounts.google.com/**').catch(() => {});
  await target.route('https://accounts.google.com/**', route => {
    const u = new URL(route.request().url()), q = u.searchParams;
    if (o.visto) o.visto(u);
    const t = token({ sub: o.sub || '1001', email: o.email || 'rosa@example.com', name: o.name || 'Rosa Dueña', nonce: o.nonce || q.get('nonce'), aud: q.get('client_id'), rechazar: !!o.rechazar });
    const frag = o.error ? 'error=' + o.error + '&state=' + q.get('state') : 'state=' + (o.state || q.get('state')) + '&id_token=' + t + '&authuser=0&prompt=consent';
    route.fulfill({ status: 302, headers: { location: q.get('redirect_uri') + '#' + frag } });
  });
}
module.exports = { fakeGoogle, token };
