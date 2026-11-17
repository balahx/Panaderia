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
  nadie: null                                                                    // sin iniciar sesión
};
const miembro = (nombre, perfil, activo) => ({ nombre, correo: nombre.toLowerCase() + '@example.com', perfil, activo, por: 'rosa', en: '@TS' });
const sinVacios = o => { for (const k in o) if (o[k] === undefined) delete o[k]; return o; };
const pesaje = (fecha, por, mas) => sinVacios(Object.assign({ fecha, hora: '07:15', entregaN: 1, productoId: 'p1', cantidad: 18.5, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: por, en: '@TS' }, mas || {}));
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
    'pesajes/hoy1': pesaje(HOY, 'tablet'),
    'pesajes/viejo1': pesaje(ANTES, 'tablet'),
    'productos/u5': { nombre: 'Pan de completo', unidad: 'un', activo: true, en: '@TS' },
    ['dias/' + HOY]: { entregaN: 1, por: 'tablet', en: '@TS' },
    ['dias/' + ANTES]: { entregaN: 3, por: 'tablet', en: '@TS' },
    'cierres/2026-10': { totales: {}, origen: 'excel', cerrado: true, en: '@TS' },
    'cierres/2026-11': { totales: {}, origen: 'app', cerrado: false, en: '@TS' },
    'proyeccion/2027': { factor: 1.05, en: '@TS' },
    'cambios/x1': { que: 'corrección', por: 'rosa', en: '@TS' }
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
  no('tablet', 'get', 'clientes/c1', 'no lee clientes');
  no('tablet', 'list', 'clientes', 'ni su lista');
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
    si(q, 'update', 'cierres/2026-11', q + ' modifica un mes abierto', { totales: { p1: 1 }, en: '@TS' });
    no(q, 'update', 'cierres/2026-10', q + ' NO modifica un mes cerrado', { totales: { p1: 1 }, en: '@TS' });
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
  return C;
}
module.exports = { CUENTAS, semilla, casos };
