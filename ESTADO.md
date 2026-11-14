# Estado del proyecto · App Panadería

> Archivo corto. **Todo chat nuevo lo lee primero** y lo actualiza al cerrar. El detalle está en `PLAN.md` (versión 2).

## Avance

| Fase | Contenido | Chat | Estado |
|---|---|---|---|
| 0 | Planificación y cuestionario | 1 | ✔ Hecha (13-nov-2026) |
| 1 | Base instalable, Firebase, Hosting, repositorio, guía paso a paso | 2 | ◐ Código y guía hechos (13-nov-2026). **Falta que Felipe ejecute `GUIA-FIREBASE.md`** y marque la tabla del paso 9 |
| 2 | Cuentas de Google, perfiles, reglas, App Check | 3 | Pendiente |
| 3 | Catálogo: productos, precios, trabajadores | 4 | Pendiente |
| 4 | Pesaje y entregas del día (tablet) | 5 | Pendiente |
| 5 | Ventas para dueños: registro, fecha pasada, Excel, respaldo | 6 | Pendiente |
| 6 | Cierres mensuales (importar ene–oct 2026, cerrar mes) | 7 | Pendiente |
| 7 | Indicadores, proyección y metas | 8 | Pendiente |
| 8 | Cierre y entrega | 9 | Pendiente |
| 9 | Costos y margen por pan | 10 | Después |
| 10 | Plan de producción diario | 11 | Después |

Versión de la app: **0.1.0** (caché 2026.11.13.1) · 7 pruebas, todas bien (13-nov-2026, con Firebase y Google simulados)

## Qué falta para cerrar la Fase 1 (lo hace Felipe, con `GUIA-FIREBASE.md`)

1. Pasos 0–2: Node, Git, `npm install`, `node tools/vendor.js` (descarga el SDK a `APP\vendor\firebase`; **sin esto la app no deja ingresar**).
2. Pasos 3–6: proyecto Firebase, ingreso con Google, direcciones autorizadas, Firestore cerrado. Pegar los 5 valores en `APP\firebase-config.js`.
3. Pasos 7–8: pruebas, prueba en `localhost:5000` y publicación.
4. **Paso 9: verificación T3** en iPhone, Android y Windows (12 casillas). Es lo único que no se pudo probar desde el chat: el ingreso real con Google y la instalación en equipos reales.
5. Pasos 10–11: repositorio `Panaderia` (incluye copiar `tools\plantillas-github` a `.github`) y seguridad (clave web, permisos, GitHub).

Si algo del paso 9 falla: copiar el «Diagnóstico» de la app y abrir un chat corto de arreglo antes de la Fase 2.

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

## Pendientes de información (PLAN §13)

- Excel de cierres: Felipe los dejará en `privado\` cuando los tenga (Fase 6).
- Confirmar «Cerrar entrega» en la tablet (Fase 4) · cuenta de la tablet y correos de dueños (Fase 2; no se anotan en el repositorio).
- Fase 2: App Check, restringir dominios autorizados de Authentication, agregar las API de App Check a la clave web.
- No se portó `a11y-audit.js` de la muestra (no estaba en la lista de lectura de la Fase 1): evaluarlo en la Fase 3, cuando haya formularios.

## Mapa de archivos

| Archivo | Qué contiene |
|---|---|
| `GUIA-FIREBASE.md` | Paso a paso: consola, publicación, instalación, repositorio, seguridad, problemas frecuentes |
| `firebase.json` | Hosting publica `APP\`; cabeceras de seguridad (CSP, antimarcos) y de caché |
| `firestore.rules` | Reglas (Fase 1: todo cerrado) |
| `package.json` · `.gitignore` · `.gitattributes` | Scripts npm, exclusiones, finales de línea |
| `tools\plantillas-github\` | `ci.yml` (pruebas en GitHub Actions) y `dependabot.yml`. **Felipe los copia a `.github\`** (guía, paso 10): el chat no puede escribir en esa carpeta |
| `APP\index.html` | Cáscara: CSP, `#gate` (ingreso), `#appRoot` (app), `#dlg`, `#toast` |
| `APP\sw.js` | Service worker: red primero con respaldo en caché; listas `ASSETS` (**agregar aquí cada archivo nuevo**) y `VENDOR` |
| `APP\version.js` · `APP\guard.js` | Versión (`PAN_VERSION`) · antimarcos |
| `APP\firebase-config.js` | Configuración web del proyecto y `googleClientId` (públicos) |
| `APP\manifest.webmanifest` · `APP\icons\` · `APP\fonts\` | Instalación, íconos (hogaza), Barlow (OFL) |
| `APP\css\tokens.css` | Tipografías y paleta cálida (claro, oscuro, escala de letra) |
| `APP\css\base.css` | Página, títulos, cabecera, barra de navegación, escritorio |
| `APP\css\componentes.css` | Tarjetas, botones, campos, hojas, ingreso, listas, estados, avisos |
| `APP\js\app.js` | Arranque, sesión, pestañas (`TABS`), reparto de acciones, aviso sin conexión |
| `APP\js\core\nube.js` | Único contacto con Firebase (hoy: sesión). Firestore se agrega aquí |
| `APP\js\core\acceso.js` | Ingreso con Google por redirección: `comenzar`, `terminar`, `validar` |
| `APP\js\core\actualizar.js` | Versión, «Buscar actualización», aviso de versión nueva |
| `APP\js\core\ui.js` | `$`, `toast`, `ask` (confirmación), `hoja` / `cerrarHoja` |
| `APP\js\core\formato.js` | `esc`, `clp`, `kilos`, `fechaTexto`, `diaChile`, `iniciales` |
| `APP\js\core\iconos.js` | Íconos SVG, `emptyHTML`, `errorHTML` |
| `APP\js\pantallas\ingreso.js` | Pantalla de ingreso y avisos de configuración |
| `APP\js\pantallas\inicio.js` | Inicio provisional (se reemplaza por las pantallas reales) |
| `APP\js\pantallas\mas.js` | Cuenta, cerrar sesión, diagnóstico, actualización |
| `APP\vendor\firebase\` | SDK local (lo crea `tools/vendor.js`) |
| `tools\servidor.js` · `servir.js` | Servidor local con las cabeceras de Hosting · `node tools/servir.js` |
| `tools\bump.js` · `run-tests.js` · `vendor.js` | Subir versión · correr pruebas · descargar SDK |
| `tests\version-unit.js` · `update-unit.js` · `acceso-unit.js` · `repo-unit.js` | Pruebas sin navegador: versión y caché, actualización, ingreso y formato, higiene del repositorio |
| `tests\pwa.js` · `csp.js` · `ingreso-e2e.js` | Pruebas con navegador: instalación y sin conexión, política de seguridad, ingreso completo |
| `tests\fake-firebase\` | Dobles de prueba de Firebase y de Google |

## Texto para iniciar el próximo chat (copiar y pegar)

```
Proyecto App Panadería, Fase 2. Lee D:\APP Panaderia\ESTADO.md y de PLAN.md solo
las secciones 2, 7, 9 y "Fase 2". De la "app de muestra" lee únicamente:
cloud.js, firestore.rules, tests/rules-emulator.js y tests/fake-remote.js.
De APP lee: js/app.js, js/core/nube.js, js/core/acceso.js, js/pantallas/ingreso.js,
js/pantallas/mas.js, sw.js, firestore.rules y tests/fake-firebase/.
Resultado del paso 9 de GUIA-FIREBASE.md (verificación T3): [pegar aquí la tabla
o el Diagnóstico de cada equipo].
Desarrolla la Fase 2 completa. Al terminar: pruebas, versión 0.2.0 y ESTADO.md actualizado.
```
