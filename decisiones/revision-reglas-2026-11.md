# Revisión de las reglas de Firestore · 25-nov-2026

Revisión pedida por Felipe sobre `firestore.rules` (versión de la app 0.12.0). **Solo cambian reglas y pruebas: la app no se toca ni se sube de versión.** Se publica con `firebase deploy --only firestore:rules`.

Estado: **publicada el 25-nov-2026** con `firebase deploy --only firestore:rules`. Felipe revisó la app después de publicar y todo funciona. Antes de publicar, `reglas-unit.js` pasó contra la copia a mano; en GitHub Actions falló una vez `cobros-e2e.js` (prueba 11, un clic que esperó 30 s); no se repitió al correrlo de nuevo en otro entorno y se tomó como falla puntual. Al volver a correr, GitHub Actions quedó en verde, con el emulador y los 518 casos.

## Qué cambió

| # | Cambio | Dónde |
|---|---|---|
| 1 | `sesion()` exige `sign_in_provider == 'google.com'` y `email_verified == true`. Una cuenta con otro método de ingreso (anónimo, correo y clave) no pasa ninguna regla, aunque su UID sea el de un dueño. | `sesion()` |
| 2 | Bitácora `cambios`: la constancia debe apuntar a un canasto que existe; la tablet, además, a uno cuya fecha sea la de la constancia; `antes` y `despues` hasta 12 campos (un pesaje tiene 11). | `match /cambios/{id}` |
| 3 | `fechaValida` exige mes 01 a 12 y día 01 a 31 (antes aceptaba `2026-99-99`); `precios` ya no trae su propia expresión floja. Un canasto no puede llevar fecha futura (`noFutura`: hasta hoy según «ahora − 3 h»). | `fechaValida`, `noFutura`, `pesajeValido` |
| 4 | `mesTerminado` usa «ahora − 4 h» (hora de invierno): antes un mes se podía cerrar una hora antes, a las 23:00 del 31 de mayo, julio y agosto. | `mesTerminado` |
| 5 | Tope por canasto **solo para la tablet**: 200 kg o 2000 unidades (la app avisa sobre 20 kg y pide confirmar sobre 50). Dueños y externo no tienen tope. | `topeTablet()` en `pesajes` |

Los topes (200 y 2000) los puse yo como red de seguridad: se cambian en `topeTablet()` y en su copia (`tests/fake-firebase/reglas.mjs`, `topeTablet`), y en los casos «16b (5)».

## Pruebas

- `tests/reglas-casos.js`: 518 casos (481 + 37 nuevos, secciones «16b»). Cuentas nuevas: `rosaClave` (UID de la dueña con ingreso por correo y clave), `rosaSinVerificar`, `tabletAnonima`; las demás declaran `proveedor: 'google.com'`.
- `tests/rules-emulator.js`: el token de cada cuenta lleva `firebase.sign_in_provider` (si no, todas las cuentas serían «custom» y todo se rechazaría).
- `tests/fake-firebase/reglas.mjs` (copia a mano) y `firebase-firestore.js` (usuario falso con `proveedor: 'google.com'`).
- `tests/reglas-unit.js`: sección 17b (reloj: mes terminado en invierno y verano, canastos sin futuro) y comprobaciones de texto sobre `firestore.rules` (sesion, fechas, mesTerminado, topeTablet, cambios).
- `abonos-unit.js`, `cierres-unit.js`, `clientes-unit.js`, `cobros-unit.js`, `indicadores-unit.js` y `plan-unit.js`: el usuario de prueba que arman a mano declara ahora `email`, `email_verified: true` y `proveedor: 'google.com'` (10 lugares). Sin eso, la copia a mano rechaza todo, porque `sesion()` lo exige (con las versiones antiguas fallaban 3, 5, 5, 2 y 2 comprobaciones).

## Lo comprobado y lo que no

- **Comprobado:** `reglas-unit.js` pasa de 507 a 554 comprobaciones, 0 fallas (las 47 nuevas: 37 casos, 4 de reloj y 6 de texto de las reglas); 27 de los 37 casos nuevos fallan contra la copia a mano anterior (detectan el cambio, el resto ya estaba rechazado por otra regla). Las otras seis pruebas unitarias dan lo mismo que antes, todas en verde.
- **No comprobado:** (1) las reglas REALES con el emulador de Firestore (no había emulador ni red donde se hizo el cambio): hay que correrlo; (2) las pruebas con navegador (`npm test`, los `*-e2e.js`), que usan la copia a mano y el usuario falso de `firebase-firestore.js`; el cambio no debería afectarlas, pero hay que correrlas.

## Cómo se publicó (y cómo volver atrás)

1. Correr `npm test` (con navegador) y subir los cambios; esperar el emulador en verde en GitHub Actions (o `npm run reglas` con Java).
2. Publicar solo reglas: `firebase deploy --only firestore:rules`.
3. Verificar enseguida: un dueño entra en el teléfono y en el computador (prueba que Google sigue pasando `sesion()`); la tablet pesa, corrige, anula y cierra una entrega; Más → Diagnóstico con 0 bloqueos.
4. Si algo falla: en la consola de Firebase, Firestore → Reglas → historial, restaurar la versión anterior; o `git checkout` de `firestore.rules` y volver a publicar.

## Lo que se vio y no se aplicó (para decidir)

- **Costos de meses cerrados:** las ventas de un mes cerrado quedan fijas en `cierres`, pero los costos se calculan con las recetas y los precios de insumos vigentes. Editar o quitar una receta o un precio de insumo antiguo cambia el margen de un mes cerrado. Bloquearlo choca con la primera receta y el primer precio (desde el 1 de enero) y obligaría a que corregir sea crear una versión nueva. Hoy una prueba lo declara intencional («se corrige la receta de esa fecha»).
- **`config/negocio` lo lee cualquier cuenta con sesión** (incluye los UID de los dueños). Cerrarlo exige que la app trate el rechazo como «no soy dueño».
- **Cuota diaria gratuita:** las reglas no impiden que una cuenta de Google cualquiera mande muchas peticiones. Lo cubría App Check, que se decidió no usar (19-nov-2026). Con el plan gratuito el peor caso es un día sin servicio, sin costo.
- **Constancia obligatoria:** las reglas no pueden exigir que cada corrección de la tablet traiga su constancia en `cambios` (no conocen el identificador que elige la app).
- **Verificación en dos pasos** en las cuentas de Google de los dueños, del externo y de la tablet: lo más útil fuera de las reglas, porque todo el acceso depende de esa cuenta.
