/* Doble de prueba de firebase-app-check.js: anota con qué clave se activó y entrega un comprobante de mentira
   (o falla, si la prueba deja  localStorage['fake.appCheckFalla'] = 'código'). */
export class ReCaptchaV3Provider { constructor(clave) { this.clave = clave; } }
export function initializeAppCheck(app, o) { window.__fakeAppCheck = { clave: o.provider.clave, renovar: o.isTokenAutoRefreshEnabled }; return { tipo: 'app-check' }; }
export function getToken(ac, forzar) {
  const falla = localStorage.getItem('fake.appCheckFalla');
  return new Promise((res, rej) => setTimeout(() => (falla ? rej(Object.assign(new Error('App Check falló'), { code: falla })) : res({ token: 'comprobante-de-prueba' })), 20));
}
