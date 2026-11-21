# Decisiones · Fase 3 · Catálogo

> Parte de `ESTADO.md` (dividido el 20-nov-2026). Qué se decidió en esta fase y por qué. El plan de la fase está en `PLAN.md` «Fase 3».

### Decisiones (15-nov-2026)

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
