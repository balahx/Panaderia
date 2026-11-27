/* Fase 13, parte B: un solo componente para ‹ Anterior · [fecha o mes] · Siguiente › · Hoy (Hoy, Entregas, Números, Costos → El mes,
   Cierres y «Año y metas»). Los botones llevan data-act y data-d (-1 antes, 0 volver al período actual, 1 después); cada pantalla
   atiende su acción como antes. «Siguiente» se deshabilita en el período actual y el botón para volver solo aparece fuera de él.
   Parte D: en el teléfono (bajo 420 px) «Anterior» y «Siguiente» se ven solo como ‹ y › (la palabra queda para el lector de pantalla),
   así ‹ · fecha · › caben en una línea; el botón para volver va al final y, si no cabe, baja solo (antes la barra ocupaba dos líneas
   siempre). La flecha va con aria-hidden: el nombre del botón es la palabra.
   Uso: navPeriodo({ act, aria, campo, volver, enActual, ultimo, antes, despues }). */
import { esc } from '../core/formato.js';

const boton = (act, d, texto, apagado) => '<button class="btn ghost sm" data-act="' + esc(act) + '" data-d="' + d + '"' + (apagado ? ' disabled' : '') + '>' + texto + '</button>';
const ANTES = '<span class="dn-f" aria-hidden="true">‹</span><span class="dn-t"> Anterior</span>',
  DESPUES = '<span class="dn-t">Siguiente </span><span class="dn-f" aria-hidden="true">›</span>';

/* act: acción de los botones · aria: nombre del grupo («Cambiar de día») · campo: HTML del campo de fecha o mes, con su etiqueta (opcional)
   volver: texto del botón para volver al período actual («Hoy», «Este mes»; opcional) · enActual: se está mirando el período actual
   ultimo: «Siguiente» no lleva más allá (por defecto, enActual) · antes / despues: textos propios de los botones (por ejemplo «‹ 2025»;
   por defecto ‹ Anterior / Siguiente ›, que se acortan en el teléfono) */
export function navPeriodo({ act, aria, campo = '', volver = '', enActual = false, ultimo = enActual, antes = ANTES, despues = DESPUES }) {
  return '<div class="dia-nav" role="group" aria-label="' + esc(aria) + '">' + boton(act, -1, antes) + campo + boton(act, 1, despues, ultimo) +
    (volver && !enActual ? boton(act, 0, esc(volver)) : '') + '</div>';
}
