# Decisiones · Fase 1 · Base instalable y publicación

> Parte de `ESTADO.md` (dividido el 20-nov-2026). Qué se decidió en esta fase y por qué. El plan de la fase está en `PLAN.md` «Fase 1».

### Decisiones (13-nov-2026)

- **Ingreso con Google por redirección de página completa**, hecha por la app (`core/acceso.js`): va a `accounts.google.com`, vuelve con un `id_token` y se entrega a Firebase (`signInWithCredential`). Motivo: el ingreso estándar del SDK (ventana emergente o redirección) obliga a cargar un script de `apis.google.com` y un marco, lo que chocaba con «CSP estricta, sin scripts de terceros»; además las ventanas emergentes fallan en apps instaladas en iPhone. Costo: un paso más en la guía (paso 5, URIs autorizados). **Plan B** si el paso 9 falla en algún equipo: usar `signInWithRedirect` del SDK y admitir `apis.google.com` en la CSP.
- Dirección oficial `https://ID.web.app`; `ID.firebaseapp.com` redirige sola.
- CSP más estricta que la muestra: `script-src 'self'` y `style-src 'self'` (sin `unsafe-inline`), sin `frame-src`. Va en `index.html` y como cabecera en `firebase.json` (con `frame-ancestors 'none'` y `X-Frame-Options`). **Consecuencia para todas las fases: nada de `style="…"` ni `onclick="…"` en el HTML que genera el código** (sí se puede `el.style.x = …`); `tests/csp.js` lo vigila.
- El SDK de Firebase no viene en el repositorio de origen: lo descarga `tools/vendor.js` (versión fijada 12.15.0, con huella SHA-256) y se sube al repositorio.
- Módulos ES en `APP\js\` (probados en Node gracias a `APP\js\package.json`); `version.js` y `guard.js` siguen siendo scripts clásicos (los necesita el service worker).
- Pantallas: cada módulo exporta `html(ctx)` y `alActuar(act, el, ctx)`; los botones usan `data-act`. `app.js` reparte.
- Firestore creado en modo producción con reglas **todo cerrado** hasta la Fase 2.
- CI: acciones fijadas por hash (checkout v4.1.7, setup-node v4.0.3) y Dependabot mensual para actualizarlas. **gitleaks no se incluyó** (no se pudo verificar su hash desde el chat); lo cubren `tests/repo-unit.js` y Secret scanning + Push protection de GitHub.
- Letra grande para la panadería: `data-escala="grande"` en `<html>` (los tamaños usan `em`); desde la Fase 4 la activa `app.js` en la cuenta de pesaje y en la pestaña Pesaje.
