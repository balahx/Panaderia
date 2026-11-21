/* Ayuda (PLAN, Fase 8: «guía breve para la familia»), dentro de la app, desde «Más». Temas cortos que se abren de a uno.
   La tablet ve solo lo suyo (pesar, corregir, entregas, sin internet); dueños y externo ven además el resto de la app.
   La misma guía, para imprimir, está en GUIA-FAMILIA.md (si cambia una, cambiar la otra). */
import * as perfil from '../core/perfil.js';

const tema = (id, titulo, cuerpo) => '<details class="ayuda" id="ay-' + id + '"><summary>' + titulo + '</summary><div class="ayuda-b">' + cuerpo + '</div></details>';
const pasos = l => '<ol>' + l.map(x => '<li>' + x + '</li>').join('') + '</ol>';

const PESAJE = [
  tema('pesar', 'Pesar un canasto', pasos(['En <b>Pesaje</b>, toca tu nombre (queda elegido hasta que toques <b>Cambiar</b>).', 'Toca el pan.',
    'Escribe los kilos con el teclado de la pantalla (o las unidades, si ese pan se cuenta por unidad).', 'Toca <b>Guardar canasto</b>.']) +
    '<p>El pan queda elegido: el siguiente canasto del mismo pan es solo el número y <b>Guardar</b>. Si pasa de 20 kg la app avisa, pero se puede guardar igual.</p>'),
  tema('plan', 'Plan de producción', '<p>Si los dueños armaron el <b>plan de hoy</b>, el botón de cada pan dice cuánto falta (<b>«faltan 18 kg»</b>) y, más abajo, <b>Plan de hoy</b> muestra cada pan con su plan, sus tandas, lo pesado y lo que falta.</p>' +
    '<p>Desde el 95 % sale en verde, <b>«✓ cumplido»</b>; sobre el 110 %, <b>«sobre el plan»</b>. Solo informa: se puede seguir pesando igual. Sin plan, la pantalla queda como siempre.</p>'),
  tema('corregir', 'Corregir o anular un canasto', '<p>En <b>Pesado hoy</b>, toca el canasto: puedes cambiar el pan, la cantidad, quién pesó o la nota, o <b>anularlo</b>. Todo cambio queda anotado.</p>' +
    '<p>La tablet corrige solo lo de <b>hoy</b>. Lo de días anteriores lo corrigen los dueños.</p>'),
  tema('entrega', 'Cerrar la entrega', '<p>Cuando sale el pedido, toca <b>Cerrar entrega</b> y confirma: lo que se pese después va a la entrega siguiente.</p>' +
    '<p>Si la cerraste por error y la nueva todavía no tiene canastos, toca <b>Volver a abrir la entrega</b>.</p>'),
  tema('sinred', 'Sin internet', '<p>Sigue pesando: los canastos dicen <b>«Por enviar»</b> y se envían solos cuando vuelve la conexión.</p>' +
    '<p><b>No cierres sesión</b> mientras haya canastos por enviar: se perderían.</p>')
];
const GESTION = [
  tema('hoy', 'Ver el día y anotar en otra fecha', '<p><b>Hoy</b> muestra lo pesado, por pan, por entrega y por trabajador, con la venta del día. Con <b>‹ ›</b> o el calendario miras otro día.</p>' +
    '<p>Lo que no se pesó en la tablet se agrega con <b>Anotar canasto</b>, en el día que estás mirando (también días pasados).</p>'),
  tema('armar-plan', 'Armar el plan del día', pasos(['En <b>Hoy</b>, toca <b>Armar plan</b> (o <b>Cambiar plan</b>). Para el día siguiente, <b>Plan de mañana → Armar</b>.',
    'Toca <b>Usar sugerencias</b>: llena los panes vacíos con el promedio del mismo día de la semana en las 4 semanas anteriores, redondeado a tandas completas. Corrige lo que quieras; en blanco, el pan no va.',
    '<b>Guardar plan</b>.']) + '<p>Las tandas salen de la receta del pan (Más → Costos y margen) y se ven también en la tablet. El plan se arma solo para hoy o mañana; el de un día pasado se mira en Hoy, tal como quedó.</p>'),
  tema('entregas', 'Entregas del mes y Excel para la contadora', '<p><b>Entregas</b> muestra el mes día por día, con neto, IVA y total. <b>Descargar Excel del mes</b> baja la planilla con todas las hojas; esa es la que se envía a la contadora.</p>'),
  tema('cerrar', 'Cerrar el mes', '<p>Desde el día 1 del mes siguiente, en <b>Entregas</b>, toca <b>Cerrar</b> y el nombre del mes, revisa los totales y confirma. Un mes cerrado ya no se modifica y sus números quedan fijos.</p>' +
    '<p>Conviene cerrar cada mes: los <b>Números</b> se calculan más rápido y usan menos lecturas.</p>'),
  tema('numeros', 'Números y metas', '<p><b>Números → El mes</b>: venta por pan, comparación con el mes anterior y con el mismo mes del año pasado, días más fuertes y kilos por trabajador.</p>' +
    '<p><b>Año y metas</b>: el año contra el anterior. <b>Ajustar proyección</b> calcula lo esperado; <b>Usar la proyección como metas</b> las fija. Tocando un mes se escribe su meta a mano.</p>'),
  tema('precios', 'Cambiar un precio', pasos(['<b>Más → Catálogo</b>, toca el pan.', '<b>Cambiar precio</b>: escribe el precio <b>neto</b> (sin IVA) y desde qué día rige.', '<b>Guardar precio</b>.']) +
    '<p>Los días anteriores mantienen el precio que tenían.</p>'),
  tema('costos', 'Costos y margen de cada pan', pasos(['<b>Más → Costos y margen → Insumos</b>: agrega harina, margarina, sal, levadura… con el precio <b>neto de factura</b> (cuánto trae el saco o la caja y cuánto cuesta).',
    '<b>Más → Catálogo</b>, toca un pan y luego <b>Anotar receta</b>: lo que lleva <b>una tanda</b> («250 g» también vale) y cuántos kilos (o unidades) salen.',
    'En la ficha del pan se ve el costo por kilo y el margen; <b>Simular precio</b> calcula el margen con otro precio, o el precio para ganar un %.']) +
    '<p><b>Costos y margen → El mes</b>: venta, ingredientes y margen de cada pan; anota ahí los <b>gastos del mes</b> (gas, luz, sueldos, arriendo) para ver el resultado. Si sube un insumo o cambia la receta (por ejemplo, la levadura de verano), anótalo con la fecha desde la que rige: los meses anteriores no cambian.</p>' +
    '<p>El Excel de <b>Entregas</b> sale sin costos (para la contadora); el de <b>El mes</b>, con costos.</p>'),
  tema('respaldo', 'Respaldo semanal', '<p>Cuando la app lo pida (una vez por semana), toca <b>Descargar</b> en la franja o ve a <b>Más → Exportar a Excel y respaldo</b>. Guarda el archivo en un lugar privado: tiene precios y ventas.</p>')
];
const ACCESOS = tema('accesos', 'Dar acceso a alguien (solo dueños)', pasos(['La persona abre la app, entra con su cuenta de Google y toca <b>Pedir acceso</b>.',
  'En tu app aparece un aviso: <b>Más → Accesos</b>, toca la solicitud y elige el perfil (Externo o Pesaje).']) + '<p>Quitar un acceso no borra lo que esa persona anotó; se puede devolver cuando quieras.</p>');
const COMUN = [
  tema('actualizar', 'Actualizar la app', '<p>Cuando hay una versión nueva aparece un aviso arriba. Si no, <b>Más → Buscar actualización → Actualizar ahora</b>.</p>'),
  tema('problema', 'Si algo no funciona', pasos(['Revisa que haya internet y vuelve a abrir la app.', '<b>Más → Diagnóstico de instalación → Copiar</b>.',
    'Envía lo copiado a Felipe, con una foto de la pantalla si se puede.']))
];

export function html(c) {
  const ges = perfil.puede(c.perfil, 'gestion');
  const temas = PESAJE.concat(ges ? GESTION : [], perfil.puede(c.perfil, 'accesos') ? [ACCESOS] : [], COMUN);
  return '<button class="lnk volver" data-act="ir" data-tab="mas">‹ Más</button><span class="eyebrow">Ayuda</span><h1>Cómo se usa</h1>' +
    '<p class="muted">' + (ges ? 'Toca un tema para verlo. Las primeras son las de la tablet de la panadería.' : 'Toca un tema para verlo.') + '</p>' +
    '<div class="ayuda-lista" id="ayudaTemas">' + temas.join('') + '</div>' +
    '<p class="muted chico"><button class="lnk" data-act="privacidad">Aviso de privacidad</button></p>';
}
export function alActuar() { return false; }
