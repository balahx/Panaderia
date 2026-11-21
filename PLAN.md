# Plan del proyecto · App Panadería (PWA)

Versión del plan: 2 · 13-nov-2026 · Autor: Felipe González
(La versión 2 incorpora el cuestionario respondido: cuentas de Google, Firebase, cierres mensuales y proyección.)

> **Cómo usar este archivo.** Es la referencia completa. Cada chat nuevo lee primero `ESTADO.md` (corto) y de este plan **solo las secciones que indica el texto de inicio**. La "app de muestra" se lee únicamente en las fases que lo indican.

---

## 1. Objetivo

App instalable (PWA) para una panadería familiar que fabrica pan y lo entrega a un supermercado (único cliente por ahora, un solo local). Funciona en Windows, Mac, iPad, tablets Android, iPhone y Android, **con y sin internet**. Los datos se guardan en el dispositivo y se **sincronizan solos** entre equipos mediante Firebase (plan gratuito). Se pueden **descargar respaldos**.

## 2. Perfiles y accesos

Ingreso **solo con cuenta de Google**. Quien ingresa por primera vez envía una solicitud; un dueño la aprueba y le asigna perfil.

| Perfil | Quién | Qué puede hacer |
|---|---|---|
| **Dueño** | Dueño y dueña (ambos) | Todo. **Exclusivo:** aprobar, cambiar y quitar accesos |
| **Externo** | Felipe u otra persona de confianza | Ve y edita todo igual que los dueños, **salvo accesos** |
| **Pesaje** | Una cuenta de Google para la tablet de la panadería | Solo la pantalla de pesaje. Ve kilos del día, **nunca precios ni ventas** |

- En la tablet, quien pesa **toca su nombre en una lista** (trabajador, hijo, dueño). Sin PIN.
- La tablet puede corregir o anular registros **del mismo día**; después, solo dueños y externo.
- Registrar en una **fecha pasada**: solo dueños y externo.
- La contadora no tiene cuenta: recibe archivos exportados.
- Los dueños se definen en un documento creado **a mano** en la consola de Firebase (nadie puede nombrarse dueño desde la app). Quitar un acceso no borra datos.

## 3. Alcance funcional

1. **Catálogo** (dueños y externo): tipos de pan; cada uno se vende por **kg o por unidad**; los de unidad pueden llevar **peso de referencia**; categoría opcional; activar/desactivar; orden.
2. **Precios netos** con historial de vigencia; la app suma IVA (19 %, configurable). Los cambia quien decida el dueño (dueños y externo).
3. **Trabajadores**: listado editable (nombre, activo).
4. **Pesaje** (tablet): quién, tipo de pan, y **kilos o unidades según el catálogo**; un registro **por canasto**; kilos con 2 decimales; **aviso (no bloqueo) sobre 20 kg**; nota opcional; letra grande. El día es el día calendario chileno (00:00–23:59) según la hora del registro.
5. **Entregas**: hay varias por día según la demanda. Cada canasto pertenece a una entrega numerada del día; la entrega **se arma sola** con los pesajes y los dueños solo revisan. Sin guías, facturas, mermas ni pagos.
6. **Registro general** (dueños y externo): historial con filtros por fecha, pan, trabajador y entrega; correcciones con rastro.
7. **Cierres mensuales**: importar desde Excel los cierres de **enero a octubre de 2026** (totales por pan: kilos o unidades, precio, monto). Noviembre se completa registrando en fecha pasada. Desde ahí, botón **«Cerrar mes»** que deja el mes fijo.
8. **Indicadores**: ventas en pesos por pan, kilos por pan, participación, comparación con el mes anterior y con el mismo mes del año anterior, promedio diario, días de la semana más fuertes, kilos por trabajador, real contra proyectado.
9. **Proyección y metas**: mismo mes del año anterior × factor de crecimiento ajustable (general y por pan) y factor de precio aparte; comparación año 1 contra año 2 mes a mes; la proyección se convierte en metas mensuales con seguimiento.
10. **Exportar a Excel** (dueños y externo): ventas detalladas con neto, IVA, total y cliente.
11. **Respaldos** (dueños y externo): descarga completa y franja de aviso semanal.
12. **Actualización sin reinstalar**, versión visible, aviso de privacidad breve.

**Después de la entrega principal:** costos y margen por pan (Fase 9: ingredientes por receta, gastos del mes, simulador de precio); plan de producción diario.
**Lista de futuros:** insumos (harina, levadura), conexión con balanza, informe para la contadora. **Varios clientes y ventas sueltas:** Fase 11 (planificada el 20-nov-2026).
**Descartado:** asistencia de trabajadores, facturación electrónica.

## 4. Qué se toma de la "app de muestra"

| De la muestra | Uso | Fase |
|---|---|---|
| `index.html`, `sw.js`, `version.js`, `update.js`, `guard.js`, `manifest` | Cáscara, modo sin conexión y actualización. Se renombra y se quita el CDN | 1 |
| `styles.css`, `fonts/` (Barlow, licencia OFL), `js/icons.js` | Sistema de diseño; paleta cálida nueva; CSS dividido en 3 archivos | 1 |
| `tools/bump.js`, `tools/run-tests.js`, pruebas `pwa`, `csp`, `version-unit`, `update-*`, `a11y-audit` | Herramientas y pruebas base | 1 |
| `cloud.js` (solicitud de acceso, aprobación, pantalla de espera, pestaña Equipo) | Cuentas y accesos, adaptado a ingreso con Google y a tres perfiles | 2 |
| `firestore.rules`, `tests/rules-emulator.js`, `tests/fake-remote.js` | Patrón de reglas (todo prohibido salvo lo permitido) y sus pruebas | 2 |
| `backup.js` | Respaldo completo | 5 |
| `js/charts.js`, patrón de `report.js` (copiar, compartir, imprimir) | Gráficos e informes | 7 |
| `plan-ui.js` (carga de Excel con revisión previa) | Solo el patrón de «subir, revisar, confirmar» | 6 |

No se usa: `assign.js`, `plan-import.js`, `compare.js`, `competitions.js`, `app.js` (se toman solo sus utilidades: `ask`, `toast`, estados vacíos y de error).

### Mejoras respecto de la muestra

| Tema | Muestra | Panadería |
|---|---|---|
| Tamaño de archivos | `app.js` 110 KB, `assign.js` 75 KB | Un módulo por pantalla, ≤ ~300 líneas |
| Sincronización | Motor propio (`sync.js` + `reads.js`, cola en localStorage) | **Caché sin conexión del propio SDK de Firestore**: menos código, cola de envíos y tiempo real incluidos. **Decisión confirmada por Felipe** |
| SDK y Excel | Desde CDN | **Alojados dentro de la app** (`vendor/`): abre sin internet y CSP sin orígenes de terceros. El lector de Excel se carga solo al importar o exportar |
| Ingreso | Correo y contraseña | Google, por **redirección de página completa** hecha por la propia app (`core/acceso.js`) y de vuelta al mismo dominio de Firebase Hosting; Firebase recibe el `id_token`. Sin ventanas emergentes, marcos ni scripts de Google (cambio de la Fase 1) |
| Lecturas de la cuota | Lee registros uno a uno | Un día se calcula con sus pesajes (decenas de documentos); **resúmenes por mes** en `cierres` para que los indicadores lean pocos documentos |
| Seguridad | Pendientes detectados en la auditoría | Aplicados desde el inicio (§9) |

## 5. Decisiones técnicas

| # | Decisión |
|---|---|
| T1 | HTML + CSS + JavaScript (módulos ES), sin compilación ni frameworks |
| T2 | Firebase: Authentication (solo Google), Firestore, Hosting, App Check. **Proyecto nuevo** en la cuenta de Google de Felipe. **Solo plan gratuito** (sin Cloud Functions) |
| T3 | Publicación en **Firebase Hosting** (mismo dominio que el ingreso: evita los problemas de Google en iPhone/iPad). Dirección oficial `https://ID.web.app` (la de `firebaseapp.com` redirige). El ingreso es por redirección de página completa (ver §4). Se verifica en la Fase 1 con instalación real (GUIA-FIREBASE.md, paso 9). El código vive en el repositorio público `Panaderia` |
| T4 | Sin conexión: service worker para los archivos + caché persistente de Firestore para los datos. Lo anotado sin internet se envía solo al volver la conexión |
| T5 | ~~Totales por día mantenidos con cada pesaje~~ **Cambio de la Fase 4:** los totales del día se calculan en el equipo con los pesajes del día (unas decenas de documentos), sin guardarlos, para evitar choques entre equipos sin conexión. Los resúmenes de meses se guardan al «Cerrar mes» (`cierres`). Los pesos ($) se calculan en el equipo del dueño con el precio vigente, así la tablet nunca recibe precios |
| T6 | Excel con SheetJS alojado en la app, carga diferida |
| T7 | Gráficos SVG propios (`charts.js` de la muestra) |
| T8 | CLP sin decimales; kilos con 2 decimales; fechas `es-CL`; zona America/Santiago; IVA 19 % configurable |

**Sobre el plan gratuito y la sincronización:** la sincronización automática **no se ve afectada**; es parte de Firestore en el plan gratuito. Lo que no hay son tareas en el servidor: correos, avisos con la app cerrada o respaldos programados. Los límites diarios gratuitos (del orden de 50 000 lecturas y 20 000 escrituras) quedan muy por encima del uso esperado.

## 6. Estructura de carpetas

```
D:\APP Panaderia\            (raíz del repositorio público «Panaderia»)
├─ PLAN.md · ESTADO.md
├─ GUIA-FIREBASE.md          paso a paso de la consola y de la publicación (Fase 1)
├─ firebase.json · firestore.rules · .gitignore
├─ APP\                      la aplicación (lo único que se publica en Hosting)
│  ├─ index.html · manifest.webmanifest · sw.js · version.js · guard.js · firebase-config.js
│  ├─ css\  tokens.css · base.css · componentes.css
│  ├─ js\
│  │  ├─ app.js              arranque, navegación por perfil
│  │  ├─ core\  nube.js (Firebase) · acceso.js · datos.js · modelo.js (cálculo puro)
│  │  │         ui.js · formato.js · iconos.js · graficos.js · actualizar.js
│  │  │         respaldo.js · excel.js · privacidad.js
│  │  └─ pantallas\  ingreso.js · inicio.js (provisional, Fase 1) · pesaje.js · hoy.js · entregas.js · registro.js
│  │                 productos.js · trabajadores.js · accesos.js · cierres.js
│  │                 indicadores.js · proyeccion.js · ajustes.js · mas.js
│  ├─ vendor\                SDK de Firebase y SheetJS (copias locales)
│  └─ icons\ · fonts\
├─ tests\ · tools\ · .github\workflows\
├─ privado\                  NO se sube: cierres en Excel, respaldos, correos y UID
└─ app de muestra\           NO se sube: referencia
```

`.gitignore` desde el primer commit: `privado/`, `app de muestra/`, `.env*`, `serviceAccount*.json`, `*adminsdk*.json`, `*.pem`, `*.key`, `tests/shots/`, `node_modules/`.

## 7. Modelo de datos (Firestore)

| Colección | Contenido | Lee | Escribe |
|---|---|---|---|
| `config/negocio` | `duenos` (lista de UID), `nombre`, `iva` | Con sesión | Solo consola (dueños) y ajustes por dueños |
| `config/respaldo` | Último respaldo descargado: `por`, `quien`, `conteos`, `lecturas`, `en` (Fase 5, para la franja semanal) | Dueños y externo | Dueños y externo (a su nombre); no se borra |
| `solicitudes/{uid}` | `nombre`, `correo`, `creado` de quien pide acceso | Dueños y el solicitante | El solicitante (crear); dueños (borrar) |
| `miembros/{uid}` | `nombre`, `correo`, `perfil` (`externo` o `pesaje`), `activo`, `por`, `en` | Dueños; cada uno el suyo | **Solo dueños** |
| `productos/{id}` | nombre, unidad (`kg`/`un`), pesoRef, categoría, orden, activo | Todos los perfiles | Dueños y externo |
| `precios/{id}` | productoId, clienteId, neto, desde | Dueños y externo (**no** pesaje) | Dueños y externo |
| `trabajadores/{id}` | nombre, activo | Todos | Dueños y externo |
| `clientes/{id}` | nombre (inicial: el supermercado), activo, `tipo` (`regular`/`suelta`, Fase 11) | Dueños y externo; **pesaje desde la Fase 11** (sin montos) | Dueños y externo |
| `pesajes/{id}` | fecha, hora, entregaN, productoId, cantidad, unidad, trabajadorId, nota, anulado, creadoPor, en (un documento por canasto); `clienteId` (Fase 11; sin él = el cliente original) | Todos (pesaje: solo del día) | Pesaje: crear (hoy, o ayer por lo anotado sin conexión), y corregir/anular solo del día; dueños y externo: todo |
| `dias/{fecha}` · `dias/{fecha}_{clienteId}` | entregaN (entrega en curso), por, en. **Los totales no se guardan**: se calculan con los pesajes (Fase 4). Desde la Fase 11, `{fecha}` = cliente original y `{fecha}_{clienteId}` = otro cliente regular | Todos (pesaje: solo hoy) | Pesaje: de a un paso (cerrar o volver a abrir); dueños y externo: cualquier número |
| `cierres/{aaaa-mm}` | `mes`, `origen` (`excel`/`app`), `cerrado`, `iva` (%), `lineas` (por pan: productoId, nombre, unidad, cantidad, precio, neto), `neto`, `ivaMonto` (IVA % × neto del mes), `total`, `kg`, `un`, `por`, `quien`, `en` (+ cliente, archivo y hoja, o canastos y días; constancia de reapertura) (Fase 6) | Dueños y externo | Dueños y externo, solo meses terminados; un mes cerrado no se modifica y en él no se anota ni se corrige; **solo un dueño lo reabre** |
| `proyeccion/{año}` | `anio`, `factor` (crecimiento general, 1,05 = +5 %), `factorPrecio`, `panes` (productoId → factor propio), `metas` (12 montos netos o null), `por`, `quien`, `en` (Fase 7) | Dueños y externo | Dueños y externo, a su nombre; no se borra |
| `insumos/{id}` | `nombre`, `unidad` (`kg`/`l`/`un`), `activo`, `en` (Fase 9) | Dueños y externo (**no** pesaje) | Dueños y externo; no se borra (se desactiva) |
| `preciosInsumo/{insumoId_desde}` | `insumoId`, `formato` (cantidad comprada en su unidad, p. ej. 25), `neto` (precio neto del formato), `desde` (Fase 9) | Dueños y externo | Dueños y externo; se puede quitar |
| `recetas/{productoId_desde}` | `productoId`, `desde`, `items` ([{ insumoId, cantidad }], ≤ 30), `rendimiento` (kg o unidades, según el pan), `nota`, `por`, `en` (Fase 9) | Dueños y externo | Dueños y externo; se puede quitar una versión |
| `gastos/{aaaa-mm}` | `mes`, `items` ([{ nombre, monto }], ≤ 30, pesos enteros netos), `por`, `quien`, `en` (Fase 9) | Dueños y externo | Dueños y externo, también en meses cerrados; no se borra |
| `planes/{fecha}` | `fecha`, `items` ([{ productoId, cantidad, unidad, tandas }], 1 a 60; `tandas` calculadas al guardar con la receta vigente, o `null`), `nota`, `por`, `quien`, `en` (Fase 10) | Dueños y externo; pesaje: **solo el de hoy** | Dueños y externo, solo para hoy o mañana (hora del servidor); se puede quitar |
| `cambios/{id}` | bitácora: tipo (`corregir`/`anular`/`reactivar`), pesajeId, fecha, antes, despues, por, `quien` (nombre de la cuenta, opcional, Fase 5), en | Dueños y externo | Se crea con cada corrección (la tablet, solo de lo del día) |

Reglas: todo lo no permitido queda prohibido; el perfil se comprueba en el servidor; la fecha de un pesaje de la tablet debe ser la del día según la hora del servidor.

## 8. Pantallas

- **Tablet de pesaje:** una sola pantalla, letra grande. Nombre de quien pesa (queda elegido), botones de pan, teclado numérico propio, lista «pesado hoy» con corregir/anular, total de kilos del día, y la entrega en curso con **«Cerrar entrega»** (la siguiente pasa a ser la n.º 2, 3…).
- **Dueños y externo:** menú inferior *Hoy · Entregas · Números · Pesaje · Más* (barra lateral en computador); «Números» reúne los indicadores y la proyección con metas (Fase 7: «El mes» y «Año y metas»). «Más» con submenús: *Catálogo* (productos, precios, trabajadores), *Registros* (registro general, fecha pasada, cierres mensuales), *Datos* (exportar a Excel, respaldo), *Accesos* (solo dueños), *Ajustes* (IVA, aplicación, privacidad).

## 9. Seguridad desde el inicio (del resumen de la auditoría)

- Ingreso solo con Google; sin anónimo ni otros proveedores. Dominios autorizados: solo los del proyecto.
- Reglas cerradas por defecto y probadas con el emulador en cada cambio.
- Clave web restringida por sitio y por API (Identity Toolkit, Token Service, Firestore).
- ~~App Check con reCAPTCHA: primero en modo supervisar, luego obligatorio.~~ **Decisión del 19-nov-2026 (Fase 8): no se usa**; queda preparado para activarlo si hiciera falta (`GUIA-FIREBASE.md`, paso 23.D).
- Alertas de presupuesto (50 %, 90 %, 100 %) y revisión de permisos del proyecto.
- CSP estricta, antimarcos, sin scripts de terceros.
- Repositorio: `.gitignore` ampliado, escaneo de secretos (en la Fase 1: prueba propia `tests/repo-unit.js` en CI + Secret scanning de GitHub; gitleaks queda pendiente hasta fijar su acción por hash), Secret scanning y Push protection activados, acciones fijadas por hash, permisos `contents: read`, pull requests solo de colaboradores.
- Correos y UID nunca en el repositorio (van en `privado/`).

## 10. Fases

Cada fase termina con pruebas en verde, versión subida, `ESTADO.md` actualizado y prueba manual en celular y computador.

### Fase 0 · Planificación — chat 1 ✔

### Fase 1 · Base instalable y publicación — chat 2
- Cáscara, diseño (paleta cálida, nombre «Panadería», íconos), service worker, versión y actualización.
- Proyecto Firebase nuevo, Hosting, repositorio `Panaderia`, `.gitignore`, CI básico.
- **`GUIA-FIREBASE.md`**: paso a paso con cada clic de la consola y de la publicación.
- Ingreso con Google mínimo para **verificar la decisión T3** en iPhone, Android y Windows.
- **Listo cuando:** se instala en los tres, abre en modo avión y el ingreso con Google funciona instalada.

### Fase 2 · Cuentas, perfiles y reglas — chat 3 ✔
- Solicitud de acceso, aprobación y asignación de perfil, quitar acceso, pantalla de espera.
- Reglas de Firestore completas y sus pruebas; caché sin conexión; App Check en modo supervisar; clave restringida.
- **Listo cuando:** la cuenta de pesaje no puede leer precios ni con peticiones directas (probado con el emulador).
- Hecho el 14-nov-2026 (versión 0.2.0). App Check queda preparado y apagado: lo enciende Felipe con `GUIA-FIREBASE.md`, paso 16. La prueba con el emulador corre en GitHub Actions (no se pudo ejecutar desde el chat). Detalle en `ESTADO.md`.

### Fase 3 · Catálogo — chat 4 ✔
- Productos (kg/unidad, peso de referencia, categoría), precios netos con vigencia, trabajadores, cliente inicial, IVA.
- **Listo cuando:** un cambio de precio no altera los montos de días anteriores.
- Hecho el 15-nov-2026 (versión 0.3.0). Cada precio es un documento con su fecha «desde» (`precios/{producto_cliente_fecha}`) y el monto de un día se calcula con el precio vigente ese día. Publicado y verificado por Felipe (paso 18, 16-nov-2026). Detalle en `ESTADO.md`.

### Fase 4 · Pesaje y entregas del día — chat 5 ✔
- Pantalla de la tablet completa, entregas numeradas, totales del día, corrección del mismo día, uso sin conexión.
- **Listo cuando:** registrar un canasto toma 3 toques o menos y lo anotado sin internet aparece en el teléfono del dueño al volver la conexión. *Desde aquí la panadería puede empezar a usarla.*
- Hecho el 16-nov-2026 (versión 0.4.0): pantalla **Pesaje** (tablet) y pestaña **Hoy** (dueños y externo). Un documento por canasto; `dias/{fecha}` guarda solo la entrega en curso; los totales se calculan con los pesajes. Falta que Felipe publique y verifique (`GUIA-FIREBASE.md`, paso 19). Detalle en `ESTADO.md`.

### Fase 5 · Ventas para los dueños — chat 6 ✔
- Hoy, Entregas (revisión), registro general con filtros, fecha pasada, correcciones con bitácora.
- Exportar a Excel (neto, IVA, total, cliente), respaldo y franja de aviso semanal.
- **Listo cuando:** el Excel de un mes cuadra con la suma de sus entregas.
- Hecho (16-nov-2026, versión 0.5.0): pestaña **Entregas**, «＋ Anotar canasto» en **Hoy** (fecha pasada), **Registro general** con filtros y bitácora, **Excel** propio (sin librerías) y **respaldo** con franja semanal. Venta = lo pesado no anulado; un pan sin precio se registra y avisa. Montos por **línea** (un pan en una entrega): todos los totales son sumas de líneas (ESTADO.md, decisiones de la Fase 5).

### Fase 6 · Cierres mensuales — chat 7 ✔
- Importar los Excel de enero a octubre de 2026 (subir, revisar, confirmar; emparejar nombres de pan con el catálogo).
- «Cerrar mes» desde los datos de la app.
- **Requiere:** los archivos de cierre en `privado/`. **Listo cuando:** los 10 meses importados coinciden con los totales de los Excel.

### Fase 7 · Indicadores, proyección y metas — chat 8 ✔
- Los nueve indicadores elegidos; proyección con factores; año 1 contra año 2; metas y seguimiento.
- **Listo cuando:** los totales de indicadores cuadran con cierres y entregas.
- Hecho (18-nov-2026, versión 0.7.0): pestaña **Números** con «El mes» (los nueve indicadores; el mes en curso se compara a su ritmo) y «Año y metas» (año contra año, proyección por pan con crecimiento y precio, metas fijas editables). Meses cerrados = su cierre; los demás = lo de Entregas (ESTADO.md, decisiones de la Fase 7).

### Fase 8 · Cierre y entrega — chat 9 ✔
- Aviso de privacidad, accesibilidad, rendimiento, ~~App Check obligatorio~~ (se decidió no usarlo), revisión final de seguridad, `LEEME.md` y guía breve para la familia.
- Hecho (19-nov-2026, versión 0.8.0): aviso de privacidad (ingreso, espera y Más), Ayuda por perfil en la app y `GUIA-FAMILIA.md` para imprimir, títulos y foco por pantalla y revisión a 320 px, respaldo por año (cuota de lecturas), Diagnóstico con comprobante de App Check, bloqueos y tiempos, cabecera CORP y pruebas de higiene, `LEEME.md`. La revisión de consolas: `GUIA-FIREBASE.md`, paso 23 (ESTADO.md, decisiones de la Fase 8).

### Fase 9 · Costos y margen por pan — chat 10 ✔
Planificada el 20-nov-2026 con las respuestas de Felipe (dos rondas de preguntas). **Hecho (20-nov-2026, versión 0.9.0):** todo lo de abajo, más el primer precio y la primera receta desde el 1 ene 2026 por omisión y el Excel de Entregas siempre sin costos. Verificada por Felipe el 20-nov-2026 (`GUIA-FIREBASE.md`, paso 24: las 6 casillas, emulador en verde). Detalle en `ESTADO.md`.

**Qué se mide**
- **Margen de cada pan** = venta neta − **ingredientes**. El costo de los ingredientes sale de la **receta por tanda** (por kilos de masa). Los envases no entran.
- **Resultado del mes** = venta neta − ingredientes − **gastos del mes** (gas, luz, sueldos, arriendo y otros fijos). Los gastos **no se reparten** entre los panes.
- **Margen % = sobre el precio de venta**: (neto − costo) / neto. Vender a $1.000 lo que cuesta $700 da 30 %.
- Todo es **neto**: los insumos y los gastos con factura se anotan sin IVA (la panadería recupera el IVA de las compras). Los sueldos se anotan por lo que se paga.

**Cómo se carga** (dueños y externo; la tablet no lee nada de costos)
1. **Insumos** (Más → Costos → Insumos): nombre y unidad (`kg`, `l` o `un`). El precio se anota **como dice la factura**: formato de compra (por ejemplo, saco de 25 kg) y precio neto del formato, **con fecha de vigencia**, igual que los precios de venta. La app muestra el $ por kg, litro o unidad. Un insumo no se borra: se desactiva.
2. **Receta** (ficha del pan en Catálogo): ingredientes de **una tanda** con su cantidad (kg o l con hasta 3 decimales, o unidades) y **rendimiento** = kilos de pan horneado que salen (o unidades, si el pan es por unidad). La app muestra la masa total, la merma de horneado (informativa), el costo de la tanda y el **costo por kg o por unidad**. **La receta también tiene fecha de vigencia**: cambiarla crea una versión nueva, y los meses anteriores conservan su costo.
3. **Gastos del mes** (Más → Costos → El mes): líneas con nombre y monto (sugeridas: Gas, Luz, Sueldos, Arriendo, Agua, Transporte, Otros) y el botón «Copiar del mes anterior». Se pueden corregir también en un mes cerrado, porque no tocan las ventas. Queda el registro de quién y cuándo.

**Cálculo** (`core/costos.js`, lógica pura)
- Costo unitario de un pan en un día = Σ (cantidad × precio vigente del insumo ese día) / rendimiento, con la receta vigente ese día. Si falta la receta o el precio de un insumo: «sin costo», no suma, y se avisa qué falta (igual que «sin precio»).
- **Costo de una línea de venta** (un pan en una entrega de un día) = costo unitario de ese día × cantidad, en pesos enteros (`redondearPesos`). Todo total es suma de líneas, igual que el neto, así el Excel cuadra con la pantalla.
- **Meses**: la venta sigue la regla de la Fase 6 (mes cerrado → el cierre; si no → los pesajes). Los ingredientes salen de los pesajes por día. En un mes **importado desde Excel** (sin días) se usa la cantidad de cada pan × el costo vigente el último día del mes, marcado «estimado».

**Dónde se ve**
- **Ficha del pan (Catálogo):** receta vigente con su historial, costo por kg o unidad, precio de hoy, margen en $ y en %, y un **simulador**: «si el precio fuera ___ → margen» y «para ganar ___ % → precio neto (y con IVA)».
- **Más → Costos** (pestaña oculta `costos`, permiso `gestion`), en dos partes: **Insumos** y **El mes** (‹ mes ›: venta, ingredientes, margen por pan con su %, panes sin costo, gastos, resultado y su % de la venta).
- **Excel del mes:** columnas *Costo ingredientes*, *Margen* y *Margen %* en las hojas Ventas y Por pan, y una hoja nueva **Resultado**. Al exportar hay una casilla «Incluir costos y margen» (marcada por omisión), para poder sacar un Excel sin costos si se entrega a otra persona. El de **Entregas** sale siempre sin costos (el de la contadora).
- **Números no cambia** (decisión de Felipe).

**Datos nuevos** (PLAN §7): `insumos`, `preciosInsumo`, `recetas` y `gastos`, con sus reglas y casos en `tests/reglas-casos.js`. Entran también en el respaldo, en el aviso de privacidad («costos de ingredientes y gastos del mes») y en la Ayuda (tema «Costos y margen»).

**Listo cuando:** la receta da el mismo costo por kg que el cálculo a mano; un alza de la harina con fecha nueva no cambia los meses anteriores (y una receta nueva tampoco); en el Excel del mes, la suma de los costos de la hoja Ventas es igual a los ingredientes de Costos → El mes; resultado = venta − ingredientes − gastos; la tablet no puede leer insumos, recetas ni gastos (emulador); las vistas nuevas están en `a11y.js`; la versión 0.9.0 tiene el Diagnóstico con 0 bloqueos.

**Fuera de la fase:** envases, reparto de gastos entre panes, inventario de insumos (lista de futuros), margen en Números y vista del año en Costos (se puede agregar después).
### Fase 10 · Plan de producción diario — chat 11 ✔
Planificada el 20-nov-2026 con las respuestas de Felipe (dos rondas de preguntas). Versión de llegada: **0.10.0**. **Desarrollada el 20-nov-2026** (chat 11); lo que se decidió al desarrollarla está en ESTADO.md («Decisiones de la Fase 10 · desarrollo»). Verificada por Felipe el 20-nov-2026 (`GUIA-FIREBASE.md`, paso 25: las 6 casillas, Diagnóstico con 0 bloqueos y versión 0.10.0, emulador en verde).

**Qué se planifica**
- **Por pan, el total del día** (no por entrega): cuánto se quiere tener pesado de cada pan ese día. Las entregas siguen armándose solas con los pesajes.
- **En kilos o unidades, según el catálogo** (como se pesa). Con la receta vigente de la Fase 9 la app muestra **las tandas**: tandas = cantidad ÷ rendimiento (1 decimal). Un pan sin receta se planifica igual, sin tandas.
- **Para hoy y mañana**: se arma la noche anterior o en la mañana y se puede cambiar durante el día. Los días pasados quedan solo para mirar, con lo que se planificó.
- Lo arman **dueños y externo**. La tablet **ve el plan de hoy** (nunca el de mañana) y no lo cambia.

**Sugerencia** (`core/plan.js`, lógica pura)
- Para cada pan activo: **promedio de lo pesado el mismo día de la semana en las 4 semanas anteriores** (F − 7, − 14, − 21, − 28). Cuentan solo los días **con pesajes** (un día cerrado o festivo no baja el promedio); en un día trabajado, un pan no pesado cuenta 0. Los anulados no cuentan.
- **Redondeo a tandas completas, hacia arriba**, con el rendimiento de la receta vigente ese día (3,4 tandas → 4 tandas, en kilos o unidades). Sin receta: al kilo entero hacia arriba, o a la decena de unidades hacia arriba. Promedio 0 → sin sugerencia (en blanco).
- La hoja muestra la sugerencia al lado de cada campo (con «promedio de N días») y el botón **«Usar sugerencias»** llena los campos vacíos; cada número se corrige antes de guardar.
- Lectura: solo los 4 días de muestra (4 consultas por fecha, una vez al abrir la hoja), no las 4 semanas completas.

**Comparación con lo pesado**
- Por pan del plan: **planificado** (y sus tandas), **pesado** (canastos no anulados del día), **falta** (lo que queda, nunca negativo) y **% de avance** = pesado ÷ plan.
- Estados (solo informan, no bloquean): **bajo 95 %** normal («faltan 18 kg»); **95 % a 110 %** verde, «cumplido»; **sobre 110 %** aviso, «sobre el plan (+ 8 kg)».
- Un pan pesado que no estaba en el plan aparece aparte como **«fuera del plan»**. Totales del día en kg y en unidades por separado.
- Las cantidades salen de los mismos pesajes que «Pesado hoy» y «Hoy»: los totales cuadran con ellos.

**Dónde se ve**
- **Hoy (dueños y externo):** bloque **«Plan del día»** con la comparación por pan, al momento. Botón «Armar plan» (o «Cambiar plan») para el día que se mira si es hoy, y **«Plan de mañana»** (con aviso «sin plan» cuando falta). En un día pasado, el plan y su comparación solo se miran.
- **Hoja «Plan»** (`pantallas/plan.js`): una fila por pan activo en el orden del catálogo, con el campo (kg con 2 decimales o unidades), la sugerencia, las tandas en vivo, «Usar sugerencias», nota opcional y «Quitar plan». En blanco = ese pan no va en el plan.
- **Tablet de pesaje:** con letra grande, **«Plan de hoy»**: por pan, plan (con tandas), pesado y lo que falta, con el mismo verde y el mismo aviso; y en el botón de cada pan, en vez de «kilos», la línea corta **«faltan 18 kg»** (o «✓ cumplido»). Sin plan, la tablet queda como hoy. Nunca muestra precios ni costos.

**Datos nuevos** (PLAN §7): `planes/{AAAA-MM-DD}` = `{ fecha, items: [{ productoId, cantidad, unidad, tandas }] (1 a 60), nota?, por, quien, en }`.
- `tandas` (número o `null`) se **calcula y guarda al armar el plan**: así la tablet ve las tandas sin leer recetas. Si después cambia la receta, el plan ya guardado conserva sus tandas (se recalculan al volver a guardarlo).
- Reglas: **lectura** dueños y externo, todo; tablet, **solo el de hoy** (`esHoy`, como `dias`). **Escritura** (crear, cambiar, quitar) solo dueños y externo, y solo para **hoy o mañana** según la hora del servidor (`esManana`, nueva, con la misma holgura de medianoche que `esHoy`). Forma revisada (lista, unidad `kg`/`un`, cantidad > 0, a nombre de quien guarda, hora del servidor, sin campos de más); cada ítem lo revisa la app.
- `app.js`: escucha `planes/{fecha}` junto con los pesajes del día (`vigilarDia` → `ctx.dia.plan`); ~~el de mañana se lee al abrir su hoja~~ → **al desarrollar:** dueños y externo, mirando hoy, escuchan también el de mañana (un documento, `ctx.dia.planManana`): así Hoy sabe si falta («Plan de mañana: sin plan») y la hoja abre con lo guardado sin otra lectura. Entra en el **respaldo** (por fecha), en el **aviso de privacidad** («plan de producción del día»), en la **Ayuda** (tema «Plan de producción», también en la de la tablet) y en `GUIA-FAMILIA.md`.

**Pruebas:** `plan-unit.js` (sugerencia contra un cálculo a mano de 4 semanas, con un día sin pesajes y un pan no pesado; redondeo a tandas, sin receta, kg y unidades; avance y estados en 94,9 / 95 / 110 / 110,1 %; fuera del plan; tandas guardadas) · `plan-e2e.js` (armar con sugerencias, cambiar durante el día, plan de mañana, Hoy en vivo, tablet con «faltan» y cumplido, externo, día pasado solo lectura) · casos nuevos en `reglas-casos.js` (tablet lee hoy y no mañana ni ayer, ni escribe; gestión escribe hoy y mañana, no ayer ni pasado mañana; forma) · vistas nuevas en `a11y.js` (Hoy con plan, hoja Plan, plan de mañana, tablet con plan, con sus estados en claro y oscuro).

**Listo cuando:** la sugerencia de un pan es igual al cálculo a mano (promedio de los días trabajados, redondeado a tandas); con lo pesado, «falta» y el % cuadran con «Pesado hoy»; el verde aparece desde 95 % y el aviso sobre 110 %; la tablet ve el plan de hoy con tandas y lo que falta, y no puede leer el de mañana ni escribir planes (emulador); un día pasado no se puede cambiar; la versión 0.10.0 tiene el Diagnóstico con 0 bloqueos.

**Fuera de la fase:** plan por entrega, días más allá de mañana, pedido del supermercado, hoja de insumos del día (harina, levadura según las recetas), cumplimiento del mes en Números y plan en el Excel. Quedan como futuros si hacen falta.


### Fase 11 · Varios clientes y ventas sueltas — chat 12
Planificada el 20-nov-2026 con las respuestas de Felipe (dos rondas de preguntas). Versión de llegada: **0.11.0**. Hasta ahora todo lo pesado era venta al supermercado (los pesajes no guardan el cliente; los precios sí, por `clienteId`).

**Qué se agrega**
- **Clientes regulares** nuevos (almacenes, otro supermercado, un casino), cada uno con **su propia lista de precios** con vigencia, igual que el supermercado. Al crear un cliente se puede **copiar los precios de otro** (los vigentes ese día, con la fecha «desde» que se elija; por omisión, hoy) y después ajustar.
- **Ventas sueltas** (esporádicas): un cliente fijo **«Ventas sueltas»** (`tipo: 'suelta'`, uno solo, se activa con un botón en Catálogo) con su propia lista de precios. Cada venta puede llevar **la nota de quién compró** (opcional, el campo `nota` que ya existe). No se crea un cliente por cada compra.
- Catálogo → **«Clientes e IVA»** (antes «Cliente e IVA»): lista de clientes (activos, desactivados), crear, cambiar nombre, desactivar o reactivar (nada se borra), copiar precios. En la ficha de un pan, el precio **por cliente** (el de cada cliente activo con su historial).

**Dónde se anota** (tablet y dueños)
- **Tablet:** arriba del pesaje, **«Para:»** con el cliente elegido (el supermercado viene marcado y la elección queda guardada en el equipo, `localStorage` `pan.cliente`, como quién pesa). Con un solo cliente activo y sin ventas sueltas **la tablet queda igual que hoy**. Con letra grande; si hay más de 3 clientes, se elige en una hoja. Nunca muestra precios.
- **«Ventas sueltas» en la tablet:** aparece como un cliente más; al guardar pide (opcional) **«¿Quién compró?»** y lo deja en la nota.
- **Dueños y externo:** «＋ Anotar canasto» en Hoy pide también el cliente. Al corregir un canasto se puede **cambiar el cliente** (queda en la bitácora: «cliente: Supermercado → Almacén Rosa»).

**Entregas numeradas por cliente**
- Cada cliente regular lleva **su propia numeración** del día: Supermercado n.º 1 y n.º 2, Almacén n.º 1. «Cerrar entrega» (y «Volver a abrir») actúa sobre **la del cliente elegido** («Cerrar entrega n.º 2 de Supermercado»).
- **Ventas sueltas no tienen entregas** (propuesta incluida): cada anotación es **una venta** con su nota; en Hoy, Entregas y el Excel se listan una por una («10:42 · 2 kg hallulla · Sra. Marta»).
- Datos: el supermercado (el cliente **original**) sigue con `dias/{fecha}`; cada otro cliente regular usa `dias/{fecha}_{clienteId}` con la misma forma `{ entregaN, por, en }`. Así lo ya guardado no cambia y la tablet de hoy sigue funcionando durante la actualización.

**Cómo se ve: total del negocio y filtro por cliente**
- **Hoy, Entregas, Registro y Números (El mes):** el total del negocio y un **filtro «Cliente: Todos ▾»**. Con «Todos», las entregas se agrupan por cliente; con uno, solo lo suyo. Con un solo cliente, el filtro no aparece.
- **Números:** indicador nuevo **«Por cliente»** (venta neta y participación de cada cliente en el mes, con su variación contra el mes anterior). **Proyección y metas siguen siendo del negocio entero** (sin metas por cliente).
- **Excel:** la columna «Cliente» de Ventas ya existe y pasa a llevar el de cada línea; hoja nueva **«Por cliente»**; en el Resumen, los clientes del período; en ventas sueltas, una fila por venta con la columna **«Comprador»** (la nota). Al exportar desde Datos, elegir **todos o un cliente** (por si la contadora necesita uno solo). Los costos y el margen de la Fase 9 salen por línea, así que el margen por cliente queda en el Excel sin trabajo extra.
- **Cierre del mes («Cerrar mes»):** un solo cierre por mes con las líneas **por pan y por cliente** (`lineas[].clienteId`, `lineas[].cliente`) y un resumen `clientes: [{ clienteId, cliente, neto, kg, un }]`; el IVA sigue siendo IVA % del neto del mes. Los meses importados desde Excel (ene–oct 2026) quedan **del supermercado** (ya traen `clienteId`). Cierres e Indicadores suman por pan entre clientes.
- **Plan de producción:** sigue siendo el **total del día por pan, de todos los clientes y las ventas sueltas** (lo que se hornea es uno solo). No cambia la sugerencia ni la tablet.
- **Costos y margen:** sin cambios (el costo de un pan no depende del cliente).

**Datos** (PLAN §7)
- `clientes/{id}` = `{ nombre, activo, tipo?: 'regular' | 'suelta', en }` (sin `tipo` = regular). **La tablet pasa a leer `clientes`** (solo nombre, activo y tipo; no hay montos ahí). Reglas: a lo más un cliente `suelta` (lo revisa la app; las reglas revisan la forma).
- `pesajes`: campo nuevo **`clienteId`** (opcional para lo ya guardado; la versión 0.11.0 siempre lo escribe). **Sin `clienteId` = el cliente original** = el cliente **más antiguo, esté activo o no** (no el «activo más antiguo» de hoy: si el supermercado se desactivara, lo antiguo no debe cambiar de dueño). Reglas: si viene, el cliente debe existir y estar activo al crear (`get`, una lectura más; quedan dentro del límite de lecturas de las reglas).
- `dias/{fecha}` o `dias/{fecha}_{clienteId}` (ver arriba): la tablet sigue tocando solo hoy (o ayer) y de a un paso.
- `cierres`: `lineas` con `clienteId` y `cliente` opcionales, `clientes` (lista, ≤ 50) y el límite de `lineas` sube de 200 a 600.
- `core/ventas.js`: una línea = **un pan en una entrega de un cliente en un día** (las sueltas: un canasto = una línea, con su nota); el precio es el **vigente ese día para ese cliente** (`precioVigente(precios, producto, cliente, fecha)`). Función nueva `porCliente`. Todo total sigue siendo suma de líneas.
- Entra en el **respaldo** (sin colecciones nuevas), en el **aviso de privacidad** («el nombre de quien compró, si se anota en una venta suelta; se recomienda solo el nombre de pila»), en la **Ayuda** (temas «Clientes» y «Ventas sueltas», también en la de la tablet) y en `GUIA-FAMILIA.md`.

**Pruebas:** `clientes-unit.js` (líneas por cliente con el precio de cada uno, pesajes antiguos sin `clienteId` = cliente original aunque esté desactivado, entregas por cliente, sueltas una por una, `porCliente`, total = suma por cliente, cierre por cliente que cuadra con Entregas, copiar precios, Excel con «Por cliente» que cuadra con Ventas, documento contra la copia de las reglas) · `clientes-e2e.js` (crear cliente copiando precios, tablet elige cliente y cierra su entrega sin tocar la del supermercado, venta suelta con «¿Quién compró?», Hoy y Entregas con filtro, corregir el cliente con bitácora, Excel de un cliente, cerrar el mes, tablet con un solo cliente igual que antes, externo) · casos nuevos en `reglas-casos.js` (tablet lee clientes pero no precios; pesaje con cliente inexistente o desactivado rechazado; `dias/{fecha}_{cliente}` de a un paso; cierre con líneas por cliente) · las pruebas de Ventas, Cierres, Indicadores y Plan siguen en verde con un solo cliente · vistas nuevas en `a11y.js` (clientes, «Para:» en la tablet, hoja de clientes, «¿Quién compró?», filtros).

**Listo cuando:** con un cliente nuevo y ventas sueltas, cada línea usa el precio de su cliente ese día; el total del día y del mes = la suma de los clientes (Hoy, Entregas, Números, cierre y Excel dicen lo mismo); lo pesado antes de la versión 0.11.0 sigue siendo del supermercado; cerrar la entrega de un cliente no toca la de otro; la tablet nunca ve precios y, con un solo cliente, se ve como antes; el plan de producción cuenta a todos; la versión 0.11.0 tiene el Diagnóstico con 0 bloqueos y el emulador en verde.

**Fuera de la fase:** pedidos de los clientes, plan o metas por cliente, cobros, pagos, guías y facturas por cliente, cambiar el precio en una venta suelta, varios clientes de ventas sueltas y margen por cliente en la pantalla Costos (está en el Excel). Quedan como futuros si hacen falta.

## 11. Organización de los chats

Un chat por fase (tabla anterior). Reglas:

1. Empezar con el texto de inicio de `ESTADO.md`.
2. Leer solo los archivos de la fase (`MAPA.md` dice dónde está cada cosa) y solo las `decisiones/fase-NN.md` de las fases que toca.
3. Editar por partes; no reescribir archivos completos.
4. Al cerrar: pruebas, versión, `ESTADO.md` (corto), `decisiones/fase-NN.md` y `MAPA.md`.
5. Si un chat se alarga o cambia de tema, cerrar y abrir otro. Los arreglos posteriores a una fase van en un chat corto propio.

## 12. Repositorio y autoría

- Repositorio público `Panaderia`. Commits y pull requests con autor **Felipe González** y el correo de su cuenta (el indicado por él), **sin coautoría**, sin `Claude-Session`, sin enlace de sesión ni pie «Generated with».
- Rama `main`; mensajes en español; versión subida en cada publicación (arreglo → Z, función → Y, cambio grande → X).

## 13. Pendientes de información

| Qué | Para |
|---|---|
| Lista de panes: **la crean los dueños en la app**, con su precio (el precio es interno: solo dueños y externo, nunca en la tablet) | Emparejar cierres en Fase 6 |
| Archivos Excel de cierres ene–oct 2026 | Fase 6 |
| ~~Confirmar «Cerrar entrega» en la tablet~~ Confirmado por Felipe (16-nov-2026): quien pesa cierra la entrega con un botón | Fase 4 ✔ |
| Node: no está instalado; Felipe lo instalará (versión LTS desde nodejs.org) antes de la Fase 1 | Fase 1 |
| Cuenta de Google para la tablet y correos de los dueños (no se anotan en el repositorio) | Fase 2 |

## 14. Riesgos

| Riesgo | Mitigación |
|---|---|
| Ingreso con Google falla en la app instalada en iPhone | Hosting en el dominio de Firebase; prueba real en la Fase 1 antes de seguir |
| Tablet sin internet por un rato | Caché sin conexión; indicador de «pendiente de enviar» |
| Borrado o error masivo en la nube | Respaldo semanal con aviso; nada se borra físicamente; bitácora |
| Uso indebido del proyecto Firebase | Clave restringida, reglas, plan Spark sin cobros; App Check preparado para activarlo si hiciera falta |
| Nombres de pan distintos entre los Excel y el catálogo | Paso de emparejar en la importación |
| Archivos que crecen | Límite de ~300 líneas y un archivo por pantalla |
