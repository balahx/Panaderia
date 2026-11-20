# Panadería · app de pesaje, entregas y ventas

App web instalable (PWA) para una panadería familiar pequeña que fabrica pan y lo entrega a un supermercado. Se instala en iPhone, Android, iPad, tablet y Windows, funciona **con y sin internet**, y guarda los datos en Firebase (plan gratuito).

- **En la panadería**, una tablet registra cada canasto que se pesa: pan, kilos o unidades, quién pesó y la entrega. Letra grande, tres toques por canasto, sin precios a la vista.
- **Los dueños** (y una persona externa de confianza) ven el día en vivo, las entregas y la venta de cada mes con neto, IVA y total, el registro de correcciones, los cierres mensuales, los indicadores, la proyección y las metas, y los **costos y el margen de cada pan** (receta por tanda, precios de insumos, gastos del mes y resultado, con un simulador de precio); descargan el Excel para la contadora y el respaldo semanal.

Versión actual: ver `APP/version.js` (o **Más → Diagnóstico** en la app).

## Perfiles

| Perfil | Quién | Qué puede hacer |
|---|---|---|
| Dueño | Dueño y dueña | Todo, y es el único que aprueba, cambia o quita accesos |
| Externo | Persona de confianza | Todo, salvo los accesos |
| Pesaje | La cuenta de Google de la tablet | Solo pesar, y corregir lo del mismo día. Nunca ve precios, ventas ni costos |

Se entra solo con cuenta de Google. Quien entra por primera vez pide acceso y un dueño lo aprueba. Los dueños se definen a mano en la consola de Firebase (`config/negocio`): nadie puede nombrarse dueño desde la app.

## Cómo está hecha

- **Sin compilación ni dependencias en la app:** HTML, CSS y módulos de JavaScript en `APP/`, un archivo por pantalla (`APP/js/pantallas/`) y la lógica pura aparte (`APP/js/core/`), para que cada actualización cambie solo lo necesario.
- **Firebase** (Authentication con Google, Cloud Firestore con su copia sin conexión y Hosting; App Check queda preparado pero no se usa). El SDK está **dentro** de la app (`APP/vendor/firebase/`, con su huella SHA-256): la app no carga nada de otros sitios.
- **Excel propio** (escritor y lector `.xlsx` sin librerías) para las ventas, los cierres y la plantilla de importación.
- **Service worker** (`APP/sw.js`): abre sin conexión; red primero, con espera máxima de 3 s.

| Carpeta o archivo | Contenido |
|---|---|
| `APP/` | La app que se publica (Firebase Hosting publica solo esta carpeta) |
| `firestore.rules` | Reglas del servidor: quién lee y escribe qué, y la forma de cada dato. **Lo que decide es el servidor**, no la app |
| `firebase.json` | Hosting y cabeceras de seguridad |
| `tests/` | Pruebas (Node y Playwright) con Firebase, Google y Firestore simulados, y los casos de reglas para el emulador |
| `tools/` | Servidor local, subir versión, correr pruebas, descargar el SDK, activar App Check (si algún día se usa) |
| `PLAN.md` · `ESTADO.md` | El plan completo y el avance (lo lee cada chat de desarrollo) |
| `GUIA-FIREBASE.md` | Paso a paso de la consola, la publicación y la verificación de cada versión |
| `GUIA-FAMILIA.md` | Guía breve para la familia (para imprimir). La misma está en la app: **Más → Ayuda** |

## Trabajar en el computador

Requiere Node 20 o más nuevo y Git.

```
npm install                 instala Playwright (solo para las pruebas)
npx playwright install chromium
node tools/vendor.js        descarga el SDK de Firebase dentro de la app (una vez)
npm run servir              abre la app en http://localhost:5000
npm test                    todas las pruebas (unos 2 minutos)
npm run reglas              las reglas contra el emulador de Firebase (necesita Java; también corre en GitHub Actions)
```

**Publicar una versión:** `npm run funcion` (o `npm run arreglo`) sube la versión, `npm test`, subir a GitHub y esperar el verde de **Actions**, y luego `firebase deploy --only hosting` (más `,firestore:rules` si cambiaron las reglas). Detalle en `GUIA-FIREBASE.md`, paso 12.

## Seguridad

Revisión final de la Fase 8 (19-nov-2026), a partir de la auditoría de la app de muestra:

| Medida | Dónde se comprueba |
|---|---|
| Ingreso solo con Google, por redirección propia (sin ventanas emergentes, marcos ni scripts de Google); `state` y `nonce` al azar; el token se borra de la dirección | `core/acceso.js` · `tests/acceso-unit.js`, `ingreso-e2e.js`, `repo-unit.js` |
| Reglas cerradas por defecto, por perfil y con la forma de cada dato; la tablet solo lee lo de hoy y nunca precios | `firestore.rules` · `tests/reglas-casos.js` (emulador en cada cambio) |
| App Check con reCAPTCHA v3: **preparado y apagado** (decisión del 19-nov-2026); se activa en unos 30 minutos si hiciera falta | `core/nube.js`, `tools/appcheck.js` · `tests/accesos-e2e.js`, `privacidad-e2e.js` · `GUIA-FIREBASE.md`, pasos 16 y 23.D |
| Política de contenido estricta (`script-src 'self'`, sin `unsafe-inline`, sin marcos), antimarcos, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP` y `CORP` | `index.html`, `firebase.json` · `tests/csp.js` |
| Sin claves secretas, correos ni UID en el repositorio; `.gitignore` ampliado | `tests/repo-unit.js` · Secret scanning y Push protection de GitHub |
| GitHub Actions con permisos de solo lectura, acciones fijadas por hash, sin `pull_request_target` ni secretos; Dependabot | `.github/` · `tests/repo-unit.js` |
| Clave web restringida por sitio y por API; IAM revisado; plan Spark (no puede generar cobros) | Consola (pasos 11, 17 y 23) |
| Al cerrar sesión se borra la copia de los datos del equipo (avisa si hay canastos sin enviar) | `core/nube.js`, `app.js` |

La clave web de Firebase (`APP/firebase-config.js`) **es pública por diseño**: identifica el proyecto. La protección está en las reglas y en la restricción de la clave. La clave **secreta** de reCAPTCHA va solo en la consola de Firebase.

**Riesgo residual conocido:** cualquier cuenta de Google puede ingresar y crear una solicitud de acceso (una por cuenta) y leer quiénes son los dueños (sus identificadores, que por sí solos no dan acceso). Sin App Check, alguien con un programa propio podría además gastar la cuota diaria de lecturas y detener la app hasta el día siguiente (sin cobros: plan Spark). Si pasara, se activa App Check (`GUIA-FIREBASE.md`, paso 23.D).

## Privacidad

La app muestra un aviso breve (**ingreso → Aviso de privacidad**, o **Más → Aviso de privacidad**): usa nombre, correo e identificador de la cuenta de Google, el nombre de quien pesa y lo pesado; los datos están en Firebase (Google), no se venden ni se comparten, no hay publicidad ni medición de uso. El texto está en `APP/js/pantallas/privacidad.js`; si cambia lo que la app guarda, hay que actualizarlo.

## Consumo del plan gratuito

Cuota diaria de Cloud Firestore en el plan Spark: 50 mil lecturas, 20 mil escrituras y 20 mil borrados, y 1 GB guardado. Con unas 40 canastas al día:

| Uso | Lecturas aproximadas |
|---|---|
| La tablet un día completo | Unos cientos |
| Abrir **Entregas** o **Números** de un mes sin cerrar | Una por canasto del mes (hasta ~1.200) |
| Un mes **cerrado** en Entregas, Números o el año | Casi nada (usa el cierre) |
| Costos (insumos, sus precios y recetas) | Unas decenas al abrir la app (dueños y externo); **El mes** lee los canastos del mes, como Entregas |
| Respaldo semanal (por omisión, del año actual) | Hasta ~15 mil a fin de año |
| Respaldo de **todos los años** | ~15 mil más por cada año: usar solo de vez en cuando |

Las escrituras son unas 40 a 100 al día y lo guardado crece unos 10 MB al año. **Cerrar cada mes** (Entregas → «Cerrar …», desde el día 1 del mes siguiente) mantiene las lecturas bajas.

## Mantención

- **Cada mes:** cerrar el mes anterior, anotar sus gastos (**Más → Costos y margen → El mes**) y descargar el Excel para la contadora (el de **Entregas**, que sale sin costos).
- **Cuando sube un insumo o cambia una receta:** anotarlo con la fecha desde la que rige (los meses anteriores no cambian).
- **Cada semana:** descargar el respaldo (la app lo recuerda con una franja) y guardarlo fuera del computador, en un lugar privado.
- **Cada tanto:** revisar **Más → Accesos** (quitar a quien ya no corresponde) y aceptar los pull requests de Dependabot (acciones de GitHub) si **Actions** queda en verde.
- **SDK de Firebase:** fijado en `tools/vendor.js`. Para actualizarlo: `node tools/vendor.js X.Y.Z`, `npm test`, revisar en `GUIA-FIREBASE.md` y publicar como un arreglo.
- **Si algo falla:** en el equipo con el problema, **Más → Diagnóstico de instalación → Copiar**, y traerlo al chat de desarrollo.

## Créditos

Desarrollo: Felipe González. Tipografía Barlow (SIL Open Font License, `APP/fonts/OFL-Barlow.txt`). Uso exclusivo de la panadería.
