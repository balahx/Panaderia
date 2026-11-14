# Estado del proyecto · App Panadería

> Archivo corto. **Todo chat nuevo lo lee primero** y lo actualiza al cerrar. El detalle está en `PLAN.md` (versión 2).

## Avance

| Fase | Contenido | Chat | Estado |
|---|---|---|---|
| 0 | Planificación y cuestionario | 1 | ✔ Hecha (13-nov-2026) |
| 1 | Base instalable, Firebase, Hosting, repositorio, guía paso a paso | 2 | ✔ Hecha. Verificación T3 (paso 9) con las 12 casillas marcadas en iPhone, Android y Windows (14-nov-2026) |
| 2 | Cuentas de Google, perfiles, reglas, App Check | 3 | ◐ Código, reglas, pruebas y guía hechos (14-nov-2026). **Falta que Felipe ejecute `GUIA-FIREBASE.md`, pasos 13 a 17** |
| 3 | Catálogo: productos, precios, trabajadores | 4 | Pendiente |
| 4 | Pesaje y entregas del día (tablet) | 5 | Pendiente |
| 5 | Ventas para dueños: registro, fecha pasada, Excel, respaldo | 6 | Pendiente |
| 6 | Cierres mensuales (importar ene–oct 2026, cerrar mes) | 7 | Pendiente |
| 7 | Indicadores, proyección y metas | 8 | Pendiente |
| 8 | Cierre y entrega (incluye App Check obligatorio) | 9 | Pendiente |
| 9 | Costos y margen por pan | 10 | Después |
| 10 | Plan de producción diario | 11 | Después |

Versión de la app: **0.2.0** (caché 2026.11.14.1) · 10 pruebas, todas bien (14-nov-2026, con Firebase, Google y Firestore simulados)

## Qué falta para cerrar la Fase 2 (lo hace Felipe, con `GUIA-FIREBASE.md`)

1. **Paso 13:** `node tools/vendor.js` (trae `firebase-app-check.js`), `npm test`, `firebase deploy --only hosting,firestore:rules`, y subir a GitHub.
2. **Mirar GitHub → Actions → «Reglas de Firestore (emulador)»**: es la prueba del «Listo cuando» de la fase (la cuenta de pesaje no lee precios), contra las reglas reales. **Desde el chat no se pudo ejecutar** (sin Java ni emulador): `firestore.rules` no se ha compilado nunca todavía. Si `firebase deploy` o ese paso fallan, traer el mensaje al chat.
3. **Paso 14:** crear a mano `config/negocio` con los UID del dueño y la dueña.
4. **Paso 15:** aprobar a Felipe (Externo) y a la tablet (Pesaje) y marcar la tabla de 7 casillas.
5. **Paso 16:** App Check en modo supervisar (reCAPTCHA v3). Tampoco se pudo probar con el reCAPTCHA real; es reversible.
6. **Paso 17:** solo Google como ingreso, dominios autorizados, reglas publicadas, plan Spark.

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
- Letra grande para la panadería: lista con `data-escala="grande"` en `<html>` (los tamaños usan `em`); se activa en la Fase 4.

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
- Confirmar «Cerrar entrega» en la tablet (Fase 4).
- Resultado de los pasos 13 a 17 de la guía (tabla del paso 15 y Diagnóstico con App Check).
- `firebase-tools@14` y `@firebase/rules-unit-testing@5.0.0` quedaron fijados en `ci.yml` y `package.json` sin poder instalarlos desde el chat: si el paso del emulador falla por versiones, ajustarlas.
- Fase 4: validar en las reglas la forma de `dias/{fecha}` (hoy solo exige la hora del servidor) y decidir qué pasa con pesajes sin enviar al cerrar sesión.
- No se portó `a11y-audit.js` de la muestra: evaluarlo en la Fase 3, cuando haya formularios.

## Mapa de archivos

| Archivo | Qué contiene |
|---|---|
| `GUIA-FIREBASE.md` | Paso a paso: consola, publicación, instalación, repositorio, seguridad, problemas frecuentes |
| `firebase.json` | Hosting publica `APP\`; cabeceras de seguridad (CSP, antimarcos) y de caché |
| `firestore.rules` | Reglas por perfil de las 12 colecciones (dueño, externo, pesaje); todo lo demás cerrado |
| `package.json` · `.gitignore` · `.gitattributes` | Scripts npm, exclusiones, finales de línea |
| `tools\plantillas-github\` · `.github\` | `ci.yml` (pruebas y reglas con emulador en GitHub Actions) y `dependabot.yml`. Las dos copias de `ci.yml` deben ser iguales |
| `APP\index.html` | Cáscara: CSP, `#gate` (ingreso), `#appRoot` (app), `#dlg`, `#toast` |
| `APP\sw.js` | Service worker: red primero con respaldo en caché; listas `ASSETS` (**agregar aquí cada archivo nuevo**) y `VENDOR` |
| `APP\version.js` · `APP\guard.js` | Versión (`PAN_VERSION`) · antimarcos |
| `APP\firebase-config.js` | Configuración web del proyecto, `googleClientId` y `appCheckSiteKey` (públicos) |
| `APP\manifest.webmanifest` · `APP\icons\` · `APP\fonts\` | Instalación, íconos (hogaza), Barlow (OFL) |
| `APP\css\tokens.css` | Tipografías y paleta cálida (claro, oscuro, escala de letra) |
| `APP\css\base.css` | Página, títulos, cabecera, barra de navegación, escritorio |
| `APP\css\componentes.css` | Tarjetas, botones, campos, hojas, ingreso, listas, estados, avisos |
| `APP\js\app.js` | Arranque, sesión, acceso por perfil (escuchas en vivo), pestañas (`TABS`, con `oculta` y `permiso`), reparto de acciones, cerrar sesión |
| `APP\js\core\nube.js` | Único contacto con Firebase: sesión, Firestore con caché sin conexión (`vigilarDoc`, `vigilarCol`), accesos, App Check opcional, `estado()` |
| `APP\js\core\perfil.js` | Perfiles, permisos (`puede`) y `resolver` (qué pantalla corresponde). Lógica pura |
| `APP\js\core\acceso.js` | Ingreso con Google por redirección: `comenzar`, `terminar`, `validar` |
| `APP\js\core\actualizar.js` | Versión, «Buscar actualización», aviso de versión nueva |
| `APP\js\core\ui.js` | `$`, `toast`, `ask` (confirmación), `hoja` / `cerrarHoja` |
| `APP\js\core\formato.js` | `esc`, `clp`, `kilos`, `fechaTexto`, `diaChile`, `iniciales` |
| `APP\js\core\iconos.js` | Íconos SVG, `emptyHTML`, `errorHTML` |
| `APP\js\pantallas\ingreso.js` | Pantalla de ingreso y avisos de configuración |
| `APP\js\pantallas\espera.js` | Con sesión y sin perfil: comprobando, pedir acceso, espera, acceso quitado, falta `config/negocio` |
| `APP\js\pantallas\accesos.js` | Solo dueños: solicitudes, aprobar con perfil, cambiar, quitar, devolver; `aviso()` |
| `APP\js\pantallas\inicio.js` | Inicio provisional (se reemplaza por las pantallas reales) |
| `APP\js\pantallas\mas.js` | Cuenta y perfil, entrada a Accesos, diagnóstico (perfil, UID, datos, App Check), actualización |
| `APP\vendor\firebase\` | SDK local (lo crea `tools/vendor.js`) |
| `tools\servidor.js` · `servir.js` | Servidor local con las cabeceras de Hosting · `node tools/servir.js` |
| `tools\bump.js` · `run-tests.js` · `vendor.js` | Subir versión · correr pruebas · descargar SDK (app, auth, firestore, app-check) |
| `tools\appcheck.js` | `activar` / `desactivar` / `estado`: abre o cierra la política de contenido para reCAPTCHA en `index.html` y `firebase.json` |
| `tests\version-unit.js` · `update-unit.js` · `acceso-unit.js` · `repo-unit.js` | Pruebas sin navegador: versión y caché, actualización, ingreso y formato, higiene del repositorio |
| `tests\perfil-unit.js` · `reglas-unit.js` | Sin navegador: perfiles y pantallas de acceso · reglas contra la copia a mano |
| `tests\reglas-casos.js` · `rules-emulator.js` | Casos de reglas compartidos · prueba contra las reglas reales con el emulador (CI o `npm run reglas`) |
| `tests\pwa.js` · `csp.js` · `ingreso-e2e.js` · `accesos-e2e.js` | Con navegador: instalación y sin conexión, política de seguridad, ingreso completo, accesos de punta a punta |
| `tests\fake-firebase\` | Dobles de prueba de Firebase, Google, Firestore (`window.__fakeDb`), App Check y la copia a mano de las reglas (`reglas.mjs`) |

## Texto para iniciar el próximo chat (copiar y pegar)

```
Proyecto App Panadería, Fase 3. Lee D:\APP Panaderia\ESTADO.md y de PLAN.md solo
las secciones 3, 7, 8 y "Fase 3". De la "app de muestra" lee únicamente:
tests/a11y-audit.js (y solo si hace falta, la parte de formularios de app.js).
De APP lee: js/app.js, js/core/nube.js, js/core/perfil.js, js/core/ui.js, js/core/formato.js,
js/pantallas/accesos.js, js/pantallas/inicio.js, css/componentes.css, firestore.rules (bloque Catálogo),
tests/reglas-casos.js y tests/fake-firebase/firebase-firestore.js.
Resultado de los pasos 13 a 17 de GUIA-FIREBASE.md: [pegar la tabla del paso 15, el Diagnóstico
de un equipo y si el paso «Reglas de Firestore (emulador)» de GitHub Actions quedó en verde o los ✗].
Desarrolla la Fase 3 completa. Al terminar: pruebas, versión 0.3.0 y ESTADO.md actualizado.
```
