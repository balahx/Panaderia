# Estado del proyecto · App Panadería

> Archivo corto. **Todo chat nuevo lo lee primero** y lo actualiza al cerrar. El detalle está en `PLAN.md` (versión 2).

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
| 7 | Indicadores, proyección y metas | 8 | ◐ Código, reglas, pruebas y guía hechos (18-nov-2026). Falta que Felipe ejecute `GUIA-FIREBASE.md`, paso 22 (publicar, importar 2025 y verificar) |
| 8 | Cierre y entrega (incluye App Check obligatorio) | 9 | Pendiente |
| 9 | Costos y margen por pan | 10 | Después |
| 10 | Plan de producción diario | 11 | Después |

Versión de la app: **0.7.0** (caché 2026.11.18.1) · 22 pruebas, todas bien (18-nov-2026, con Firebase, Google y Firestore simulados) · 261 casos de reglas

## Qué falta para cerrar la Fase 7 (lo hace Felipe, con `GUIA-FIREBASE.md`, paso 22)

1. `npm test` (22 pruebas).
2. **Subir a GitHub antes de publicar** y mirar Actions → «Reglas de Firestore (emulador)»: hay 26 casos nuevos (261 en total, de la proyección) y **desde el chat no se pudieron probar contra el emulador** (sin red). Si queda en rojo, no publicar y traer las líneas con ✗.
3. `firebase deploy --only hosting,firestore:rules` y actualizar cada equipo a 0.7.0.
4. **Recomendado:** importar `Privado\Cierres 2025.xlsx` (marzo a diciembre de 2025; en el chat 8 se comprobó que el importador lo lee como 10 meses, con el formato de la plantilla). Sin 2025 no hay comparación con el año anterior ni proyección de 2026.
5. Ajustar la proyección, fijar las metas y marcar la tabla de 6 casillas del paso 22.

## Decisiones tomadas

- Perfiles: Dueño (todo + accesos), Externo (todo salvo accesos), Pesaje (solo pesaje, sin precios). Ingreso solo con Google; aprobación por los dueños.
- Tablet con una cuenta de Google; quien pesa toca su nombre; corrige solo lo del día.
- Pesaje por canasto, kg con 2 decimales o unidades según catálogo, aviso sobre 20 kg, nota opcional, día calendario chileno.
- Varias entregas por día; se arman solas con los pesajes. Sin guías, mermas ni pagos.
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

### Decisiones de la Fase 1 (13-nov-2026)

- **Ingreso con Google por redirección de página completa**, hecha por la app (`core/acceso.js`): va a `accounts.google.com`, vuelve con un `id_token` y se entrega a Firebase (`signInWithCredential`). Motivo: el ingreso estándar del SDK (ventana emergente o redirección) obliga a cargar un script de `apis.google.com` y un marco, lo que chocaba con «CSP estricta, sin scripts de terceros»; además las ventanas emergentes fallan en apps instaladas en iPhone. Costo: un paso más en la guía (paso 5, URIs autorizados). **Plan B** si el paso 9 falla en algún equipo: usar `signInWithRedirect` del SDK y admitir `apis.google.com` en la CSP.
- Dirección oficial `https://ID.web.app`; `ID.firebaseapp.com` redirige sola.
- CSP más estricta que la muestra: `script-src 'self'` y `style-src 'self'` (sin `unsafe-inline`), sin `frame-src`. Va en `index.html` y como cabecera en `firebase.json` (con `frame-ancestors 'none'` y `X-Frame-Options`). **Consecuencia para todas las fases: nada de `style="…"` ni `onclick="…"` en el HTML que genera el código** (sí se puede `el.style.x = …`); `tests/csp.js` lo vigila.
- El SDK de Firebase no viene en el repositorio de origen: lo descarga `tools/vendor.js` (versión fijada 12.15.0, con huella SHA-256) y se sube al repositorio.
- Módulos ES en `APP\js\` (probados en Node gracias a `APP\js\package.json`); `version.js` y `guard.js` siguen siendo scripts clásicos (los necesita el service worker).
- Pantallas: cada módulo exporta `html(ctx)` y `alActuar(act, el, ctx)`; los botones usan `data-act`. `app.js` reparte.
- Firestore creado en modo producción con reglas **todo cerrado** hasta la Fase 2.
- CI: acciones fijadas por hash (checkout v4.1.7, setup-node v4.0.3) y Dependabot mensual para actualizarlas. **gitleaks no se incluyó** (no se pudo verificar su hash desde el chat); lo cubren `tests/repo-unit.js` y Secret scanning + Push protection de GitHub.
- Letra grande para la panadería: `data-escala="grande"` en `<html>` (los tamaños usan `em`); desde la Fase 4 la activa `app.js` en la cuenta de pesaje y en la pestaña Pesaje.

### Decisiones de la Fase 7 (18-nov-2026)

- **Pestaña «Números»** (dueños y externo) entre Entregas y Pesaje: el nombre corto cabe en la barra de 360 px («Indicadores» se cortaba); la pantalla se titula «Indicadores». Dos partes (`.seg`): **El mes** y **Año y metas**.
- **De dónde sale cada mes** (regla de la Fase 6): mes **cerrado** → totales y panes del **cierre** (no se recalculan); sin cerrar o reabierto → `ventas.lineas` de sus pesajes, igual que Entregas. Un mes cerrado con la app usa además sus pesajes para el detalle por día y por trabajador (si un precio cambió después, valen los totales del cierre y se avisa); uno importado desde **Excel no trae días ni trabajadores** (esos indicadores lo dicen). Lógica pura en `core/indicadores.js` (`resumenMes`).
- **Los nueve indicadores** (El mes): venta neta por pan, cantidad por pan y participación (una lista ordenada por venta, con la variación de cada pan contra el mes anterior), comparación con el mes anterior y con el mismo mes del año anterior (neto, kilos, unidades), promedio diario (por día con entregas; en meses de Excel, por día del mes), días de la semana (promedio por día con entregas, de lunes a domingo, los dos más fuertes marcados), kilos por trabajador (canastos no anulados) y real contra la meta o la proyección. Todo **neto** (sin IVA).
- **Mes en curso (mejora):** se compara **a su ritmo** = lo de los días ya terminados (sin hoy) llevado a los días del mes (`ritmo`); compararlo a medias con un mes completo engañaba. Contra la meta dice cuánto falta y cuánto por día (contando hoy) y adónde llegaría a ese ritmo. En el año, su variación contra el año anterior no se calcula (está a medias) y el acumulado usa solo meses terminados.
- **Proyección** de un año A = mismo mes de A − 1 × crecimiento (general o el de cada pan, que **reemplaza** al general) × factor de precio, **por pan** (cantidad × crecimiento; neto × crecimiento × precio, en pesos). Los porcentajes se escriben con signo (5, −3). No se proyecta un mes sin base o con la base en curso (se escribe la meta a mano). Se puede mirar hasta el año siguiente al actual.
- **Metas = fijas:** `proyeccion/{AAAA}.metas` (12 montos netos o null). «Usar la proyección como metas» copia la proyección de cada mes con base (los sin base conservan la suya); tocando un mes se escribe o se quita su meta. Cambiar los factores **no** mueve las metas ya fijadas. Mientras un mes no tenga meta, se compara con su proyección («Real contra proyectado»).
- **Reglas de `proyeccion/{AAAA}`:** `anio` (entero = el nombre), `factor` y `factorPrecio` (> 0 y ≤ 10), `panes` (mapa, ≤ 200), `metas` (lista de 12: entero ≥ 0 o null, revisadas una por una), `por` (quien guarda), `quien`, `en` (hora del servidor); dueños y externo; no se borra. Las escrituras exigen conexión (como el catálogo).
- **Lecturas:** el mes que se mira se escucha en vivo (`periodo`); los otros meses sin cerrar que hacen falta (mes anterior, el del año pasado, los del año) se leen **una vez** con `nube.consultarRango` (`getDocs`: sin conexión entrega la copia del equipo y la pantalla lo avisa) y se guardan 10 minutos en `pantallas/meses-datos.js`. Los meses cerrados no cuestan lecturas: **conviene cerrar cada mes**.
- **Gráficos sin librerías y sin `style`:** barras y el gráfico del año en SVG con atributos (CSP), un solo tono (dorado) para la magnitud, el año anterior en gris y la meta como raya; los valores siempre escritos al lado (la lista del año es la tabla del gráfico; cada barra tiene su `<title>`).
- `app.js`: escucha `proyeccion` para gestión (`ctx.proy`). Indicadores acepta `abrir({ mes, vista })`. El Firestore simulado entiende `getDocs`.
- `.gitignore`: se agregó `Privado/` (la carpeta real tiene mayúscula; con `privado/` dependía de que Git ignore mayúsculas).
- Pruebas: `indicadores-unit.js` (mes abierto = Entregas; cerrados = cierre; 300 meses al azar donde por pan, por día de la semana, por trabajador, por entrega y el cierre cuadran; ritmo; comparaciones; proyección, metas y año; documento contra la copia de las reglas) e `indicadores-e2e.js` (barra, mes en curso = Entregas, mes de Excel y mes cerrado con la app = su cierre, año, ajustar con vista previa, fijar metas, meta a mano, real contra meta, sin conexión, externo y tablet). `a11y.js` recorre 60 vistas.

### Decisiones de la Fase 6 (17-nov-2026)

- **IVA = IVA % del neto** (respuesta de Felipe: «se calcula sobre el neto del mes, o sobre el neto que se lleve»). Se aplicó a **todo total**, no solo al cierre: el neto de un grupo (entrega, día, pan, mes) es la suma de los netos de sus líneas y su IVA es `ivaSobre(neto, iva)` = IVA % × ese neto, redondeado una vez (`core/ventas.js`: las líneas llevan `pct` y `totales` calcula así; reemplaza la «suma del IVA de las líneas» de la Fase 5). Así Entregas, Hoy, el Excel y el cierre dicen lo mismo. En el Excel, cada fila conserva su IVA (referencial) y la fila **Total** de cada hoja usa `ROUND(neto×19/100,0)` y `neto+IVA` (verificado con LibreOffice: recalcula igual). Consecuencia: sumar el total de cada entrega puede diferir en unos pesos del total del mes; el neto cuadra exacto.
- **Cierre** = `cierres/{AAAA-MM}` siempre **cerrado** y completo (forma en PLAN §7); solo meses **terminados** (las reglas comparan `mes + '-31'` con el día del servidor). `origen`: `excel` (importado) o `app` («Cerrar mes»). **Desde que un mes está cerrado, sus totales son los del cierre** (Entregas lo muestra; la Fase 7 debe usar el cierre para los meses cerrados y los pesajes para los demás).
- **Mes cerrado = no se anota ni se corrige** (reglas: dueños y externo no crean ni cambian pesajes de un mes cerrado, con `get` a `cierres/{mes}`; la tablet no se revisa porque solo anota hoy o ayer y el mes en curso no se cierra, así lo anotado sin conexión no se pierde). En la app: Hoy muestra «… está cerrado» en vez de «＋ Anotar canasto», y la ficha del canasto no ofrece corregir (`pesaje-hoja.corregible`).
- **Reabrir: solo dueños** (mejora propuesta: un error de importación no quedaba sin salida). Cambia solo `cerrado` a `false` y deja `reabiertoPor`, `reabiertoQuien`, `reabiertoEn`; los montos quedan. Reabierto, el mes se vuelve a cerrar o a importar (gestión), o se borra. El externo no reabre.
- **Importar desde Excel sin librerías:** `core/xlsx-leer.js` abre los .xlsx **comprimidos** con `DecompressionStream('deflate-raw')` (navegadores y Node), con límites de tamaño y revisión CRC; lee textos compartidos, números y fechas. `core/cierres.js` interpreta: busca la fila de títulos (Pan/Producto/Tipo de pan · Kilos/Unidades/Cantidad · Precio · Monto/Neto · IVA · Total), cada tabla es un mes (el mes sale del título, de una fecha, del nombre de la hoja o del archivo, o de una columna «Mes»), aparta la fila TOTAL para comparar, acepta números escritos como texto a la chilena, toma «Total» como neto si no hay neto (o le quita el IVA si es precio × cantidad × 1,19) y calcula precio × cantidad si falta el monto.
- **Revisión antes de guardar** (`pantallas/cierres-importar.js`): mes editable, cada nombre del Excel con un selector de pan (empareja solo lo seguro: sin tildes, mayúsculas, «pan de» ni plurales; sugiere parecidos como «Coliza → Colisa»; o **crea el pan, desactivado**), comparación con el total del Excel (✓/✗), avisos (unidades distintas, filas juntadas, mes que ya tiene canastos en la app: manda el Excel). No deja importar un mes cerrado, en curso o repetido. Las elecciones de nombres se recuerdan en el equipo (`localStorage` `pan.importarNombres`). Se guarda mes por mes. **Plantilla** descargable (Mes · Pan · Unidad · Cantidad · Precio neto · Neto, varios meses en una hoja) por si un Excel no se entiende.
- **Cierres mensuales** (Más → Registros, pestaña oculta `cierres`): el año con el estado de cada mes, detalle por pan, «Reabrir» (dueños). **«Cerrar mes»** está en **Entregas** (meses terminados; lee los pesajes del servidor, avisa si hay datos sin enviar y pide confirmar con neto, IVA y total).
- `app.js`: escucha `cierres` para gestión (`ctx.cierres`); el botón «ir» cierra la hoja abierta; los archivos se atienden con el evento `change` (`alEscribir`). Entregas acepta `abrir({ mes })`. `nube.js`: `hayEnRango` (con `limit(1)`) y `reabrir`.
- Pruebas: `cierres-unit.js` (lector con Excel reales de LibreOffice y openpyxl en `tests/fixtures/`, formatos, emparejar, documento contra la copia de las reglas, «Cerrar mes», y 10 meses al azar en tres formatos que cuadran con su Excel) y `cierres-e2e.js` (importar, cuadrar, mes cerrado, cerrar, reabrir, externo, tablet, plantilla). `a11y.js` recorre 54 vistas. El Firestore simulado entiende `limit`.

### Decisiones de la Fase 5 (16-nov-2026)

- **Venta = pesaje** (confirmado por Felipe): lo vendido es todo lo pesado no anulado (kilos o unidades); los dueños no ajustan nada aparte. Lo que no se pesó en la tablet se anota en fecha pasada.
- **Venta sin precio** (confirmado por Felipe): se registra igual (la cantidad cuenta) pero **no suma pesos**, y una **franja** avisa a dueños y externo («Vendido sin precio: Hallulla (13 nov)…»), con enlace a Catálogo. La franja mira lo que la app ya tiene cargado: el día abierto en **Hoy** y el período de **Entregas** o del **Registro** (no hace lecturas extra). El Excel marca esas filas «Sin precio ese día: no suma» y las lista en el Resumen.
- **Montos por LÍNEA** (el IVA de los totales cambió en la Fase 6, ver arriba; cambia la decisión de la Fase 4 de calcular por día con `montosDia`, que se eliminó): una línea = un pan en una entrega de un día; neto = precio vigente ese día × cantidad, en pesos; IVA = neto × IVA %, en pesos; total = neto + IVA. **Todo total es suma de líneas** (entrega, día, pan, mes, cada hoja del Excel, Hoy y Entregas). Motivo: el «Listo cuando» exige que el Excel del mes cuadre con la suma de sus entregas; con IVA calculado sobre el total del día, la suma de las entregas podía diferir en algunos pesos. Costo: el IVA del mes puede diferir en unos pocos pesos del 19 % del neto total (cada fila redondea); la contadora calcula el IVA oficial en la factura. Lógica en `core/ventas.js` (`lineas`, `totales`, `porEntrega`, `porDia`, `porPan`). **Las Fases 6 y 7 deben usar `ventas.lineas`** (por ejemplo, «Cerrar mes» = `porPan` del mes).
- **Arreglo de redondeo:** `catalogo.montos` usaba `Math.round(precio × kilos)`, que falla en miles de combinaciones por los decimales del computador (105 × 2,30 = 241,4999… → 241 en vez de 242). Ahora `redondearPesos` corrige antes de redondear; `ventas-unit.js` lo prueba en 170 mil combinaciones.
- **Pestañas de dueños y externo: Hoy · Entregas · Pesaje · Más.** **Entregas** revisa un mes (‹ › o calendario): totales, venta del mes, y cada día con sus entregas (horario, canastos, kilos o unidades, neto); «Ver el día y corregir» abre ese día en Hoy; «Descargar Excel del mes». Los meses no se guardan resumidos: se calculan con los pesajes del mes (`nube.vigilarRango`, una lectura por canasto al abrir la pantalla; Fase 6 guardará el cierre).
- **Fecha pasada = «＋ Anotar canasto» en Hoy**, en el día que se mira (también hoy). «Más → Registros → Anotar en fecha pasada» abre Hoy en el día de ayer. La hoja pide pan, cantidad (un canasto o el total del día de ese pan), quién pesó, entrega (las del día y una más), hora y nota; «Guardar y anotar otro» deja la hoja abierta. Queda como un pesaje más (`creadoPor` = esa cuenta); la lista y el Registro dicen «anotado el …» cuando la hora del servidor es de un día posterior. Gestión puede mover un canasto a una entrega nueva al corregirlo.
- **Registro general** (Más → Registros, pestaña oculta `registro`): período (por omisión, el mes hasta hoy; máximo un año), filtros por pan, quién pesó, entrega y estado (vigentes, anulados, todos), de a 100 con «Mostrar más», y **Correcciones**: la bitácora legible (`pesaje.describirCambio`: «cantidad: 29,00 kg → 30,00 kg», quién y cuándo). Tocar un canasto o una corrección abre la ficha para corregir (las hojas de `pesaje-hoja.js` buscan el canasto también en el período).
- **Bitácora con nombre:** `cambios` lleva `quien` (opcional, nombre de la cuenta de Google): la cuenta de pesaje no puede leer los nombres de los miembros. Si falta (constancias viejas), se muestra «Tú», el nombre del miembro (solo dueños tienen la lista) o «Un dueño»/«Otra cuenta».
- **Excel propio, sin librerías** (`core/xlsx.js`: ZIP sin comprimir + XML del formato; `core/excel.js`: las hojas). Seis hojas: **Resumen** (período, cliente, IVA, totales enlazados, panes sin precio, cómo se calcula), **Ventas** (una fila por pan y entrega: fecha, día, entrega, cliente, pan, unidad, cantidad, canastos, precio neto, neto, IVA, total, observación), **Entregas**, **Por día**, **Por pan** y **Canastos** (todos, con anulados marcados, quién pesó, nota y día en que se anotó). Fechas como fechas de Excel, pesos con formato, encabezado fijo y filtro, totales con **fórmula SUMA** y su resultado. Un texto que empieza con «=» nunca se vuelve fórmula. Se verificó abriéndolo con LibreOffice (recalcula iguales) y openpyxl; **falta verlo en Excel de Windows** (paso 20). El nombre: `ventas-AAAA-MM.xlsx` o `ventas-desde_a_hasta.xlsx`. La regla de `tests/csp.js` admite en `core/xlsx.js` solo los tres nombres de esquema del formato (no se cargan).
- **Excel y respaldo leen DEL SERVIDOR** (`nube.leerRango`, `leerCol`, `leerDoc` con `getDocsFromServer`): sin conexión no se hacen (lo dicen), para no entregar un archivo incompleto.
- **Respaldo** (de `backup.js` de la muestra): JSON `respaldo-panaderia-AAAA-MM-DD.json` con `config/negocio`, `config/respaldo`, productos, precios, trabajadores, clientes, pesajes, días, cambios, cierres y proyección; los dueños además miembros y solicitudes (el externo no puede leerlos). Cuesta una lectura por documento (se muestra). Al terminar se escribe `config/respaldo` (`por`, `quien`, `conteos`, `lecturas`, `en`). **Franja semanal:** si nunca hubo respaldo o pasaron 7 días, en todas las pantallas de dueños y externo (salvo Datos), con «Descargar» y «Más tarde» (calla hasta mañana en ese equipo, `localStorage` `pan.respaldoLuego`). **No hay restaurar** desde la app (no lo pide el plan); el archivo sirve de copia propia. **Ojo, crecimiento:** con unas 40 canastas al día, un respaldo completo lee ~15 mil documentos al año de datos; dentro del plan gratuito (50 mil lecturas al día), pero a revisar en la Fase 8.
- **iPhone/iPad instalada:** las descargas usan el menú Compartir («Guardar en Archivos») si se puede, y si no, la descarga normal (`ui.descargar`). Por verificar en el paso 20.
- **«Más» con grupos** (PLAN §8): Catálogo · Registros (Registro general, Anotar en fecha pasada) · Datos (Exportar a Excel y respaldo, con el texto del último respaldo) · Cuenta (Accesos, Diagnóstico, Cerrar sesión). La tablet no ve los grupos.
- `app.js`: las pantallas pueden exportar `periodo(ctx)` → `{ desde, hasta, cambios }` (escucha en vivo `ctx.per = { desde, hasta, pesajes, cambios, err }`, solo gestión) y `abrir(dataset, ctx)` (al llegar con un botón `data-act="ir"`, por ejemplo con `data-dia`). Evento `pan:repintar` (`ui.repintar()`) para redibujar al terminar algo largo (Excel, respaldo). Franjas en `pantallas/avisos.js`. `config/respaldo` se escucha para gestión (1 lectura).
- Pruebas: el Firestore simulado entiende rangos (`>=`, `<=`), `getDocsFromServer` y `getDocFromServer` (fallan sin conexión) y cuenta lecturas; los casos de reglas aceptan filtros de rango (`{ fecha: [desde, hasta] }`). `tests/leer-xlsx.js` (ayuda, no es prueba) abre los .xlsx y revisa sus CRC. `a11y.js` recorre 47 vistas.

### Decisiones de la Fase 4 (16-nov-2026)

- **Pantallas por perfil:** dueños y externo entran a **Hoy** (`pantallas/inicio.js`) y tienen **Hoy · Pesaje · Más**; la cuenta de pesaje solo **Pesaje · Más** y letra grande. `app.js`: la pestaña de entrada es la primera que el perfil puede ver.
- **«Cerrar entrega»** (confirmado por Felipe): lo toca quien pesa, con confirmación. `dias/{fecha}` = `{ entregaN, por, en }` guarda **solo la entrega en curso** (sin documento = n.º 1). Cada canasto lleva su `entregaN`. Si se cerró por error y la nueva no tiene canastos, «Volver a abrir la entrega n.º N». Las reglas dejan a la tablet subir o bajar de a uno; gestión, cualquier número (1 a 50).
- **Los totales NO se guardan** en `dias` (el plan decía «totales por producto, entrega y trabajador»): se calculan en el equipo con los pesajes (`core/pesaje.js`, `resumen`). Motivo: guardar totales desde varios equipos, y sin conexión, produce choques y dos verdades; un día son unas decenas de canastos. Si las Fases 5–7 necesitan resúmenes de meses, que los calculen al «Cerrar mes» y los guarden en `cierres` (ya previsto).
- ~~Montos de un día con `pesaje.montosDia`~~ → reemplazado en la Fase 5 por los montos por línea de `core/ventas.js` (ver arriba).
- **«3 toques»** = pan → número → Guardar (el número puede tener varias cifras; con una cifra son 3 toques exactos). El pan queda elegido: el canasto siguiente son 2 pasos. Teclado propio (kilos: 3 cifras y 2 decimales; unidades: 5 cifras), y también teclado físico (números, coma o punto, ⌫, Enter).
- **Avisos:** sobre 20 kg aviso sin bloquear; sobre 50 kg (o 2.000 unidades) pide confirmar porque casi seguro es un error de tecleo.
- **Quién pesa** queda guardado en el equipo (`localStorage` `pan.pesador`), no en la nube. Si esa persona se desactiva, la tablet vuelve a preguntar.
- **Correcciones con rastro desde ya:** corregir (pan, cantidad, quién, entrega, nota), anular y reactivar escriben en un lote el pesaje y `cambios/{id}` = `{ tipo, pesajeId, fecha, antes, despues, por, en }` (solo los campos que cambiaron). La tablet solo lo del día; dueños y externo, cualquier día (desde **Hoy**, eligiendo el día). El registro general de la Fase 5 debe mostrar esta bitácora.
- **Reglas de pesajes más estrictas:** campos obligatorios (`hora` HH:MM, `entregaN` entero, `trabajadorId`, `anulado`), unidades enteras, la `unidad` debe ser la del producto (`get`) y el trabajador debe existir (`exists`). Cada pesaje cuesta 2 lecturas más en las reglas (dentro del plan gratuito).
- **Sin conexión:** las escrituras del pesaje no esperan al servidor (Firestore las deja en el equipo y las envía solas); la lista las marca **«Por enviar»** (`nube.vigilarDonde` entrega `_pend`). Si el servidor rechaza una al llegar, aparece un aviso y la copia del equipo la deshace. **La tablet puede crear con la fecha de ayer** (`esAyer` en las reglas): un canasto anotado sin internet a las 23:50 que llega pasada la medianoche no se pierde.
- **Cerrar sesión con datos sin enviar** (pendiente de la Fase 2): `nube.pendientes()` (espera 1,5 s a que el servidor confirme) y, si quedan, avisa «Hay datos sin enviar» con «Esperar» o «Cerrar igual y perderlos».
- **Cambio de día:** a medianoche la pantalla que muestra «hoy» pasa sola al día nuevo (revisión cada 30 s en `app.js`).
- `app.js` ahora: las pantallas pueden exportar `fecha(ctx)` (qué día escuchar), `alTeclear(e, ctx)` (teclado físico) y devolver `'repintar'` desde `alActuar`/`alEscribir` para que la app vuelva a dibujar y escuche otro día. Los pesajes del día llegan en `ctx.dia = { fecha, pesajes, dia, err }` y la fecha chilena de hoy en `ctx.hoy`.
- Pruebas: el Firestore simulado entiende consultas con `where ==`, y **sin conexión deja las escrituras pendientes** (se ven con «Por enviar» y se envían al volver, pasando por las reglas con la hora de ese momento). `a11y.js` recorre 40 vistas (agregó Hoy, Pesaje y sus hojas) y no cuenta lo que está dentro de un `<details>` cerrado. En los casos de reglas, `ANTES` pasó a ser **hace tres días** (anteayer podía valer como «ayer» cerca de la medianoche).
- Diseño: en tablet y computador (≥ 700 px) el pesaje va en dos columnas (panes a la izquierda, teclado a la derecha) para no bajar la pantalla. Ícono nuevo `pesa` para la pestaña Pesaje.

### Decisiones de la Fase 3 (15-nov-2026)

- **Catálogo cuelga de «Más»** (pestaña oculta `catalogo`, permiso `gestion`), con tres partes: Productos, Trabajadores, Cliente e IVA. Los formularios van en hojas (`#dlg`), no en la pantalla.
- **Precio = un documento por fecha de vigencia:** `precios/{productoId_clienteId_desde}` con `productoId`, `clienteId`, `neto`, `desde` (`AAAA-MM-DD`). Las reglas exigen ese identificador, así no hay dos precios para el mismo día; corregir el precio de un día reescribe ese documento. **El monto de un día se calcula con `precioVigente(precios, producto, cliente, fecha)`** (`core/catalogo.js`): el precio de «desde» más reciente que no pase de ese día. Por eso un precio nuevo no cambia los días anteriores (el «Listo cuando» está probado en `catalogo-unit.js` y `catalogo-e2e.js`). **Las Fases 5 a 7 deben calcular los montos solo con esa función** (y `montos(neto, cantidad, iva)`), nunca con «el precio actual».
- Un precio con fecha pasada se permite (hace falta para noviembre y para la carga inicial) pero pide confirmación; quitar un precio del historial también. Ambos avisan que solo cambian los montos desde esa fecha.
- **Precio neto con hasta 2 decimales** (por si el precio pactado es con IVA: 1.512,61 neto = 1.800 con IVA). Los campos aceptan números a la chilena (`1.450`, `1512,61`): `catalogo.numero`. Los montos (`montos`) se redondean a pesos enteros: neto, IVA y total.
- **La unidad de un producto (kg/un) no cambia después de creado** (lo exigen las reglas): precios y pesajes dependen de ella. Si hubo un error: desactivar y crear otro.
- **`pesoRef` va en gramos por unidad** y solo en productos por unidad (reglas). `orden` es 1, 2, 3… entre los activos; «Subir/Bajar» reescribe en lote los que cambian; al reactivar un producto va al final.
- Nada del catálogo se borra: productos, trabajadores y clientes se **desactivan** (`activo: false`). Los precios sí se pueden quitar.
- **Cliente:** hay uno (lo crea el dueño o el externo desde «Cliente e IVA», propuesto como «Supermercado»); `clientePrincipal` = el activo más antiguo. Sin cliente no se pueden anotar precios. La app aún no ofrece agregar más clientes (lista de futuros).
- **IVA:** `config/negocio.iva`, lo cambia solo un dueño (`nube.ajustarNegocio`, con `updateDoc` para no tocar `duenos`). Es un solo valor, sin historial: si cambiara, cambia todo lo que la app calcule y no esté cerrado. Los cierres mensuales (Fase 6) deben guardar sus montos ya calculados.
- **Los cambios del catálogo exigen conexión** (igual que los accesos); sin conexión se ve con la copia del equipo.
- **Datos del catálogo en vivo:** `app.js` (`vigilarCatalogo`) escucha `productos` y `trabajadores` para todos los perfiles, y `precios` y `clientes` solo para gestión; llegan a las pantallas en `ctx.cat`. Las pestañas con `datos: true` se redibujan al cambiar el catálogo o el IVA. **Ojo en la Fase 4:** si la pantalla de pesaje lleva `datos: true`, lo que se esté escribiendo debe ir en una hoja o guardarse aparte, porque `#view` se redibuja.
- `app.js` reparte también el evento `input`: una pantalla puede exportar `alEscribir(el, ctx)` (vista previa del precio con IVA).
- Escrituras generales en `nube.js`: `guardar(ruta, datos)`, `guardarVarios([{ruta, datos}])`, `borrar(ruta)`: siempre el documento completo más `en` (hora del servidor), que es lo que piden las reglas. Los identificadores nuevos los crea la app (`catalogo.nuevoId`, 20 caracteres).
- **Accesibilidad:** se portó la auditoría de la muestra como `tests/a11y.js` (30 vistas en 360 px claro y oscuro y 390 px: desborde, 44 px, nombres, etiquetas, contraste). Encontró y se corrigieron dos tamaños de toque de la Fase 2 («‹ Más» y la X de las hojas con título largo). **Cada pantalla o formulario nuevo se agrega a su recorrido.**
- En `GUIA-FIREBASE.md` el paso 18 ordena **subir a GitHub y ver el emulador en verde antes de publicar las reglas**.

### Decisiones de la Fase 2 (14-nov-2026)

- **Dueños:** `config/negocio.duenos` (lista de UID), creado a mano en la consola. Desde la app un dueño solo ajusta `nombre` e `iva`; nadie agrega dueños. **Externo y Pesaje:** `miembros/{uid}` con `perfil` y `activo`, que solo escriben los dueños.
- **Quitar un acceso = `activo: false`** (no borra la ficha ni los registros); se puede devolver. Una ficha sin acceso se puede borrar de la lista. **Rechazar una solicitud = borrarla** (la persona puede volver a pedir).
- **Pantalla según lo que se sabe** (`core/perfil.js`, `resolver`): que un documento «no existe» solo vale si lo dice el servidor; que «sí existe» vale también desde la copia del equipo. Así la app abre sin internet con el perfil ya conocido, y una cuenta nueva sin internet queda en «Comprobando».
- **Lo que decide es el servidor:** la app solo oculta pantallas; las reglas (`firestore.rules`) cubren desde ya las 12 colecciones del plan con el acceso por perfil. La forma exacta de los datos de catálogo, pesajes, días y cierres se afina en la fase de cada pantalla (3 a 7), **siempre junto con `tests/reglas-casos.js`**.
- **Día de la tablet según el servidor:** las reglas calculan el día chileno con la hora del servidor y aceptan UTC-3 y UTC-4 (difieren solo una hora, cerca de la medianoche; no hay zona horaria en las reglas).
- **Dos pruebas de reglas con los mismos casos** (`tests/reglas-casos.js`, 120 casos): `rules-emulator.js` contra las reglas reales (GitHub Actions o `npm run reglas`, necesita Java) y `reglas-unit.js` contra una copia a mano (`tests/fake-firebase/reglas.mjs`) que también usa el Firestore simulado de las pruebas de pantalla. Si la copia y las reglas se separan, una falla.
- **Al cerrar sesión se borra la copia sin conexión de los datos** (equipo compartido) y se recarga la página. **Ojo en la Fase 4:** si hay pesajes sin enviar, cerrar sesión los perdería; habrá que avisar o impedirlo.
- **App Check: preparado y apagado.** reCAPTCHA v3 obliga a cargar un script y un marco de Google, lo que choca con «nada de otros sitios». Se resolvió así: la política sigue estricta mientras `appCheckSiteKey` esté vacío; `node tools/appcheck.js activar` abre la política **solo** para reCAPTCHA y App Check (por carpeta, en `index.html` y `firebase.json`), y `tests/csp.js` exige que política abierta ⇔ clave puesta. Si App Check falla al iniciar, la app sigue (modo supervisar). Obligatorio: Fase 8.
- **Accesos cuelga de «Más»** (pestaña oculta, solo dueños) y hay un aviso en las demás pantallas cuando hay solicitudes. Los cambios de accesos exigen conexión.
- **Escrituras de accesos:** la ficha de miembro se reescribe completa con `por` (quién) y `en` (hora del servidor); aprobar es un lote (crear ficha + borrar solicitud).
- `app.js` no redibuja si el estado de acceso no cambió (no borra lo que se está escribiendo); las pantallas con formularios de las próximas fases dependen de eso.
- Se quitó de `GUIA-FIREBASE.md` un correo real que había quedado en el paso 10 (`tests/repo-unit.js` lo detectó). Si ese cambio de la guía ya se había subido a GitHub, sigue en el historial; el correo de los commits es visible de todos modos en un repositorio público.

## Pendientes de información (PLAN §13)

- Resultado del paso 22 de la guía (tabla de 6 casillas y si el emulador quedó en verde con los 261 casos) y si se importó 2025.
- App Check (paso 16) sigue sin configurar: es obligatorio recién en la Fase 8.
- Noviembre de 2026 se cierra desde Entregas a partir del 1 de diciembre; con noviembre y diciembre cerrados se puede proyectar todo 2027.
- «Ajustes» del plan (§8) aún no existe como pantalla: el IVA quedó dentro de Catálogo → Cliente e IVA.

## Mapa de archivos

| Archivo | Qué contiene |
|---|---|
| `GUIA-FIREBASE.md` | Paso a paso: consola, publicación, instalación, repositorio, seguridad, problemas frecuentes |
| `firebase.json` | Hosting publica `APP\`; cabeceras de seguridad (CSP, antimarcos) y de caché |
| `firestore.rules` | Reglas por perfil de las 12 colecciones (dueño, externo, pesaje) y forma de los datos del catálogo, pesajes, días, bitácora (con `quien`), `config/respaldo`, cierres (meses cerrados) y proyección con metas; todo lo demás cerrado |
| `package.json` · `.gitignore` · `.gitattributes` | Scripts npm, exclusiones, finales de línea |
| `tools\plantillas-github\` · `.github\` | `ci.yml` (pruebas y reglas con emulador en GitHub Actions) y `dependabot.yml`. Las dos copias de `ci.yml` deben ser iguales |
| `APP\index.html` | Cáscara: CSP, `#gate` (ingreso), `#appRoot` (app), `#dlg`, `#toast` |
| `APP\sw.js` | Service worker: red primero con respaldo en caché; listas `ASSETS` (**agregar aquí cada archivo nuevo**) y `VENDOR` |
| `APP\version.js` · `APP\guard.js` | Versión (`PAN_VERSION`) · antimarcos |
| `APP\firebase-config.js` | Configuración web del proyecto, `googleClientId` y `appCheckSiteKey` (públicos) |
| `APP\manifest.webmanifest` · `APP\icons\` · `APP\fonts\` | Instalación, íconos (hogaza), Barlow (OFL) |
| `APP\css\tokens.css` | Tipografías y paleta cálida (claro, oscuro, escala de letra) |
| `APP\css\base.css` | Página, títulos, cabecera, barra de navegación, escritorio |
| `APP\css\componentes.css` | Tarjetas, botones, campos, hojas, ingreso, listas, estados, avisos, accesos, catálogo (`.seg`, `.precio-hoy`, `.hist`, `.radios`), pesaje (`.pes-*`, dos columnas desde 700 px) y Hoy (`.stats`, `.entrega`, `.dia-nav`) |
| `APP\js\app.js` | Arranque, sesión, acceso por perfil (escuchas en vivo), catálogo en vivo (`vigilarCatalogo` → `ctx.cat`), pesajes del día en vivo (`vigilarDia` → `ctx.dia`), del período (`vigilarPeriodo` → `ctx.per`), marca del respaldo (`ctx.respaldo`), franjas (`pintarBanner`), pestañas (`TABS`, con `oculta`, `permiso`, `datos` y `grande`), reparto de acciones (`alActuar`), escritura (`alEscribir`) y teclado (`alTeclear`), cambio de día, cerrar sesión con aviso de datos sin enviar |
| `APP\js\core\nube.js` | Único contacto con Firebase: sesión, Firestore con caché sin conexión (`vigilarDoc`, `vigilarCol`, `vigilarDonde` con `_pend`, `vigilarRango`), lecturas del servidor (`leerCol`, `leerRango`, `leerDoc`), lectura única con copia del equipo (`consultarRango`, Fase 7), accesos, escrituras generales (`guardar`, `guardarVarios`, `borrar`, `ajustarNegocio`), `pendientes()`, App Check opcional, `estado()` |
| `APP\js\core\perfil.js` | Perfiles, permisos (`puede`) y `resolver` (qué pantalla corresponde). Lógica pura |
| `APP\js\core\pesaje.js` | Pesaje, lógica pura: teclado (`teclear`), `validarCantidad` (aviso 20 kg, confirmar 50 kg), `nuevoPesaje`, `soloPesaje`, `diferencia`, `constancia` (bitácora, con `quien`) y `describirCambio` (bitácora legible), `entregaEnCurso`, `entregaActual`, **`resumen`** (totales por pan, entrega y trabajador), `horaChile`, `sumarDias` |
| `APP\js\core\ventas.js` | Ventas, lógica pura: **`lineas`** (un pan en una entrega, con el precio vigente ese día), `totales`, `porEntrega`, `porDia`, `porPan`, `faltanPrecios`, meses (`rangoMes`, `sumarMeses`, `mesTexto`), `validarPeriodo`, `filtrar` y `ordenRegistro` (registro general) |
| `APP\js\core\excel.js` · `xlsx.js` | Excel de ventas: las seis hojas (`libro`) · escritor .xlsx propio sin librerías (`crear`, ZIP sin comprimir, estilos, fórmulas) |
| `APP\js\core\xlsx-leer.js` · `cierres.js` | Lector .xlsx propio (ZIP comprimido con `DecompressionStream`, textos compartidos, fechas, límites) · cierres, lógica pura: `interpretar` (formatos de Excel), `clave`/`emparejar`/`preparar` (nombres con el catálogo, cuadre con el total del Excel), `documento`, `desdeApp` («Cerrar mes»), `cerradoEl`, `estadoMes`, `plantilla` |
| `APP\js\core\indicadores.js` | Indicadores, proyección y metas, lógica pura: `resumenMes` (cierre o pesajes; por pan, por día, semana, trabajador, promedio, ritmo), `comparar`, `variacion`, `pctTexto`, `leerProyeccion`, `validarPct`, `proyectarMes`, `objetivo`, `avance`, `metasDesde`, `tablaAnio`, `documentoProyeccion`, `validarMeta` |
| `APP\js\core\respaldo.js` | Respaldo: qué se lee por perfil (`reunir`), archivo (`armar`), marca (`marcaNueva`) y franja semanal (`toca`, `textoMarca`) |
| `APP\js\core\catalogo.js` | Catálogo, lógica pura: `numero`, `pesos`, `montos` (con `redondearPesos`), `ivaDe`, validaciones, orden (`mover`), **`precioVigente`**, `historial`, `idPrecio`, `clientePrincipal`, `nuevoId` |
| `APP\js\core\acceso.js` | Ingreso con Google por redirección: `comenzar`, `terminar`, `validar` |
| `APP\js\core\actualizar.js` | Versión, «Buscar actualización», aviso de versión nueva |
| `APP\js\core\ui.js` | `$`, `toast`, `ask` (confirmación), `hoja` / `cerrarHoja`, `descargar` (archivo hecho en el equipo; Compartir en iPhone instalado), `repintar` |
| `APP\js\core\formato.js` | `esc`, `clp`, `kilos`, `fechaTexto`, `diaChile`, `iniciales` |
| `APP\js\core\iconos.js` | Íconos SVG, `emptyHTML`, `errorHTML` |
| `APP\js\pantallas\ingreso.js` | Pantalla de ingreso y avisos de configuración |
| `APP\js\pantallas\espera.js` | Con sesión y sin perfil: comprobando, pedir acceso, espera, acceso quitado, falta `config/negocio` |
| `APP\js\pantallas\accesos.js` | Solo dueños: solicitudes, aprobar con perfil, cambiar, quitar, devolver; `aviso()` |
| `APP\js\pantallas\catalogo.js` | Catálogo (dueños y externo): listas de productos con precio, trabajadores, cliente e IVA, y sus hojas |
| `APP\js\pantallas\catalogo-producto.js` | Hojas de un producto: ficha con historial, formulario, precio con vigencia, orden, activar; ayudas comunes de las hojas (`enviar`, `error`, `pieHoja`) |
| `APP\js\pantallas\inicio.js` | **Hoy** (dueños y externo): lo pesado en un día en vivo, venta con el precio vigente, por pan, entregas con sus canastos y su neto, por trabajador, anulados; otro día (‹ › y calendario); «＋ Anotar canasto» |
| `APP\js\pantallas\anotar.js` | Hoja «Anotar canasto» (fecha pasada o hoy) para dueños y externo |
| `APP\js\pantallas\entregas.js` | **Entregas**: el mes por día y entrega, venta del mes, «Descargar Excel del mes» |
| `APP\js\pantallas\registro.js` | **Registro general**: período, filtros, canastos de a 100 y bitácora de correcciones |
| `APP\js\pantallas\datos.js` | **Datos**: exportar a Excel (un mes u otras fechas) y respaldo; `exportar` lo usa también Entregas |
| `APP\js\pantallas\cierres.js` · `cierres-importar.js` | **Cierres mensuales**: el año, detalle por pan, reabrir (dueños), `cerrarMes` (lo usa Entregas) · importar: archivos, revisión (mes, emparejar panes, ✓ con el total del Excel) y guardar |
| `APP\js\pantallas\indicadores.js` · `proyeccion.js` · `meses-datos.js` | **Números** (Indicadores): el mes con los nueve indicadores · «Año y metas»: gráfico y lista del año contra el anterior, proyección (hoja con factores y vista previa), fijar metas, meta de un mes · datos de cada mes (cierre, en vivo o lectura única guardada 10 minutos) |
| `APP\js\pantallas\avisos.js` | Franjas: accesos por revisar, vendido sin precio, respaldo semanal («Más tarde») |
| `APP\js\pantallas\pesaje.js` | **Pesaje** (tablet, letra grande): quién pesa, entrega en curso con «Cerrar entrega» / «Volver a abrir», panes, teclado propio y físico, nota, «Pesado hoy» con «Por enviar» |
| `APP\js\pantallas\pesaje-hoja.js` | Hojas comunes de un canasto (del día o del período): ficha, corregir, anular, reactivar (con constancia en `cambios`); nota del próximo canasto; `filaCanasto` («anotado el …»), `anotadoDespues`, `rechazo` |
| `APP\js\pantallas\mas.js` | Cuenta y perfil, grupos Catálogo · Registros · Datos · Cuenta (Accesos), diagnóstico (perfil, UID, datos, App Check), actualización |
| `APP\vendor\firebase\` | SDK local (lo crea `tools/vendor.js`) |
| `tools\servidor.js` · `servir.js` | Servidor local con las cabeceras de Hosting · `node tools/servir.js` |
| `tools\bump.js` · `run-tests.js` · `vendor.js` | Subir versión · correr pruebas · descargar SDK (app, auth, firestore, app-check) |
| `tools\appcheck.js` | `activar` / `desactivar` / `estado`: abre o cierra la política de contenido para reCAPTCHA en `index.html` y `firebase.json` |
| `tests\version-unit.js` · `update-unit.js` · `acceso-unit.js` · `repo-unit.js` | Pruebas sin navegador: versión y caché, actualización, ingreso y formato, higiene del repositorio |
| `tests\perfil-unit.js` · `reglas-unit.js` · `catalogo-unit.js` · `pesaje-unit.js` | Sin navegador: perfiles y pantallas de acceso · reglas contra la copia a mano · catálogo y vigencia de precios · teclado, cantidades, totales, montos y bitácora del pesaje |
| `tests\ventas-unit.js` · `xlsx-unit.js` · `leer-xlsx.js` | Sin navegador: líneas de venta, redondeo, meses, filtros, **Excel que cuadra con las entregas** (también un mes al azar) y respaldo · escritor .xlsx (ZIP, CRC, XML, fechas, fórmulas) · ayuda para abrir los .xlsx en las pruebas |
| `tests\cierres-unit.js` · `cierres-e2e.js` · `fixtures\` | Sin navegador: lector, formatos, emparejar, documento con la copia de las reglas, «Listo cuando» con 10 meses · con navegador: importar, cerrar, reabrir, externo, tablet · Excel de ejemplo (LibreOffice y openpyxl) |
| `tests\indicadores-unit.js` · `indicadores-e2e.js` | Sin navegador: indicadores = Entregas = cierres (también 300 meses al azar), ritmo, comparaciones, proyección, metas, año y documento con la copia de las reglas · con navegador: Números de punta a punta (mes, cerrado, año, proyección, metas, externo, tablet) |
| `tests\ventas-e2e.js` | Con navegador: Entregas, sin precio con franja, anotar en fecha pasada, registro con filtros y bitácora, corrección con nombre, Excel = Entregas, respaldo y su franja, sin conexión, externo y tablet |
| `tests\reglas-casos.js` · `rules-emulator.js` | Casos de reglas compartidos · prueba contra las reglas reales con el emulador (CI o `npm run reglas`) |
| `tests\pwa.js` · `csp.js` · `ingreso-e2e.js` · `accesos-e2e.js` · `catalogo-e2e.js` · `pesaje-e2e.js` · `a11y.js` | Con navegador: instalación y sin conexión, política de seguridad, ingreso completo, accesos, catálogo y pesaje de punta a punta (incluido sin conexión y «Hoy» del dueño en vivo), accesibilidad de 60 vistas |
| `tests\fake-firebase\` | Dobles de prueba de Firebase, Google, Firestore (`window.__fakeDb`; con `setDoc`, `updateDoc`, `deleteDoc`, lotes, consultas `where` de igualdad y de rango, lecturas del servidor, escrituras pendientes sin conexión y conteo de lecturas), App Check y la copia a mano de las reglas (`reglas.mjs`) |

## Texto para iniciar el próximo chat (copiar y pegar)

```
Proyecto App Panadería, Fase 8. Lee D:\APP Panaderia\ESTADO.md y de PLAN.md solo
las secciones 2, 9, 12 y "Fase 8". De APP lee: index.html, sw.js, js/app.js, js/core/nube.js,
js/core/acceso.js, js/pantallas/mas.js, js/pantallas/ingreso.js, css/base.css, firestore.rules,
firebase.json, tools/appcheck.js, tests/csp.js, tests/a11y.js y tests/repo-unit.js.
Resultado del paso 22 de GUIA-FIREBASE.md: [pegar la tabla de 6 casillas, el Diagnóstico,
si «Reglas de Firestore (emulador)» quedó en verde o los ✗, y si se importó 2025].
Desarrolla la Fase 8 completa. Al terminar: pruebas, versión 0.8.0 y ESTADO.md actualizado.
```
