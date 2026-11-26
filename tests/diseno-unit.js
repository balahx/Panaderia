/* Base de diseño (Fase 13, parte A), sin navegador: el tema oscuro escrito dos veces es igual en sus dos bloques y tiene los mismos
   colores que el claro; los colores solo están en css/tokens.css; toda variable usada existe y toda escala definida se usa; cada CSS
   de index.html existe, está en el service worker y va en orden (fichas, base, piezas comunes, pantallas), y no sobra ninguno;
   cada archivo de CSS tiene 300 líneas o menos. Uso: node tests/diseno-unit.js */
const fs = require('fs'), path = require('path');
const APP = path.resolve(__dirname, '..', 'APP'), CSS = path.join(APP, 'css');
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const leer = f => fs.readFileSync(f, 'utf8');
const sinComentarios = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(APP, f).split(path.sep).join('/');
const archivos = walk(CSS).filter(f => f.endsWith('.css')), textos = Object.fromEntries(archivos.map(f => [rel(f), sinComentarios(leer(f))]));
/* Declaraciones de un bloque { … } que empieza justo después de `selector {` */
const bloque = (t, selector) => {
  const i = t.indexOf(selector + ' {'); if (i < 0) return null;
  const a = t.indexOf('{', i) + 1, b = t.indexOf('}', a);
  return Object.fromEntries(t.slice(a, b).split(';').map(x => x.trim()).filter(Boolean).map(x => { const j = x.indexOf(':'); return [x.slice(0, j).trim(), x.slice(j + 1).trim()]; }));
};
const igual = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

console.log('1. Tema claro y oscuro (css/tokens.css)');
const tok = textos['css/tokens.css'];
const claro = bloque(tok, ':root');
const enMedia = (() => { const i = tok.indexOf('@media (prefers-color-scheme: dark)'); return i < 0 ? null : bloque(tok.slice(i), ':root:not([data-theme="light"])'); })();
const porAtributo = bloque(tok, ':root[data-theme="dark"]');
ok(claro && enMedia && porAtributo, 'están los tres bloques: claro, oscuro del sistema y data-theme="dark"');
if (claro && enMedia && porAtributo) {
  ok(igual(enMedia, porAtributo), 'los dos bloques del tema oscuro son iguales' + (igual(enMedia, porAtributo) ? '' :
    ': distintos en ' + [...new Set([...Object.keys(enMedia), ...Object.keys(porAtributo)])].filter(k => enMedia[k] !== porAtributo[k]).join(', ')));
  const oscuros = Object.keys(enMedia).filter(k => k.startsWith('--')).sort(), claros = Object.keys(claro).sort();
  ok(JSON.stringify(oscuros) === JSON.stringify(claros), 'cada color del claro tiene su valor oscuro y al revés' + (JSON.stringify(oscuros) === JSON.stringify(claros) ? '' :
    ': ' + claros.filter(k => !oscuros.includes(k)).concat(oscuros.filter(k => !claros.includes(k))).join(', ')));
  ok(enMedia['color-scheme'] === 'dark', 'el oscuro avisa color-scheme: dark (barras y campos del sistema en oscuro)');
  const noHex = Object.entries(claro).concat(Object.entries(enMedia)).filter(([k, v]) => k.startsWith('--') && !/^#[0-9A-F]{6}$/.test(v));
  ok(noHex.length === 0, 'la paleta son colores #RRGGBB' + (noHex.length ? ': ' + noHex.map(x => x.join(' ')).join(', ') : ''));
  ok(claro['--line-control'] && enMedia['--line-control'], '--line-control (borde de los controles) existe en claro y oscuro');
}

console.log('2. Colores solo en tokens.css');
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(white|black|red|green|blue|gray|grey|orange|yellow|brown)(?![\w-])/;
const valores = t => [...t.matchAll(/\{([^{}]*)\}/g)].flatMap(m => m[1].split(';')).filter(d => d.includes(':')).map(d => d.trim());   // solo lo que va tras «propiedad:»
const conColor = Object.entries(textos).filter(([f]) => f !== 'css/tokens.css').flatMap(([f, t]) => valores(t).filter(d => COLOR.test(d.slice(d.indexOf(':') + 1))).map(d => f + ' «' + d.slice(0, 60) + '»'));
ok(conColor.length === 0, 'ningún color escrito fuera de tokens.css' + (conColor.length ? ': ' + conColor.slice(0, 5).join(' · ') : ''));

console.log('3. Variables');
const definidas = new Set(Object.values(textos).flatMap(t => [...t.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])));
for (const js of walk(path.join(APP, 'js')).filter(f => f.endsWith('.js'))) for (const m of leer(js).matchAll(/setProperty\('(--[\w-]+)'/g)) definidas.add(m[1]);   // --barh (app.js)
const usos = Object.entries(textos).flatMap(([f, t]) => [...t.matchAll(/var\((--[\w-]+)(\s*,)?/g)].map(m => ({ f, v: m[1], respaldo: !!m[2] })));
const sinDefinir = [...new Set(usos.filter(u => !definidas.has(u.v) && !u.respaldo).map(u => u.v + ' (' + u.f + ')'))];
ok(sinDefinir.length === 0, 'toda var(--…) usada está definida' + (sinDefinir.length ? ': ' + sinDefinir.join(', ') : ''));
const tokCrudo = leer(path.join(CSS, 'tokens.css')), escalas = Object.keys(bloque(sinComentarios(tokCrudo.slice(tokCrudo.indexOf('/* Escalas de diseño'))), ':root') || {}).filter(k => /^--(letra|esp|radio|toque|alto|sombra)/.test(k));
ok(escalas.length >= 30, 'las escalas de diseño están en tokens.css (' + escalas.length + ' fichas)');
const todos = Object.values(textos).join('\n'), sinUso = escalas.filter(k => !todos.includes('var(' + k + ')'));
ok(sinUso.length === 0, 'cada ficha de las escalas se usa en algún lugar' + (sinUso.length ? ': ' + sinUso.join(', ') : ''));
ok(/::backdrop\s*\{\s*--velo:/.test(tok), '--velo se define en ::backdrop (el fondo de las hojas no hereda de :root en Chrome antiguo)');
const veloMal = Object.entries(textos).flatMap(([f, t]) => [...t.matchAll(/([^{}]+)\{[^}]*var\(--velo\)/g)].filter(m => !/::backdrop/.test(m[1])).map(() => f));
ok(veloMal.length === 0, 'var(--velo) solo se usa en ::backdrop' + (veloMal.length ? ': ' + veloMal.join(', ') : ''));

console.log('4. Archivos de CSS (index.html y service worker)');
const html = leer(path.join(APP, 'index.html')), sw = leer(path.join(APP, 'sw.js'));
const enlazados = [...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]);
const faltan = enlazados.filter(h => !fs.existsSync(path.join(APP, h)));
ok(enlazados.length >= 3 && faltan.length === 0, 'cada CSS de index.html existe (' + enlazados.length + ')' + (faltan.length ? ' · faltan: ' + faltan.join(', ') : ''));
const noSw = enlazados.filter(h => !sw.includes("'./" + h + "'"));
ok(noSw.length === 0, 'cada CSS está en ASSETS de sw.js (sin conexión)' + (noSw.length ? ': ' + noSw.join(', ') : ''));
const sobran = Object.keys(textos).filter(f => !enlazados.includes(f));
ok(sobran.length === 0, 'no hay CSS que no se cargue' + (sobran.length ? ': ' + sobran.join(', ') : ''));
const swCss = [...sw.matchAll(/'\.\/(css\/[^']+)'/g)].map(m => m[1]), swSobra = swCss.filter(f => !enlazados.includes(f));
ok(swSobra.length === 0, 'el service worker no pide CSS que ya no existe' + (swSobra.length ? ': ' + swSobra.join(', ') : ''));
const grupo = h => h === 'css/tokens.css' ? 0 : h === 'css/base.css' ? 1 : h.startsWith('css/componentes/') ? 2 : h.startsWith('css/pantallas/') ? 3 : 9;
ok(enlazados.every((h, i) => i === 0 || grupo(enlazados[i - 1]) <= grupo(h)) && grupo(enlazados[0]) === 0 && !enlazados.some(h => grupo(h) === 9),
  'orden: tokens.css, base.css, piezas comunes (componentes/) y pantallas (pantallas/)');
const largos = archivos.map(f => [rel(f), leer(f).split('\n').length]).filter(([, n]) => n > 300);
ok(largos.length === 0, 'cada archivo de CSS tiene 300 líneas o menos' + (largos.length ? ': ' + largos.map(x => x.join(' ')).join(', ') : ''));
const conImport = Object.entries(textos).filter(([, t]) => /@import/.test(t)).map(([f]) => f);
ok(conImport.length === 0, 'sin @import (cada archivo se carga desde index.html, en paralelo)' + (conImport.length ? ': ' + conImport.join(', ') : ''));

console.log(fails ? '\nFALLAS: ' + fails : '\nTodo bien');
process.exit(fails ? 1 : 0);
