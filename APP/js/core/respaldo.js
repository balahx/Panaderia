/* Respaldo (PLAN §3.11), tomado de backup.js de la app de muestra: descarga en un archivo JSON todo lo que la cuenta puede leer,
   por si algo se borra o se daña (el plan gratuito de Firebase no tiene respaldos automáticos). Cuesta una lectura por documento:
   por eso es un botón, y la app avisa con una franja si pasó una semana sin respaldo (config/respaldo guarda el último).
   Parte pura (sin pantalla): se prueba con Node (tests/ventas-unit.js). Leer de la nube lo hace pantallas/datos.js. */
export const FORMATO = 'panaderia-respaldo', VERSION = 1, AVISO_DIAS = 7;
/* Respaldo por año (Fase 8, rendimiento): los canastos, la bitácora y los planes del día (Fase 10) crecen unos 15 mil documentos al año, y cada uno es una lectura de la
   cuota gratuita diaria (50 mil). Por eso, por omisión, se respaldan solo los del AÑO ACTUAL (los años anteriores ya quedaron en sus
   respaldos y no cambian); lo demás (catálogo, precios, cierres, metas, accesos) va siempre completo. «Todo» sigue disponible. */
export const POR_FECHA = ['pesajes', 'cambios', 'planes'], ANIO_INICIO = 2026;   // planes: Fase 10 (uno por día, con su `fecha`)
/* Años que se pueden elegir: del actual hacia atrás, hasta el primero de la app. */
export const anios = hoy => { const a = Number(String(hoy).slice(0, 4)), l = []; for (let y = a; y >= ANIO_INICIO; y--) l.push(y); return l; };

/* Qué se respalda. Los dueños además guardan los accesos (el externo no puede leerlos: las reglas se lo niegan). */
export const DOCUMENTOS = ['config/negocio', 'config/respaldo', 'config/empresa', 'config/folios'];   // empresa y folios: Fase 12
export const COLECCIONES = ['productos', 'precios', 'trabajadores', 'clientes', 'pesajes', 'dias', 'cambios', 'cierres', 'proyeccion', 'insumos', 'preciosInsumo', 'recetas', 'gastos', 'planes',
  'clientesCobro', 'cobros', 'abonos', 'cotizaciones'];   // insumos…gastos: costos (Fase 9) · planes: plan de producción (Fase 10) · clientesCobro…cotizaciones: cobros (Fase 12)
export const DE_DUENOS = ['miembros', 'solicitudes'];
export const colecciones = perfil => COLECCIONES.concat(perfil === 'dueno' ? DE_DUENOS : []);

/* Lee todo con `leer` = { doc(ruta), col(ruta), rango(col, campo, desde, hasta) } (del servidor). `avance(texto)` informa.
   `anio` (número): canastos y bitácora solo de ese año, y los días de entrega de ese año; sin `anio`, todo. Si algo falla, se corta con
   el error: un respaldo incompleto no debe parecer completo. Devuelve { datos, lecturas }. */
export async function reunir(leer, perfil, avance, anio) {
  const di = avance || (() => {}), datos = {}; let lecturas = 0;
  for (const r of DOCUMENTOS) { datos[r] = await leer.doc(r); lecturas++; }
  for (const c of colecciones(perfil)) {
    di('Leyendo ' + c + '…');
    let l = anio && POR_FECHA.includes(c) ? await leer.rango(c, 'fecha', anio + '-01-01', anio + '-12-31') : await leer.col(c);
    lecturas += Math.max(1, l.length);
    if (anio && c === 'dias') l = l.filter(d => String(d.id).slice(0, 4) === String(anio));   // pocos al año: se leen todos y se dejan los del año
    datos[c] = l;
  }
  return { datos, lecturas };
}
export function conteos(datos) {
  const r = {}; for (const c of COLECCIONES.concat(DE_DUENOS)) if (Array.isArray(datos[c])) r[c] = datos[c].length;
  return r;
}
/* El archivo final, con su cabecera. */
export function armar(datos, meta) {
  meta = meta || {};
  return { formato: FORMATO, v: VERSION, creado: meta.creado || new Date().toISOString(), por: meta.por || null, perfil: meta.perfil || '',
    version: meta.version || '', proyecto: meta.proyecto || '', lecturas: meta.lecturas || 0, anio: meta.anio || null, conteos: conteos(datos), datos };
}
export const esRespaldo = o => !!o && o.formato === FORMATO && o.v === VERSION && !!o.datos && Array.isArray(o.datos.pesajes);
/* Completo: respaldo-panaderia-AAAA-MM-DD.json · de un año: respaldo-panaderia-AAAA-MM-DD-de-AAAA.json */
export const nombreArchivo = (fecha, anio) => 'respaldo-panaderia-' + fecha + (anio ? '-de-' + anio : '') + '.json';
export const resumen = c => [c.pesajes + ' canastos', c.productos + ' productos', c.precios + ' precios', c.cambios + ' correcciones'].join(' · ');

/* ---------- Aviso semanal ---------- */
/* Días desde el último respaldo (null si nunca o no se sabe). `marca` = config/respaldo (con `en` en milisegundos). */
export const diasDesde = (marca, ahora) => (marca && typeof marca.en === 'number' ? Math.max(0, Math.floor(((ahora || Date.now()) - marca.en) / 86400000)) : null);
/* ¿Mostrar la franja? undefined = aún no se sabe (no se muestra) · null = nunca hubo respaldo (sí) · si no, desde AVISO_DIAS días. */
export const toca = (marca, ahora) => marca !== undefined && (marca === null || diasDesde(marca, ahora) === null || diasDesde(marca, ahora) >= AVISO_DIAS);
export function textoMarca(marca, ahora) {
  if (marca === undefined) return '';
  const d = diasDesde(marca, ahora);
  if (d === null) return 'Aún no hay ningún respaldo. Descarga el primero.';
  return 'Último respaldo: ' + (d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días') + (marca.quien ? ' (' + marca.quien + ')' : '') + '.';
}
/* Lo que se guarda en config/respaldo (la hora `en` la pone nube.js). */
export const marcaNueva = (uid, quien, cont, lecturas) => ({ por: uid, quien: String(quien || 'Sin nombre').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre', conteos: cont, lecturas: Math.max(0, Math.round(lecturas || 0)) });
