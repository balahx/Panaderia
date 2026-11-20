# Guía paso a paso · Firebase, publicación y repositorio

> App Panadería (pasos 0–12: Fase 1 · pasos 13–17: Fase 2 · paso 18: Fase 3 · paso 19: Fase 4 · paso 20: Fase 5 · paso 21: Fase 6 · paso 22: Fase 7 · paso 23: Fase 8). Sigue los pasos **en orden**; cada uno dice qué debes ver al terminar.
> Tiempo estimado: 60 a 90 minutos la primera vez.
> Los nombres de botones están en español; entre paréntesis va el nombre en inglés por si tu consola aparece en ese idioma. Google cambia a veces el texto de un botón: si no lo encuentras igual, busca el más parecido.

**Antes de empezar, anota aquí tu ID de proyecto** (lo obtienes en el paso 3): `panaderia-e2871`
En toda la guía, donde diga `ID`, escribe ese valor. La dirección de la app será `https://ID.web.app`.

| Paso | Qué se hace | Dónde |
|---|---|---|
| 0 | Requisitos: Node, Git, cuentas | Computador |
| 1 | Instalar las herramientas del proyecto | Terminal |
| 2 | Descargar el SDK de Firebase dentro de la app | Terminal |
| 3 | Crear el proyecto Firebase y la app web | Consola de Firebase |
| 4 | Activar el ingreso con Google | Consola de Firebase |
| 5 | Autorizar la dirección de la app en Google | Consola de Google Cloud |
| 6 | Crear la base de datos (cerrada) | Consola de Firebase |
| 7 | Probar en el computador | Terminal y navegador |
| 8 | Publicar en Firebase Hosting | Terminal |
| 9 | Instalar y verificar en iPhone, Android y Windows | Los tres equipos |
| 10 | Subir el código al repositorio `Panaderia` | Terminal y GitHub |
| 11 | Seguridad: clave web, permisos, GitHub | Consolas |
| 12 | Cómo publicar una versión nueva (para más adelante) | Terminal |
| 13 | **Fase 2:** publicar la versión 0.2.0 y las reglas por perfil | Terminal |
| 14 | Definir a los dueños (`config/negocio`) | Consola de Firebase |
| 15 | Dar los accesos (externo y tablet) y verificar | La app, en cada equipo |
| 16 | App Check en modo supervisar (**opcional: no se usa**, decisión del 19-nov-2026; ver paso 23.D) | reCAPTCHA, consola de Firebase y terminal |
| 17 | Cierre de seguridad de la Fase 2 | Consolas |
| 18 | **Fase 3:** publicar la versión 0.3.0 (catálogo) y cargar productos, precios y trabajadores | Terminal y la app |
| 19 | **Fase 4:** publicar la versión 0.4.0 (pesaje y entregas) y empezar a usar la tablet | Terminal, la tablet y el teléfono del dueño |
| 20 | **Fase 5:** publicar la versión 0.5.0 (ventas, registro, fecha pasada, Excel y respaldo) | Terminal, el teléfono del dueño y el computador |
| 21 | **Fase 6:** publicar la versión 0.6.0 (cierres mensuales) e importar enero a octubre | Terminal y el computador |
| 22 | **Fase 7:** publicar la versión 0.7.0 (indicadores, proyección y metas) | Terminal, el computador y el teléfono del dueño |
| 23 | **Fase 8:** publicar la versión 0.8.0 (privacidad, ayuda, respaldo por año) y revisión final de seguridad | Terminal, cada equipo y consolas |

---

## Paso 0 · Requisitos

1. **Node.js** (versión 20 o superior, recomendada la LTS): descárgalo de nodejs.org e instálalo con las opciones por defecto.
2. **Git para Windows**: descárgalo de git-scm.com e instálalo con las opciones por defecto.
3. Una **cuenta de Google** (la tuya, dueña del proyecto) y una **cuenta de GitHub**.
4. Abre la terminal **Símbolo del sistema** (tecla Windows, escribe `cmd`, Enter). Usa `cmd` y no PowerShell: PowerShell suele bloquear los comandos `npm` y `firebase`.
5. Entra a la carpeta del proyecto y comprueba las versiones:

```
D:
cd "D:\APP Panaderia"
node -v
git --version
```

**Listo cuando:** `node -v` muestra `v20` o mayor y `git --version` muestra un número.

> Todos los comandos de esta guía se escriben en esa terminal, parado en `D:\APP Panaderia`.

## Paso 1 · Instalar las herramientas del proyecto

```
npm install
npx playwright install chromium
npm install -g firebase-tools
firebase --version
```

- `npm install` crea la carpeta `node_modules` (no se sube al repositorio) y el archivo `package-lock.json` (sí se sube).
- Playwright es el navegador que usan las pruebas automáticas.

**Listo cuando:** `firebase --version` muestra un número.

## Paso 2 · Descargar el SDK de Firebase dentro de la app

La app no carga nada desde otros sitios: el SDK de Firebase va copiado dentro de ella.

```
node tools/vendor.js
```

**Listo cuando:** aparecen tres líneas con ✓ y el mensaje «SDK de Firebase … guardado en APP/vendor/firebase». En esa carpeta quedan `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js` y `VERSION.json`.

> Si dice que no pudo descargar, revisa tu conexión y repite el comando.

## Paso 3 · Crear el proyecto Firebase y la app web

1. Entra a **console.firebase.google.com** con tu cuenta de Google.
2. Pulsa **Crear un proyecto** (Create a project).
3. Nombre del proyecto: `Panaderia`. Debajo del nombre aparece el **ID del proyecto** (algo como `panaderia-1a2b3`). Puedes editarlo con el lápiz; **no se puede cambiar después**. Anótalo arriba de esta guía.
4. Si pregunta por **Gemini** o por **Google Analytics**, desactívalos (no se usan). Pulsa **Crear proyecto** y luego **Continuar**.
5. Comprueba el plan: abajo a la izquierda debe decir **Spark · Sin costo**. No lo cambies.
6. En la página principal del proyecto pulsa el ícono **Web** (`</>`) para agregar una app.
7. Apodo de la app: `Panadería`. Marca **«Configurar también Firebase Hosting»** y pulsa **Registrar app**.
8. Aparece un bloque de código con `const firebaseConfig = { … }`. **Déjalo abierto**: necesitas cuatro valores. (Si lo cierras: engranaje ⚙ → **Configuración del proyecto** → pestaña **General** → **Tus apps**.)
9. Abre el archivo `D:\APP Panaderia\APP\firebase-config.js` con el Bloc de notas y reemplaza los textos `PEGAR…`:

| En `firebase-config.js` | Valor de la consola |
|---|---|
| `apiKey` | `apiKey` |
| `authDomain` | `authDomain` (es `ID.firebaseapp.com`) |
| `projectId` | `projectId` |
| `appId` | `appId` |

Deja las comillas simples. `googleClientId` se llena en el paso 4. Guarda el archivo.

10. En la consola pulsa **Siguiente** hasta **Ir a la consola** (los comandos que muestra se hacen en el paso 8).

**Listo cuando:** `firebase-config.js` tiene tus cuatro valores y ya no dice `PEGAR` en ellos.

> Estos valores **no son secretos**: van en toda app web y por eso pueden estar en el repositorio público. La protección está en las reglas de la base de datos (paso 6), en la restricción de la clave (paso 11) y en App Check (Fase 2).

## Paso 4 · Activar el ingreso con Google

1. En el menú de la izquierda: **Compilación → Authentication** (Build → Authentication). Pulsa **Comenzar** (Get started).
2. Pestaña **Método de acceso** (Sign-in method). En la lista de proveedores elige **Google**.
3. Activa el interruptor **Habilitar** (Enable).
4. **Nombre público del proyecto**: `Panadería`. **Correo de asistencia**: elige el tuyo. Pulsa **Guardar**.
5. Vuelve a abrir el proveedor **Google** (clic sobre la fila) y despliega **Configuración del SDK web** (Web SDK configuration).
6. Copia el **ID de cliente web** (termina en `.apps.googleusercontent.com`). El «secreto de cliente» **no se copia ni se usa**.
7. Pégalo en `APP\firebase-config.js`, en `googleClientId`, entre las comillas. Guarda.
8. Revisa que **no haya ningún otro proveedor activado** (ni correo y contraseña, ni anónimo).

**Listo cuando:** en la lista, Google aparece como **Habilitado** y es el único; `firebase-config.js` ya no contiene ningún `PEGAR`.

## Paso 5 · Autorizar la dirección de la app en Google

La app envía a la persona a la página de Google y Google la devuelve a la app. Google solo devuelve a direcciones que tú autorices.

1. Entra a **console.cloud.google.com** con la misma cuenta.
2. Arriba, en el selector de proyectos, elige **Panaderia** (el mismo ID).
3. Menú ☰ → **APIs y servicios → Credenciales** (APIs & Services → Credentials). En algunas cuentas esta sección se llama **Google Auth Platform → Clientes**.
4. En **ID de clientes OAuth 2.0** abre el que se llama **Web client (auto created by Google Service)**. Comprueba que su ID de cliente es el mismo que pegaste en el paso 4.
5. En **URIs de redireccionamiento autorizados** (Authorized redirect URIs) pulsa **Agregar URI** y agrega estas dos, **exactamente así, con la barra final**:

```
https://ID.web.app/
http://localhost:5000/
```

6. No borres las que ya estaban. Pulsa **Guardar**.

**Listo cuando:** las dos direcciones aparecen en la lista. Google puede tardar unos minutos en aplicarlas.

## Paso 6 · Crear la base de datos (cerrada)

Aún no se guardan datos (eso empieza en la Fase 2), pero se deja creada y **cerrada**.

1. Consola de Firebase → **Compilación → Firestore Database** → **Crear base de datos**.
2. Edición: **Standard**. ID de la base de datos: déjalo como está, `(default)`.
3. **Ubicación**: `southamerica-west1 (Santiago)`. Si no aparece, `southamerica-east1 (São Paulo)`. **No se puede cambiar después.**
4. Reglas: **Comenzar en modo de producción** (Start in production mode). **Nunca «modo de prueba»**: deja la base abierta a cualquiera.
5. Pulsa **Crear**.

**Listo cuando:** se abre la pestaña **Datos** vacía.

## Paso 7 · Probar en el computador

1. Corre las pruebas automáticas:

```
node tools/run-tests.js
```

**Debe terminar con:** `7 pruebas … todas bien`.

2. Abre la app en tu computador:

```
node tools/servir.js
```

3. En Chrome o Edge entra a **http://localhost:5000** (así, con `localhost`, no con números).
4. Pulsa **Ingresar con Google**, elige tu cuenta. Debes volver a la app y ver **«Hola, tu nombre»**.
5. Para detener el servidor: en la terminal, `Ctrl + C`.

**Listo cuando:** ingresaste con Google en `localhost:5000`. Si algo falla, mira «Problemas frecuentes» al final.

## Paso 8 · Publicar en Firebase Hosting

1. Conecta la terminal con tu cuenta (abre el navegador para que aceptes):

```
firebase login
```

2. Indica qué proyecto usa esta carpeta. Elige tu proyecto de la lista y, cuando pida un alias, escribe `default`:

```
firebase use --add
```

Esto crea el archivo `.firebaserc` (se sube al repositorio; solo contiene el ID).

3. Publica la app y las reglas cerradas:

```
firebase deploy --only hosting,firestore:rules
```

> **No uses `firebase init`**: reescribiría `firebase.json` y `firestore.rules`, que ya vienen preparados.

**Listo cuando:** termina con `Deploy complete!` y muestra `Hosting URL: https://ID.web.app`.

4. Abre `https://ID.web.app` en tu computador e ingresa con Google.
5. Comprueba que las reglas quedaron cerradas: Consola de Firebase → Firestore Database → pestaña **Reglas**. Debe decir `allow read, write: if false;`.

> La dirección `https://ID.firebaseapp.com` también existe; la app envía sola a `web.app`, que es la dirección oficial.

## Paso 9 · Instalar y verificar en iPhone, Android y Windows

Esta es la verificación de la **decisión T3** del plan. Hazla en los tres equipos.

**Instalar**

| Equipo | Cómo |
|---|---|
| iPhone / iPad | Abrir `https://ID.web.app` en **Safari** → botón **Compartir** → **Agregar a inicio** (Add to Home Screen) |
| Android | Abrir en **Chrome** → menú ⋮ → **Instalar app** (o «Agregar a pantalla principal») |
| Windows | Abrir en **Chrome** o **Edge** → ícono de instalar al final de la barra de direcciones (o menú ⋮ → **Instalar Panadería**) |

**Verificar, en cada equipo y con la app instalada (abierta desde su ícono)**

1. Pulsa **Ingresar con Google** y entra. Debe volver a la app instalada, no quedarse en el navegador.
2. Cierra la app del todo y ábrela otra vez (así queda lista la copia sin conexión).
3. Activa el **modo avión** y abre la app: debe abrir, con tu sesión, y mostrar el aviso «Sin conexión».
4. Quita el modo avión. Ve a **Más → Diagnóstico de instalación** y revisa: Modo **Instalada**, Copia sin conexión **Lista**, Sesión con tu correo, Bloqueos de seguridad **0**. Con **Copiar** puedes guardar el resultado.

| Verificación | iPhone | Android | Windows |
|---|---|---|---|
| Se instala y abre desde su ícono | ✓ | ✓ | ✓ |
| Ingreso con Google funciona instalada | ✓ | ✓ | ✓ |
| Abre en modo avión con la sesión | ✓ | ✓ | ✓ |
| Diagnóstico: Instalada · Lista · 0 bloqueos | ✓ | ✓ | ✓ |

**Listo cuando:** las doce casillas están marcadas. Si alguna falla, anota el equipo y qué pasó (o copia el Diagnóstico) y llévalo al próximo chat: la Fase 1 no se cierra hasta resolverlo.

## Paso 10 · Subir el código al repositorio `Panaderia`

1. En **github.com** → **New repository**. Nombre: `Panaderia`. Visibilidad: **Public**. **No marques** README, .gitignore ni licencia. Pulsa **Create repository**.
2. Copia a su lugar los dos archivos de GitHub (pruebas automáticas y Dependabot). Vienen como plantillas en `tools\plantillas-github` porque el chat no puede escribir dentro de la carpeta `.github`:

```
mkdir .github\workflows
copy tools\plantillas-github\ci.yml .github\workflows\ci.yml
copy tools\plantillas-github\dependabot.yml .github\dependabot.yml
```

3. Prepara el repositorio local (cambia `TU_CORREO`; el correo queda visible en un repositorio público: si prefieres ocultarlo, usa el correo `…@users.noreply.github.com` que GitHub muestra en Settings → Emails):

```
git init -b main
git config user.name "Felipe González"
git config user.email "TU_CORREO"
git add .
git status
```

4. **Revisa la lista de `git status` antes de seguir.** No deben aparecer `privado/`, `app de muestra/` ni `node_modules/`. Sí deben aparecer `APP/vendor/firebase/…`, `.github/workflows/ci.yml`, `package-lock.json` y `.firebaserc`.
5. Si la lista está bien (cambia `TU_USUARIO`):

```
git commit -m "Fase 1: base instalable, ingreso con Google y publicación (0.1.0)"
git remote add origin https://github.com/Felipe González/Panaderia.git
git push -u origin main
```

6. En GitHub, pestaña **Actions**: la ejecución **Pruebas** debe terminar con ✓ verde (tarda unos minutos).

**Listo cuando:** el código está en GitHub y las pruebas pasan allí.

## Paso 11 · Seguridad

Hazlo **después** de comprobar que el ingreso funciona (pasos 8 y 9), así si algo deja de funcionar sabrás que fue por este paso.

**A. Restringir la clave web** (console.cloud.google.com → APIs y servicios → Credenciales)

1. En **Claves de API** abre **Browser key (auto created by Firebase)**.
2. **Restricciones de aplicaciones** → **Sitios web**. Agrega:

```
https://ID.web.app/*
https://ID.firebaseapp.com/*
http://localhost:5000/*
```

3. **Restricciones de API** → **Restringir clave** y deja marcadas solo: **Identity Toolkit API**, **Token Service API** y **Cloud Firestore API**. (En la Fase 2 se agregarán las de App Check.)
4. **Guardar**. Espera 5 minutos, abre `https://ID.web.app`, cierra sesión y vuelve a ingresar. Si no deja ingresar, vuelve a esta pantalla, elige «No restringir clave» en las API, guarda y avisa en el próximo chat.

**B. Permisos del proyecto** (console.cloud.google.com → IAM y administración → IAM)

- Debe figurar solo tu cuenta como **Propietario**, más las cuentas de servicio que crea Google. Si hay alguien más que no reconoces, quítalo.

**C. Repositorio en GitHub** (pestaña **Settings** del repositorio)

1. **Advanced Security** (o «Code security»): activa **Secret scanning** y **Push protection**. Activa también **Dependabot alerts**.
2. **Actions → General → Fork pull request workflows**: elige **Require approval for all external contributors**.
3. **Actions → General → Workflow permissions**: **Read repository contents permission**.
4. **Collaborators**: solo tú.

**D. Lo que sigue en la Fase 2 (pasos 13 a 17):** perfiles y reglas por perfil, App Check con reCAPTCHA y revisión de los dominios autorizados de Authentication. El plan gratuito (Spark) no puede generar cobros, así que las alertas de presupuesto solo aplican si algún día se cambia de plan.

## Paso 12 · Cómo publicar una versión nueva

Cada vez que cambie el código (lo normal es que lo haga el chat de cada fase):

```
node tools/bump.js fix
node tools/run-tests.js
firebase deploy --only hosting,firestore:rules
git add .
git commit -m "Describe el cambio"
git push
```

- `fix` es un arreglo (0.1.0 → 0.1.1), `feature` una función nueva (→ 0.2.0), `big` un cambio grande (→ 1.0.0).
- Las apps instaladas muestran solas el aviso **«Hay una versión nueva»** con el botón **Actualizar ahora**. No hay que reinstalar ni volver a ingresar.
- Para actualizar el SDK de Firebase más adelante: `node tools/vendor.js NUEVA_VERSION`, pruebas y publicación.

---

## Paso 13 · Publicar la versión 0.2.0 y las reglas por perfil

Desde esta versión la app usa la base de datos (Firestore) y cada cuenta entra con un **perfil**: Dueño, Externo o Pesaje.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
node tools/vendor.js
npm test
```

`vendor.js` vuelve a descargar el SDK (ahora también trae `firebase-app-check.js`, que se usa en el paso 16). `npm test` debe terminar con **«todas bien»**.

2. Publica la app **y las reglas**:

```
firebase deploy --only hosting,firestore:rules
```

Debe decir `firestore: released rules firestore.rules to cloud.firestore` y `Deploy complete!`. Si en cambio muestra un **error en `firestore.rules`** (con número de línea), no se publicó nada y las reglas anteriores siguen vigentes: copia el mensaje y llévalo al chat.

3. Sube el código (paso 12: `git add .`, `git commit`, `git push`). En GitHub, pestaña **Actions**, el flujo **Pruebas** tiene ahora un paso nuevo, **«Reglas de Firestore (emulador)»**: es la prueba que demuestra, contra las reglas reales, que la cuenta de pesaje no puede leer precios. **Debe quedar en verde.** Si queda en rojo, abre el paso, copia las líneas con ✗ y llévalas al chat.

4. Abre `https://ID.web.app`, pulsa **Actualizar ahora** si lo ofrece e ingresa.

**Listo cuando:** la app muestra **«Falta el primer paso de configuración»** con tu identificador. Es lo esperado: todavía no existe el documento que dice quiénes son los dueños.

## Paso 14 · Definir a los dueños (`config/negocio`)

Nadie puede nombrarse dueño desde la app: los dueños se anotan **a mano, una sola vez**, en la consola de Firebase.

1. Pide al dueño y a la dueña que abran la app e ingresen con su cuenta de Google **una vez**. Verán la pantalla «Falta el primer paso de configuración» (está bien).
2. Consola de Firebase → **Authentication** → pestaña **Usuarios** (Users). Cada cuenta que ingresó aparece con su correo y su **UID de usuario** (User UID). Copia el UID del dueño y el de la dueña. (También lo muestra la app en esa pantalla, con el botón **Copiar identificador**.)
3. Consola de Firebase → **Firestore Database** → pestaña **Datos** → **Iniciar colección** (Start collection):
   - **ID de la colección:** `config` → Siguiente.
   - **ID del documento:** `negocio` (escríbelo; no uses «ID automático»).
   - Agrega tres campos:

| Campo | Tipo | Valor |
|---|---|---|
| `duenos` | array | dos elementos de tipo **string**: el UID del dueño y el UID de la dueña |
| `nombre` | string | `Panadería` |
| `iva` | number | `19` |

   - **Guardar**.
4. Fíjate en la escritura exacta: `config`, `negocio` y `duenos` van en minúsculas y **sin ñ ni tilde**.

**Listo cuando:** en el equipo de un dueño la pantalla pasa sola a **Inicio** y dice «Entraste con el perfil **Dueño**»; en **Más** aparece la opción **Accesos**.

- Quien figure en `duenos` controla todo, incluidos los accesos: pon solo al dueño y a la dueña. Para cambiar un dueño más adelante se edita este mismo campo en la consola.
- Si quieres probar antes de que ellos ingresen, pon **tu** UID en `duenos`, prueba, y después reemplázalo por los de ellos (tú pasas a pedir acceso como Externo, paso 15).
- Los UID y los correos no se anotan en el repositorio. Si quieres guardarlos, usa la carpeta `privado\`.

## Paso 15 · Dar los accesos y verificar

1. **Tú (Externo):** ingresa en la app → **Pedir acceso**. Un dueño abre **Más → Accesos** (también le aparece un aviso amarillo en Inicio) → **Aprobar** → **Externo**. Tu pantalla de espera pasa sola a la app.
2. **Tablet de la panadería (Pesaje):** en la tablet, ingresa con la cuenta de Google de la tablet → escribe un nombre que la identifique (por ejemplo «Tablet panadería») → **Pedir acceso**. Un dueño la aprueba con el perfil **Pesaje**.
3. Si pide acceso alguien que no corresponde, el dueño pulsa **Rechazar**.

Verifica y marca:

| Verificación | ✓ |
|---|---|
| El dueño ve **Más → Accesos**, el aviso de solicitudes y puede aprobar | ☐ |
| Tu cuenta entra con perfil **Externo** y en «Más» **no** aparece Accesos | ☐ |
| La tablet entra con perfil **Pesaje** y **no** aparece Accesos | ☐ |
| El dueño cambia un perfil (Accesos → **Cambiar**) y el otro equipo lo refleja | ☐ |
| El dueño **quita** un acceso y en el otro equipo la app se cierra sola («Acceso quitado»); luego se lo **devuelve** | ☐ |
| Con la app instalada y en **modo avión**, cada equipo abre con su perfil | ☐ |
| GitHub → Actions → **Pruebas**: el paso «Reglas de Firestore (emulador)» está en verde | ☐ |

**Listo cuando:** las siete casillas están marcadas. Lleva la tabla al próximo chat.

## Paso 16 · App Check en modo supervisar

> **Opcional. Decisión del 19-nov-2026: la app funciona sin App Check** (motivos y cuándo activarlo: paso 23.D). Este paso queda como instrucciones por si algún día se activa.

App Check hace que Firebase distinga las peticiones que vienen de **tu app** de las que vienen de programas ajenos. Se parte en **modo supervisar**: la app envía su comprobante y Firebase solo lo mide, sin rechazar a nadie. Volverlo obligatorio queda para la Fase 8, cuando las mediciones muestren que todo llega verificado.

Usa reCAPTCHA v3 de Google (invisible: nunca pide resolver nada). Es la **única excepción** a la regla de «nada de otros sitios» de la app, y por eso viene apagado: se enciende con una herramienta que abre la política de seguridad solo para reCAPTCHA.

> Este paso no se pudo probar desde el chat con el reCAPTCHA real. Hazlo **después** de terminar el paso 15, así si algo cambia sabrás que fue por este paso. Es reversible (punto 7).

1. Abre `https://www.google.com/recaptcha/admin/create` con tu cuenta de Google:
   - **Etiqueta:** `Panaderia`.
   - **Tipo de reCAPTCHA:** **Basado en puntuación (v3)** (Score based).
   - **Dominios:** `ID.web.app` y `ID.firebaseapp.com` (sin `https://`). Agrega `localhost` si quieres probar en el computador.
   - **Enviar**. Verás dos claves: la **clave del sitio** (pública) y la **clave secreta**.
2. Consola de Firebase → **App Check** (en el menú, dentro de «Seguridad» o de «Compilación») → pestaña **Apps** → tu app web → **reCAPTCHA** → pega la **clave secreta** → **Guardar**.
   - La clave secreta va **solo** ahí. No la pegues en ningún archivo del proyecto.
   - **No pulses «Aplicar» (Enforce)** en ninguna parte: eso es el modo obligatorio.
3. En `APP\firebase-config.js`, pega la **clave del sitio** entre las comillas de `appCheckSiteKey`:

```
export const appCheckSiteKey = 'PEGA_AQUI_LA_CLAVE_DEL_SITIO';
```

4. En **cmd**:

```
node tools/appcheck.js activar
npm test
firebase deploy --only hosting
```

`appcheck.js activar` cambia la política de seguridad en `APP\index.html` y en `firebase.json` (los dos, iguales). `npm test` comprueba que política y clave coincidan.

5. Consola de Google Cloud → **APIs y servicios → Credenciales** → la clave web (paso 11.A) → **Restricciones de API**: agrega **Firebase App Check API** a las tres que ya estaban → **Guardar**.
6. Verifica en cada equipo: **Más → Buscar actualización → Actualizar ahora**, y luego **Más → Diagnóstico de instalación**. Debe decir **App Check: Activo** y **Bloqueos de seguridad: 0**. Uno o dos días después, en la consola de Firebase → App Check → pestaña **APIs** → **Cloud Firestore**, el gráfico debe mostrar las solicitudes como **verificadas**.
7. **Si algo falla** (la app no abre, no deja ingresar, o el Diagnóstico muestra bloqueos distintos de 0): copia el Diagnóstico para el chat y vuelve atrás:

```
node tools/appcheck.js desactivar
```

Deja `appCheckSiteKey = ''` en `APP\firebase-config.js`, y luego `npm test` y `firebase deploy --only hosting`.

**Listo cuando:** el Diagnóstico dice «App Check: Activo», con 0 bloqueos, en los tres tipos de equipo.

## Paso 17 · Cierre de seguridad de la Fase 2

1. **Solo Google como forma de ingreso.** Consola de Firebase → Authentication → **Método de acceso** (Sign-in method): debe estar habilitado únicamente **Google**. Ni «Anónimo» ni «Correo y contraseña».
2. **Dominios autorizados.** Authentication → **Configuración** (Settings) → **Dominios autorizados**: deben quedar `ID.web.app` y `ID.firebaseapp.com`. Si aparece `localhost`, puedes quitarlo; después **ingresa de nuevo en `https://ID.web.app`** para confirmar que todo sigue igual (si dejara de funcionar, vuelve a agregarlo y avisa en el chat).
3. **Reglas publicadas.** Firestore Database → pestaña **Reglas**: el texto debe empezar con «Panadería · reglas» y la fecha de publicación debe ser la de hoy.
4. **Plan gratuito.** Abajo en el menú de la consola debe decir **Spark**.

---

## Paso 18 · Publicar la versión 0.3.0 (catálogo) y cargar los datos

Esta versión trae el **Catálogo** (Más → Catálogo): productos, precios netos con fecha de vigencia, trabajadores, cliente e IVA. También cambian las **reglas** (ahora revisan la forma de esos datos), así que hay que publicarlas junto con la app.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«13 pruebas … todas bien»**.

2. **Antes de publicar**, sube el código (paso 12: `git add .`, `git commit -m "Fase 3: catálogo"`, `git push`) y mira en GitHub → **Actions** → **Pruebas** que el paso **«Reglas de Firestore (emulador)»** quede en verde. Tiene 34 casos nuevos del catálogo y es la única prueba que usa las reglas reales: **desde el chat no se pudo ejecutar.** Si queda en rojo, **no publiques**: copia las líneas con ✗ y llévalas al chat.

3. Con ese paso en verde, publica la app y las reglas:

```
firebase deploy --only hosting,firestore:rules
```

Debe decir `released rules firestore.rules` y `Deploy complete!`. Si muestra un **error en `firestore.rules`**, no se publicó nada: copia el mensaje con el número de línea y llévalo al chat.

4. En cada equipo: **Más → Buscar actualización → Actualizar ahora** (debe decir versión 0.3.0).

5. Con la cuenta de un dueño, carga el catálogo en este orden:
   - **Más → Catálogo → Cliente e IVA → Crear el cliente** (viene propuesto «Supermercado»; cámbialo por el nombre real si quieres).
   - **Productos → Agregar producto**, uno por cada tipo de pan. Elige **por kilo** o **por unidad**: después no se puede cambiar. Los de unidad pueden llevar el peso de cada una en gramos.
   - Toca cada producto → **Poner precio**: el precio **neto** (sin IVA) y **desde cuándo rige**. Para que noviembre se pueda registrar en fecha pasada (Fase 5), el primer precio debe regir desde una fecha anterior, por ejemplo el **1 de enero de 2026**; la app pide confirmar porque es una fecha pasada.
   - **Trabajadores → Agregar trabajador**: los nombres que aparecerán en la tablet para elegir quién pesa.

6. Verifica y marca:

| Comprobación | ✓ / ✗ |
|---|---|
| El dueño y el externo ven **Más → Catálogo**; la tablet (Pesaje) **no** | |
| Un producto nuevo aparece en el otro equipo sin recargar | |
| Con un precio desde el 1-ene y otro desde hoy, la ficha muestra el de hoy como **vigente** y el historial conserva el anterior | |
| El externo puede poner precios, pero en «Cliente e IVA» **no** tiene el botón para cambiar el IVA | |
| En **modo avión** el catálogo se ve, y al intentar guardar dice «Sin conexión: el catálogo se cambia con internet» | |
| Diagnóstico: **Bloqueos de seguridad: 0** y **Versión 0.3.0** | |
| GitHub → Actions → Pruebas: **«Reglas de Firestore (emulador)»** en verde | |

**Listo cuando:** las siete casillas están marcadas y el catálogo real quedó cargado (productos con precio y trabajadores).

---

## Paso 19 · Publicar la versión 0.4.0 (pesaje y entregas) y empezar a usar la tablet

Esta versión trae la **pantalla de pesaje** (la tablet: quién pesa, pan, kilos o unidades, «Cerrar entrega», lo pesado hoy) y, para dueños y externo, la pestaña **Hoy** (lo pesado en el día, al momento, con la venta calculada con el precio vigente, las entregas y lo de cada trabajador). Cambian las **reglas** de pesajes, días y bitácora: hay que publicarlas junto con la app.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«15 pruebas … todas bien»**.

2. **Antes de publicar**, sube el código (`git add .`, `git commit -m "Fase 4: pesaje y entregas"`, `git push`) y mira en GitHub → **Actions** → **Pruebas** que el paso **«Reglas de Firestore (emulador)»** quede en verde. Ahora son **184 casos** (30 nuevos del pesaje) y **desde el chat no se pudieron ejecutar**: si queda en rojo, **no publiques** y lleva las líneas con ✗ al chat.

3. Con ese paso en verde:

```
firebase deploy --only hosting,firestore:rules
```

Debe decir `released rules firestore.rules` y `Deploy complete!`.

4. En **cada equipo** (tablet, teléfonos, computador): **Más → Buscar actualización → Actualizar ahora** (debe decir versión 0.4.0).

5. **Prepara la tablet:**
   - En los ajustes de la tablet, deja **la fecha y la hora automáticas** (el servidor rechaza canastos con una fecha que no sea la de hoy).
   - Abre la app con la cuenta de la tablet (perfil **Pesaje**, paso 15). Debe abrir directo en **«Pesar pan»**, con letra grande.
   - La primera vez pregunta **«¿Quién pesa?»**: toca un nombre. Queda elegido en la tablet; se cambia con **Cambiar**.
   - **No cierres sesión en la tablet.** Si alguna vez hay canastos «Por enviar», la app avisa antes de cerrar sesión porque se perderían.

6. **Prueba completa** (con el teléfono del dueño abierto en **Hoy** al lado):
   - En la tablet: toca un pan, escribe un número y **Guardar canasto** (3 toques). En el teléfono debe aparecer **sin recargar**.
   - Pon la tablet en **modo avión**, registra otro canasto: queda marcado **«Por enviar»**. Quita el modo avión: la marca desaparece y el canasto aparece en el teléfono.
   - Toca **Cerrar entrega**: la tablet pasa a la **n.º 2** y en el teléfono la n.º 1 queda **Cerrada**.
   - Toca un canasto de la lista → **Corregir** (cambia el número) y luego **Anular**. En **Hoy** los anulados quedan aparte y **no suman**.
   - Los canastos de esta prueba **no se borran**: déjalos **anulados** (así no cuentan en las ventas).

7. Verifica y marca:

| Comprobación | ✓ / ✗ |
|---|---|
| La tablet abre directo en «Pesar pan», con letra grande, solo con **Pesaje** y **Más**, y sin ningún precio | |
| Un canasto se registra con 3 toques (pan → número → Guardar) | |
| El canasto aparece en **Hoy** del teléfono del dueño sin recargar | |
| En **modo avión** el canasto queda «Por enviar» y llega al teléfono del dueño al volver internet | |
| «Cerrar entrega» pasa a la n.º 2; en Hoy la n.º 1 queda «Cerrada» | |
| Corregir y anular un canasto de hoy funciona; en Hoy los anulados no suman | |
| **Pendiente del paso 18:** con la cuenta del externo, en Catálogo → Cliente e IVA **no** aparece el botón para cambiar el IVA (dice «Solo los dueños cambian el IVA») | |
| Diagnóstico en la tablet: **Bloqueos de seguridad: 0** y **Versión 0.4.0**; GitHub → Actions: **«Reglas de Firestore (emulador)»** en verde | |

**Listo cuando:** las ocho casillas están marcadas. Desde aquí la panadería puede empezar a usar la tablet todos los días.

---

## Paso 20 · Publicar la versión 0.5.0 (ventas para los dueños)

Esta versión trae, para dueños y externo: la pestaña **Entregas** (el mes por día y por entrega, con la venta), **«＋ Anotar canasto»** en **Hoy** (también en días pasados: así se completa noviembre), el **Registro general** (Más → Registros: todos los canastos con filtros y las correcciones), **Exportar a Excel** y **Respaldo** (Más → Datos), y dos **franjas de aviso**: «Vendido sin precio» y «Respaldo» (si pasó una semana). Cambian las **reglas** (marca del respaldo y nombre en la bitácora): hay que publicarlas junto con la app.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«18 pruebas … todas bien»**.

2. **Antes de publicar**, sube el código (`git add .`, `git commit -m "Fase 5: ventas, registro, Excel y respaldo"`, `git push`) y mira en GitHub → **Actions** → **Pruebas** que **«Reglas de Firestore (emulador)»** quede en verde. Ahora son **204 casos** (20 nuevos) y **desde el chat no se pudieron ejecutar**: si queda en rojo, **no publiques** y lleva las líneas con ✗ al chat.

3. Con ese paso en verde:

```
firebase deploy --only hosting,firestore:rules
```

4. En **cada equipo**: **Más → Buscar actualización → Actualizar ahora** (debe decir versión 0.5.0).

5. **Pendiente del paso 19 (modo avión):** con el teléfono del dueño en **Hoy**, pon la tablet en **modo avión**, registra un canasto (queda «Por enviar»), quita el modo avión y mira que llegue al teléfono. Después **anúlalo**.

6. **Prueba con el teléfono del dueño o el computador:**
   - **Entregas:** revisa el mes. Cada día muestra sus entregas con horario, kilos o unidades y venta. «Ver el día y corregir» abre ese día en **Hoy**.
   - **Fecha pasada:** en **Hoy**, con **‹ Anterior** ve a un día de noviembre, toca **«＋ Anotar canasto el …»**, elige pan, escribe la cantidad (puede ser el total del día de ese pan), quién pesó, entrega y hora, y **Guardar** (o **Guardar y anotar otro**). Aparece en ese día y en **Entregas**.
   - **Sin precio:** si un pan se vendió un día en que aún no tenía precio, aparece la franja **«Vendido sin precio: …»**. Anota su precio en Catálogo **con «desde» en ese día o antes** y la franja se va sola.
   - **Registro general** (Más → Registros): prueba los filtros (pan, quién pesó, entrega, anulados) y mira **Correcciones**: cada una dice qué cambió, quién y cuándo.
   - **Excel** (Más → Datos, o el botón de **Entregas**): descarga el mes y ábrelo en Excel. En la hoja **Entregas**, el **Total** debe ser **igual** al de la pantalla **Entregas** y al de la hoja **Ventas** (eso es el «Listo cuando» de la fase).
   - **Respaldo** (Más → Datos): **Descargar respaldo**. Se baja un archivo `respaldo-panaderia-AAAA-MM-DD.json`: guárdalo en una carpeta privada (por ejemplo, en `privado\respaldos\`, que no se sube a GitHub). La franja «Todavía no hay ningún respaldo» desaparece y vuelve a salir a los 7 días.
   - En **iPhone** (app instalada), al descargar se abre el menú **Compartir**: elige **Guardar en Archivos**.

7. Verifica y marca:

| Comprobación | ✓ / ✗ |
|---|---|
| **Pendiente del paso 19:** en modo avión el canasto queda «Por enviar» y llega al teléfono del dueño al volver internet | |
| La barra de dueños y externo dice **Hoy · Entregas · Pesaje · Más**; la tablet sigue solo con **Pesaje · Más** y sin franjas | |
| Un canasto anotado en un día pasado aparece en ese día (Hoy y Entregas) y el Registro dice «anotado el …» | |
| Un pan vendido sin precio muestra la franja «Vendido sin precio» y desaparece al anotar su precio | |
| En el Registro general, los filtros funcionan y «Correcciones» muestra qué cambió y quién | |
| El Excel del mes abre en Excel con 6 hojas, y su **Total** es igual al de la pantalla **Entregas** | |
| El respaldo se descarga, quedó guardado en un lugar privado, y la franja del respaldo se fue | |
| Diagnóstico: **Bloqueos de seguridad: 0** y **Versión 0.5.0**; GitHub → Actions: **«Reglas de Firestore (emulador)»** en verde | |

**Listo cuando:** las ocho casillas están marcadas.

---

## Paso 21 · Publicar la versión 0.6.0 (cierres mensuales) e importar enero a octubre

Esta versión trae **Más → Registros → Cierres mensuales**: el estado de cada mes del año, **importar desde Excel** los meses anteriores (con revisión antes de guardar) y **«Cerrar mes»** en **Entregas** para los meses que se anotaron en la app. Un mes cerrado queda fijo: **ya no se anota ni se corrige** en él (tampoco en **Hoy**); solo un **dueño** puede **reabrirlo** (queda constancia). El **IVA** de un mes (y de cualquier total) es ahora el **19 % del neto** de ese total, calculado una vez. Cambian las **reglas** (forma de los cierres y bloqueo de los meses cerrados): hay que publicarlas junto con la app.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«20 pruebas … todas bien»**.

2. **Antes de publicar**, sube el código (`git add .`, `git commit -m "Fase 6: cierres mensuales"`, `git push`) y mira en GitHub → **Actions** → **Pruebas** que **«Reglas de Firestore (emulador)»** quede en verde. Ahora son **235 casos** (31 nuevos) y **desde el chat no se pudieron ejecutar** (las reglas usan `split` para sacar el mes de una fecha): si queda en rojo, **no publiques** y lleva las líneas con ✗ al chat.

3. Con ese paso en verde:

```
firebase deploy --only hosting,firestore:rules
```

4. En **cada equipo**: **Más → Buscar actualización → Actualizar ahora** (debe decir versión 0.6.0).

5. **Importar los cierres** (teléfono del dueño o computador; mejor en el computador):
   - Deja los Excel de enero a octubre de 2026 en `D:\APP Panaderia\privado\` (no se sube a GitHub).
   - **Más → Cierres mensuales → Archivos de Excel**: elige **todos** a la vez (o de a uno). Deben ser **.xlsx**; si alguno es **.xls**, ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)».
   - En **Revisar la importación** cada tabla es un mes. Revisa: el **mes** (si no lo adivinó, elígelo), que cada nombre del Excel tenga su **pan del catálogo** (los que no reconoce quedan en «— Elegir pan —»; también puedes **crear** el pan, queda desactivado), y que diga **«✓ La suma de las filas … es igual al total del Excel»**.
   - Si el Excel no se entiende (dice que no encontró la fila de títulos), usa **Descargar una plantilla**, copia los números ahí y súbela.
   - Toca **Importar N meses** y confirma. Cada mes queda **cerrado**.

6. **Cerrar mes desde la app** (noviembre, cuando termine): en **Entregas**, ve al mes, revisa y toca **«Cerrar noviembre 2026»** (se puede desde el 1 de diciembre).

7. Verifica y marca:

| Comprobación | ✓ / ✗ |
|---|---|
| Los 10 meses (enero a octubre) aparecen **Cerrados · desde Excel** en Más → Cierres mensuales | |
| En cada mes, el **neto** del cierre (toca el mes) es igual al **total** del Excel de ese mes | |
| En la revisión, cada mes decía «✓ … es igual al total del Excel» (si alguno decía ✗, anota cuál) | |
| En **Hoy**, un día de octubre dice «Octubre 2026 está cerrado» y no deja anotar | |
| El externo ve los cierres pero **no** tiene «Reabrir el mes»; la tablet no ve Cierres | |
| Diagnóstico: **Bloqueos de seguridad: 0** y **Versión 0.6.0**; GitHub → Actions: **«Reglas de Firestore (emulador)»** en verde | |

**Listo cuando:** las seis casillas están marcadas (es el «Listo cuando» de la Fase 6: los 10 meses importados coinciden con los totales de los Excel).

---

## Paso 22 · Publicar la versión 0.7.0 (indicadores, proyección y metas)

Esta versión agrega la pestaña **Números** (dueños y externo; la tablet no la ve), entre **Entregas** y **Pesaje**:
- **El mes:** venta neta por pan, kilos y unidades por pan, participación de cada pan, comparación con el **mes anterior** y con el **mismo mes del año anterior**, promedio diario, **días de la semana** más fuertes, **kilos por trabajador** y **real contra proyectado** (o contra la meta). El mes en curso se compara **a su ritmo** (lo que sumaría completo al paso de los días ya terminados) y dice cuánto falta por día para la meta.
- **Año y metas:** el año mes a mes contra el anterior (gráfico y lista), la **proyección** (mismo mes del año anterior × crecimiento general o por pan × precio) y las **metas**: «Usar la proyección como metas» las fija, y cada mes se puede escribir a mano (toca el mes).
- Un mes **cerrado** usa los totales de su **cierre**; uno sin cerrar, lo pesado con el precio de cada día (lo mismo que **Entregas**). Los meses importados desde Excel no traen días ni trabajadores: esos dos indicadores salen solo de lo pesado en la app.

Cambian las **reglas** (forma de la proyección y las metas): hay que publicarlas junto con la app.

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«22 pruebas … todas bien»**.

2. **Antes de publicar**, sube el código (`git add .`, `git commit -m "Fase 7: indicadores, proyección y metas"`, `git push`) y mira en GitHub → **Actions** → **Pruebas** que **«Reglas de Firestore (emulador)»** quede en verde. Ahora son **261 casos** (26 nuevos, de la proyección) y **desde el chat no se pudieron ejecutar con el emulador**: si queda en rojo, **no publiques** y lleva las líneas con ✗ al chat.

3. Con ese paso en verde:

```
firebase deploy --only hosting,firestore:rules
```

4. En **cada equipo**: **Más → Buscar actualización → Actualizar ahora** (debe decir versión 0.7.0).

5. **Recomendado: importar 2025.** En `privado\` está `Cierres 2025.xlsx` (marzo a diciembre de 2025, con el formato de la plantilla de la app). Impórtalo igual que en el paso 21 (**Más → Cierres mensuales → Archivos de Excel**). Con 2025 cargado, cada mes de 2026 se compara con el mismo mes de 2025 y se puede proyectar 2026 (marzo a diciembre) y, cuando noviembre y diciembre de 2026 estén cerrados, todo 2027. Enero y febrero de 2026 no tienen base: su meta se escribe a mano.

6. **Probar la proyección y las metas** (teléfono del dueño o computador): **Números → Año y metas → Ajustar proyección**. Escribe el crecimiento general (por ejemplo `5`), el de precio (por ejemplo `3`) y, si quieres, el de algún pan; abajo se ve el total proyectado mientras escribes. **Guardar proyección**. Luego **Usar la proyección como metas** y confirma.

7. Verifica y marca:

| Comprobación | ✓ / ✗ |
|---|---|
| **Números → El mes**, octubre 2026: el **neto** es igual al del cierre (Más → Cierres mensuales → Octubre) y dice «cerrado desde Excel» | |
| **Números**, noviembre (en curso): el **neto** es igual al **Neto** de **Entregas** de noviembre | |
| Con 2025 importado: en un mes de 2026, «Contra … 2025» muestra la variación; en **Año y metas**, la cifra de 2025 de cada mes es la de su cierre | |
| Tras **Usar la proyección como metas**, noviembre muestra **«Meta»** con su porcentaje; al tocar un mes en **Año y metas** se puede escribir su meta | |
| El externo ve **Números** y puede ajustar la proyección; la tablet **no** ve **Números** | |
| Diagnóstico: **Bloqueos de seguridad: 0** y **Versión 0.7.0**; GitHub → Actions: **«Reglas de Firestore (emulador)»** en verde | |

**Listo cuando:** las seis casillas están marcadas (es el «Listo cuando» de la Fase 7: los totales de los indicadores cuadran con cierres y entregas).

**Lecturas:** un mes sin cerrar se lee canasto por canasto cada vez que se abre (como en Entregas). **Cerrar los meses** (Entregas → «Cerrar mes», desde el día 1 del mes siguiente) hace que los indicadores y la proyección usen el cierre y no lean nada más.

---

## Paso 23 · Publicar la versión 0.8.0 y revisión final

Esta versión cierra el desarrollo base (Fase 8):
- **Aviso de privacidad** breve: desde la pantalla de ingreso (**Aviso de privacidad**, abajo), desde la espera de aprobación y desde **Más → Aviso de privacidad**, en todos los perfiles.
- **Ayuda** para la familia: **Más → Ayuda**, con temas que se abren de a uno. La tablet ve solo los suyos (pesar, corregir, cerrar la entrega, sin internet). La misma guía, para imprimir, está en `GUIA-FAMILIA.md`.
- **Respaldo por año:** por omisión baja los canastos y correcciones **del año actual** (lo demás, completo). Así no se come la cuota diaria de lecturas cuando pasen los años. «Todos los años» sigue disponible.
- **Diagnóstico** más completo: **qué** se bloqueó (si algo), cuánto tarda la **apertura** y la **pantalla más lenta**.
- **Accesibilidad:** cada pantalla con su título, el foco pasa al título al cambiar de pantalla (lo anuncia el lector de pantalla) y no se pierde cuando llegan datos; revisada también a 320 px (equivale a ampliar al 400 %).
- **Seguridad:** cabecera `Cross-Origin-Resource-Policy` y pruebas nuevas de higiene. Las **reglas no cambian**. **App Check no se usa** (punto D).

### A. Publicar

1. En **cmd**, dentro de `D:\APP Panaderia`:

```
npm test
```

Debe terminar con **«24 pruebas … todas bien»**.

2. Sube el código (`git add .`, `git commit -m "Fase 8: privacidad, ayuda, respaldo por año y revisión de seguridad"`, `git push`) y mira en GitHub → **Actions** → **Pruebas**: todo en verde (las reglas no cambiaron: siguen los 261 casos).
3. Publica solo la app (las reglas no cambiaron):

```
firebase deploy --only hosting
```

4. En **cada equipo** (tablet, teléfonos de los dueños, computador): **Más → Buscar actualización → Actualizar ahora**. Debe decir versión **0.8.0**.

### B. Revisión final de seguridad (consolas)

Marca cada fila. Las que dependen del código las comprueban las pruebas (`tests/csp.js`, `tests/repo-unit.js`, reglas con el emulador); estas solo se ven en las consolas:

| Comprobación | Dónde | ✓ / ✗ |
|---|---|---|
| Solo **Google** como forma de ingreso (ni anónimo ni correo) | Firebase → Authentication → Método de acceso | |
| Dominios autorizados: solo `ID.web.app` y `ID.firebaseapp.com` | Authentication → Configuración → Dominios autorizados | |
| Clave web restringida a `https://ID.web.app/*` y `https://ID.firebaseapp.com/*` (y `localhost` solo si lo usas) y a 3 API: Identity Toolkit, Token Service y Cloud Firestore | Google Cloud → APIs y servicios → Credenciales | |
| Pantalla de consentimiento de Google **publicada** («En producción») y sin permisos extra (solo nombre, correo y perfil) | Google Cloud → Google Auth Platform → Público y Acceso a los datos | |
| IAM: solo tu cuenta como Propietario, más las cuentas de servicio de Google | Google Cloud → IAM y administración → IAM | |
| Plan **Spark** (gratuito: no puede generar cobros) | Firebase, abajo en el menú | |
| Reglas publicadas = las del repositorio (empiezan con «Panadería · reglas», con la fecha del paso 22) | Firestore Database → Reglas | |
| GitHub: Secret scanning, Push protection y Dependabot alerts activos; Actions con permisos de solo lectura y aprobación para colaboradores externos; solo tú como colaborador | Repositorio → Settings | |
| **Accesos de la app:** solo las personas que corresponden (quitar a quien ya no) | La app → Más → Accesos | |
| Respaldo descargado esta semana y guardado fuera del computador, en un lugar privado | La app → Más → Exportar a Excel y respaldo | |

### C. Verifica y marca

| Comprobación | ✓ / ✗ |
|---|---|
| En el ingreso (sin sesión) se abre **Aviso de privacidad**; en la tablet, **Más → Ayuda** muestra solo pesar, corregir, entrega, sin internet, actualizar y problemas | |
| **Más → Exportar a Excel y respaldo**: por omisión «2026 (este año)»; el archivo se llama `respaldo-panaderia-AAAA-MM-DD-de-2026.json` | |
| Diagnóstico en los tres tipos de equipo: **Versión 0.8.0**, **Bloqueos de seguridad: 0** y **App Check: Sin configurar** (anota la **apertura** y la **pantalla más lenta** de la tablet) | |
| La tabla de la revisión final de seguridad (B) quedó completa | |
| `GUIA-FAMILIA.md` impresa (o enviada) a la familia | |

**Listo cuando:** las cinco casillas están marcadas. Con eso la Fase 8 queda cerrada y la app, entregada.

### D. App Check: por qué no se usa y cuándo activarlo

**Decisión (19-nov-2026): la app funciona sin App Check.** Los datos los protegen las **reglas**: sin acceso aprobado nadie lee precios, ventas ni pesajes, ni siquiera con un programa propio y la clave pública. App Check solo exige que las conexiones vengan de la app publicada. Sin él:
- cualquier cuenta de Google puede crear su solicitud de acceso (una por cuenta) y leer quiénes son los dueños (identificadores que no dan acceso), igual que desde la app;
- el único riesgo real es que alguien, con un programa propio, **gaste la cuota diaria** de lecturas: la app dejaría de funcionar hasta que la cuota se reinicia (medianoche de California, de madrugada en Chile). Con el plan Spark **no hay cobros**.

A cambio, la app no carga reCAPTCHA (sigue sin nada de otros sitios) y ningún equipo puede quedar bloqueado por un bloqueador de anuncios o la protección contra rastreo.

**Actívalo si** la app se cae un día por cuota agotada (Firebase → Firestore → Uso, con lecturas muy por encima de lo normal) o aparecen solicitudes de acceso de desconocidos. Todo quedó preparado (unos 30 minutos):
1. Haz el **paso 16** (modo supervisar) y actualiza cada equipo: el Diagnóstico debe decir **«App Check: Activo · comprobante recibido»** y 0 bloqueos (si no, muestra **«Qué se bloqueó»**: tráelo al chat). Agrega **Firebase App Check API** a la clave web.
2. Tras 1 a 2 días, en Firebase → **App Check** → **APIs** → **Cloud Firestore**, casi todo debe ser **Solicitudes verificadas** y las de **clientes desactualizados** en 0.
3. **Aplicar** (Enforce) en Cloud Firestore (y en Authentication, si aparece). Espera 15 minutos y prueba en cada equipo: la tablet pesa (y anula) un canasto, los dueños ven Hoy y Entregas.
4. Si un equipo falla (la app dice «permission-denied» y «App Check no entregó su comprobante»), **Desaplicar** (Unenforce) en la misma pantalla: vuelve a funcionar en minutos, sin publicar nada. Causas típicas: bloqueador de anuncios, protección contra rastreo estricta, fecha y hora del equipo mal puestas o una versión vieja de la app.

Con App Check configurado, el ingreso y el aviso de privacidad mencionan reCAPTCHA solos (es la condición de Google para ocultar su insignia).

---

## Problemas frecuentes

| Qué ves | Causa y solución |
|---|---|
| La app dice **«Falta conectar la app con Firebase»** | Queda algún `PEGAR…` en `APP\firebase-config.js` (pasos 3 y 4). Si ya publicaste, hay que publicar de nuevo (paso 8) |
| La app dice **«La app está incompleta»** | No se ejecutó `node tools/vendor.js` (paso 2), o se publicó antes de hacerlo |
| Google muestra **Error 400: redirect_uri_mismatch** | La dirección no está autorizada o no es idéntica (paso 5). Debe llevar `https://`, sin espacios y con la barra final. En el computador, entra por `http://localhost:5000` |
| Google muestra **Error 403: access_denied** o «app en modo de prueba» | Consola de Google Cloud → **Google Auth Platform → Público** (o «Pantalla de consentimiento de OAuth») → **Publicar la app** |
| La app dice **«Firebase no aceptó el ingreso»** | El `googleClientId` no es el del proveedor Google de este proyecto (paso 4.6), el proveedor no está habilitado, o la restricción de la clave quedó mal (paso 11.A) |
| La app dice **«El ingreso no comenzó en este equipo»** | Se abrió un enlace viejo o el navegador borró lo guardado. Vuelve a pulsar **Ingresar con Google** |
| `npm` o `firebase` «no se reconoce» o «la ejecución de scripts está deshabilitada» | Cierra la terminal y abre **cmd** (no PowerShell). Si sigue, reinstala Node |
| `firebase deploy` dice que falta el proyecto | Repite `firebase use --add` (paso 8.2) |
| En el iPhone el ingreso se queda en Safari y no vuelve a la app | Anótalo en la tabla del paso 9 y llévalo al próximo chat (es justo lo que verifica T3) |
| La app dice **«Falta el primer paso de configuración»** | No existe `config/negocio` o está mal escrito (paso 14). Revisa minúsculas y que `duenos` sea un **array** de textos |
| Un dueño ve **«Pedir acceso»** en vez de entrar | Su UID no está en `duenos`, o se copió con un espacio o incompleto (paso 14.2). Cada cuenta de Google tiene un UID distinto |
| La app dice **«No se pudo comprobar tu acceso (permission-denied)»** | Las reglas no se publicaron (paso 13.2), o App Check es obligatorio y ese equipo no entrega el comprobante (paso 23.D) |
| La app se queda en **«Comprobando tu acceso…»** | Sin internet la primera vez en ese equipo. Con internet, pulsa **Reintentar** |
| `firebase deploy` muestra un error en `firestore.rules` | No se publicó nada. Copia el mensaje completo (con la línea) y llévalo al chat |
| El Diagnóstico dice **«App Check: Falta el SDK»** | Ejecuta `node tools/vendor.js` y publica de nuevo (paso 13.1) |
| El Diagnóstico dice **«App Check: Activo · sin comprobante (…)»** o **«el comprobante no llega»** | reCAPTCHA no pudo cargar o no reconoce el dominio. Revisa que en la clave de reCAPTCHA estén `ID.web.app` y `ID.firebaseapp.com` (paso 16.1), que el equipo no tenga un bloqueador de anuncios y que la fecha y hora sean automáticas. Si App Check ya es obligatorio, **Desaplicar** mientras tanto (paso 23.D) |
| Con App Check obligatorio, un equipo dice **«No se pudo comprobar tu acceso (permission-denied)»** | Ese equipo no entrega el comprobante (fila de arriba) o tiene una versión vieja: **Más → Buscar actualización**. Si no se arregla, **Desaplicar** (paso 23.D) y trae el Diagnóstico al chat |
| Al guardar en el catálogo dice **«Esta cuenta no puede cambiar el catálogo»** | Las reglas nuevas no se publicaron (paso 18.3) o la cuenta es de Pesaje. Si es un dueño o el externo y las reglas están publicadas, anota qué estabas guardando y llévalo al chat |
| La tablet dice **«No se guardó el canasto…: el servidor no lo aceptó»** | La fecha u hora de la tablet está mal (paso 19.5: fecha y hora automáticas), las reglas nuevas no se publicaron (paso 19.3) o la cuenta perdió el acceso. El canasto se deshace solo: anótalo de nuevo cuando esté resuelto |
| Un canasto queda **«Por enviar»** mucho rato | La tablet no tiene internet. Se envía solo al volver la conexión; no cierres sesión mientras tanto |
| La tablet pregunta **«¿Quién pesa?»** otra vez | Se desactivó a esa persona en el catálogo, o se borraron los datos del navegador. Toca el nombre de nuevo |
| Después de publicar no veo los cambios | **Más → Buscar actualización → Actualizar ahora** |
| Al descargar el Excel o el respaldo dice **«hace falta internet»** | Se leen directo del servidor para que salgan completos. Conéctate y vuelve a tocar el botón |
| El Excel o el respaldo dice **«el servidor no lo permitió»** | Las reglas nuevas no se publicaron (paso 20.3) o la cuenta es de Pesaje |
| La franja **«Vendido sin precio»** no se va | El precio quedó con «desde» **después** del día vendido. Corrige la fecha del precio en Catálogo (la franja mira el día abierto en Hoy y el mes de Entregas o el período del Registro) |

## Qué queda fuera del repositorio

`privado/` (cierres en Excel, respaldos, correos y UID), `app de muestra/` y `node_modules/`. Nunca subas archivos `.env`, `serviceAccount…json` ni claves `.pem` o `.key`: la prueba `tests/repo-unit.js` y GitHub (Push protection) lo impiden, pero el primer filtro eres tú al revisar `git status`.
