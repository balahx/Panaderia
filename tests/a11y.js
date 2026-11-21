/* Accesibilidad de las pantallas (portado de la app de muestra en la Fase 3): en 320, 360 y 390 px, claro y oscuro, recorre el ingreso,
   Hoy (con datos, otro día, las hojas de un canasto y la de anotar), Entregas con las franjas de aviso (sin precio y respaldo),
   Números (indicadores del mes en curso y de uno cerrado desde Excel, «Año y metas», ajustar la proyección y la meta de un mes),
   Pesaje (con letra grande, teclado, nota y cierre de entrega), «Más» con sus grupos, Registro general (canastos y bitácora),
   Datos (Excel y respaldo), Cierres mensuales (el año, el detalle de un mes, la revisión de una importación, Entregas de un mes cerrado
   y de uno por cerrar, y Hoy en un mes cerrado), Accesos y el Catálogo con sus hojas y formularios, y comprueba que no hay desborde lateral, que todo lo tocable
   mide al menos 44 px, que todo botón tiene nombre y todo campo su etiqueta, y que el texto tiene contraste suficiente.
   Fase 8: el aviso de privacidad (desde el ingreso y desde «Más»), la Ayuda (temas cerrados y abiertos) y una pasada a 320 px.
   Fase 10: Hoy con el plan del día (bajo, cumplido y sobre el plan), la hoja del plan (con sugerencias y con error), el plan de mañana y
   la pestaña Pesaje con el plan de hoy y «faltan …» en los botones.
   Cada pantalla o formulario nuevo se agrega al recorrido. Uso: node tests/a11y.js */
const { chromium } = require('playwright');
const { crear } = require('../tools/servidor.js'), { fakeGoogle } = require('./fake-firebase/google.js');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const SEMILLA = { 'config/negocio': { duenos: ['u-1001'], nombre: 'Panadería', iva: 19 },
  'solicitudes/u-7': { nombre: 'Persona Con Un Nombre Bastante Largo', correo: 'persona.con.un.correo.largo@example.com', creado: 1794600000000 },
  'miembros/u-2002': { nombre: 'Felipe Externo', correo: 'felipe@example.com', perfil: 'externo', activo: true, por: 'u-1001', en: 1 },
  'miembros/u-3003': { nombre: 'Tablet Panadería', correo: 'tablet@example.com', perfil: 'pesaje', activo: false, por: 'u-1001', en: 1 },
  'clientes/c1': { nombre: 'Supermercado', activo: true, en: 1 },
  'productos/p1': { nombre: 'Marraqueta', unidad: 'kg', categoria: 'Corriente', orden: 1, activo: true, en: 1 },
  'productos/p2': { nombre: 'Pan de completo con un nombre largo para probar', unidad: 'un', pesoRef: 100, categoria: 'Especiales', orden: 2, activo: true, en: 1 },
  'productos/p3': { nombre: 'Hallulla', unidad: 'kg', orden: 3, activo: true, en: 1 },
  'productos/p4': { nombre: 'Colisa', unidad: 'kg', orden: 4, activo: false, en: 1 },
  'precios/p1_c1_2026-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1400, desde: '2026-01-01', en: 1 },
  'precios/p1_c1_2026-06-01': { productoId: 'p1', clienteId: 'c1', neto: 1512.61, desde: '2026-06-01', en: 1 },
  'precios/p1_c1_2099-01-01': { productoId: 'p1', clienteId: 'c1', neto: 1234567, desde: '2099-01-01', en: 1 },
  'precios/p2_c1_2026-01-01': { productoId: 'p2', clienteId: 'c1', neto: 250, desde: '2026-01-01', en: 1 },
  'trabajadores/t1': { nombre: 'Luis Soto', activo: true, en: 1 }, 'trabajadores/t2': { nombre: 'Marta Díaz', activo: false, en: 1 },
  'cierres/2026-10': { mes: '2026-10', origen: 'excel', cerrado: true, iva: 19, lineas: [{ productoId: 'p1', nombre: 'Marraqueta', unidad: 'kg', cantidad: 1234.5, precio: 1450, neto: 1790025, nombreExcel: 'MARRAQUETAS' },
    { productoId: 'p2', nombre: 'Pan de completo con un nombre largo para probar', unidad: 'un', cantidad: 3200, precio: 120, neto: 384000 }], neto: 2174025, ivaMonto: 413065, total: 2587090, kg: 1234.5, un: 3200,
    archivo: 'cierre-octubre-2026-con-un-nombre-de-archivo-largo.xlsx', hoja: 'Hoja1', por: 'u-1001', quien: 'Rosa Dueña', en: 1794600000000 },
  'insumos/i1': { nombre: 'Harina', unidad: 'kg', activo: true, en: 1 }, 'insumos/i2': { nombre: 'Margarina con un nombre bastante largo', unidad: 'kg', activo: true, en: 1 },   // Fase 9
  'insumos/i3': { nombre: 'Agua', unidad: 'l', activo: true, en: 1 }, 'insumos/i4': { nombre: 'Huevo', unidad: 'un', activo: true, en: 1 }, 'insumos/i5': { nombre: 'Mejorador', unidad: 'kg', activo: false, en: 1 },
  'preciosInsumo/i1_2026-01-01': { insumoId: 'i1', formato: 25, neto: 18500, desde: '2026-01-01', en: 1 }, 'preciosInsumo/i1_2099-01-01': { insumoId: 'i1', formato: 25, neto: 1234567, desde: '2099-01-01', en: 1 },
  'preciosInsumo/i2_2026-01-01': { insumoId: 'i2', formato: 10, neto: 22000, desde: '2026-01-01', en: 1 }, 'preciosInsumo/i3_2026-01-01': { insumoId: 'i3', formato: 1, neto: 0, desde: '2026-01-01', en: 1 },
  'recetas/p1_2026-01-01': { productoId: 'p1', desde: '2026-01-01', rendimiento: 17.5, items: [{ insumoId: 'i1', cantidad: 12 }, { insumoId: 'i2', cantidad: 0.2 }, { insumoId: 'i3', cantidad: 7.5 }], nota: 'Levadura: invierno 130 g, verano 100 g', por: 'u-1001', en: 1 },
  'recetas/p1_2026-06-01': { productoId: 'p1', desde: '2026-06-01', rendimiento: 17.5, items: [{ insumoId: 'i1', cantidad: 12 }, { insumoId: 'i2', cantidad: 0.2 }, { insumoId: 'i3', cantidad: 7.5 }], por: 'u-1001', en: 1 },
  'recetas/p2_2026-01-01': { productoId: 'p2', desde: '2026-01-01', rendimiento: 192, items: [{ insumoId: 'i1', cantidad: 12 }, { insumoId: 'i4', cantidad: 2 }], por: 'u-1001', en: 1 },
  'pesajes/s1': { fecha: '2026-09-15', hora: '06:00', entregaN: 1, productoId: 'p1', cantidad: 25, unidad: 'kg', trabajadorId: 't1', anulado: false, creadoPor: 'u-1001', en: 1790000000000 } };
const path = require('path'), FX = n => path.join(__dirname, 'fixtures', n);
const dia = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const HOY = dia(Date.now()), pes = (id, hora, n, prod, cant, unidad, mas) => ['pesajes/' + id, Object.assign({ fecha: HOY, hora, entregaN: n, productoId: prod, cantidad: cant, unidad, trabajadorId: 't1', anulado: false, creadoPor: 'u-1001', en: 1794600000000 + Number(hora.replace(':', '')) }, mas || {})];
Object.assign(SEMILLA, Object.fromEntries([pes('h1', '05:10', 1, 'p1', 18.5, 'kg'), pes('h2', '05:20', 1, 'p2', 1200, 'un', { nota: 'Canasto con una nota bastante larga para ver cómo se corta en la lista' }),
  pes('h3', '05:30', 1, 'p3', 123.45, 'kg'), pes('h4', '08:00', 2, 'p1', 20.25, 'kg'), pes('h5', '08:05', 2, 'p1', 99, 'kg', { anulado: true })]), { ['dias/' + HOY]: { entregaN: 2, por: 'u-1001', en: 1 },
  ['planes/' + HOY]: { fecha: HOY, items: [{ productoId: 'p1', cantidad: 100, unidad: 'kg', tandas: 5.7 }, { productoId: 'p2', cantidad: 1150, unidad: 'un', tandas: 6 }, { productoId: 'p3', cantidad: 100, unidad: 'kg', tandas: null }],   // Fase 10: bajo, cumplido y sobre el plan
    nota: 'Viernes: más hallulla y una nota bastante larga para ver cómo se corta', por: 'u-1001', quien: 'Rosa Dueña con un nombre largo', en: 1 },
  'cambios/k1': { tipo: 'corregir', pesajeId: 'h1', fecha: HOY, antes: { cantidad: 18, nota: 'Una nota anterior bastante larga para ver cómo se corta' }, despues: { cantidad: 18.5 }, por: 'u-3003', quien: 'Tablet Panadería con un nombre largo', en: 1794600000000 } });   // p3 (Hallulla) no tiene precio: sale la franja de «vendido sin precio»
const CHECK = () => {
  const lum = c => { const a = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = el => { let layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255 }; if (!layers.length || layers[layers.length - 1].a < 1) { base = parse(getComputedStyle(document.body).backgroundColor) || base; } for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; } return base; };
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !el.closest('details:not([open]) > :not(summary)'); };   // lo de un <details> cerrado no se ve
  const sel = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); if (el.dataset && el.dataset.act) s += '[' + el.dataset.act + ']'; return s; };
  const res = { overflowX: document.documentElement.scrollWidth - window.innerWidth, small: [], noName: [], noLabel: [], lowContrast: [], h1: document.querySelectorAll('#view h1, #gate h1').length, imgNoAlt: 0 };
  const root = document.querySelector('#appRoot:not([hidden])') || document.querySelector('#gate');
  const scope = [...document.querySelectorAll('dialog[open]')].pop() || root || document.body;   // la hoja o la confirmación de más arriba
  scope.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]').forEach(el => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    const isSw = el.matches('input[type=checkbox],input[type=radio]') && el.closest('label'); const rr = isSw ? el.closest('label').getBoundingClientRect() : r;
    if ((rr.height < 44 || rr.width < 44) && !(el.matches('.lnk') && el.closest('p, li, small, .muted'))) res.small.push(sel(el) + ' ' + Math.round(rr.width) + 'x' + Math.round(rr.height) + ' "' + (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 18) + '"');
    if (el.matches('button, a, [role=button], [role=tab]')) { const n = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || (el.querySelector('title') || {}).textContent; if (!n) res.noName.push(sel(el)); }
    else { const id = el.id, has = (id && document.querySelector('label[for="' + id + '"]')) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title'); if (!has) res.noLabel.push(sel(el) + ' ph="' + (el.placeholder || '') + '"'); }
  });
  const seen = new Set();
  scope.querySelectorAll('*').forEach(el => {
    if (!vis(el)) return; const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim(); if (!t) return;
    const cs = getComputedStyle(el), fg = parse(cs.color); if (!fg) return; const bg = bgOf(el);
    const a = fg.a; const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    const L1 = lum([f.r, f.g, f.b]), L2 = lum([bg.r, bg.g, bg.b]), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5; const key = sel(el) + '|' + ratio.toFixed(1);
    if (ratio < need && !seen.has(key)) { seen.add(key); res.lowContrast.push(sel(el) + ' ' + ratio.toFixed(2) + ':1 (' + Math.round(size) + 'px) "' + t.slice(0, 26) + '"'); }
  });
  return res;
};


(async () => {
  const br = await chromium.launch(), srv = crear({ fake: true }), URL = await srv.abrir(), errors = [];
  for (const [w, scheme] of [[320, 'light'], [360, 'light'], [360, 'dark'], [390, 'light']]) {   // 320 px (Fase 8): equivale a ampliar al 400 % (WCAG, «reflow»)
    console.log('Pantalla de ' + w + ' px · ' + (scheme === 'dark' ? 'oscuro' : 'claro'));
    const ctx = await br.newContext({ viewport: { width: w, height: 780 }, serviceWorkers: 'block', colorScheme: scheme }), page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errors.push(m.text()); });
    const bad = {}, note = (label, r) => {
      const issues = [];
      if (r.overflowX > 0) issues.push('desborde lateral de ' + r.overflowX + ' px');
      if (r.h1 !== 1 && !/ingreso/.test(label)) issues.push('títulos principales: ' + r.h1);
      r.small.forEach(x => issues.push('pequeño: ' + x)); r.noName.forEach(x => issues.push('botón sin nombre: ' + x)); r.noLabel.forEach(x => issues.push('campo sin etiqueta: ' + x)); r.lowContrast.forEach(x => issues.push('contraste: ' + x));
      if (issues.length) bad[label] = issues;
    };
    let vistas = 0;
    const look = async label => { vistas++; await page.waitForTimeout(200); note(label, await page.evaluate(CHECK)); };
    const tocar = sel => page.click(sel), cerrar = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('#dlg:not([open])', { state: 'attached' }); };
    const hoja = async (label, sel, espera) => { await tocar(sel); await page.waitForSelector('#dlg[open] ' + espera); await look(label); };
    const sub = async s => { await tocar('.seg [data-sub="' + s + '"]'); await page.waitForSelector('#catCuerpo[data-sub="' + s + '"]'); };

    await page.goto(URL); await page.waitForSelector('#btnGoogle');
    await page.evaluate(s => localStorage.setItem('fake.db', s), JSON.stringify(SEMILLA));
    await look('ingreso');
    await hoja('ingreso: aviso de privacidad', '#lnkPrivacidad', '#privacidad'); await cerrar();
    await fakeGoogle(page, {}); await tocar('#btnGoogle'); await page.waitForSelector('#appRoot:not([hidden])'); await page.waitForSelector('#avisoAccesos');
    await page.waitForSelector('#hoyTotales'); await page.waitForSelector('#hoyPlan .plan-f.est-sobre'); await page.waitForSelector('#planManana'); await look('hoy: con datos y plan (bajo, cumplido y sobre el plan)');
    await hoja('plan: hoja de hoy', '#planArmar', '#pl-p1'); await page.waitForFunction(() => !/Calculando/.test((document.querySelector('#plSug') || {}).textContent || '')); await look('plan: hoja con sugerencias');
    await page.fill('#pl-p2', '12,5'); await tocar('#dlg [data-act="plan-guardar"]'); await page.waitForSelector('#dlg .form-error:not([hidden])'); await look('plan: con error'); await cerrar();
    await hoja('plan: de mañana', '#planManana button', '#pl-p1'); await cerrar();
    await tocar('#hoyEntregas .entrega[data-n="1"] summary'); await look('hoy: canastos de una entrega');
    await hoja('canasto: ficha', '#hoyEntregas .entrega[data-n="1"] .pes-fila', '#canDetalle');
    await tocar('#dlg [data-act="can-corregir"]'); await page.waitForSelector('#cCant'); await page.fill('#cCant', 'x'); await tocar('#dlg [data-act="can-guardar"]'); await look('canasto: corregir con error'); await cerrar();
    await hoja('canasto: anulado', '#hoyAnulados .pes-fila', '[data-act="can-reactivar"]'); await cerrar();
    await tocar('#hoyAnotar'); await page.waitForSelector('#dlg[open] #anCant'); await tocar('#dlg [data-act="anotar-guardar"]'); await look('hoy: anotar canasto con error'); await cerrar();
    await tocar('[data-act="hoy-dia"][data-d="-1"]'); await page.waitForSelector('.empty'); await look('hoy: día sin pesajes');
    await hoja('hoy: anotar en fecha pasada', '#hoyAnotar', '#anDia'); await cerrar();
    await tocar('[data-act="hoy-dia"][data-d="0"]'); await page.waitForSelector('#hoyTotales');
    await tocar('#nav button[data-tab="entregas"]'); await page.waitForSelector('#entTotal'); await page.waitForSelector('#avisoRespaldo'); await page.waitForSelector('#avisoSinPrecio'); await look('entregas: mes con franjas de aviso');
    await tocar('#nav button[data-tab="indicadores"]'); await page.waitForSelector('#indNeto'); await look('números: el mes en curso');
    await page.fill('#indMes', '2026-10'); await page.dispatchEvent('#indMes', 'input'); await page.waitForFunction(() => /Excel/.test((document.querySelector('#indFuente') || {}).textContent || '')); await look('números: mes cerrado desde Excel');
    await tocar('[data-act="ind-vista"][data-v="anio"]'); await page.waitForSelector('#anioProy'); await look('números: año y metas');
    await hoja('números: ajustar la proyección', '[data-act="anio-ajustar"]', '#pyFactor'); await page.fill('#pyFactor', 'x'); await page.dispatchEvent('#pyFactor', 'input'); await page.waitForSelector('#pyError:not([hidden])'); await look('números: ajustar con error'); await cerrar();
    await hoja('números: meta de un mes', '#anioMeses .anio-fila', '#pyMeta'); await cerrar();
    await tocar('[data-act="ind-vista"][data-v="mes"]'); await page.waitForSelector('#indMes');
    await tocar('#nav button[data-tab="pesaje"]'); await page.waitForSelector('#pesQuien'); await look('pesaje: quién pesa (letra grande)');
    await tocar('#pesQuien .pes-op'); await page.waitForSelector('#pesPanes'); await page.waitForSelector('#pesPlan'); await look('pesaje: elegir pan, con el plan de hoy');
    await tocar('#pesPanes .pes-op:nth-child(1)'); for (const k of ['2', '5', ',', '5']) await tocar('#pesTeclado [data-k="' + k + '"]'); await page.waitForSelector('#pesAviso'); await look('pesaje: teclado con aviso');
    await hoja('pesaje: nota', '#pesNota', '#pNota'); await cerrar();
    await tocar('#pesPanes .pes-op:nth-child(2)'); await look('pesaje: teclado por unidad');
    await tocar('[data-act="pes-cerrar-entrega"]'); await page.waitForSelector('dialog.cfm[open]'); await look('pesaje: confirmar cierre de entrega'); await tocar('dialog.cfm [data-r="0"]');
    await hoja('pesaje: canasto del día', '#listaPesajes .pes-fila', '#canDetalle'); await cerrar();
    await tocar('#nav button[data-tab="mas"]'); await look('más');
    await hoja('más: aviso de privacidad', '#irPrivacidad', '#privacidad'); await cerrar();
    await tocar('#irAyuda'); await page.waitForSelector('#ayudaTemas'); await look('ayuda: temas cerrados');
    await tocar('#ay-pesar summary'); await tocar('#ay-cerrar summary'); await look('ayuda: temas abiertos'); await tocar('.volver'); await page.waitForSelector('#irAyuda');
    await hoja('diagnóstico', '[data-act="diag"]', '#diag'); await cerrar();
    await tocar('#irRegistro'); await page.waitForSelector('#regResumen'); await look('registro: canastos');
    await tocar('[data-act="reg-ver"][data-v="bitacora"]'); await page.waitForSelector('#regBitacora'); await look('registro: bitácora'); await tocar('.volver');
    await tocar('#irDatos'); await page.waitForSelector('#datExcel'); await look('datos: excel y respaldo');
    await tocar('[data-act="dat-modo"][data-v="rango"]'); await page.fill('#datDesde', HOY); await page.dispatchEvent('#datDesde', 'input'); await page.fill('#datHasta', '2026-01-01'); await page.dispatchEvent('#datHasta', 'input');
    await page.waitForSelector('#secExcel .form-error'); await look('datos: otras fechas con error'); await tocar('[data-act="dat-modo"][data-v="mes"]'); await tocar('.volver');
    await tocar('#irCierres'); await page.waitForSelector('#cieMeses');
    while (!/2026/.test(await page.textContent('#view h1'))) await tocar('[data-act="cie-anio"][data-d="-1"]');
    await look('cierres: el año');
    await hoja('cierres: mes cerrado', '#cieMeses [data-mes="2026-10"]', '#cieDetalle'); await cerrar();
    await hoja('cierres: mes sin cerrar', '#cieMeses [data-mes="2026-09"]', '#cieDetalle'); await cerrar();
    await page.setInputFiles('#cieArchivo', [FX('cierre-octubre-2026.xlsx'), FX('marzo.xlsx')]); await page.waitForSelector('#impResumen'); await look('cierres: revisar la importación');
    await tocar('.volver'); await page.waitForSelector('#cieMeses');
    await tocar('#cieMeses [data-mes="2026-10"]'); await page.waitForSelector('#dlg[open] [data-tab="entregas"]'); await tocar('#dlg [data-tab="entregas"]'); await page.waitForSelector('#entCierre'); await look('entregas: mes cerrado');
    await page.fill('#entMes', '2026-09'); await page.dispatchEvent('#entMes', 'input'); await page.waitForSelector('#entCerrar'); await look('entregas: mes por cerrar');
    await tocar('#nav button[data-tab="inicio"]'); await page.fill('#hoyFecha', '2026-10-15'); await page.dispatchEvent('#hoyFecha', 'input'); await page.waitForSelector('#hoyCerrado'); await look('hoy: mes cerrado');
    await tocar('[data-act="hoy-dia"][data-d="0"]'); await page.waitForSelector('#hoyTotales'); await tocar('#nav button[data-tab="mas"]');
    await tocar('#irAccesos'); await page.waitForSelector('#secSolicitudes .persona'); await look('accesos');
    await hoja('accesos: aprobar', '[data-act="acc-elegir"]', '.opcion'); await cerrar();
    await hoja('accesos: cambiar', '#secMiembros [data-act="acc-ver"]', '.opcion'); await cerrar();
    await hoja('accesos: sin acceso', '#secSinAcceso [data-act="acc-ver"]', '[data-act="acc-devolver"]'); await cerrar();
    await tocar('.volver'); await tocar('#irCatalogo'); await page.waitForSelector('#listaProductos .mrow'); await look('catálogo: productos');
    await hoja('producto: ficha con historial', '#listaProductos .mrow:nth-child(1)', '#historial');
    await tocar('#dlg [data-act="cat-precio"]'); await page.waitForSelector('#prNeto'); await page.fill('#prNeto', 'mil'); await tocar('#dlg [data-act="cat-precio-guardar"]'); await look('producto: precio con error');
    await page.fill('#prNeto', '1.600'); await page.fill('#prDesde', '2026-02-01'); await tocar('#dlg [data-act="cat-precio-guardar"]'); await page.waitForSelector('dialog.cfm[open]'); await look('producto: confirmar fecha pasada');
    await tocar('dialog.cfm [data-r="0"]'); await cerrar();
    await hoja('producto: ficha por unidad', '#listaProductos .mrow:nth-child(2)', '[data-act="cat-editar"]');
    await tocar('#dlg [data-act="cat-editar"]'); await page.waitForSelector('#pUnidadFija'); await look('producto: editar'); await cerrar();
    await hoja('producto: sin precio', '#listaProductos .mrow:nth-child(3)', '[data-act="cat-editar"]'); await cerrar();
    await hoja('producto: desactivado', '#prodDesactivados .mrow', '[data-act="cat-activar"]'); await cerrar();
    await hoja('producto: agregar', '[data-act="cat-nuevo"]', '#pNombre'); await page.check('input[name="pUnidad"][value="un"]'); await tocar('#dlg [data-act="cat-guardar"]'); await look('producto: agregar con error'); await cerrar();
    await sub('trabajadores'); await look('catálogo: trabajadores');
    await hoja('trabajador: agregar', '[data-act="cat-trab-nuevo"]', '#tNombre'); await cerrar();
    await hoja('trabajador: ficha', '#listaTrabajadores .mrow', '[data-act="cat-trab-activar"]'); await cerrar();
    await sub('negocio'); await look('catálogo: cliente e IVA');
    await hoja('cliente', '[data-act="cat-cliente"]', '#cNombre'); await cerrar();
    await hoja('IVA', '[data-act="cat-iva"]', '#ivaNuevo'); await cerrar();
    await sub('productos');   // costos y margen (Fase 9): la ficha del pan, la receta, el simulador, insumos, el mes y sus gastos
    await hoja('producto: ficha con costo', '#listaProductos .mrow:nth-child(1)', '#costoHoy');
    await tocar('#dlg [data-act="rec-ver"]'); await page.waitForSelector('#recItems'); await look('receta: vigente con versiones');
    await tocar('#dlg [data-act="rec-form"]'); await page.waitForSelector('#recRend'); await look('receta: cambiar');
    await page.fill('#recRend', 'x'); await tocar('#dlg [data-act="rec-guardar"]'); await page.waitForSelector('#dlg .form-error:not([hidden])'); await look('receta: con error'); await cerrar();
    await tocar('#listaProductos .mrow:nth-child(1)'); await page.waitForSelector('#costoHoy'); await tocar('#dlg [data-act="rec-sim"]'); await page.waitForSelector('#simPrecio'); await look('producto: simular precio'); await cerrar();
    await hoja('producto: sin receta', '#listaProductos .mrow:nth-child(3)', '#sinReceta'); await cerrar();
    await tocar('.volver'); await tocar('#irCostos'); await page.waitForSelector('#listaInsumos'); await look('costos: insumos');
    await hoja('insumo: ficha', '#listaInsumos .mrow:nth-child(2)', '#insHistorial');
    await tocar('#dlg [data-act="cos-ins-precio"]'); await page.waitForSelector('#ipFormato'); await look('insumo: precio'); await cerrar();
    await hoja('insumo: sin precio', '#listaInsumos .mrow:nth-child(3)', '#insPrecioHoy'); await cerrar();
    await hoja('insumo: agregar', '[data-act="cos-ins-nuevo"]', '#iNombre'); await tocar('#dlg [data-act="cos-guardar"]'); await page.waitForSelector('#dlg .form-error:not([hidden])'); await look('insumo: agregar con error'); await cerrar();
    await tocar('.seg [data-sub="mes"]'); await page.waitForSelector('#cosVenta'); await look('costos: el mes');
    await hoja('costos: gastos del mes', '#cosAnotarGastos', '#gM0'); await cerrar();
    await page.fill('#cosMes', '2026-10'); await page.dispatchEvent('#cosMes', 'input'); await page.waitForSelector('#cosFuente'); await look('costos: mes cerrado desde Excel');
    await page.fill('#cosMes', '2026-08'); await page.dispatchEvent('#cosMes', 'input'); await page.waitForSelector('#cosSinGastos'); await look('costos: mes sin ventas');
    await tocar('.seg [data-sub="insumos"]'); await page.waitForSelector('#listaInsumos');
    await tocar('.volver'); await tocar('#irCatalogo'); await page.waitForSelector('#listaProductos .mrow'); await sub('negocio');
    await page.evaluate(() => { const d = window.__fakeDb.todo(); Object.keys(d).filter(r => /^(productos|trabajadores|clientes|precios)\//.test(r)).forEach(r => window.__fakeDb.borrar(r)); });
    await page.waitForSelector('#tarjetaCliente [data-act="cat-cliente"].btn:not(.ghost)'); await look('catálogo vacío: cliente');
    await sub('productos'); await page.waitForSelector('#faltaCliente'); await look('catálogo vacío: productos');
    await sub('trabajadores'); await look('catálogo vacío: trabajadores');
    await tocar('.volver'); await tocar('[data-act="salir"]'); await page.waitForSelector('dialog.cfm[open]'); await look('cerrar sesión');
    const labels = Object.keys(bad);
    ok(labels.length === 0, 'sin problemas en las ' + vistas + ' vistas recorridas' + (labels.length ? ': ' + labels.map(l => l + ' → ' + bad[l].slice(0, 6).join(' | ')).join(' || ') : ''));
    await ctx.close();
  }
  ok(errors.length === 0, 'sin errores en la consola' + (errors.length ? ': ' + errors[0] : ''));
  await br.close(); srv.close(); console.log(fails ? 'FALLAS: ' + fails : 'Todo bien'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
