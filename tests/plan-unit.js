/* Plan de producción del día sin navegador (APP/js/core/plan.js, PLAN «Fase 10»): sugerencia contra un cálculo a mano de 4 semanas
   (con un día sin pesajes —solo un canasto anulado— y un pan que un día no se pesó), redondeo a tandas completas hacia arriba (con y sin
   receta, kilos y unidades), formulario (campos en blanco, errores, tandas guardadas), avance y estados en 94,9 / 95 / 110 / 110,1 %
   (también 5.000 combinaciones al azar contra la cuenta en enteros), «fuera del plan», totales que cuadran con «Pesado hoy» (300 días al
   azar) y el documento contra la copia de las reglas. Uso: node tests/plan-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PROD = [{ id: 'hal', nombre: 'Hallulla', unidad: 'kg', orden: 1, activo: true }, { id: 'marr', nombre: 'Marraqueta', unidad: 'kg', orden: 2, activo: true },
  { id: 'com', nombre: 'Pan de completo', unidad: 'un', orden: 3, activo: true }, { id: 'dob', nombre: 'Dobladita', unidad: 'kg', orden: 4, activo: true },
  { id: 'ama', nombre: 'Pan amasado', unidad: 'un', orden: 5, activo: true }, { id: 'esp', nombre: 'Pan especial', unidad: 'un', orden: 6, activo: true },
  { id: 'col', nombre: 'Colisa', unidad: 'kg', orden: 7, activo: false }];
/* Recetas (Fase 9): la hallulla sale 16,5 kg por tanda (desde el 1 de diciembre, 20 kg: no rige el 20 de noviembre); el completo, 192 unidades. */
const REC = [{ id: 'hal_2026-01-01', productoId: 'hal', desde: '2026-01-01', rendimiento: 16.5, items: [] }, { id: 'hal_2026-12-01', productoId: 'hal', desde: '2026-12-01', rendimiento: 20, items: [] },
  { id: 'com_2026-01-01', productoId: 'com', desde: '2026-01-01', rendimiento: 192, items: [] }];
let n = 0;
const pes = (fecha, productoId, cantidad, mas) => Object.assign({ id: 'p' + (++n), fecha, hora: '06:00', entregaN: 1, productoId, cantidad, unidad: PROD.find(p => p.id === productoId).unidad, trabajadorId: 't1', anulado: false }, mas || {});

(async () => {
  const L = await import('../APP/js/core/plan.js'), P = await import('../APP/js/core/pesaje.js'), R = await import('./fake-firebase/reglas.mjs');
  const F = '2026-11-20';   // viernes

  console.log('1. Días que se miran y días que se pueden armar');
  ok(eq(L.fechasMuestra(F), ['2026-11-13', '2026-11-06', '2026-10-30', '2026-10-23']), 'los 4 viernes anteriores (F − 7, − 14, − 21, − 28)');
  ok(eq(L.fechasMuestra('2026-09-12'), ['2026-09-05', '2026-08-29', '2026-08-22', '2026-08-15']), 'también al cruzar el cambio de horario de septiembre');
  ok(L.editable(F, F) && L.editable('2026-11-21', F) && !L.editable('2026-11-19', F) && !L.editable('2026-11-22', F) && L.editable('2027-01-01', '2026-12-31'), 'se arma hoy y mañana (también el 1 de enero desde el 31); ayer y pasado mañana no');

  console.log('2. Sugerencia contra el cálculo a mano');
  /* 13 nov: hallulla 55,75 (3 canastos) · marraqueta 40 · completo 392 · amasado 45 · la dobladita no se pesó (cuenta 0)
     6 nov: feriado, solo un canasto ANULADO → no cuenta como día trabajado
     30 oct: hallulla 60 · marraqueta 35,5 · completo 400 · dobladita 12 · el amasado no se pesó
     23 oct: hallulla 50,25 (y uno de 99 anulado) · marraqueta 44 · completo 380 · amasado 37 */
  const M = [
    { fecha: '2026-11-13', pesajes: [pes('2026-11-13', 'hal', 18.5), pes('2026-11-13', 'hal', 17.25), pes('2026-11-13', 'hal', 20), pes('2026-11-13', 'marr', 40), pes('2026-11-13', 'com', 192), pes('2026-11-13', 'com', 200), pes('2026-11-13', 'ama', 45)] },
    { fecha: '2026-11-06', pesajes: [pes('2026-11-06', 'hal', 30, { anulado: true })] },
    { fecha: '2026-10-30', pesajes: [pes('2026-10-30', 'hal', 60), pes('2026-10-30', 'marr', 35.5), pes('2026-10-30', 'com', 400), pes('2026-10-30', 'dob', 12)] },
    { fecha: '2026-10-23', pesajes: [pes('2026-10-23', 'hal', 50.25), pes('2026-10-23', 'hal', 99, { anulado: true }), pes('2026-10-23', 'marr', 44), pes('2026-10-23', 'com', 380), pes('2026-10-23', 'ama', 37)] }];
  const S = L.sugerencias(M, PROD, REC, F), s = id => S.find(x => x.productoId === id);
  ok(eq(S.map(x => x.productoId), ['hal', 'marr', 'com', 'dob', 'ama', 'esp']), 'una fila por pan activo, en el orden del catálogo (la colisa desactivada no va)');
  ok(S.every(x => x.dias === 3), 'cuentan 3 días: el feriado (solo un anulado) no baja el promedio');
  const hal = (55.75 + 60 + 50.25) / 3;   // 55,33 → 55,33 ÷ 16,5 = 3,35 tandas → 4 tandas = 66 kg
  ok(s('hal').promedio === 55.33 && Math.abs(s('hal').promedio - hal) < 0.005 && s('hal').tandas === 4 && s('hal').sugerida === 66 && s('hal').rendimiento === 16.5,
    'hallulla: promedio 55,33 kg (los anulados no cuentan) → 3,35 tandas → 4 tandas de 16,5 = 66 kg (la receta de diciembre no rige)');
  ok(s('marr').promedio === 39.83 && s('marr').sugerida === 40 && s('marr').tandas === null, 'marraqueta (sin receta): 39,83 kg → 40 kg (al kilo entero hacia arriba)');
  ok(s('com').promedio === 390.67 && s('com').tandas === 3 && s('com').sugerida === 576, 'completo: 390,67 un → 2,03 tandas → 3 tandas de 192 = 576 un');
  ok(s('dob').promedio === 4 && s('dob').sugerida === 4, 'dobladita: (0 + 12 + 0) ÷ 3 = 4 kg (un día trabajado sin ese pan cuenta 0; 4 exacto no sube a 5)');
  ok(s('ama').promedio === 27.33 && s('ama').sugerida === 30 && s('ama').tandas === null, 'amasado (por unidad, sin receta): 27,33 → 30 un (a la decena hacia arriba)');
  ok(s('esp').promedio === 0 && s('esp').sugerida === null, 'un pan que no se pesó ninguno de esos días: sin sugerencia (en blanco)');
  const dic = L.sugerencias(M, PROD, REC, '2026-12-04');
  ok(dic.find(x => x.productoId === 'hal').tandas === 3 && dic.find(x => x.productoId === 'hal').sugerida === 60, 'con la receta vigente ESE día: en diciembre la tanda de hallulla sale 20 kg → 3 tandas = 60 kg');
  const nada = L.sugerencias([{ fecha: 'x', pesajes: [] }, { fecha: 'y', pesajes: [pes('y', 'hal', 3, { anulado: true })] }], PROD, REC, F);
  ok(nada.every(x => x.dias === 0 && x.sugerida === null), 'sin días trabajados en las 4 semanas: nada que sugerir');
  ok(L.sugerencias([], PROD, REC, F).every(x => x.sugerida === null), 'y sin muestras, tampoco');

  console.log('3. Redondeo a tandas completas');
  ok(eq(L.redondear(49.5, 'kg', 16.5), { cantidad: 49.5, tandas: 3 }), '3 tandas exactas siguen siendo 3');
  ok(eq(L.redondear(0.3, 'kg', 0.1), { cantidad: 0.3, tandas: 3 }), 'sin el error de los decimales del computador (0,3 ÷ 0,1 = 2,9999… → 3, no 4)');
  ok(eq(L.redondear(49.51, 'kg', 16.5), { cantidad: 66, tandas: 4 }), 'un poco más que 3 tandas → 4');
  ok(eq(L.redondear(193, 'un', 192), { cantidad: 384, tandas: 2 }), 'por unidad: 193 → 2 tandas de 192 = 384');
  ok(eq(L.redondear(17.01, 'kg', null), { cantidad: 18, tandas: null }) && eq(L.redondear(17, 'kg', null), { cantidad: 17, tandas: null }), 'sin receta, kilos: 17,01 → 18 y 17 → 17');
  ok(eq(L.redondear(601, 'un', null), { cantidad: 610, tandas: null }) && eq(L.redondear(600, 'un', null), { cantidad: 600, tandas: null }) && eq(L.redondear(0.4, 'un', null), { cantidad: 10, tandas: null }), 'sin receta, unidades: 601 → 610, 600 → 600, 0,4 → 10');
  ok(L.redondear(0, 'kg', 16.5) === null && L.redondear(NaN, 'kg', 16.5) === null, 'promedio 0: sin sugerencia');
  ok(eq(L.redondear(17.5 * 3, 'kg', 17.5), { cantidad: 52.5, tandas: 3 }) && eq(L.redondear(7 * 2.3, 'kg', 2.3), { cantidad: 16.1, tandas: 7 }), 'otros múltiplos exactos (7 × 2,3) no suben una tanda');

  console.log('4. Armar el plan (formulario)');
  const panes = L.panesDelForm(PROD, null);
  ok(eq(panes.map(p => p.id), ['hal', 'marr', 'com', 'dob', 'ama', 'esp']) && eq(L.panesDelForm(PROD, { items: [{ productoId: 'col' }] }).map(p => p.id).slice(-1), ['col']), 'una fila por pan activo; un desactivado que ya estaba en el plan también (para sacarlo)');
  const v = L.validar({ cantidades: { hal: '66', marr: ' 40 ', com: '1.200', dob: '', ama: '17', esp: '  ' }, nota: '  Viernes:   más hallulla ' }, panes, REC, F);
  ok(!v.error && eq(v.datos.items, [{ productoId: 'hal', cantidad: 66, unidad: 'kg', tandas: 4 }, { productoId: 'marr', cantidad: 40, unidad: 'kg', tandas: null }, { productoId: 'com', cantidad: 1200, unidad: 'un', tandas: 6.3 }, { productoId: 'ama', cantidad: 17, unidad: 'un', tandas: null }]) && v.datos.nota === 'Viernes: más hallulla' && v.datos.fecha === F,
    'en blanco = no va; las tandas se calculan y guardan (66 ÷ 16,5 = 4 · 1.200 ÷ 192 = 6,3 · sin receta: null); «1.200» se entiende');
  const v2 = L.validar({ cantidades: { hal: '70,25' } }, panes, REC, F);
  ok(v2.datos.items[0].cantidad === 70.25 && v2.datos.items[0].tandas === 4.3 && !('nota' in v2.datos), 'kilos con decimales y tandas con un decimal (70,25 ÷ 16,5 = 4,3); sin nota, sin campo');
  const e1 = L.validar({ cantidades: { hal: 'mucho' } }, panes, REC, F), e2 = L.validar({ cantidades: { com: '12,5' } }, panes, REC, F), e3 = L.validar({ cantidades: {} }, panes, REC, F);
  ok(e1.campo === 'pl-hal' && /Hallulla/.test(e1.error) && e2.campo === 'pl-com' && /sin decimales/.test(e2.error) && /al menos un pan/.test(e3.error), 'errores: kilos que no se entienden, unidades con decimales y plan vacío');
  ok(L.validar({ cantidades: { hal: '0' } }, panes, REC, F).campo === 'pl-hal' && L.validar({ cantidades: { hal: '-3' } }, panes, REC, F).campo === 'pl-hal' && L.validar({ cantidades: { hal: '100000' } }, panes, REC, F).campo === 'pl-hal', 'ni 0, ni negativo, ni más de 99.999,99 kg');
  const muchos = Array.from({ length: 61 }, (x, i) => ({ id: 'x' + i, nombre: 'Pan ' + i, unidad: 'kg', activo: true }));
  ok(/hasta 60/.test(L.validar({ cantidades: Object.fromEntries(muchos.map(p => [p.id, '1'])) }, muchos, [], F).error), 'hasta 60 panes (como las reglas)');
  ok(eq(L.usarSugerencias({ hal: '', marr: '50', com: ' ' }, S), { hal: '66', com: '576', dob: '4', ama: '30' }), '«Usar sugerencias» llena solo los campos vacíos (no toca la marraqueta escrita; el pan sin sugerencia queda en blanco)');
  const doc = Object.assign(L.documento(v.datos, 'rosa', '  Rosa   Dueña '), { en: R.TS });
  ok(doc.quien === 'Rosa Dueña' && doc.por === 'rosa' && L.documento(v.datos, 'rosa', '').quien === 'Sin nombre', 'a nombre de quien lo guarda');

  console.log('5. El documento contra la copia de las reglas');
  const AHORA = Date.now(), HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(AHORA));
  const MAN = P.sumarDias(HOY, 1), ANTES = P.sumarDias(HOY, -3);
  const base = { 'config/negocio': { duenos: ['rosa'] }, 'miembros/tablet': { perfil: 'pesaje', activo: true } }, leer = r => base[r] || null;
  const rosa = { uid: 'rosa' }, tablet = { uid: 'tablet' }, de = f => Object.assign(L.documento(L.validar({ cantidades: { hal: '66', com: '576' }, nota: 'x' }, panes, REC, f).datos, 'rosa', 'Rosa'), { en: R.TS });
  ok(R.permitido(rosa, 'create', 'planes/' + HOY, de(HOY), null, leer, AHORA) && R.permitido(rosa, 'create', 'planes/' + MAN, de(MAN), null, leer, AHORA), 'se acepta para hoy y mañana');
  ok(!R.permitido(rosa, 'create', 'planes/' + ANTES, de(ANTES), null, leer, AHORA) && !R.permitido(rosa, 'create', 'planes/' + P.sumarDias(HOY, 2), de(P.sumarDias(HOY, 2)), null, leer, AHORA), 'no para un día pasado ni para pasado mañana');
  ok(R.permitido(tablet, 'get', 'planes/' + HOY, null, de(HOY), leer, AHORA) && !R.permitido(tablet, 'get', 'planes/' + MAN, null, de(MAN), leer, AHORA) && !R.permitido(tablet, 'create', 'planes/' + HOY, Object.assign(de(HOY), { por: 'tablet' }), null, leer, AHORA),
    'la tablet lee el de hoy, no el de mañana, y no escribe');

  console.log('6. Avance: estados en 94,9 / 95 / 110 / 110,1 %');
  const plan = (items) => ({ fecha: F, items });
  const est = (planKg, pesadoKg, u) => L.avance(plan([{ productoId: u === 'un' ? 'com' : 'hal', cantidad: planKg, unidad: u || 'kg', tandas: null }]), [pes(F, u === 'un' ? 'com' : 'hal', pesadoKg)], PROD).filas[0];
  ok(est(100, 94.9).estado === 'bajo' && est(100, 95).estado === 'cumplido' && est(100, 110).estado === 'cumplido' && est(100, 110.1).estado === 'sobre', 'kilos: 94,9 % normal · 95 % verde · 110 % verde · 110,1 % aviso');
  ok(est(1000, 949, 'un').estado === 'bajo' && est(1000, 950, 'un').estado === 'cumplido' && est(1000, 1100, 'un').estado === 'cumplido' && est(1000, 1101, 'un').estado === 'sobre', 'unidades: 949 / 950 / 1.100 / 1.101 de 1.000');
  ok(est(18.6, 17.67).estado === 'cumplido' && est(120, 114).estado === 'cumplido', '95 % exacto es verde aunque la división dé 94,9999… (17,67 de 18,6 · 114 de 120)');
  let malos = 0;
  for (let i = 0; i < 5000; i++) {
    const Q = 1 + Math.floor(Math.random() * 50000), W = Math.floor(Math.random() * Q * 1.3), f = est(Q / 100, W / 100);
    const esperado = W * 100 < 95 * Q ? 'bajo' : W * 100 <= 110 * Q ? 'cumplido' : 'sobre';
    if (f.estado !== esperado) malos++;
  }
  ok(malos === 0, '5.000 combinaciones al azar: el estado es el de la cuenta en enteros (' + malos + ' distintas)');
  const b = est(120, 102), c = est(100, 108), d = est(100, 118);
  ok(b.falta === 18 && b.exceso === 0 && L.lineaCorta(b) === 'faltan 18 kg' && L.pctTexto(b.pct) === '85 %', 'bajo: «faltan 18 kg» y 85 %');
  ok(L.lineaCorta(c) === '✓ cumplido' && c.falta === 0 && L.lineaCorta(d) === 'sobre el plan (+ 18 kg)' && d.falta === 0, 'cumplido: «✓ cumplido» · sobre: «sobre el plan (+ 18 kg)»; lo que falta nunca es negativo');
  ok(L.pctTexto(94.9) === '94 %' && L.pctTexto(95 - 1e-12) === '95 %' && L.pctTexto(110.1) === '110 %', 'el % va sin decimales y hacia abajo (94,9 % no se ve como 95 %)');
  ok(L.lineaCorta(est(1000, 999, 'un')) === '✓ cumplido' && L.lineaCorta(est(100, 1, 'un')) === 'faltan 99 un' && L.lineaCorta(est(2, 1, 'un')) === 'falta 1 un', 'por unidad, en singular y plural');
  ok(L.texto(18.5, 'kg') === '18,5 kg' && L.texto(1234.5, 'kg') === '1.234,5 kg' && L.texto(66, 'kg') === '66 kg' && L.texto(1200, 'un') === '1.200 un' && L.textoTandas(4) === '4 tandas' && L.textoTandas(1) === '1 tanda' && L.textoTandas(6.3) === '6,3 tandas', 'textos: 18,5 kg · 1.234,5 kg · 1.200 un · 4 tandas · 6,3 tandas');

  console.log('7. Fuera del plan y totales que cuadran con «Pesado hoy»');
  const dia = [pes(F, 'hal', 18.5), pes(F, 'hal', 17.25), pes(F, 'hal', 40, { anulado: true }), pes(F, 'com', 192), pes(F, 'marr', 22), pes(F, 'ama', 30)];
  const A = L.avance(plan([{ productoId: 'com', cantidad: 576, unidad: 'un', tandas: 3 }, { productoId: 'hal', cantidad: 66, unidad: 'kg', tandas: 4 }, { productoId: 'dob', cantidad: 4, unidad: 'kg', tandas: null }]), dia, PROD);
  ok(eq(A.filas.map(f => f.productoId), ['hal', 'com', 'dob']) && A.filas[0].pesado === 35.75 && A.filas[0].falta === 30.25 && A.filas[0].tandas === 4 && A.filas[2].pesado === 0 && A.filas[2].falta === 4,
    'por pan del plan, en el orden del catálogo: hallulla 35,75 de 66 (faltan 30,25; el anulado no cuenta); dobladita sin pesar');
  ok(eq(A.fuera.map(x => [x.productoId, x.pesado]), [['marr', 22], ['ama', 30]]), 'lo pesado que no estaba en el plan va aparte, «fuera del plan»');
  ok(eq(A.totales.plan, { kg: 70, un: 576 }) && eq(A.totales.pesado, { kg: 35.75, un: 192 }) && eq(A.totales.fuera, { kg: 22, un: 30 }) && L.textoTotales(A.totales.plan) === '70 kg y 576 un', 'totales del día en kg y en unidades por separado');
  ok(L.avance(null, dia, PROD) === null && L.avance({ items: [] }, dia, PROD) === null, 'sin plan: nada que comparar (la tablet queda como siempre)');
  let descuadres = 0;
  for (let i = 0; i < 300; i++) {
    const l = Array.from({ length: Math.floor(Math.random() * 40) }, () => { const p = PROD[Math.floor(Math.random() * 6)]; return pes(F, p.id, p.unidad === 'un' ? 1 + Math.floor(Math.random() * 300) : Math.round(Math.random() * 2500) / 100, { anulado: Math.random() < 0.1 }); });
    const items = PROD.slice(0, 6).filter(() => Math.random() < 0.6).map(p => ({ productoId: p.id, cantidad: p.unidad === 'un' ? 1 + Math.floor(Math.random() * 900) : Math.round(Math.random() * 15000) / 100 + 1, unidad: p.unidad, tandas: null }));
    const X = L.avance(plan(items), l, PROD), Rz = P.resumen(l, PROD, []);
    if (!X) { if (items.length) descuadres++; continue; }
    const kg = Math.round((X.totales.pesado.kg + X.totales.fuera.kg) * 100) / 100, un = X.totales.pesado.un + X.totales.fuera.un;
    const porPan = new Map(Rz.porPan.map(x => [x.productoId, x.cantidad]));
    if (kg !== Rz.kg || un !== Rz.un || X.filas.some(f => f.pesado !== (porPan.get(f.productoId) || 0)) || X.fuera.some(f => f.pesado !== porPan.get(f.productoId))) descuadres++;
  }
  ok(descuadres === 0, '300 días al azar: lo pesado del plan más lo de fuera da los totales de «Pesado hoy», pan por pan (' + descuadres + ' descuadres)');

  console.log('8. Tandas guardadas');
  const guardado = plan([{ productoId: 'hal', cantidad: 66, unidad: 'kg', tandas: 4 }]), REC2 = REC.concat([{ id: 'hal_2026-11-20', productoId: 'hal', desde: F, rendimiento: 33, items: [] }]);
  ok(L.avance(guardado, [], PROD).filas[0].tandas === 4, 'el plan muestra las tandas con que se guardó, aunque la receta cambie después');
  ok(L.validar({ cantidades: { hal: '66' } }, panes, REC2, F).datos.items[0].tandas === 2, 'al volver a guardarlo se recalculan con la receta vigente (66 ÷ 33 = 2)');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
