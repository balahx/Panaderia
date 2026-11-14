/* Perfiles y accesos (PLAN §2). Lógica pura, sin pantalla ni Firebase: se prueba con Node (tests/perfil-unit.js).
   Lo que aquí se decide es solo qué MOSTRAR; quien manda de verdad son las reglas de Firestore (firestore.rules). */
export const PERFILES = {
  dueno: { t: 'Dueño', d: 'Todo, incluidos los accesos' },
  externo: { t: 'Externo', d: 'Ve y edita todo igual que los dueños, salvo los accesos' },
  pesaje: { t: 'Pesaje', d: 'Solo la pantalla de pesaje de la panadería. Nunca ve precios ni ventas' }
};
/* Perfiles que un dueño puede asignar (los dueños se definen en la consola de Firebase) */
export const ASIGNABLES = ['externo', 'pesaje'];
export const nombrePerfil = p => (PERFILES[p] ? PERFILES[p].t : '—');
export const esPerfil = e => e === 'dueno' || e === 'externo' || e === 'pesaje';

const PERMISOS = {
  accesos: ['dueno'],                 // aprobar, cambiar y quitar accesos
  gestion: ['dueno', 'externo'],      // precios, ventas, cierres, catálogo, fecha pasada
  pesaje: ['dueno', 'externo', 'pesaje']
};
export const puede = (perfil, que) => (PERMISOS[que] || []).includes(perfil);

/* Estado de acceso de la cuenta con lo que se sabe hasta ahora.
   a = { uid, negocio, miembro, solicitud, firme: { negocio, miembro, solicitud }, error }
   Cada dato: undefined = aún no se sabe · null = no existe · objeto = el documento.
   `firme.x` = el servidor ya respondió por x. Que algo «no existe» solo vale si lo dice el servidor: la copia sin conexión
   puede estar incompleta. Que SÍ existe vale también desde la copia (así la app abre sin internet con el perfil conocido).
   Devuelve: 'dueno' | 'externo' | 'pesaje' | 'comprobando' | 'sin-negocio' | 'pedir' | 'espera' | 'sin-acceso' | 'error' */
export function resolver(a) {
  const f = a.firme || {};
  const neg = a.negocio, m = a.miembro;
  if (neg && Array.isArray(neg.duenos) && neg.duenos.includes(a.uid)) return 'dueno';
  if (m && m.activo === true && ASIGNABLES.includes(m.perfil)) return m.perfil;
  if (a.error) return 'error';
  if (!f.negocio || !f.miembro) return 'comprobando';
  if (!neg) return 'sin-negocio';
  if (m) return 'sin-acceso';          // tiene ficha, pero sin acceso (se lo quitaron) o con un perfil desconocido
  if (!f.solicitud) return 'comprobando';
  return a.solicitud ? 'espera' : 'pedir';
}
/* Nombre para la solicitud: sin espacios de más; válido entre 2 y 60 caracteres (lo mismo que exigen las reglas). */
export const limpiarNombre = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 60);
export const nombreValido = s => { const n = limpiarNombre(s); return n.length >= 2 && n.length <= 60; };
/* Solicitudes de la más antigua a la más nueva; miembros con acceso primero y por nombre. */
export const ordenarSolicitudes = l => l.slice().sort((a, b) => (a.creado || 0) - (b.creado || 0));
export const ordenarMiembros = l => l.slice().sort((a, b) => (a.activo === b.activo ? String(a.nombre).localeCompare(String(b.nombre), 'es') : a.activo ? -1 : 1));
