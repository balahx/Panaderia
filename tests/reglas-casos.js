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
  return C;
}
module.exports = { CUENTAS, semilla, casos };
