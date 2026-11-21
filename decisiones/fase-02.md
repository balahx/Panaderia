# Decisiones · Fase 2 · Cuentas, perfiles y reglas

> Parte de `ESTADO.md` (dividido el 20-nov-2026). Qué se decidió en esta fase y por qué. El plan de la fase está en `PLAN.md` «Fase 2».

### Decisiones (14-nov-2026)

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
