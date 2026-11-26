/* Aviso de privacidad (PLAN, Fase 8): breve, en una hoja. Se abre con data-act="privacidad" desde el ingreso, la espera de
   aprobación y «Más» (todos los perfiles, también la tablet). Lo atiende app.js antes de saber si hay sesión.
   Si App Check está configurado (reCAPTCHA de Google), el aviso lo dice y nombra las políticas de Google: es la condición de
   Google para ocultar la insignia de reCAPTCHA (css/pantallas/ayuda.css, .grecaptcha-badge). */
import { hoja } from '../core/ui.js';
import * as nube from '../core/nube.js';

export const VIGENTE = '21 de noviembre de 2026';   // Fase 9: agrega los costos · Fase 10: el plan de producción del día · Fase 12: clientes, posibles clientes y datos bancarios
const POLITICA = 'https://policies.google.com/privacy', CONDICIONES = 'https://policies.google.com/terms';
const enlace = (url, t) => '<a class="lnk" href="' + url + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';

/* Texto para el ingreso (debajo del botón) cuando reCAPTCHA protege la app. Vacío si App Check no está configurado. */
export function lineaRecaptcha() {
  if (!nube.appCheckConfigurado()) return '';
  return '<p class="legal" id="avisoRecaptcha">Esta app está protegida por reCAPTCHA de Google: se aplican la ' + enlace(POLITICA, 'Política de Privacidad') +
    ' y las ' + enlace(CONDICIONES, 'Condiciones del Servicio') + ' de Google.</p>';
}

const sec = (t, html) => '<h3 class="priv-t">' + t + '</h3>' + html;
export function texto() {
  const conAppCheck = nube.appCheckConfigurado();
  return '<div id="privacidad" class="priv">' +
    '<p class="muted chico">Vigente desde el ' + VIGENTE + '.</p>' +
    sec('Quién responde', '<p>La panadería, a través de sus dueños. Para cualquier consulta sobre tus datos, o para pedir que se corrijan o se borren, habla con ellos.</p>') +
    sec('Qué datos usa la app', '<ul>' +
      '<li><b>De tu cuenta de Google:</b> tu nombre, tu correo y un identificador de la cuenta. Sirven solo para saber quién eres y para que los dueños aprueben tu acceso. La app no ve tu contraseña (la pide Google), ni tus contactos, fotos, ubicación, cámara o micrófono.</li>' +
      '<li><b>Del trabajo:</b> el nombre de cada persona que pesa, lo que pesó (pan, kilos o unidades, hora, entrega, cliente y nota) y quién anotó o corrigió cada registro.</li>' +
      '<li><b>De las ventas sueltas:</b> el nombre de quien compró, si se anota (es opcional; se recomienda solo el nombre de pila).</li>' +
      '<li><b>Del negocio:</b> productos, precios, ventas, cierres mensuales, metas, costos (insumos, recetas y gastos del mes) y el plan de producción del día (cuánto hacer de cada pan, quién lo armó).</li>' +
      '<li><b>De los cobros:</b> los datos de cada cliente y de quien recibe una cotización (razón social, RUT, dirección y un contacto: se recomienda el de la empresa, no uno personal), los cobros, los pagos (abonos) y los datos de la panadería para recibir transferencias (banco y n.º de cuenta).</li></ul>') +
    sec('Dónde se guardan', '<p>En Firebase, el servicio de Google que usa la panadería; sus servidores pueden estar fuera de Chile. Cada equipo guarda además una copia para funcionar sin internet, que se borra al cerrar sesión. En la tablet queda anotado quién está pesando.</p>') +
    sec('Quién los ve', '<p>Los dueños y la persona externa de confianza ven todo (solo los dueños manejan los accesos). La tablet de la panadería ve solo lo pesado hoy y el plan de hoy, sin precios, ventas, costos ni cobros. La contadora recibe los archivos que le envían los dueños, y cada cliente, los cobros y estados de cuenta que se le compartan.</p>') +
    sec('Lo que no se hace', '<p>Los datos no se venden ni se comparten con nadie. La app no tiene publicidad ni mide cómo la usas.</p>') +
    (conAppCheck ? sec('Protección contra usos automatizados', '<p>La app usa reCAPTCHA de Google para comprobar que las conexiones vienen de la app y no de otro programa. reCAPTCHA revisa datos técnicos del equipo y del navegador, y se rige por la ' +
      enlace(POLITICA, 'Política de Privacidad') + ' y las ' + enlace(CONDICIONES, 'Condiciones del Servicio') + ' de Google.</p>') : '') +
    sec('Cuánto tiempo', '<p>Mientras la panadería use la app. Quitar un acceso no borra lo que esa persona registró, porque es parte de la historia de ventas. Los respaldos y planillas descargados deben guardarse en un lugar privado.</p>') +
    '</div>';
}
export function abrir() { hoja('Aviso de privacidad', texto()); }
