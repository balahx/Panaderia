# Decisiones · Fase 12 · Cobros y cotizaciones

> Parte de `ESTADO.md` (dividido el 20-nov-2026). Qué se decidió en esta fase y por qué. El plan de la fase está en `PLAN.md` «Fase 12».

### Planificación (21-nov-2026)

Respuestas de Felipe (una ronda de 20 preguntas; el detalle está en PLAN «Fase 12»):
- **Monto:** se arma solo con las entregas del cliente en el período, con el precio vigente de cada día.
- **Período:** semanal (lunes a domingo) o mensual (mes calendario), con el habitual en la ficha del cliente; también «Otras fechas».
- **Plantilla:** una línea por pan y un **anexo por día sin montos en dinero**. Precios **con IVA** en las líneas y, al final, el desglose Neto · Descuento · IVA · Total (con «Ajuste por redondeo» si hace falta).
- **Descuento:** el habitual en la ficha del cliente, en % o en $ con IVA incluido y con su texto; en cada cobro se puede cambiar o quitar.
- **Registro:** cada cobro queda guardado con número y el total «Por cobrar» de cada cliente; los pagos se anotan como abonos (segunda ronda, abajo).
- **Cobro emitido fijo**; si los canastos cambian, se avisa y se ofrece anularlo y emitirlo de nuevo con constancia; aviso al cobrar dos veces las mismas fechas.
- **Ventas sueltas:** sin cobros. **Vencimiento:** plazo por cliente y franja de cobros vencidos. **N.º de factura SII:** campo opcional.
- **Datos de la panadería:** razón social, RUT, dirección, correo y datos para transferir (banco, tipo y n.º de cuenta, RUT, correo de aviso), editables por dueños y externo en la app y guardados en Firestore (no en el repositorio). Nombre «Panadería» con el ícono de la hogaza. **Se anotan después en la app**; el chat no los necesita.
- **Datos del cliente:** razón social, RUT, dirección y contacto.
- **PDF hecho por la app** (sin librerías) con Descargar, Compartir e Imprimir; hoja carta.
- **Cotizaciones:** datos del posible cliente escritos en la cotización, numeradas, con «Crear cliente con estos precios»; precios desde la lista de un cliente, ajustables, con cantidad estimada opcional y total estimado; válida por 15 días; estados Enviada, Aceptada o Rechazada; el descuento funciona igual que en los cobros.
- **Acceso:** dueños y externo hacen todo (emitir, marcar pagado, anular con constancia, cotizar); la tablet no ve nada de esto.
- **Lugar:** Más → grupo «Cobros» (Cobros, Cotizaciones y Datos para documentos), y «Por cobrar» en la ficha del cliente.
- **Excel:** hoja «Cobros» en el Excel del mes; todo entra en el respaldo.
- Propuestas incluidas en el plan: documento interno con el pie «No válido como factura»; los datos de cobro van en `clientesCobro` (aparte de `clientes`, que lee la tablet); emitir necesita internet (folio correlativo en transacción); el total se calcula sobre el neto, como en los cierres; un pan sin precio bloquea la emisión; se cobra desde el 1-nov-2026 (antes solo hay cierres del Excel).

Segunda ronda (21-nov-2026): Felipe pidió sumar **abonos parciales y saldo pendiente**; aceptó todo lo propuesto:
- El abono es **de la cuenta del cliente** y se reparte solo desde el cobro más antiguo con saldo; el reparto se puede cambiar a mano.
- Estados calculados: **Pendiente → Abonado → Pagado**; vencido = con saldo y vencimiento pasado.
- **Pago de más = saldo a favor**, que se aplica solo al próximo cobro (como pago, no como descuento: no cambia el IVA).
- El PDF del cobro muestra lo abonado, el saldo de ese cobro, los **cobros anteriores pendientes** y el **total adeudado**.
- **Estado de cuenta** en PDF desde la ficha del cliente (cobros y abonos de un rango, con saldo corrido).
- **Sin recibo de abono** en PDF por ahora.
- Un abono mal anotado se **anula** con motivo; al anular un cobro con abonos, estos pasan al cobro que lo reemplaza o quedan a favor.
- Excel: hoja **«Abonos»** y columnas «Abonado» y «Saldo» en «Cobros»; la lista suma el filtro «Abonados» y muestra Por cobrar, Vencido y Saldo a favor.
- Propuesta incluida: el cobro no guarda lo abonado ni el saldo; se calculan con la colección `abonos` (una sola fuente).

### Verificación (24-nov-2026)

Felipe verificó el paso 27 de `GUIA-FIREBASE.md` con las **7 casillas** marcadas: el neto del cobro semanal y del mensual = Entregas con el filtro del cliente (con el desglose y el ajuste a la vista), el PDF se abre, se imprime y se comparte por correo y WhatsApp en Windows, iPhone y Android, el saldo con un abono parcial es el mismo en todas partes, el pago de más queda a favor y se aplica al cobro siguiente, la franja de vencidos y la anulación funcionan, la cotización aceptada crea el cliente con sus precios, y la tablet no ve nada de cobros. Diagnóstico con 0 bloqueos y versión 0.12.0 en los tres tipos de equipo; emulador en verde con los 481 casos. **Fase 12 cerrada.**

### Desarrollo (21-nov-2026, chat 13) · versión 0.12.0

Se desarrolló completa en un solo chat. Lo que se decidió al desarrollarla:
- **Líneas del cobro:** una por pan **y precio**: si el precio de un pan cambió dentro del período, salen dos líneas (el PDF les pone las fechas, «Marraqueta (10-11 al 12-11)»). El neto de cada línea es la suma de los netos de sus líneas de venta (`ventas.lineas`), así el neto del cobro = el de Entregas con el filtro del cliente. Precio con IVA con 2 decimales; monto con IVA al peso. El descuento en $ se muestra tal cual (con IVA); en %, su neto × (1 + IVA) al peso; la diferencia con el total va en «Ajuste por redondeo» (en 500 cobros al azar, a lo más unos pesos).
- **Período por omisión:** el habitual del cliente (sin datos de cobro, **mensual**); si el último período terminado es anterior al 1-nov-2026, el período en curso. «Semanal» se elige con un día cualquiera de la semana.
- **Fechas:** la emisión es el día (Chile) del equipo que emite; vence = emisión + plazo; **vencido** = con saldo y el día de vencimiento ya pasado.
- **Emitir** (`nube.conFolio`): una transacción lee `config/folios` y los abonos que se van a tocar (si otro equipo los cambió, se corta con «Los abonos de este cliente cambiaron en otro equipo»), crea `cobros/000n`, sube el folio y aplica el saldo a favor del cliente (`aplicado` con `previo: true`: el PDF lo muestra como «Saldo a favor anterior»). Si otro equipo emitió al mismo tiempo, Firestore la repite sola con el número siguiente. «Anular y emitir de nuevo» hace todo en la misma transacción: el cobro nuevo (`reemplaza`), la anulación del anterior (`anulado.reemplazo`) y lo abonado pasa al nuevo (lo que no cabe queda a favor).
- **Forma de los documentos** (además de lo del plan): el cobro guarda `fecha` (emisión), y en cada línea `precio`, `desde` y `hasta`; el descuento guarda `neto` y `conIva`; la anulación es `{ motivo, reemplazo, por, quien, en }`. El abono guarda `quien`; `reparto` = `{ por, quien, en }`. La cotización guarda `iva`, `emisor` y `cambio` (quién y cuándo de cada cambio de estado); «Vencida» se calcula (no se guarda). Ningún documento guarda estados calculables.
- **Abonos con internet:** anotar, cambiar el reparto o anular un abono necesita internet (si dos equipos sin conexión aplicaran pagos al mismo cobro, el saldo quedaría mal). El borrador de un cobro sí se arma sin conexión, y los PDF se descargan sin conexión.
- **Estado de cuenta:** los cobros cuentan como cargo el día de su emisión y cada abono como pago por su monto completo; los anulados no aparecen; saldo final negativo = a favor. De punta a punta, saldo final = Por cobrar − saldo a favor (también en 500 secuencias al azar).
- **PDF e impresión:** la política de contenido **no cambió**: se probó que el visor de PDF de Chromium abre el PDF (`blob:`) con `object-src 'none'` sin bloqueos. «Imprimir» abre el PDF en otra pestaña (desde ahí se imprime); en el iPhone o iPad con la app instalada abre Compartir (que tiene «Imprimir»); si el navegador no deja abrir la pestaña, se descarga. Hay que confirmarlo en cada equipo (paso 27).
- **Excel:** las hojas «Cobros» y «Abonos» van en todo Excel de ventas (Datos, Entregas y Costos → El mes). «Cobros» trae los cobros cuyo período termina en las fechas del Excel; el del mes en curso (que llega hasta hoy) incluye los que terminan más adelante en ese mes. Saldo y estado al día de la descarga.
- **Datos en vivo:** dueños y externo escuchan `cobros`, `abonos`, `clientesCobro`, `cotizaciones` y `config/empresa` completos (pocos documentos; el saldo necesita todos los abonos). La tablet no pide nada de esto (las reglas se lo negarían).
- **Pantallas:** Más → grupo **Cobros** (Cobros, con lo por cobrar; Cotizaciones; Datos para documentos). En Cobros, el filtro de cliente es propio (solo clientes regulares, activos o no) y el estado es una lista (Todos, Pendientes, Abonados, Vencidos, Pagados, Anulados). Llegando desde la ficha del cliente, Cobros queda filtrado por ese cliente. La franja de vencidos lleva a Cobros con «Vencidos». La ficha de un cobro abierta se pone al día sola cuando llegan datos.
- **Reglas:** 6 bloques nuevos con `getAfter` / `existsAfter` (el folio solo sube de a uno y junto con su documento, que no existía; folio hasta 9999). **481 casos** (86 nuevos; los casos admiten lotes, `op: 'batch'`). Desde el chat no se pudo correr el emulador (sin red para instalarlo): queda para GitHub Actions (paso 27).
- **Pruebas nuevas:** `cobros-unit.js`, `abonos-unit.js`, `pdf-unit.js` (con un lector de PDF propio) y `cobros-e2e.js` (15 grupos de punta a punta, también dos equipos a la vez). El doble de Firestore suma transacciones (con reintento), `update` en lotes, `getAfter`, la hora del servidor dentro de los mapas, el rechazo de campos `undefined` (como Firestore) y la copia en el equipo de lo leído con `getDocs`. Se ajustaron las pruebas que contaban las hojas del Excel y los grupos de Más. `a11y.js` recorre **130 vistas** (26 nuevas). **34 pruebas en verde.**
- **Tamaño:** el código propio pasó de ~515 a ~660 KB (sin comprimir); el límite de `rendimiento.js` sube de 550 a **700 KB** (se descarga una vez por versión y Hosting lo envía comprimido).
- **Textos:** Ayuda con «Cobros», «Abonos y saldo», «Cotizaciones» y «Datos para documentos» (solo dueños y externo); aviso de privacidad (vigente desde el 21-nov-2026) con los datos de clientes y posibles clientes y los datos bancarios; `GUIA-FAMILIA.md`, `LEEME.md` y `GUIA-FIREBASE.md` (paso 27). En PLAN §7 se corrigieron las filas de `cobros` y `cotizaciones` y se sumó `abonos`.
