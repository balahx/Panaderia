/* Respaldo (PLAN §3.11), tomado de backup.js de la app de muestra: descarga en un archivo JSON todo lo que la cuenta puede leer,
   por si algo se borra o se daña (el plan gratuito de Firebase no tiene respaldos automáticos). Cuesta una lectura por documento:
   por eso es un botón, y la app avisa con una franja si pasó una semana sin respaldo (config/respaldo guarda el último).
   Parte pura (sin pantalla): se prueba con Node (tests/ventas-unit.js). Leer de la nube lo hace pantallas/datos.js. */
export const FORMATO = 'panaderia-respaldo', VERSION = 1, AVISO_DIAS = 7;

/* Qué se respalda. Los dueños además guardan los accesos (el externo no puede leerlos: las reglas se lo niegan). */
export const DOCUMENTOS = ['config/negocio', 'config/respaldo'];
export const COLECCIONES = ['productos', 'precios', 'trabajadores', 'clientes', 'pesajes', 'dias', 'cambios', 'cierres', 'proyeccion'];
export const DE_DUENOS = ['miembros', 'solicitudes'];
export const colecciones = perfil => COLECCIONES.concat(perfil === 'dueno' ? DE_DUENOS : []);

/* Lee todo con `leer` = { doc(ruta), col(ruta) } (del servidor). `avance(texto)` informa. Si algo falla, se corta con el error:
   un respaldo incompleto no debe parecer completo. Devuelve { datos, lecturas }. */
export async function reunir(leer, perfil, avance) {
  const di = avance || (() => {}), datos = {}; let lecturas = 0;
  for (const r of DOCUMENTOS) { datos[r] = await leer.doc(r); lecturas++; }
  for (const c of colecciones(perfil)) { di('Leyendo ' + c + '…'); const l = await leer.col(c); datos[c] = l; lecturas += Math.max(1, l.length); }
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
    version: meta.version || '', proyecto: meta.proyecto || '', lecturas: meta.lecturas || 0, conteos: conteos(datos), datos };
}
export const esRespaldo = o => !!o && o.formato === FORMATO && o.v === VERSION && !!o.datos && Array.isArray(o.datos.pesajes);
export const nombreArchivo = fecha => 'respaldo-panaderia-' + fecha + '.json';
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
