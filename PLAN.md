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

**Después de la entrega principal:** costos y margen por pan; plan de producción diario.
**Lista de futuros:** insumos (harina, levadura), varios clientes (el modelo ya guarda el cliente), conexión con balanza, informe para la contadora.
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
| `clientes/{id}` | nombre (inicial: el supermercado) | Dueños y externo | Dueños y externo |
| `pesajes/{id}` | fecha, hora, entregaN, productoId, cantidad, unidad, trabajadorId, nota, anulado, creadoPor, en (un documento por canasto) | Todos (pesaje: solo del día) | Pesaje: crear (hoy, o ayer por lo anotado sin conexión), y corregir/anular solo del día; dueños y externo: todo |
| `dias/{fecha}` | entregaN (entrega en curso), por, en. **Los totales no se guardan**: se calculan con los pesajes (Fase 4) | Todos (pesaje: solo hoy) | Pesaje: de a un paso (cerrar o volver a abrir); dueños y externo: cualquier número |
| `cierres/{aaaa-mm}` | `mes`, `origen` (`excel`/`app`), `cerrado`, `iva` (%), `lineas` (por pan: productoId, nombre, unidad, cantidad, precio, neto), `neto`, `ivaMonto` (IVA % × neto del mes), `total`, `kg`, `un`, `por`, `quien`, `en` (+ cliente, archivo y hoja, o canastos y días; constancia de reapertura) (Fase 6) | Dueños y externo | Dueños y externo, solo meses terminados; un mes cerrado no se modifica y en él no se anota ni se corrige; **solo un dueño lo reabre** |
| `proyeccion/{año}` | `anio`, `factor` (crecimiento general, 1,05 = +5 %), `factorPrecio`, `panes` (productoId → factor propio), `metas` (12 montos netos o null), `por`, `quien`, `en` (Fase 7) | Dueños y externo | Dueños y externo, a su nombre; no se borra |
| `cambios/{id}` | bitácora: tipo (`corregir`/`anular`/`reactivar`), pesajeId, fecha, antes, despues, por, `quien` (nombre de la cuenta, opcional, Fase 5), en | Dueños y externo | Se crea con cada corrección (la tablet, solo de lo del día) |

Reglas: todo lo no permitido queda prohibido; el perfil se comprueba en el servidor; la fecha de un pesaje de la tablet debe ser la del día según la hora del servidor.

## 8. Pantallas

- **Tablet de pesaje:** una sola pantalla, letra grande. Nombre de quien pesa (queda elegido), botones de pan, teclado numérico propio, lista «pesado hoy» con corregir/anular, total de kilos del día, y la entrega en curso con **«Cerrar entrega»** (la siguiente pasa a ser la n.º 2, 3…).
- **Dueños y externo:** menú inferior *Hoy · Entregas · Números · Pesaje · Más* (barra lateral en computador); «Números» reúne los indicadores y la proyección con metas (Fase 7: «El mes» y «Año y metas»). «Más» con submenús: *Catálogo* (productos, precios, trabajadores), *Registros* (registro general, fecha pasada, cierres mensuales), *Datos* (exportar a Excel, respaldo), *Accesos* (solo dueños), *Ajustes* (IVA, aplicación, privacidad).

## 9. Seguridad desde el inicio (del resumen de la auditoría)

- Ingreso solo con Google; sin anónimo ni otros proveedores. Dominios autorizados: solo los del proyecto.
- Reglas cerradas por defecto y probadas con el emulador en cada cambio.
- Clave web restringida por sitio y por API (Identity Toolkit, Token Service, Firestore).
- App Check con reCAPTCHA: primero en modo supervisar, luego obligatorio.
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

### Fase 7 · Indicadores, proyección y metas — chat 8 ◐
- Los nueve indicadores elegidos; proyección con factores; año 1 contra año 2; metas y seguimiento.
- **Listo cuando:** los totales de indicadores cuadran con cierres y entregas.
- Hecho (18-nov-2026, versión 0.7.0): pestaña **Números** con «El mes» (los nueve indicadores; el mes en curso se compara a su ritmo) y «Año y metas» (año contra año, proyección por pan con crecimiento y precio, metas fijas editables). Meses cerrados = su cierre; los demás = lo de Entregas (ESTADO.md, decisiones de la Fase 7).

### Fase 8 · Cierre y entrega — chat 9
- Aviso de privacidad, accesibilidad, rendimiento, App Check obligatorio, revisión final de seguridad, `LEEME.md` y guía breve para la familia.

### Fase 9 · Costos y margen por pan — chat 10
### Fase 10 · Plan de producción diario — chat 11

## 11. Organización de los chats

Un chat por fase (tabla anterior). Reglas:

1. Empezar con el texto de inicio de `ESTADO.md`.
2. Leer solo los archivos de la fase (el mapa de `ESTADO.md` dice dónde está cada cosa).
3. Editar por partes; no reescribir archivos completos.
4. Al cerrar: pruebas, versión, `ESTADO.md`.
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
| Uso indebido del proyecto Firebase | Clave restringida, App Check, reglas, alertas de presupuesto |
| Nombres de pan distintos entre los Excel y el catálogo | Paso de emparejar en la importación |
| Archivos que crecen | Límite de ~300 líneas y un archivo por pantalla |
