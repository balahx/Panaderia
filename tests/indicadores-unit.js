/* Indicadores, proyección y metas (APP/js/core/indicadores.js), sin navegador. Incluye el «Listo cuando» de la Fase 7: los totales
   de los indicadores cuadran con los cierres (meses cerrados, desde Excel y con la app) y con Entregas (meses sin cerrar), también
   con meses armados al azar; y el documento de la proyección pasa por la copia de las reglas. Uso: node tests/indicadores-unit.js */
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const cerca = (a, b, e) => Math.abs(a - b) <= (e == null ? 0.0001 : e);

(async () => {
  const I = await import('../APP/js/core/indicadores.js'), V = await import('../APP/js/core/ventas.js'), CI = await import('../APP/js/core/cierres.js');
  const R = await import('./fake-firebase/reglas.mjs');
  const prods = [{ id: 'p1', nombre: 'Marraqueta', unidad: 'kg', orden: 1 }, { id: 'p2', nombre: 'Hallulla', unidad: 'kg', orden: 2 }, { id: 'p3', nombre: 'Pan de completo', unidad: 'un', orden: 3 }, { id: 'p4', nombre: 'Colisa', unidad: 'kg', orden: 4 }];
  const precios = [{ productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2025-01-01' }, { productoId: 'p1', clienteId: 'c1', neto: 1512.61, desde: '2026-11-10' },
    { productoId: 'p2', clienteId: 'c1', neto: 1350, desde: '2025-01-01' }, { productoId: 'p3', clienteId: 'c1', neto: 120, desde: '2025-01-01' }];   // p4 sin precio
  const trab = [{ id: 't1', nombre: 'Luis' }, { id: 't2', nombre: 'Marta' }];
  const base = { productos: prods, precios, clienteId: 'c1', iva: 19, trabajadores: trab };
  let n = 0; const pes = (fecha, prod, cant, mas) => Object.assign({ id: 'x' + (++n), fecha, hora: '06:' + String(n % 60).padStart(2, '0'), entregaN: 1, productoId: prod, cantidad: cant, unidad: prods.find(p => p.id === prod).unidad, trabajadorId: 't1', anulado: false }, mas || {});
  const NOV = [pes('2026-11-02', 'p1', 20.5), pes('2026-11-02', 'p1', 18.25, { trabajadorId: 't2' }), pes('2026-11-02', 'p3', 300), pes('2026-11-03', 'p2', 12.3, { entregaN: 2 }),
    pes('2026-11-09', 'p1', 19), pes('2026-11-10', 'p1', 21.15), pes('2026-11-10', 'p4', 5), pes('2026-11-16', 'p1', 30, { anulado: true }), pes('2026-11-17', 'p2', 9.99, { trabajadorId: 't2' }), pes('2026-11-18', 'p1', 7)];

  console.log('1. Un mes sin cerrar: lo mismo que Entregas');
  const HOY = '2026-11-18', Rn = I.resumenMes('2026-11', Object.assign({ pesajes: NOV, hoy: HOY }, base));
  const L = V.lineas(NOV, prods, precios, 'c1', 19), T = V.totales(L);
  ok(Rn.fuente === 'app' && Rn.enCurso && Rn.detalle && Rn.neto === T.neto && Rn.kg === T.kg && Rn.un === T.un, 'neto, kilos y unidades = los de Entregas (' + T.neto + ')');
  ok(Rn.panes.reduce((t, p) => t + p.neto, 0) === Rn.neto && cerca(Rn.panes.reduce((t, p) => t + p.pct, 0), 100), 'venta por pan suma el neto del mes y la participación suma 100 %');
  ok(Rn.sinPrecio === 1 && Rn.panes.find(p => p.productoId === 'p4').neto === 0 && Rn.panes.find(p => p.productoId === 'p4').cantidad === 5, 'un pan sin precio cuenta su cantidad pero no suma pesos');
  ok(Rn.dias.reduce((t, d) => t + d.neto, 0) === Rn.neto && Rn.dias.length === 6 && Rn.promedio.por === 'dia-venta' && Rn.promedio.dias === 6, 'los días con entregas suman el mes; el promedio es por día con entregas');
  ok(Rn.semana.reduce((t, s) => t + s.neto, 0) === Rn.neto && cerca(Rn.semana.reduce((t, s) => t + s.kg, 0), Rn.kg, 0.005) && Rn.semana.map(s => s.nombre).join() === 'lunes,martes,miércoles,jueves,viernes,sábado,domingo', 'días de la semana (de lunes a domingo) suman el mes');
  ok(Rn.semana.find(s => s.dia === 1).veces === 2 && Rn.semana.find(s => s.dia === 2).veces === 3 && Rn.semana.filter(s => s.lugar).length === 2, 'cuenta cuántos lunes y martes con entregas hubo (el lunes 16 solo tuvo un anulado) y marca los dos días más fuertes');
  ok(cerca(Rn.trabajadores.reduce((t, w) => t + w.kg, 0), Rn.kg, 0.005) && Rn.trabajadores.reduce((t, w) => t + w.un, 0) === Rn.un && Rn.trabajadores[0].nombre === 'Luis' && Rn.trabajadores.reduce((t, w) => t + w.canastos, 0) === 9, 'kilos por trabajador suman los kilos del mes (sin anulados)');
  const hechos = Rn.dias.filter(d => d.fecha < HOY).reduce((t, d) => t + d.neto, 0);
  ok(Rn.ritmo && Rn.ritmo.dias === 17 && Rn.ritmo.neto === Math.round(hechos * 30 / 17), 'ritmo del mes en curso: lo de los días terminados (sin hoy) llevado a 30 días');
  ok(I.resumenMes('2026-11', Object.assign({ pesajes: NOV, hoy: '2026-11-01' }, base)).ritmo === null, 'el día 1 todavía no hay ritmo');

  console.log('2. Meses cerrados: los totales del cierre');
  const k = { productos: prods, precios }, cie = CI.desdeApp('2026-11', NOV, k, { id: 'c1', nombre: 'Supermercado' }, 19, { por: 'u', quien: 'Rosa' }).doc;
  const Rc = I.resumenMes('2026-11', Object.assign({ cierre: cie, pesajes: NOV, hoy: '2026-12-05' }, base));
  ok(Rc.cerrado && Rc.fuente === 'app' && Rc.neto === cie.neto && Rc.kg === cie.kg && Rc.un === cie.un && !Rc.enCurso && !Rc.cambio, '«Cerrar mes»: neto, kilos y unidades del cierre');
  ok(Rc.panes.reduce((t, p) => t + p.neto, 0) === cie.neto && Rc.detalle && Rc.dias.reduce((t, d) => t + d.neto, 0) === cie.neto, 'por pan y por día cuadran con el cierre');
  const otroPrecio = precios.concat([{ productoId: 'p2', clienteId: 'c1', neto: 1500, desde: '2026-11-01' }]);
  const Rx = I.resumenMes('2026-11', Object.assign({}, base, { precios: otroPrecio, cierre: cie, pesajes: NOV, hoy: '2026-12-05' }));
  ok(Rx.neto === cie.neto && Rx.cambio, 'si después cambia un precio de ese mes, valen los totales del cierre (y se avisa)');
  const exc = { mes: '2026-10', origen: 'excel', cerrado: true, iva: 19, neto: 2174025, ivaMonto: 413065, total: 2587090, kg: 1234.5, un: 3200,
    lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 1234.5, precio: 1450, neto: 1790025 }, { productoId: 'p3', nombre: 'Pan de completo', unidad: 'un', cantidad: 3200, precio: 120, neto: 384000 }] };
  const Re = I.resumenMes('2026-10', Object.assign({ cierre: exc, pesajes: [pes('2026-10-05', 'p1', 10)], hoy: HOY }, base));
  ok(Re.fuente === 'excel' && Re.neto === exc.neto && !Re.detalle && Re.promedio.por === 'dia-mes' && Re.promedio.neto === Math.round(exc.neto / 31), 'desde Excel: totales del cierre, sin detalle por día (manda el Excel) y promedio por día del mes');
  const reab = Object.assign({}, cie, { cerrado: false });
  ok(I.resumenMes('2026-11', Object.assign({ cierre: reab, pesajes: NOV.slice(0, 3), hoy: '2026-12-05' }, base)).neto === V.totales(V.lineas(NOV.slice(0, 3), prods, precios, 'c1', 19)).neto, 'un mes reabierto vuelve a salir de lo anotado');
  ok(I.resumenMes('2026-09', Object.assign({ pesajes: [], hoy: HOY }, base)).fuente === 'sin-datos', 'un mes sin nada: sin datos');

  console.log('3. «Listo cuando»: 300 meses al azar cuadran con cierres y entregas');
  let rnd = 7; const azar = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let bien = 0;
  for (let i = 0; i < 300; i++) {
    const mes = '2026-0' + (1 + Math.floor(azar() * 9)), dias = V.rangoMes(mes), lista = [];
    const nd = 1 + Math.floor(azar() * 28);
    for (let j = 0; j < nd * 4; j++) { const d = mes + '-' + String(1 + Math.floor(azar() * 28)).padStart(2, '0'), p = prods[Math.floor(azar() * 4)];
      lista.push(pes(d, p.id, p.unidad === 'un' ? 1 + Math.floor(azar() * 400) : Math.round(azar() * 2500) / 100 + 0.01, { anulado: azar() < 0.1, trabajadorId: azar() < 0.5 ? 't1' : 't2', entregaN: 1 + Math.floor(azar() * 3) })); }
    const Lm = V.lineas(lista, prods, precios, 'c1', 19), Tm = V.totales(Lm), abierto = I.resumenMes(mes, Object.assign({ pesajes: lista, hoy: HOY }, base));
    const ent = V.porEntrega(Lm).reduce((t, e) => t + e.neto, 0);
    const doc = CI.desdeApp(mes, lista, k, { id: 'c1', nombre: 'S' }, 19, { por: 'u', quien: 'R' }).doc, cerrado = I.resumenMes(mes, Object.assign({ cierre: doc, pesajes: lista, hoy: HOY }, base));
    const sumaPan = r => r.panes.reduce((t, p) => t + p.neto, 0), sumaSem = r => r.semana.reduce((t, s) => t + s.neto, 0);
    if (!Lm.length) { bien += abierto.fuente === 'sin-datos' ? 1 : 0; continue; }
    if (abierto.neto === Tm.neto && abierto.neto === ent && sumaPan(abierto) === Tm.neto && sumaSem(abierto) === Tm.neto && cerca(abierto.trabajadores.reduce((t, w) => t + w.kg, 0), Tm.kg, 0.005)
      && cerrado.neto === doc.neto && sumaPan(cerrado) === doc.neto && cerrado.kg === doc.kg && cerrado.un === doc.un && doc.neto === Tm.neto && dias.desde) bien++;
  }
  ok(bien === 300, bien + ' de 300: indicadores = Entregas (suma de entregas) = cierre, por pan, por día de la semana y por trabajador');

  console.log('4. Comparaciones');
  ok(I.variacion(110, 100) === 10 && I.variacion(5, 0) === null && I.variacion(null, 3) === null, 'variación: +10 %; sin base no se compara');
  ok(I.pctTexto(5.04) === '+5 %' && I.pctTexto(-3.25) === '−3,3 %' && I.pctTexto(0) === '0 %' && I.pctTexto(96.4, false) === '96,4 %' && I.pctTexto(null) === '—', 'textos de porcentaje');
  const cmp = I.comparar(Rc, Re);
  ok(cmp && cmp.neto.a === Rc.neto && cmp.neto.b === Re.neto && cerca(cmp.neto.pct, (Rc.neto - Re.neto) / Re.neto * 100) && cmp.pan('p3').neto === 384000 && cmp.pan('p9') === null, 'mes contra mes, y cada pan contra el suyo');
  ok(I.comparar(Rc, { fuente: 'sin-datos' }) === null && I.comparar(Rc, { fuente: 'cargando' }) === null, 'sin datos (o cargando) no hay comparación');

  console.log('5. Proyección y metas');
  ok(I.validarPct('5').factor === 1.05 && I.validarPct('-3').factor === 0.97 && I.validarPct('−2,5').factor === 0.975 && I.validarPct('+0').factor === 1 && I.validarPct('12,5 %').factor === 1.125, 'porcentajes escritos a la chilena (con signo)');
  ok(I.validarPct('').error && I.validarPct('', true).factor === null && I.validarPct('mucho').error && I.validarPct('-95').error && I.validarPct('600').error, 'vacío, texto o fuera de rango');
  ok(I.pctCampo(1.05) === '5' && I.pctCampo(0.975) === '-2,5' && I.pctCampo(1) === '0', 'y de vuelta al campo');
  const P = I.leerProyeccion({ factor: 1.1, factorPrecio: 1.05, panes: { p3: 0.5, malo: -1 }, metas: [3000000, null, 1.5, -2] }, 2027);
  ok(P.factor === 1.1 && P.factorPrecio === 1.05 && JSON.stringify(P.panes) === '{"p3":0.5}' && P.metas[0] === 3000000 && P.metas.slice(1).every(m => m === null) && P.metas.length === 12, 'lee el documento descartando valores inválidos');
  ok(JSON.stringify(I.leerProyeccion(null, 2027)) === JSON.stringify({ anio: 2027, factor: 1, factorPrecio: 1, panes: {}, metas: Array(12).fill(null), existe: false }), 'sin documento: sin cambios y sin metas');
  const pr = I.proyectarMes(Re, P), m1 = pr.panes.find(x => x.productoId === 'p1'), m3 = pr.panes.find(x => x.productoId === 'p3');
  ok(m1.cantidad === 1357.95 && m1.neto === Math.round(1790025 * 1.1 * 1.05) && m3.cantidad === 1600 && m3.neto === Math.round(384000 * 0.5 * 1.05), 'por pan: cantidad × crecimiento (el suyo o el general), neto × crecimiento × precio');
  ok(pr.neto === m1.neto + m3.neto && pr.kg === 1357.95 && pr.un === 1600, 'el mes proyectado suma sus panes');
  ok(I.proyectarMes({ fuente: 'sin-datos', panes: [] }, P) === null && I.proyectarMes(Rn, P) === null, 'sin base, o con la base en curso, no se proyecta');
  ok(JSON.stringify(I.objetivo(P, '2027-01', pr)) === JSON.stringify({ neto: 3000000, tipo: 'meta' }) && I.objetivo(P, '2027-10', pr).tipo === 'proyeccion' && I.objetivo(P, '2027-10', null) === null, 'lo pedido: la meta fijada o, si no hay, la proyección');
  const av = I.avance(Rn, { neto: 2000000, tipo: 'meta' }, HOY);
  ok(av.real === Rn.neto && av.falta === 2000000 - Rn.neto && av.quedan === 13 && av.porDia === Math.ceil((2000000 - Rn.neto) / 13) && cerca(av.ritmoPct, Rn.ritmo.neto / 20000), 'mes en curso: lo que falta, por día (13 días contando hoy) y adónde llega a su ritmo');
  const av2 = I.avance(Rc, { neto: 100, tipo: 'proyeccion' }, '2026-12-05');
  ok(av2.falta === 0 && av2.pct > 100 && av2.quedan === undefined, 'mes terminado: cumplido');

  console.log('6. El año mes a mes');
  const baseA = new Map(), realA = new Map();
  for (let i = 1; i <= 12; i++) {
    const m25 = '2025-' + String(i).padStart(2, '0'), m26 = '2026-' + String(i).padStart(2, '0');
    baseA.set(m25, i < 3 ? { mes: m25, fuente: 'sin-datos', panes: [] } : I.resumenMes(m25, Object.assign({ cierre: Object.assign({}, exc, { mes: m25, neto: 1000000 * i, lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 100 * i, neto: 1000000 * i }] }), hoy: HOY }, base)));
    realA.set(m26, i <= 10 ? I.resumenMes(m26, Object.assign({ cierre: Object.assign({}, exc, { mes: m26, neto: 1100000 * i, lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 110 * i, neto: 1100000 * i }] }), hoy: HOY }, base))
      : i === 11 ? Rn : { mes: m26, fuente: 'futuro', panes: [] });
  }
  const P26 = I.leerProyeccion({ factor: 1.05, factorPrecio: 1, metas: [null, null, 3200000] }, 2026), t = I.tablaAnio(2026, baseA, realA, P26, HOY);
  ok(t.filas.length === 12 && t.filas[10].estado === 'en-curso' && t.filas[11].estado === 'futuro' && t.filas[0].proy === null && t.filas[0].obj === null, '12 meses: pasados, en curso y por venir; enero sin base no se proyecta');
  ok(t.filas[2].obj.tipo === 'meta' && t.filas[2].obj.neto === 3200000 && t.filas[3].obj.tipo === 'proyeccion' && t.filas[3].obj.neto === 4200000, 'marzo con meta fijada; abril con su proyección (4.000.000 × 1,05)');
  ok(cerca(t.filas[3].varAnt, 10) && t.filas[10].varAnt === null && t.filas[3].pct === 4400000 / 4200000 * 100, 'variación contra el año anterior (+10 %) y cumplimiento; el mes en curso no se compara a medias');
  const sumR = [...realA.values()].filter(r => r.neto).reduce((s, r) => s + r.neto, 0);
  ok(t.T.real === sumR && t.T.anterior === 75000000 && t.T.proy === Math.round(75000000 * 1.05), 'totales del año: real (con lo que va del mes) = suma de los meses; año anterior; proyectado');
  ok(t.T.ac.hasta === '2026-10' && t.T.ac.meses === 8 && t.T.ac.realVsAnt === 1100000 * 52 && t.T.ac.anterior === 1000000 * 52 && cerca(t.T.ac.varAnt, 10), 'acumulado de los meses terminados con base: +10 % contra 2025 en los mismos meses');
  const metas = I.metasDesde(t.filas.map(f => f.proy), [111, null, 3200000]);
  ok(metas[0] === 111 && metas[1] === null && metas[2] === 3150000 && metas[11] === Math.round(12000000 * 1.05), 'fijar metas: la proyección de cada mes (los sin base conservan la suya)');
  ok(I.validarMeta('2.500.000').neto === 2500000 && I.validarMeta('$1.234.567').neto === 1234567 && I.validarMeta('').neto === null && I.validarMeta('mucho').error, 'meta escrita a mano');

  console.log('7. El documento de la proyección pasa por la copia de las reglas');
  const neg = { duenos: ['rosa'] }, leer = r => (r === 'config/negocio' ? neg : null), rosa = { uid: 'rosa', email: 'rosa@example.com', email_verified: true, proveedor: 'google.com' };
  const doc = Object.assign(I.documentoProyeccion(Object.assign({}, P26, { metas }), { por: 'rosa', quien: 'Rosa' }), { en: R.TS });
  ok(R.permitido(rosa, 'create', 'proyeccion/2026', doc, null, leer, Date.now()), 'se acepta (con metas, nulls y factores)');
  const raro = Object.assign(I.documentoProyeccion(Object.assign({}, P26, { factor: 1.123456789, panes: { a: 1.2, b: 99 }, metas: [1.5, -1, 2e12] }), { por: 'rosa', quien: '' }), { en: R.TS });
  ok(raro.factor === 1.1235 && JSON.stringify(raro.panes) === '{"a":1.2}' && raro.metas.every(m => m === null) && raro.quien === 'Sin nombre' && R.permitido(rosa, 'create', 'proyeccion/2026', raro, null, leer, Date.now()), 'limpia lo que las reglas rechazarían');

  console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
