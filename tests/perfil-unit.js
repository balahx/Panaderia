/* Perfiles (core/perfil.js): qué pantalla corresponde con lo que se sabe de la cuenta, también sin conexión. Uso: node tests/perfil-unit.js */
const path = require('path'), { pathToFileURL } = require('url');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => {
  const P = await import(pathToFileURL(path.join(__dirname, '..', 'APP', 'js', 'core', 'perfil.js')).href);
  const NEG = { duenos: ['rosa', 'pedro'], nombre: 'Panadería', iva: 19 }, TODO = { negocio: true, miembro: true, solicitud: true };
  const r = o => P.resolver(Object.assign({ uid: 'x', firme: {} }, o));
  const m = (perfil, activo) => ({ nombre: 'X', correo: 'x@example.com', perfil, activo });

  console.log('1. Perfil de la cuenta');
  ok(r({ uid: 'rosa', negocio: NEG }) === 'dueno', 'quien figura en config/negocio es dueño');
  ok(r({ uid: 'rosa', negocio: NEG, miembro: m('pesaje', true), firme: TODO }) === 'dueno', 'ser dueño manda sobre cualquier ficha de miembro');
  ok(r({ negocio: NEG, miembro: m('externo', true), firme: TODO }) === 'externo', 'miembro activo con perfil externo');
  ok(r({ negocio: NEG, miembro: m('pesaje', true), firme: TODO }) === 'pesaje', 'miembro activo con perfil pesaje');
  ok(r({ negocio: NEG, miembro: m('pesaje', false), firme: TODO }) === 'sin-acceso', 'con el acceso quitado no entra');
  ok(r({ negocio: NEG, miembro: m('dueno', true), firme: TODO }) === 'sin-acceso', 'un perfil «dueño» escrito en una ficha no vale: los dueños solo salen de config/negocio');
  ok(r({ negocio: NEG, miembro: m('jefe', true), firme: TODO }) === 'sin-acceso', 'un perfil desconocido no entra');
  ok(r({ negocio: { duenos: 'x' }, miembro: null, solicitud: null, firme: TODO }) === 'pedir', 'una lista de dueños mal formada no convierte a nadie en dueño');

  console.log('2. Sin perfil todavía');
  ok(r({}) === 'comprobando', 'sin datos aún: comprobando');
  ok(r({ negocio: NEG, firme: { negocio: true } }) === 'comprobando', 'falta saber si hay ficha: comprobando');
  ok(r({ negocio: NEG, miembro: null, firme: { negocio: true, miembro: true } }) === 'comprobando', 'falta saber si hay solicitud: comprobando');
  ok(r({ negocio: NEG, miembro: null, solicitud: null, firme: TODO }) === 'pedir', 'sin ficha ni solicitud: puede pedir acceso');
  ok(r({ negocio: NEG, miembro: null, solicitud: { nombre: 'X' }, firme: TODO }) === 'espera', 'con solicitud enviada: espera la aprobación');
  ok(r({ negocio: null, miembro: null, solicitud: null, firme: TODO }) === 'sin-negocio', 'sin config/negocio: falta el primer paso de configuración');
  ok(r({ error: 'permission-denied' }) === 'error', 'si Firestore rechaza la lectura: error');

  console.log('3. Sin conexión (copia del equipo)');
  ok(r({ uid: 'rosa', negocio: NEG, firme: {} }) === 'dueno', 'la dueña entra sin internet con lo guardado');
  ok(r({ miembro: m('pesaje', true), firme: {} }) === 'pesaje', 'la tablet entra sin internet con su ficha guardada');
  ok(r({ negocio: NEG, firme: {} }) === 'comprobando', 'que «no hay ficha» no se concluye sin que lo diga el servidor');
  ok(r({ uid: 'rosa', negocio: NEG, error: 'unavailable' }) === 'dueno', 'un error de red no saca a quien ya tiene perfil conocido');

  console.log('4. Permisos y textos');
  ok(P.puede('dueno', 'accesos') && !P.puede('externo', 'accesos') && !P.puede('pesaje', 'accesos'), 'accesos: solo dueños');
  ok(P.puede('dueno', 'gestion') && P.puede('externo', 'gestion') && !P.puede('pesaje', 'gestion'), 'gestión (precios, ventas): dueños y externo, no pesaje');
  ok(['dueno', 'externo', 'pesaje'].every(p => P.puede(p, 'pesaje')) && !P.puede('pedir', 'pesaje') && !P.puede('dueno', 'otra'), 'pesaje: los tres perfiles; nada para quien no tiene perfil');
  ok(JSON.stringify(P.ASIGNABLES) === '["externo","pesaje"]', 'un dueño solo asigna externo o pesaje');
  ok(P.nombrePerfil('dueno') === 'Dueño' && P.nombrePerfil('pesaje') === 'Pesaje' && P.nombrePerfil('x') === '—', 'nombres de los perfiles');
  ok(P.esPerfil('externo') && !P.esPerfil('espera') && !P.esPerfil('comprobando'), 'esPerfil distingue perfiles de estados de espera');
  ok(P.limpiarNombre('  Ana   María  ') === 'Ana María' && P.nombreValido('Al') && !P.nombreValido(' a ') && P.limpiarNombre('x'.repeat(90)).length === 60, 'nombre de la solicitud: limpio, de 2 a 60 caracteres');
  ok(P.ordenarSolicitudes([{ id: 'b', creado: 2 }, { id: 'a', creado: 1 }]).map(x => x.id).join('') === 'ab', 'solicitudes: la más antigua primero');
  ok(P.ordenarMiembros([{ nombre: 'Zoe', activo: true }, { nombre: 'Ana', activo: false }, { nombre: 'Beto', activo: true }]).map(x => x.nombre).join(',') === 'Beto,Zoe,Ana', 'miembros: con acceso primero, por nombre');
  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})();
