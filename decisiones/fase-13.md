# Decisiones · Fase 13 · Pulido de diseño y botones

> Parte de `ESTADO.md`. Qué se decidió en esta fase y por qué. El plan de la fase está en `PLAN.md` «Fase 13».

### Planificación (25-nov-2026)

Revisión de diseño hecha solo leyendo el código (chat «Optimización de diseño y botones», sin cambios). Propuso cuatro partes (A base de diseño, B botones, C tablet y pesaje, D navegación y pantallas de dueños), cada una en su chat corto y subiendo Z. Respuestas de Felipe:
- **Tablet:** Samsung Galaxy Tab S6, **en horizontal**. Equivale a unos 1280 × 800 px: la app la trata como computador (menú a la izquierda desde 1024 px) con la letra grande del pesaje. Lo de 700 a 1023 px (tablet en vertical) pasa a segundo plano. El tamaño real se confirma en la parte C (el Diagnóstico mostrará ancho × alto).
- **Engranaje del encabezado:** se conserva.
- **«Cerrar entrega»:** destacado en la tablet (parte C).
- **`light-dark()`:** no. Se sigue con el CSS actual para no dejar fuera equipos antiguos; el tema oscuro queda en sus dos bloques y una prueba (`tests/diseno-unit.js`) comprueba que son iguales.

### Parte A · Base de diseño (25-nov-2026, chat 14) · versión 0.12.1

Sin cambio a la vista: todo lo que cambió es cómo está escrito el CSS.

- **Fichas (tokens) en `tokens.css`, con los valores de antes.** Letra con nombre por uso (`--letra-rotulo` .8em, `--letra-detalle` .84em, `--letra-pie` .87em, `--letra-apoyo` .9em, `--letra-nota` .94em, `--letra-fila` .96em, `--letra-cifra-m` 1.6em, `--letra-cifra` 1.9em) y, en px porque hoy no crecen con la letra grande, `--letra-campo` 16px, `--letra-insignia` 12px, `--letra-menu` 11.5px y `--letra-menu-lateral` 15px. Espacios `--esp-1` a `--esp-8` (4, 6, 8, 10, 12, 14, 16 y 18 px). Radios `--radio-xs` a `--radio-hoja` (6 a 18 px) y `--radio-pildora`. Alturas táctiles `--toque` 44px, `--alto-control` 46px, `--alto-grande` 56px y `--alto-fila` 56px. Sombras `--sombra-flotante` y `--sombra-elegido`. **Las partes B, C y D cambian el valor de la ficha**, no cada regla.
- Se reemplazaron por fichas solo los valores que calzan exacto en una escala (márgenes, rellenos, separaciones, radios, alturas y tamaños de letra). Lo que no calza (por ejemplo 2, 5, 7, 22 o 26 px, o tamaños que aparecen una sola vez) quedó escrito en su regla: se ordena cuando una parte lo toque.
- **`--line-control`**: el borde de campos, botones secundarios, botones de pan, teclas y visor del pesaje, radios, opciones y el botón de archivo. Hoy igual a `--line-strong` (#C7B292 / #6A503F); en la parte B sube a 3:1.
- **Colores solo en `tokens.css`**, también los de las sombras y el velo detrás de las hojas. El velo (`--velo`) se define en `::backdrop` y no en `:root`, porque en Chrome anterior al 122 el fondo de un `dialog` no hereda variables: con `:root` las hojas se habrían quedado sin velo en equipos antiguos.
- **`componentes.css` dividido** en `css/componentes/` (seis piezas comunes) y `css/pantallas/` (diez, una por pantalla o grupo), como `js/`. El orden de carga (fichas, base, piezas comunes, pantallas; `botones.css` después de `avisos.css`) respeta la cascada de antes: se revisaron las reglas de igual especificidad que cambiaron de orden y ninguna toca al mismo elemento. 18 archivos de CSS en `index.html` y en `ASSETS` de `sw.js`; el más largo tiene 75 líneas. Se descartó `@import` (carga en cadena, más lenta). `h1[tabindex="-1"]:focus` pasó a `base.css`.
- **Huella de diseño** (`tools/huella.js`): `npm run huella -- huellas/antes` hace que `a11y.js` guarde, en cada una de sus 130 vistas, los estilos calculados de todos los elementos (y de `::before`, `::after` y el velo), su caja y una captura, y además recorre 800 px y 1280 × 800 (claro y oscuro). `npm run comparar -- antes despues` dice qué elemento y qué propiedad cambió. No compara las variables (sí sus efectos); el aviso flotante y las cifras del Diagnóstico cambian solos de una vez a otra y se informan aparte; una captura distinta con estilos y cajas iguales es el dibujo de las letras y no cuenta. Las huellas van comprimidas (unos 180 MB por recorrido; cada uno tarda unos 15 minutos) y la carpeta `huellas/` no se sube.
- **`tests/diseno-unit.js`** (sin navegador): ver `MAPA.md`. Probado que falla si los dos bloques oscuros difieren, si se escribe un color fuera de `tokens.css` o si sobra un CSS.

**Resultado:** huella antes y después **igual en las 910 vistas** (130 vistas × 320, 360 claro y oscuro, 390, 800 y 1280 × 800 claro y oscuro): ningún elemento cambió de estilo; la única caja distinta fue el texto «Versión 0.12.1» en Más, porque la versión se subió mientras corría el recorrido. `a11y.js` sin problemas también a 800 y 1280 px. Las 35 pruebas, todas bien (25-nov-2026). Falta ver la 0.12.1 publicada en un equipo.

**Para la parte B:** subir `--line-control` a 3:1 en los dos bloques oscuros a la vez (la prueba lo exige); `--toque` y `--alto-control` a 48 px; tomar la huella antes de empezar y comparar al final para ver que cambió solo lo buscado.
