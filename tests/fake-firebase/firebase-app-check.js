/* Doble de prueba de firebase-app-check.js: solo anota con qué clave se activó. */
export class ReCaptchaV3Provider { constructor(clave) { this.clave = clave; } }
export function initializeAppCheck(app, o) { window.__fakeAppCheck = { clave: o.provider.clave, renovar: o.isTokenAutoRefreshEnabled }; return {}; }
