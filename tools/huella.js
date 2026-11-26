#!/usr/bin/env node
/* Huella de diseño (Fase 13): sirve para comprobar que un cambio de CSS no cambia lo que se ve, o para ver exactamente qué cambió.
   1) Tomar la huella:   npm run huella -- huellas/antes        (= node tests/a11y.js --huella huellas/antes; unos 15 minutos)
      En cada vista que recorre a11y.js guarda los estilos calculados de todos los elementos (también ::before y ::after), su caja
      y una captura; además de 320, 360 y 390 px recorre 800 px (tablet en vertical) y 1280 × 800 (la Tab S6 en horizontal).
   2) Cambiar el CSS y tomar otra:  npm run huella -- huellas/despues
   3) Comparar:  npm run comparar -- huellas/antes huellas/despues
      Dice qué vistas cambiaron, en qué elemento y qué propiedad (antes → después). Sin diferencias, termina con «iguales».
   Las variables (--algo) no se comparan: se comparan sus efectos. La carpeta huellas/ no se sube al repositorio (.gitignore). */
const fs = require('fs'), path = require('path'), zlib = require('zlib');

/* Lo que corre dentro de la página (lo usa tests/a11y.js): un texto por elemento con todas sus propiedades calculadas */
function tomar() {
  const ruta = el => { const p = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { let i = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) i++; p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ':' + i); } return p.join('>'); };
  const texto = cs => { let t = ''; for (let i = 0; i < cs.length; i++) { const n = cs[i]; t += n + ':' + cs.getPropertyValue(n) + ';'; } return t; };
  const estilos = [], indice = new Map(), elems = {};
  const id = t => { if (!indice.has(t)) { indice.set(t, estilos.length); estilos.push(t); } return indice.get(t); };
  [document.documentElement, ...document.querySelectorAll('body, body *')].forEach(el => {
    const r = el.getBoundingClientRect();
    elems[ruta(el) || 'html'] = [id(texto(getComputedStyle(el))), id(texto(getComputedStyle(el, '::before'))), id(texto(getComputedStyle(el, '::after'))),
      Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width) + ',' + Math.round(r.height)];
  });
  const dlg = document.querySelector('dialog[open]');
  if (dlg) elems['::backdrop'] = [id(texto(getComputedStyle(dlg, '::backdrop'))), 0, 0, ''];
  return { estilos, elems };
}

const nombre = (n, label) => String(n).padStart(3, '0') + '-' + label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* Guarda la huella de una vista (lo llama tests/a11y.js si existe PAN_HUELLA) */
async function guardar(dir, grupo, n, label, page) {
  const d = path.join(dir, grupo); fs.mkdirSync(d, { recursive: true });
  const h = await page.evaluate(tomar), base = path.join(d, nombre(n, label));
  fs.writeFileSync(base + '.json.gz', zlib.gzipSync(JSON.stringify({ label, ...h })));   // comprimida: ocupa ~20 veces menos
  await page.screenshot({ path: base + '.png', fullPage: true });
}

/* Compara dos carpetas de huellas */
function comparar(a, b) {
  // Las variables (--algo) no se ven por sí mismas: se comparan sus efectos, las propiedades de verdad
  const props = t => Object.fromEntries(t.split(';').filter(x => x && !x.startsWith('--')).map(x => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; }));
  const leer = p => { const t = fs.readFileSync(p); return JSON.parse(p.endsWith('.gz') ? zlib.gunzipSync(t) : t); };
  const hallar = (d, f) => [f, f + '.gz', f.replace(/\.gz$/, '')].map(x => path.join(d, x)).find(x => fs.existsSync(x));
  // Lo que cambia solo de una vez a otra, aunque el CSS sea el mismo: el aviso flotante (depende de cuánto tardó) y las cifras del
  // Diagnóstico (tiempos medidos). Se informan aparte y no cuentan como diferencia.
  const RUIDO = /#toast:|#diag:/, todo = (H, k) => (H.elems[k] || []).map((v, i) => i < 3 ? JSON.stringify(props(H.estilos[v] || '')) : v).join('|');
  let vistas = 0, distintas = 0, faltan = 0, soloPixeles = 0, ruido = 0;
  for (const grupo of fs.readdirSync(a).sort()) {
    const da = path.join(a, grupo), db = path.join(b, grupo);
    for (const f of fs.readdirSync(da).filter(x => /\.json(\.gz)?$/.test(x)).sort()) {
      vistas++; const fb = hallar(db, f);
      if (!fb) { faltan++; console.log('✗ ' + grupo + '/' + f + ': no está en ' + b); continue; }
      const A = leer(path.join(da, f)), B = leer(fb), difs = []; let conRuido = false;
      for (const k of new Set([...Object.keys(A.elems), ...Object.keys(B.elems)])) {
        if (RUIDO.test(k)) { if (todo(A, k) !== todo(B, k)) conRuido = true; continue; }
        const x = A.elems[k], y = B.elems[k];
        if (!x || !y) { difs.push(k + ': ' + (x ? 'ya no está' : 'nuevo')); continue; }
        ['', '::before', '::after'].forEach((ps, i) => {
          const ta = A.estilos[x[i]], tb = B.estilos[y[i]]; if (ta === tb) return;
          const pa = props(ta), pb = props(tb);
          const c = [...new Set([...Object.keys(pa), ...Object.keys(pb)])].filter(p => pa[p] !== pb[p]).map(p => p + ': ' + pa[p] + ' → ' + pb[p]);
          if (c.length) difs.push(k + ps + ' · ' + c.slice(0, 4).join(' | '));
        });
        if (x[3] !== y[3]) difs.push(k + ' · caja ' + x[3] + ' → ' + y[3]);
      }
      const png = p => fs.existsSync(p) ? fs.readFileSync(p) : null, ia = png(path.join(da, f.replace(/\.json(\.gz)?$/, '.png'))), ib = png(path.join(db, f.replace(/\.json(\.gz)?$/, '.png')));
      // Captura distinta con estilos y cajas iguales: el dibujo de las letras varía en algunos píxeles de una vez a otra
      if (ia && ib && !ia.equals(ib) && !difs.length) soloPixeles++;
      if (conRuido) ruido++;
      if (difs.length) { distintas++; console.log('✗ ' + grupo + '/' + A.label + ' (' + difs.length + ')\n    ' + difs.slice(0, 6).join('\n    ')); }
    }
  }
  console.log('\n' + vistas + ' vistas · ' + (distintas || faltan ? distintas + ' distintas, ' + faltan + ' faltan' : 'iguales') +
    (soloPixeles ? ' · ' + soloPixeles + ' capturas con píxeles distintos y estilos iguales (dibujo de letras, no cuenta)' : '') +
    (ruido ? ' · ' + ruido + ' vistas con cambios solo en el aviso flotante o en las cifras del Diagnóstico (cambian solas, no cuentan)' : ''));
  return distintas + faltan;
}

if (require.main === module) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) { console.error('Uso: node tools/huella.js <carpeta antes> <carpeta después>'); process.exit(1); }
  process.exit(comparar(a, b) ? 1 : 0);
}
module.exports = { guardar, comparar, tomar };
