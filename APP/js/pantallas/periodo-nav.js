/* Fase 13, parte B: un solo componente para ‹ Anterior · [fecha o mes] · Hoy · Siguiente › (Hoy, Entregas, Números, Costos → El mes,
   Cierres y «Año y metas»). Los botones llevan data-act y data-d (-1 antes, 0 volver al período actual, 1 después); cada pantalla
   atiende su acción como antes. «Siguiente» se deshabilita en el período actual y el botón para volver solo aparece fuera de él.
   Uso: navPeriodo({ act, aria, campo, volver, enActual, ultimo, antes, despues }). */
import { esc } from '../core/formato.js';

const boton = (act, d, texto, apagado) => '<button class="btn ghost sm" data-act="' + esc(act) + '" data-d="' + d + '"' + (apagado ? ' disabled' : '') + '>' + texto + '</button>';

/* act: acción de los botones · aria: nombre del grupo («Cambiar de día») · campo: HTML del campo de fecha o mes, con su etiqueta (opcional)
   volver: texto del botón para volver al período actual («Hoy», «Este mes»; opcional) · enActual: se está mirando el período actual
   ultimo: «Siguiente» no lleva más allá (por defecto, enActual) · antes / despues: textos de los botones (‹ Anterior / Siguiente ›) */
export function navPeriodo({ act, aria, campo = '', volver = '', enActual = false, ultimo = enActual, antes = '‹ Anterior', despues = 'Siguiente ›' }) {
  return '<div class="dia-nav" role="group" aria-label="' + esc(aria) + '">' + boton(act, -1, antes) + campo +
    (volver && !enActual ? boton(act, 0, esc(volver)) : '') + boton(act, 1, despues, ultimo) + '</div>';
}
