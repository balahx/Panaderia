# Estado del proyecto · App Panadería

> Archivo corto. **Todo chat nuevo lo lee primero** y lo actualiza al cerrar. El detalle está en `PLAN.md` (versión 2).

## Avance

| Fase | Contenido | Chat | Estado |
|---|---|---|---|
| 0 | Planificación y cuestionario | 1 | ✔ Hecha (13-nov-2026) |
| 1 | Base instalable, Firebase, Hosting, repositorio, guía paso a paso | 2 | ✔ Hecha. Verificación T3 (paso 9) con las 12 casillas marcadas en iPhone, Android y Windows (14-nov-2026) |
| 2 | Cuentas de Google, perfiles, reglas, App Check | 3 | ✔ Hecha. Pasos 13 a 17 verificados por Felipe (15-nov-2026): las 7 casillas del paso 15 y el paso «Reglas de Firestore (emulador)» en verde. App Check sigue **sin configurar** (paso 16, opcional hasta la Fase 8) |
| 3 | Catálogo: productos, precios, trabajadores | 4 | ✔ Hecha. Paso 18 verificado por Felipe (16-nov-2026): 6 de 7 casillas y el emulador en verde. La casilla «el externo no tiene el botón del IVA» quedó **sin marcar**: el código y `catalogo-e2e.js` lo cumplen; se vuelve a revisar en el paso 19 |
| 4 | Pesaje y entregas del día (tablet) | 5 | ◐ Código, reglas, pruebas y guía hechos (16-nov-2026). **Falta que Felipe ejecute `GUIA-FIREBASE.md`, paso 19** (publicar, preparar la tablet y verificar) |
| 5 | Ventas para dueños: registro, fecha pasada, Excel, respaldo | 6 | Pendiente |
| 6 | Cierres mensuales (importar ene–oct 2026, cerrar mes) | 7 | Pendiente |
| 7 | Indicadores, proyección y metas | 8 | Pendiente |
| 8 | Cierre y entrega (incluye App Check obligatorio) | 9 | Pendiente |
| 9 | Costos y margen por pan | 10 | Después |
| 10 | Plan de producción diario | 11 | Después |

Versión de la app: **0.4.0** (caché 2026.11.16.1) · 15 pruebas, todas bien (16-nov-2026, con Firebase, Google y Firestore simulados) · 184 casos de reglas

## Qué falta para cerrar la Fase 4 (lo hace Felipe, con `GUIA-FIREBASE.md`, paso 19)

1. `npm test` (15 pruebas).
2. **Subir a GitHub antes de publicar** y mirar Actions → «Reglas de Firestore (emulador)»: las reglas de pesajes, días y bitácora cambiaron (30 casos nuevos, 184 en total) y **desde el chat no se pudieron compilar ni probar contra el emulador** (sin red para instalarlo). Si queda en rojo, no publicar y traer las líneas con ✗.
3. `firebase deploy --only hosting,firestore:rules` y actualizar cada equipo a 0.4.0.
4. Preparar la tablet (fecha y hora automáticas, elegir quién pesa) y hacer la prueba completa con el teléfono del dueño en **Hoy** (incluye modo avión).
5. Marcar la tabla de 8 casillas del paso 19 (incluye la casilla pendiente del IVA del externo).

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

### Decisiones de la Fase 4 (16-nov-2026)

- **Pantallas por perfil:** dueños y externo entran a **Hoy** (`pantallas/inicio.js`) y tienen **Hoy · Pesaje · Más**; la cuenta de pesaje solo **Pesaje · Más** y letra grande. `app.js`: la pestaña de entrada es la primera que el perfil puede ver.
- **«Cerrar entrega»** (confirmado por Felipe): lo toca quien pesa, con confirmación. `dias/{fecha}` = `{ entregaN, por, en }` guarda **solo la entrega en curso** (sin documento = n.º 1). Cada canasto lleva su `entregaN`. Si se cerró por error y la nueva no tiene canastos, «Volver a abrir la entrega n.º N». Las reglas dejan a la tablet subir o bajar de a uno; gestión, cualquier número (1 a 50).
- **Los totales NO se guardan** en `dias` (el plan decía «totales por producto, entrega y trabajador»): se calculan en el equipo con los pesajes (`core/pesaje.js`, `resumen`). Motivo: guardar totales desde varios equipos, y sin conexión, produce choques y dos verdades; un día son unas decenas de canastos. Si las Fases 5–7 necesitan resúmenes de meses, que los calculen al «Cerrar mes» y los guarden en `cierres` (ya previsto).
- **Montos de un día:** `pesaje.montosDia(porPan, precios, clienteId, fecha, iva)`: por pan, `precioVigente` de ESE día × cantidad del día, redondeado a pesos; el IVA sobre el neto total. **Las Fases 5–7 deben usar esta función** (no sumar canasto por canasto: el redondeo cambiaría).
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

- Excel de cierres: Felipe los dejará en `privado\` cuando los tenga (Fase 6).
- Resultado del paso 19 de la guía (tabla de 8 casillas, Diagnóstico de la tablet y si el emulador quedó en verde).
- La casilla del paso 18 «el externo no tiene el botón del IVA» quedó sin marcar: se revisa en el paso 19.
- App Check (paso 16) sigue sin configurar: es obligatorio recién en la Fase 8.
- Fase 5: ¿se registran ventas de un producto en un día sin precio vigente? (Hoy `precioVigente` devuelve `null`; **Hoy** lo muestra como «Sin precio ese día (no suman)».)
- Fase 5: ¿la venta del día es exactamente lo pesado (pesaje = venta) o los dueños ajustan algo antes? Hoy **Hoy** calcula la venta con todo lo pesado no anulado.
- «Ajustes» del plan (§8) aún no existe como pantalla: el IVA quedó dentro de Catálogo → Cliente e IVA.

## Mapa de archivos

| Archivo | Qué contiene |
|---|---|
| `GUIA-FIREBASE.md` | Paso a paso: consola, publicación, instalación, repositorio, seguridad, problemas frecuentes |
| `firebase.json` | Hosting publica `APP\`; cabeceras de seguridad (CSP, antimarcos) y de caché |
| `firestore.rules` | Reglas por perfil de las 12 colecciones (dueño, externo, pesaje) y forma de los datos del catálogo, pesajes, días y bitácora; todo lo demás cerrado |
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
| `APP\js\app.js` | Arranque, sesión, acceso por perfil (escuchas en vivo), catálogo en vivo (`vigilarCatalogo` → `ctx.cat`), pesajes del día en vivo (`vigilarDia` → `ctx.dia`), pestañas (`TABS`, con `oculta`, `permiso`, `datos` y `grande`), reparto de acciones (`alActuar`), escritura (`alEscribir`) y teclado (`alTeclear`), cambio de día, cerrar sesión con aviso de datos sin enviar |
| `APP\js\core\nube.js` | Único contacto con Firebase: sesión, Firestore con caché sin conexión (`vigilarDoc`, `vigilarCol`, `vigilarDonde` con `_pend`), accesos, escrituras generales (`guardar`, `guardarVarios`, `borrar`, `ajustarNegocio`), `pendientes()`, App Check opcional, `estado()` |
| `APP\js\core\perfil.js` | Perfiles, permisos (`puede`) y `resolver` (qué pantalla corresponde). Lógica pura |
| `APP\js\core\pesaje.js` | Pesaje, lógica pura: teclado (`teclear`), `validarCantidad` (aviso 20 kg, confirmar 50 kg), `nuevoPesaje`, `soloPesaje`, `diferencia` y `constancia` (bitácora), `entregaEnCurso`, `entregaActual`, **`resumen`** (totales por pan, entrega y trabajador), **`montosDia`**, `horaChile`, `sumarDias` |
| `APP\js\core\catalogo.js` | Catálogo, lógica pura: `numero`, `pesos`, `montos`, `ivaDe`, validaciones, orden (`mover`), **`precioVigente`**, `historial`, `idPrecio`, `clientePrincipal`, `nuevoId` |
| `APP\js\core\acceso.js` | Ingreso con Google por redirección: `comenzar`, `terminar`, `validar` |
| `APP\js\core\actualizar.js` | Versión, «Buscar actualización», aviso de versión nueva |
| `APP\js\core\ui.js` | `$`, `toast`, `ask` (confirmación), `hoja` / `cerrarHoja` |
| `APP\js\core\formato.js` | `esc`, `clp`, `kilos`, `fechaTexto`, `diaChile`, `iniciales` |
| `APP\js\core\iconos.js` | Íconos SVG, `emptyHTML`, `errorHTML` |
| `APP\js\pantallas\ingreso.js` | Pantalla de ingreso y avisos de configuración |
| `APP\js\pantallas\espera.js` | Con sesión y sin perfil: comprobando, pedir acceso, espera, acceso quitado, falta `config/negocio` |
| `APP\js\pantallas\accesos.js` | Solo dueños: solicitudes, aprobar con perfil, cambiar, quitar, devolver; `aviso()` |
| `APP\js\pantallas\catalogo.js` | Catálogo (dueños y externo): listas de productos con precio, trabajadores, cliente e IVA, y sus hojas |
| `APP\js\pantallas\catalogo-producto.js` | Hojas de un producto: ficha con historial, formulario, precio con vigencia, orden, activar; ayudas comunes de las hojas (`enviar`, `error`, `pieHoja`) |
| `APP\js\pantallas\inicio.js` | **Hoy** (dueños y externo): lo pesado en un día en vivo, venta con el precio vigente, por pan, entregas con sus canastos, por trabajador, anulados; otro día (‹ › y calendario) |
| `APP\js\pantallas\pesaje.js` | **Pesaje** (tablet, letra grande): quién pesa, entrega en curso con «Cerrar entrega» / «Volver a abrir», panes, teclado propio y físico, nota, «Pesado hoy» con «Por enviar» |
| `APP\js\pantallas\pesaje-hoja.js` | Hojas comunes de un canasto: ficha, corregir, anular, reactivar (con constancia en `cambios`); nota del próximo canasto; `filaCanasto` |
| `APP\js\pantallas\mas.js` | Cuenta y perfil, entradas a Catálogo y Accesos, diagnóstico (perfil, UID, datos, App Check), actualización |
| `APP\vendor\firebase\` | SDK local (lo crea `tools/vendor.js`) |
| `tools\servidor.js` · `servir.js` | Servidor local con las cabeceras de Hosting · `node tools/servir.js` |
| `tools\bump.js` · `run-tests.js` · `vendor.js` | Subir versión · correr pruebas · descargar SDK (app, auth, firestore, app-check) |
| `tools\appcheck.js` | `activar` / `desactivar` / `estado`: abre o cierra la política de contenido para reCAPTCHA en `index.html` y `firebase.json` |
| `tests\version-unit.js` · `update-unit.js` · `acceso-unit.js` · `repo-unit.js` | Pruebas sin navegador: versión y caché, actualización, ingreso y formato, higiene del repositorio |
| `tests\perfil-unit.js` · `reglas-unit.js` · `catalogo-unit.js` · `pesaje-unit.js` | Sin navegador: perfiles y pantallas de acceso · reglas contra la copia a mano · catálogo y vigencia de precios · teclado, cantidades, totales, montos y bitácora del pesaje |
| `tests\reglas-casos.js` · `rules-emulator.js` | Casos de reglas compartidos · prueba contra las reglas reales con el emulador (CI o `npm run reglas`) |
| `tests\pwa.js` · `csp.js` · `ingreso-e2e.js` · `accesos-e2e.js` · `catalogo-e2e.js` · `pesaje-e2e.js` · `a11y.js` | Con navegador: instalación y sin conexión, política de seguridad, ingreso completo, accesos, catálogo y pesaje de punta a punta (incluido sin conexión y «Hoy» del dueño en vivo), accesibilidad de 40 vistas |
| `tests\fake-firebase\` | Dobles de prueba de Firebase, Google, Firestore (`window.__fakeDb`; con `setDoc`, `updateDoc`, `deleteDoc`, lotes, consultas `where ==` y escrituras pendientes sin conexión), App Check y la copia a mano de las reglas (`reglas.mjs`) |

## Texto para iniciar el próximo chat (copiar y pegar)

```
Proyecto App Panadería, Fase 5. Lee D:\APP Panaderia\ESTADO.md y de PLAN.md solo
las secciones 3, 7, 8 y "Fase 5". De la "app de muestra" lee solo lo que sirva para
exportar a Excel y respaldos (dime antes qué archivos vas a leer).
De APP lee: js/app.js, js/core/nube.js, js/core/catalogo.js, js/core/pesaje.js, js/core/perfil.js, js/core/ui.js,
js/core/formato.js, js/pantallas/inicio.js, js/pantallas/pesaje-hoja.js, js/pantallas/mas.js, css/componentes.css,
firestore.rules (bloques Pesajes y Cambios), tests/reglas-casos.js, tests/fake-firebase/firebase-firestore.js,
tests/fake-firebase/reglas.mjs y tests/a11y.js.
Resultado del paso 19 de GUIA-FIREBASE.md: [pegar la tabla de 8 casillas, el Diagnóstico de la tablet
y si el paso «Reglas de Firestore (emulador)» de GitHub Actions quedó en verde o los ✗].
Ventas sin precio: [¿se pueden registrar ventas de un pan en un día sin precio vigente?]
Venta = pesaje: [¿la venta del día es todo lo pesado no anulado, o los dueños ajustan algo antes?]
Desarrolla la Fase 5 completa. Al terminar: pruebas, versión 0.5.0 y ESTADO.md actualizado.
```
