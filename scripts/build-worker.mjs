import {build} from 'esbuild';import {mkdir,readFile,writeFile,cp,copyFile} from 'node:fs/promises';
await mkdir('.build',{recursive:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const assets={};for(const f of ['index.html','spot.html','style.css','app.js','engine.js','wallet.bundle.js','perps.html','perps.css','perps.bundle.js'])assets['/'+f]={body:await readFile('dist/'+f,'utf8'),type:f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};
await writeFile('.build/assets.mjs','export default '+JSON.stringify(assets)+';');
await build({entryPoints:['src/worker.js'],bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',define:{__NEON_LAB__:'false'},outfile:'dist/server/index.js',legalComments:'eof'});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});console.log('Neon Worker and order database migrations built.');
