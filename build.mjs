import { readFile,writeFile,mkdir,readdir,copyFile } from 'node:fs/promises';
import { join,relative,extname } from 'node:path';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const assets={};
async function collect(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory()){await collect(path);continue;}
    assets['/'+relative('public',path).replaceAll('\\','/')]=[types[extname(path)]||'application/octet-stream',(await readFile(path)).toString('base64')];
  }
}
await collect('public');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
const core=(await readFile('core.mjs','utf8')).replaceAll('export ','');
const worker=(await readFile('worker.mjs','utf8')).replace("import { handle } from './core.mjs';","");
await writeFile('dist/server/index.js',core+'\n'+worker+'\nconst assets='+JSON.stringify(assets)+';\n'+`
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/') || path.startsWith('/media/')) return hostedApi(request,env);
  if(request.method!=='GET' && request.method!=='HEAD') return new Response(null,{status:405});
  const route=({'/':'/index.html','/demo':'/index.html','/admin':'/admin.html','/admin/':'/admin.html'})[path]||path;
  const asset=Object.hasOwn(assets,route)?assets[route]:null;
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset[0],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}});
}};
`);
console.log('Built Worker with '+Object.keys(assets).length+' public assets.');
