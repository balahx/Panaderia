# Estado del proyecto · App Panadería

> Archivo corto. **Todo chat nuevo lo lee primero** y lo actualiza al cerrar. El detalle está en `PLAN.md` (versión 2), el mapa de archivos en `MAPA.md` y lo decidido en cada fase en `decisiones/fase-NN.md`. **Leer solo las decisiones de las fases que toca el trabajo.**

## Avance

| Fase | Contenido | Chat | Estado |
|---|---|---|---|
| 0 | Planificación y cuestionario | 1 | ✔ Hecha (13-nov-2026) |
| 1 | Base instalable, Firebase, Hosting, repositorio, guía paso a paso | 2 | ✔ Hecha. Verificación T3 (paso 9) con las 12 casillas marcadas en iPhone, Android y Windows (14-nov-2026) |
| 2 | Cuentas de Google, perfiles, reglas, App Check | 3 | ✔ Hecha. Pasos 13 a 17 verificados por Felipe (15-nov-2026): las 7 casillas del paso 15 y el paso «Reglas de Firestore (emulador)» en verde. App Check sigue **sin configurar** (paso 16, opcional hasta la Fase 8) |
| 3 | Catálogo: productos, precios, trabajadores | 4 | ✔ Hecha. Paso 18 verificado por Felipe (16-nov-2026): 6 de 7 casillas y el emulador en verde. La casilla «el externo no tiene el botón del IVA» se verificó en el paso 19 (✓) |
| 4 | Pesaje y entregas del día (tablet) | 5 | ✔ Hecha. Paso 19 verificado por Felipe (16-nov-2026): 7 de 8 casillas, Diagnóstico con 0 bloqueos y versión 0.4.0, emulador en verde. La casilla **modo avión** quedó sin marcar: se repite en el paso 20.5 (las pruebas lo cubren) |
| 5 | Ventas para dueños: Entregas, registro, fecha pasada, Excel, respaldo | 6 | ✔ Hecha. Paso 20 verificado por Felipe (17-nov-2026): las 8 casillas (incluida la de **modo avión** pendiente del paso 19), Diagnóstico con 0 bloqueos y versión 0.5.0, emulador en verde |
| 6 | Cierres mensuales (importar ene–oct 2026, cerrar mes) | 7 | ✔ Hecha. Paso 21 verificado por Felipe (18-nov-2026): las 6 casillas (10 meses cerrados desde Excel, cada neto = total del Excel), Diagnóstico con 0 bloqueos y versión 0.6.0, emulador en verde con los 235 casos |
| 7 | Indicadores, proyección y metas | 8 | ✔ Hecha. Paso 22 verificado por Felipe (19-nov-2026): las 6 casillas (octubre = su cierre, noviembre = Entregas, 2025 importado y comparado, metas fijadas y a mano, externo sí y tablet no), Diagnóstico con 0 bloqueos y versión 0.7.0, emulador en verde con los 261 casos |
| 8 | Cierre y entrega (App Check: se decidió no usarlo) | 9 | ✔ Hecha. Paso 23 verificado por Felipe (20-nov-2026): tabla C (5 casillas) y tabla B de consolas completas, Diagnóstico con versión 0.8.0, 0 bloqueos y «App Check: Sin configurar» en los tres tipos de equipo |
| 9 | Costos y margen por pan | 10 | ✔ Hecha. Paso 24 verificado por Felipe (20-nov-2026): las 6 casillas (costo por kg de la hallulla = cálculo a mano, simulador, alza de mañana sin efecto hoy, El mes con resultado = margen − gastos, Excel con hoja «Resultado» y Entregas sin costos, externo sí y tablet no), Diagnóstico con 0 bloqueos y versión 0.9.0, emulador en verde |
| 10 | Plan de producción diario | 11 | ✔ Hecha. Paso 25 verificado por Felipe (20-nov-2026): las 6 casillas (sugerencia = cálculo a mano, «falta» y % cuadran con Pesado hoy, verde desde 95 % y aviso sobre 110 %, tablet con el plan de hoy y sin el de mañana, plan de mañana y día pasado solo lectura), Diagnóstico con 0 bloqueos y versión 0.10.0, emulador en verde |
| 11 | Varios clientes y ventas sueltas | 12 | ✔ Hecha. Paso 26 verificado por Felipe (21-nov-2026): las 6 casillas, Diagnóstico con 0 bloqueos y versión 0.11.0, emulador en verde |
| 12 | Cobros y cotizaciones | 13 | ✔ Hecha. Paso 27 verificado por Felipe (24-nov-2026): las 7 casillas (neto del cobro semanal y mensual = Entregas con el filtro del cliente, PDF abierto, impreso y compartido en Windows, iPhone y Android, saldo igual en lista, ficha, PDF, estado de cuenta y Excel, saldo a favor aplicado al cobro siguiente, franja de vencidos y anulación, cotización → cliente con precios, tablet sin cobros), Diagnóstico con 0 bloqueos y versión 0.12.0, emulador en verde con los 481 casos |

Versión de la app: **0.12.0** (caché 2026.11.21.2) · 34 pruebas, todas bien (21-nov-2026, con Firebase, Google y Firestore simulados) · 518 casos de reglas (481 al cerrar la Fase 12, el emulador en verde el 24-nov-2026; 37 nuevos de la revisión del 25-nov-2026, **aún sin correr en el emulador**)

## Qué sigue

**Primero: la revisión de reglas del 25-nov-2026** (`decisiones/revision-reglas-2026-11.md`): ya está escrita y probada contra la copia a mano, pero **faltan `npm test` (pruebas con navegador) y el emulador en verde (GitHub Actions o `npm run reglas`) antes de publicar**; luego `firebase deploy --only firestore:rules` y verificar (dueño entra en teléfono y computador, la tablet pesa, corrige y cierra entrega, Diagnóstico con 0 bloqueos). La app no cambia: sigue en 0.12.0.

Las fases 0 a 12 del plan están cerradas (la 12 verificada el 24-nov-2026; lo decidido, en `decisiones/fase-12.md`). Queda: **cerrar noviembre** desde Entregas a partir del 1 de diciembre (el primer cierre con líneas por cliente), emitir los cobros de cada semana o mes y, cuando se quiera, un futuro nuevo (hoja de insumos del día, balanza, plan en el Excel, cumplimiento del mes en Números, recibo de abono en PDF), en su propio chat y con preguntas primero.

## Decisiones generales

- Perfiles: Dueño (todo + accesos), Externo (todo salvo accesos), Pesaje (solo pesaje, sin precios). Ingreso solo con Google; aprobación por los dueños.
- Tablet con una cuenta de Google; quien pesa toca su nombre; corrige solo lo del día.
- Pesaje por canasto, kg con 2 decimales o unidades según catálogo, aviso sobre 20 kg, nota opcional, día calendario chileno.
- Varias entregas por día; se arman solas con los pesajes. Sin guías ni mermas (los pagos de los clientes, desde la Fase 12, como abonos).
- Cobros (Fase 12): documento interno, no tributario, con el número del folio (transacción); solo dueños y externo; datos de cobro en `clientesCobro` (la tablet lee `clientes`); emitir con folio correlativo y con internet; abonos parciales de la cuenta del cliente (del cobro más antiguo), saldo pendiente y saldo a favor calculados con `abonos`; estado de cuenta en PDF.
- Varios clientes (Fase 11): cada uno con su lista de precios y su numeración de entregas; «Ventas sueltas» con quién compró; lo pesado antes es del supermercado; total del negocio + filtro por cliente; plan, proyección y metas del negocio entero.
- Precios netos + IVA; historial de vigencia.
- Cierres ene–oct 2026 desde Excel; noviembre por fecha pasada; «Cerrar mes» en adelante.
- Proyección: mismo mes del año anterior × factor (general y por pan) + factor de precio; metas con seguimiento.
- Firebase (proyecto nuevo, cuenta de Felipe, plan gratuito), Firebase Hosting, repositorio público `Panaderia`.
- Sincronización con la caché sin conexión propia de Firestore (confirmado; no se usa `sync.js` ni `reads.js` de la muestra).
- Los dueños crean el catálogo en la app, con precios; el precio es interno (dueños y externo).
- Sin compilación; SDK y Excel alojados en la app; un archivo por pantalla (≤ ~300 líneas).
- Seguridad de la auditoría aplicada desde el inicio (PLAN §9).
- Commits y PR: autor Felipe González con su correo, sin coautoría, sin Claude-Session ni enlace de sesión.
- Carpetas: app en `APP\`; `privado\` y `app de muestra\` fuera del repositorio.

## Dónde está el resto

| Archivo | Qué tiene |
|---|---|
| `PLAN.md` | El plan completo: alcance, modelo de datos (§7), seguridad (§9), cada fase con su «Listo cuando» |
| `MAPA.md` | Qué contiene cada archivo de la app, las pruebas y las herramientas |
| `decisiones/fase-01.md` | Fase 1 · Base instalable y publicación |
| `decisiones/fase-02.md` | Fase 2 · Cuentas, perfiles y reglas |
| `decisiones/fase-03.md` | Fase 3 · Catálogo |
| `decisiones/fase-04.md` | Fase 4 · Pesaje y entregas del día |
| `decisiones/fase-05.md` | Fase 5 · Ventas para los dueños |
| `decisiones/fase-06.md` | Fase 6 · Cierres mensuales |
| `decisiones/fase-07.md` | Fase 7 · Indicadores, proyección y metas |
| `decisiones/fase-08.md` | Fase 8 · Cierre y entrega |
| `decisiones/fase-09.md` | Fase 9 · Costos y margen por pan |
| `decisiones/fase-10.md` | Fase 10 · Plan de producción diario |
| `decisiones/fase-11.md` | Fase 11 · Varios clientes y ventas sueltas |
| `decisiones/fase-12.md` | Fase 12 · Cobros y cotizaciones |
| `decisiones/revision-reglas-2026-11.md` | Revisión de reglas (25-nov-2026): sesión solo de Google, bitácora, fechas, mes terminado y tope de la tablet; y lo que quedó por decidir |

**Al cerrar una fase o un arreglo:** lo decidido va en el `decisiones/fase-NN.md` de esa fase (uno nuevo si es fase nueva); aquí solo se actualizan Avance, Qué sigue y Pendientes; los archivos nuevos o cambiados van en `MAPA.md`.

## Pendientes de información (PLAN §13)

- Revisión de reglas (25-nov-2026): correr el emulador y publicar (ver «Qué sigue»). Por decidir, sin aplicar: congelar costos de meses cerrados, cerrar la lectura de `config/negocio`, y activar la verificación en dos pasos en las cuentas de Google (dueños, externo y tablet).
- Opcional: cifras del Diagnóstico de la tablet («Apertura de la app» y «Pantalla más lenta»). En el paso 23 se marcaron sin anotar los números.
- Noviembre de 2026 se cierra desde Entregas a partir del 1 de diciembre; con noviembre y diciembre cerrados se puede proyectar todo 2027.
- «Ajustes» del plan (§8) aún no existe como pantalla: el IVA quedó dentro de Catálogo → Clientes e IVA.
- Fase 11: falta ver en el Excel de Windows la hoja «Por cliente» y la columna «Comprador» (probadas con el lector propio de las pruebas).
- `Privado/Guia-familia-Panaderia.pdf` es de la versión anterior: la guía actualizada está en `GUIA-FAMILIA.md` y en la app (Más → Ayuda).

## Texto para iniciar el próximo chat (copiar y pegar)

Para un arreglo:
```
Proyecto App Panadería, arreglo: [qué pasa, en qué pantalla y equipo, y qué se esperaba].
Lee D:\APP Panaderia\ESTADO.md y MAPA.md (dice dónde está cada cosa), la decisiones/fase-NN.md de esa pantalla
y solo los archivos que toca el arreglo; corrige, prueba, sube la versión (Z) y deja ESTADO.md actualizado.
```

Para un futuro nuevo:
```
Proyecto App Panadería, nueva fase: [futuro elegido, por ejemplo «hoja de insumos del día»].
Lee D:\APP Panaderia\ESTADO.md, MAPA.md y de PLAN.md solo §3, §7 y la última fase. Hazme primero las preguntas
para planificarla y deja la fase escrita en PLAN.md antes de desarrollar.
```
