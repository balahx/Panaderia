/* Casos de prueba de las reglas de Firestore, compartidos por:
     tests/rules-emulator.js  → contra las reglas REALES (firestore.rules) en el emulador (GitHub Actions, o «npm run reglas»)
     tests/reglas-unit.js     → contra la copia a mano (tests/fake-firebase/reglas.mjs) que usan las pruebas de pantalla
   Así las dos se mantienen iguales. Los casos corren en orden y las escrituras permitidas quedan guardadas.
   En los datos:  '@TS' = hora del servidor · HOY = día chileno de hoy · AYER = el día anterior · ANTES = hace tres días (no anteayer:
   cerca de la medianoche las reglas aceptan dos días para «hoy» y dos para «ayer», ver esHoy y esAyer en firestore.rules).
   Los casos de lectura con AYER se evitan por lo mismo: a esa hora AYER puede valer como «hoy». */
const CUENTAS = {
  rosa: { uid: 'rosa', email: 'rosa@example.com', email_verified: true },       // dueña
  pedro: { uid: 'pedro', email: 'pedro@example.com', email_verified: true },    // dueño
  felipe: { uid: 'felipe', email: 'felipe@example.com', email_verified: true }, // externo
  tablet: { uid: 'tablet', email: 'tablet@example.com', email_verified: true }, // pesaje
  ines: { uid: 'ines', email: 'ines@example.com', email_verified: true },       // externo con el acceso quitado
  carla: { uid: 'carla', email: 'carla@example.com', email_verified: true },    // cuenta nueva, sin acceso
  dani: { uid: 'dani', email: 'dani@example.com', email_verified: false },      // correo sin verificar
  rosaClave: { uid: 'rosa', email: 'rosa@example.com', email_verified: true, proveedor: 'password' },       // el UID de la dueña, pero con ingreso por correo y clave (no Google)
  rosaSinVerificar: { uid: 'rosa', email: 'rosa@example.com', email_verified: false },                       // el UID de la dueña, con Google pero el correo sin verificar
  tabletAnonima: { uid: 'tablet', email_verified: false, proveedor: 'anonymous' },                           // el UID de la tablet, con ingreso anónimo
  nadie: null                                                                    // sin iniciar sesión
};
/* `proveedor` = sign_in_provider del token. Las reglas (sesion()) solo aceptan 'google.com' con el correo verificado (revisión del 25-nov-2026). */
for (const k in CUENTAS) if (CUENTAS[k] && !CUENTAS[k].proveedor) CUENTAS[k].proveedor = 'google.com';
const miembro = (nombre, perfil, activo) => ({ nombre, correo: nombre.toLowerCase() + '@example.com', perfil, activo, por: 'rosa', en: '@TS' });
const sinVacios = o => { for (const k in o) if (o[k] === undefined) delete o[k]; return o; };
const pesaje = (fecha, por, mas) => sinVacios(Object.assign({ fecha, hora: '07:15', entregaN: 1, productoId: 'p1', cantidad: 18.5, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: por, en: '@TS' }, mas || {}));
const cierre = (mes, por, mas) => Object.assign({ mes, origen: 'excel', cerrado: true, iva: 19, lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 100, precio: 1450, neto: 145000 }],
  neto: 145000, ivaMonto: 27550, total: 172550, kg: 100, un: 0, por, quien: 'Nombre', en: '@TS' }, mas || {});
const reabrir = por => ({ cerrado: false, reabiertoPor: por, reabiertoQuien: 'Nombre', reabiertoEn: '@TS', en: '@TS' });
const metas = (...v) => Array.from({ length: 12 }, (x, i) => (i < v.length ? v[i] : null));
const proy = (anio, por, mas) => Object.assign({ anio, factor: 1.05, factorPrecio: 1.03, panes: { p1: 1.1, u5: 0.95 }, metas: metas(2500000, 2400000, null, 2600000), por, quien: 'Nombre', en: '@TS' }, mas || {});
const mesSiguiente = mes => { const [a, m] = mes.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
const insumo = (mas) => Object.assign({ nombre: 'Levadura', unidad: 'kg', activo: true, en: '@TS' }, mas || {});
const precioIns = (insumoId, desde, mas) => Object.assign({ insumoId, formato: 0.5, neto: 2250, desde, en: '@TS' }, mas || {});
const receta = (productoId, desde, por, mas) => Object.assign({ productoId, desde, items: [{ insumoId: 'i1', cantidad: 12.5 }, { insumoId: 'i2', cantidad: 0.13 }], rendimiento: 16.5, nota: 'Levadura: invierno 130 g', por, en: '@TS' }, mas || {});
const gastos = (mes, por, mas) => Object.assign({ mes, items: [{ nombre: 'Gas', monto: 180000 }, { nombre: 'Sueldos', monto: 900000 }], por, quien: 'Nombre', en: '@TS' }, mas || {});
const plan = (fecha, por, mas) => Object.assign({ fecha, items: [{ productoId: 'p1', cantidad: 120, unidad: 'kg', tandas: 7.3 }, { productoId: 'u5', cantidad: 600, unidad: 'un', tandas: null }], nota: 'Viernes: más hallulla', por, quien: 'Nombre', en: '@TS' }, mas || {});   // Fase 10
const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* Fase 12: cobros, abonos y cotizaciones. Un cobro o una cotización se crea en un LOTE con el folio (op 'batch': w = [{ op, r, d }]). */
const cuatro = n => String(n).padStart(4, '0');
const EMISOR = { razonSocial: 'Panadería Familiar SpA', rut: '76.123.456-0', direccion: 'Calle 1', correo: '', banco: '', tipoCuenta: '', cuenta: '', rutCuenta: '', correoAviso: '' };
const empresa = (por, mas) => Object.assign({}, EMISOR, { por, quien: 'Nombre', en: '@TS' }, mas || {});
const cobro = (numero, por, mas) => Object.assign({ numero, clienteId: 'c2', cliente: { nombre: 'Almacén Rosa', razonSocial: '', rut: '', direccion: '', contacto: '' }, emisor: EMISOR,
  fecha: '2026-11-21', desde: '2026-11-09', hasta: '2026-11-15', periodo: 'semana',
  lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 40, precio: 1600, neto: 64000, conIva: 1904, monto: 76160 }], anexo: [{ fecha: '2026-11-10', entregas: 1, items: [{ productoId: 'p1', cantidad: 40 }] }],
  neto: 64000, descuento: null, netoFinal: 64000, iva: 19, ivaMonto: 12160, total: 76160, ajuste: 0, plazo: 7, vence: '2026-11-28', factura: null, anulado: null, reemplaza: null, por, quien: 'Nombre', en: '@TS' }, mas || {});
const abono = (por, mas) => Object.assign({ clienteId: 'c2', fecha: '2026-11-20', monto: 50000, medio: 'transferencia', nota: '', aplicado: [{ cobro: 3, monto: 50000 }], aFavor: 0, anulado: null, reparto: null, por, quien: 'Nombre', en: '@TS' }, mas || {});
const cotiz = (numero, por, mas) => Object.assign({ numero, para: { nombre: 'Casino Sur', contacto: 'Ana', razonSocial: '', rut: '', direccion: '' }, baseClienteId: 'c1', cantidadesPor: 'semana',
  lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', neto: 1550, conIva: 1844.5, cantidad: 40, monto: 73780 }], descuento: null, neto: 62000, netoFinal: 62000, iva: 19, ivaMonto: 11780, total: 73780, ajuste: 0,
  fecha: '2026-11-21', validaHasta: '2026-12-06', estado: 'enviada', clienteId: null, cambio: null, emisor: EMISOR, por, quien: 'Nombre', en: '@TS' }, mas || {});
const sello = por => ({ por, quien: 'Nombre', en: '@TS' });
const anular = (por, mas) => Object.assign({ motivo: 'Canastos corregidos', por, quien: 'Nombre', en: '@TS' }, mas || {});
const cambio = (tipo, fecha, por, mas) => Object.assign({ tipo, pesajeId: 'hoy1', fecha, antes: { cantidad: 18.5 }, despues: { cantidad: 19 }, por, en: '@TS' }, mas || {});

function semilla(HOY, ANTES, AYER) {
  return {
    'config/negocio': { duenos: ['rosa', 'pedro'], nombre: 'Panadería', iva: 19 },
    'miembros/felipe': miembro('Felipe', 'externo', true),
    'miembros/tablet': miembro('Tablet', 'pesaje', true),
    'miembros/ines': miembro('Ines', 'externo', false),
    'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', activo: true, en: '@TS' },
    'precios/pr1': { productoId: 'p1', clienteId: 'c1', neto: 1450, desde: '2026-01-01', en: '@TS' },   // sembrado sin pasar por las reglas
    'trabajadores/t1': { nombre: 'Luis', activo: true, en: '@TS' },
    'clientes/c1': { nombre: 'Supermercado', activo: true, en: '@TS' },
    'clientes/c2': { nombre: 'Almacén Rosa', activo: true, tipo: 'regular', en: '@TS' },          // Fase 11: varios clientes
    'clientes/cs': { nombre: 'Ventas sueltas', activo: true, tipo: 'suelta', en: '@TS' },
    'clientes/c9': { nombre: 'Casino cerrado', activo: false, en: '@TS' },
    ['dias/' + HOY + '_c2']: { entregaN: 1, por: 'tablet', en: '@TS' },
    'pesajes/hoyc9': pesaje(HOY, 'tablet', { clienteId: 'c9' }),
    'pesajes/hoy1': pesaje(HOY, 'tablet'),
    'pesajes/viejo1': pesaje(ANTES, 'tablet'),
    'productos/u5': { nombre: 'Pan de completo', unidad: 'un', activo: true, en: '@TS' },
    ['dias/' + HOY]: { entregaN: 1, por: 'tablet', en: '@TS' },
    ['dias/' + ANTES]: { entregaN: 3, por: 'tablet', en: '@TS' },
    'cierres/2026-10': cierre('2026-10', 'rosa'),                                                                           // cerrado
    'cierres/2026-09': cierre('2026-09', 'rosa', { cerrado: false, reabiertoPor: 'rosa', reabiertoQuien: 'Rosa', reabiertoEn: '@TS' }),   // reabierto
    'pesajes/oct1': pesaje('2026-10-15', 'rosa'),
    'pesajes/sep1': pesaje('2026-09-15', 'rosa'),
    'proyeccion/2027': { factor: 1.05, en: '@TS' },
    'cambios/x1': { que: 'corrección', por: 'rosa', en: '@TS' },
    'insumos/i1': { nombre: 'Harina', unidad: 'kg', activo: true, en: '@TS' },                                    // Fase 9: costos
    'preciosInsumo/i1_2026-01-01': { insumoId: 'i1', formato: 25, neto: 18500, desde: '2026-01-01', en: '@TS' },
    'recetas/p1_2026-01-01': receta('p1', '2026-01-01', 'rosa'),
    'gastos/2026-10': gastos('2026-10', 'rosa'),
    ['planes/' + HOY]: plan(HOY, 'rosa'),                                                                          // Fase 10: plan del día
    ['planes/' + sumarDias(HOY, 1)]: plan(sumarDias(HOY, 1), 'rosa'),
    ['planes/' + ANTES]: plan(ANTES, 'rosa')
  };
}

function casos(HOY, ANTES, AYER) {
  const C = []; const t = titulo => C.push({ t: titulo });
  const si = (q, op, r, m, d, f) => C.push({ q, op, r, d, f, ok: true, m });
  const no = (q, op, r, m, d, f) => C.push({ q, op, r, d, f, ok: false, m });
  const sol = (nombre, correo) => ({ nombre, correo, creado: '@TS' });

  t('1. Sin sesión y sin acceso');
  no('nadie', 'get', 'config/negocio', 'sin iniciar sesión no se lee nada');
  no('nadie', 'list', 'productos', 'ni el catálogo');
  si('carla', 'get', 'config/negocio', 'con sesión se lee quiénes son los dueños (para saber el propio perfil)');
  no('carla', 'list', 'productos', 'una cuenta sin aprobar no lee el catálogo');
  no('carla', 'get', 'precios/pr1', 'ni los precios');
  no('carla', 'list', 'pesajes', 'ni los pesajes', null, { fecha: HOY });
  no('carla', 'set', 'productos/p9', 'ni escribe', { nombre: 'Pan', unidad: 'kg', activo: true, en: '@TS' });

  t('2. Nadie se nombra dueño');
  no('carla', 'set', 'config/negocio', 'una cuenta cualquiera no cambia la lista de dueños', { duenos: ['carla'], nombre: 'Panadería', iva: 19 });
  no('felipe', 'update', 'config/negocio', 'el externo tampoco', { duenos: ['rosa', 'pedro', 'felipe'] });
  no('rosa', 'update', 'config/negocio', 'ni siquiera un dueño agrega dueños desde la app (solo en la consola)', { duenos: ['rosa', 'pedro', 'felipe'] });
  si('rosa', 'update', 'config/negocio', 'un dueño ajusta el nombre y el IVA', { nombre: 'Panadería Rosa', iva: 19 });
  no('rosa', 'update', 'config/negocio', 'con un IVA fuera de rango se rechaza', { iva: 250 });
  no('rosa', 'delete', 'config/negocio', 'no se borra desde la app');
  no('carla', 'set', 'miembros/carla', 'nadie se aprueba a sí mismo', miembro('Carla', 'externo', true));
  no('felipe', 'set', 'miembros/carla', 'el externo no aprueba accesos', Object.assign(miembro('Carla', 'pesaje', true), { por: 'felipe' }));
  no('tablet', 'update', 'miembros/tablet', 'la tablet no se cambia el perfil', { perfil: 'externo', en: '@TS' });
  no('ines', 'update', 'miembros/ines', 'quien perdió el acceso no se lo devuelve', { activo: true, en: '@TS' });

  t('3. Solicitudes de acceso');
  si('carla', 'set', 'solicitudes/carla', 'una persona pide acceso con su propio correo', sol('Carla Soto', 'carla@example.com'));
  no('carla', 'set', 'solicitudes/carla', 'la solicitud no se modifica', sol('Otra Persona', 'carla@example.com'));
  no('dani', 'set', 'solicitudes/dani', 'con el correo sin verificar no se pide acceso', sol('Dani Soto', 'dani@example.com'));
  no('ines', 'set', 'solicitudes/ines', 'ni con el correo de otra persona', sol('Ines Paz', 'otra@example.com'));
  no('ines', 'set', 'solicitudes/carla', 'ni a nombre de otra cuenta', sol('Ines Paz', 'ines@example.com'));
  no('ines', 'set', 'solicitudes/ines', 'ni con campos de más', Object.assign(sol('Ines Paz', 'ines@example.com'), { perfil: 'dueno' }));
  no('ines', 'set', 'solicitudes/ines', 'ni con una fecha puesta a mano', { nombre: 'Ines Paz', correo: 'ines@example.com', creado: 1700000000000 });
  si('carla', 'get', 'solicitudes/carla', 'cada quien lee la suya');
  no('ines', 'get', 'solicitudes/carla', 'no la de otra persona');
  no('felipe', 'list', 'solicitudes', 'el externo no ve las solicitudes');
  no('tablet', 'list', 'solicitudes', 'la tablet tampoco');
  si('rosa', 'list', 'solicitudes', 'los dueños ven todas');
  si('pedro', 'get', 'solicitudes/carla', 'cualquiera de los dos dueños');

  t('4. Aprobar, cambiar perfil y quitar accesos: solo dueños');
  si('rosa', 'set', 'miembros/carla', 'un dueño aprueba con perfil pesaje', miembro('Carla Soto', 'pesaje', true));
  si('rosa', 'delete', 'solicitudes/carla', 'y borra la solicitud');
  no('rosa', 'set', 'miembros/dani', 'no existe el perfil «dueño» para miembros', miembro('Dani', 'dueno', true));
  no('rosa', 'set', 'miembros/dani', 'la aprobación queda a nombre de quien aprueba', Object.assign(miembro('Dani', 'externo', true), { por: 'pedro' }));
  no('rosa', 'set', 'miembros/dani', 'y con la hora del servidor', Object.assign(miembro('Dani', 'externo', true), { en: 1700000000000 }));
  si('pedro', 'update', 'miembros/carla', 'el otro dueño le cambia el perfil', { perfil: 'externo', por: 'pedro', en: '@TS' });
  si('pedro', 'update', 'miembros/carla', 'y le quita el acceso (sin borrar nada)', { activo: false, por: 'pedro', en: '@TS' });
  si('carla', 'get', 'miembros/carla', 'cada persona lee su propia ficha');
  no('felipe', 'get', 'miembros/carla', 'no la de otros');
  no('felipe', 'list', 'miembros', 'el externo no ve la lista de accesos');
  no('tablet', 'list', 'miembros', 'la tablet tampoco');
  si('rosa', 'list', 'miembros', 'los dueños sí');
  no('carla', 'list', 'productos', 'con el acceso quitado ya no se lee nada');
  si('rosa', 'delete', 'miembros/carla', 'un dueño puede borrar la ficha de quien ya no tiene acceso');
  no('felipe', 'delete', 'miembros/tablet', 'el externo no borra fichas');

  t('5. La cuenta de pesaje NO lee precios ni ventas (ni con peticiones directas)');
  no('tablet', 'get', 'precios/pr1', 'no lee un precio');
  no('tablet', 'list', 'precios', 'ni la lista de precios');
  no('tablet', 'list', 'precios', 'ni filtrando por producto', null, { productoId: 'p1' });
  no('tablet', 'set', 'precios/p1_c1_2026-12-01', 'ni los escribe', { productoId: 'p1', clienteId: 'c1', neto: 1, desde: '2026-12-01', en: '@TS' });
  no('tablet', 'delete', 'precios/pr1', 'ni los borra');
  no('tablet', 'get', 'cierres/2026-10', 'no lee cierres mensuales');
  no('tablet', 'list', 'cierres', 'ni su lista');
  no('tablet', 'get', 'proyeccion/2027', 'no lee proyecciones ni metas');
  no('tablet', 'get', 'cambios/x1', 'no lee la bitácora');
  no('tablet', 'list', 'cambios', 'ni su lista');
  no('ines', 'get', 'precios/pr1', 'una cuenta con el acceso quitado tampoco lee precios');

  t('6. Lo que sí hace la cuenta de pesaje');
  si('tablet', 'list', 'productos', 'lee el catálogo de productos (sin precios)');
  si('tablet', 'list', 'trabajadores', 'y la lista de trabajadores');
  no('tablet', 'set', 'productos/p9', 'pero no cambia el catálogo', { nombre: 'Pan', unidad: 'kg', activo: true, en: '@TS' });
  no('tablet', 'set', 'trabajadores/t9', 'ni los trabajadores', { nombre: 'Otro', activo: true, en: '@TS' });
  si('tablet', 'set', 'pesajes/n1', 'registra un pesaje de hoy', pesaje(HOY, 'tablet'));
  no('tablet', 'set', 'pesajes/n2', 'no en una fecha pasada', pesaje(ANTES, 'tablet'));
  no('tablet', 'set', 'pesajes/n3', 'no a nombre de otra cuenta', pesaje(HOY, 'rosa'));
  no('tablet', 'set', 'pesajes/n4', 'no con una hora puesta a mano', pesaje(HOY, 'tablet', { en: 1700000000000 }));
  no('tablet', 'set', 'pesajes/n5', 'no con cantidad cero', pesaje(HOY, 'tablet', { cantidad: 0 }));
  no('tablet', 'set', 'pesajes/n6', 'no con campos de más (por ejemplo un precio)', pesaje(HOY, 'tablet', { neto: 1450 }));
  si('tablet', 'get', 'pesajes/hoy1', 'lee un pesaje de hoy');
  si('tablet', 'list', 'pesajes', 'y la lista de hoy', null, { fecha: HOY });
  no('tablet', 'get', 'pesajes/viejo1', 'no lee pesajes de otros días');
  no('tablet', 'list', 'pesajes', 'ni su lista', null, { fecha: ANTES });
  no('tablet', 'list', 'pesajes', 'ni todos los pesajes sin filtro');
  si('tablet', 'update', 'pesajes/hoy1', 'corrige un pesaje de hoy', { cantidad: 19, en: '@TS' });
  si('tablet', 'update', 'pesajes/hoy1', 'o lo anula', { anulado: true, en: '@TS' });
  no('tablet', 'update', 'pesajes/viejo1', 'no corrige los de otros días', { cantidad: 19, en: '@TS' });
  no('tablet', 'update', 'pesajes/hoy1', 'no lo mueve a otra fecha', { fecha: ANTES, en: '@TS' });
  no('tablet', 'delete', 'pesajes/hoy1', 'los pesajes no se borran (se anulan)');
  si('tablet', 'get', 'dias/' + HOY, 'lee la entrega en curso de hoy');
  si('tablet', 'set', 'dias/' + HOY, 'y cierra la entrega (pasa a la n.º 2)', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'get', 'dias/' + ANTES, 'no lee otros días');
  no('tablet', 'set', 'dias/' + ANTES, 'ni los cambia', { entregaN: 4, por: 'tablet', en: '@TS' });
  si('tablet', 'set', 'cambios/x2', 'deja constancia de una corrección', cambio('corregir', HOY, 'tablet'));
  no('tablet', 'set', 'cambios/x3', 'no a nombre de otra cuenta', cambio('corregir', HOY, 'rosa'));

  t('7. Dueños y externo: todo, salvo accesos (el externo)');
  for (const q of ['rosa', 'felipe']) {
    si(q, 'list', 'precios', q + ' lee los precios');
    si(q, 'list', 'clientes', q + ' lee los clientes');
    si(q, 'list', 'pesajes', q + ' lee todos los pesajes');
    si(q, 'get', 'pesajes/viejo1', q + ' lee pesajes de cualquier día');
    si(q, 'get', 'cierres/2026-10', q + ' lee los cierres');
    si(q, 'get', 'proyeccion/2027', q + ' lee la proyección');
    si(q, 'list', 'cambios', q + ' lee la bitácora');
    si(q, 'set', 'productos/n-' + q, q + ' crea un producto', { nombre: 'Hallulla', unidad: 'kg', activo: true, en: '@TS' });
    si(q, 'set', 'precios/p1_c1_2026-11-01', q + ' fija un precio', { productoId: 'p1', clienteId: 'c1', neto: 1500, desde: '2026-11-01', en: '@TS' });
    si(q, 'set', 'pesajes/pas-' + q, q + ' registra en una fecha pasada', pesaje(ANTES, q));
    si(q, 'update', 'pesajes/viejo1', q + ' corrige un pesaje de otro día', { cantidad: 20, en: '@TS' });
    si(q, 'set', 'cierres/' + (q === 'rosa' ? '2026-08' : '2026-07'), q + ' cierra un mes terminado', cierre(q === 'rosa' ? '2026-08' : '2026-07', q));
    no(q, 'update', 'cierres/2026-10', q + ' NO modifica un mes cerrado', { neto: 1, total: 27551, en: '@TS' });
    no(q, 'set', 'cierres/2026-10', q + ' ni lo reemplaza', cierre('2026-10', q));
    no(q, 'delete', 'cierres/2026-10', q + ' ni lo borra');
    no(q, 'delete', 'pesajes/viejo1', q + ' no borra pesajes');
    no(q, 'delete', 'productos/p1', q + ' no borra productos (se desactivan)');
  }
  no('rosa', 'set', 'productos/malo', 'un producto necesita una unidad conocida', { nombre: 'Pan', unidad: 'litros', activo: true, en: '@TS' });
  no('rosa', 'update', 'cambios/x1', 'la bitácora no se reescribe', { que: 'otra cosa' });
  no('rosa', 'delete', 'cambios/x1', 'ni se borra');
  no('rosa', 'get', 'otra/cosa', 'una colección que no existe en las reglas queda cerrada');

  t('8. Catálogo: forma de los datos (Fase 3)');
  const prod = mas => Object.assign({ nombre: 'Pan de completo', unidad: 'un', activo: true, en: '@TS' }, mas || {});
  const precio = (desde, mas) => Object.assign({ productoId: 'p1', clienteId: 'c1', neto: 1600, desde, en: '@TS' }, mas || {});
  si('rosa', 'set', 'productos/u1', 'un producto por unidad lleva peso de referencia, categoría y orden', prod({ pesoRef: 100, categoria: 'Especiales', orden: 3 }));
  no('rosa', 'set', 'productos/k2', 'uno por kilo no lleva peso de referencia', { nombre: 'Hallulla', unidad: 'kg', pesoRef: 100, activo: true, en: '@TS' });
  no('rosa', 'set', 'productos/u2', 'el peso de referencia debe ser mayor que cero', prod({ pesoRef: 0 }));
  no('rosa', 'set', 'productos/u2', 'y un número', prod({ pesoRef: '100' }));
  no('rosa', 'set', 'productos/u2', 'la categoría no pasa de 40 letras', prod({ categoria: 'x'.repeat(41) }));
  no('rosa', 'set', 'productos/u2', 'el orden es un número', prod({ orden: 'primero' }));
  no('rosa', 'set', 'productos/u2', 'no se guarda sin decir si está activo', { nombre: 'Pan', unidad: 'un', en: '@TS' });
  no('rosa', 'set', 'productos/u2', 'ni con campos de más (por ejemplo un precio)', prod({ neto: 250 }));
  no('rosa', 'set', 'productos/u2', 'ni con una hora puesta a mano', prod({ en: 1700000000000 }));
  no('rosa', 'update', 'productos/p1', 'la unidad de un producto no cambia después de creado', { unidad: 'un', en: '@TS' });
  si('felipe', 'update', 'productos/p1', 'se le cambia el nombre, la categoría y el orden', { nombre: 'Marraqueta corriente', categoria: 'Corriente', orden: 1, en: '@TS' });
  si('felipe', 'update', 'productos/u1', 'se desactiva (sin borrarlo)', { activo: false, en: '@TS' });
  si('tablet', 'get', 'productos/u1', 'la tablet lo sigue leyendo');
  si('rosa', 'set', 'precios/p1_c1_2026-12-01', 'un precio nuevo rige desde su fecha', precio('2026-12-01'));
  si('rosa', 'get', 'precios/p1_c1_2026-11-01', 'y el anterior sigue guardado para los días pasados');
  si('felipe', 'set', 'precios/p1_c1_2026-12-01', 'el precio de una fecha se corrige en su mismo documento', precio('2026-12-01', { neto: 1612.5 }));
  no('rosa', 'set', 'precios/otro', 'el identificador de un precio es producto_cliente_fecha', precio('2026-12-15'));
  no('rosa', 'set', 'precios/p1_c1_2026-12-15', 'ni el de otra fecha', precio('2026-12-16'));
  no('rosa', 'set', 'precios/p1_c1_15-12-2026', 'la fecha va como AAAA-MM-DD', precio('15-12-2026'));
  no('rosa', 'set', 'precios/p1_c1_2026-12-15', 'el precio debe ser mayor que cero', precio('2026-12-15', { neto: 0 }));
  no('rosa', 'set', 'precios/p1_c1_2026-12-15', 'y un número', precio('2026-12-15', { neto: '1600' }));
  no('rosa', 'set', 'precios/p1__2026-12-15', 'no se guarda sin cliente', { productoId: 'p1', neto: 1600, desde: '2026-12-15', en: '@TS' });
  no('rosa', 'set', 'precios/p1_c1_2026-12-15', 'ni con campos de más', precio('2026-12-15', { nota: 'x' }));
  si('felipe', 'delete', 'precios/p1_c1_2026-12-01', 'un precio anotado por error se quita');
  si('felipe', 'set', 'trabajadores/t2', 'se agrega un trabajador', { nombre: 'Marta', activo: true, en: '@TS' });
  si('rosa', 'update', 'trabajadores/t2', 'y se desactiva', { activo: false, en: '@TS' });
  no('rosa', 'set', 'trabajadores/t3', 'un trabajador necesita nombre', { nombre: '', activo: true, en: '@TS' });
  no('rosa', 'set', 'trabajadores/t3', 'y decir si está activo', { nombre: 'Otro', en: '@TS' });
  no('rosa', 'delete', 'trabajadores/t2', 'los trabajadores no se borran (se desactivan)');
  si('felipe', 'update', 'clientes/c1', 'el externo cambia el nombre del cliente', { nombre: 'Supermercado Central', en: '@TS' });
  no('rosa', 'set', 'clientes/c2', 'un cliente necesita decir si está activo', { nombre: 'Almacén', en: '@TS' });
  no('rosa', 'delete', 'clientes/c1', 'los clientes no se borran');
  no('felipe', 'update', 'config/negocio', 'el IVA solo lo cambian los dueños', { iva: 10 });
  si('pedro', 'update', 'config/negocio', 'un dueño cambia el IVA', { iva: 19 });

  t('9. Pesaje y entregas: forma de los datos (Fase 4)');
  si('tablet', 'set', 'pesajes/f1', 'un canasto por unidad, con nota', pesaje(HOY, 'tablet', { productoId: 'u5', unidad: 'un', cantidad: 120, nota: 'Canasto chico' }));
  no('tablet', 'set', 'pesajes/f2', 'las unidades van sin decimales', pesaje(HOY, 'tablet', { productoId: 'u5', unidad: 'un', cantidad: 12.5 }));
  no('tablet', 'set', 'pesajes/f2', 'la unidad debe ser la del producto', pesaje(HOY, 'tablet', { productoId: 'u5', unidad: 'kg' }));
  no('tablet', 'set', 'pesajes/f2', 'el producto debe existir', pesaje(HOY, 'tablet', { productoId: 'no-existe' }));
  no('tablet', 'set', 'pesajes/f2', 'el trabajador debe estar en la lista', pesaje(HOY, 'tablet', { trabajadorId: 'no-existe' }));
  no('tablet', 'set', 'pesajes/f2', 'se dice quién pesó', pesaje(HOY, 'tablet', { trabajadorId: undefined }));
  no('tablet', 'set', 'pesajes/f2', 'la entrega es un número entero desde 1', pesaje(HOY, 'tablet', { entregaN: 0 }));
  no('tablet', 'set', 'pesajes/f2', 'y no un texto', pesaje(HOY, 'tablet', { entregaN: '1' }));
  no('tablet', 'set', 'pesajes/f2', 'la hora va como HH:MM', pesaje(HOY, 'tablet', { hora: '7:15' }));
  no('tablet', 'set', 'pesajes/f2', 'la fecha va como AAAA-MM-DD', pesaje(HOY.split('-').reverse().join('-'), 'tablet'));
  no('tablet', 'set', 'pesajes/f2', 'la nota no pasa de 200 letras', pesaje(HOY, 'tablet', { nota: 'x'.repeat(201) }));
  no('tablet', 'set', 'pesajes/f2', 'siempre dice si está anulado', pesaje(HOY, 'tablet', { anulado: undefined }));
  si('tablet', 'set', 'pesajes/f3', 'lo anotado sin conexión antes de la medianoche se acepta con la fecha de ayer', pesaje(AYER, 'tablet'));
  si('tablet', 'set', 'dias/' + AYER, 'y también el cierre de la entrega de ayer', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY, 'la tablet no salta entregas (de la 2 a la 4)', { entregaN: 4, por: 'tablet', en: '@TS' });
  si('tablet', 'set', 'dias/' + HOY, 'pasa a la siguiente (n.º 3)', { entregaN: 3, por: 'tablet', en: '@TS' });
  si('tablet', 'set', 'dias/' + HOY, 'o vuelve a abrir la anterior (n.º 2)', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY, 'a nombre de otra cuenta, no', { entregaN: 3, por: 'rosa', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY, 'ni con campos de más (por ejemplo totales)', { entregaN: 3, por: 'tablet', totales: { p1: 1 }, en: '@TS' });
  no('tablet', 'delete', 'dias/' + HOY, 'el día no se borra');
  no('tablet', 'list', 'dias', 'la tablet no lista los días');
  si('rosa', 'set', 'dias/' + ANTES, 'un dueño corrige el número de entrega de otro día', { entregaN: 1, por: 'rosa', en: '@TS' });
  no('rosa', 'set', 'dias/' + HOY, 'con un número fuera de rango, no', { entregaN: 51, por: 'rosa', en: '@TS' });
  si('felipe', 'update', 'pesajes/f1', 'el externo mueve un canasto a otra entrega', { entregaN: 2, en: '@TS' });
  no('felipe', 'update', 'pesajes/f1', 'pero no cambia quién lo creó', { creadoPor: 'felipe', en: '@TS' });
  si('rosa', 'set', 'cambios/x4', 'un dueño deja constancia de una anulación de otro día', cambio('anular', ANTES, 'rosa', { antes: { anulado: false }, despues: { anulado: true } }));
  no('tablet', 'set', 'cambios/x5', 'la tablet no deja constancias de otros días', cambio('corregir', ANTES, 'tablet'));
  no('rosa', 'set', 'cambios/x5', 'la constancia es de un tipo conocido', cambio('borrar', HOY, 'rosa'));
  no('rosa', 'set', 'cambios/x5', 'y lleva lo de antes y lo de después', cambio('corregir', HOY, 'rosa', { despues: 'otra cosa' }));
  no('rosa', 'set', 'cambios/x5', 'sin campos de más', cambio('corregir', HOY, 'rosa', { nota: 'x' }));

  t('10. Ventas, registro general y respaldo (Fase 5)');
  si('rosa', 'list', 'pesajes', 'un dueño lista los pesajes de un período (rango de fechas)', null, { fecha: [ANTES, HOY] });
  si('felipe', 'list', 'cambios', 'el externo lee la bitácora de un período', null, { fecha: [ANTES, HOY] });
  no('tablet', 'list', 'pesajes', 'la tablet no lista un período (solo lo de hoy)', null, { fecha: [ANTES, HOY] });
  no('tablet', 'list', 'cambios', 'ni la bitácora de un período', null, { fecha: [ANTES, HOY] });
  si('felipe', 'set', 'pesajes/pas1', 'el externo anota un canasto en fecha pasada', pesaje(ANTES, 'felipe', { nota: 'Anotado después' }));
  no('rosa', 'set', 'pesajes/pas2', 'pero a su propio nombre (no a nombre de otra cuenta)', pesaje(ANTES, 'felipe'));
  si('tablet', 'set', 'cambios/q1', 'la constancia puede llevar el nombre de la cuenta', cambio('corregir', HOY, 'tablet', { quien: 'Tablet Panadería' }));
  no('rosa', 'set', 'cambios/q2', 'el nombre no va vacío', cambio('corregir', HOY, 'rosa', { quien: '' }));
  no('rosa', 'set', 'cambios/q2', 'ni con más de 60 letras', cambio('corregir', HOY, 'rosa', { quien: 'x'.repeat(61) }));
  si('felipe', 'get', 'config/respaldo', 'el externo consulta el último respaldo (aunque aún no haya)');
  no('tablet', 'get', 'config/respaldo', 'la tablet no');
  no('carla', 'get', 'config/respaldo', 'ni una cuenta sin acceso');
  si('felipe', 'set', 'config/respaldo', 'el externo anota que descargó un respaldo', { por: 'felipe', quien: 'Felipe', conteos: { pesajes: 3 }, lecturas: 12, en: '@TS' });
  si('rosa', 'set', 'config/respaldo', 'y un dueño lo reemplaza con el suyo', { por: 'rosa', quien: 'Rosa', conteos: { pesajes: 4 }, lecturas: 13, en: '@TS' });
  no('rosa', 'set', 'config/respaldo', 'no a nombre de otra cuenta', { por: 'felipe', quien: 'Felipe', conteos: {}, lecturas: 1, en: '@TS' });
  no('rosa', 'set', 'config/respaldo', 'las lecturas son un número entero', { por: 'rosa', quien: 'Rosa', conteos: {}, lecturas: 1.5, en: '@TS' });
  no('rosa', 'set', 'config/respaldo', 'sin campos de más', { por: 'rosa', quien: 'Rosa', conteos: {}, lecturas: 1, archivo: 'x', en: '@TS' });
  no('tablet', 'set', 'config/respaldo', 'la tablet no anota respaldos', { por: 'tablet', quien: 'Tablet', conteos: {}, lecturas: 1, en: '@TS' });
  no('rosa', 'delete', 'config/respaldo', 'la marca del respaldo no se borra');
  no('rosa', 'set', 'config/ajustes', 'otros documentos de config siguen cerrados', { x: 1, en: '@TS' });

  t('11. Cierres mensuales y meses cerrados (Fase 6)');
  const MES = HOY.slice(0, 7), SIG = mesSiguiente(MES);
  no('rosa', 'set', 'cierres/' + MES, 'el mes en curso no se cierra', cierre(MES, 'rosa'));
  no('rosa', 'set', 'cierres/' + SIG, 'ni uno que no ha llegado', cierre(SIG, 'rosa'));
  no('rosa', 'set', 'cierres/2026-06', 'un cierre se guarda cerrado', cierre('2026-06', 'rosa', { cerrado: false }));
  no('rosa', 'set', 'cierres/2026-06', 'el mes del documento es el de su nombre', cierre('2026-05', 'rosa'));
  no('rosa', 'set', 'cierres/2026-6', 'el nombre es AAAA-MM', cierre('2026-6', 'rosa'));
  no('rosa', 'set', 'cierres/2026-06', 'el total es neto + IVA', cierre('2026-06', 'rosa', { total: 1 }));
  no('rosa', 'set', 'cierres/2026-06', 'los montos van en pesos enteros', cierre('2026-06', 'rosa', { neto: 145000.5, total: 172550.5 }));
  no('rosa', 'set', 'cierres/2026-06', 'lleva al menos un pan', cierre('2026-06', 'rosa', { lineas: [] }));
  no('rosa', 'set', 'cierres/2026-06', 'de un origen conocido (excel o app)', cierre('2026-06', 'rosa', { origen: 'otro' }));
  no('rosa', 'set', 'cierres/2026-06', 'sin campos de más', cierre('2026-06', 'rosa', { nota: 'x' }));
  no('rosa', 'set', 'cierres/2026-06', 'a nombre de quien cierra', cierre('2026-06', 'felipe'));
  no('rosa', 'set', 'cierres/2026-06', 'con el nombre de quien cierra', cierre('2026-06', 'rosa', { quien: '' }));
  no('tablet', 'set', 'cierres/2026-06', 'la tablet no cierra meses', cierre('2026-06', 'tablet'));
  no('carla', 'set', 'cierres/2026-06', 'ni una cuenta sin acceso', cierre('2026-06', 'carla'));
  si('felipe', 'set', 'cierres/2026-06', 'el externo importa un mes desde Excel', cierre('2026-06', 'felipe', { archivo: 'cierre-junio.xlsx', hoja: 'Hoja1', cliente: 'Supermercado', clienteId: 'c1' }));
  no('felipe', 'update', 'cierres/2026-06', 'el externo no reabre un mes cerrado', reabrir('felipe'));
  no('rosa', 'update', 'cierres/2026-06', 'al reabrir no se cambian los montos', Object.assign(reabrir('rosa'), { neto: 1, total: 27551 }));
  no('rosa', 'update', 'cierres/2026-06', 'ni se reabre a nombre de otro', reabrir('felipe'));
  si('rosa', 'update', 'cierres/2026-06', 'un dueño reabre un mes cerrado (queda quién y cuándo)', reabrir('rosa'));
  si('felipe', 'set', 'cierres/2026-06', 'reabierto, el externo lo vuelve a cerrar con los datos de la app', cierre('2026-06', 'felipe', { origen: 'app', canastos: 3, dias: 1, reabiertoPor: 'rosa', reabiertoQuien: 'Rosa' }));
  si('rosa', 'update', 'cierres/2026-06', 'se puede reabrir otra vez', reabrir('rosa'));
  si('felipe', 'delete', 'cierres/2026-06', 'reabierto, se puede borrar (vuelve a contar lo de la app)');
  no('rosa', 'set', 'pesajes/oct2', 'en un mes cerrado no se anota en fecha pasada', pesaje('2026-10-20', 'rosa'));
  no('felipe', 'update', 'pesajes/oct1', 'ni se corrige un canasto', { cantidad: 20, en: '@TS' });
  no('rosa', 'update', 'pesajes/oct1', 'ni se anula', { anulado: true, en: '@TS' });
  no('rosa', 'update', 'pesajes/sep1', 'ni se mueve un canasto a un mes cerrado', { fecha: '2026-10-20', en: '@TS' });
  si('rosa', 'update', 'pesajes/sep1', 'en un mes reabierto sí se corrige', { cantidad: 21, en: '@TS' });
  si('felipe', 'set', 'pesajes/sep2', 'y se anota en fecha pasada', pesaje('2026-09-20', 'felipe'));
  si('tablet', 'set', 'pesajes/hoy9', 'la tablet sigue anotando hoy', pesaje(HOY, 'tablet'));

  t('12. Proyección y metas (Fase 7)');
  si('rosa', 'set', 'proyeccion/2026', 'un dueño guarda la proyección de un año con sus metas', proy(2026, 'rosa'));
  si('felipe', 'set', 'proyeccion/2027', 'el externo también (reemplaza la anterior)', proy(2027, 'felipe', { panes: {}, metas: metas() }));
  si('felipe', 'update', 'proyeccion/2027', 'y cambia una meta', { metas: metas(3000000), por: 'felipe', quien: 'Felipe', en: '@TS' });
  si('rosa', 'set', 'proyeccion/2028', 'factores enteros también valen (1 = sin cambio)', proy(2028, 'rosa', { factor: 1, factorPrecio: 1 }));
  no('tablet', 'set', 'proyeccion/2026', 'la tablet no escribe proyecciones', proy(2026, 'tablet'));
  no('carla', 'set', 'proyeccion/2026', 'ni una cuenta sin acceso', proy(2026, 'carla'));
  no('ines', 'set', 'proyeccion/2026', 'ni quien perdió el acceso', proy(2026, 'ines'));
  no('rosa', 'set', 'proyeccion/2026', 'el año del documento es el de su nombre', proy(2025, 'rosa'));
  no('rosa', 'set', 'proyeccion/2026', 'el año es un número', proy('2026', 'rosa'));
  no('rosa', 'set', 'proyeccion/actual', 'el nombre es un año (AAAA)', proy(2026, 'rosa'));
  no('rosa', 'set', 'proyeccion/2026', 'el crecimiento es mayor que 0', proy(2026, 'rosa', { factor: 0 }));
  no('rosa', 'set', 'proyeccion/2026', 'y como mucho ×10', proy(2026, 'rosa', { factor: 11 }));
  no('rosa', 'set', 'proyeccion/2026', 'el factor de precio también', proy(2026, 'rosa', { factorPrecio: -1 }));
  no('rosa', 'set', 'proyeccion/2026', 'el factor es un número', proy(2026, 'rosa', { factor: '1,05' }));
  no('rosa', 'set', 'proyeccion/2026', 'los factores por pan van en un mapa', proy(2026, 'rosa', { panes: [1.1] }));
  no('rosa', 'set', 'proyeccion/2026', 'las metas son 12', proy(2026, 'rosa', { metas: metas(1, 2, 3).slice(0, 11) }));
  no('rosa', 'set', 'proyeccion/2026', 'cada meta en pesos enteros', proy(2026, 'rosa', { metas: metas(2500000.5) }));
  no('rosa', 'set', 'proyeccion/2026', 'y no negativa', proy(2026, 'rosa', { metas: metas(null, -1) }));
  no('rosa', 'set', 'proyeccion/2026', 'una meta no es un texto', proy(2026, 'rosa', { metas: metas(null, null, '2.500.000') }));
  no('rosa', 'set', 'proyeccion/2026', 'la meta de diciembre también se revisa', proy(2026, 'rosa', { metas: metas(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12.5) }));
  no('rosa', 'set', 'proyeccion/2026', 'sin campos de más', proy(2026, 'rosa', { nota: 'x' }));
  no('rosa', 'set', 'proyeccion/2026', 'sin que falte ninguno', (() => { const d = proy(2026, 'rosa'); delete d.factorPrecio; return d; })());
  no('rosa', 'set', 'proyeccion/2026', 'a nombre de quien la guarda', proy(2026, 'felipe'));
  no('rosa', 'set', 'proyeccion/2026', 'con su nombre', proy(2026, 'rosa', { quien: '' }));
  no('rosa', 'set', 'proyeccion/2026', 'con la hora del servidor', proy(2026, 'rosa', { en: 1 }));
  no('rosa', 'delete', 'proyeccion/2026', 'una proyección no se borra');
  t('13. Costos: insumos, precios de insumos, recetas y gastos del mes (Fase 9)');
  no('tablet', 'list', 'insumos', 'la tablet no lee los insumos');
  no('tablet', 'get', 'preciosInsumo/i1_2026-01-01', 'ni el precio de un insumo');
  no('tablet', 'list', 'preciosInsumo', 'ni su lista');
  no('tablet', 'list', 'recetas', 'ni las recetas');
  no('tablet', 'get', 'recetas/p1_2026-01-01', 'ni una receta');
  no('tablet', 'get', 'gastos/2026-10', 'ni los gastos del mes');
  no('tablet', 'list', 'gastos', 'ni su lista');
  no('carla', 'list', 'insumos', 'una cuenta sin acceso tampoco');
  no('ines', 'list', 'recetas', 'ni quien perdió el acceso');
  si('rosa', 'list', 'insumos', 'un dueño lee los insumos');
  si('felipe', 'list', 'preciosInsumo', 'el externo lee los precios de insumos');
  si('felipe', 'list', 'recetas', 'y las recetas');
  si('pedro', 'list', 'gastos', 'y los dueños, los gastos');
  si('rosa', 'set', 'insumos/i2', 'un dueño agrega un insumo', insumo());
  si('felipe', 'set', 'insumos/i3', 'el externo también (en litros)', insumo({ nombre: 'Agua', unidad: 'l' }));
  si('felipe', 'set', 'insumos/i4', 'o por unidad', insumo({ nombre: 'Huevo', unidad: 'un' }));
  si('rosa', 'update', 'insumos/i2', 'y lo desactiva', { activo: false, en: '@TS' });
  no('rosa', 'update', 'insumos/i1', 'la unidad de un insumo no cambia', { unidad: 'l', en: '@TS' });
  no('rosa', 'set', 'insumos/i5', 'unidad conocida (kg, l o un)', insumo({ unidad: 'saco' }));
  no('rosa', 'set', 'insumos/i5', 'con nombre', insumo({ nombre: '' }));
  no('rosa', 'set', 'insumos/i5', 'sin campos de más', insumo({ precio: 100 }));
  no('rosa', 'set', 'insumos/i5', 'con la hora del servidor', insumo({ en: 1 }));
  no('rosa', 'delete', 'insumos/i1', 'un insumo no se borra (se desactiva)');
  no('tablet', 'set', 'insumos/i5', 'la tablet no escribe insumos', insumo());
  si('rosa', 'set', 'preciosInsumo/i2_2026-01-01', 'un dueño anota el precio de factura de un insumo', precioIns('i2', '2026-01-01'));
  si('felipe', 'set', 'preciosInsumo/i1_2026-12-01', 'el externo anota un alza desde una fecha', precioIns('i1', '2026-12-01', { formato: 25, neto: 20000 }));
  si('felipe', 'set', 'preciosInsumo/i3_2026-01-01', 'un insumo puede costar $0 (el agua)', precioIns('i3', '2026-01-01', { formato: 1, neto: 0 }));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-02', 'el identificador es insumo_fecha', precioIns('i1', '2026-12-01'));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-05', 'el formato es mayor que 0', precioIns('i1', '2026-12-05', { formato: 0 }));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-05', 'el precio no es negativo', precioIns('i1', '2026-12-05', { neto: -1 }));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-05', 'el precio es un número', precioIns('i1', '2026-12-05', { neto: '18.500' }));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-5', 'la fecha es AAAA-MM-DD', precioIns('i1', '2026-12-5'));
  no('rosa', 'set', 'preciosInsumo/i1_2026-12-05', 'sin campos de más', precioIns('i1', '2026-12-05', { iva: 19 }));
  no('tablet', 'set', 'preciosInsumo/i1_2026-12-05', 'la tablet no anota precios de insumos', precioIns('i1', '2026-12-05'));
  si('felipe', 'delete', 'preciosInsumo/i1_2026-12-01', 'gestión quita un precio del historial');
  no('tablet', 'delete', 'preciosInsumo/i1_2026-01-01', 'la tablet no');
  si('rosa', 'set', 'recetas/u5_2026-01-01', 'un dueño anota la receta de un pan (por tanda)', receta('u5', '2026-01-01', 'rosa', { rendimiento: 192 }));
  si('felipe', 'set', 'recetas/p1_2027-01-01', 'el externo anota una receta nueva desde una fecha (sin nota)', (() => { const r = receta('p1', '2027-01-01', 'felipe'); delete r.nota; return r; })());
  si('rosa', 'set', 'recetas/p1_2026-01-01', 'y se corrige la receta de esa fecha', receta('p1', '2026-01-01', 'rosa', { rendimiento: 17 }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'el identificador es producto_fecha', receta('p1', '2026-01-01', 'rosa'));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'con al menos un ingrediente', receta('p1', '2026-02-01', 'rosa', { items: [] }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'y hasta 30', receta('p1', '2026-02-01', 'rosa', { items: Array.from({ length: 31 }, (x, i) => ({ insumoId: 'i' + i, cantidad: 1 })) }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'los ingredientes van en una lista', receta('p1', '2026-02-01', 'rosa', { items: { i1: 12 } }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'lo que sale es mayor que 0', receta('p1', '2026-02-01', 'rosa', { rendimiento: 0 }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'y es un número', receta('p1', '2026-02-01', 'rosa', { rendimiento: '16,5' }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'la nota, si va, con texto', receta('p1', '2026-02-01', 'rosa', { nota: '' }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'a nombre de quien la guarda', receta('p1', '2026-02-01', 'felipe'));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'con la hora del servidor', receta('p1', '2026-02-01', 'rosa', { en: 1 }));
  no('rosa', 'set', 'recetas/p1_2026-02-01', 'sin campos de más', receta('p1', '2026-02-01', 'rosa', { costo: 600 }));
  no('tablet', 'set', 'recetas/p1_2026-02-01', 'la tablet no escribe recetas', receta('p1', '2026-02-01', 'tablet'));
  si('felipe', 'delete', 'recetas/p1_2027-01-01', 'gestión quita una versión de la receta');
  si('rosa', 'set', 'gastos/2026-11', 'un dueño anota los gastos del mes', gastos('2026-11', 'rosa'));
  si('felipe', 'set', 'gastos/2026-10', 'el externo los corrige, también en un mes cerrado', gastos('2026-10', 'felipe', { items: [{ nombre: 'Gas', monto: 190000 }] }));
  si('felipe', 'set', 'gastos/2026-12', 'un mes puede quedar sin líneas', gastos('2026-12', 'felipe', { items: [] }));
  no('rosa', 'set', 'gastos/2026-11', 'el mes del documento es el de su nombre', gastos('2026-10', 'rosa'));
  no('rosa', 'set', 'gastos/noviembre', 'el nombre es un mes (AAAA-MM)', gastos('noviembre', 'rosa'));
  no('rosa', 'set', 'gastos/2026-11', 'hasta 30 líneas', gastos('2026-11', 'rosa', { items: Array.from({ length: 31 }, (x, i) => ({ nombre: 'G' + i, monto: 1 })) }));
  no('rosa', 'set', 'gastos/2026-11', 'las líneas van en una lista', gastos('2026-11', 'rosa', { items: { Gas: 1 } }));
  no('rosa', 'set', 'gastos/2026-11', 'a nombre de quien los guarda', gastos('2026-11', 'pedro'));
  no('rosa', 'set', 'gastos/2026-11', 'con su nombre', gastos('2026-11', 'rosa', { quien: '' }));
  no('rosa', 'set', 'gastos/2026-11', 'con la hora del servidor', gastos('2026-11', 'rosa', { en: 1 }));
  no('rosa', 'set', 'gastos/2026-11', 'sin campos de más', gastos('2026-11', 'rosa', { total: 1080000 }));
  no('rosa', 'delete', 'gastos/2026-11', 'los gastos de un mes no se borran');
  no('tablet', 'set', 'gastos/2026-11', 'la tablet no anota gastos', gastos('2026-11', 'tablet'));

  /* Fase 10. MANANA = hoy + 1 y PASADO = hoy + 2 según el día chileno. Los días pasados se prueban con ANTES (hace tres días): cerca de
     la medianoche «ayer» puede valer como «hoy» (ver esHoy). */
  const MANANA = sumarDias(HOY, 1), PASADO = sumarDias(HOY, 2);
  t('14. Plan de producción del día (Fase 10)');
  si('tablet', 'get', 'planes/' + HOY, 'la tablet lee el plan de hoy');
  no('tablet', 'get', 'planes/' + MANANA, 'pero no el de mañana');
  no('tablet', 'get', 'planes/' + ANTES, 'ni el de un día pasado');
  no('tablet', 'list', 'planes', 'ni la lista de planes');
  no('tablet', 'set', 'planes/' + HOY, 'la tablet no cambia el plan', plan(HOY, 'tablet'));
  no('tablet', 'set', 'planes/' + MANANA, 'ni arma el de mañana', plan(MANANA, 'tablet'));
  no('tablet', 'delete', 'planes/' + HOY, 'ni lo quita');
  no('carla', 'get', 'planes/' + HOY, 'una cuenta sin acceso no lee el plan');
  no('ines', 'get', 'planes/' + HOY, 'ni quien perdió el acceso');
  no('nadie', 'get', 'planes/' + HOY, 'ni sin sesión');
  si('felipe', 'list', 'planes', 'gestión lee todos los planes');
  si('rosa', 'get', 'planes/' + ANTES, 'también los de días pasados (para mirar)');
  si('rosa', 'set', 'planes/' + HOY, 'un dueño cambia el plan de hoy durante el día', plan(HOY, 'rosa', { items: [{ productoId: 'p1', cantidad: 140, unidad: 'kg', tandas: 8.5 }] }));
  si('felipe', 'set', 'planes/' + MANANA, 'el externo arma el plan de mañana (sin nota)', (() => { const x = plan(MANANA, 'felipe'); delete x.nota; return x; })());
  si('pedro', 'set', 'planes/' + MANANA, 'y otro dueño lo vuelve a cambiar', plan(MANANA, 'pedro'));
  no('rosa', 'set', 'planes/' + ANTES, 'un día pasado ya no se cambia', plan(ANTES, 'rosa'));
  no('rosa', 'delete', 'planes/' + ANTES, 'ni se quita');
  no('rosa', 'set', 'planes/' + PASADO, 'ni se arma para pasado mañana', plan(PASADO, 'rosa'));
  no('rosa', 'set', 'planes/' + MANANA, 'la fecha del documento es la de su nombre', plan(HOY, 'rosa'));
  no('rosa', 'set', 'planes/manana', 'el nombre es una fecha (AAAA-MM-DD)', plan('manana', 'rosa'));
  no('rosa', 'set', 'planes/' + MANANA, 'con al menos un pan', plan(MANANA, 'rosa', { items: [] }));
  no('rosa', 'set', 'planes/' + MANANA, 'y hasta 60', plan(MANANA, 'rosa', { items: Array.from({ length: 61 }, (x, i) => ({ productoId: 'p' + i, cantidad: 1, unidad: 'kg', tandas: null })) }));
  no('rosa', 'set', 'planes/' + MANANA, 'los panes van en una lista', plan(MANANA, 'rosa', { items: { p1: 120 } }));
  no('rosa', 'set', 'planes/' + MANANA, 'la nota, si va, con texto', plan(MANANA, 'rosa', { nota: '' }));
  no('rosa', 'set', 'planes/' + MANANA, 'a nombre de quien lo guarda', plan(MANANA, 'felipe'));
  no('rosa', 'set', 'planes/' + MANANA, 'con su nombre', plan(MANANA, 'rosa', { quien: '' }));
  no('rosa', 'set', 'planes/' + MANANA, 'con la hora del servidor', plan(MANANA, 'rosa', { en: 1 }));
  no('rosa', 'set', 'planes/' + MANANA, 'sin campos de más', plan(MANANA, 'rosa', { total: 120 }));
  si('felipe', 'delete', 'planes/' + MANANA, 'gestión quita el plan de mañana');
  si('rosa', 'delete', 'planes/' + HOY, 'y el de hoy');

  t('15. Varios clientes y ventas sueltas (Fase 11)');
  si('tablet', 'get', 'clientes/c2', 'la tablet lee un cliente (nombre, activo y tipo: sin montos)');
  si('tablet', 'list', 'clientes', 'y la lista de clientes, para elegir «Para:»');
  no('tablet', 'list', 'precios', 'pero sigue sin leer precios', null, { clienteId: 'c2' });
  no('tablet', 'set', 'clientes/c3', 'ni crea clientes', { nombre: 'Almacén', activo: true, en: '@TS' });
  no('tablet', 'update', 'clientes/c2', 'ni los cambia', { activo: false, en: '@TS' });
  no('carla', 'list', 'clientes', 'una cuenta sin acceso no los lee');
  si('felipe', 'set', 'clientes/c3', 'el externo crea un cliente regular', { nombre: 'Casino Norte', activo: true, tipo: 'regular', en: '@TS' });
  si('rosa', 'set', 'clientes/c4', 'un dueño crea uno sin tipo (= regular)', { nombre: 'Almacén Don Luis', activo: true, en: '@TS' });
  si('rosa', 'update', 'clientes/c4', 'y lo desactiva', { activo: false, en: '@TS' });
  no('rosa', 'set', 'clientes/c5', 'el tipo es regular o suelta', { nombre: 'Otro', activo: true, tipo: 'mayorista', en: '@TS' });
  no('rosa', 'set', 'clientes/c5', 'sin campos de más (los montos no van aquí)', { nombre: 'Otro', activo: true, neto: 1000, en: '@TS' });
  si('felipe', 'set', 'precios/p1_c2_2026-11-01', 'cada cliente tiene su propia lista de precios', { productoId: 'p1', clienteId: 'c2', neto: 1600, desde: '2026-11-01', en: '@TS' });
  si('tablet', 'set', 'pesajes/c2a', 'la tablet pesa para otro cliente', pesaje(HOY, 'tablet', { clienteId: 'c2' }));
  si('tablet', 'set', 'pesajes/csa', 'y una venta suelta con la nota de quién compró', pesaje(HOY, 'tablet', { clienteId: 'cs', nota: 'Sra. Marta' }));
  si('tablet', 'set', 'pesajes/c1a', 'sin cliente sigue valiendo (= el cliente original)', pesaje(HOY, 'tablet'));
  no('tablet', 'set', 'pesajes/c9a', 'no para un cliente desactivado', pesaje(HOY, 'tablet', { clienteId: 'c9' }));
  no('tablet', 'set', 'pesajes/c0a', 'ni para uno que no existe', pesaje(HOY, 'tablet', { clienteId: 'nadie' }));
  no('rosa', 'set', 'pesajes/c9b', 'tampoco gestión anota para un cliente desactivado', pesaje(ANTES, 'rosa', { clienteId: 'c9' }));
  no('tablet', 'set', 'pesajes/c0b', 'el cliente es un texto', pesaje(HOY, 'tablet', { clienteId: 7 }));
  si('tablet', 'update', 'pesajes/hoyc9', 'un canasto de un cliente que se desactivó se corrige igual (sin cambiar el cliente)', { cantidad: 19, en: '@TS' });
  si('tablet', 'update', 'pesajes/hoyc9', 'y se pasa a un cliente activo', { clienteId: 'c2', en: '@TS' });
  no('tablet', 'update', 'pesajes/hoyc9', 'pero no se devuelve a uno desactivado', { clienteId: 'c9', en: '@TS' });
  si('rosa', 'update', 'pesajes/c1a', 'gestión cambia el cliente al corregir', { clienteId: 'c3', en: '@TS' });
  no('tablet', 'update', 'pesajes/viejo1', 'la tablet sigue sin tocar otros días', { clienteId: 'c2', en: '@TS' });
  si('tablet', 'get', 'dias/' + HOY + '_c2', 'la tablet lee la entrega en curso de otro cliente (hoy)');
  si('tablet', 'set', 'dias/' + HOY + '_c2', 'y la cierra de a un paso', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY + '_c2', 'sin saltar entregas', { entregaN: 4, por: 'tablet', en: '@TS' });
  si('tablet', 'set', 'dias/' + HOY + '_c3', 'la primera entrega cerrada de un cliente nuevo hoy', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY + '_c3', 'se cuenta aparte de la del supermercado (sigue siendo de a un paso)', { entregaN: 4, por: 'tablet', en: '@TS' });
  si('tablet', 'get', 'dias/' + HOY, 'la del supermercado sigue en su documento de siempre');
  no('tablet', 'get', 'dias/' + ANTES + '_c2', 'la tablet no lee la de otro día');
  no('tablet', 'set', 'dias/' + ANTES + '_c2', 'ni la escribe', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('tablet', 'set', 'dias/' + HOY + '_nadie', 'el cliente del documento debe existir', { entregaN: 2, por: 'tablet', en: '@TS' });
  no('rosa', 'set', 'dias/' + HOY + '_c2_x', 'el nombre es fecha_cliente, nada más', { entregaN: 2, por: 'rosa', en: '@TS' });
  no('rosa', 'set', 'dias/' + HOY + '_', 'con el cliente escrito', { entregaN: 2, por: 'rosa', en: '@TS' });
  no('rosa', 'set', 'dias/hoy_c2', 'y una fecha', { entregaN: 2, por: 'rosa', en: '@TS' });
  si('rosa', 'set', 'dias/' + ANTES + '_c2', 'gestión fija cualquier número, de cualquier día', { entregaN: 3, por: 'rosa', en: '@TS' });
  const porCli = cierre('2025-06', 'felipe', { origen: 'app', neto: 205000, ivaMonto: 38950, total: 243950, kg: 140,
    lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 100, precio: 1450, neto: 145000, clienteId: 'c1', cliente: 'Supermercado' },
      { productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 40, precio: 1500, neto: 60000, clienteId: 'c2', cliente: 'Almacén Rosa' }],
    clientes: [{ clienteId: 'c1', cliente: 'Supermercado', neto: 145000, kg: 100, un: 0 }, { clienteId: 'c2', cliente: 'Almacén Rosa', neto: 60000, kg: 40, un: 0 }] });
  si('felipe', 'set', 'cierres/2025-06', 'un cierre con líneas por pan y por cliente, y el resumen por cliente', porCli);
  no('rosa', 'set', 'cierres/2025-05', 'el resumen por cliente va en una lista', cierre('2025-05', 'rosa', { clientes: { c1: 145000 } }));
  no('rosa', 'set', 'cierres/2025-05', 'de hasta 50 clientes', cierre('2025-05', 'rosa', { clientes: Array.from({ length: 51 }, (x, i) => ({ clienteId: 'c' + i, neto: 0 })) }));
  no('rosa', 'set', 'cierres/2025-05', 'pero no más de 600 líneas', cierre('2025-05', 'rosa', { lineas: Array.from({ length: 601 }, (x, i) => ({ productoId: 'p' + i, neto: 0 })) }));
  si('rosa', 'set', 'cierres/2025-04', 'las líneas pueden ser hasta 600 (panes × clientes)', cierre('2025-04', 'rosa', { lineas: Array.from({ length: 600 }, (x, i) => ({ productoId: 'p' + i, neto: 0 })) }));

  t('16. Cobros, abonos y cotizaciones (Fase 12)');
  const lote = (q, w, m, ok) => C.push({ q, op: 'batch', w, ok, m });
  const emitir = (q, n, f, m, ok, mas) => lote(q, [{ op: 'set', r: 'cobros/' + cuatro(n), d: cobro(n, q, mas) }, { op: 'set', r: 'config/folios', d: f }], m, ok);
  no('tablet', 'get', 'config/empresa', 'la tablet no lee los datos de la panadería');
  no('tablet', 'list', 'cobros', 'ni los cobros');
  no('tablet', 'list', 'abonos', 'ni los abonos');
  no('tablet', 'list', 'clientesCobro', 'ni los datos de cobro de los clientes (RUT, descuentos)');
  no('tablet', 'list', 'cotizaciones', 'ni las cotizaciones');
  no('tablet', 'get', 'config/folios', 'ni los folios');
  no('carla', 'list', 'cobros', 'una cuenta sin acceso tampoco');
  si('rosa', 'set', 'config/empresa', 'un dueño anota los datos de la panadería', empresa('rosa'));
  si('felipe', 'set', 'config/empresa', 'el externo también, a su nombre', empresa('felipe', { banco: 'Banco Estado', cuenta: '123456' }));
  si('felipe', 'get', 'config/empresa', 'y los lee');
  no('rosa', 'set', 'config/empresa', 'la razón social es obligatoria', empresa('rosa', { razonSocial: '' }));
  no('rosa', 'set', 'config/empresa', 'el RUT también', empresa('rosa', { rut: '' }));
  no('rosa', 'set', 'config/empresa', 'sin campos de más', empresa('rosa', { logo: 'x' }));
  no('rosa', 'set', 'config/empresa', 'a nombre de quien lo guarda', empresa('felipe'));
  no('tablet', 'set', 'config/empresa', 'la tablet no los escribe', empresa('tablet'));
  no('rosa', 'delete', 'config/empresa', 'no se borran');
  const cc = (por, mas) => Object.assign({ razonSocial: 'Comercial Rosa Ltda.', rut: '77.888.999-K', direccion: '', contacto: 'Rosa', periodo: 'semana', plazo: 7, descuento: null, por, en: '@TS' }, mas || {});
  si('felipe', 'set', 'clientesCobro/c2', 'los datos de cobro de un cliente (aparte de clientes)', cc('felipe'));
  si('rosa', 'set', 'clientesCobro/c2', 'con descuento habitual en %', cc('rosa', { descuento: { tipo: 'pct', valor: 5, texto: 'Descuento familia 5 %' } }));
  no('rosa', 'set', 'clientesCobro/zz', 'el cliente debe existir', cc('rosa'));
  no('rosa', 'set', 'clientesCobro/c2', 'el período es semana o mes', cc('rosa', { periodo: 'dia' }));
  no('rosa', 'set', 'clientesCobro/c2', 'el plazo, de 0 a 90 días', cc('rosa', { plazo: 91 }));
  no('rosa', 'set', 'clientesCobro/c2', 'el descuento es en % o en $', cc('rosa', { descuento: { tipo: 'regalo', valor: 5, texto: 'x' } }));
  no('rosa', 'set', 'clientesCobro/c2', 'y mayor que cero', cc('rosa', { descuento: { tipo: 'monto', valor: 0, texto: 'x' } }));
  lote('rosa', [{ op: 'set', r: 'clientes/c7', d: { nombre: 'Casino Norte', activo: true, tipo: 'regular', en: '@TS' } }, { op: 'set', r: 'clientesCobro/c7', d: cc('rosa') }], 'el cliente y sus datos de cobro se crean juntos', true);
  no('tablet', 'set', 'clientesCobro/c2', 'la tablet no escribe datos de cobro', cc('tablet'));
  no('rosa', 'set', 'cobros/0001', 'un cobro no se crea sin subir el folio en la misma escritura', cobro(1, 'rosa'));
  emitir('rosa', 2, { cobro: 2, cotizacion: 0 }, 'el folio no salta números', false);
  no('rosa', 'set', 'config/folios', 'el folio no sube sin su cobro', { cobro: 1, cotizacion: 0 });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'el número viene del folio + 1, con el documento 0001', false, { total: 1 });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'un cobro nace sin anular', false, { anulado: anular('rosa') });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'cobra desde el 1-nov-2026 (antes solo hay cierres del Excel)', false, { desde: '2026-10-27' });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'el cliente debe existir', false, { clienteId: 'zz' });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'con los datos de la panadería (razón social y RUT)', false, { emisor: Object.assign({}, EMISOR, { rut: '' }) });
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'hasta 60 líneas', false, { lineas: Array.from({ length: 61 }, () => ({ neto: 0 })) });
  emitir('tablet', 1, { cobro: 1, cotizacion: 0 }, 'la tablet no emite cobros', false);
  emitir('rosa', 1, { cobro: 1, cotizacion: 0 }, 'un dueño emite el cobro N.º 0001 junto con el folio', true);
  si('felipe', 'get', 'cobros/0001', 'el externo lo lee');
  emitir('felipe', 1, { cobro: 1, cotizacion: 0 }, 'el mismo número no se puede volver a sacar (otro equipo)', false);
  emitir('felipe', 2, { cobro: 1, cotizacion: 0 }, 'ni sin subir el folio', false);
  emitir('felipe', 3, { cobro: 2, cotizacion: 0 }, 'ni con un número distinto del folio', false);
  emitir('felipe', 2, { cobro: 2, cotizacion: 0 }, 'el externo emite el N.º 0002 (con descuento)', true, { descuento: { tipo: 'pct', valor: 5, texto: 'Familia 5 %', neto: 3200, conIva: 3808 }, netoFinal: 60800, ivaMonto: 11552, total: 72352, ajuste: 0 });
  no('rosa', 'update', 'cobros/0001', 'un cobro emitido no cambia sus montos', { total: 1 });
  no('rosa', 'update', 'cobros/0001', 'ni sus líneas', { lineas: [] });
  no('rosa', 'update', 'cobros/0001', 'ni el cliente', { clienteId: 'c1' });
  si('rosa', 'update', 'cobros/0001', 'se anota el n.º de factura SII', { factura: '4521' });
  no('rosa', 'update', 'cobros/0001', 'de hasta 30 caracteres', { factura: 'x'.repeat(31) });
  no('rosa', 'update', 'cobros/0001', 'anular pide un motivo', { anulado: anular('rosa', { motivo: '' }) });
  no('rosa', 'update', 'cobros/0001', 'a nombre de quien anula', { anulado: anular('felipe') });
  si('felipe', 'update', 'cobros/0002', 'se anula con motivo', { anulado: anular('felipe') });
  no('rosa', 'update', 'cobros/0002', 'anular es final: no vuelve atrás', { anulado: null });
  no('rosa', 'update', 'cobros/0002', 'y ya no cambia nada (ni la factura)', { factura: '9' });
  no('rosa', 'delete', 'cobros/0001', 'un cobro no se borra');
  lote('rosa', [{ op: 'set', r: 'cobros/0003', d: cobro(3, 'rosa', { reemplaza: 1 }) }, { op: 'set', r: 'config/folios', d: { cobro: 3, cotizacion: 0 } },
    { op: 'update', r: 'cobros/0001', d: { anulado: anular('rosa', { reemplazo: 3 }) } }], '«Anular y emitir de nuevo»: el nuevo, el folio y la anulación del anterior, juntos', true);
  si('rosa', 'set', 'abonos/a1', 'un abono aplicado a un cobro', abono('rosa'));
  si('felipe', 'get', 'abonos/a1', 'el externo lo lee');
  no('rosa', 'set', 'abonos/a2', 'el monto va en pesos enteros', abono('rosa', { monto: 1000.5 }));
  no('rosa', 'set', 'abonos/a2', 'mayor que cero', abono('rosa', { monto: 0, aplicado: [] }));
  no('rosa', 'set', 'abonos/a2', 'el medio: transferencia, efectivo, cheque u otro', abono('rosa', { medio: 'tarjeta' }));
  no('rosa', 'set', 'abonos/a2', 'lo que queda a favor no pasa del monto', abono('rosa', { aplicado: [], aFavor: 60000 }));
  no('rosa', 'set', 'abonos/a2', 'se reparte en 30 cobros como máximo', abono('rosa', { aplicado: Array.from({ length: 31 }, (x, i) => ({ cobro: i, monto: 1 })) }));
  no('rosa', 'set', 'abonos/a2', 'nace sin anular', abono('rosa', { anulado: anular('rosa') }));
  no('rosa', 'set', 'abonos/a2', 'el cliente debe existir', abono('rosa', { clienteId: 'zz' }));
  no('rosa', 'set', 'abonos/a2', 'sin campos de más (el saldo no se guarda)', abono('rosa', { saldo: 26160 }));
  no('tablet', 'set', 'abonos/a2', 'la tablet no anota abonos', abono('tablet'));
  si('felipe', 'update', 'abonos/a1', 'se cambia el reparto a mano (queda quién y cuándo)', { aplicado: [], aFavor: 50000, reparto: sello('felipe') });
  no('felipe', 'update', 'abonos/a1', 'a nombre de quien lo cambia', { aplicado: [{ cobro: 3, monto: 50000 }], aFavor: 0, reparto: sello('rosa') });
  si('rosa', 'update', 'abonos/a1', 'el saldo a favor se aplica a un cobro nuevo', { aplicado: [{ cobro: 3, monto: 50000, previo: true }], aFavor: 0 });
  no('rosa', 'update', 'abonos/a1', 'el monto no cambia', { monto: 1 });
  no('rosa', 'update', 'abonos/a1', 'ni la fecha', { fecha: '2026-11-01' });
  si('rosa', 'update', 'abonos/a1', 'un abono mal anotado se anula con motivo', { anulado: anular('rosa', { motivo: 'Mal anotado' }) });
  no('rosa', 'update', 'abonos/a1', 'anulado, ya no cambia', { aplicado: [], aFavor: 50000 });
  no('rosa', 'delete', 'abonos/a1', 'un abono no se borra');
  const emitirQ = (q, n, f, m, ok, mas) => lote(q, [{ op: 'set', r: 'cotizaciones/' + cuatro(n), d: cotiz(n, q, mas) }, { op: 'set', r: 'config/folios', d: f }], m, ok);
  emitirQ('felipe', 1, { cobro: 3, cotizacion: 1 }, 'una cotización nace enviada', false, { estado: 'aceptada' });
  emitirQ('felipe', 1, { cobro: 4, cotizacion: 1 }, 'el folio de cobros no se toca al cotizar', false);
  emitirQ('felipe', 1, { cobro: 3, cotizacion: 1 }, 'el externo emite la cotización N.º 0001 con su propio folio', true);
  emitirQ('rosa', 1, { cobro: 3, cotizacion: 1 }, 'su número tampoco se repite', false);
  emitirQ('rosa', 2, { cobro: 3, cotizacion: 2 }, 'sin cantidades no hay total estimado', true, { lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', neto: 1550, conIva: 1844.5, cantidad: null, monto: null }], neto: null, netoFinal: null, ivaMonto: null, total: null });
  no('rosa', 'update', 'cotizaciones/0001', 'una cotización emitida no cambia sus precios', { lineas: [] });
  no('rosa', 'update', 'cotizaciones/0001', 'el estado es enviada, aceptada o rechazada', { estado: 'perdida', cambio: sello('rosa') });
  no('rosa', 'update', 'cotizaciones/0001', 'cada cambio dice quién y cuándo', { estado: 'rechazada' });
  si('rosa', 'update', 'cotizaciones/0002', 'se marca rechazada', { estado: 'rechazada', cambio: sello('rosa') });
  no('rosa', 'update', 'cotizaciones/0002', 'no se enlaza a un cliente que no existe', { estado: 'aceptada', clienteId: 'zz', cambio: sello('rosa') });
  lote('rosa', [{ op: 'set', r: 'clientes/c8', d: { nombre: 'Casino Sur', activo: true, tipo: 'regular', en: '@TS' } }, { op: 'set', r: 'clientesCobro/c8', d: cc('rosa', { razonSocial: '', rut: '' }) },
    { op: 'set', r: 'precios/p1_c8_2026-11-21', d: { productoId: 'p1', clienteId: 'c8', neto: 1550, desde: '2026-11-21', en: '@TS' } },
    { op: 'update', r: 'cotizaciones/0001', d: { estado: 'aceptada', clienteId: 'c8', cambio: sello('rosa') } }], '«Crear cliente con estos precios»: cliente, datos de cobro, precios y la cotización aceptada, juntos', true);
  no('felipe', 'update', 'cotizaciones/0001', 'el cliente enlazado no se cambia', { clienteId: 'c2', cambio: sello('felipe') });
  no('rosa', 'delete', 'cotizaciones/0001', 'una cotización no se borra');
  no('tablet', 'get', 'cotizaciones/0001', 'y la tablet no la lee');

  /* ---------- Revisión de las reglas del 25-nov-2026 ---------- */
  const campos = n => Object.fromEntries(Array.from({ length: n }, (x, i) => ['campo' + i, i]));   // un mapa con n campos
  const futuro = sumarDias(HOY, 3);

  t('16b. Revisión de las reglas (1): solo vale la sesión de Google con el correo verificado');
  si('rosa', 'get', 'precios/pr1', 'control: la dueña con su sesión de Google lee los precios');
  no('rosaClave', 'get', 'precios/pr1', 'el mismo UID de la dueña, pero con ingreso por correo y clave: nada');
  no('rosaClave', 'get', 'config/negocio', 'ni siquiera la configuración del negocio');
  no('rosaClave', 'list', 'productos', 'ni el catálogo');
  no('rosaClave', 'set', 'productos/pg1', 'ni escribe', { nombre: 'Pan', unidad: 'kg', activo: true, en: '@TS' });
  no('rosaSinVerificar', 'get', 'precios/pr1', 'con Google pero el correo sin verificar tampoco');
  no('rosaSinVerificar', 'get', 'config/negocio', 'ni la configuración del negocio');
  no('tabletAnonima', 'list', 'pesajes', 'la cuenta de la tablet con ingreso anónimo no lee pesajes', null, { fecha: HOY });
  no('tabletAnonima', 'set', 'pesajes/an1', 'ni anota canastos', pesaje(HOY, 'tablet'));

  t('16b. Revisión de las reglas (2): la bitácora apunta a un canasto que existe');
  si('tablet', 'set', 'cambios/r1', 'control: la tablet deja constancia de un canasto de hoy', cambio('corregir', HOY, 'tablet'));
  no('tablet', 'set', 'cambios/r2', 'pero no de un canasto que no existe', cambio('corregir', HOY, 'tablet', { pesajeId: 'no-existe' }));
  no('tablet', 'set', 'cambios/r3', 'ni de un canasto de otro día con la fecha de hoy', cambio('corregir', HOY, 'tablet', { pesajeId: 'viejo1' }));
  no('rosa', 'set', 'cambios/r4', 'un dueño tampoco deja constancia de un canasto que no existe', cambio('anular', HOY, 'rosa', { pesajeId: 'no-existe' }));
  no('tablet', 'set', 'cambios/r5', 'lo de antes no pasa de 12 campos', cambio('corregir', HOY, 'tablet', { antes: campos(13) }));
  no('rosa', 'set', 'cambios/r6', 'ni lo de después', cambio('corregir', HOY, 'rosa', { despues: campos(13) }));
  si('rosa', 'set', 'cambios/r7', 'los 11 campos de un canasto sí caben', cambio('corregir', HOY, 'rosa', { antes: campos(11), despues: campos(11) }));

  t('16b. Revisión de las reglas (3): fechas válidas y sin futuro');
  no('rosa', 'set', 'pesajes/fe1', 'un canasto no lleva mes 00', pesaje('2026-00-10', 'rosa'));
  no('rosa', 'set', 'pesajes/fe2', 'ni día 32', pesaje('2026-05-32', 'rosa'));
  no('rosa', 'set', 'pesajes/fe3', 'ni un mes 13', pesaje('2026-13-01', 'rosa'));
  no('rosa', 'set', 'pesajes/fe4', 'ni una fecha futura (un dueño)', pesaje(futuro, 'rosa'));
  no('felipe', 'set', 'pesajes/fe5', 'ni el externo', pesaje(futuro, 'felipe'));
  no('tablet', 'set', 'pesajes/fe6', 'ni la tablet', pesaje(futuro, 'tablet'));
  no('rosa', 'update', 'pesajes/c1a', 'ni se mueve un canasto a una fecha futura', { fecha: futuro, en: '@TS' });
  no('rosa', 'set', 'precios/p1_c1_2026-13-45', 'un precio no rige desde un mes 13', { productoId: 'p1', clienteId: 'c1', neto: 1500, desde: '2026-13-45', en: '@TS' });
  si('rosa', 'set', 'precios/p1_c1_2027-03-01', 'control: un precio desde una fecha válida sí', { productoId: 'p1', clienteId: 'c1', neto: 1500, desde: '2027-03-01', en: '@TS' });
  no('rosa', 'set', 'recetas/p1_2026-99-99', 'una receta no rige desde el 99', receta('p1', '2026-99-99', 'rosa'));
  no('rosa', 'set', 'preciosInsumo/i1_2026-02-99', 'ni el precio de un insumo', precioIns('i1', '2026-02-99'));

  t('16b. Revisión de las reglas (5): tope por canasto en la tablet');
  si('tablet', 'set', 'pesajes/tp1', 'la tablet anota hasta 200 kg en un canasto', pesaje(HOY, 'tablet', { cantidad: 200 }));
  no('tablet', 'set', 'pesajes/tp2', 'pero no más (un «20» tipeado como «2000»)', pesaje(HOY, 'tablet', { cantidad: 2000 }));
  no('tablet', 'set', 'pesajes/tp3', 'ni 200,01 kg', pesaje(HOY, 'tablet', { cantidad: 200.01 }));
  si('tablet', 'set', 'pesajes/tp4', 'por unidad, hasta 2000', pesaje(HOY, 'tablet', { productoId: 'u5', unidad: 'un', cantidad: 2000 }));
  no('tablet', 'set', 'pesajes/tp5', 'pero no 2001', pesaje(HOY, 'tablet', { productoId: 'u5', unidad: 'un', cantidad: 2001 }));
  no('tablet', 'set', 'pesajes/tp6', 'y la fecha de ayer (lo anotado sin conexión) tiene el mismo tope', pesaje(AYER, 'tablet', { cantidad: 500 }));
  si('tablet', 'update', 'pesajes/hoy1', 'corregir un canasto de hoy dentro del tope sí', { cantidad: 150, en: '@TS' });
  no('tablet', 'update', 'pesajes/hoy1', 'pero no pasarlo del tope', { cantidad: 250, en: '@TS' });
  si('rosa', 'set', 'pesajes/tp7', 'un dueño no tiene tope (corrige lo que haga falta)', pesaje(HOY, 'rosa', { cantidad: 500 }));
  si('felipe', 'set', 'pesajes/tp8', 'ni el externo', pesaje(HOY, 'felipe', { productoId: 'u5', unidad: 'un', cantidad: 5000 }));
  return C;
}
module.exports = { CUENTAS, semilla, casos };
