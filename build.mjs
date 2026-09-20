import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({entryPoints:['src/orders-ui.js'],bundle:true,define:{__NEON_LAB__:'false'},minify:true,format:'esm',target:'es2022',outfile:'dist/wallet.bundle.js',legalComments:'eof'});
await build({entryPoints:['src/perps-ui.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/perps.bundle.js',legalComments:'eof'});
await copyFile('dist/perps.html','dist/index.html');
console.log('Wallet bundle built. Static terminal assets are authored in dist.');

await import('./scripts/build-worker.mjs');
