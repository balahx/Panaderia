/* «Datos para documentos» (Fase 12, Más → Cobros): los datos de la panadería que van en los cobros, las cotizaciones y el estado de cuenta.
   Razón social y RUT (obligatorios para emitir), dirección, correo y datos para transferir. Se guardan en config/empresa (Firestore), nunca
   en el repositorio. Cada cobro copia los datos de ese momento: cambiarlos aquí no cambia los cobros ya emitidos. */
import { esc, fechaTexto, diaChile } from '../core/formato.js';
import { svg } from '../core/iconos.js';
import { toast } from '../core/ui.js';
import * as nube from '../core/nube.js';
import * as CB from '../core/cobros.js';
import { campo, valor, quien, motivo } from './cobros-comun.js';

let err = '', ocupado = false, borrador = null;   // borrador: lo escrito, si no se pudo guardar (no se pierde al redibujar)
const CAMPOS = [['razonSocial', 'Razón social', 100, 'Por ejemplo «Panadería González SpA».'], ['rut', 'RUT de la panadería', 12, ''], ['direccion', 'Dirección', 150, ''], ['correo', 'Correo', 100, ''],
  ['banco', 'Banco', 60, ''], ['tipoCuenta', 'Tipo de cuenta', 40, 'Cuenta corriente, cuenta vista, CuentaRUT…'], ['cuenta', 'N.º de cuenta', 30, ''], ['rutCuenta', 'RUT de la cuenta', 12, 'Si es el mismo de la panadería, repítelo.'], ['correoAviso', 'Correo para avisar el pago', 100, '']];
export function html(c) {
  const e = c.empresa, cab = '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Cobros</span><h1>Datos para documentos</h1>';
  if (e === undefined) return cab + '<div class="spin" role="status" aria-label="Cargando"></div>';
  const v = k => (borrador ? borrador[k] : (e && e[k]) || ''), f = k => CAMPOS.find(x => x[0] === k), cf = k => campo('emp-' + k, f(k)[1], v(k), { max: f(k)[2], campo: k, ayuda: f(k)[3] || '', modo: /rut/i.test(k) ? 'text' : '' });
  return cab + '<p class="muted">Van en el encabezado y el pie de cada cobro, cotización y estado de cuenta, con el nombre «Panadería» y la hogaza. Cada documento copia los datos del momento en que se emite.</p>' +
    (CB.empresaLista(e) ? '' : '<p class="note warn" id="empFalta">Para emitir cobros y cotizaciones faltan la razón social y el RUT.</p>') +
    '<section class="card sec" id="empPanaderia"><p class="eyebrow">La panadería</p>' + ['razonSocial', 'rut', 'direccion', 'correo'].map(cf).join('') + '</section>' +
    '<section class="card sec" id="empTransferir"><p class="eyebrow">Datos para transferir</p>' + ['banco', 'tipoCuenta', 'cuenta', 'rutCuenta', 'correoAviso'].map(cf).join('') +
    '<p class="muted chico">Si faltan, el cobro sale sin el recuadro «Datos para transferir».</p></section>' +
    (err ? '<p class="form-error" role="alert" id="empError">' + esc(err) + '</p>' : '') +
    '<div class="actions"><button class="btn" id="empGuardar" data-act="emp-guardar"' + (ocupado ? ' disabled' : '') + '>' + svg('check') + 'Guardar datos</button></div>' +
    (e && e.quien ? '<p class="muted chico" id="empUltimo">Guardados por ' + esc(e.quien) + (typeof e.en === 'number' ? ' el ' + esc(fechaTexto(diaChile(new Date(e.en)))) : '') + '.</p>' : '') +
    '<p class="muted chico">Se guardan en la base de datos de la app (no en el código ni en el repositorio). Los ven solo los dueños y el externo.</p>';
}
export function alActuar(act, el, c) {
  if (act !== 'emp-guardar') return false;
  borrador = Object.fromEntries(CAMPOS.map(x => [x[0], valor('emp-' + x[0])]));
  const v = CB.validarEmpresa(borrador);
  if (v.error) { err = v.error; document.dispatchEvent(new Event('pan:repintar')); setTimeout(() => { const i = document.getElementById('emp-' + v.campo); if (i) i.focus(); }, 0); return true; }
  if (navigator.onLine === false) { err = 'Sin conexión: los datos se guardan con internet.'; return 'repintar'; }
  err = ''; ocupado = true; el.disabled = true;
  nube.guardar('config/empresa', Object.assign(v.datos, { por: c.user.uid, quien: quien(c) }))
    
    .then(() => { ocupado = false; borrador = null; toast('Datos de la panadería guardados'); document.dispatchEvent(new Event('pan:repintar')); },
      e => { ocupado = false; err = motivo(e); document.dispatchEvent(new Event('pan:repintar')); });
  return true;
}
