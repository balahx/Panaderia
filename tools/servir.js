#!/usr/bin/env node
/* Abre la app en el computador para probarla:  node tools/servir.js [puerto]   (por defecto 5000)
   Luego entra a http://localhost:5000  ·  Ctrl+C para detener. */
const { crear } = require('./servidor.js');
const puerto = Number(process.argv[2]) || 5000;
crear().abrir(puerto).then(url => console.log('Panadería abierta en ' + url + '  (Ctrl+C para detener)'))
  .catch(e => { console.error(e.code === 'EADDRINUSE' ? 'El puerto ' + puerto + ' está ocupado. Prueba: node tools/servir.js 5001' : e.message); process.exit(1); });
