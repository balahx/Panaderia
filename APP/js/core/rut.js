/* RUT chileno (Fase 12): limpiar, revisar el dígito verificador (módulo 11) y escribirlo con puntos y guion («12.345.678-5»).
   Lo usan los datos de la panadería, los datos de cobro de cada cliente y las cotizaciones. Lógica pura: se prueba con Node (tests/cobros-unit.js). */

/* Solo los números y la K final: ' 12.345.678-k ' → '12345678K' */
export const limpiar = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9K]/g, '');
/* Dígito verificador de un cuerpo de números ('12345678' → '5'). */
export function dv(cuerpo) {
  let suma = 0, m = 2;
  for (let i = String(cuerpo).length - 1; i >= 0; i--) { suma += Number(String(cuerpo)[i]) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}
/* '12345678K' o '12.345.678-k' → '12.345.678-K' (sin revisar). */
export function formatear(s) {
  const t = limpiar(s); if (t.length < 2) return t;
  const cuerpo = t.slice(0, -1).replace(/^0+/, '') || '0';
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + t.slice(-1);
}
/* ¿Es un RUT válido? (cuerpo de 1 a 8 cifras, la K solo al final y el dígito verificador correcto) */
export function esValido(s) {
  const t = limpiar(s);
  if (!/^\d{1,8}[0-9K]$/.test(t)) return false;
  const cuerpo = t.slice(0, -1);
  return Number(cuerpo) > 0 && dv(cuerpo) === t.slice(-1);
}
/* Revisa lo escrito en un campo. `obligatorio`: si puede quedar vacío. Devuelve { rut } (con formato, o '' si vacío) o { error }. */
export function validar(s, obligatorio) {
  const t = limpiar(s);
  if (!t) return obligatorio ? { error: 'Escribe el RUT (por ejemplo 76.123.456-7).' } : { rut: '' };
  if (!/^\d{1,8}[0-9K]$/.test(t) || !Number(t.slice(0, -1))) return { error: 'El RUT no tiene la forma 76.123.456-7.' };
  if (!esValido(t)) return { error: 'El dígito verificador del RUT no corresponde (revisa el número).' };
  return { rut: formatear(t) };
}
